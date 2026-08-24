import { getAndSetGameSetting, SETTINGS_GROUPS } from "../settings/settings-helpers.mjs";
import { messagesSince, setQuenchTimeout, snapshotMessages, waitUntil } from "./quench-helper.mjs";

const { Actor } = foundry.documents;

// Absolute position on the Turn/Segment clock
const abs = (turn, segment) => turn * 12 + segment;

// Shared actor/combat factories. Each describe passes its own tracking arrays
// so its after() hook tears down only its own documents.
function makeHarness({ actorDocuments, combatDocuments }) {
    async function makeActor(name, { dex = 10, spd = 2, type = "pc", extra = {} } = {}) {
        const system = {
            initiativeCharacteristic: "dex",
            characteristics: {
                dex: { value: dex, max: dex },
                spd: { value: spd, max: spd },
            },
            ...extra,
        };
        // 5e SPD is figured — floor(1 + DEX/10 + LEVELS) recomputed on every
        // prepareData — so directly seeded values would not survive. Seed the
        // purchases that make the requested numbers real instead: DEX as levels
        // over its base 10, SPD as levels over the figured amount (5e characters
        // routinely buy SPD on top of what DEX gives them).
        if (extra.is5e === true) {
            const figuredSpd = Math.floor(1 + Math.max(0, dex) / 10);
            system.DEX ??= { LEVELS: dex - 10 };
            system.SPD ??= { LEVELS: spd - figuredSpd };
        }
        const actor = await Actor.create(
            { name, type, system },
            // Pin the edition: under a 5e DefaultEdition world, figured-characteristic
            // recalculation would rewrite the seeded SPD as 1 + DEX/10 on every prepareData
            { is5e: extra.is5e ?? false },
        );
        actor.prepareData();
        // A drift between the seeded purchase and the figured formula would silently
        // skew every phase expectation downstream; fail loudly at the source instead
        if (extra.is5e === true && actor.system.characteristics.spd.max !== spd) {
            throw new Error(
                `makeActor(${name}): 5e figured SPD came out ${actor.system.characteristics.spd.max}, wanted ${spd}`,
            );
        }
        actorDocuments.push(actor);
        return actor;
    }

    async function makeCombat(actors) {
        const combat = await Combat.create({
            name: "_Quench Combat",
            scene: canvas.scene?.id || null,
            active: true,
        });
        combatDocuments.push(combat);
        await combat.createEmbeddedDocuments(
            "Combatant",
            actors.map((a) => ({ actorId: a.id })),
        );
        ui.combat.viewed = combat;
        return combat;
    }

    const combatantFor = (combat, actor) => combat.combatants.find((c) => c.actorId === actor.id);

    // Standard "Holding An Action" effect shell; hold carries the position/anchor payload
    async function makeHoldEffect(combatant, hold) {
        const [effect] = await combatant.actor.createEmbeddedDocuments("ActiveEffect", [
            {
                name: "Holding An Action",
                img: "icons/svg/clockwork.svg",
                statuses: ["holding"],
                flags: { [game.system.id]: { hold: { combatantId: combatant.id, ...hold } } },
            },
        ]);
        return effect;
    }

    return { makeActor, makeCombat, combatantFor, makeHoldEffect };
}

