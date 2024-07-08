import { HeroSystem6eActor } from "../actor/actor.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getDiceFormulaFromItemDC, convertToDcFromItem } from "../utility/damage.mjs";

export function registerDamageFunctionTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.damageFunctions",
        (context) => {
            const { assert, describe, it } = context;

            const actor = new HeroSystem6eActor({
                name: "Test Actor",
                type: "pc",
            });

            describe("getDiceFormulaFromItemDC", function () {
                describe("invalid inputs", function () {
                    const item = new HeroSystem6eItem({
                        name: "Test",
                        type: "attack",
                        system: {
                            killing: true,
                        },
                        parent: actor,
                    });

                    it('""', function () {
                        assert.equal(getDiceFormulaFromItemDC(item, 0), "");
                    });
                });

                describe("killing attacks", function () {
                    const killingItem = new HeroSystem6eItem({
                        name: "Test",
                        type: "attack",
                        system: {
                            killing: true,
                        },
                        parent: actor,
                    });

                    it("1", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 1), "1");
                    });

                    it("2", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 2), "½d6");
                    });

                    it("3", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 3), "1d6");
                    });

                    it("4", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 4), "1d6+1");
                    });

                    it("5", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 5), "1½d6");
                    });

                    it("6", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 6), "2d6");
                    });

                    it("7", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 7), "2d6+1");
                    });
                });

                describe("killing attacks with 1d6-1 rather than 1/2d6", function () {
                    const killingItem = new HeroSystem6eItem({
                        name: "Test",
                        type: "attack",
                        system: {
                            killing: true,
                            extraDice: "one-pip",
                        },
                        parent: actor,
                    });

                    it("1", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 1), "1");
                    });

                    it("2", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 2), "1d6-1");
                    });

                    it("3", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 3), "1d6");
                    });

                    it("4", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 4), "1d6+1");
                    });

                    it("5", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 5), "2d6-1");
                    });

                    it("6", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 6), "2d6");
                    });

                    it("7", function () {
                        assert.equal(getDiceFormulaFromItemDC(killingItem, 7), "2d6+1");
                    });
                });

                describe("Non killing attacks", function () {
                    const nonKillingItem = new HeroSystem6eItem({
                        name: "Test",
                        type: "attack",
                        parent: actor,
                    });

                    it("0", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 0), "");
                    });

                    it("1", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 1), "1d6");
                    });

                    it("1.2", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 1.2), "1d6+1");
                    });

                    it("1.5", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 1.5), "1½d6");
                    });

                    it("13.2", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 13.2), "13d6+1");
                    });

                    it("20", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 20), "20d6");
                    });

                    it("1234567890.2", function () {
                        assert.equal(getDiceFormulaFromItemDC(nonKillingItem, 1234567890.2), "1234567890d6+1");
                    });
                });
            });

            describe("convertToDcFromItem", function () {
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

                it("Killing dc", function () {
                    assert.equal(convertToDcFromItem(item).dc, 4);
                });

                it("normal", function () {
                    assert.equal(convertToDcFromItem(item_nk).dc, 1.2);
                });
            });
        },
        { displayName: "HERO: Damage Functions" },
    );
}
