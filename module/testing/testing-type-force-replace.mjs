import { forceReplaceFields } from "../utility/util.mjs";
import { createCharacteristicAssertions } from "./characteristic-assertions.mjs";
import { setQuenchTimeout } from "./quench-helper.mjs";

const { Actor, Item } = foundry.documents;

export function registerUpdatesWithTypeForceReplaceTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.typeForceReplace`,
        (context) => {
            const { describe, it, before, after, assert } = context;
            const characteristicAssertions = createCharacteristicAssertions(assert);

            describe("Actor/Item Type Change", function () {
                // Mocha's 2000ms default is too short when several actors are created at the same time.
                setQuenchTimeout(this, 20000);

                describe(
                    "Actor Type Mutation Matrix",
                    function () {
                        let quenchActor = null;
                        const targetTypes = Actor.TYPES.filter((t) => t !== "base");

                        before(async function () {
                            quenchActor = await Actor.create({
                                name: "_Quench_Attacker",
                                type: "pc",
                                img: "icons/svg/sword.svg",
                            });
                        });

                        after(async function () {
                            if (quenchActor) {
                                await quenchActor.delete();
                            }
                        });

                        it("Custom system _changeType", async function () {
                            for (const targetType of targetTypes) {
                                await quenchActor._changeType(targetType);
                                assert.equal(quenchActor.type, targetType);
                            }
                        });

                        // Shared DataModels break force-replacement. TODO: refactor DataModel
                        // Actor type changes reject the ForcedReplacement operator on V14 with
                        // "The type of a Document may only be changed if the system field is also
                        // updated with a ForcedReplacement operator." even when one is supplied.
                        // Known Foundry issue (https://github.com/foundryvtt/foundryvtt/issues/13090;
                        // see the note in actor.mjs uploadFromXml). Items work; actors are covered by
                        // the Custom system _changeType test above until the core bug is fixed.
                        it.skip("Native V14 forceReplace (Skipped: foundryvtt#13090)", async function () {
                            for (const targetType of targetTypes) {
                                // 1. Fetch current system data structure
                                const currentSystemData = quenchActor.system?.toObject() || {};

                                await quenchActor.update(
                                    forceReplaceFields({ system: currentSystemData }, { type: targetType }),
                                );
                                assert.equal(quenchActor.type, targetType);
                            }
                        });
                    },
                    { displayName: "HERO: Actor Type Tests" },
                );

                describe("STR penalty follows an actor type change", function () {
                    // A type with no STR lifts nothing, so 5.0.4 gives it no encumbrance and no STR 0 penalty.
                    // `_preUpdate` judges that penalty against the type held before the write, so `_changeType`
                    // drops the penalties the old type earned, then runs one pass for the new type. A pc at
                    // STR 0 carries a penalty to lose, so the fixture starts there.

                    let quenchActor = null;

                    before(async function () {
                        quenchActor = await Actor.create({
                            name: "_Quench_StrPenalty",
                            type: "pc",
                            img: "icons/svg/sword.svg",
                        });
                        await characteristicAssertions.updateCharacteristicPropertiesOnActor(quenchActor, "STR", {
                            value: 0,
                        });
                    });

                    after(async function () {
                        if (quenchActor) {
                            await quenchActor.delete();
                        }
                    });

                    it("pc at STR 0 holds the STR 0 penalty", function () {
                        characteristicAssertions.assertHasStrPenaltyEffect(quenchActor);
                    });

                    it("pc at STR 0 answers DCV 2", function () {
                        characteristicAssertions.assertCharacteristicProperty(quenchActor, "DCV", "value", 2);
                    });

                    describe("After the pc becomes a computer", function () {
                        before(async function () {
                            await quenchActor._changeType("computer");
                        });

                        it("has no STR characteristic", function () {
                            characteristicAssertions.assertDoesNotHaveCharacteristic(quenchActor, "STR");
                        });

                        it("drops the STR 0 penalty the pc earned", function () {
                            characteristicAssertions.assertDoesNotHaveStrPenaltyEffect(quenchActor);
                        });

                        it("answers DCV 3", function () {
                            characteristicAssertions.assertCharacteristicProperty(quenchActor, "DCV", "value", 3);
                        });
                    });

                    describe("After that computer becomes a pc again", function () {
                        before(async function () {
                            await quenchActor._changeType("pc");
                        });

                        it("has the STR characteristic", function () {
                            characteristicAssertions.assertHasCharacteristic(quenchActor, "STR");
                        });

                        it("builds the STR 0 penalty the new type earns", function () {
                            characteristicAssertions.assertHasStrPenaltyEffect(quenchActor);
                        });

                        it("answers DCV 2", function () {
                            characteristicAssertions.assertCharacteristicProperty(quenchActor, "DCV", "value", 2);
                        });
                    });
                });

                describe("Item Type Mutation Matrix", function () {
                    let quenchItem = null;
                    // Filter out 'base' and the deprecated 'complication' type
                    const itemTypes = Item.TYPES.filter((t) => t !== "base" && t !== "complication");

                    before(async function () {
                        const initialType = itemTypes[0] || "equipment";
                        quenchItem = await Item.create({
                            name: "_Quench_Test_Item",
                            type: initialType,
                            img: "icons/svg/item-bag.svg",
                            system: {
                                XMLID: "UNTRAINED",
                            },
                        });
                    });

                    after(async function () {
                        if (quenchItem) {
                            await quenchItem.delete();
                        }
                    });

                    it("Custom generic update pipeline", async function () {
                        for (const targetType of itemTypes) {
                            const currentSystemData = quenchItem.system.toObject();

                            await quenchItem.update(
                                {
                                    type: targetType,
                                    system: foundry.utils.mergeObject(currentSystemData, { _type: targetType }),
                                },
                                { recursive: false },
                            );

                            assert.equal(quenchItem.type, targetType);
                            assert.equal(quenchItem.system.XMLID, "UNTRAINED");
                        }
                    });

                    // Shared DataModels break force-replacement. TODO: refactor DataModel
                    it("Native V14 forceReplace", async function () {
                        for (const targetType of itemTypes) {
                            const currentSystemData = quenchItem.system.toObject();

                            await quenchItem.update(
                                forceReplaceFields({ system: currentSystemData }, { type: targetType }),
                            );

                            assert.equal(quenchItem.type, targetType);
                            assert.equal(quenchItem.system.XMLID, "UNTRAINED");
                        }
                    });
                });
            });
        },
        { displayName: "HERO: Updates with type ForceReplace" },
    );
}