export function registerCombatTests(quench) {
    quench.registerBatch(
        `${game.system.id}.combat.speed-chart-progression`,
        (context) => {
            const { after, before, describe, expect, it } = context;

            const foundryVersion = game.release?.version ?? "Unknown V13/Prior";
            const generationLabel = game.release?.generation ?? 13;

            // This has to be the top level so isSingleCombatTracker can be changed
            describe(`Hero System 6e Speed Chart Turn Progression Matrix (Foundry Gen: ${generationLabel})`, function () {
                // Pointer moves now settle pending segment maintenance first, so the
                // long multi-Turn marches legitimately exceed mocha's 2s default —
                // and one march timing out mid-run corrupts the next test's clock
                setQuenchTimeout(this);
                const actorDocuments = [];
                const combatDocuments = [];
                const { makeActor, makeCombat, combatantFor } = makeHarness({ actorDocuments, combatDocuments });
                let savedLrAutoElevate;
                let preexistingMessageIds;

                before(async function () {
                    preexistingMessageIds = new Set(game.messages.contents.map((m) => m.id));

                    // The tests assume the prompt-mode default; a world with the
                    // auto-elevate setting on would pre-elevate every scoped LR combatant
                    savedLrAutoElevate = await getAndSetGameSetting("lrAutoElevate", false);

                    console.log(
                        `[${game.system.id}] QUENCH | Platform Version: ${foundryVersion} (Gen ${generationLabel})`,
                    );
                    console.log(`[${game.system.id}] QUENCH | Spawning tactical speed chart test entities...`);

                    // The _Quench prefix keeps these visible to the global cleanup batch
                    // (quench-helper deletes _Quench-prefixed actors), so an aborted run
                    // cannot leak them past this suite's own after() hook
                    const roster = [
                        { name: "_Quench Guard (SPD 3)", dex: 18, spd: 3 },
                        { name: "_Quench Behemoth (SPD 4)", dex: 8, spd: 4 },
                        { name: "_Quench Speedster (SPD 12)", dex: 25, spd: 12 },
                        { name: "_Quench Sluggish (SPD 1)", dex: 5, spd: 1 },
                        { name: "_Quench Overcapped (SPD 13)", dex: 12, spd: 13 },
                        { name: "_Quench Drained (SPD -1)", dex: 10, spd: -1 },
                    ];

                    for (const config of roster) {
                        await makeActor(config.name, { dex: config.dex, spd: config.spd });
                    }
                });

                after(async function () {
                    console.log(`[${game.system.id}] QUENCH | Cleaning up test documents...`);

                    // The suite may have been skipped before the setting was saved
                    if (savedLrAutoElevate !== undefined) {
                        await game.settings.set(game.system.id, "lrAutoElevate", savedLrAutoElevate);
                    }

                    // Combats FIRST, mirroring quench-helper's teardown order: deleting
                    // the actors first mutates the combats mid-teardown
                    for (const combatDoc of combatDocuments) {
                        if (typeof combatDoc?.delete === "function") {
                            const combatId = combatDoc.id;
                            await combatDoc.delete();

                            // Clear tracking sidebar focus if ui.combat is actively viewing it
                            if (ui.combat?.viewed?.id === combatId) {
                                ui.combat.viewed = null;
                            }
                        }
                    }

                    for (const actor of actorDocuments) {
                        if (typeof actor?.delete === "function") await actor.delete();
                    }

                    // Sweep chat messages the tests produced
                    if (preexistingMessageIds) {
                        for (const message of game.messages.contents.filter((m) => !preexistingMessageIds.has(m.id))) {
                            try {
                                await message.delete();
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }

                    // Force a final single layout redraw pass to reset the sidebar interface panel
                    if (ui.combat) ui.combat.render(true);
                });

                it("Should execute an exhaustive 2-round progression verifying dynamic worldTime clock increments", async function () {
                    const { HeroCompatibility } = await import("../utility/compatibility.mjs");

                    const startTimeStamp = game.time.worldTime;

                    const testCombatDocument = await makeCombat([]);

                    const combatantData = actorDocuments.map((actor) => {
                        const isGuard = actor.name.includes("Guard");
                        const isBehemoth = actor.name.includes("Behemoth");
                        const isSpeedster = actor.name.includes("Speedster");
                        const isSluggish = actor.name.includes("Sluggish");
                        const isOvercapped = actor.name.includes("Overcapped");
                        const isDrained = actor.name.includes("Drained");

                        let targetDex = 10;
                        let targetSpd = 2;

                        if (isGuard) {
                            targetDex = 18;
                            targetSpd = 3;
                        } else if (isBehemoth) {
                            targetDex = 8;
                            targetSpd = 4;
                        } else if (isSpeedster) {
                            targetDex = 25;
                            targetSpd = 12;
                        } else if (isSluggish) {
                            targetDex = 5;
                            targetSpd = 1;
                        } else if (isOvercapped) {
                            targetDex = 12;
                            targetSpd = 13;
                        } else if (isDrained) {
                            targetDex = 10;
                            targetSpd = -1;
                        }

                        return HeroCompatibility.getCombatantCreationPayload(actor.id, targetDex, targetSpd);
                    });

                    await testCombatDocument.createEmbeddedDocuments("Combatant", combatantData);

                    testCombatDocument.combatants.forEach((c) => {
                        c.actor?.prepareData();
                        c.prepareData();
                    });

                    // Begin the encounter state machine sequence
                    await testCombatDocument.startCombat();

                    // ─── ROUND 1: INITIAL SEGMENT 12 LANDING ZONE ───
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(testCombatDocument.round).to.equal(1);
                    expect(game.time.worldTime).to.equal(startTimeStamp); // No time should pass on the initial setup tick
                    expect(testCombatDocument.combatant.name).to.include("Speedster");

                    // Step through the active actors remaining in Segment 12
                    await testCombatDocument.nextTurn(); // Guard acts
                    expect(game.time.worldTime).to.equal(startTimeStamp); // Same segment, delta must be 0

                    await testCombatDocument.nextTurn(); // Overcapped acts
                    await testCombatDocument.nextTurn(); // Behemoth acts
                    expect(game.time.worldTime).to.equal(startTimeStamp);

                    // 🚨 CRITICAL TRANSACTION BOUNDARY: ADVANCE OUT OF SEGMENT 12
                    // All Segment 12 actors have completed actions. The engine must advance to Round 2, Segment 1.
                    // Hero System 6e Rule: Moving from Segment 12 straight to Segment 1 consumes exactly 1 world second.
                    await testCombatDocument.nextTurn();

                    expect(testCombatDocument.round).to.equal(2);
                    expect(testCombatDocument.segment).to.equal(1);
                    expect(testCombatDocument.combatant.name).to.include("Speedster");

                    // ─── VERIFY 1-SECOND SEGMENT 12 -> 1 ROLLOVER TIME ADJUSTMENT ───
                    expect(game.time.worldTime).to.equal(startTimeStamp + 1);

                    // ─── ROUND 2: SEQUENTIAL TIME ADVANCEMENT TRACKING ───
                    await testCombatDocument.nextTurn(); // Overcapped acts in Segment 1
                    expect(game.time.worldTime).to.equal(startTimeStamp + 1); // Same segment, no clock change

                    // Advance out of Segment 1 -> Next active is Segment 2 (Speedster and Overcapped)
                    // Leap delta: 1 second elapsed (Segment 1 -> Segment 2)
                    await testCombatDocument.nextTurn();
                    expect(testCombatDocument.segment).to.equal(2);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 2);
                    expect(testCombatDocument.combatant.name).to.include("Speedster");

                    await testCombatDocument.nextTurn(); // Overcapped acts in Segment 2

                    // Advance out of Segment 2 -> Next active is Segment 3 (Speedster, Overcapped, Behemoth)
                    // Leap delta: 1 second elapsed (Segment 2 -> Segment 3)
                    await testCombatDocument.nextTurn();
                    expect(testCombatDocument.segment).to.equal(3);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 3);

                    await testCombatDocument.nextTurn(); // Overcapped Seg 3
                    await testCombatDocument.nextTurn(); // Behemoth Seg 3

                    // Advance out of Segment 3 -> Next active is Segment 4 (Speedster, Guard, Overcapped)
                    // Leap delta: 1 second elapsed (Segment 3 -> Segment 4)
                    await testCombatDocument.nextTurn();
                    expect(testCombatDocument.segment).to.equal(4);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 4);

                    await testCombatDocument.nextTurn(); // Guard Seg 4
                    await testCombatDocument.nextTurn(); // Overcapped Seg 4

                    // ⏩ DYNAMIC LEAP MULTI-SECOND SKIP VERIFICATION:
                    // Advance out of Segment 4 -> Segment 5 acts next.
                    await testCombatDocument.nextTurn(); // Speedster Seg 5 (Time = Start + 5)
                    await testCombatDocument.nextTurn(); // Overcapped Seg 5

                    // Advance out of Segment 5 -> Segment 6 acts next.
                    await testCombatDocument.nextTurn(); // Speedster Seg 6 (Time = Start + 6)
                    await testCombatDocument.nextTurn(); // Overcapped Seg 6
                    await testCombatDocument.nextTurn(); // Behemoth Seg 6

                    // Advance out of Segment 6 -> Enters Segment 7 (Speedster, Overcapped, Sluggish)
                    // Leap delta: 1 second elapsed (Segment 6 -> Segment 7)
                    await testCombatDocument.nextTurn();
                    expect(testCombatDocument.segment).to.equal(7);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 7);
                    expect(testCombatDocument.combatant.name).to.include("Speedster");

                    await testCombatDocument.nextTurn(); // Overcapped Seg 7
                    await testCombatDocument.nextTurn(); // Sluggish acts natively in Seg 7

                    // ✅ ORGANIC SEQUENTIAL SEGMENT MARCH:
                    // Bypasses the raw update-pointer bugs completely by allowing the state engine to run naturally.
                    // Segment 8 participants: Speedster, Guard, Overcapped (3 turns)
                    await testCombatDocument.nextTurn(); // Speedster Seg 8 (Time = Start + 8)
                    await testCombatDocument.nextTurn(); // Guard Seg 8
                    await testCombatDocument.nextTurn(); // Overcapped Seg 8

                    // Segment 9 participants: Speedster, Overcapped, Behemoth (3 turns)
                    await testCombatDocument.nextTurn(); // Speedster Seg 9 (Time = Start + 9)
                    await testCombatDocument.nextTurn(); // Overcapped Seg 9
                    await testCombatDocument.nextTurn(); // Behemoth Seg 9

                    // Segment 10 participants: Speedster, Overcapped (2 turns)
                    await testCombatDocument.nextTurn(); // Speedster Seg 10 (Time = Start + 10)
                    await testCombatDocument.nextTurn(); // Overcapped Seg 10

                    // Segment 11 participants: Speedster, Overcapped (2 turns)
                    await testCombatDocument.nextTurn(); // Speedster Seg 11 (Time = Start + 11)
                    await testCombatDocument.nextTurn(); // Overcapped Seg 11

                    // Enters Segment 12 (Round 2)
                    await testCombatDocument.nextTurn();
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(testCombatDocument.round).to.equal(2);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 12);
                    expect(testCombatDocument.combatant.name).to.include("Speedster");

                    await testCombatDocument.nextTurn(); // Guard Seg 12
                    await testCombatDocument.nextTurn(); // Overcapped Seg 12
                    await testCombatDocument.nextTurn(); // Behemoth Seg 12

                    // 🚨 CRITICAL 2ND SECOND POST-SEGMENT 12 ROLLOVER SUCCESS BOUNDARY:
                    // Pushes tracking pointers into Round 3, Segment 1. Clock must record exactly 13 elapsed seconds.
                    await testCombatDocument.nextTurn();

                    expect(testCombatDocument.round).to.equal(3);
                    expect(testCombatDocument.segment).to.equal(1);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 13);
                    expect(testCombatDocument.combatant.name).to.include("Speedster");
                });

                it("Should execute a bidirectional sequence verifying nextTurn, nextRound, previousTurn, and previousRound", async function () {
                    const { HeroCompatibility } = await import("../utility/compatibility.mjs");

                    const startTimeStamp = game.time.worldTime;

                    const testCombatDocument = await makeCombat([]);

                    // Filter our roster down to standard operational characters to preserve gaps
                    const bidirectionalRoster = actorDocuments.filter(
                        (a) => a.name.includes("Guard") || a.name.includes("Behemoth") || a.name.includes("Overcapped"),
                    );

                    const combatantData = bidirectionalRoster.map((actor) => {
                        let targetDex = 10;
                        let targetSpd = 2;

                        if (actor.name.includes("Guard")) {
                            targetDex = 18;
                            targetSpd = 3;
                        } else if (actor.name.includes("Behemoth")) {
                            targetDex = 8;
                            targetSpd = 4;
                        } else if (actor.name.includes("Overcapped")) {
                            targetDex = 12;
                            targetSpd = 13;
                        }

                        return HeroCompatibility.getCombatantCreationPayload(actor.id, targetDex, targetSpd);
                    });

                    await testCombatDocument.createEmbeddedDocuments("Combatant", combatantData);

                    testCombatDocument.combatants.forEach((c) => {
                        c.actor?.prepareData();
                        c.prepareData();
                    });

                    await testCombatDocument.startCombat();

                    // ─── STEP 1: INITIAL SEGMENT 12 RECONNAISSANCE ───
                    // Expected order: Guard (DEX 18) -> Overcapped (DEX 12) -> Behemoth (DEX 8)
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(testCombatDocument.round).to.equal(1);
                    expect(testCombatDocument.combatant.name).to.include("Guard");

                    // Advance forward two steps in Segment 12
                    await testCombatDocument.nextTurn(); // Overcapped acts
                    expect(testCombatDocument.combatant.name).to.include("Overcapped");

                    await testCombatDocument.nextTurn(); // Behemoth acts
                    expect(testCombatDocument.combatant.name).to.include("Behemoth");

                    // ─── STEP 2: NEXT ROUND LEAP VERIFICATION ───
                    // Trigger a macro-round skip forward. Should advance round by 1 and consume exactly 12 seconds.
                    await testCombatDocument.nextRound();
                    expect(testCombatDocument.round).to.equal(2);
                    expect(testCombatDocument.segment).to.equal(12); // Round leaps retain current segment pointers natively
                    expect(game.time.worldTime).to.equal(startTimeStamp + 12);
                    expect(testCombatDocument.combatant.name).to.include("Guard");

                    // Advance into Round 3, Segment 1 via natural progression rollover
                    await testCombatDocument.nextTurn(); // Overcapped Seg 12
                    await testCombatDocument.nextTurn(); // Behemoth Seg 12

                    await testCombatDocument.nextTurn(); // Rolls out of Segment 12 into Round 3, Segment 1 (+1 second)
                    expect(testCombatDocument.round).to.equal(3);
                    expect(testCombatDocument.segment).to.equal(1);
                    expect(game.time.worldTime).to.equal(startTimeStamp + 13);
                    expect(testCombatDocument.combatant.name).to.include("Overcapped"); // Segment 1 has only Overcapped

                    // ─── STEP 3: PREVIOUS ROUND REWIND VERIFICATION ───
                    // Trigger a macro-round rewind backward. Should roll round back by 1 and subtract exactly 12 seconds.
                    await testCombatDocument.previousRound();
                    expect(testCombatDocument.round).to.equal(2);
                    expect(testCombatDocument.segment).to.equal(1); // Keeps segment context
                    expect(game.time.worldTime).to.equal(startTimeStamp + 1); // (Original 13 - 12 = 1)
                    expect(testCombatDocument.combatant.name).to.include("Overcapped");

                    // ─── STEP 4: PREVIOUS TURN LOOKAHEAD UNWIND VERIFICATION ───
                    // Unwind backward out of Round 2, Segment 1.
                    // Expected destination: The last acting participant in the prior active segment (Round 1, Segment 12).
                    // Hero System 6e Rule: Moving backward from Segment 1 to Segment 12 rewinds exactly -1 second.
                    await testCombatDocument.previousTurn();

                    expect(testCombatDocument.round).to.equal(1);
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(game.time.worldTime).to.equal(startTimeStamp); // Back to starting baseline timestamp!

                    // Reversing into a segment targets the LAST priority actor who acted in that window.
                    // Segment 12 roster: Guard (Index 0) -> Overcapped (Index 1) -> Behemoth (Index 2)
                    // Therefore, the backward step must land squarely on Behemoth.
                    expect(testCombatDocument.combatant.name).to.include("Behemoth");

                    // Unwind backward one more turn within Segment 12
                    await testCombatDocument.previousTurn();
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(testCombatDocument.combatant.name).to.include("Overcapped");
                });

                it("Should execute backward rollbacks via previousRound and previousTurn to verify unstarted reset thresholds", async function () {
                    const { HeroCompatibility } = await import("../utility/compatibility.mjs");

                    const testCombatDocument = await makeCombat([]);

                    // Streamline the collection map for a fast reset execution sweep
                    const resetRoster = actorDocuments.filter(
                        (a) => a.name.includes("Guard") || a.name.includes("Behemoth"),
                    );
                    const combatantData = resetRoster.map((actor) => {
                        let targetDex = 10;
                        let targetSpd = 2;
                        if (actor.name.includes("Guard")) {
                            targetDex = 18;
                            targetSpd = 3;
                        } else if (actor.name.includes("Behemoth")) {
                            targetDex = 8;
                            targetSpd = 4;
                        }
                        return HeroCompatibility.getCombatantCreationPayload(actor.id, targetDex, targetSpd);
                    });

                    await testCombatDocument.createEmbeddedDocuments("Combatant", combatantData);

                    testCombatDocument.combatants.forEach((c) => {
                        c.actor?.prepareData();
                        c.prepareData();
                    });

                    // 🏁 INITIALIZATION: Combat transitions out of unstarted state into Round 1 Segment 12
                    await testCombatDocument.startCombat();
                    expect(testCombatDocument.started).to.be.true;
                    expect(testCombatDocument.round).to.equal(1);
                    expect(testCombatDocument.segment).to.equal(12);

                    // Advance forward several phases across segments to build historical round stack time context
                    await testCombatDocument.nextTurn(); // Guard acts in Seg 12
                    await testCombatDocument.nextTurn(); // Behemoth acts in Seg 12
                    await testCombatDocument.nextTurn(); // Rolls into Round 2, Segment 3 (Behemoth acts next)

                    expect(testCombatDocument.round).to.equal(2);
                    expect(testCombatDocument.started).to.be.true;

                    // ─── STEP 1: VERIFY MACRO PREVIOUS ROUND UNSTARTED THRESHOLD ───
                    // Winding a full round back from Round 2 must drop the encounter level back into Round 1
                    await testCombatDocument.previousRound();
                    expect(testCombatDocument.round).to.equal(1);
                    expect(testCombatDocument.started).to.be.true; // Round 1 is still active, started must remain true

                    // Force round state counter explicitly down into Round 1, Segment 12, Turn Index 1 (Behemoth)
                    await testCombatDocument.nextTurn();
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(testCombatDocument.combatant.name).to.include("Behemoth");

                    // ─── STEP 2: STEP-BY-STEP PREVIOUS TURN REWIND THRESHOLD ───
                    // Step backward Turn Index 1 (Behemoth) -> Turn Index 0 (Guard) within Segment 12
                    await testCombatDocument.previousTurn();
                    expect(testCombatDocument.segment).to.equal(12);
                    expect(testCombatDocument.round).to.equal(1);
                    expect(testCombatDocument.started).to.be.true;
                    expect(testCombatDocument.combatant.name).to.include("Guard");

                    // 🚨 CRITICAL RESET BOUNDARY LEAP:
                    // We sit at Round 1, Segment 12, Turn Index 0.
                    // Executing one more previousTurn() must drop the tracker out of started combat entirely.
                    await testCombatDocument.previousTurn();

                    // Assert that the persistent database state machine reset cleanly to unstarted baselines
                    expect(testCombatDocument.started).to.be.false;
                    expect(testCombatDocument.round).to.equal(0);
                    expect(testCombatDocument.turn).to.equal(0);
                    expect(testCombatDocument.segment).to.equal(12);
                });

                it("Should give SPD 1-12 characters their book speed chart phases", async function () {
                    const bookSpeedChart = {
                        1: [7],
                        2: [6, 12],
                        3: [4, 8, 12],
                        4: [3, 6, 9, 12],
                        5: [3, 5, 8, 10, 12],
                        6: [2, 4, 6, 8, 10, 12],
                        7: [2, 4, 6, 7, 9, 11, 12],
                        8: [2, 3, 5, 6, 8, 9, 11, 12],
                        9: [2, 3, 4, 6, 7, 8, 10, 11, 12],
                        10: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
                        11: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                        12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                    };

                    const chartActors = [];
                    for (let spd = 1; spd <= 12; spd++) {
                        const actor = await makeActor(`_Quench Chart SPD ${spd}`, { dex: 10, spd });
                        chartActors.push(actor);
                    }

                    const combat = await makeCombat(chartActors);

                    for (let spd = 1; spd <= 12; spd++) {
                        const combatant = combatantFor(combat, chartActors[spd - 1]);
                        const phases = [];
                        for (let segment = 1; segment <= 12; segment++) {
                            if (combatant.hasPhaseInSegment(segment)) phases.push(segment);
                        }
                        expect(phases, `SPD ${spd}`).to.deep.equal(bookSpeedChart[spd]);
                    }
                });

                it("Should apply Post-Segment 12 Recovery through TakeRecovery exactly once per turn boundary", async function () {
                    const automationSetting = await getAndSetGameSetting("automation", "all");

                    try {
                        const actor = await makeActor("_Quench Recovery PC", { dex: 10, spd: 2 });

                        const rec = actor.system.characteristics.rec.value;
                        const stunMax = actor.system.characteristics.stun.max;
                        const endMax = actor.system.characteristics.end.max;
                        expect(rec, "test actor has positive REC").to.be.greaterThan(0);

                        // Damage well below max so the recovery isn't capped
                        await actor.update({
                            "system.characteristics.stun.value": stunMax - rec - 3,
                            "system.characteristics.end.value": endMax - rec - 3,
                        });

                        const combat = await makeCombat([actor]);
                        await combat.startCombat();
                        expect(combat.segment).to.equal(12);

                        // Crossing out of Segment 12 applies the Post-Segment 12 Recovery
                        await combat.nextTurn();
                        expect(combat.round).to.equal(2);
                        expect(combat.segment).to.equal(6);
                        expect(actor.system.characteristics.stun.value).to.equal(stunMax - 3);
                        expect(actor.system.characteristics.end.value).to.equal(endMax - 3);

                        // Rewind across the boundary and advance again: the recoveredRounds ledger
                        // must prevent a second application
                        await combat.previousTurn();
                        expect(combat.round).to.equal(1);
                        expect(combat.segment).to.equal(12);

                        await combat.nextTurn();
                        expect(combat.round).to.equal(2);
                        expect(actor.system.characteristics.stun.value).to.equal(stunMax - 3);
                        expect(actor.system.characteristics.end.value).to.equal(endMax - 3);
                    } finally {
                        await game.settings.set(game.system.id, "automation", automationSetting);
                    }
                });

                it("Should apply Post-Segment 12 Recovery to unlinked token actors", async function () {
                    const automationSetting = await getAndSetGameSetting("automation", "all");

                    let tokenDoc = null;
                    try {
                        let scene = game.scenes.active ?? game.scenes.contents?.[0];
                        if (!scene) {
                            scene = await Scene.create({ name: "_Quench Recovery Arena" });
                        }

                        const npcActor = await Actor.create(
                            {
                                name: "_Quench Recovery NPC",
                                type: "npc",
                                system: {
                                    initiativeCharacteristic: "dex",
                                    characteristics: {
                                        dex: { value: 10, max: 10 },
                                        spd: { value: 2, max: 2 },
                                    },
                                },
                                prototypeToken: { actorLink: false },
                            },
                            { is5e: false },
                        );
                        actorDocuments.push(npcActor);

                        [tokenDoc] = await scene.createEmbeddedDocuments("Token", [
                            await npcActor.getTokenDocument({ x: 0, y: 0, actorLink: false }),
                        ]);
                        expect(tokenDoc.actor.isToken, "token actor is synthetic (unlinked)").to.be.true;

                        const rec = tokenDoc.actor.system.characteristics.rec.value;
                        const stunMax = tokenDoc.actor.system.characteristics.stun.max;
                        expect(rec, "test npc has positive REC").to.be.greaterThan(0);

                        await tokenDoc.actor.update({
                            "system.characteristics.stun.value": stunMax - rec - 3,
                        });
                        const worldStun = npcActor.system.characteristics.stun.value;

                        const combat = await Combat.create({ name: "_Quench Combat", scene: scene.id, active: true });
                        combatDocuments.push(combat);
                        await combat.createEmbeddedDocuments("Combatant", [
                            { actorId: npcActor.id, tokenId: tokenDoc.id, sceneId: scene.id },
                        ]);
                        await combat.startCombat();
                        await combat.nextTurn();

                        expect(combat.round).to.equal(2);
                        expect(
                            tokenDoc.actor.system.characteristics.stun.value,
                            "unlinked token actor received the recovery",
                        ).to.equal(stunMax - 3);
                        expect(npcActor.system.characteristics.stun.value, "world actor was not modified").to.equal(
                            worldStun,
                        );
                    } finally {
                        if (tokenDoc) await tokenDoc.delete();
                        await game.settings.set(game.system.id, "automation", automationSetting);
                    }
                });

                it("Should slot positional Held Actions, bench generic holds, and spend both when passed", async function () {
                    const automationSetting = await getAndSetGameSetting("automation", "none");

                    try {
                        const holder = await makeActor("_Quench Holder", { dex: 20, spd: 2 });
                        const rusher = await makeActor("_Quench Rusher", { dex: 25, spd: 3 });

                        const combat = await makeCombat([holder, rusher]);
                        await combat.startCombat();

                        // Segment 12: Rusher (DEX 25) acts before Holder (DEX 20)
                        expect(combat.segment).to.equal(12);
                        expect(combat.combatant.actorId).to.equal(rusher.id);

                        await combat.nextTurn();
                        expect(combat.combatant.actorId).to.equal(holder.id);

                        // Holder declares a positional Held Action on their Phase: Segment 2 of the
                        // next Turn at DEX 12 (legal window for SPD 2 at T1S12 spans through Segment 5)
                        await holder.createEmbeddedDocuments("ActiveEffect", [
                            {
                                name: "Holding An Action",
                                img: "icons/svg/clockwork.svg",
                                statuses: ["holding"],
                                flags: {
                                    [game.system.id]: { hold: { mode: "position", segmentAbs: abs(2, 2), dex: 12 } },
                                },
                            },
                        ]);
                        // Rusher banks a generic hold (bare status): no initiative slot at all
                        await rusher.createEmbeddedDocuments("ActiveEffect", [
                            { name: "Holding An Action", img: "icons/svg/clockwork.svg", statuses: ["holding"] },
                        ]);

                        const holderCombatant = combatantFor(combat, holder);
                        const rusherCombatant = combatantFor(combat, rusher);

                        // The positional hold slots at the declared DEX in the declared segment only
                        expect(Math.floor(combat.getInitiativePriority(holderCombatant, 2))).to.equal(12);
                        expect(combat.getInitiativePriority(holderCombatant, 1)).to.equal(0);
                        // Generic holds occupy no position and receive no turn
                        expect(combat.getInitiativePriority(rusherCombatant, 2)).to.equal(0);

                        // Segment 1 is empty; the advance lands on the holder's declared slot in Segment 2
                        await combat.nextTurn();
                        expect(combat.round).to.equal(2);
                        expect(combat.segment).to.equal(2);
                        expect(combat.combatant.actorId).to.equal(holder.id);
                        expect(holder.statuses.has("holding"), "hold persists at its declared slot").to.be.true;

                        // Segment 3 is empty; Segment 4 is the rusher's natural SPD 3 Phase, which
                        // replaces their generic hold
                        await combat.nextTurn();
                        expect(combat.segment).to.equal(4);
                        expect(combat.combatant.actorId).to.equal(rusher.id);
                        const rusherConsumed = await waitUntil(() => !rusher.statuses.has("holding"));
                        expect(rusherConsumed, "generic hold consumed by the natural Phase").to.be.true;

                        // The holder's held turn came and went in Segment 2 without being used,
                        // so the positional hold is spent, not carried forward
                        const spent = await waitUntil(() => !holder.statuses.has("holding"));
                        expect(spent, "positional hold spent once its held turn passed").to.be.true;
                    } finally {
                        await game.settings.set(game.system.id, "automation", automationSetting);
                    }
                });

                it("Should resolve anchored Held Actions adjacent to the anchor's live position (#4602)", async function () {
                    const automationSetting = await getAndSetGameSetting("automation", "none");

                    try {
                        // Anchor and rival tie on DEX 20 so only the random tie-break
                        // separates them; the holder must land adjacent to the ANCHOR
                        // regardless of how those rolls fall
                        const anchorActor = await makeActor("_Quench Anchor", { dex: 20, spd: 3 });
                        const rival = await makeActor("_Quench Rival", { dex: 20, spd: 3 });
                        const holder = await makeActor("_Quench Anchored Holder", { dex: 15, spd: 2 });

                        const combat = await makeCombat([anchorActor, rival, holder]);
                        await combat.startCombat();
                        expect(combat.segment).to.equal(12);

                        const anchorCombatant = combatantFor(combat, anchorActor);
                        const holderCombatant = combatantFor(combat, holder);

                        // Holder (SPD 2 at T1S12) banks a Phase for Segment 4 of Turn 2
                        // (abs 28), right after the anchor; the DEX snapshot is set to a
                        // deliberately wrong 7 to prove live resolution wins
                        const slotAbs = abs(2, 4);
                        const [holdEffect] = await holder.createEmbeddedDocuments("ActiveEffect", [
                            {
                                name: "Holding An Action",
                                img: "icons/svg/clockwork.svg",
                                statuses: ["holding"],
                                flags: {
                                    [game.system.id]: {
                                        hold: {
                                            mode: "position",
                                            segmentAbs: slotAbs,
                                            dex: 7,
                                            combatantId: holderCombatant.id,
                                            anchor: {
                                                combatantId: anchorCombatant.id,
                                                relation: "after",
                                                name: anchorCombatant.name,
                                            },
                                        },
                                    },
                                },
                            },
                        ]);

                        const anchorPriority = combat.getInitiativePriority(anchorCombatant, 4, { queryAbs: slotAbs });
                        expect(anchorPriority, "anchor has a live position in the slot segment").to.be.greaterThan(0);
                        const afterPriority = combat.getInitiativePriority(holderCombatant, 4, { queryAbs: slotAbs });
                        expect(afterPriority, "the holder shares the anchor's exact scalar").to.equal(anchorPriority);
                        expect(
                            combat.tieBreakOrder(holderCombatant, anchorCombatant, slotAbs),
                            "'after' orders immediately below the anchor",
                        ).to.be.greaterThan(0);

                        // 'Before' shares the scalar too but orders above the anchor
                        await holdEffect.setFlag(game.system.id, "hold", {
                            anchor: { relation: "before" },
                        });
                        const beforePriority = combat.getInitiativePriority(holderCombatant, 4, { queryAbs: slotAbs });
                        expect(beforePriority, "'before' also shares the anchor's scalar").to.equal(anchorPriority);
                        expect(
                            combat.tieBreakOrder(holderCombatant, anchorCombatant, slotAbs),
                            "'before' orders immediately above the anchor",
                        ).to.be.lessThan(0);

                        // An anchor with no Phase in the slot's segment (SPD 3 has none in
                        // Segment 2) falls back to the declaration-time DEX snapshot
                        await holdEffect.setFlag(game.system.id, "hold", {
                            segmentAbs: abs(2, 2),
                            anchor: { relation: "after" },
                        });
                        const fallbackPriority = combat.getInitiativePriority(holderCombatant, 2, {
                            queryAbs: abs(2, 2),
                        });
                        expect(Math.floor(fallbackPriority), "unresolvable anchor falls back to the snapshot").to.equal(
                            7,
                        );

                        // A→B→A anchor cycles must terminate: the inner lookup falls back
                        // to its snapshot instead of recursing
                        await holdEffect.setFlag(game.system.id, "hold", {
                            segmentAbs: slotAbs,
                            anchor: { relation: "after" },
                        });
                        await anchorActor.createEmbeddedDocuments("ActiveEffect", [
                            {
                                name: "Holding An Action",
                                img: "icons/svg/clockwork.svg",
                                statuses: ["holding"],
                                flags: {
                                    [game.system.id]: {
                                        hold: {
                                            mode: "position",
                                            segmentAbs: slotAbs,
                                            dex: 20,
                                            combatantId: anchorCombatant.id,
                                            anchor: {
                                                combatantId: holderCombatant.id,
                                                relation: "after",
                                                name: holderCombatant.name,
                                            },
                                        },
                                    },
                                },
                            },
                        ]);
                        const cycledHolder = combat.getInitiativePriority(holderCombatant, 4, { queryAbs: slotAbs });
                        const cycledAnchor = combat.getInitiativePriority(anchorCombatant, 4, { queryAbs: slotAbs });
                        expect(Number.isFinite(cycledHolder), "cycled holder priority resolves finitely").to.be.true;
                        expect(Number.isFinite(cycledAnchor), "cycled anchor priority resolves finitely").to.be.true;
                        expect(cycledHolder, "cycle unwinds from the snapshot, holder below anchor").to.be.lessThan(
                            cycledAnchor,
                        );
                    } finally {
                        await game.settings.set(game.system.id, "automation", automationSetting);
                    }
                });

                it("Should replace the natural Phase when a Held Action is used in its segment", async function () {
                    const alpha = await makeActor("_Quench Replace Alpha", { dex: 30, spd: 2 });
                    const holder = await makeActor("_Quench Replace Holder", { dex: 20, spd: 2 });

                    // Generic hold banked before combat; the holder also has a natural
                    // Phase in Segment 12
                    await holder.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Holding An Action", img: "icons/svg/clockwork.svg", statuses: ["holding"] },
                    ]);

                    const combat = await makeCombat([alpha, holder]);
                    await combat.startCombat();
                    expect(combat.combatant.actorId).to.equal(alpha.id);

                    // Using the hold out of turn consumes this segment's action: it takes
                    // the place of the Phase. Tracker handlers resolve
                    // through ui.combat.viewed, which lags the freshly created combat in
                    // headless runs — pin it first.
                    ui.combat.viewed = combat;
                    const holderCombatant = combatantFor(combat, holder);
                    await ui.combat._onUseHeldAction(holderCombatant.id);

                    expect(holder.statuses.has("holding"), "hold consumed by use").to.be.false;
                    expect(holderCombatant.spentHoldPosition?.segmentAbs, "acted position recorded").to.equal(24);
                    expect(Math.floor(combat.getInitiativePriority(holderCombatant, 12))).to.equal(20);
                    expect(combat._takesTurnInSegment(holderCombatant, 12), "no second action this segment").to.be
                        .false;

                    // Advancing skips the holder's replaced natural Phase entirely
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                });

                it("Should advance past a spent same-segment hold into the next Turn's matching segment", async function () {
                    const slug = await makeActor("_Quench Freeze Slug", { dex: 20, spd: 1 });

                    const combat = await makeCombat([slug]);
                    await combat.startCombat();

                    // SPD 1 phases only in Segment 7: the first advance crosses into Turn 2
                    await combat.nextTurn();
                    expect(combat.round).to.equal(2);
                    expect(combat.segment).to.equal(7);
                    const combatant = combatantFor(combat, slug);
                    expect(combat.combatant?.id).to.equal(combatant.id);

                    // Same-segment positional hold to a lower DEX; ending the turn re-enters
                    // the pointer at the held slot
                    const currentAbs = combat.round * 12 + combat.segment;
                    await slug.toggleStatusEffect("holding", { active: true });
                    const holdEffect = slug.effects.find((e) => e.statuses.has("holding"));
                    await holdEffect.setFlag(game.system.id, "hold", {
                        mode: "position",
                        segmentAbs: currentAbs,
                        dex: 10,
                        declaredAbs: currentAbs,
                    });
                    await combat.nextTurn();
                    expect(combat.combatant?.id, "held slot taken in the same segment").to.equal(combatant.id);

                    // Ending the held turn spends the hold. The spent record is bound to
                    // THIS Turn's Segment 7 and must not block Segment 7 of the NEXT Turn —
                    // the scan's 12th probe lands on the same segment number
                    await combat.nextTurn();
                    expect(combat.round, "advanced into the next Turn").to.equal(3);
                    expect(combat.segment).to.equal(7);
                    expect(combat.combatant?.id).to.equal(combatant.id);
                    const spent = await waitUntil(() => !slug.statuses.has("holding"));
                    expect(spent, "hold spent once its held turn passed").to.be.true;
                });

                it("Should consume a solo combatant's event hold at their next natural Phase", async function () {
                    const loner = await makeActor("_Quench Solo Holder", { dex: 20, spd: 2 });

                    const combat = await makeCombat([loner]);
                    await combat.startCombat();
                    expect(combat.combatant?.actorId).to.equal(loner.id);

                    // Event hold declared on the Segment 12 Phase; every subsequent advance
                    // leads from the holder back to the holder (previousCombatantId is
                    // always their own id), which must not shield the hold forever
                    const declaredAbs = combat.round * 12 + combat.segment;
                    await loner.toggleStatusEffect("holding", { active: true });
                    const holdEffect = loner.effects.find((e) => e.statuses.has("holding"));
                    await holdEffect.setFlag(game.system.id, "hold", {
                        mode: "event",
                        trigger: "if the door opens",
                        declaredAbs,
                    });

                    // The arriving Segment 6 Phase replaces the banked one
                    await combat.nextTurn();
                    expect(combat.round).to.equal(2);
                    expect(combat.segment).to.equal(6);
                    const consumed = await waitUntil(() => !loner.statuses.has("holding"));
                    expect(consumed, "event hold replaced by the next natural Phase").to.be.true;
                });

                it("Should preserve a just-declared hold when the turn is rewound within the segment", async function () {
                    const alpha = await makeActor("_Quench Rewind Alpha", { dex: 30, spd: 2 });
                    const holder = await makeActor("_Quench Rewind Holder", { dex: 20, spd: 2 });
                    const gamma = await makeActor("_Quench Rewind Gamma", { dex: 10, spd: 2 });

                    const combat = await makeCombat([alpha, holder, gamma]);
                    await combat.startCombat();
                    await combat.nextTurn();
                    expect(combat.combatant?.actorId).to.equal(holder.id);

                    // Declare on the holder's Phase and end the turn, as the dialog does
                    const declaredAbs = combat.round * 12 + combat.segment;
                    await holder.toggleStatusEffect("holding", { active: true });
                    const holdEffect = holder.effects.find((e) => e.statuses.has("holding"));
                    await holdEffect.setFlag(game.system.id, "hold", {
                        mode: "event",
                        trigger: "if the guard turns around",
                        declaredAbs,
                    });
                    await combat.nextTurn();
                    expect(combat.combatant?.actorId).to.equal(gamma.id);

                    // A rewind must not run forward turn-flow side effects: the naive
                    // direction would see the holder active on a natural Phase and consume
                    // the hold they just declared
                    await combat.previousTurn();
                    expect(combat.combatant?.actorId).to.equal(holder.id);
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    expect(holder.statuses.has("holding"), "hold survives the rewind").to.be.true;
                });

                it("Should refuse an abort after acting and spend the current Phase when active", async function () {
                    const bruiser = await makeActor("_Quench Abort Bruiser", { dex: 30, spd: 2 });
                    const dodger = await makeActor("_Quench Abort Dodger", { dex: 20, spd: 2 });

                    const combat = await makeCombat([bruiser, dodger]);
                    await combat.startCombat();

                    // March to Segment 6 and let the dodger act on their Phase
                    await combat.nextTurn(); // dodger, Segment 12
                    await combat.nextTurn(); // bruiser, Segment 6
                    await combat.nextTurn(); // dodger, Segment 6
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId).to.equal(dodger.id);

                    // The bruiser already used their Segment 6 Phase: a character cannot
                    // Abort again until the next Segment
                    ui.combat.viewed = combat;
                    const bruiserCombatant = combatantFor(combat, bruiser);
                    const refused = await combat.declareAbort(bruiserCombatant);
                    expect(refused, "abort refused after acting this Segment").to.be.false;
                    expect(bruiser.statuses.has("aborted")).to.be.false;

                    // The pointer sits on the dodger without them having acted (a Held
                    // Action interrupt shape): the abort replaces the CURRENT Phase and
                    // ends the turn
                    const dodgerCombatant = combatantFor(combat, dodger);
                    const applied = await combat.declareAbort(dodgerCombatant);
                    expect(applied).to.be.true;
                    expect(combat.segment, "turn ended by the abort").to.equal(12);
                    expect(combat.combatant.actorId).to.equal(bruiser.id);

                    // Only the current Phase was consumed: the Segment 12 Phase comes
                    // after the aborted one, so the dodger still acts there and the
                    // status clears once Segment 6 has passed (asserted behaviorally —
                    // the boundary maintenance may clear the status at any moment)
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId, "Phase after the aborted one is free").to.equal(dodger.id);

                    const cleared = await waitUntil(() => !dodger.statuses.has("aborted"));
                    expect(cleared, "aborted status cleared after the spent Phase passed").to.be.true;
                });

                it("Should not skip the Phase after an abort's spent Phase for a top-DEX combatant", async function () {
                    const reactor = await makeActor("_Quench Abort Reactor", { dex: 30, spd: 4 });
                    const pacer = await makeActor("_Quench Abort Pacer", { dex: 20, spd: 6 });

                    const combat = await makeCombat([reactor, pacer]);
                    await combat.startCombat();

                    // Segment 12: reactor (30) then pacer (20); Segment 2 is the pacer's alone
                    await combat.nextTurn();
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(2);
                    expect(combat.combatant.actorId).to.equal(pacer.id);

                    // Reactor (SPD 4: 3/6/9/12) aborts during Segment 2, where they have no
                    // Phase: the abort consumes their Segment 3 Phase
                    ui.combat.viewed = combat;
                    const reactorCombatant = combatantFor(combat, reactor);
                    await combat.declareAbort(reactorCombatant);
                    expect(reactorCombatant.abortSpentAbs, "abort consumes the Segment 3 Phase").to.equal(27);

                    // Segment 3 (reactor's spent Phase, nobody else) is passed over entirely
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(4);
                    expect(combat.combatant.actorId).to.equal(pacer.id);

                    // Segment 6: the abort is spent, so the top-DEX reactor must act FIRST
                    // even though the status document is still awaiting boundary cleanup
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId, "spent abort must not cost a second Phase").to.equal(reactor.id);

                    const cleared = await waitUntil(() => !reactor.statuses.has("aborted"));
                    expect(cleared, "aborted status cleared after the spent Phase passed").to.be.true;
                });

                it("Should spend the Held Action when aborting while holding, losing no Phase", async function () {
                    const alpha = await makeActor("_Quench AbortHold Alpha", { dex: 30, spd: 2 });
                    const holder = await makeActor("_Quench AbortHold Holder", { dex: 20, spd: 2 });

                    await holder.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Holding An Action", img: "icons/svg/clockwork.svg", statuses: ["holding"] },
                    ]);

                    const combat = await makeCombat([alpha, holder]);
                    await combat.startCombat();
                    expect(combat.combatant.actorId).to.equal(alpha.id);

                    // Aborting while holding spends the held Phase: no aborted lockout, and
                    // the replaced natural Phase is recorded so it cannot be used again
                    //
                    ui.combat.viewed = combat;
                    const holderCombatant = combatantFor(combat, holder);
                    const applied = await combat.declareAbort(holderCombatant, {
                        toAction: "Dodge",
                        statusId: "dodge",
                    });
                    expect(applied).to.be.true;
                    expect(holder.statuses.has("holding"), "hold consumed by the abort").to.be.false;
                    expect(holder.statuses.has("aborted"), "no aborted lockout when a held Phase absorbs it").to.be
                        .false;
                    // The dialog activates the real DODGE maneuver when the actor has one,
                    // otherwise it falls back to the bare status icon
                    const holderDodgeItem = holder.items.find((i) => i.system?.XMLID === "DODGE");
                    const dodgeApplied = holderDodgeItem
                        ? holderDodgeItem.isActive === true
                        : holder.statuses.has("dodge");
                    expect(dodgeApplied, "the defensive maneuver is applied").to.be.true;
                    expect(holderCombatant.spentHoldPosition?.segmentAbs, "acted position recorded").to.equal(24);
                    expect(combat._takesTurnInSegment(holderCombatant, 12), "no second action this segment").to.be
                        .false;

                    // The holder's replaced Segment 12 Phase is skipped, but their next
                    // natural Phase is intact — no further Phase was lost
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId, "next natural Phase intact").to.equal(holder.id);
                });

                it("Should block aborts and Held Action use while Stunned or abort-locked", async function () {
                    const guard = await makeActor("_Quench Guard", { dex: 25, spd: 2 });
                    const stunny = await makeActor("_Quench Stunny", { dex: 20, spd: 2 });

                    await stunny.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Stunned", img: "icons/svg/daze.svg", statuses: ["stunned"] },
                    ]);

                    const combat = await makeCombat([guard, stunny]);
                    await combat.startCombat();
                    ui.combat.viewed = combat;
                    const stunnyCombatant = combatantFor(combat, stunny);

                    // A Stunned character can take no Action — not even Aborting
                    const refused = await combat.declareAbort(stunnyCombatant);
                    expect(refused, "abort refused while Stunned").to.be.false;
                    expect(stunny.statuses.has("aborted")).to.be.false;
                    expect(combat.blockedActionReason(stunnyCombatant)).to.include("Stunned");

                    // Recovered from being Stunned, the abort goes through and locks out
                    // all other actions until the spent Phase passes
                    await stunny.effects.find((e) => e.statuses.has("stunned")).delete();
                    const applied = await combat.declareAbort(stunnyCombatant);
                    expect(applied).to.be.true;
                    expect(stunny.statuses.has("aborted")).to.be.true;
                    expect(combat.blockedActionReason(stunnyCombatant)).to.include("Aborted");

                    // Even a (bare-status) Held Action cannot be used during the lockout
                    await stunny.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Holding An Action", img: "icons/svg/clockwork.svg", statuses: ["holding"] },
                    ]);
                    await ui.combat._onUseHeldAction(stunnyCombatant.id);
                    expect(stunny.statuses.has("holding"), "held use blocked during the abort lockout").to.be.true;
                });

                it("Should consume two Phases when aborting to an Extra Phase power", async function () {
                    const alpha = await makeActor("_Quench ExtraPhase Alpha", { dex: 30, spd: 2 });
                    const burner = await makeActor("_Quench ExtraPhase Burner", { dex: 20, spd: 4 });

                    const combat = await makeCombat([alpha, burner]);
                    await combat.startCombat();
                    ui.combat.viewed = combat;

                    // Aborting to an Extra Phase power consumes the next TWO Phases
                    //: the Segment 12 Phase not yet used plus the Segment 3 one.
                    // The recorded spentAbs is the later Phase, so the lockout spans both.
                    const burnerCombatant = combatantFor(combat, burner);
                    const applied = await combat.declareAbort(burnerCombatant, { extraPhase: true });
                    expect(applied).to.be.true;
                    expect(burnerCombatant.abortSpentAbs, "lockout extends to the second Phase").to.equal(27);
                    expect(burnerCombatant.abortAppliesAtAbs(24), "first consumed Phase covered").to.be.true;
                    expect(burnerCombatant.abortAppliesAtAbs(27), "second consumed Phase covered").to.be.true;
                    expect(burnerCombatant.abortAppliesAtAbs(28), "free after the second Phase").to.be.false;
                });

                it("Should expire a Dodge maneuver at the start of the actor's next Phase", async function () {
                    const alpha = await makeActor("_Quench Expiry Alpha", { dex: 30, spd: 2 });
                    const weaver = await makeActor("_Quench Expiry Weaver", { dex: 20, spd: 2 });
                    if (!weaver.items.find((i) => i.system?.XMLID === "DODGE")) {
                        await weaver.addHeroSystemManeuvers();
                    }

                    const combat = await makeCombat([alpha, weaver]);
                    await combat.startCombat();
                    // Maneuver activation checks actor.inCombat, which reads the viewed combat
                    ui.combat.viewed = combat;

                    // Weaver dodges as their Segment 12 Phase action
                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(weaver.id);
                    const dodgeItem = weaver.items.find((i) => i.system?.XMLID === "DODGE");
                    await dodgeItem.toggle();
                    const hasManeuverAe = () =>
                        weaver.temporaryEffects.some(
                            (ae) => ae.flags?.[game.system.id]?.type === "maneuverNextPhaseEffect",
                        );
                    expect(hasManeuverAe(), "dodge effect active after declaring").to.be.true;

                    // Someone else's Phase starting must not expire it: the Dodge lasts
                    // until the weaver's own next Phase
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId).to.equal(alpha.id);
                    expect(hasManeuverAe(), "dodge persists through other combatants' Phases").to.be.true;

                    // The weaver's next Phase begins: the boundary maintenance switches
                    // the maneuver back off
                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(weaver.id);
                    const expired = await waitUntil(() => !hasManeuverAe() && dodgeItem.isActive !== true);
                    expect(expired, "dodge expired at the start of the actor's next Phase").to.be.true;
                });

                it("Should remove a nextPhase-flagged effect at the start of the actor's next Phase", async function () {
                    const gunner = await makeActor("_Quench CV Penalty Gunner", { dex: 30, spd: 2 });
                    const bystander = await makeActor("_Quench CV Penalty Bystander", { dex: 20, spd: 2 });
                    const combat = await makeCombat([gunner, bystander]);
                    await combat.startCombat();
                    expect(combat.combatant.actorId).to.equal(gunner.id);

                    // Ranged-attack CV penalties are applied as an ActiveEffect flagged
                    // nextPhase (utility/attack.mjs makeActionActiveEffects); mirror its
                    // shape so this exercises the same cleanup path
                    await gunner.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "_Quench -2 DCV",
                            img: "icons/svg/downgrade.svg",
                            changes: [
                                {
                                    key: "system.characteristics.dcv.max",
                                    value: -2,
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                                },
                            ],
                            duration: { seconds: 12 },
                            flags: { [game.system.id]: { nextPhase: true, actionEffect: true } },
                        },
                    ]);
                    const hasPenaltyAe = () =>
                        gunner.effects.some((ae) => ae.flags?.[game.system.id]?.nextPhase === true);
                    expect(hasPenaltyAe(), "penalty effect active after the attack").to.be.true;

                    // Another combatant's Phase starting must not remove it
                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(bystander.id);
                    expect(hasPenaltyAe(), "penalty persists through other combatants' Phases").to.be.true;

                    // The gunner's own next Phase begins: _onPhaseStart sweeps it
                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(gunner.id);
                    const removed = await waitUntil(() => !hasPenaltyAe());
                    expect(removed, "penalty removed at the start of the actor's next Phase").to.be.true;
                });

                it("Should mark knocked out combatants defeated via the tracker toggle", async function () {
                    const sleeper = await makeActor("_Quench KO Sleeper", { dex: 10, spd: 2 });

                    const combat = await makeCombat([sleeper]);

                    await sleeper.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Knocked Out", img: "icons/svg/unconscious.svg", statuses: ["knockedOut"] },
                    ]);

                    const combatant = combatantFor(combat, sleeper);
                    expect(combatant.isDefeated, "KO alone is not core-defeated").to.be.false;
                    expect(combatant.isOutOfCombat, "KO skips turns").to.be.true;

                    // The skull toggle must still be able to MARK a KO'd combatant defeated
                    await ui.combat._onToggleDefeatedStatus(combatant);
                    expect(combatant.defeated, "defeated flag set").to.be.true;
                    expect(combatant.isDefeated).to.be.true;

                    await ui.combat._onToggleDefeatedStatus(combatant);
                    expect(combatant.defeated, "defeated flag cleared").to.be.false;
                });

                it("Should apply LIGHTNING_REFLEXES_ALL to initiative order", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");

                    const lrActor = await makeActor("_Quench Lightning Reflexes", { dex: 15, spd: 2 });
                    const opponent = await makeActor("_Quench LR Opponent", { dex: 20, spd: 2 });

                    await HeroSystem6eItem.create(
                        HeroSystem6eItem.itemDataFromXml(
                            `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000001" BASECOST="0.0" LEVELS="10" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SEX="Neutral" MINCOSTS="No" MAXCOSTS="No" NAME="" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="All Actions"></TALENT>`,
                            lrActor,
                        ),
                        { parent: lrActor },
                    );

                    const combat = await makeCombat([lrActor, opponent]);

                    // Effective DEX 15 + 10 beats DEX 20 for action order only
                    const lrCombatant = combatantFor(combat, lrActor);
                    const oppCombatant = combatantFor(combat, opponent);
                    expect(Math.floor(combat.getInitiativePriority(lrCombatant, 12))).to.equal(25);
                    expect(combat.getInitiativePriority(lrCombatant, 12)).to.be.greaterThan(
                        combat.getInitiativePriority(oppCombatant, 12),
                    );

                    await combat.startCombat();
                    expect(combat.combatant.actorId).to.equal(lrActor.id);
                });

                it("Should not auto-apply scoped Lightning Reflexes purchases", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");

                    const sniper = await makeActor("_Quench LR Sniper", { dex: 20, spd: 2 });
                    // LIGHTNING_REFLEXES_SINGLE is a 5e-only power, so its holder is 5e
                    const fiver = await makeActor("_Quench LR Fiver", { dex: 20, spd: 2, extra: { is5e: true } });

                    // 6e scoped LR shares XMLID LIGHTNING_REFLEXES_ALL, distinguished by OPTIONID
                    await HeroSystem6eItem.create(
                        HeroSystem6eItem.itemDataFromXml(
                            `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000002" BASECOST="0.0" LEVELS="5" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="Shuriken" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Action"></TALENT>`,
                            sniper,
                        ),
                        { parent: sniper },
                    );
                    // 5e single-action LR has its own XMLID
                    await HeroSystem6eItem.create(
                        HeroSystem6eItem.itemDataFromXml(
                            `<TALENT XMLID="LIGHTNING_REFLEXES_SINGLE" ID="1735000000003" BASECOST="0.0" LEVELS="2" ALIAS="Lightning Reflexes: +2 DEX to act first with Single Action" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="" INPUT="Single Action"></TALENT>`,
                            fiver,
                        ),
                        { parent: fiver },
                    );

                    const combat = await makeCombat([sniper, fiver]);
                    await combat.startCombat();

                    // Scoped purchases restrict the character to the scoped action when
                    // acting early, so they only apply on demand
                    const sniperCombatant = combatantFor(combat, sniper);
                    const fiverCombatant = combatantFor(combat, fiver);
                    expect(Math.floor(combat.getInitiativePriority(sniperCombatant, 12))).to.equal(20);
                    expect(Math.floor(combat.getInitiativePriority(fiverCombatant, 12))).to.equal(20);
                    expect(sniperCombatant.lightningReflexes.always).to.equal(0);
                    expect(sniperCombatant.lightningReflexes.scoped, "scope resolved").to.deep.equal({
                        levels: 5,
                        label: "Shuriken",
                    });
                    expect(fiverCombatant.lightningReflexes.scoped?.levels, "5e scoped levels").to.equal(2);
                });

                it("Should elevate a scoped Lightning Reflexes combatant for one segment on demand", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");

                    const alpha = await makeActor("_Quench LR Elev Alpha", { dex: 30, spd: 2 });
                    const mika = await makeActor("_Quench LR Elev Mika", { dex: 20, spd: 2 });

                    await HeroSystem6eItem.create(
                        HeroSystem6eItem.itemDataFromXml(
                            `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000004" BASECOST="0.0" LEVELS="5" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="Shuriken" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Action"></TALENT>`,
                            mika,
                        ),
                        { parent: mika },
                    );

                    const combat = await makeCombat([alpha, mika]);
                    await combat.startCombat();
                    ui.combat.viewed = combat;
                    expect(combat.combatant.actorId).to.equal(alpha.id);

                    // The elevated position (25) is still below the acting DEX 30, so
                    // acting early is on offer; taking it re-sorts without moving the
                    // pointer off the active combatant
                    const mikaCombatant = combatantFor(combat, mika);
                    expect(combat.lrElevationState(mikaCombatant)).to.equal("available");
                    await combat.toggleLrElevation(mikaCombatant.id);
                    expect(mikaCombatant.lrElevatedAbs).to.equal(24);
                    expect(Math.floor(combat.getInitiativePriority(mikaCombatant, 12))).to.equal(25);
                    expect(combat.combatant.actorId, "pointer stays on the active combatant").to.equal(alpha.id);

                    // Mika's elevated turn arrives for the scoped action only
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId, "elevated turn arrives").to.equal(mika.id);

                    // Ending the elevated stop spends only the scoped action: the rest
                    // of the Phase re-enters the segment at natural DEX
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId, "rest of the Phase at natural DEX").to.equal(mika.id);
                    expect(mikaCombatant.lrElevatedAbs, "elevation consumed by the LR stop").to.equal(null);
                    expect(Math.floor(combat.getInitiativePriority(mikaCombatant, 12))).to.equal(20);

                    // The remainder is one action: after it, the segment moves on
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId).to.equal(alpha.id);
                    expect(Math.floor(combat.getInitiativePriority(mikaCombatant, 6)), "natural DEX again").to.equal(
                        20,
                    );
                });

                it("Should slot the Phase remainder below intermediates after an elevated LR stop", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");

                    const alpha = await makeActor("_Quench LR SD Alpha", { dex: 30, spd: 2 });
                    const beta = await makeActor("_Quench LR SD Beta", { dex: 22, spd: 2 });
                    const mika = await makeActor("_Quench LR SD Mika", { dex: 20, spd: 2 });

                    await HeroSystem6eItem.create(
                        HeroSystem6eItem.itemDataFromXml(
                            `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000005" BASECOST="0.0" LEVELS="5" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="Shuriken" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Action"></TALENT>`,
                            mika,
                        ),
                        { parent: mika },
                    );

                    const combat = await makeCombat([alpha, beta, mika]);
                    await combat.startCombat();
                    ui.combat.viewed = combat;
                    expect(combat.combatant.actorId).to.equal(alpha.id);

                    // Cancelling before the stop arrives removes it; the position is
                    // still ahead of the count, so it can be re-declared
                    const mikaCombatant = combatantFor(combat, mika);
                    await combat.toggleLrElevation(mikaCombatant.id);
                    await combat.toggleLrElevation(mikaCombatant.id);
                    expect(mikaCombatant.lrElevatedAbs, "cancelled before arrival").to.equal(null);
                    expect(combat.lrElevationState(mikaCombatant)).to.equal("available");

                    // Mika elevates above Beta (25 vs 22) and her stop arrives second
                    await combat.toggleLrElevation(mikaCombatant.id);
                    await combat.nextTurn();
                    expect(combat.combatant.actorId, "elevated above Beta").to.equal(mika.id);

                    // Ending the LR stop: Beta (22) acts before the Phase remainder (20)
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId, "Beta acts next").to.equal(beta.id);
                    expect(mikaCombatant.lrElevatedAbs, "elevation consumed").to.equal(null);

                    await combat.nextTurn();
                    expect(combat.combatant.actorId, "remainder at natural DEX").to.equal(mika.id);
                    expect(Math.floor(combat.getInitiativePriority(mikaCombatant, 12))).to.equal(20);

                    // The remainder is one action: after it, the segment moves on
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId).to.equal(alpha.id);
                });

                it("Should preempt the segment's first actor when elevating above them", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");

                    const fast = await makeActor("_Quench LR Pre Fast", { dex: 25, spd: 2 });
                    const delta = await makeActor("_Quench LR Pre Delta", { dex: 22, spd: 2 });
                    const mika = await makeActor("_Quench LR Pre Mika", { dex: 20, spd: 2 });

                    await HeroSystem6eItem.create(
                        HeroSystem6eItem.itemDataFromXml(
                            `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000006" BASECOST="0.0" LEVELS="8" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="Shuriken" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Action"></TALENT>`,
                            mika,
                        ),
                        { parent: mika },
                    );

                    const combat = await makeCombat([fast, delta, mika]);
                    await combat.startCombat();
                    ui.combat.viewed = combat;
                    expect(combat.combatant.actorId).to.equal(fast.id);

                    // Nothing has completed a turn yet, so an elevated position ABOVE
                    // the (unacted) first actor is reachable and preempts the pointer
                    const mikaCombatant = combatantFor(combat, mika);
                    expect(combat.lrElevationState(mikaCombatant)).to.equal("available");
                    await combat.toggleLrElevation(mikaCombatant.id);
                    expect(combat.combatant.actorId, "LR stop preempts the first actor").to.equal(mika.id);
                    expect(Math.floor(combat.getInitiativePriority(mikaCombatant, 12))).to.equal(28);

                    // Ending the LR stop: the displaced actor acts, and the completed
                    // stop raises the high-water mark so re-elevating is off the table
                    await combat.nextTurn();
                    expect(combat.combatant.actorId, "displaced actor re-enters").to.equal(fast.id);
                    expect(combat.lrElevationState(mikaCombatant), "no second elevation this segment").to.equal(null);

                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(delta.id);
                    await combat.nextTurn();
                    expect(combat.combatant.actorId, "Phase remainder at natural DEX").to.equal(mika.id);

                    // A fresh segment resets the high-water mark: elevation is on offer again
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId).to.equal(fast.id);
                    expect(combat.lrElevationState(mikaCombatant), "fresh segment, fresh Phase").to.equal("available");
                });

                it("Should auto-elevate scoped Lightning Reflexes at segment start when enabled", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");
                    const autoSetting = await getAndSetGameSetting("lrAutoElevate", true);

                    try {
                        const fast = await makeActor("_Quench LR Auto Fast", { dex: 25, spd: 2 });
                        const mika = await makeActor("_Quench LR Auto Mika", { dex: 20, spd: 2 });

                        await HeroSystem6eItem.create(
                            HeroSystem6eItem.itemDataFromXml(
                                `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000007" BASECOST="0.0" LEVELS="8" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="Shuriken" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Action"></TALENT>`,
                                mika,
                            ),
                            { parent: mika },
                        );

                        const combat = await makeCombat([fast, mika]);
                        await combat.startCombat();
                        ui.combat.viewed = combat;

                        // Combat opens with the elevation applied and the LR stop preempting
                        const mikaCombatant = combatantFor(combat, mika);
                        expect(mikaCombatant.lrElevatedAbs, "auto-elevated at combat start").to.equal(24);
                        expect(combat.combatant.actorId, "LR stop goes first").to.equal(mika.id);
                        expect(Math.floor(combat.getInitiativePriority(mikaCombatant, 12))).to.equal(28);

                        // Normal split flow after the stop: displaced actor, then remainder
                        await combat.nextTurn();
                        expect(combat.combatant.actorId).to.equal(fast.id);
                        await combat.nextTurn();
                        expect(combat.combatant.actorId, "Phase remainder").to.equal(mika.id);

                        // The next segment auto-elevates again via boundary maintenance
                        await combat.nextTurn();
                        expect(combat.segment).to.equal(6);
                        const reElevated = await waitUntil(() => combat.combatant?.actorId === mika.id);
                        expect(reElevated, "auto-elevated and preempting in the fresh segment").to.be.true;
                        expect(mikaCombatant.lrElevatedAbs).to.equal(30);
                    } finally {
                        await game.settings.set(game.system.id, "lrAutoElevate", autoSetting);
                    }
                });

                it("Should whisper an Act Early prompt to scoped LR owners at segment start", async function () {
                    const { HeroSystem6eItem } = await import("../item/item.mjs");
                    const autoSetting = await getAndSetGameSetting("lrAutoElevate", false);

                    try {
                        const fast = await makeActor("_Quench LR Prompt Fast", { dex: 25, spd: 2 });
                        const mika = await makeActor("_Quench LR Prompt Mika", { dex: 20, spd: 2 });

                        await HeroSystem6eItem.create(
                            HeroSystem6eItem.itemDataFromXml(
                                `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1735000000008" BASECOST="0.0" LEVELS="5" ALIAS="Lightning Reflexes" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" NAME="Shuriken" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Action"></TALENT>`,
                                mika,
                            ),
                            { parent: mika },
                        );

                        const combat = await makeCombat([fast, mika]);
                        await combat.startCombat();

                        // startCombat awaits the prompt pass: a whispered card with the
                        // Act Early button exists for the LR holder
                        const mikaCombatant = combatantFor(combat, mika);
                        const prompt = game.messages.contents
                            .slice(-5)
                            .find((m) => m.content?.includes(`data-combatant-id="${mikaCombatant.id}"`));
                        expect(prompt, "prompt whispered to the owner").to.exist;
                        expect(prompt.whisper.length, "whispered, not public").to.be.greaterThan(0);
                        expect(prompt.content).to.include("hero-lr-act-early");
                        expect(mikaCombatant.lrElevatedAbs, "not auto-elevated without the setting").to.equal(null);
                    } finally {
                        await game.settings.set(game.system.id, "lrAutoElevate", autoSetting);
                    }
                });

                it("Should re-evaluate initiative order when DEX changes mid-combat and skip aborted combatants", async function () {
                    const alpha = await makeActor("_Quench Dex Alpha", { dex: 20, spd: 2 });
                    const bravo = await makeActor("_Quench Dex Bravo", { dex: 15, spd: 2 });

                    const combat = await makeCombat([alpha, bravo]);
                    await combat.startCombat();

                    expect(combat.combatant.actorId).to.equal(alpha.id);
                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(bravo.id);

                    // Simulate an Aid to DEX on Bravo; order is re-evaluated each segment
                    await bravo.update({ "system.characteristics.dex.value": 25 });

                    await combat.nextTurn();
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId, "raised DEX acts first in the next segment").to.equal(bravo.id);

                    // An aborted combatant keeps their natural priority (the row stays at
                    // its DEX position, struck through) but receives no turn — the skip
                    // lives in _takesTurnInSegment, not in the sort
                    await alpha.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Aborted", img: "icons/svg/downgrade.svg", statuses: ["aborted"] },
                    ]);
                    const alphaCombatant = combatantFor(combat, alpha);
                    expect(Math.floor(combat.getInitiativePriority(alphaCombatant, 6)), "priority unchanged").to.equal(
                        20,
                    );
                    expect(combat._takesTurnInSegment(alphaCombatant, 6), "no turn while aborted").to.be.false;

                    // Aborting spends Alpha's Phase: advancing skips their turn entirely and
                    // crosses into Segment 12; once the Segment containing the spent Phase
                    // passes they may act again on their next Phase
                    await combat.nextTurn();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId, "aborted combatant's turn is skipped").to.equal(bravo.id);

                    const abortCleared = await waitUntil(() => !alpha.statuses.has("aborted"));
                    expect(abortCleared, "aborted status cleared after the spent Phase segment passed").to.be.true;

                    await combat.nextTurn();
                    expect(combat.combatant.actorId, "recovered combatant acts on their next Phase").to.equal(alpha.id);
                });

                it("Should apply Post-Segment 12 Recovery when nextRound skips a full Turn", async function () {
                    const automationSetting = await getAndSetGameSetting("automation", "all");

                    try {
                        const actor = await makeActor("_Quench Round Recovery PC", { dex: 10, spd: 2 });

                        const rec = actor.system.characteristics.rec.value;
                        const stunMax = actor.system.characteristics.stun.max;
                        expect(rec, "test actor has positive REC").to.be.greaterThan(0);

                        await actor.update({
                            "system.characteristics.stun.value": stunMax - rec - 3,
                        });

                        const combat = await makeCombat([actor]);
                        await combat.startCombat();

                        // Skipping a full Turn crosses Post-Segment 12 exactly once
                        await combat.nextRound();
                        expect(combat.round).to.equal(2);
                        expect(combat.segment).to.equal(12);
                        expect(actor.system.characteristics.stun.value).to.equal(stunMax - 3);

                        // Rewinding and skipping forward again must not double-apply
                        await combat.previousRound();
                        expect(combat.round).to.equal(1);

                        await combat.nextRound();
                        expect(combat.round).to.equal(2);
                        expect(actor.system.characteristics.stun.value).to.equal(stunMax - 3);
                    } finally {
                        await game.settings.set(game.system.id, "automation", automationSetting);
                    }
                });

                it("Should lock out a combatant whose SPD changes until both SPDs would have had a Phase", async function () {
                    const slow = await makeActor("_Quench SPD Change", { dex: 20, spd: 2 });
                    const pacer = await makeActor("_Quench SPD Pacer", { dex: 10, spd: 12 });

                    const combat = await makeCombat([slow, pacer]);
                    await combat.startCombat();

                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId).to.equal(slow.id);
                    await combat.nextTurn(); // Pacer in Segment 12
                    await combat.nextTurn(); // Crosses into Round 2, Segment 1 (Pacer only)
                    expect(combat.segment).to.equal(1);

                    // SPD bookkeeping is seeded at the first segment boundary; wait for it so the
                    // change below is detected against the old SPD
                    const slowCombatant = combatantFor(combat, slow);
                    const seeded = await waitUntil(
                        () => slowCombatant.getFlag(game.system.id, "knownSpd") !== undefined,
                    );
                    expect(seeded, "knownSpd seeded at the first segment boundary").to.be.true;

                    // Change the SPD mid-Turn: SPD 2 (Phases 6, 12) becomes SPD 4 (Phases 3, 6, 9, 12).
                    // A sheet edit is a VOLUNTARY change and defers to Post-Segment 12; the GM's
                    // apply-immediately override converts it into the adjustment-style lockout,
                    // which is what the rest of this test exercises.
                    await slow.update({ "system.characteristics.spd.value": 4 });

                    await combat.nextTurn(); // Crosses into Segment 2; boundary detects the change
                    expect(combat.segment).to.equal(2);
                    const deferred = await waitUntil(() => !!slowCombatant.getFlag(game.system.id, "pendingSpd"));
                    expect(deferred, "voluntary sheet edit deferred at the segment boundary").to.be.true;
                    expect(slowCombatant.combatSpd, "old SPD still governs while deferred").to.equal(2);

                    await combat.applyPendingSpdNow(slowCombatant.id);
                    const detected = await waitUntil(() => !!slowCombatant.getFlag(game.system.id, "spdLockout"));
                    expect(detected, "GM override applies the change with the SPD-change lockout").to.be.true;

                    // Old SPD 2 would next act in Segment 6, new SPD 4 in Segment 3, so no actions
                    // until Segment 6
                    expect(slowCombatant.hasPhaseInSegment(3), "locked out of the new SPD Segment 3 Phase").to.be.false;
                    expect(slowCombatant.hasPhaseInSegment(6), "acts once both SPDs would have had a Phase").to.be.true;

                    await combat.nextTurn();
                    expect(combat.segment).to.equal(3);
                    expect(combat.combatant.actorId, "locked-out combatant does not act in Segment 3").to.equal(
                        pacer.id,
                    );

                    let guard = 0;
                    while (combat.segment !== 6 && guard++ < 12) {
                        await combat.nextTurn();
                    }
                    expect(combat.segment).to.equal(6);
                    expect(combat.combatant.actorId, "DEX 20 acts first on the new SPD chart").to.equal(slow.id);
                });

                it("Should end a 5e SPD-change lockout at the next Segment both SPDs share", async function () {
                    // 5e optional SPD-change rule: the character cannot act until the next
                    // Segment that is a Phase for BOTH SPDs. SPD 2 {6,12} and SPD 3 {4,8,12}
                    // share only Segment 12 — the 6e rule (both would have had a Phase) would
                    // already free them after Segment 6, making Segment 8 the observable split.
                    const slow = await makeActor("_Quench 5e SPD Change", { dex: 20, spd: 2, extra: { is5e: true } });
                    const pacer = await makeActor("_Quench 5e SPD Pacer", { dex: 10, spd: 12 });

                    const combat = await makeCombat([slow, pacer]);
                    await combat.startCombat();
                    expect(combat.segment).to.equal(12);
                    await combat.nextTurn(); // Pacer in Segment 12
                    await combat.nextTurn(); // Crosses into Round 2, Segment 1 (Pacer only)
                    expect(combat.segment).to.equal(1);

                    const slowCombatant = combatantFor(combat, slow);
                    const seeded = await waitUntil(
                        () => slowCombatant.getFlag(game.system.id, "knownSpd") !== undefined,
                    );
                    expect(seeded, "knownSpd seeded at the first segment boundary").to.be.true;

                    // A 5e sheet edit buys SPD LEVELS on top of the figured base: DEX 20
                    // figures SPD 3, the actor was seeded at -1 LEVELS for SPD 2, so 0
                    // LEVELS is SPD 3. The purchase must persist through the figured path.
                    await slow.update({ "system.SPD.LEVELS": 0 });
                    expect(
                        slow._source.system.characteristics.spd.value,
                        "SPD purchase persisted via the figured path",
                    ).to.equal(3);

                    await combat.nextTurn(); // Segment 2 boundary detects the change
                    const deferred = await waitUntil(() => !!slowCombatant.getFlag(game.system.id, "pendingSpd"));
                    expect(deferred, "voluntary LEVELS purchase deferred via pendingSpd").to.be.true;
                    expect(slowCombatant.combatSpd, "old SPD still governs while deferred").to.equal(2);

                    await combat.applyPendingSpdNow(slowCombatant.id);
                    const detected = await waitUntil(() => !!slowCombatant.getFlag(game.system.id, "spdLockout"));
                    expect(detected, "GM override applies the change with the SPD-change lockout").to.be.true;

                    const lockout = slowCombatant.getFlag(game.system.id, "spdLockout");
                    expect(
                        lockout.lockoutEndAbs,
                        "5e rule: locked until the next shared Phase of SPD 2 and 3",
                    ).to.equal(abs(2, 12));
                    expect(slowCombatant.hasPhaseInSegment(4), "locked out of the new SPD Segment 4 Phase").to.be.false;
                    expect(
                        slowCombatant.hasPhaseInSegment(8),
                        "still locked at Segment 8, where the 6e rule would already allow acting",
                    ).to.be.false;
                    expect(slowCombatant.hasPhaseInSegment(12), "acts at the first shared Phase").to.be.true;

                    let guard = 0;
                    while (combat.segment !== 8 && guard++ < 12) {
                        await combat.nextTurn();
                    }
                    expect(combat.segment).to.equal(8);
                    expect(combat.combatant.actorId, "Segment 8 belongs to the pacer alone").to.equal(pacer.id);

                    guard = 0;
                    while (combat.segment !== 12 && guard++ < 12) {
                        await combat.nextTurn();
                    }
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId, "DEX 20 acts first once the shared Segment arrives").to.equal(
                        slow.id,
                    );
                });
            });
        },
        { displayName: "HERO SYSTEM 6E: Speed Chart Combat Validation" },
    );

    quench.registerBatch(
        `${game.system.id}.combat.tracker-fixes`,
        (context) => {
            const { after, before, describe, expect, it } = context;

            describe(`Hero System 6e Combat Tracker Fix Validation`, function () {
                setQuenchTimeout(this);
                const actorDocuments = [];
                const combatDocuments = [];
                const { makeActor, makeCombat, combatantFor, makeHoldEffect } = makeHarness({
                    actorDocuments,
                    combatDocuments,
                });
                let preexistingMessageIds;

                before(async function () {
                    preexistingMessageIds = snapshotMessages();
                });

                after(async function () {
                    // Combats FIRST, mirroring quench-helper's teardown order: deleting
                    // the actors first mutates the combats mid-teardown
                    for (const combatDoc of combatDocuments) {
                        if (typeof combatDoc?.delete === "function") {
                            const combatId = combatDoc.id;
                            await combatDoc.delete();
                            if (ui.combat?.viewed?.id === combatId) ui.combat.viewed = null;
                        }
                    }
                    for (const actor of actorDocuments) {
                        if (typeof actor?.delete === "function") await actor.delete();
                    }

                    // Sweep chat messages the tests produced
                    if (preexistingMessageIds) {
                        for (const message of game.messages.contents.filter((m) => !preexistingMessageIds.has(m.id))) {
                            try {
                                await message.delete();
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }

                    if (ui.combat) ui.combat.render(true);
                });

                it("Should compute the 5e shared-Phase lockout and phase labels from the statics", async function () {
                    const { HeroSystem6eCombatantSingle } = await import("../combatant-single.mjs");
                    // SPD 2 {6,12} and SPD 4 {3,6,9,12} first share Segment 6.
                    // From Turn 2 Segment 1 the next shared Phase is Turn 2 Segment 6.
                    expect(HeroSystem6eCombatantSingle.nextSharedPhaseAbs(2, 4, abs(2, 1))).to.equal(abs(2, 6));
                    // SPD 2 {6,12} and SPD 3 {4,8,12} only share Segment 12
                    expect(HeroSystem6eCombatantSingle.nextSharedPhaseAbs(2, 3, abs(2, 1))).to.equal(abs(2, 12));
                    expect(HeroSystem6eCombatantSingle.phaseLabel(abs(2, 6))).to.equal("Segment 6 of Turn 2");
                });

                it("Should keep equal-priority ordering stable across combatant re-creation (stableTiebreak)", async function () {
                    const { HeroSystem6eCombatSingle } = await import("../combat-single.mjs");
                    const a = { id: "zzz", tokenId: "tokA", actorId: "actA" };
                    const b = { id: "aaa", tokenId: "tokB", actorId: "actB" };
                    const before = Math.sign(HeroSystem6eCombatSingle.stableTiebreak(a, b));
                    // Re-created combatant gets a fresh id on the OTHER side of b's
                    // ("0aa" < "aaa" < "zzz") — an id-based comparator would flip
                    // the sign here, so only token identity keeps this equal
                    const after = Math.sign(HeroSystem6eCombatSingle.stableTiebreak({ ...a, id: "0aa" }, b));
                    expect(before).to.equal(after);
                });

                it("Should resolve tie-break entries per the Fast Draw setting", async function () {
                    const combat = await makeCombat([await makeActor("_Quench FD Resolver")]);
                    const saved = await getAndSetGameSetting("fastDrawTieBreak", false);
                    try {
                        expect(combat._tieBreakerFraction({ r: 80, fd: null })).to.be.closeTo(0.8, 0.0001);
                        expect(combat._tieBreakerFraction(80)).to.be.closeTo(0.8, 0.0001); // legacy scalar
                        await game.settings.set(game.system.id, "fastDrawTieBreak", true);
                        // Legacy packed entries (fd key present) keep their read-time
                        // interpretation: a Fast Draw owner lands in the upper half
                        expect(combat._tieBreakerFraction({ r: 99, fd: 0 })).to.be.greaterThan(
                            combat._tieBreakerFraction({ r: 99, fd: null }),
                        );
                        expect(combat._tieBreakerFraction({ r: 10, fd: 90 })).to.be.closeTo(0.941, 0.001);

                        // Banded entries (no fd key) read as plain two-decimal rolls
                        // regardless of the setting — Fast Draw lives in the roll bands
                        expect(combat._tieBreakerFraction({ r: 72 })).to.be.closeTo(0.72, 0.0001);
                        const fdOwner = { actor: { items: [{ system: { XMLID: "FAST_DRAW" } }] } };
                        const mundane = { actor: { items: [] } };
                        for (let i = 0; i < 20; i++) {
                            const owner = combat._rollTieBreak(fdOwner);
                            const other = combat._rollTieBreak(mundane);
                            expect(owner.r, "FD owners roll the upper band").to.be.within(50, 99);
                            expect(other.r, "non-owners roll the lower band").to.be.within(0, 49);
                            expect(owner.fd, "banded entries carry no packed fd sub-roll").to.not.exist;
                        }
                        await game.settings.set(game.system.id, "fastDrawTieBreak", false);
                        for (let i = 0; i < 20; i++) {
                            expect(combat._rollTieBreak(fdOwner).r, "setting off: uniform 0-99").to.be.within(0, 99);
                        }
                    } finally {
                        await game.settings.set(game.system.id, "fastDrawTieBreak", saved);
                    }
                });

                it("Should auto-skip a Stunned combatant's Phase when the option is on (#3280)", async function () {
                    const alpha = await makeActor("_Quench Stun Alpha", { dex: 20, spd: 2 });
                    const stunned = await makeActor("_Quench Stunned", { dex: 10, spd: 2 });
                    const savedAutomation = await getAndSetGameSetting("automation", "none");
                    const savedSkip = await getAndSetGameSetting("stunnedAutoSkip", true);
                    try {
                        const combat = await makeCombat([alpha, stunned]);
                        await combat.startCombat();
                        expect(combat.segment).to.equal(12);
                        expect(combat.combatant.actorId).to.equal(alpha.id);

                        await stunned.toggleStatusEffect("stunned", { active: true });
                        expect(stunned.statuses.has("stunned")).to.be.true;

                        // Alpha ends their turn; the pointer lands on the Stunned
                        // combatant and the auto-skip spends that Phase recovering
                        await combat.nextTurn();
                        const recovered = await waitUntil(() => !stunned.statuses.has("stunned"));
                        expect(recovered, "stun cleared by the auto-skipped recovery Phase").to.be.true;
                        const advanced = await waitUntil(
                            () => combat.combatant?.actorId === alpha.id && combat.segment === 6,
                        );
                        expect(advanced, "pointer advanced past the recovery stop to T2S6").to.be.true;
                        expect(combat.round).to.equal(2);
                    } finally {
                        await game.settings.set(game.system.id, "stunnedAutoSkip", savedSkip);
                        await game.settings.set(game.system.id, "automation", savedAutomation);
                    }
                });

                it("Should key every token independently when combat grouping is disabled", async function () {
                    const saved = game.settings.get(game.system.id, "combatTrackerGrouping");
                    try {
                        const actor = await makeActor("_Quench Group Toggle", { dex: 12, spd: 2 });
                        const combat = await makeCombat([actor]);
                        await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id }]);
                        const [one, two] = combat.combatants.filter((c) => c.actorId === actor.id);

                        await game.settings.set(game.system.id, "combatTrackerGrouping", true);
                        expect(combat._tieRollKey(one), "grouping on: members share the actor key").to.equal(
                            combat._tieRollKey(two),
                        );

                        await game.settings.set(game.system.id, "combatTrackerGrouping", false);
                        expect(combat._tieRollKey(one), "grouping off: per-token keys").to.not.equal(
                            combat._tieRollKey(two),
                        );
                        expect(combat._tieRollKey(one)).to.include("solo:");
                    } finally {
                        await game.settings.set(game.system.id, "combatTrackerGrouping", saved);
                    }
                });

                it("Should skip an out-of-turn abort's spent Phase and clear the status after it passes", async function () {
                    const alpha = await makeActor("_Quench Abort Alpha", { dex: 20, spd: 2 });
                    const dodger = await makeActor("_Quench Dodger", { dex: 10, spd: 2 });
                    const savedAutomation = await getAndSetGameSetting("automation", "none");
                    try {
                        const combat = await makeCombat([alpha, dodger]);
                        await combat.startCombat();
                        expect(combat.segment).to.equal(12);
                        expect(combat.combatant.actorId).to.equal(alpha.id);

                        // Dodger aborts out of turn (the dodge-toggle prompt path calls
                        // declareAbort exactly like this). SPD 2 at T1S12: the spent
                        // Phase is THIS segment's
                        const dodgerCombatant = combatantFor(combat, dodger);
                        const applied = await combat.declareAbort(dodgerCombatant, { toAction: "Dodge" });
                        expect(applied, "abort declared").to.be.true;
                        expect(dodger.statuses.has("aborted")).to.be.true;
                        expect(dodgerCombatant.abortSpentAbs, "spent Phase is this segment's").to.equal(abs(1, 12));

                        // Alpha ends their turn: the dodger's Phase this segment is the
                        // spent one — the pointer must NOT land on them
                        await combat.nextTurn();
                        const skipped = await waitUntil(
                            () => combat.combatant?.actorId === alpha.id && combat.segment === 6,
                        );
                        expect(skipped, "advance skipped the aborted Phase to T2S6").to.be.true;
                        expect(combat.round).to.equal(2);

                        // The spent segment has passed: boundary maintenance clears the status
                        const cleared = await waitUntil(() => !dodger.statuses.has("aborted"));
                        expect(cleared, "aborted status cleared once the spent Phase passed").to.be.true;
                    } finally {
                        await game.settings.set(game.system.id, "automation", savedAutomation);
                    }
                });

                it("Should honor the opening tie rolls: startCombat's pointer and threshold match live scoring", async function () {
                    const a = await makeActor("_Quench Open Tie A", { dex: 20, spd: 2 });
                    const b = await makeActor("_Quench Open Tie B", { dex: 20, spd: 2 });
                    const combat = await makeCombat([a, b]);
                    await combat.startCombat();

                    const startAbs = abs(1, 12);
                    // The committed pointer must be the live-sorted leader, and the
                    // stored threshold must equal the leader's live priority — a
                    // rolls-blind start scores both at the 0.50 default instead
                    const active = combat.combatant;
                    expect(active, "an active combatant was selected").to.exist;
                    for (const c of combat.combatants) {
                        const live = combat.getInitiativePriority(c, 12, { queryAbs: startAbs });
                        expect(c.initiative, `${c.name} persisted initiative matches live scoring`).to.equal(live);
                    }
                    const leader = [...combat.combatants].sort(
                        (x, y) =>
                            combat.getInitiativePriority(y, 12, { queryAbs: startAbs }) -
                            combat.getInitiativePriority(x, 12, { queryAbs: startAbs }),
                    )[0];
                    expect(active.id, "pointer sits on the tie-roll leader").to.equal(leader.id);
                    expect(combat.getFlag(game.system.id, "actingPriority"), "threshold matches the leader").to.equal(
                        combat.getInitiativePriority(leader, 12, { queryAbs: startAbs }),
                    );
                });

                it("Should prune segment-roll maps outside the two-Turn rewind window", async function () {
                    const a = await makeActor("_Quench Prune A", { dex: 20, spd: 2 });
                    const b = await makeActor("_Quench Prune B", { dex: 10, spd: 2 });
                    const combat = await makeCombat([a, b]);
                    await combat.startCombat();
                    expect(combat.getFlag(game.system.id, "segmentRolls")?.[24], "opening map exists").to.exist;

                    // Jump three full Turns (abs 24 → 60), then one cross-segment
                    // advance so the prune runs with the opening map far outside
                    // the currentAbs - 24 window
                    await combat.nextRound();
                    await combat.nextRound();
                    await combat.nextRound();
                    // Both actors act in Segment 12: the first advance is within the
                    // segment, the second crosses out of it and runs the prune
                    await combat.nextTurn();
                    await combat.nextTurn();
                    const pruned = await waitUntil(() => {
                        const rolls = combat.getFlag(game.system.id, "segmentRolls") ?? {};
                        return rolls["24"] === undefined && rolls[24] === undefined;
                    });
                    expect(pruned, "the opening abs-24 roll map was deleted from the flag").to.be.true;
                });

                it("Should adopt a bare aborted status into the declaration instead of bailing", async function () {
                    const alpha = await makeActor("_Quench Adopt Alpha", { dex: 20, spd: 2 });
                    const marked = await makeActor("_Quench Bare Aborted", { dex: 10, spd: 2 });
                    const savedAutomation = await getAndSetGameSetting("automation", "none");
                    try {
                        const combat = await makeCombat([alpha, marked]);
                        await combat.startCombat();

                        // A raw status toggle (stale effect / token HUD without the hook)
                        // leaves an unrecorded abort that binds at every segment and never
                        // clears — declaration must adopt it, not bail
                        await marked.toggleStatusEffect("aborted", { active: true });
                        const markedCombatant = combatantFor(combat, marked);
                        expect(markedCombatant.abortEffect?.getFlag(game.system.id, "abort")).to.not.exist;

                        const applied = await combat.declareAbort(markedCombatant, { toAction: "Dodge" });
                        expect(applied, "declaration adopts the bare status").to.be.true;
                        const abortedEffects = marked.effects.filter((e) => e.statuses.has("aborted"));
                        expect(abortedEffects.length, "adopted, not duplicated").to.equal(1);
                        expect(abortedEffects[0].getFlag(game.system.id, "abort")?.spentAbs).to.equal(24);

                        // And the normal lifecycle completes: skip, then clear
                        await combat.nextTurn();
                        const cleared = await waitUntil(() => !marked.statuses.has("aborted"));
                        expect(cleared, "adopted abort cleared once its spent Phase passed").to.be.true;
                    } finally {
                        await game.settings.set(game.system.id, "automation", savedAutomation);
                    }
                });

                it("Should create combatants hidden for invisible actors, explicit hidden wins (#4466)", async function () {
                    const ghost = await makeActor("_Quench Ghost", { dex: 10, spd: 2 });
                    await ghost.toggleStatusEffect("invisible", { active: true });
                    try {
                        const combat = await makeCombat([ghost]);
                        const auto = combatantFor(combat, ghost);
                        expect(auto.hidden, "invisible actor's combatant starts hidden").to.be.true;

                        // An explicit hidden value in the creation data wins
                        const [explicit] = await combat.createEmbeddedDocuments("Combatant", [
                            { actorId: ghost.id, hidden: false },
                        ]);
                        expect(explicit.hidden, "explicit hidden:false is respected").to.be.false;
                    } finally {
                        await ghost.toggleStatusEffect("invisible", { active: false });
                    }
                });

                it("Should key tie-break rolls by absolute segment and re-roll them for a new Turn", async function () {
                    const one = await makeActor("_Quench Tie One", { dex: 15, spd: 2 });
                    const two = await makeActor("_Quench Tie Two", { dex: 15, spd: 2 });
                    const combat = await makeCombat([one, two]);
                    await combat.startCombat();

                    const startRolls = combat.getFlag(game.system.id, "segmentRolls");
                    expect(startRolls, "rolls keyed by combat-start abs 24").to.have.property("24");
                    const entry = startRolls["24"][one.id];
                    expect(entry, "entry carries the banded {r} shape").to.have.property("r");
                    expect(entry.fd, "banded entries carry no packed fd sub-roll").to.not.exist;

                    // A full-Turn skip lands on a NEW absolute segment with fresh rolls
                    await combat.nextRound();
                    const roundRolls = combat.getFlag(game.system.id, "segmentRolls");
                    expect(roundRolls, "fresh rolls for Turn 2 Segment 12 (abs 36)").to.have.property("36");
                });

                it("Should bind holds to the declaring combatant, not the shared actor", async function () {
                    const actor = await makeActor("_Quench Linked Holder", { dex: 14, spd: 3 });
                    const bystander = await makeActor("_Quench Bystander", { dex: 8, spd: 2 });
                    const combat = await makeCombat([actor, bystander]);
                    // A second combatant of the SAME actor (linked-token scenario)
                    await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id }]);
                    const [memberOne, memberTwo] = combat.combatants.filter((c) => c.actorId === actor.id);
                    await combat.startCombat();

                    await actor.toggleStatusEffect("holding", { active: true });
                    const effect = actor.effects.find((e) => e.statuses.has("holding"));
                    await effect.setFlag(game.system.id, "hold", {
                        mode: "generic",
                        declaredAbs: 24,
                        id: foundry.utils.randomID(),
                        combatantId: memberOne.id,
                    });

                    expect(memberOne.heldAction, "declaring member holds").to.not.equal(null);
                    expect(memberTwo.heldAction, "sibling member does NOT hold").to.equal(null);
                    expect(
                        combat._takesTurnInSegment(memberTwo, combat.segment),
                        "sibling still takes their natural turn",
                    ).to.be.true;
                    await effect.delete();
                });

                it("Should honor a declared decimal fraction and clear the slot marker on spend", async function () {
                    const holder = await makeActor("_Quench Pinned Holder", { dex: 20, spd: 3 });
                    const pacer = await makeActor("_Quench Pacer", { dex: 10, spd: 2 });
                    const combat = await makeCombat([holder, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, holder);
                    const currentAbs = combat.round * 12 + combat.segment;

                    await holder.toggleStatusEffect("holding", { active: true });
                    const effect = holder.effects.find((e) => e.statuses.has("holding"));
                    await effect.setFlag(game.system.id, "hold", {
                        mode: "position",
                        segmentAbs: currentAbs,
                        dex: 13,
                        fraction: 0.12,
                        declaredAbs: currentAbs,
                        id: foundry.utils.randomID(),
                        combatantId: combatant.id,
                    });
                    expect(
                        combat.getInitiativePriority(combatant, combat.segment),
                        "declared decimal pins the exact position",
                    ).to.be.closeTo(13.12, 0.0001);

                    await combatant.setFlag(game.system.id, "heldSlotTakenAbs", currentAbs);
                    await combat._spendHold(combatant, { used: true });
                    expect(combatant.getFlag(game.system.id, "heldSlotTakenAbs"), "slot marker cleared").to.equal(null);
                    const spent = combatant.getFlag(game.system.id, "spentHoldPosition");
                    expect(spent?.fraction, "spent record keeps the pinned fraction").to.be.closeTo(0.12, 0.0001);
                });

                it("Should demote an unused passed positional hold instead of forfeiting it", async function () {
                    const holder = await makeActor("_Quench Demoted Holder", { dex: 18, spd: 6 });
                    const pacer = await makeActor("_Quench Demote Pacer", { dex: 10, spd: 12 });
                    const combat = await makeCombat([holder, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, holder);
                    const currentAbs = combat.round * 12 + combat.segment;

                    await holder.toggleStatusEffect("holding", { active: true });
                    const effect = holder.effects.find((e) => e.statuses.has("holding"));
                    // The declared slot is already behind the pointer and was never taken
                    await effect.setFlag(game.system.id, "hold", {
                        mode: "position",
                        segmentAbs: currentAbs - 1,
                        dex: 5,
                        declaredAbs: currentAbs - 1,
                        id: foundry.utils.randomID(),
                        combatantId: combatant.id,
                    });

                    await combat._demotePassedPositionalHolds();
                    const hold = combatant.heldAction;
                    expect(hold?.mode, "banked Phase persists as a generic hold").to.equal("generic");
                    expect(hold?.demotedFrom?.dex, "demotion records the lost slot").to.equal(5);
                    // The stale position keys must actually be deleted (ForcedDeletion
                    // writes), or the generic hold would still read as positional
                    expect(hold?.segmentAbs, "stale segmentAbs removed by the demotion").to.equal(undefined);
                    expect(hold?.dex, "stale dex slot removed by the demotion").to.equal(undefined);
                    await combatant.heldActionEffect?.delete();
                });

                it("Should append ledger events and rebuild past-segment history rows", async function () {
                    const actor = await makeActor("_Quench Chronicler", { dex: 12, spd: 2 });
                    const combat = await makeCombat([actor]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, actor);

                    // startCombat itself ledgers segment.start + turn.start at abs 24
                    const log = combat.getEventLog();
                    expect(log.length, "combat start is ledgered").to.be.greaterThan(0);
                    expect(log.some((e) => e.t === "turn.start" && e.abs === 24)).to.be.true;

                    await combat.logEvent("hold.use", { combatant, data: { mode: "generic" } });
                    const holdEvents = combat.getEventLog({ types: ["hold.use"] });
                    expect(holdEvents.length).to.equal(1);
                    expect(holdEvents[0].name).to.include("Chronicler");

                    const rows = combat.historyRowsForSegment(24);
                    expect(rows, "history rows assemble for the recorded segment").to.not.equal(null);
                    expect(rows[0].kind, "the hold.use outranks the plain turn.start row").to.equal("held-used");
                });

                it("Should de-duplicate a mid-combat duplicate add and backfill newcomer tie rolls", async function () {
                    const one = await makeActor("_Quench Dupe One", { dex: 15, spd: 2 });
                    const two = await makeActor("_Quench Dupe Two", { dex: 12, spd: 2 });
                    const combat = await makeCombat([one, two]);
                    await combat.startCombat();

                    // Duplicate add of an existing tokenless actor is removed
                    await combat.createEmbeddedDocuments("Combatant", [{ actorId: one.id }]);
                    const deduped = await waitUntil(
                        () => combat.combatants.filter((c) => c.actorId === one.id).length === 1,
                    );
                    expect(deduped, "duplicate combatant removed").to.be.true;

                    // A brand-new actor gets a backfilled roll for the already-visited abs
                    const three = await makeActor("_Quench Dupe Three", { dex: 15, spd: 2 });
                    await combat.createEmbeddedDocuments("Combatant", [{ actorId: three.id }]);
                    const backfilled = await waitUntil(
                        () => combat.getFlag(game.system.id, "segmentRolls")?.["24"]?.[three.id] !== undefined,
                    );
                    expect(backfilled, "newcomer tie roll backfilled (no +0.50 default)").to.be.true;

                    // The seeded SPD baseline is the OBJECT shape: a scalar would
                    // normalize source=effective and trip a bogus adjustment lockout
                    const newcomer = combatantFor(combat, three);
                    const seeded = await waitUntil(() => newcomer.getFlag(game.system.id, "knownSpd") !== undefined);
                    expect(seeded).to.be.true;
                    const known = newcomer.getFlag(game.system.id, "knownSpd");
                    expect(known, "knownSpd seeded as {effective, source}").to.be.an("object");
                    expect(known.source, "source reads the sheet SPD").to.equal(2);
                });

                it("Should adopt a bare token-HUD holding effect instead of stacking a duplicate", async function () {
                    const holder = await makeActor("_Quench Hold Adopter", { dex: 12, spd: 2 });
                    const combat = await makeCombat([holder]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, holder);

                    // A bare token-HUD toggle: holding status with no combatantId binding
                    await holder.toggleStatusEffect("holding", { active: true });

                    // Declaring through the tracker adopts the orphan rather than
                    // creating a parallel effect no flow could ever consume
                    await ui.combat._applyHoldingEffect(combatant, {
                        mode: "generic",
                        id: foundry.utils.randomID(),
                        combatantId: combatant.id,
                        declaredAbs: combat.round * 12 + combat.segment,
                    });
                    const holdingEffects = holder.effects.filter((e) => e.statuses.has("holding"));
                    expect(holdingEffects.length, "no parallel duplicate effect").to.equal(1);
                    expect(combatant.heldAction?.mode, "the adopted effect binds to the declarer").to.equal("generic");
                });

                it("Should defer a voluntary SPD edit to Post-Segment 12 and allow the GM to apply it early", async function () {
                    const changer = await makeActor("_Quench Voluntary SPD", { dex: 12, spd: 2 });
                    const pacer = await makeActor("_Quench SPD Pacer", { dex: 20, spd: 12 });
                    const combat = await makeCombat([changer, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, changer);

                    // First boundary seeds the {effective, source} baseline
                    await combat.nextTurn();
                    await combat.nextTurn();
                    const seeded = await waitUntil(() => combatant.getFlag(game.system.id, "knownSpd") !== undefined);
                    expect(seeded, "SPD baseline seeded at a boundary").to.be.true;

                    // A sheet edit is a VOLUNTARY change: deferred, old SPD still governs
                    await changer.update({ "system.characteristics.spd.value": 6 });
                    await combat.nextTurn();
                    const deferred = await waitUntil(() => !!combatant.getFlag(game.system.id, "pendingSpd"));
                    expect(deferred, "voluntary change deferred via pendingSpd").to.be.true;
                    expect(combatant.combatSpd, "still acts at the old SPD meanwhile").to.equal(2);

                    // GM fiat applies it immediately, with the normal lockout
                    await combat.applyPendingSpdNow(combatant.id);
                    expect(combatant.getFlag(game.system.id, "pendingSpd")).to.equal(null);
                    expect(combatant.combatSpd, "new SPD in force after the override").to.equal(6);
                });

                it("Should not lock out a 5e combatant whose DEX is drained (figured SPD insulation)", async function () {
                    const insulated = await makeActor("_Quench 5e DEX Drained", {
                        dex: 20,
                        spd: 4,
                        extra: { is5e: true },
                    });
                    const pacer = await makeActor("_Quench 5e Insulation Pacer", { dex: 10, spd: 12 });
                    const combat = await makeCombat([insulated, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, insulated);

                    await combat.nextTurn();
                    await combat.nextTurn();
                    const seeded = await waitUntil(() => combatant.getFlag(game.system.id, "knownSpd") !== undefined);
                    expect(seeded, "SPD baseline seeded at a boundary").to.be.true;

                    // 5ER p. 105: adjustments to a primary never move figured characteristics —
                    // the Transfer example drains DEX "but loses no SPD"
                    await insulated.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Drain DEX",
                            flags: { [game.system.id]: { type: "adjustment", adjustmentActivePoints: 30 } },
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "-10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        },
                    ]);
                    expect(insulated.system.characteristics.dex.value, "the drain itself landed").to.equal(10);
                    expect(combatant.combatSpd, "figured SPD is insulated from the DEX drain").to.equal(4);

                    // Cross two boundaries: a bogus cascade would be detected here
                    await combat.nextTurn();
                    await combat.nextTurn();
                    expect(combatant.getFlag(game.system.id, "spdLockout"), "no SPD-change lockout").to.not.be.ok;
                    expect(combatant.getFlag(game.system.id, "pendingSpd"), "no deferred SPD change").to.not.be.ok;
                    expect(combatant.combatSpd, "SPD still 4 after the boundaries").to.equal(4);
                });

                it("Should apply the 5e shared-Phase lockout when SPD itself is drained", async function () {
                    const drained = await makeActor("_Quench 5e SPD Drained", {
                        dex: 20,
                        spd: 3,
                        extra: { is5e: true },
                    });
                    const pacer = await makeActor("_Quench 5e Drain Pacer", { dex: 10, spd: 12 });
                    const combat = await makeCombat([drained, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, drained);

                    await combat.nextTurn();
                    await combat.nextTurn(); // Round 2 Segment 1: baseline seeded
                    const seeded = await waitUntil(() => combatant.getFlag(game.system.id, "knownSpd") !== undefined);
                    expect(seeded, "SPD baseline seeded at a boundary").to.be.true;

                    // A DRAIN SPD manifests as an adjustment-flagged effect on the max; the
                    // sheet (source) value stays put, so detection must read adjustment-driven
                    await drained.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Drain SPD",
                            flags: { [game.system.id]: { type: "adjustment", adjustmentActivePoints: 10 } },
                            changes: [
                                {
                                    key: "system.characteristics.spd.max",
                                    value: "-1",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        },
                    ]);
                    expect(combatant.combatSpd, "drain lowers the effective SPD").to.equal(2);
                    expect(drained._source.system.characteristics.spd.value, "sheet SPD untouched").to.equal(3);

                    await combat.nextTurn(); // boundary detects the effective-only change
                    const locked = await waitUntil(() => !!combatant.getFlag(game.system.id, "spdLockout"));
                    expect(locked, "adjustment-driven change applies the mandatory lockout").to.be.true;
                    expect(combatant.getFlag(game.system.id, "pendingSpd"), "not deferred as voluntary").to.not.be.ok;

                    // SPD 3 {4,8,12} and SPD 2 {6,12} share only Segment 12
                    const lockout = combatant.getFlag(game.system.id, "spdLockout");
                    expect(lockout.lockoutEndAbs, "5e lockout runs to the next shared Phase").to.equal(abs(2, 12));
                });

                it("Should treat a 5e DEX purchase that raises figured SPD as a voluntary SPD change", async function () {
                    const grower = await makeActor("_Quench 5e DEX Grower", { dex: 10, spd: 2, extra: { is5e: true } });
                    const pacer = await makeActor("_Quench 5e Growth Pacer", { dex: 20, spd: 12 });
                    const combat = await makeCombat([grower, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, grower);

                    await combat.nextTurn();
                    await combat.nextTurn();
                    const seeded = await waitUntil(() => combatant.getFlag(game.system.id, "knownSpd") !== undefined);
                    expect(seeded, "SPD baseline seeded at a boundary").to.be.true;

                    // Buying DEX up to 20 refigures SPD to 3 through the persistence path:
                    // sheet and effective SPD move together, so the tracker must classify
                    // the change as voluntary and defer it to Post-Segment 12
                    await grower.update({ "system.DEX.LEVELS": 10 });
                    expect(grower._source.system.characteristics.dex.value, "DEX purchase persisted").to.equal(20);
                    expect(
                        grower._source.system.characteristics.spd.value,
                        "figured SPD cascaded into the source",
                    ).to.equal(3);

                    await combat.nextTurn();
                    const deferred = await waitUntil(() => !!combatant.getFlag(game.system.id, "pendingSpd"));
                    expect(deferred, "cascaded figured change deferred via pendingSpd").to.be.true;
                    expect(combatant.getFlag(game.system.id, "spdLockout"), "no adjustment lockout for a purchase").to
                        .not.be.ok;
                    expect(combatant.combatSpd, "still acts at the old SPD meanwhile").to.equal(2);

                    await combat.applyPendingSpdNow(combatant.id);
                    expect(combatant.getFlag(game.system.id, "pendingSpd")).to.equal(null);
                    expect(combatant.combatSpd, "new figured SPD in force after the override").to.equal(3);
                });

                it("Should schedule a Haymaker landing and resolve it after its segment passes", async function () {
                    const bruiser = await makeActor("_Quench Haymaker", { dex: 12, spd: 12 });
                    const combat = await makeCombat([bruiser]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, bruiser);
                    const currentAbs = combat.round * 12 + combat.segment;

                    const scheduled = await combat.scheduleHaymaker(bruiser);
                    expect(scheduled).to.be.true;
                    const [, record] = combat.delayedActionsFor(combatant, "haymaker")[0] ?? [];
                    expect(record?.resolveAbs, "lands at the very end of the NEXT segment").to.equal(currentAbs + 1);

                    // Advancing lands ON the landing stop (a real pointer stop). The
                    // SPD 12 declarer's own Segment 1 Phase is consumed by the
                    // wind-up (6E2 69 High-SPD Haymakers), so the stop is the only
                    // thing in the landing segment.
                    await combat.nextTurn(); // onto the landing stop
                    expect(combat.atDelayedLandingStop, "the landing is a real pointer stop").to.be.true;
                    expect(
                        combat._takesTurnInSegment(combatant, 1, { queryAbs: currentAbs + 1 }),
                        "wind-up consumes the declarer's natural Phase in the landing segment",
                    ).to.be.false;
                    await combat.nextTurn(); // past it — leaving the stop cleans the record up
                    const resolved = await waitUntil(() => !combat.hasDelayedAction(combatant, "haymaker"));
                    expect(resolved, "wind-up resolved once its segment fully passed").to.be.true;
                });

                it("Should return the high-SPD declarer's consumed Phase when the Haymaker is cancelled", async function () {
                    const bruiser = await makeActor("_Quench HM Cancel", { dex: 12, spd: 12 });
                    const combat = await makeCombat([bruiser]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, bruiser);
                    const currentAbs = combat.round * 12 + combat.segment;

                    await combat.scheduleHaymaker(bruiser);
                    expect(
                        combat._takesTurnInSegment(combatant, 1, { queryAbs: currentAbs + 1 }),
                        "wind-up consumes the landing segment's Phase",
                    ).to.be.false;

                    await combat.cancelHaymaker(combatant.id);
                    expect(combat.hasDelayedAction(combatant, "haymaker")).to.be.false;
                    expect(
                        combat._takesTurnInSegment(combatant, 1, { queryAbs: currentAbs + 1 }),
                        "cancelling the Haymaker returns the Phase",
                    ).to.be.true;
                });

                it("Should keep a pending Haymaker across a forward-and-back segment step", async function () {
                    const pacer = await makeActor("_Quench HMR Pacer", { dex: 20, spd: 12 });
                    const bruiser = await makeActor("_Quench HMR Bruiser", { dex: 12, spd: 4 });
                    const tail = await makeActor("_Quench HMR Tail", { dex: 5, spd: 12 });
                    const combat = await makeCombat([pacer, bruiser, tail]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, bruiser);

                    // Declared during the bruiser's own Segment 12 stop
                    await combat.nextTurn(); // pacer (20) → bruiser (12)
                    expect(combat.combatant.actorId).to.equal(bruiser.id);
                    await combat.scheduleHaymaker(bruiser);
                    expect(combat.hasDelayedAction(combatant, "haymaker")).to.be.true;

                    await combat.nextTurn(); // tail (5)
                    await combat.nextTurn(); // Segment 1 (pacer)
                    expect(combat.segment).to.equal(1);
                    expect(combat.hasDelayedAction(combatant, "haymaker"), "wind-up survives the advance").to.be.true;

                    // Stepping back lands on Segment 12's LAST stop (the tail) — the
                    // declaration happened at an earlier stop and must survive
                    await combat.previousTurn();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId).to.equal(tail.id);
                    expect(combat.hasDelayedAction(combatant, "haymaker"), "wind-up survives stepping back past it").to
                        .be.true;

                    // One more step re-opens the DECLARER'S stop: now it un-declares
                    await combat.previousTurn();
                    expect(combat.combatant.actorId).to.equal(bruiser.id);
                    expect(
                        combat.hasDelayedAction(combatant, "haymaker"),
                        "re-opening the declaration stop undoes the declaration",
                    ).to.be.false;
                });

                it("Should cancel a wound-up Haymaker when the attacker is Stunned", async function () {
                    const bruiser = await makeActor("_Quench HM Stunned", { dex: 12, spd: 4 });
                    const combat = await makeCombat([bruiser]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, bruiser);

                    await combat.scheduleHaymaker(bruiser);
                    expect(combat.hasDelayedAction(combatant, "haymaker")).to.be.true;

                    // 6E2 69 / 5ER 389: Stunned before the landing ruins the Haymaker
                    await bruiser.toggleStatusEffect("stunned", { active: true });
                    const cancelled = await waitUntil(() => !combat.hasDelayedAction(combatant, "haymaker"));
                    expect(cancelled, "Stunned before the landing ruins the Haymaker").to.be.true;
                });

                it("Should grant the KO'd per-Phase free Recovery when Skip Defeated skips their Phase", async function () {
                    const sleeper = await makeActor("_Quench KO Skipped", { dex: 10, spd: 4 });
                    const pacer = await makeActor("_Quench KO Pacer", { dex: 20, spd: 12 });
                    const combat = await makeCombat([sleeper, pacer]);
                    const combatant = combatantFor(combat, sleeper);

                    // Deep enough to stay KO'd through the first Recovery, inside the
                    // every-Phase band (>= -10)
                    await sleeper.update({ "system.characteristics.stun.value": -5 });
                    await sleeper.createEmbeddedDocuments("ActiveEffect", [
                        { name: "Knocked Out", img: "icons/svg/unconscious.svg", statuses: ["knockedOut"] },
                    ]);

                    const coreConfig = game.settings.get("core", Combat.CONFIG_SETTING);
                    const savedSkipDefeated = coreConfig?.skipDefeated;
                    await game.settings.set("core", Combat.CONFIG_SETTING, { ...coreConfig, skipDefeated: true });
                    try {
                        await combat.startCombat();
                        // Skip Defeated: the KO'd sleeper never becomes the active combatant
                        expect(combat.combatant.actorId).to.equal(pacer.id);

                        // Leaving Segment 12 sweeps the sleeper's skipped Phase there
                        await combat.nextTurn();
                        expect(combat.segment).to.equal(1);
                        const granted = await waitUntil(
                            () => combatant.getFlag(game.system.id, "koRecoveredAbs") === abs(1, 12),
                        );
                        expect(granted, "skipped Phase in Segment 12 granted the free Recovery").to.be.true;
                        const stunAfter = sleeper.system.characteristics.stun.value;
                        expect(stunAfter, "REC applied to the negative STUN total").to.be.greaterThan(-5);
                    } finally {
                        await game.settings.set("core", Combat.CONFIG_SETTING, {
                            ...game.settings.get("core", Combat.CONFIG_SETTING),
                            skipDefeated: savedSkipDefeated,
                        });
                    }
                });

                it("Should re-fire the landing stop after rewinding off it", async function () {
                    const bruiser = await makeActor("_Quench HM Refire", { dex: 12, spd: 12 });
                    const tail = await makeActor("_Quench HM Refire Tail", { dex: 5, spd: 12 });
                    const combat = await makeCombat([bruiser, tail]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, bruiser);

                    await combat.scheduleHaymaker(bruiser); // declared at the bruiser's Segment 12 stop
                    await combat.nextTurn(); // tail
                    await combat.nextTurn(); // Segment 1: tail's Phase (bruiser's is consumed by the wind-up)
                    expect(combat.segment).to.equal(1);
                    expect(combat.combatant.actorId).to.equal(tail.id);

                    await combat.nextTurn(); // the landing stop
                    expect(combat.atDelayedLandingStop, "landing stop reached").to.be.true;
                    const landedOnce = await waitUntil(
                        () => combat.delayedActionsFor(combatant, "haymaker")[0]?.[1]?.landed === true,
                    );
                    expect(landedOnce, "the stop fired and kept the record").to.be.true;

                    // Rewinding off the stop un-lands the record and re-opens the
                    // segment's last real stop
                    await combat.previousTurn();
                    expect(combat.atDelayedLandingStop).to.be.false;
                    expect(combat.combatant.actorId).to.equal(tail.id);
                    const record = combat.delayedActionsFor(combatant, "haymaker")[0]?.[1];
                    expect(record, "record survives the rewind").to.exist;
                    expect(record.landed, "record un-landed for the replay").to.be.false;

                    // The replay re-fires the stop, then leaving cleans the record up
                    await combat.nextTurn();
                    expect(combat.atDelayedLandingStop, "landing stop re-fires on replay").to.be.true;
                    await combat.nextTurn();
                    const cleaned = await waitUntil(() => !combat.hasDelayedAction(combatant, "haymaker"));
                    expect(cleaned, "record cleaned up once the landing segment is left").to.be.true;
                });

                it("Should advance to the next populated segment when a deletion empties the current one", async function () {
                    const walker = await makeActor("_Quench Del Walker", { dex: 20, spd: 3 });
                    const loner = await makeActor("_Quench Del Loner", { dex: 10, spd: 2 });
                    const combat = await makeCombat([walker, loner]);
                    await combat.startCombat();

                    // Segment 12 (both) → Segment 4 is the walker's alone (SPD 3: 4/8/12)
                    await combat.nextTurn(); // loner's Segment 12 stop
                    await combat.nextTurn(); // Segment 4: walker only
                    expect(combat.segment).to.equal(4);
                    expect(combat.combatant.actorId).to.equal(walker.id);

                    // Deleting the segment's only combatant advances to Segment 6 (loner)
                    await combat.deleteEmbeddedDocuments("Combatant", [combatantFor(combat, walker).id]);
                    const advanced = await waitUntil(
                        () => combat.segment === 6 && combat.combatant?.actorId === loner.id,
                    );
                    expect(advanced, "pointer advanced to the next populated segment").to.be.true;
                });

                it("Should shuffle group members per segment and split one out on demand", async function () {
                    const boss = await makeActor("_Quench Group Boss", { dex: 14, spd: 2 });
                    const combat = await makeCombat([boss]);
                    // Two more combatants of the same actor: a ×3 group
                    await combat.createEmbeddedDocuments("Combatant", [{ actorId: boss.id }, { actorId: boss.id }]);
                    const members = combat.combatants.filter((c) => c.actorId === boss.id);
                    await combat.startCombat();

                    // One shared roll entry with a per-member sub-roll for each token
                    const rolls = combat.getFlag(game.system.id, "segmentRolls")["24"];
                    const entry = rolls[boss.id];
                    expect(Object.keys(entry.m ?? {}).length, "one sub-roll per member").to.equal(3);

                    // Order within the group follows the sub-rolls, highest first
                    const sorted = [...members].sort((a, b) => combat.tieBreakOrder(a, b, 24));
                    const subs = sorted.map((c) => entry.m[c.tokenId || c.id]);
                    const descending = subs.every((v, i) => i === 0 || subs[i - 1] >= v);
                    expect(descending, "sub-rolls order the group, highest first").to.be.true;

                    // Split one member out: own roll key, backfilled into recorded maps
                    const split = members[0];
                    await combat.setCombatantSoloTieRoll(split.id, true);
                    expect(split.getFlag(game.system.id, "soloTieRoll")).to.be.true;
                    const soloKey = `solo:${split.tokenId || split.id}`;
                    const rollsAfter = combat.getFlag(game.system.id, "segmentRolls")["24"];
                    expect(rollsAfter[soloKey], "solo roll backfilled for the visited segment").to.not.equal(undefined);
                    expect(combat._tieRollKey(split)).to.equal(soloKey);

                    // Rejoining restores the shared key (and with it, the grouping)
                    await combat.setCombatantSoloTieRoll(split.id, false);
                    expect(combat._tieRollKey(split)).to.equal(boss.id);
                });

                it("Should classify Extra Time options and resolve delayed actions", async function () {
                    const { HeroSystem6eCombatantSingle } = await import("../combatant-single.mjs");
                    const caster = await makeActor("_Quench Extra Time", { dex: 16, spd: 3 });
                    const pacer = await makeActor("_Quench ET Pacer", { dex: 10, spd: 12 });
                    const combat = await makeCombat([caster, pacer]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, caster);
                    const currentAbs = combat.round * 12 + combat.segment;

                    // Classification reads the item's EXTRATIME modifier: a duck item
                    // suffices for the plan
                    const et = (OPTIONID, OPTION_ALIAS) => ({
                        name: "Delayed Blast",
                        findModsByXmlid: (x) => (x === "EXTRATIME" ? { OPTIONID, OPTION_ALIAS } : null),
                    });
                    const segmentPlan = combat.extraTimePlan(caster, et("SEGMENT", "Extra Segment"));
                    expect(segmentPlan.resolveAbs, "Extra Segment: end of the NEXT segment").to.equal(currentAbs + 1);
                    expect(segmentPlan.priority, "…after everyone (no position)").to.equal(null);

                    const delayedPlan = combat.extraTimePlan(caster, et("DELAYEDPHASE", "Delayed Phase"));
                    expect(delayedPlan.resolveAbs, "Delayed Phase: same segment").to.equal(currentAbs);
                    expect(delayedPlan.priority, "…at HALF the character's DEX").to.equal(8);

                    const extraPhasePlan = combat.extraTimePlan(caster, et("EXTRA", "Extra Phase"));
                    expect(extraPhasePlan.commit, "Extra Phase: no other Actions meanwhile").to.be.true;
                    expect(extraPhasePlan.resolveAbs, "…activates on their NEXT Phase (SPD 3)").to.equal(
                        HeroSystem6eCombatantSingle.nextPhaseAbs(3, currentAbs + 1),
                    );

                    expect(
                        combat.extraTimePlan(caster, et("FULL", "Full Phase")),
                        "Full Phase: nothing to schedule",
                    ).to.equal(null);

                    // Commit blocks other tracker-mediated actions until it goes off
                    const commitId = await combat.scheduleDelayedAction(caster, extraPhasePlan);
                    expect(combat.blockedActionReason(combatant), "committed: no other Actions").to.include(
                        "no other Actions",
                    );
                    await combat.cancelDelayedAction(combatant.id, commitId);
                    expect(combat.blockedActionReason(combatant), "cancel releases the commitment").to.equal(null);

                    // An Extra Segment record gets a real end-of-segment landing
                    // stop, then cleans up once the segment is left
                    await combat.scheduleDelayedAction(caster, segmentPlan);
                    expect(combat.hasDelayedAction(combatant)).to.be.true;
                    await combat.nextTurn(); // pacer, still Segment 12
                    await combat.nextTurn(); // Segment 1 (pacer only)
                    await combat.nextTurn(); // the end-of-segment landing stop
                    expect(combat.atDelayedLandingStop, "the landing is a real pointer stop").to.be.true;
                    await combat.nextTurn(); // Segment 2 — leaving the stop cleans up
                    const resolved = await waitUntil(() => !combat.hasDelayedAction(combatant));
                    expect(resolved, "delayed action resolved after its segment ended").to.be.true;
                });

                it("Should consume the segment's natural Phase when a positional hold is spent off-slot", async function () {
                    const holder = await makeActor("_Quench OffSlot Holder", { dex: 8, spd: 2 });
                    const pacer = await makeActor("_Quench OffSlot Pacer", { dex: 25, spd: 12 });
                    const combat = await makeCombat([holder, pacer]);
                    await combat.startCombat();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId).to.equal(pacer.id);
                    const holderCombatant = combatantFor(combat, holder);
                    const pacerCombatant = combatantFor(combat, pacer);

                    // The holder banked a Phase for Turn 2 Segment 3, then aborts NOW
                    // (T1S12, before their natural DEX 8 Phase comes up)
                    await holder.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Holding An Action",
                            img: "icons/svg/clockwork.svg",
                            statuses: ["holding"],
                            flags: {
                                [game.system.id]: {
                                    hold: {
                                        mode: "position",
                                        segmentAbs: abs(2, 3),
                                        dex: 12,
                                        combatantId: holderCombatant.id,
                                    },
                                },
                            },
                        },
                    ]);
                    const applied = await combat.declareAbort(holderCombatant, { toAction: "Dodge" });
                    expect(applied).to.be.true;
                    expect(holder.statuses.has("holding"), "hold consumed by the abort").to.be.false;
                    expect(holder.statuses.has("aborted"), "held Phase absorbs the abort").to.be.false;

                    // Spent OFF the declared slot: the acted position is recorded at the
                    // natural Phase so the holder cannot act twice this segment
                    const spent = holderCombatant.spentHoldPosition;
                    expect(spent?.segmentAbs, "recorded in the segment it was spent").to.equal(24);
                    expect(spent?.dex, "recorded at the natural Phase position").to.equal(8);
                    expect(combat._takesTurnInSegment(holderCombatant, 12), "no second action").to.be.false;
                    await combat.nextTurn();
                    expect(combat.round, "the natural DEX 8 Phase is skipped").to.equal(2);
                    expect(combat.segment).to.equal(1);
                    expect(combat.combatant.actorId).to.equal(pacer.id);

                    // Releasing a positional hold AWAY from its slot costs nothing:
                    // no spent record, the natural Phase stays
                    await pacer.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Holding An Action",
                            img: "icons/svg/clockwork.svg",
                            statuses: ["holding"],
                            flags: {
                                [game.system.id]: {
                                    hold: {
                                        mode: "position",
                                        segmentAbs: 30,
                                        dex: 20,
                                        combatantId: pacerCombatant.id,
                                    },
                                },
                            },
                        },
                    ]);
                    await ui.combat._onReleaseHeldAction(pacerCombatant.id);
                    expect(pacer.statuses.has("holding"), "hold released").to.be.false;
                    expect(pacerCombatant.spentHoldPosition, "off-slot release forfeits nothing").to.equal(null);
                });

                it("Should re-point the turn at the next actor when the active combatant is deleted", async function () {
                    const first = await makeActor("_Quench Del First", { dex: 20, spd: 2 });
                    const second = await makeActor("_Quench Del Second", { dex: 15, spd: 2 });
                    const third = await makeActor("_Quench Del Third", { dex: 10, spd: 2 });
                    const combat = await makeCombat([first, second, third]);
                    await combat.startCombat();
                    // The start update's maintenance chain writes combatant flags
                    // asynchronously — deleting mid-chain races those writes
                    await combat.settleMaintenance?.();
                    expect(combat.segment).to.equal(12);
                    expect(combat.combatant.actorId).to.equal(first.id);

                    // Deleting the active combatant selects the next actor below the
                    // recorded acting position, exactly as nextTurn's threshold does.
                    // Core shifts the pointer row immediately; the asynchronous
                    // reconcile commits the acting position — wait for BOTH.
                    await combat.deleteEmbeddedDocuments("Combatant", [combat.combatant.id]);
                    const repointed = await waitUntil(
                        () =>
                            combat.combatant?.actorId === second.id &&
                            combat.segment === 12 &&
                            Math.floor(combat.getFlag(game.system.id, "actingPriority") ?? -1) === 15,
                    );
                    expect(repointed, "pointer and acting position land on the next actor").to.be.true;

                    // The removal is ledgered and the order continues normally
                    const log = combat.getFlag(game.system.id, "eventLog") ?? {};
                    expect(
                        Object.values(log).some((e) => e.t === "combatant.remove"),
                        "removal appears in the ledger",
                    ).to.be.true;
                    await combat.nextTurn();
                    expect(combat.combatant.actorId).to.equal(third.id);
                });

                it("Should carry a rehydratable snapshot through a delayed attack landing", async function () {
                    const { dehydrateAttackItem, rehydrateAttackItem } = await import("../item/item-attack.mjs");
                    const striker = await makeActor("_Quench Delayed Replay", { dex: 16, spd: 12 });
                    const strike = striker.items.find((i) => i.system?.XMLID === "STRIKE");
                    expect(strike, "PC actors carry the Strike maneuver").to.exist;
                    const combat = await makeCombat([striker]);
                    await combat.startCombat();
                    const combatant = combatantFor(combat, striker);
                    const currentAbs = combat.round * 12 + combat.segment;

                    strike.system._active ??= {};
                    const itemJson = dehydrateAttackItem(strike);
                    // The world chat may hold landing cards from earlier combats —
                    // only a NEW card proves this record landed
                    const priorCardIds = new Set(
                        game.messages.contents
                            .filter((m) => m.getFlag(game.system.id, "delayedAttack")?.itemJson)
                            .map((m) => m.id),
                    );
                    await combat.scheduleDelayedAction(
                        striker,
                        {
                            kind: "attack",
                            label: `${strike.name} (Extra Segment)`,
                            resolveAbs: currentAbs + 1,
                            priority: null,
                            commit: false,
                            actionData: {
                                formData: { effectiveStr: 10 },
                                targetTokenIds: [],
                                userId: game.user.id,
                                itemJson,
                                originalItemUuid: strike.uuid,
                                actorUuid: striker.uuid,
                                prepaid: true,
                            },
                        },
                        strike,
                    );
                    expect(combat.hasDelayedAction(combatant)).to.be.true;

                    // priority-null records land at the very END of their segment: the
                    // declarer's own Phase there must not pull the landing forward
                    await combat.nextTurn(); // into the landing segment (the striker's Phase)
                    await combat.settleMaintenance?.();
                    expect(combat.hasDelayedAction(combatant), "own Phase does not resolve an end-of-segment landing")
                        .to.be.true;
                    await combat.nextTurn(); // the end-of-segment landing stop

                    // The landing card carries the declaration for the replay
                    const isNewCard = (m) =>
                        !priorCardIds.has(m.id) && m.getFlag(game.system.id, "delayedAttack")?.itemJson;
                    const landed = await waitUntil(() => game.messages.contents.some(isNewCard));
                    expect(landed, "landing card offers the roll at the landing stop").to.be.true;
                    expect(combat.atDelayedLandingStop, "the landing is a real pointer stop").to.be.true;

                    await combat.nextTurn(); // past it — leaving the stop cleans the record up
                    const cleaned = await waitUntil(() => !combat.hasDelayedAction(combatant));
                    expect(cleaned, "record consumed once the landing segment is left").to.be.true;
                    const message = game.messages.contents.filter(isNewCard).at(-1);
                    const payload = message.getFlag(game.system.id, "delayedAttack");
                    expect(payload.prepaid, "resources were paid at declaration").to.be.true;
                    expect(payload.formData?.effectiveStr, "dialog inputs survive the round-trip").to.equal(10);

                    // The snapshot is stringified exactly once and rebuilds the item
                    expect(typeof JSON.parse(payload.itemJson)).to.equal("object");
                    const rebuilt = rehydrateAttackItem(payload.itemJson, striker);
                    expect(rebuilt?.item?.system?.XMLID).to.equal("STRIKE");
                    expect(rebuilt.item.name).to.equal(strike.name);
                    await message.delete();
                });

                it("Should keep tied groups and outsiders in a consistent order (no re-admission cycling)", async function () {
                    const boss = await makeActor("_Quench Cycle Group", { dex: 15, spd: 2 });
                    const outsider = await makeActor("_Quench Cycle Outsider", { dex: 15, spd: 2 });
                    const combat = await makeCombat([boss, outsider]);
                    await combat.createEmbeddedDocuments("Combatant", [{ actorId: boss.id }]);
                    const members = combat.combatants.filter((c) => c.actorId === boss.id);
                    const outsiderCombatant = combatantFor(combat, outsider);

                    // Rig an EXACT fraction collision (both roll groups r=50) with
                    // adversarial sub-rolls: mixing sub-roll order inside the group
                    // with identity order against the outsider can make the comparator
                    // non-transitive, and nextTurn's tie re-admission then bounces the
                    // pointer between the group and the outsider forever
                    const [m1, m2] = members;
                    await combat.setFlag(game.system.id, "segmentRolls", {
                        24: {
                            [boss.id]: {
                                r: 50,
                                fd: null,
                                m: { [m1.tokenId || m1.id]: 0, [m2.tokenId || m2.id]: 99 },
                            },
                            [outsider.id]: {
                                r: 50,
                                fd: null,
                                m: { [outsiderCombatant.tokenId || outsiderCombatant.id]: 40 },
                            },
                        },
                    });
                    await combat.startCombat();

                    // The full comparator must be a consistent total order
                    const all = combat.combatants.contents;
                    const sorted = [...all].sort((a, b) => combat._comparePriority(a, b, combat, 12, { queryAbs: 24 }));
                    for (let i = 0; i < sorted.length; i++) {
                        for (let j = i + 1; j < sorted.length; j++) {
                            expect(
                                combat._comparePriority(sorted[i], sorted[j], combat, 12, { queryAbs: 24 }),
                                `sorted[${i}] before sorted[${j}]`,
                            ).to.be.lessThan(0);
                        }
                    }

                    // Advancing through the segment reaches everyone exactly once
                    const acted = [combat.combatant.id];
                    let guard = 0;
                    while (combat.segment === 12 && guard++ < 6) {
                        await combat.nextTurn();
                        if (combat.segment === 12) acted.push(combat.combatant.id);
                    }
                    expect(guard, "the segment ends without cycling").to.be.lessThan(6);
                    expect([...new Set(acted)].length, "no combatant acted twice").to.equal(acted.length);
                    expect(acted.length, "all three combatants acted").to.equal(3);
                });

                it("Should refuse initiative rolls entirely (HERO has none)", async function () {
                    const actor = await makeActor("_Quench No Init", { dex: 12, spd: 2 });
                    const combat = await makeCombat([actor]);
                    const combatant = combatantFor(combat, actor);
                    await combat.rollInitiative([combatant.id]);
                    await combat.rollAll();
                    expect(combatant.initiative, "no core formula written").to.equal(null);
                });

                it("Should admit an equal-priority anchored held slot right after the anchor's turn (#4689)", async function () {
                    const anchor = await makeActor("_Quench Slot Anchor", { dex: 20, spd: 3 });
                    const holder = await makeActor("_Quench Slot Holder", { dex: 15, spd: 2 });
                    const combat = await makeCombat([anchor, holder]);
                    await combat.startCombat();
                    const anchorCombatant = combatantFor(combat, anchor);
                    const holderCombatant = combatantFor(combat, holder);

                    // Banked for the anchor's next Phase segment (SPD 3 → Segment 4)
                    const slotAbs = abs(2, 4);
                    await makeHoldEffect(holderCombatant, {
                        mode: "position",
                        segmentAbs: slotAbs,
                        dex: 15,
                        anchor: { combatantId: anchorCombatant.id, relation: "after", name: anchorCombatant.name },
                    });

                    // The playtest shape: identical scalars, adjacency decided by tie order
                    expect(combat.getInitiativePriority(holderCombatant, 4, { queryAbs: slotAbs })).to.equal(
                        combat.getInitiativePriority(anchorCombatant, 4, { queryAbs: slotAbs }),
                    );

                    await combat.nextTurn(); // T1S12 (anchor) → T2S4 (anchor); the holder's Phase is banked
                    expect(combat.segment).to.equal(4);
                    expect(combat.combatant.actorId, "anchor acts first at the shared count").to.equal(anchor.id);

                    await combat.nextTurn(); // equal-priority re-admission reaches the held slot
                    expect(combat.segment, "the slot is inside the same segment").to.equal(4);
                    expect(combat.combatant.actorId, "the holder acts right after their anchor").to.equal(holder.id);
                });

                it("Should whisper SPD-change cards to the actor's owners (#4686)", async function () {
                    const player = await User.create({ name: "_Quench Player", role: CONST.USER_ROLES.PLAYER });
                    try {
                        const changer = await makeActor("_Quench SPD Whisper", { dex: 12, spd: 2 });
                        await changer.update({
                            ownership: { [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
                        });
                        const pacer = await makeActor("_Quench Whisper Pacer", { dex: 20, spd: 12 });
                        const combat = await makeCombat([changer, pacer]);
                        await combat.startCombat();
                        const combatant = combatantFor(combat, changer);

                        // First boundary seeds the SPD baseline
                        await combat.nextTurn();
                        await combat.nextTurn();
                        await waitUntil(() => combatant.getFlag(game.system.id, "knownSpd") !== undefined);

                        const before = snapshotMessages();
                        await changer.update({ "system.characteristics.spd.value": 6 });
                        await combat.nextTurn();
                        const deferred = await waitUntil(() => !!combatant.getFlag(game.system.id, "pendingSpd"));
                        expect(deferred, "voluntary change deferred").to.be.true;

                        const card = messagesSince(before).find((m) =>
                            m.content.includes("voluntary SPD change takes effect at Post-Segment 12"),
                        );
                        expect(card, "the deferral card posted").to.exist;
                        expect(card.whisper.length, "card is whispered, not public").to.be.greaterThan(0);
                        expect(card.whisper, "the owner is a recipient").to.include(player.id);
                    } finally {
                        await player.delete();
                    }
                });

                it("Should keep NPC Post-Segment 12 recoveries off the public card (#2419)", async function () {
                    const automationSetting = await getAndSetGameSetting("automation", "all");
                    try {
                        const thug = await makeActor("_Quench P12 Thug", { dex: 10, spd: 2, type: "npc" });
                        const rec = thug.system.characteristics.rec.value;
                        await thug.update({
                            "system.characteristics.stun.value": thug.system.characteristics.stun.max - rec - 3,
                            "system.characteristics.end.value": thug.system.characteristics.end.max - rec - 3,
                        });

                        const combat = await makeCombat([thug]);
                        await combat.startCombat();
                        const before = snapshotMessages();
                        await combat.nextTurn(); // crosses Post-Segment 12
                        expect(combat.round).to.equal(2);

                        const fresh = messagesSince(before);
                        const publicCard = fresh.find(
                            (m) => m.content.startsWith("Post-Segment 12") && m.whisper.length === 0,
                        );
                        expect(publicCard, "the public Turn marker posted").to.exist;
                        expect(publicCard.content, "no empty roster on the public card").to.not.include("<ul>");
                        const gmCard = fresh.find(
                            (m) => m.content.startsWith("Post-Segment 12") && m.whisper.length > 0,
                        );
                        expect(gmCard, "NPC recoveries whisper to the GM").to.exist;
                        expect(gmCard.content, "the whispered card carries the roster").to.include("<li>");
                    } finally {
                        await game.settings.set(game.system.id, "automation", automationSetting);
                    }
                });

                it("Should offer Breakfall from prone only when the Phase is not spent recovering (#4682)", async function () {
                    const tumbler = await makeActor("_Quench Breakfall", { dex: 10, spd: 2 });
                    await tumbler.createEmbeddedDocuments("Item", [
                        { name: "Breakfall", type: "skill", system: { XMLID: "BREAKFALL", active: true } },
                    ]);
                    await tumbler.toggleStatusEffect("prone", { active: true });
                    const combat = await makeCombat([tumbler]);
                    await combat.startCombat();
                    // startCombat's own Phase-start maintenance posts an upkeep card
                    // asynchronously; settle it or it lands inside a diff window below
                    await combat.settleMaintenance();
                    const combatant = combatantFor(combat, tumbler);

                    const upkeepCards = async () => {
                        const before = snapshotMessages();
                        await combat._phaseStartUpkeepCard(combatant, combat.segment);
                        return messagesSince(before);
                    };

                    let cards = await upkeepCards();
                    expect(
                        cards.some((m) => m.content.includes("roll-breakfall")),
                        "prone alone offers Breakfall",
                    ).to.be.true;

                    await tumbler.toggleStatusEffect("stunned", { active: true });
                    expect(tumbler.statuses.has("stunned"), "precondition: Stunned applied").to.be.true;
                    cards = await upkeepCards();
                    expect(cards.length, "the upkeep card itself still posts").to.be.greaterThan(0);
                    expect(
                        cards.some((m) => m.content.includes("roll-breakfall")),
                        "no Breakfall while recovering from Stunned",
                    ).to.be.false;

                    await tumbler.toggleStatusEffect("stunned", { active: false });
                    await tumbler.toggleStatusEffect("knockedOut", { active: true });
                    expect(tumbler.statuses.has("knockedOut"), "precondition: KO applied").to.be.true;
                    cards = await upkeepCards();
                    expect(
                        cards.some((m) => m.content.includes("roll-breakfall")),
                        "no Breakfall while KO'd",
                    ).to.be.false;
                });

                it("Should carry an actor rename to its prototype and matching scene tokens (#4687)", async function () {
                    const hero = await makeActor("_Quench Renamed Hero", { dex: 10, spd: 2 });
                    expect(hero.prototypeToken.name).to.equal("_Quench Renamed Hero");

                    const scene = await Scene.create({ name: "_Quench Rename Scene" });
                    try {
                        await scene.createEmbeddedDocuments("Token", [
                            { actorId: hero.id, actorLink: true, name: "_Quench Renamed Hero", x: 100, y: 100 },
                            { actorId: hero.id, actorLink: true, name: "Custom Callsign", x: 200, y: 200 },
                        ]);

                        await hero.update({ name: "_Quench Rebranded Hero" });
                        expect(hero.prototypeToken.name, "prototype follows the rename").to.equal(
                            "_Quench Rebranded Hero",
                        );

                        // The token sweep runs from an unawaited hook
                        const renamed = await waitUntil(() =>
                            scene.tokens.contents.some((t) => t.name === "_Quench Rebranded Hero"),
                        );
                        expect(renamed, "the matching scene token renames").to.be.true;
                        expect(
                            scene.tokens.contents.some((t) => t.name === "Custom Callsign"),
                            "a custom-named token is untouched",
                        ).to.be.true;

                        // A custom prototype name is deliberate and survives
                        await hero.update({ "prototypeToken.name": "The Brand" });
                        await hero.update({ name: "_Quench Rebranded Again" });
                        expect(hero.prototypeToken.name).to.equal("The Brand");
                    } finally {
                        await scene.delete();
                    }
                });

                it("Should keep the settings-window group boundaries registered and in order", async function () {
                    // Group membership derives from registration order at render
                    // time, so the boundary keys existing IN ORDER is the whole
                    // contract the header injection depends on
                    const registeredKeys = [...game.settings.settings.keys()];
                    const boundaryIndexes = SETTINGS_GROUPS.map((group) => {
                        const index = registeredKeys.indexOf(`${game.system.id}.${group.firstKey}`);
                        expect(index, `boundary key ${group.firstKey} is registered`).to.be.greaterThan(-1);
                        return index;
                    });
                    expect(boundaryIndexes, "boundaries appear in group order").to.deep.equal(
                        [...boundaryIndexes].sort((a, b) => a - b),
                    );
                    expect(
                        game.settings.settings.get(`${game.system.id}.combatTrackerGrouping`).config,
                        "grouping lives in the tracker dialog, not the settings window",
                    ).to.be.false;
                    expect(game.settings.settings.get(`${game.system.id}.fastDrawTieBreak`).config).to.be.true;
                    expect(game.settings.settings.get(`${game.system.id}.stunnedAutoSkip`).config).to.be.true;
                });
            });
        },
        { displayName: "HERO SYSTEM 6E: Combat Tracker Fix Validation" },
    );
}
