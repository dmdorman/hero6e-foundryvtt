const { Actor, Item } = foundry.documents;

export function registerTypeForceReplaceTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.typeForceReplace`,
        (context) => {
            const { describe, it, before, after, assert } = context;

            // ==========================================
            // ACTOR TYPE TESTS
            // ==========================================
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
                        if (quenchActor) await quenchActor.delete();
                    });

                    it("Custom system _changeType", async function () {
                        for (const targetType of targetTypes) {
                            await quenchActor._changeType(targetType);
                            assert.equal(quenchActor.type, targetType);
                        }
                    });

                    // Shared DataModels break _replace. TODO: refactor DataModel
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
                                {
                                    type: targetType,
                                    // 2. Use the valid system data structure
                                    system: _replace(currentSystemData),
                                },
                                {
                                    forceReplace: true,
                                },
                            );
                            assert.equal(quenchActor.type, targetType);
                        }
                    });
                },
                { displayName: "HERO: Actor Type Tests" },
            );

            // ==========================================
            // ITEM TYPE TESTS
            // ==========================================
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
                    if (quenchItem) await quenchItem.delete();
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

                // Shared DataModels break _replace. TODO: refactor DataModel
                it("Native V14 forceReplace", async function () {
                    for (const targetType of itemTypes) {
                        const currentSystemData = quenchItem.system.toObject();

                        await quenchItem.update(
                            {
                                type: targetType,
                                system: _replace(currentSystemData),
                            },
                            {
                                forceReplace: true,
                            },
                        );

                        assert.equal(quenchItem.type, targetType);
                        assert.equal(quenchItem.system.XMLID, "UNTRAINED");
                    }
                });
            });
        },
        { displayName: "HERO: Updates with type ForceReplace" },
    );
}
