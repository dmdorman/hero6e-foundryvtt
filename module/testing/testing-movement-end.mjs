import {
    createQuenchActor,
    createQuenchScene,
    deleteQuenchActor,
    deleteQuenchScenes,
    setQuenchTimeout,
    waitForNotificationQueueToClear,
} from "./quench-helper.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { movementEndCost } from "../token/actor-token.mjs";

/**
 * Movement history waypoints only need the fields the END calculation reads.
 * @param {string} action
 * @param {number[]} costs
 */
function waypoints(action, costs) {
    return costs.map((cost) => ({ action, cost }));
}

/**
 * Fresh movement sources per call, as the token builds them once per action.
 * @param {Array<[number, number]>} sources - [metres, END per metre]
 */
function sourcesFor(sources) {
    return () =>
        sources
            .map(([distanceUnused, endPer1mMovement]) => ({ distanceUnused, endPer1mMovement }))
            .sort((a, b) => a.endPer1mMovement - b.endPer1mMovement);
}

export function registerMovementEndTests(quench) {
    quench.registerBatch(
        `${game.system.id}.movementEnd`,
        (context) => {
            const { describe, it, assert, before, after } = context;

            describe("Movement END", function () {
                setQuenchTimeout(this);

                describe("movementEndCost", function () {
                    it("Running 12m moving 12m costs 2 END", function () {
                        assert.equal(movementEndCost(waypoints("RUNNING", [12]), 1, sourcesFor([[12, 0.1]])), 2);
                    });

                    it("Running 12m moving 30m costs 3 END", function () {
                        assert.equal(movementEndCost(waypoints("RUNNING", [30]), 1, sourcesFor([[12, 0.1]])), 3);
                    });

                    it("Running 12m moving 30m over several moves costs 3 END", function () {
                        assert.equal(
                            movementEndCost(waypoints("RUNNING", [10, 10, 10]), 1, sourcesFor([[12, 0.1]])),
                            3,
                        );
                    });

                    it("Many short moves do not pick up an extra END from float noise", function () {
                        assert.equal(
                            movementEndCost(waypoints("RUNNING", new Array(20).fill(1)), 1, sourcesFor([[12, 0.1]])),
                            2,
                        );
                    });

                    it("Grid units convert to metres before costing", function () {
                        assert.equal(movementEndCost(waypoints("RUNNING", [15]), 2, sourcesFor([[12, 0.1]])), 3);
                    });

                    it("0 END Flight stays free past its combat distance", function () {
                        assert.equal(movementEndCost(waypoints("FLIGHT", [40]), 1, sourcesFor([[20, 0]])), 0);
                    });

                    it("Distance past a mixed movement pool costs the pool's average END per metre", function () {
                        // 12m @ 0.1 + 20m @ 0 = 1.2 END for 32m; the next 32m costs the same 1.2
                        assert.equal(
                            movementEndCost(
                                waypoints("RUNNING", [64]),
                                1,
                                sourcesFor([
                                    [12, 0.1],
                                    [20, 0],
                                ]),
                            ),
                            3,
                        );
                    });

                    it("A movement mode with no sources costs nothing", function () {
                        assert.equal(movementEndCost(waypoints("RUNNING", [30]), 1, sourcesFor([])), 0);
                    });

                    it("Each action spends its own sources", function () {
                        const costs = { RUNNING: [[12, 0.1]], FLIGHT: [[20, 0]] };
                        assert.equal(
                            movementEndCost(
                                [...waypoints("FLIGHT", [20]), ...waypoints("RUNNING", [12])],
                                1,
                                (action) => sourcesFor(costs[action])(),
                            ),
                            2,
                        );
                    });
                });

                describe("endPer1mMovement", function () {
                    let actor;
                    const flightXmls = [
                        `
                                <POWER XMLID="FLIGHT" ID="1759400000001" BASECOST="0.0" LEVELS="20" ALIAS="Flight" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Full END Flight" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                    <NOTES />
                                </POWER>
                        `,
                        `
                                <POWER XMLID="FLIGHT" ID="1759400000002" BASECOST="0.0" LEVELS="20" ALIAS="Flight" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Half END Flight" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                    <NOTES />
                                    <MODIFIER XMLID="REDUCEDEND" ID="1759400000003" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                        <NOTES />
                                    </MODIFIER>
                                </POWER>
                        `,
                        `
                                <POWER XMLID="FLIGHT" ID="1759400000004" BASECOST="0.0" LEVELS="20" ALIAS="Flight" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Zero END Flight" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                    <NOTES />
                                    <MODIFIER XMLID="REDUCEDEND" ID="1759400000005" BASECOST="0.5" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ZERO" OPTIONID="ZERO" OPTION_ALIAS="0 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                        <NOTES />
                                    </MODIFIER>
                                </POWER>
                        `,
                    ];

                    before(async function () {
                        actor = await createQuenchActor({
                            quench: this,
                            contents: `<POWER XMLID="FTL" ID="1712026014674" BASECOST="10.0" LEVELS="2" ALIAS="Faster-Than-Light Travel" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
                            is5e: false,
                        });
                        for (const flightXml of flightXmls) {
                            await HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(flightXml, actor), {
                                parent: actor,
                            });
                        }
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("FTL costs no END per metre", function () {
                        const ftl = actor.items.find((item) => item.system.XMLID === "FTL");
                        assert.equal(ftl.endPer1mMovement, 0);
                    });

                    it("Flight costs 1 END per 10m", function () {
                        const flight = actor.items.find((item) => item.name === "Full END Flight");
                        assert.closeTo(flight.endPer1mMovement, 0.1, 1e-9);
                    });

                    it("Half END Flight costs 1 END per 20m", function () {
                        const flight = actor.items.find((item) => item.name === "Half END Flight");
                        assert.closeTo(flight.endPer1mMovement, 0.05, 1e-9);
                    });

                    it("0 END Flight costs no END per metre", function () {
                        const flight = actor.items.find((item) => item.name === "Zero END Flight");
                        assert.equal(flight.endPer1mMovement, 0);
                    });
                });

                describe("Token movement history", function () {
                    let quenchScene;
                    let actor6e;
                    let actor5e;
                    let token6e;
                    let token5e;

                    // movementHistory is recorded by real drags; only action and cost matter here
                    function stubMovementHistory(tokenDoc, costs) {
                        Object.defineProperty(tokenDoc, "movementHistory", {
                            value: waypoints("RUNNING", costs),
                            configurable: true,
                        });
                    }

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        quenchScene = await createQuenchScene({ quench: this });
                        actor6e = await createQuenchActor({ quench: this, is5e: false, name: "Runner 6e" });
                        actor5e = await createQuenchActor({ quench: this, is5e: true, name: "Runner 5e" });
                        [token6e, token5e] = await quenchScene.createEmbeddedDocuments("Token", [
                            { name: actor6e.name, actorId: actor6e.id, actorLink: true, x: 0, y: 0 },
                            { name: actor5e.name, actorId: actor5e.id, actorLink: true, x: 200, y: 0 },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor: actor6e });
                        await deleteQuenchActor({ quench: this, actor: actor5e });
                    });

                    it("6e Running 12m moving 12m costs 2 END", function () {
                        assert.equal(actor6e.system.characteristics.running.max, 12);
                        stubMovementHistory(token6e, [12]);
                        assert.equal(token6e._movementHistoryEndCost, 2);
                    });

                    it("6e Running 12m moving 30m costs 3 END", function () {
                        stubMovementHistory(token6e, [30]);
                        assert.equal(token6e._movementHistoryEndCost, 3);
                    });

                    it('5e Running 6" moving 30m costs 3 END', function () {
                        assert.equal(actor5e.system.characteristics.running.max, 6);
                        stubMovementHistory(token5e, [30]);
                        assert.equal(token5e._movementHistoryEndCost, 3);
                    });
                });
            });
        },
        { displayName: "HERO: Movement END" },
    );
}
