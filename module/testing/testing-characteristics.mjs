import { setQuenchTimeout } from "./quench-helper.mjs";

const { Actor } = foundry.documents;

export function registerDefaultCharacteristicsForEachActorTypeTests(quench) {
    const createdActors = [];

    const cleanup = async () => {
        if (createdActors.length > 0) {
            await Actor.deleteDocuments(createdActors.map((a) => a.id));
            createdActors.length = 0;
        }
    };

    quench.registerBatch(
        `${game.system.id}.actor.characteristics`,
        (context) => {
            const { describe, it, assert, after } = context;

            describe("Default characteristics for each actor type", function () {
                setQuenchTimeout(this, 20000);

                describe("Verify Living Actor Exhaustive Baselines (6e vs 5e)", () => {
                    after(cleanup);

                    const livingTypes = Actor.TYPES.filter((t) => ["pc", "npc"].includes(t));

                    for (const type of livingTypes) {
                        for (const is5e of [false, true]) {
                            it(`Validate type ${type} [5e=${is5e}] features precisely`, async () => {
                                const actor = await Actor.create({
                                    name: `Test-${type}-5e-${is5e}`,
                                    type: type,
                                    system: { is5e: is5e },
                                });
                                createdActors.push(actor);

                                const getVal = (c) =>
                                    actor.system.characteristics?.[c]?.value ?? actor.system.characteristics?.[c]?.max;

                                // Universal Primary Characteristics & Combat Values
                                const primaries = [
                                    "str",
                                    "dex",
                                    "con",
                                    "int",
                                    "ego",
                                    "pre",
                                    "body",
                                    "spd",
                                    "pd",
                                    "ed",
                                    "rec",
                                    "stun",
                                    "end",
                                ];
                                const cvs = ["ocv", "dcv", "omcv", "dmcv"];

                                for (const c of [...primaries, ...cvs]) {
                                    assert.ok(
                                        actor.hasCharacteristic(c),
                                        `Type [${type}] expects [${c.toUpperCase()}] node`,
                                    );
                                }

                                // Explicit Movement Array Checks (6e Meters vs 5e Inches/Hexes)
                                assert.ok(actor.hasCharacteristic("RUNNING"), `Type [${type}] expects [RUNNING] node`);
                                assert.ok(
                                    actor.hasCharacteristic("SWIMMING"),
                                    `Type [${type}] expects [SWIMMING] node`,
                                );
                                assert.ok(actor.hasCharacteristic("LEAPING"), `Type [${type}] expects [LEAPING] node`);
                                if (is5e) {
                                    assert.equal(
                                        getVal("running"),
                                        6,
                                        `Type [${type}] [5e] [running] must default to 6"`,
                                    );
                                    assert.equal(
                                        getVal("swimming"),
                                        2,
                                        `Type [${type}] [5e] [swimming] must default to 2"`,
                                    );
                                    assert.equal(
                                        getVal("leaping"),
                                        2,
                                        `Type [${type}] [5e] [leaping] must default to 2"`,
                                    );
                                } else {
                                    assert.equal(
                                        getVal("running"),
                                        12,
                                        `Type [${type}] [6e] [running] must default to 12m`,
                                    );
                                    assert.equal(
                                        getVal("swimming"),
                                        4,
                                        `Type [${type}] [6e] [swimming] must default to 4m`,
                                    );
                                    assert.equal(
                                        getVal("leaping"),
                                        4,
                                        `Type [${type}] [6e] [leaping] must default to 4m`,
                                    );
                                }
                            });
                        }
                    }
                });

                describe("Verify Physical Construct Baselines (6e vs 5e)", () => {
                    after(cleanup);

                    for (const is5e of [false, true]) {
                        it(`Validate type base2 structural configurations [5e=${is5e}]`, async () => {
                            const actor = await Actor.create({
                                name: `Test-Base2-5e-${is5e}`,
                                type: "base2",
                                system: { is5e: is5e },
                            });
                            createdActors.push(actor);

                            const getVal = (c) =>
                                actor.system.characteristics?.[c]?.value ?? actor.system.characteristics?.[c]?.max;

                            assert.ok(actor.hasCharacteristic("BODY"), "Type [base2] expects [BODY] node");
                            assert.equal(getVal("body"), 2, "Type [base2] [body] must default to 2");

                            // Structural objects cannot move under their own power
                            assert.notOk(actor.hasCharacteristic("RUNNING"), "Type [base2] must lack [RUNNING]");
                            assert.notOk(actor.hasCharacteristic("SWIMMING"), "Type [base2] must lack [SWIMMING]");
                            assert.notOk(actor.hasCharacteristic("LEAPING"), "Type [base2] must lack [LEAPING]");
                        });

                        it(`Validate type automaton artificial configurations [5e=${is5e}]`, async () => {
                            const actor = await Actor.create({
                                name: `Test-Auto-5e-${is5e}`,
                                type: "automaton",
                                system: { is5e: is5e },
                            });
                            createdActors.push(actor);

                            const getVal = (c) =>
                                actor.system.characteristics?.[c]?.value ?? actor.system.characteristics?.[c]?.max;

                            assert.ok(actor.hasCharacteristic("RUNNING"), "Type [automaton] expects [RUNNING] node");
                            assert.ok(actor.hasCharacteristic("SWIMMING"), "Type [automaton] expects [SWIMMING] node");
                            assert.ok(actor.hasCharacteristic("LEAPING"), "Type [automaton] expects [LEAPING] node");

                            if (is5e) {
                                assert.equal(getVal("running"), 6, 'Type [automaton] [5e] [running] defaults to 6"');
                            } else {
                                assert.equal(getVal("running"), 12, "Type [automaton] [6e] [running] defaults to 12m");
                            }
                        });
                    }
                });

                describe("Verify Mechanical and Processing System Baselines (6e vs 5e)", () => {
                    after(cleanup);

                    for (const is5e of [false, true]) {
                        it(`Validate type vehicle propulsion tracks [5e=${is5e}]`, async () => {
                            const actor = await Actor.create({
                                name: `Test-Veh-5e-${is5e}`,
                                type: "vehicle",
                                system: { is5e: is5e },
                            });
                            createdActors.push(actor);

                            // Vehicles possess independent movement nodes (varies dynamically by chassis size, defaults check structure)
                            assert.ok(actor.hasCharacteristic("RUNNING"), "Type [vehicle] expects [RUNNING] node");
                            assert.ok(actor.hasCharacteristic("SWIMMING"), "Type [vehicle] expects [SWIMMING] node");
                            assert.ok(actor.hasCharacteristic("LEAPING"), "Type [vehicle] expects [LEAPING] node");
                        });

                        it(`Validate type computer mainframe system [5e=${is5e}]`, async () => {
                            const actor = await Actor.create({
                                name: `Test-Comp-5e-${is5e}`,
                                type: "computer",
                                system: { is5e: is5e },
                            });
                            createdActors.push(actor);

                            // Stationary processing stations have no physical form or mobility tracks
                            assert.notOk(
                                actor.hasCharacteristic("RUNNING"),
                                "Type [computer] must completely lack [RUNNING]",
                            );
                            assert.notOk(
                                actor.hasCharacteristic("SWIMMING"),
                                "Type [computer] must completely lack [SWIMMING]",
                            );
                            assert.notOk(
                                actor.hasCharacteristic("LEAPING"),
                                "Type [computer] must completely lack [LEAPING]",
                            );
                        });

                        it(`Validate type ai software layer [5e=${is5e}]`, async () => {
                            const actor = await Actor.create({
                                name: `Test-AI-5e-${is5e}`,
                                type: "ai",
                                system: { is5e: is5e },
                            });
                            createdActors.push(actor);

                            assert.notOk(
                                actor.hasCharacteristic("RUNNING"),
                                "Type [ai] must completely lack [RUNNING]",
                            );
                            assert.notOk(
                                actor.hasCharacteristic("SWIMMING"),
                                "Type [ai] must completely lack [SWIMMING]",
                            );
                            assert.notOk(
                                actor.hasCharacteristic("LEAPING"),
                                "Type [ai] must completely lack [LEAPING]",
                            );
                        });
                    }
                });

                describe("Verify Implicit Coverage Safety", () => {
                    after(cleanup);

                    it("Catch unexpected variations or undocumented actor types", () => {
                        const known = ["pc", "npc", "base2", "automaton", "vehicle", "computer", "ai", "base"];
                        for (const type of Actor.TYPES) {
                            assert.include(
                                known,
                                type,
                                `Unrecognized type "${type}" detected without validation logic.`,
                            );
                        }
                    });
                });
            });
        },
        { displayName: "HERO: Default characteristics for each actor type" },
    );
}
