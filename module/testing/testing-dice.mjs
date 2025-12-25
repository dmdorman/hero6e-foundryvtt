import { HeroRoller } from "../utility/dice.mjs";

const Die = foundry.dice.terms.Die;

function FixedDieRoll(fixedRollResult) {
    return class extends Die {
        constructor(termData = {}) {
            super(termData);
        }

        /**
         * Roll for this die, but always roll rollResult (i.e. it's not random)
         */
        _evaluate() {
            for (let i = 0; i < this.number; ++i) {
                const roll = { result: fixedRollResult, active: true };
                this.results.push(roll);
            }

            return this;
        }
    };
}

function DynamicDieRoll(generateRollResult) {
    return class extends Die {
        constructor(termData = {}) {
            super(termData);
        }

        /**
         * Roll for this die based on the provided function
         */
        _evaluate() {
            for (let i = 0; i < this.number; ++i) {
                const roll = { result: generateRollResult(), active: true };
                this.results.push(roll);
            }

            return this;
        }
    };
}

class RollMock extends Roll {
    static DieClass = Die;

    static fromTerms(terms, options) {
        const newTerms = terms.map((term) => {
            // Replace all Die with a DieClass that will always return an expected behavior when rolling
            if (term instanceof Die) {
                return new this.DieClass({
                    number: term.number,
                    faces: term.faces,
                    options: term.options,
                });
            }

            return term;
        });

        const formula = Roll.getFormula(newTerms);

        // eslint-disable-next-line no-use-before-define -- Recursive definition should be fine here
        const mock = new Roll1Mock(formula, options);
        mock.terms = newTerms;

        return mock;
    }

    constructor(formula, data, options) {
        super(formula, data, options);
    }
}

class Roll6Mock extends RollMock {
    static fixedRollResult = 6;
    static DieClass = FixedDieRoll(this.fixedRollResult);
}

class Roll5Mock extends RollMock {
    static fixedRollResult = 5;
    static DieClass = FixedDieRoll(this.fixedRollResult);
}

class Roll3Mock extends RollMock {
    static fixedRollResult = 3;
    static DieClass = FixedDieRoll(this.fixedRollResult);
}

class Roll2Mock extends RollMock {
    static fixedRollResult = 2;
    static DieClass = FixedDieRoll(this.fixedRollResult);
}

class Roll1Mock extends RollMock {
    static fixedRollResult = 1;
    static DieClass = FixedDieRoll(this.fixedRollResult);
}

function buildGenerateLinearRollResultFunction(start, end, step) {
    let result = start;

    return {
        generate: function generateRoll() {
            const value = result;
            result = result + step;
            if (result > end) result = start;
            if (result < start) result = end;
            return value;
        },
        reset: function resetRollResult() {
            result = start;
        },
    };
}

function buildGenerateAlternatingRollResultFunction(first, other) {
    let result = first;

    return {
        generate: function generateRoll() {
            const value = result;
            result = result === first ? other : first;
            return value;
        },
        reset: function resetRollResult() {
            result = first;
        },
    };
}

class Roll1Through6Mock extends RollMock {
    static generatorInfo = buildGenerateLinearRollResultFunction(1, 6, 1);
    static DieClass = DynamicDieRoll(Roll1Through6Mock.generatorInfo.generate);
}

class RollAlternatingLuckAndUnluck extends RollMock {
    static generatorInfo = buildGenerateAlternatingRollResultFunction(6, 1);
    static DieClass = DynamicDieRoll(RollAlternatingLuckAndUnluck.generatorInfo.generate);
}

