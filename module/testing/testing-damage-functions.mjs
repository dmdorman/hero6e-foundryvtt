import { HEROSYS } from "../herosystem6e.mjs";

import { HeroSystem6eActor } from "../actor/actor.mjs";

import { HeroSystem6eItem } from "../item/item.mjs";
import { calculateRequiredResourcesToUse } from "../item/item-attack.mjs";

import { addDiceParts, calculateDicePartsFromDcForItem, characteristicValueToDiceParts } from "../utility/damage.mjs";

export function registerDamageFunctionTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.damageFunctions",
        (context) => {
            const { after, assert, before, describe, expect, it } = context;

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

            describe("characteristicValueToDiceParts", function () {
                describe("handle multiples of 5", function () {
                    it("should handle 5", function () {
                        expect(characteristicValueToDiceParts(5)).to.deep.equal({
                            dc: 1,
                            d6Count: 1,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        });
                    });

                    it("should handle 45", function () {
                        expect(characteristicValueToDiceParts(45)).to.deep.equal({
                            dc: 9,
                            d6Count: 9,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        });
                    });
                });

                describe("handle non multiples of 5", function () {
                    it("should handle -8", function () {
                        expect(characteristicValueToDiceParts(-8)).to.deep.equal({
                            dc: -1.6,
                            d6Count: -1,
                            d6Less1DieCount: 0,
                            halfDieCount: -1,
                            constant: 0,
                        });
                    });

                    it("should handle -7", function () {
                        expect(characteristicValueToDiceParts(-7)).to.deep.equal({
                            dc: -1,
                            d6Count: -1,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        });
                    });

                    it("should handle 7", function () {
                        expect(characteristicValueToDiceParts(7)).to.deep.equal({
                            dc: 1,
                            d6Count: 1,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        });
                    });

                    it("should handle 8", function () {
                        expect(characteristicValueToDiceParts(8)).to.deep.equal({
                            dc: 1.6,
                            d6Count: 1,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        });
                    });

                    it("should handle 42", function () {
                        expect(characteristicValueToDiceParts(42)).to.deep.equal({
                            dc: 8,
                            d6Count: 8,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        });
                    });

                    it("should handle 43", function () {
                        expect(characteristicValueToDiceParts(43)).to.deep.equal({
                            dc: 8.6,
                            d6Count: 8,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        });
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
                const twoDiceAndAHalfInDiceParts = Object.freeze({
                    d6Count: 2,
                    d6Less1DieCount: 0,
                    halfDieCount: 1,
                    constant: 0,
                });
                const threeDiceInDiceParts = Object.freeze({
                    d6Count: 3,
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
                    const nonTargettingFlashContent = `
                        <POWER XMLID="FLASH" ID="1740973760304" BASECOST="0.0" LEVELS="1" ALIAS="Flash" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                        </POWER>
                    `;
                    let killingItem;
                    let egoAttackItem;
                    let normalItem;
                    let threePointFlashItem;

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

                        threePointFlashItem = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(nonTargettingFlashContent, actor),
                            {
                                parent: actor,
                            },
                        );
                        await threePointFlashItem._postUpload();
                        actor.items.set(threePointFlashItem.system.XMLID, threePointFlashItem);
                    });

                    describe("-1 DC", function () {
                        it("-1 DC Killing Attack", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, -1)),
                                negativeOneInDiceParts,
                            );
                        });
                    });

                    describe("0 DC", function () {
                        it("0 DC Killing Attack", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 0)),
                                zeroInDiceParts,
                            );
                        });
                    });

                    describe("1 DC", function () {
                        it("1 DC Killing Attack", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Killing Attack & +1/4 advantage", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 1)),
                                zeroInDiceParts,
                            );
                        });

                        it("1 DC Killing Attack & +1/2 advantage", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 2;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 1)),
                                zeroInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +1/4 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 10AP/die and a 1/4 advantage is 12.5 AP per die or 1.25 DC per die
                            // 5 AP with 12.5 AP per die = 0.4 which is more than 0.3 (the cost of a pip)
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +1/2 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 2 / 4;
                                },
                                configurable: true,
                            });

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 10AP/die and a 2/4 advantage is 15 AP per die or 1.5 DC per die
                            // 5 AP with 15 AP per die = 0.3333 which is more than 0.3 (the cost of a pip)
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +3/4 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +1 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                zeroInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                oneDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1/4 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1/2 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 2 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +3/4 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 4 / 4;
                                },
                                configurable: true,
                            });

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
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 5 / 4;
                                },
                                configurable: true,
                            });

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
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 6 / 4;
                                },
                                configurable: true,
                            });

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
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 8 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(filterDc(calculateDicePartsFromDcForItem(normalItem, 1)), zeroInDiceParts);
                        });

                        it("1 DC Flash Attack", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                oneAndAHalfDiceInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +1/4 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                oneDieInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +1/2 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 2 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                oneDieInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +3/4 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +1 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 4 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +1 1/4 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 5 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +1 1/2 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 6 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Flash Attack & +2 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 8 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 1)),
                                halfDieInDiceParts,
                            );
                        });
                    });

                    describe("2 DC", function () {
                        it("2 DC Killing Attack", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +1/4 advantage", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +1/2 advantage", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 2;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +3/4 advantage", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +1 advantage", function () {
                            Object.defineProperty(killingItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1/4 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1/2 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 2 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +3/4 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1 1/4 advantage", function () {
                            Object.defineProperty(egoAttackItem, "_advantagesAffectingDc", {
                                get() {
                                    return 5 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                twoDiceInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1/4 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneAndAHalfDiceInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1/2 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 2 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +3/4 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1 advantage", function () {
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 4 / 4;
                                },
                                configurable: true,
                            });

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
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 5 / 4;
                                },
                                configurable: true,
                            });

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
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 6 / 4;
                                },
                                configurable: true,
                            });

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
                            Object.defineProperty(normalItem, "_advantagesAffectingDc", {
                                get() {
                                    return 8 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 0 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                threeDiceInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +1/4 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 1 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                twoDiceAndAHalfInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +1/2 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 2 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                twoDiceInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +3/4 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 3 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                oneAndAHalfDiceInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +1 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 4 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                oneAndAHalfDiceInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +1 1/4 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 5 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                oneAndAHalfDiceInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +1 1/2 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 6 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Flash Attack & +2 advantage", function () {
                            Object.defineProperty(threePointFlashItem, "_advantagesAffectingDc", {
                                get() {
                                    return 8 / 4;
                                },
                                configurable: true,
                            });

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(threePointFlashItem, 2)),
                                oneDieInDiceParts,
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
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, 1d6+1 HKA, +2 DC");
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
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, 1d6+1 HKA, +4 DC");
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
                    assert.equal(item._activePointsDcAffecting, 10);
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
                        assert.equal(item._activePointsDcAffecting, 10);
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
                        assert.equal(item._activePointsDcAffecting, 20);
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
                        assert.equal(item._activePointsDcAffecting, 30);
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
                    // 10 STR +2 DC from Martial Strike
                    assert.equal(item.system.damage, "4d6");
                });

                it("6e Martial Strike description", function () {
                    // 10 STR +2 DC from Martial Strike
                    assert.equal(item.system.description, "1/2 Phase, +0 OCV, +2 DCV, 4d6 Strike, +2 DC");
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
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, Grab One Limb; 2d6 NND, +4 DC");
                });
            });

            // Skip for the time being as there are issues with calculating costs
            describe("changePowerLevel", function () {
                describe("3 AP/die - Nontargeting FLASH", function () {
                    const threePointFlashContent = `
                    <POWER XMLID="FLASH" ID="1739848128585" BASECOST="0.0" LEVELS="11" ALIAS="Flash" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="PLUSONEHALFDIE" ID="1740969655759" BASECOST="1.5" LEVELS="0" ALIAS="+1/2 d6" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                    </POWER>
                `;
                    let actor;
                    let threePointFlashItem;

                    before(async () => {
                        actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            {},
                        );
                        actor.system.is5e = false;
                        await actor._postUpload();

                        threePointFlashItem = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(threePointFlashContent, actor),
                            {
                                parent: actor,
                            },
                        );
                        await threePointFlashItem._postUpload();
                        actor.items.set(threePointFlashItem.system.XMLID, threePointFlashItem);
                    });

                    describe("confirm default values", function () {
                        it("realCost", function () {
                            assert.equal(threePointFlashItem.realCost, 34.5);
                        });

                        it("activePoints", function () {
                            assert.equal(threePointFlashItem.activePoints, 34.5);
                        });

                        it("damage", function () {
                            assert.equal(threePointFlashItem.system.damage, "11½d6");
                        });

                        it("end", function () {
                            assert.equal(threePointFlashItem.end, 3);
                        });
                    });

                    describe("push base FLASH to 38 CP", function () {
                        let pushedItem;

                        before(async function () {
                            const pushedItemData = threePointFlashItem.toObject(false);
                            pushedItemData._id = null;
                            pushedItem = new HeroSystem6eItem(pushedItemData, { parent: actor });

                            // Reduce or Push the item
                            pushedItem.changePowerLevel(38);
                            pushedItem.system._active.pushedRealPoints = 3;

                            pushedItem._postUpload();
                        });

                        it("realCost", function () {
                            assert.equal(pushedItem._realCost, 37.5);
                        });

                        it("activePoints", function () {
                            assert.equal(pushedItem._activePoints, 37.5);
                        });

                        it("damage", function () {
                            assert.equal(pushedItem.system.damage, "12½d6");
                        });

                        it("END", function () {
                            assert.equal(pushedItem.end, 3);
                        });

                        // PH: FIXME: pushed endurance usage
                        it("total END usage", function () {
                            assert.equal(calculateRequiredResourcesToUse([pushedItem], {}).totalEnd, 6);
                        });
                    });

                    describe("push base FLASH to 43.5 CP", function () {
                        let pushedItem;

                        before(async function () {
                            const pushedItemData = threePointFlashItem.toObject(false);
                            pushedItemData._id = null;
                            pushedItem = new HeroSystem6eItem(pushedItemData, { parent: actor });

                            // Reduce or Push the item
                            pushedItem.changePowerLevel(43.5);
                            pushedItem.system._active.pushedRealPoints = 9;

                            pushedItem._postUpload();
                        });

                        it("realCost", function () {
                            assert.equal(pushedItem._realCost, 43.5);
                        });

                        it("activePoints", function () {
                            assert.equal(pushedItem._activePoints, 43.5);
                        });

                        it("damage", function () {
                            assert.equal(pushedItem.system.damage, "14½d6");
                        });

                        it("END", function () {
                            assert.equal(pushedItem.end, 3);
                        });

                        // PH: FIXME: pushed endurance usage
                        it("total END usage", function () {
                            assert.equal(calculateRequiredResourcesToUse([pushedItem], {}).totalEnd, 12);
                        });
                    });
                });

                describe("5 AP/die - EB with +1/2 advantage and -1/2 limitation", function () {
                    const ebContent = `
                        <POWER XMLID="ENERGYBLAST" ID="1731782138578" BASECOST="0.0" LEVELS="10" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="PENETRATING" ID="1741139495664" BASECOST="0.0" LEVELS="1" ALIAS="Penetrating" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="INCREASEDEND" ID="1741139501142" BASECOST="-0.5" LEVELS="0" ALIAS="Increased Endurance Cost" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2X" OPTIONID="2X" OPTION_ALIAS="x2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                        </POWER>
                    `;
                    let actor;
                    let ebWithAdvAndLimItem;

                    before(async () => {
                        actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            {},
                        );
                        actor.system.is5e = false;
                        await actor._postUpload();

                        ebWithAdvAndLimItem = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(ebContent, actor), {
                            parent: actor,
                        });
                        await ebWithAdvAndLimItem._postUpload();
                        actor.items.set(ebWithAdvAndLimItem.system.XMLID, ebWithAdvAndLimItem);
                    });

                    describe("confirm default values", function () {
                        it("realCost", function () {
                            assert.equal(ebWithAdvAndLimItem.realCost, 50);
                        });

                        it("activePoints", function () {
                            assert.equal(ebWithAdvAndLimItem.activePoints, 75);
                        });

                        it("damage", function () {
                            assert.equal(ebWithAdvAndLimItem.system.damage, "10d6");
                        });

                        it("end", function () {
                            assert.equal(ebWithAdvAndLimItem.end, 14);
                        });
                    });

                    describe("push EB to 55 CP", function () {
                        let pushedItem;

                        before(async function () {
                            const pushedItemData = ebWithAdvAndLimItem.toObject(false);
                            pushedItemData._id = null;
                            pushedItem = new HeroSystem6eItem(pushedItemData, { parent: actor });

                            // Reduce or Push the item
                            pushedItem.changePowerLevel(55);
                            pushedItem.system._active.pushedRealPoints = 5;

                            pushedItem._postUpload();
                        });

                        it("realCost", function () {
                            assert.equal(pushedItem._realCost, 55);
                        });

                        it("activePoints", function () {
                            assert.equal(pushedItem._activePoints, 82);
                        });

                        it("damage", function () {
                            assert.equal(pushedItem.system.damage, "11d6");
                        });

                        it("END", function () {
                            assert.equal(pushedItem.end, 14);
                        });

                        // PH: FIXME: pushed endurance usage
                        it("total END usage", function () {
                            assert.equal(calculateRequiredResourcesToUse([pushedItem], {}).totalEnd, 19);
                        });
                    });

                    describe("push base FLASH to 58 CP", function () {
                        let pushedItem;

                        before(async function () {
                            // const pushedItemData = ebWithAdvAndLimItem.toObject(false);
                            // pushedItemData._id = null;
                            // pushedItem = new HeroSystem6eItem(pushedItemData, { parent: actor });
                            pushedItem = ebWithAdvAndLimItem.clone();

                            // Reduce or Push the item
                            pushedItem.changePowerLevel(58);
                            pushedItem.system._active.pushedRealPoints = 8;

                            pushedItem._postUpload();
                        });

                        it("realCost", function () {
                            assert.equal(pushedItem._realCost, 58);
                        });

                        it("activePoints", function () {
                            assert.equal(pushedItem._activePoints, 87);
                        });

                        it("damage", function () {
                            assert.equal(pushedItem.system.damage, "11½d6");
                        });

                        it("END", function () {
                            assert.equal(pushedItem.end, 14);
                        });

                        // PH: FIXME: pushed endurance usage
                        it("total END usage", function () {
                            assert.equal(calculateRequiredResourcesToUse([pushedItem], {}).totalEnd, 22);
                        });
                    });
                });

                describe("10 AP/die - DRAIN with -1 1/4 limitation", function () {
                    const drainContent = `
                        <POWER XMLID="DRAIN" ID="1741139603007" BASECOST="0.0" LEVELS="7" ALIAS="Drain" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="GESTURES" ID="1741140049083" BASECOST="-0.25" LEVELS="0" ALIAS="Gestures" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="FOCUS" ID="1741140057463" BASECOST="-1.0" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OAF" OPTIONID="OAF" OPTION_ALIAS="OAF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                        </POWER>
                    `;
                    let actor;
                    let drainWithLimItem;

                    before(async () => {
                        actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            {},
                        );
                        actor.system.is5e = false;
                        await actor._postUpload();

                        drainWithLimItem = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(drainContent, actor), {
                            parent: actor,
                        });
                        await drainWithLimItem._postUpload();
                        actor.items.set(drainWithLimItem.system.XMLID, drainWithLimItem);
                    });

                    describe("confirm default values", function () {
                        it("realCost", function () {
                            assert.equal(drainWithLimItem.system.realCost, 31);
                        });

                        it("activePoints", function () {
                            assert.equal(drainWithLimItem.activePoints, 70);
                        });

                        it("damage", function () {
                            assert.equal(drainWithLimItem.system.damage, "7d6");
                        });

                        it("end", function () {
                            assert.equal(drainWithLimItem.end, 7);
                        });
                    });

                    describe("push DRAIN to 34 CP", function () {
                        let pushedItem;

                        before(async function () {
                            const pushedItemData = drainWithLimItem.toObject(false);
                            pushedItemData._id = null;
                            pushedItem = new HeroSystem6eItem(pushedItemData, { parent: actor });

                            // Reduce or Push the item
                            pushedItem.changePowerLevel(34);
                            pushedItem.system._active.pushedRealPoints = 3;

                            pushedItem._postUpload();
                        });

                        it("realCost", function () {
                            assert.equal(pushedItem._realCost, 33); // 34 -> 76.5 AP gives 75 AP as built -> 33 RP with 1.25 limitation
                        });

                        it("activePoints", function () {
                            assert.equal(pushedItem._activePoints, 75);
                        });

                        it("damage", function () {
                            assert.equal(pushedItem.system.damage, "7½d6");
                        });

                        it("END", function () {
                            assert.equal(pushedItem.end, 7);
                        });

                        it("total END usage", function () {
                            assert.equal(calculateRequiredResourcesToUse([pushedItem], {}).totalEnd, 10);
                        });
                    });

                    describe("push DRAIN to 37 CP", function () {
                        let pushedItem;

                        before(async function () {
                            const pushedItemData = drainWithLimItem.toObject(false);
                            pushedItemData._id = null;
                            pushedItem = new HeroSystem6eItem(pushedItemData, { parent: actor });

                            // Reduce or Push the item
                            pushedItem.changePowerLevel(37);
                            pushedItem.system._active.pushedRealPoints = 6;

                            pushedItem._postUpload();
                        });

                        it("realCost", function () {
                            assert.equal(pushedItem._realCost, 37);
                        });

                        it("activePoints", function () {
                            assert.equal(pushedItem._activePoints, 83);
                        });

                        it("damage", function () {
                            assert.equal(pushedItem.system.damage, "8d6+1");
                        });

                        it("END", function () {
                            assert.equal(pushedItem.end, 7);
                        });

                        // PH: FIXME: pushed endurance usage
                        it("total END usage", function () {
                            assert.equal(calculateRequiredResourcesToUse([pushedItem], {}).totalEnd, 13);
                        });
                    });
                });
            });
        },
        { displayName: "HERO: Damage Functions" },
    );
}