export function registerDiceTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.utils.dice",
        (context) => {
            const { describe, expect, it } = context;
            describe("HeroRoller", function () {
                describe("chaining", function () {
                    it("should be conditional for make functions with negative and default", function () {
                        const roller = new HeroRoller().makeSuccessRoll();

                        roller.makeNormalRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeNormalRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeNormalRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeNormalRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);

                        roller.makeKillingRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);
                        roller.makeKillingRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);
                        roller.makeKillingRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);
                        roller.makeKillingRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);

                        roller.makeSuccessRoll();
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeKillingRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeKillingRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeKillingRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);
                        roller.makeKillingRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);

                        roller.makeAdjustmentRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);
                        roller.makeAdjustmentRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);
                        roller.makeAdjustmentRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);
                        roller.makeAdjustmentRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ADJUSTMENT);

                        roller.makeEntangleRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ADJUSTMENT);
                        roller.makeEntangleRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ADJUSTMENT);
                        roller.makeEntangleRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ADJUSTMENT);
                        roller.makeEntangleRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ENTANGLE);

                        roller.makeFlashRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ENTANGLE);
                        roller.makeFlashRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ENTANGLE);
                        roller.makeFlashRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ENTANGLE);
                        roller.makeFlashRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.FLASH);

                        roller.makeEffectRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.FLASH);
                        roller.makeEffectRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.FLASH);
                        roller.makeEffectRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.FLASH);
                        roller.makeEffectRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.EFFECT);

                        roller.makeLuckRoll(0);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.EFFECT);
                        roller.makeLuckRoll(false);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.EFFECT);
                        roller.makeLuckRoll(null);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.EFFECT);
                        roller.makeLuckRoll(undefined);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.LUCK);
                    });

                    it("should be conditional for make functions with negative and default", function () {
                        const roller = new HeroRoller();

                        roller.makeNormalRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);

                        roller.makeKillingRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);

                        roller.makeSuccessRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.SUCCESS);

                        roller.makeKillingRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);

                        roller.makeAdjustmentRoll(1);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ADJUSTMENT);

                        roller.makeEntangleRoll("blah");
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.ENTANGLE);

                        roller.makeFlashRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.FLASH);

                        roller.makeEffectRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.EFFECT);

                        roller.makeLuckRoll(true);
                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.LUCK);
                    });
                });

                describe("formula", function () {
                    it("should be able to handle no terms and get a 0 formula", async function () {
                        const roller = new HeroRoller();

                        await roller.roll();

                        expect(roller.getFormula()).to.equal("0");
                    });

                    it("should handle formulas with numeric term", async function () {
                        const roller = new HeroRoller().addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("7");
                    });

                    it("should handle formulas with negative numeric term", async function () {
                        const roller = new HeroRoller().addNumber(-7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("-7");
                    });

                    it("should handle formulas with multiple negative numeric term", async function () {
                        const roller = new HeroRoller().addNumber(-7).addNumber(-7).addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("-7 - 7 + 7");
                    });

                    it("should handle formulas with multiple numeric terms", async function () {
                        const roller = new HeroRoller().addNumber(7).addNumber(3).addNumber(2);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("7 + 3 + 2");
                    });

                    it("should handle formulas with multiple numeric terms of varied sign", async function () {
                        const roller = new HeroRoller().addNumber(-7).addNumber(3).addNumber(-2);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("-7 + 3 - 2");
                    });

                    it("should handle formulas with whole dice", async function () {
                        const roller = new HeroRoller().addDice(2);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("2d6");
                    });

                    it("should handle formulas with half dice", async function () {
                        const roller = new HeroRoller().addHalfDice(2);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("2(½d6)");
                    });

                    it("should handle formulas with half dice", async function () {
                        const roller = new HeroRoller().addHalfDice(1);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("½d6");
                    });

                    it("should handle formulas with whole dice minus 1", async function () {
                        const roller = new HeroRoller().addDiceMinus1(1);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("1d6-1");
                    });

                    it("should handle formulas with whole dice minus 1", async function () {
                        const roller = new HeroRoller().addDiceMinus1(2);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("2(d6-1)");
                    });

                    it("should handle formulas with a mix", async function () {
                        const roller = new HeroRoller()
                            .addNumber(11)
                            .addNumber(-3)
                            .addNumber(2)
                            .addDice(-3)
                            .addHalfDice(1)
                            .addHalfDice(-1)
                            .addDice(9)
                            .addNumber(1);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("11 - 3 + 2 - 3d6 + ½d6 - ½d6 + 9d6 + 1");
                    });

                    it("should handle removing largest terms from simple formulas (explosions)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).addDice(10);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6");

                        roller.removeNHighestRankTerms(2);

                        expect(roller.getFormula()).to.equal("8d6");
                    });

                    it("should handle removing largest terms from multi term formulas and 1 part completely (explosions)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).addDice(10).addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6 + 7");

                        roller.removeNHighestRankTerms(1);

                        expect(roller.getFormula()).to.equal("10d6");
                    });

                    it("should handle removing largest terms from multi term formulas (explosions)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).addDice(10).addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6 + 7");

                        roller.removeNHighestRankTerms(3);

                        expect(roller.getFormula()).to.equal("8d6");
                    });

                    it("should handle removing first terms from simple formulas (damage negation)", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).addDice(10);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6");

                        roller.removeFirstNTerms(2);

                        expect(roller.getFormula()).to.equal("8d6");
                    });

                    it("should handle removing first terms from multi term formulas and 1 part completely (damage negation)", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).addDice(10).addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6 + 7");

                        roller.removeFirstNTerms(2);

                        expect(roller.getFormula()).to.equal("8d6 + 7");
                    });

                    it("should gracefully handle removing all terms that exist", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).addDice(10).addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6 + 7");

                        roller.removeFirstNTerms(12);

                        expect(roller.getFormula()).to.equal("");
                    });

                    it("should gracefully handle removing more terms than exist", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).addDice(10).addNumber(7);
                        await roller.roll();

                        expect(roller.getFormula()).to.equal("10d6 + 7");

                        roller.removeFirstNTerms(22);

                        expect(roller.getFormula()).to.equal("");
                    });
                });

                describe("tags", async function () {
                    it("should generate tags for a positive number term", async function () {
                        const description = "tag test positive number";
                        const number = 7;
                        const roller = new HeroRoller({}).addNumber(number, description);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: undefined }]);
                    });

                    it("should generate tags for a negative number term", async function () {
                        const description = "tag test negative number";
                        const number = -7;
                        const roller = new HeroRoller({}).addNumber(number, description);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: undefined }]);
                    });

                    it("should generate tags for multiple negative number term", async function () {
                        const description = "tag test negative number";
                        const number = -7;
                        const description2 = description + " #2";
                        const number2 = -8;
                        const roller = new HeroRoller({})
                            .addNumber(number, description)
                            .addNumber(number2, description2);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([
                            { name: description, value: number, title: undefined },
                            { name: description2, value: number2, title: undefined },
                        ]);
                    });

                    it("should provide an undefined tooltip if not provided", async function () {
                        const description = "tag test no tooltip";
                        const number = -7;
                        const description2 = description + " #2";
                        const number2 = -8;
                        const roller = new HeroRoller({})
                            .addNumber(number, description)
                            .addNumber(number2, description2);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([
                            { name: description, value: number, title: undefined },
                            { name: description2, value: number2, title: undefined },
                        ]);
                    });

                    it("should pass through tooltips", async function () {
                        const description = "tag test negative number";
                        const tooltip = "tag test tooltip ... this space for rent";
                        const number = -7;
                        const description2 = description + " #2";
                        const tooltip2 = "tag test tooltip ... this space for rent" + " #2";
                        const number2 = -8;
                        const roller = new HeroRoller({})
                            .addNumber(number, description, tooltip)
                            .addNumber(number2, description2, tooltip2);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([
                            { name: description, value: number, title: tooltip },
                            { name: description2, value: number2, title: tooltip2 },
                        ]);
                    });

                    it("should generate tags for addDice with no tooltip", async function () {
                        const description = "tag test positive number";
                        const number = 7;
                        const roller = new HeroRoller({}).addDice(number, description);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: undefined }]);
                    });
                    it("should generate tags for addDice with tooltip", async function () {
                        const description = "tag test positive number";
                        const tooltip = "test positive number tooltip";
                        const number = 7;
                        const roller = new HeroRoller({}).addDice(number, description, tooltip);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: tooltip }]);
                    });

                    it("should generate tags for addHalfDice with no tooltip", async function () {
                        const description = "tag test positive number";
                        const number = 7;
                        const roller = new HeroRoller({}).addHalfDice(number, description);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: undefined }]);
                    });
                    it("should generate tags for addHalfDice with tooltip", async function () {
                        const description = "tag test positive number";
                        const tooltip = "test positive number tooltip";
                        const number = 7;
                        const roller = new HeroRoller({}).addHalfDice(number, description, tooltip);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: tooltip }]);
                    });

                    it("should generate tags for addDiceMinus1 with no tooltip", async function () {
                        const description = "tag test positive number";
                        const number = 7;
                        const roller = new HeroRoller({}).addDiceMinus1(number, description);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: undefined }]);
                    });
                    it("should generate tags for addDiceMinus1 with tooltip", async function () {
                        const description = "tag test positive number";
                        const tooltip = "test positive number tooltip";
                        const number = 7;
                        const roller = new HeroRoller({}).addDiceMinus1(number, description, tooltip);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: tooltip }]);
                    });

                    it("should generate tags for addDieMinus1Min1 with no tooltip", async function () {
                        const description = "tag test positive number";
                        const number = 7;
                        const roller = new HeroRoller({}).addDiceMinus1(number, description);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: undefined }]);
                    });
                    it("should generate tags for addDieMinus1Min1 with tooltip", async function () {
                        const description = "tag test positive number";
                        const tooltip = "test positive number tooltip";
                        const number = 7;
                        const roller = new HeroRoller({}).addDiceMinus1(number, description, tooltip);
                        await roller.roll();

                        expect(roller.tags()).to.deep.equal([{ name: description, value: number, title: tooltip }]);
                    });
                });

                describe("serialize/deserialize", async function () {
                    it("should generate the same object when serialized and deserialized - success roll", async function () {
                        const roller = new HeroRoller()
                            .makeSuccessRoll()
                            .addDice(7)
                            .addNumber(7)
                            .addDiceMinus1(3)
                            .addHalfDice(2)
                            .addNumber(1);

                        await roller.roll();

                        const postRoller = roller.clone();

                        expect(roller.getSuccessTerms()).to.deep.equal(postRoller.getSuccessTerms());
                        expect(roller.getFormula()).to.equal(postRoller.getFormula());
                    });

                    it("should generate the same object when serialized and deserialized - killing roll", async function () {
                        const roller = new HeroRoller()
                            .makeKillingRoll(true, { d6Count: 6, d6Less1DieCount: 1, halfDieCount: 12, constant: 2 })
                            .addDice(7)
                            .addNumber(7)
                            .addDiceMinus1(3)
                            .addHalfDice(2)
                            .addNumber(1);

                        await roller.roll();

                        const postRoller = roller.clone();

                        expect(roller.getBaseTerms()).to.deep.equal(postRoller.getBaseTerms());
                        expect(roller.getStunMultiplier()).to.deep.equal(postRoller.getStunMultiplier());
                        expect(roller.getStunMultiplierDiceParts()).to.deep.equal(
                            postRoller.getStunMultiplierDiceParts(),
                        );
                        expect(roller.getFormula()).to.equal(postRoller.getFormula());
                    });

                    it("should be possible to roll after serialization/deserialization", async function () {
                        const roller = new HeroRoller()
                            .makeSuccessRoll()
                            .addDice(7)
                            .addNumber(7)
                            .addDiceMinus1(3)
                            .addHalfDice(2)
                            .addNumber(1);

                        const postRoller = roller.clone();

                        await postRoller.roll();

                        expect(roller.getSuccessTerms()).to.not.deep.equal(postRoller.getSuccessTerms());
                        expect(roller.getFormula()).to.not.equal(postRoller.getFormula());
                    });

                    it("should be possible to modify the roll type on a clone to easily get normal body from killing attacks", async function () {
                        const roller = new HeroRoller({}).makeKillingRoll().addDice(2);

                        await roller.roll();

                        const postRoller = await roller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL);

                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.KILLING);
                        expect(postRoller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);

                        expect(roller.getFormula()).to.equal(postRoller.getFormula());

                        // Works for full dice terms only
                        function simplisticNormalBodyCalculation(value) {
                            if (value >= 6) return 2;
                            else if (value <= 1) return 0;
                            else return 1;
                        }
                        const origBodyTerms = roller.getBodyTerms();
                        expect(postRoller.getBodyTerms()).to.deep.equal(
                            origBodyTerms.map((term) => simplisticNormalBodyCalculation(term)),
                        );
                    });

                    it("should be possible to modify the roll type to the same type on a clone to get the same results as a clone", async function () {
                        const roller = new HeroRoller()
                            .makeNormalRoll()
                            .addDice(7)
                            .addNumber(7)
                            .addDiceMinus1(3)
                            .addHalfDice(2)
                            .addNumber(1);

                        await roller.roll();

                        const postRoller = await roller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL);

                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);
                        expect(postRoller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);

                        expect(roller.getBaseTerms()).to.deep.equal(postRoller.getBaseTerms());
                        expect(roller.getFormula()).to.equal(postRoller.getFormula());
                    });

                    it("should be possible to modify the roll type to the same type on a clone to get the same results as a clone and roll afterwards", async function () {
                        const roller = new HeroRoller()
                            .makeNormalRoll()
                            .addDice(7)
                            .addNumber(7)
                            .addDiceMinus1(3)
                            .addHalfDice(2)
                            .addNumber(1);

                        const postRoller = await roller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL);

                        expect(roller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);
                        expect(postRoller._type).to.equal(HeroRoller.ROLL_TYPE.NORMAL);

                        await postRoller.roll();

                        expect(roller.getBaseTerms()).to.not.deep.equal(postRoller.getBaseTerms());
                        expect(roller.getFormula()).to.not.equal(postRoller.getFormula());
                    });
                });

                describe("degenerate rolling", function () {
                    it("should work with no terms and get a 0 roll", async function () {
                        const roller = new HeroRoller();

                        await roller.roll();

                        expect(roller.getBaseTotal()).to.equal(0);
                    });
                });

                describe("Basic roll", function () {
                    it("should throw if requesting inappropriate pieces of information", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addNumber(1);

                        // Basic dice don't use STUN multipliers
                        expect(function addStunMultiplier_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(0);
                        }).to.not.throw();
                        expect(function addStunMultiplier() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(1);
                        }).to.throw();

                        // No hit locations for basic dice
                        expect(function addToHitLocation_false() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(false);
                        }).to.not.throw();
                        expect(function addToHitLocation() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(true);
                        }).to.throw();

                        // Basic dice don't do BODY
                        expect(function modifyToDoBody_false() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(false);
                        }).to.not.throw();
                        expect(function modifyToDoBody() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(true);
                        }).to.throw();

                        await roller.roll();

                        expect(function () {
                            return roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            return roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            return roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should handle a 1 pip equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addNumber(1);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([1]);
                        expect(roller.getSuccessTotal()).to.equal(1);
                    });

                    it("should take a 1 term, 1 die equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addDice(1);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([TestRollMock.fixedRollResult]);
                        expect(roller.getSuccessTotal()).to.equal(TestRollMock.fixedRollResult);
                    });

                    it("should take a 2 term, 1 die equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addDice(1).addNumber(1);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([TestRollMock.fixedRollResult, 1]);
                        expect(roller.getSuccessTotal()).to.equal(TestRollMock.fixedRollResult + 1);
                    });

                    it("should take a typical attack roll equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeSuccessRoll()
                            .addNumber(11)
                            .addNumber(9)
                            .addNumber(-2)
                            .addNumber(-2)
                            .addNumber(3)
                            .addDice(-3);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([
                            11,
                            9,
                            -2,
                            -2,
                            3,
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getSuccessTotal()).deep.to.equal(19 - 3 * TestRollMock.fixedRollResult);
                    });
                });

                describe("Success roll", function () {
                    it("should throw if requesting inappropriate pieces of information", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addNumber(1);

                        // Success dice don't use STUN multipliers
                        expect(function addStunMultiplier_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(0);
                        }).to.not.throw();
                        expect(function addStunMultiplier() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(1);
                        }).to.throw();

                        // No hit locations for success dice
                        expect(function addToHitLocation_false() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(false);
                        }).to.not.throw();
                        expect(function addToHitLocation() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(true);
                        }).to.throw();

                        // Success dice don't do BODY
                        expect(function modifyToDoBody_false() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(false);
                        }).to.not.throw();
                        expect(function modifyToDoBody() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(true);
                        }).to.throw();

                        await roller.roll();

                        expect(function () {
                            return roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            return roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            return roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should handle a 1 pip equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addNumber(1);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([1]);
                        expect(roller.getSuccessTotal()).to.equal(1);
                    });

                    it("should take a 1 term, 1 die equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addDice(1);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([TestRollMock.fixedRollResult]);
                        expect(roller.getSuccessTotal()).to.equal(TestRollMock.fixedRollResult);
                    });

                    it("should take a 2 term, 1 die equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addDice(1).addNumber(1);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([TestRollMock.fixedRollResult, 1]);
                        expect(roller.getSuccessTotal()).to.equal(TestRollMock.fixedRollResult + 1);
                    });

                    it("should take a typical attack roll equation", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeSuccessRoll()
                            .addNumber(11)
                            .addNumber(9)
                            .addNumber(-2)
                            .addNumber(-2)
                            .addNumber(3)
                            .addDice(-3);

                        await roller.roll();

                        expect(roller.getSuccessTerms()).deep.to.equal([
                            11,
                            9,
                            -2,
                            -2,
                            3,
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getSuccessTotal()).deep.to.equal(19 - 3 * TestRollMock.fixedRollResult);
                    });

                    it("should allow auto success determination of true without specific value set", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getAutoSuccess()).to.equal(true);
                    });

                    it("should allow auto success determination of false without specific value set", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getAutoSuccess()).to.equal(false);
                    });

                    it("should allow auto success determination of true", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll(true, 11).addDice(3);

                        await roller.roll();

                        expect(roller.getAutoSuccess()).to.equal(true);
                    });

                    it("should allow auto success determination of false", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeSuccessRoll(true, 11).addDice(3);

                        await roller.roll();

                        expect(roller.getAutoSuccess()).to.equal(false);
                    });

                    it("should allow auto success determination of true in roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeSuccessRoll(true, 11)
                            .addNumber(11)
                            .addDice(-3);

                        await roller.roll();

                        expect(roller.getSuccess()).to.equal(true);
                    });

                    it("should allow auto success determination of false in roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeSuccessRoll(true, 11)
                            .addNumber(11)
                            .addDice(-3);

                        await roller.roll();

                        expect(roller.getSuccess()).to.equal(false);
                    });

                    it("should allow a more complex success determination of true (just making it)", async function () {
                        const TestRollMock = Roll3Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeSuccessRoll(true, 9)
                            .addNumber(18)
                            .addDice(-3);

                        await roller.roll();

                        expect(roller.getSuccess()).to.equal(true);
                    });

                    it("should allow a more complex success determination of true (just failing it)", async function () {
                        const TestRollMock = Roll3Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeSuccessRoll(true, 9)
                            .addNumber(19)
                            .addDice(-3);

                        await roller.roll();

                        expect(roller.getSuccess()).to.equal(false);
                    });
                });

                describe("Normal roll", function () {
                    it("should throw if requesting inappropriate pieces of information", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addNumber(1);

                        await roller.roll();

                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            return roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should handle a 1 pip equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addNumber(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([1]);
                        expect(roller.getStunTotal()).deep.to.equal(1);

                        expect(roller.getBodyTerms()).deep.to.equal([0]);
                        expect(roller.getBodyTotal()).deep.to.equal(0);
                    });

                    it("should handle a -1 pip equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addNumber(-1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([-1]);
                        expect(roller.getStunTotal()).deep.to.equal(-1);

                        expect(roller.getBodyTerms()).deep.to.equal([0]);
                        expect(roller.getBodyTotal()).deep.to.equal(0);
                    });

                    it("should handle a 1 die equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([TestRollMock.fixedRollResult]);
                        expect(roller.getStunTotal()).deep.to.equal(TestRollMock.fixedRollResult);

                        expect(roller.getBodyTerms()).deep.to.equal([2]);
                        expect(roller.getBodyTotal()).deep.to.equal(2);
                    });

                    it("should handle a minus 1 die equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(-1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([-TestRollMock.fixedRollResult]);
                        expect(roller.getStunTotal()).deep.to.equal(-TestRollMock.fixedRollResult);

                        expect(roller.getBodyTerms()).deep.to.equal([-2]);
                        expect(roller.getBodyTotal()).deep.to.equal(-2);
                    });

                    it("should handle a 1 die minus 1 equation (roll 6)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDiceMinus1(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([TestRollMock.fixedRollResult - 1]);
                        expect(roller.getStunTotal()).deep.to.equal(TestRollMock.fixedRollResult - 1);

                        expect(roller.getBodyTerms()).deep.to.equal([1]);
                        expect(roller.getBodyTotal()).deep.to.equal(1);
                    });

                    it("should handle a 1 die minus 1 equation (roll 2)", async function () {
                        const TestRollMock = Roll2Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDiceMinus1(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([TestRollMock.fixedRollResult - 1]);
                        expect(roller.getStunTotal()).deep.to.equal(TestRollMock.fixedRollResult - 1);

                        expect(roller.getBodyTerms()).deep.to.equal([0]);
                        expect(roller.getBodyTotal()).deep.to.equal(0);
                    });

                    it("should handle a minus (1 die minus 1) equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDiceMinus1(-1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([-1 * (TestRollMock.fixedRollResult - 1)]);
                        expect(roller.getStunTotal()).deep.to.equal(-1 * (TestRollMock.fixedRollResult - 1));

                        expect(roller.getBodyTerms()).deep.to.equal([-1]);
                        expect(roller.getBodyTotal()).deep.to.equal(-1);
                    });

                    it("should handle a multiple dice equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getBodyTerms()).deep.to.equal([2, 2, 2]);
                        expect(roller.getBodyTotal()).deep.to.equal(6);
                    });

                    it("should handle a multiple negative dice equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(-3);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(-3 * TestRollMock.fixedRollResult);

                        expect(roller.getBodyTerms()).deep.to.equal([-2, -2, -2]);
                        expect(roller.getBodyTotal()).deep.to.equal(-6);
                    });

                    it("should calculate BODY correctly for a half die with a roll of 3", async function () {
                        const TestRollMock = Roll3Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(1).addHalfDice(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            TestRollMock.fixedRollResult + Math.ceil(TestRollMock.fixedRollResult / 2),
                        );

                        expect(roller.getBodyTerms()).deep.to.equal([1, 0]);
                        expect(roller.getBodyTotal()).deep.to.equal(1);
                    });

                    it("should handle a multiple dice and a half die equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(3).addHalfDice(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * TestRollMock.fixedRollResult + Math.ceil(TestRollMock.fixedRollResult / 2),
                        );

                        expect(roller.getBodyTerms()).deep.to.equal([2, 2, 2, 1]);
                        expect(roller.getBodyTotal()).deep.to.equal(7);
                    });

                    it("should handle a multiple dice and a 1 equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(3).addNumber(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * TestRollMock.fixedRollResult + 1);

                        expect(roller.getBodyTerms()).deep.to.equal([2, 2, 2, 0]);
                        expect(roller.getBodyTotal()).deep.to.equal(6);
                    });

                    it("should handle a multiple dice and a die minus 1 equation", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(3).addDiceMinus1(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult - 1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * TestRollMock.fixedRollResult + TestRollMock.fixedRollResult - 1,
                        );

                        expect(roller.getBodyTerms()).deep.to.equal([2, 2, 2, 1]);
                        expect(roller.getBodyTotal()).deep.to.equal(7);
                    });

                    it("should handle a standard effect full roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .modifyToStandardEffect()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL,
                            1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL + HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL + 1,
                        );

                        expect(roller.getBodyTerms()).deep.to.equal([1, 1, 1, 0, 0]);
                        expect(roller.getBodyTotal()).deep.to.equal(3);
                    });

                    it("should handle a standard effect d6 - 1 roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .modifyToStandardEffect()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL + HeroRoller.STANDARD_EFFECT_DIE_ROLL + 1,
                        );

                        expect(roller.getBodyTerms()).deep.to.equal([1, 1, 1, 1, 0]);
                        expect(roller.getBodyTotal()).deep.to.equal(4);
                    });

                    it("should work with hit locations and not apply standard effect", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .modifyToStandardEffect()
                            .addToHitLocation()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        // Should be no difference in BODY and STUN from roll (be standard effect)
                        expect(roller.getStunTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL + HeroRoller.STANDARD_EFFECT_DIE_ROLL + 1,
                        );

                        expect(roller.getBodyTerms()).deep.to.equal([1, 1, 1, 1, 0]);
                        expect(roller.getBodyTotal()).deep.to.equal(4);

                        // But we should be able to get a hit location that is not
                        // determined by standard effect.
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should work with hit locations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .addToHitLocation()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        // But we should be able to get a hit location that is not
                        // determined by standard effect.
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Head",
                            side: "none",
                            fullName: "Head",
                            stunMultiplier: 2,
                            bodyMultiplier: 2,
                        });
                    });

                    it('should work with a "none" hit locations', async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .addToHitLocation(true, "none")
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        // But we should be able to get a hit location that is not
                        // determined by standard effect.
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Head",
                            side: "none",
                            fullName: "Head",
                            stunMultiplier: 2,
                            bodyMultiplier: 2,
                        });
                    });

                    it("should work with a guaranteed hit location", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .addToHitLocation(true, "Foot")
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        // But we should be able to get a hit location that is not
                        // determined by standard effect.
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should work with a guaranteed hit location but no hit side", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .addToHitLocation(true, "Foot", false, "none")
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        // But we should be able to get a hit location that is not
                        // determined by standard effect.
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should work with a guaranteed hit location and hit side", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .addToHitLocation(true, "Foot", true, "Right")
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        // But we should be able to get a hit location that is not
                        // determined by standard effect.
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "Right",
                            fullName: "Right Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should work in the presence of an explosion modifier", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).deep.to.equal([1, 2, 3, 3, 1]);
                        expect(roller.getStunTotal()).deep.to.equal(10);

                        roller.removeNHighestRankTerms(2);

                        expect(roller.getStunTerms()).deep.to.equal([2, 1, 1]);
                        expect(roller.getStunTotal()).deep.to.equal(4);
                    });

                    it("should work with damage reduction that doesn't remove all DC", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(5);

                        await roller.roll();

                        roller.removeNDC(4);

                        expect(roller.getStunTerms()).to.deep.equal([1]);
                        expect(roller.getStunTotal()).to.deep.equal(1);

                        expect(roller.getBodyTerms()).to.deep.equal([0]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("1d6");
                    });

                    it("should work with damage reduction that removes all DC", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(5);

                        await roller.roll();

                        roller.removeNDC(5);

                        expect(roller.getStunTerms()).to.deep.equal([]);
                        expect(roller.getStunTotal()).to.deep.equal(0);

                        expect(roller.getBodyTerms()).to.deep.equal([]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("");
                    });

                    it("should work with damage reduction that removes more than all DC", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(5);

                        await roller.roll();

                        roller.removeNDC(8);

                        expect(roller.getStunTerms()).to.deep.equal([]);
                        expect(roller.getStunTotal()).to.deep.equal(0);

                        expect(roller.getBodyTerms()).to.deep.equal([]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("");
                    });

                    it("should work with damage reduction that removes some DC but leaves partial DC", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(5).addNumber(1);

                        await roller.roll();

                        roller.removeNDC(5);

                        expect(roller.getStunTerms()).to.deep.equal([1]);
                        expect(roller.getStunTotal()).to.deep.equal(1);

                        expect(roller.getBodyTerms()).to.deep.equal([0]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("1");
                    });

                    it("should work with damage reduction that removes some DC but leaves partial DC", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addDice(5).addHalfDice(1);

                        await roller.roll();

                        roller.removeNDC(5);

                        expect(roller.getStunTerms()).to.deep.equal([1]);
                        expect(roller.getStunTotal()).to.deep.equal(1);

                        expect(roller.getBodyTerms()).to.deep.equal([0]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("½d6");
                    });

                    it("should work with damage reduction that removes some DC but leaves partial DC when partial comes first", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeNormalRoll().addHalfDice(1).addDice(5);

                        await roller.roll();

                        roller.removeNDC(5);

                        expect(roller.getStunTerms()).to.deep.equal([1]);
                        expect(roller.getStunTotal()).to.deep.equal(1);

                        expect(roller.getBodyTerms()).to.deep.equal([0]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("½d6");
                    });

                    it("should support STUN only", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeNormalRoll()
                            .modifyToDoNoBody()
                            .addHalfDice(1)
                            .addDice(2)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunTerms()).to.deep.equal([3, 6, 6, 1]);
                        expect(roller.getStunTotal()).to.deep.equal(16);

                        expect(roller.getBodyTerms()).to.deep.equal([0, 0, 0, 0]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("½d6 + 2d6 + 1");
                    });
                });

                describe("Killing roll", function () {
                    it("should throw if requesting inappropriate pieces of information", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addNumber(1);

                        await roller.roll();

                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should calculate the default stun multiplier correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1);
                    });

                    it("should not calculate the default stun multiplier correctly for 5e in reverse order", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true) // This locks in the multipler as a 6e
                            .modifyTo5e(true)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.not.equal(TestRollMock.fixedRollResult - 1);
                    });

                    it("should calculate default stun multiplier correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));
                    });

                    it("should calculate default stun multiplier correctly for 6e in reverse order", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .modifyTo5e(false)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));
                    });

                    it("should calculate a stun multiplier with no parts correctly for 5e as a minimum 1", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(1);
                    });

                    it("should calculate a stun multiplier with a const (1) correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 1,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(1);
                    });

                    it("should calculate a stun multiplier with a fixed const correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 66,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(66);
                    });

                    it("should calculate a stun multiplier with a half die correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 1,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult / 2);
                    });

                    it("should calculate a stun multiplier with a die minus a pip correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 1,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1);
                    });

                    it("should calculate a stun multiplier with a die correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult);
                    });

                    it("should calculate a multipart stun multiplier with a die and constant correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 1,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult + 1);
                    });

                    it("should calculate a multipart stun multiplier with a die and half die correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 1,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(
                            TestRollMock.fixedRollResult + TestRollMock.fixedRollResult / 2,
                        );
                    });

                    it("should calculate a multipart stun multiplier with a die and die minus 1 correctly for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 0,
                                d6Less1DieCount: 1,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(
                            TestRollMock.fixedRollResult + (TestRollMock.fixedRollResult - 1),
                        );
                    });

                    it("should calculate a stun multiplier with no parts correctly for 6e as a minimum 1", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(1);
                    });

                    it("should calculate a stun multiplier with a const (1) correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 1,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(1);
                    });

                    it("should calculate a stun multiplier with a fixed const correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 66,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(66);
                    });

                    it("should calculate a stun multiplier with a half die correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 1,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult / 2);
                    });

                    it("should calculate a stun multiplier with a die minus a pip correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 0,
                                halfDieCount: 0,
                                d6Less1DieCount: 1,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1);
                    });

                    it("should calculate a stun multiplier with a die correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult);
                    });

                    it("should calculate a multipart stun multiplier with a die and constant correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 0,
                                d6Less1DieCount: 0,
                                constant: 1,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult + 1);
                    });

                    it("should calculate a multipart stun multiplier with a die and half die correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 1,
                                d6Less1DieCount: 0,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(
                            TestRollMock.fixedRollResult + TestRollMock.fixedRollResult / 2,
                        );
                    });

                    it("should calculate a multipart stun multiplier with a die and die minus 1 correctly for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true, {
                                d6Count: 1,
                                halfDieCount: 0,
                                d6Less1DieCount: 1,
                                constant: 0,
                            })
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getStunMultiplier()).to.equal(
                            TestRollMock.fixedRollResult + (TestRollMock.fixedRollResult - 1),
                        );
                    });

                    it("should handle a pip", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([1]);
                        expect(roller.getBodyTotal()).to.equal(1);

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1);

                        expect(roller.getStunTerms()).deep.to.equal([1 * (TestRollMock.fixedRollResult - 1)]);
                        expect(roller.getStunTotal()).deep.to.equal(1 * (TestRollMock.fixedRollResult - 1));
                    });

                    it("should handle a half die", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addHalfDice(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([Math.ceil(TestRollMock.fixedRollResult / 2)]);
                        expect(roller.getBodyTotal()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).deep.to.equal([
                            Math.ceil(TestRollMock.fixedRollResult / 2) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            Math.ceil(TestRollMock.fixedRollResult / 2) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        );
                    });

                    it("should handle a die", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addDice(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([TestRollMock.fixedRollResult]);
                        expect(roller.getBodyTotal()).to.equal(TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1),
                        );
                    });

                    it("should handle a die less a pip", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDiceMinus1(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([TestRollMock.fixedRollResult - 1]);
                        expect(roller.getBodyTotal()).to.equal(TestRollMock.fixedRollResult - 1);

                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).deep.to.equal([
                            (TestRollMock.fixedRollResult - 1) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            (TestRollMock.fixedRollResult - 1) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        );
                    });

                    it("should handle a die plus a pip", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([TestRollMock.fixedRollResult, 1]);
                        expect(roller.getBodyTotal()).to.equal(TestRollMock.fixedRollResult + 1);

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1),
                            1 * (TestRollMock.fixedRollResult - 1),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(roller.getBodyTotal() * roller.getStunMultiplier());
                    });

                    it("should handle multiple dice", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * Math.ceil(TestRollMock.fixedRollResult / 2),
                            TestRollMock.fixedRollResult * Math.ceil(TestRollMock.fixedRollResult / 2),
                            TestRollMock.fixedRollResult * Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * TestRollMock.fixedRollResult * Math.ceil(TestRollMock.fixedRollResult / 2),
                        );
                    });

                    it("should handle multiple dice with increased stun multiplier", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addStunMultiplier(7)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2) + 7);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * (Math.ceil(TestRollMock.fixedRollResult / 2) + 7),
                            TestRollMock.fixedRollResult * (Math.ceil(TestRollMock.fixedRollResult / 2) + 7),
                            TestRollMock.fixedRollResult * (Math.ceil(TestRollMock.fixedRollResult / 2) + 7),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * TestRollMock.fixedRollResult * (Math.ceil(TestRollMock.fixedRollResult / 2) + 7),
                        );
                    });

                    it("should handle multiple dice with decreased stun multiplier", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addStunMultiplier(-1)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(
                            Math.max(1, Math.ceil(TestRollMock.fixedRollResult / 2) - 1),
                        );

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * Math.max(1, Math.ceil(TestRollMock.fixedRollResult / 2) - 1),
                            TestRollMock.fixedRollResult * Math.max(1, Math.ceil(TestRollMock.fixedRollResult / 2) - 1),
                            TestRollMock.fixedRollResult * Math.max(1, Math.ceil(TestRollMock.fixedRollResult / 2) - 1),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 *
                                TestRollMock.fixedRollResult *
                                Math.max(1, Math.ceil(TestRollMock.fixedRollResult / 2) - 1),
                        );
                    });

                    it("should clamp decreased stun multiplier at 2 levels (which means always 1 STUNx) for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addStunMultiplier(-2)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(1);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * 1,
                            TestRollMock.fixedRollResult * 1,
                            TestRollMock.fixedRollResult * 1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * TestRollMock.fixedRollResult * 1);
                    });

                    it("should clamp decreased stun multiplier at 2 levels (which means always 1 STUNx) for 6e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addStunMultiplier(-3)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(1);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * 1,
                            TestRollMock.fixedRollResult * 1,
                            TestRollMock.fixedRollResult * 1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * TestRollMock.fixedRollResult * 1);
                    });

                    it("should support decreased stun multiplier at 1 level for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addStunMultiplier(-1)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(TestRollMock.fixedRollResult - 1 - 1);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1 - 1),
                            TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1 - 1),
                            TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1 - 1),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * TestRollMock.fixedRollResult * (TestRollMock.fixedRollResult - 1 - 1),
                        );
                    });

                    it("should clamp decreased stun multiplier at 4 levels (which means always 1 STUNx) for 5e", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .addStunMultiplier(-5)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.equal(1);

                        expect(roller.getStunTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult * 1,
                            TestRollMock.fixedRollResult * 1,
                            TestRollMock.fixedRollResult * 1,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * TestRollMock.fixedRollResult * 1);
                    });

                    it("should handle a standard effect full roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(true)
                            .makeKillingRoll(true)
                            .modifyToStandardEffect()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL,
                            1,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL + HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL + 1,
                        );

                        // The STUN multiplier is not subject to the standard effect rule!
                        expect(roller.getStunMultiplier()).to.equal(Math.max(1, TestRollMock.fixedRollResult - 1));

                        expect(roller.getStunTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.max(1, TestRollMock.fixedRollResult - 1),
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.max(1, TestRollMock.fixedRollResult - 1),
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.max(1, TestRollMock.fixedRollResult - 1),
                            HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL * Math.max(1, TestRollMock.fixedRollResult - 1),
                            1 * Math.max(1, TestRollMock.fixedRollResult - 1),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.max(1, TestRollMock.fixedRollResult - 1) +
                                HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL *
                                    Math.max(1, TestRollMock.fixedRollResult - 1) +
                                1 * Math.max(1, TestRollMock.fixedRollResult - 1),
                        );
                    });

                    it("should handle a standard effect d6 - 1 roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .modifyToStandardEffect()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL,
                            1,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL + 1 * HeroRoller.STANDARD_EFFECT_DIE_ROLL + 1,
                        );

                        // The STUN multiplier is not subject to the standard effect rule!
                        expect(roller.getStunMultiplier()).to.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).deep.to.equal([
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.ceil(TestRollMock.fixedRollResult / 2),
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.ceil(TestRollMock.fixedRollResult / 2),
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.ceil(TestRollMock.fixedRollResult / 2),
                            HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.ceil(TestRollMock.fixedRollResult / 2),
                            1 * Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.ceil(TestRollMock.fixedRollResult / 2) +
                                1 * HeroRoller.STANDARD_EFFECT_DIE_ROLL * Math.ceil(TestRollMock.fixedRollResult / 2) +
                                1 * Math.ceil(TestRollMock.fixedRollResult / 2),
                        );
                    });

                    it("should use hit location and not stun multiplier with killing attacks", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addToHitLocation(1)
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(function () {
                            return roller.getStunMultiplier();
                        }).to.throw();

                        expect(roller.getStunTerms()).deep.to.equal([
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * 1 * TestRollMock.fixedRollResult);

                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should use hit location with increased stun multiplier with killing attacks", async function () {
                        const TestRollMock = Roll6Mock;
                        const increasedStunMultiplier = 7;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addStunMultiplier(increasedStunMultiplier)
                            .addToHitLocation()
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(function () {
                            return roller.getStunMultiplier();
                        }).to.throw();

                        expect(roller.getStunTerms()).deep.to.equal([
                            (1 + increasedStunMultiplier) * TestRollMock.fixedRollResult,
                            (1 + increasedStunMultiplier) * TestRollMock.fixedRollResult,
                            (1 + increasedStunMultiplier) * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(
                            3 * (1 + increasedStunMultiplier) * TestRollMock.fixedRollResult,
                        );
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 8,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should use hit location with decreased stun multiplier (floor 1) with killing attacks", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addStunMultiplier(-1)
                            .addToHitLocation()
                            .addDice(3);

                        await roller.roll();

                        expect(roller.getBodyTerms()).deep.to.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.equal(3 * TestRollMock.fixedRollResult);

                        expect(function () {
                            return roller.getStunMultiplier();
                        }).to.throw();

                        expect(roller.getStunTerms()).deep.to.equal([
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).deep.to.equal(3 * 1 * TestRollMock.fixedRollResult);
                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should handle hit locations (roll 6) with killing attacks", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addToHitLocation()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Foot",
                            side: "none",
                            fullName: "Foot",
                            stunMultiplier: 1,
                            bodyMultiplier: 0.5,
                        });
                    });

                    it("should handle hit locations (roll 1) with killing attacks", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addToHitLocation()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        const hitLocation = roller.getHitLocation();
                        expect(hitLocation).to.deep.equal({
                            name: "Head",
                            side: "none",
                            fullName: "Head",
                            stunMultiplier: 5,
                            bodyMultiplier: 2,
                        });
                    });

                    it("should work with damage reduction that does not remove all DC by whole dice", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(3);

                        await roller.roll();

                        // Remove 3 DC/1 die
                        roller.removeNDC(3);

                        expect(roller.getBodyTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.deep.equal(1);

                        expect(roller.getStunTerms()).to.deep.equal([
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getFormula()).to.equal("2d6");
                    });

                    it("should work with damage reduction that removes 2 DC (1/2d6) when it exists", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(2).addHalfDice(1);

                        await roller.roll();

                        // Remove 2 DC/ a 1/2 d6
                        roller.removeNDC(2);

                        expect(roller.getBodyTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.deep.equal(1);

                        expect(roller.getStunTerms()).to.deep.equal([
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getFormula()).to.equal("2d6");
                    });

                    it("should work with damage reduction that removes 2 DC (1d6-1) when it exists", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addDice(2)
                            .addDiceMinus1(1);

                        await roller.roll();

                        // Remove 2 DC/ a 1d6-1 term
                        roller.removeNDC(2);

                        expect(roller.getBodyTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.deep.equal(1);

                        expect(roller.getStunTerms()).to.deep.equal([
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getFormula()).to.equal("2d6");
                    });

                    it("should work with damage reduction that removes 1 DC (+1) when it exists", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(2).addNumber(1);

                        await roller.roll();

                        // Remove 1 DC/ a +1 pip term
                        roller.removeNDC(1);

                        expect(roller.getBodyTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getBodyTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getStunMultiplier()).to.deep.equal(1);

                        expect(roller.getStunTerms()).to.deep.equal([
                            1 * TestRollMock.fixedRollResult,
                            1 * TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getStunTotal()).to.deep.equal(2 * TestRollMock.fixedRollResult);

                        expect(roller.getFormula()).to.equal("2d6");
                    });

                    it("should work with damage reduction that removes 1 DC when it doesn't exist as a unique term (1)", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(1);

                        await roller.roll();

                        // Remove 1 DC to a 1/2 die term
                        roller.removeNDC(1);

                        expect(roller.getBodyTerms()).to.deep.equal([Math.ceil(TestRollMock.fixedRollResult / 2)]);
                        expect(roller.getBodyTotal()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunMultiplier()).to.deep.equal(1);

                        expect(roller.getStunTerms()).to.deep.equal([1 * Math.ceil(TestRollMock.fixedRollResult / 2)]);
                        expect(roller.getStunTotal()).to.deep.equal(1 * Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getFormula()).to.equal("½d6");
                    });

                    it("should work with damage reduction that removes 1 DC when it doesn't exist as a unique term (6)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(1);

                        await roller.roll();

                        // Remove 1 DC to a 1/2 die term
                        roller.removeNDC(1);

                        expect(roller.getBodyTerms()).to.deep.equal([Math.ceil(TestRollMock.fixedRollResult / 2)]);
                        expect(roller.getBodyTotal()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunMultiplier()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).to.deep.equal([
                            Math.ceil(TestRollMock.fixedRollResult / 2) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).to.deep.equal(
                            Math.ceil(TestRollMock.fixedRollResult / 2) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        );

                        expect(roller.getFormula()).to.equal("½d6");
                    });

                    it("should work with damage reduction that removes 2 DC when it doesn't exist as a unique term (1", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(1);

                        await roller.roll();

                        // Remove 2 DC to a +1 pip term
                        roller.removeNDC(2);

                        expect(roller.getBodyTerms()).to.deep.equal([1]);
                        expect(roller.getBodyTotal()).to.deep.equal(1);

                        expect(roller.getStunMultiplier()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).to.deep.equal([Math.ceil(TestRollMock.fixedRollResult / 2) * 1]);
                        expect(roller.getStunTotal()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2) * 1);

                        expect(roller.getFormula()).to.equal("1");
                    });

                    it("should work with damage reduction that removes 2 DC when it doesn't exist as a unique term (6)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(1);

                        await roller.roll();

                        // Remove 2 DC to a +1 pip term
                        roller.removeNDC(2);

                        expect(roller.getBodyTerms()).to.deep.equal([1]);
                        expect(roller.getBodyTotal()).to.deep.equal(1);

                        expect(roller.getStunMultiplier()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).to.deep.equal([Math.ceil(TestRollMock.fixedRollResult / 2) * 1]);
                        expect(roller.getStunTotal()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2) * 1);

                        expect(roller.getFormula()).to.equal("1");
                    });

                    it("should work with damage reduction that removes 4 DC when it doesn't exist as a unique term (6)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeKillingRoll(true).addDice(3);

                        await roller.roll();

                        // Remove 4 DC to a 1 1/2 d6
                        roller.removeNDC(4);

                        expect(roller.getBodyTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getBodyTotal()).to.deep.equal(
                            TestRollMock.fixedRollResult + Math.ceil(TestRollMock.fixedRollResult / 2),
                        );

                        expect(roller.getStunMultiplier()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).to.deep.equal([
                            Math.ceil(TestRollMock.fixedRollResult / 2) * TestRollMock.fixedRollResult,
                            Math.ceil(TestRollMock.fixedRollResult / 2) * Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getStunTotal()).to.deep.equal(
                            Math.ceil(TestRollMock.fixedRollResult / 2) * TestRollMock.fixedRollResult +
                                Math.ceil(TestRollMock.fixedRollResult / 2) *
                                    Math.ceil(TestRollMock.fixedRollResult / 2),
                        );

                        expect(roller.getFormula()).to.equal("1d6 + ½d6");
                    });

                    it("should work with damage reduction that removes 4 DC when it doesn't that many DC", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeKillingRoll(true)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        // Remove 4 DC from a 3 DC should be empty
                        roller.removeNDC(4);

                        expect(roller.getBodyTerms()).to.deep.equal([]);
                        expect(roller.getBodyTotal()).to.deep.equal(0);

                        expect(roller.getStunMultiplier()).to.deep.equal(Math.ceil(TestRollMock.fixedRollResult / 2));

                        expect(roller.getStunTerms()).to.deep.equal([]);
                        expect(roller.getStunTotal()).to.deep.equal(0);

                        expect(roller.getFormula()).to.equal("");
                    });
                });

                describe("Adjustment roll", function () {
                    it("should throw if asking for inappropriate interpretations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeAdjustmentRoll()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should return the rolled active points for a lowest roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeAdjustmentRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getAdjustmentTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getAdjustmentTotal()).to.equal(3 * TestRollMock.fixedRollResult);
                    });

                    it("should return the rolled active points for a highest roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeAdjustmentRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getAdjustmentTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                        ]);
                        expect(roller.getAdjustmentTotal()).to.equal(3 * TestRollMock.fixedRollResult);
                    });

                    it("should return the rolled active points for a multi term roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeAdjustmentRoll().addDice(3).addHalfDice(1);

                        await roller.roll();

                        expect(roller.getAdjustmentTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            Math.ceil(TestRollMock.fixedRollResult / 2),
                        ]);
                        expect(roller.getAdjustmentTotal()).to.equal(
                            3 * TestRollMock.fixedRollResult + 1 * Math.ceil(TestRollMock.fixedRollResult / 2),
                        );
                    });

                    it("should return the rolled active points for a multi term roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeAdjustmentRoll().addDice(3).addNumber(1);

                        await roller.roll();

                        expect(roller.getAdjustmentTerms()).to.deep.equal([
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            TestRollMock.fixedRollResult,
                            1,
                        ]);
                        expect(roller.getAdjustmentTotal()).to.equal(3 * TestRollMock.fixedRollResult + 1 * 1);
                    });

                    it("should return the rolled active points for a negative term roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeAdjustmentRoll().addDice(-3).addNumber(1);

                        await roller.roll();

                        expect(roller.getAdjustmentTerms()).to.deep.equal([
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                            -TestRollMock.fixedRollResult,
                            1,
                        ]);
                        expect(roller.getAdjustmentTotal()).to.equal(-3 * TestRollMock.fixedRollResult + 1 * 1);
                    });
                });

                describe("Flash roll", function () {
                    it("should throw if asking for inappropriate interpretations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeFlashRoll()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should return the rolled active points for a lowest roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeFlashRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([0, 0, 0]);
                        expect(roller.getFlashTotal()).to.equal(3 * 0);
                    });

                    it("should return the rolled active points for a highest roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeFlashRoll().addDice(3);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([2, 2, 2]);
                        expect(roller.getFlashTotal()).to.equal(3 * 2);
                    });

                    it("should return the rolled active points for a negative term roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeFlashRoll()
                            .addDice(-3)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([-2, -2, -2, 1, 0]);
                        expect(roller.getFlashTotal()).to.equal(-3 * 2 + 1 * 1 + 1 * 0);
                    });

                    it("should return the rolled active points for a multi term roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeFlashRoll().addDice(3).addHalfDice(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([0, 0, 0, 0]);
                        expect(roller.getFlashTotal()).to.equal(3 * 0 + 1 * 0);
                    });

                    it("should return the rolled active points for a multi term roll", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeFlashRoll().addDice(3).addNumber(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([0, 0, 0, 0]);
                        expect(roller.getFlashTotal()).to.equal(3 * 0 + 1 * 0);
                    });

                    it("should return the rolled active points for a multi term roll", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeFlashRoll()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([2, 2, 2, 1, 0]);
                        expect(roller.getFlashTotal()).to.equal(3 * 2 + 1 * 1 + 1 * 0);
                    });

                    it("should correctly handle half dice for 5e with a 6", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeFlashRoll().addHalfDice(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([1]);
                        expect(roller.getFlashTotal()).to.equal(1);
                    });

                    it("should correctly handle half dice for 5e with a 5", async function () {
                        const TestRollMock = Roll5Mock;

                        const roller = new HeroRoller({}, TestRollMock).modifyTo5e(true).makeFlashRoll().addHalfDice(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([0]);
                        expect(roller.getFlashTotal()).to.equal(0);
                    });

                    it("should correctly handle half dice for 6e with a 5", async function () {
                        const TestRollMock = Roll5Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .modifyTo5e(false)
                            .makeFlashRoll()
                            .addHalfDice(1);

                        await roller.roll();

                        expect(roller.getFlashTerms()).to.deep.equal([1]);
                        expect(roller.getFlashTotal()).to.equal(1);
                    });
                });

                describe("Entangle roll", async function () {
                    it("should throw if asking for inappropriate interpretations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEntangleRoll()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should support body calculations for a roll of 1", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEntangleRoll()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getEntangleTerms()).to.deep.equal([0, 0, 0, 0, 1]);
                        expect(roller.getEntangleTotal()).to.equal(1);
                    });

                    it("should support body calculations for a roll of 3", async function () {
                        const TestRollMock = Roll3Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEntangleRoll()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(roller.getEntangleTerms()).to.deep.equal([1, 1, 1, 0, 1]);
                        expect(roller.getEntangleTotal()).to.equal(4);
                    });

                    it("should support body calculations for a roll of 6", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEntangleRoll()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(3);

                        await roller.roll();

                        expect(roller.getEntangleTerms()).to.deep.equal([2, 2, 2, 1, 3]);
                        expect(roller.getEntangleTotal()).to.equal(10);
                    });

                    it("should support body calculations for a roll of negative 6", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEntangleRoll()
                            .addDice(-3)
                            .addHalfDice(1)
                            .addNumber(3);

                        await roller.roll();

                        expect(roller.getEntangleTerms()).to.deep.equal([-2, -2, -2, 1, 3]);
                        expect(roller.getEntangleTotal()).to.equal(-2);
                    });
                });

                describe("Effect roll", async function () {
                    it("should throw if asking for inappropriate interpretations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEffectRoll()
                            .addDice(3)
                            .addDiceMinus1(1)
                            .addNumber(1);

                        await roller.roll();

                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                    });

                    it("should support calculations for a roll of 1", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEffectRoll()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(3);

                        await roller.roll();

                        expect(roller.getEffectTerms()).to.deep.equal([1, 1, 1, 1, 3]);
                        expect(roller.getEffectTotal()).to.equal(7);
                    });

                    it("should support calculations for a roll of 6", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEffectRoll()
                            .addDice(3)
                            .addHalfDice(1)
                            .addNumber(3);

                        await roller.roll();

                        expect(roller.getEffectTerms()).to.deep.equal([6, 6, 6, 3, 3]);
                        expect(roller.getEffectTotal()).to.equal(24);
                    });
                });

                describe("Luck roll", async function () {
                    it("should throw if asking for inappropriate interpretations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeLuckRoll().addDice(3);

                        // Should not be able to use any other term types other than addDice for a Luck roll.
                        expect(function addDiceMinus1_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addDiceMinus1(0);
                        }).to.not.throw();
                        expect(function addDiceMinus1() {
                            const tempRoller = roller.clone();
                            tempRoller.addDiceMinus1(1);
                        }).to.throw();

                        expect(function addDieMinus1Min1_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addDieMinus1Min1(0);
                        }).to.not.throw();
                        expect(function addDieMinus1Min1() {
                            const tempRoller = roller.clone();
                            tempRoller.addDieMinus1Min1(1);
                        }).to.throw();

                        expect(function addHalfDice_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addHalfDice(0);
                        }).to.not.throw();
                        expect(function addHalfDice() {
                            const tempRoller = roller.clone();
                            tempRoller.addHalfDice(1);
                        }).to.throw();

                        expect(function addNumber_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addNumber(0);
                        }).to.not.throw();
                        expect(function addNumber() {
                            const tempRoller = roller.clone();
                            tempRoller.addNumber(1);
                        }).to.throw();

                        // Luck dice don't use STUN multipliers
                        expect(function addStunMultiplier_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(0);
                        }).to.not.throw();
                        expect(function addStunMultiplier() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(1);
                        }).to.throw();

                        // No hit locations for luck dice
                        expect(function addToHitLocation_false() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(false);
                        }).to.not.throw();
                        expect(function addToHitLocation() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(true);
                        }).to.throw();

                        // Luck dice don't do BODY
                        expect(function modifyToDoBody_false() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(false);
                        }).to.not.throw();
                        expect(function modifyToDoBody() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(true);
                        }).to.throw();

                        // It makes no sense to have a standard effect for luck dice
                        expect(function modifyToStandardEffect_false() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToStandardEffect(false);
                        }).to.not.throw();
                        expect(function modifyToStandardEffect() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToStandardEffect(true);
                        }).to.throw();

                        await roller.roll();

                        // Should only be able to get luck terms
                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should support calculations for dice that roll 1-5 (count as 0)", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeLuckRoll().addDice(3);

                        await roller.roll();

                        // Dice rolling 6 count as 1 for luck, numbers <=5 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([0, 0, 0]);
                        expect(roller.getLuckTotal()).to.equal(0);
                    });

                    it("should support calculations for dice that roll 6 (count as 1)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeLuckRoll().addDice(3);

                        await roller.roll();

                        // Dice rolling 6 count as 1 for luck, numbers <=5 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([1, 1, 1]);
                        expect(roller.getLuckTotal()).to.equal(3);
                    });

                    it("should support calculations for that roll 5 (count as 0)", async function () {
                        const TestRollMock = Roll5Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeLuckRoll().addDice(3);

                        await roller.roll();

                        // Dice rolling 6 count as 1 for luck, numbers <=5 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([0, 0, 0]);
                        expect(roller.getLuckTotal()).to.equal(0);
                    });

                    it("should support calculations with alternating dice rolls", async function () {
                        const TestRollMock = RollAlternatingLuckAndUnluck;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).makeLuckRoll().addDice(5);

                        await roller.roll();

                        // Dice rolling 6 count as 1 for luck, numbers <=5 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([1, 0, 1, 0, 1]);
                        expect(roller.getLuckTotal()).to.equal(3);
                    });

                    it("should support calculations with ramping dice rolls", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).makeLuckRoll().addDice(14);

                        await roller.roll();

                        // Dice rolling 6 count as 1 for luck, numbers <=5 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0]);
                        expect(roller.getLuckTotal()).to.equal(2);
                    });
                });

                describe("Unluck roll", async function () {
                    it("should throw if asking for inappropriate interpretations", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeUnluckRoll().addDice(3);

                        // Should not be able to use any other term types other than addDice for an unluck roll.
                        expect(function addDiceMinus1_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addDiceMinus1(0);
                        }).to.not.throw();
                        expect(function addDiceMinus1() {
                            const tempRoller = roller.clone();
                            tempRoller.addDiceMinus1(1);
                        }).to.throw();

                        expect(function addDieMinus1Min1_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addDieMinus1Min1(0);
                        }).to.not.throw();
                        expect(function addDieMinus1Min1() {
                            const tempRoller = roller.clone();
                            tempRoller.addDieMinus1Min1(1);
                        }).to.throw();

                        expect(function addHalfDice_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addHalfDice(0);
                        }).to.not.throw();
                        expect(function addHalfDice() {
                            const tempRoller = roller.clone();
                            tempRoller.addHalfDice(1);
                        }).to.throw();

                        expect(function addNumber_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addNumber(0);
                        }).to.not.throw();
                        expect(function addNumber() {
                            const tempRoller = roller.clone();
                            tempRoller.addNumber(1);
                        }).to.throw();

                        // Unluck dice don't use STUN multipliers
                        expect(function addStunMultiplier_0() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(0);
                        }).to.not.throw();
                        expect(function addStunMultiplier() {
                            const tempRoller = roller.clone();
                            tempRoller.addStunMultiplier(1);
                        }).to.throw();

                        // No hit locations for unluck dice
                        expect(function addToHitLocation_false() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(false);
                        }).to.not.throw();
                        expect(function addToHitLocation() {
                            const tempRoller = roller.clone();
                            tempRoller.addToHitLocation(true);
                        }).to.throw();

                        // Unluck dice don't do BODY
                        expect(function modifyToDoBody_false() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(false);
                        }).to.not.throw();
                        expect(function modifyToDoBody() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToDoBody(true);
                        }).to.throw();

                        // It makes no sense to have a standard effect for unluck dice
                        expect(function modifyToStandardEffect_false() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToStandardEffect(false);
                        }).to.not.throw();
                        expect(function modifyToStandardEffect() {
                            const tempRoller = roller.clone();
                            tempRoller.modifyToStandardEffect(true);
                        }).to.throw();

                        await roller.roll();

                        // Should only be able to get unluck terms
                        expect(function () {
                            return roller.getSuccessTerms();
                        }).to.throw();
                        expect(function () {
                            return roller.getSuccessTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getBodyTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getStunTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplier();
                        }).to.throw();
                        expect(function () {
                            roller.getStunMultiplierDiceParts();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getAdjustmentTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEntangleTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getFlashTotal();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTerms();
                        }).to.throw();
                        expect(function () {
                            roller.getEffectTotal();
                        }).to.throw();
                    });

                    it("should support calculations for dice that roll 1 (count as 1)", async function () {
                        const TestRollMock = Roll1Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeUnluckRoll().addDice(3);

                        await roller.roll();

                        // Dice rolling 1 count as 1 for unluck, numbers > 1 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([1, 1, 1]);
                        expect(roller.getLuckTotal()).to.equal(3);
                    });

                    it("should support calculations for dice that roll 6 (count as 0)", async function () {
                        const TestRollMock = Roll6Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeUnluckRoll().addDice(3);

                        await roller.roll();

                        // Dice rolling 1 count as 1 for unluck, numbers > 1 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([0, 0, 0]);
                        expect(roller.getLuckTotal()).to.equal(0);
                    });

                    it("should support calculations for that roll 5 (count as 0)", async function () {
                        const TestRollMock = Roll5Mock;

                        const roller = new HeroRoller({}, TestRollMock).makeUnluckRoll().addDice(3);

                        await roller.roll();

                        // Dice rolling 1 count as 1 for unluck, numbers > 1 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([0, 0, 0]);
                        expect(roller.getLuckTotal()).to.equal(0);
                    });

                    it("should support calculations with alternating dice rolls", async function () {
                        const TestRollMock = RollAlternatingLuckAndUnluck;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).makeUnluckRoll().addDice(5);

                        await roller.roll();

                        // Dice rolling 1 count as 1 for unluck, numbers > 1 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([0, 1, 0, 1, 0]);
                        expect(roller.getLuckTotal()).to.equal(2);
                    });

                    it("should support calculations with ramping dice rolls", async function () {
                        const TestRollMock = Roll1Through6Mock;
                        TestRollMock.generatorInfo.reset();

                        const roller = new HeroRoller({}, TestRollMock).makeUnluckRoll().addDice(14);

                        await roller.roll();

                        // Dice rolling 1 count as 1 for unluck, numbers > 1 count as 0
                        expect(roller.getLuckTerms()).to.deep.equal([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
                        expect(roller.getLuckTotal()).to.equal(3);
                    });
                });

                describe("Flavors", async function () {
                    function turnRollToTrueFalsePromise(roller) {
                        // eslint-disable-next-line no-async-promise-executor
                        return new Promise(async (resolve, reject) => {
                            try {
                                await roller.roll();
                                resolve(true);
                            } catch {
                                reject(false);
                            }
                        });
                    }

                    it("should support providing a valid flavor string", async function () {
                        const TestRollMock = Roll6Mock;
                        const flavorStringToBeSanitized = "this is a FoundryVTT flavor string without square brackets";

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEffectRoll()
                            .addDice(1, flavorStringToBeSanitized)
                            .addHalfDice(1, flavorStringToBeSanitized)
                            .addDiceMinus1(1, flavorStringToBeSanitized)
                            .addDieMinus1Min1(1, flavorStringToBeSanitized)
                            .addNumber(3, flavorStringToBeSanitized);

                        expect(await turnRollToTrueFalsePromise(roller)).to.be.true;
                    });

                    // For the FoundryVTT roller in the message tab, the "[" and "]" provide flavor
                    it("should support providing a flavor string with '[' characters", async function () {
                        const TestRollMock = Roll6Mock;
                        const flavorStringToBeSanitized =
                            "this is a FoundryVTT flavor string with [square brackets which are themselves flavour text]";

                        const roller = new HeroRoller({}, TestRollMock)
                            .makeEffectRoll()
                            .addDice(1, flavorStringToBeSanitized)
                            .addHalfDice(1, flavorStringToBeSanitized)
                            .addDiceMinus1(1, flavorStringToBeSanitized)
                            .addDieMinus1Min1(1, flavorStringToBeSanitized)
                            .addNumber(3, flavorStringToBeSanitized);

                        expect(await turnRollToTrueFalsePromise(roller)).to.be.true;
                    });
                });
            });
        },
        { displayName: "HERO: Dice" },
    );
}
