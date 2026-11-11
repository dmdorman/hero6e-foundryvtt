import { HEROSYS } from "../herosystem6e.mjs";
import { setQuenchTimeout } from "./quench-helper.mjs";
import {
    getCharacteristicMaxFromActor,
    getCharacteristicValueFromActor,
    updateMultipleCharacteristicsOnActor,
} from "./characteristic-assertions.mjs";

const { Actor } = foundry.documents;

/**
 * Registers tests for the updateWorldTime pipeline: out-of-combat recovery (including
 * banked remainder seconds), batched effect expiry with combined chat messages, and
 * resilience against malformed or disabled temporary effects.
 *
 * @param {Object} quench - The external Quench module testing framework instance.
 */
export function registerWorldTimeRecoveryAndExpiryTests(quench) {
    quench.registerBatch(
        `${game.system.id}.worldTime`,
        (context) => {
            const { describe, it, assert, before, after, beforeEach, afterEach } = context;

            describe("World Time Recovery & Effect Expiry", function () {
                // Recovery calibration steps world time second-by-second with settle waits.
                setQuenchTimeout(this, 60000);

                let testActor = null;
                let originalAutomation = null;

                /**
                 * Recovery and expiry writes are intentionally not awaited by the updateWorldTime
                 * pipeline, so poll until the observable state lands.
                 */
                const settle = async (predicate, timeoutMs = 3000) => {
                    const start = Date.now();
                    while (Date.now() - start < timeoutMs) {
                        if (predicate()) return true;
                        await new Promise((resolve) => setTimeout(resolve, 50));
                    }
                    return predicate();
                };

                // Effects with no XMLID, statuses, or changes are swept as stale leftovers by
                // expireEffects before their expiry is due; a no-op change keeps them alive.
                const noopChange = { key: "system.characteristics.str.value", mode: 2, value: "0" };

                before(async () => {
                    originalAutomation = game.settings.get(HEROSYS.module, "automation");
                    await game.settings.set(HEROSYS.module, "automation", "all");
                });

                after(async () => {
                    await game.settings.set(HEROSYS.module, "automation", originalAutomation);
                });

                beforeEach(async () => {
                    testActor = await Actor.create({
                        name: "_Quench World Time Target",
                        type: "pc",
                        system: { is5e: false },
                    });
                });

                afterEach(async () => {
                    await testActor?.delete();
                    testActor = null;
                });

                it("Should recover STUN/END every 12 seconds out of combat, banking remainder seconds", async function () {
                    const rec = parseInt(getCharacteristicValueFromActor(testActor, "REC"));
                    assert.isAbove(rec, 0, "Test actor needs positive REC.");

                    const stunMax = parseInt(getCharacteristicMaxFromActor(testActor, "STUN"));
                    const endMax = parseInt(getCharacteristicMaxFromActor(testActor, "END"));
                    assert.isAtLeast(stunMax, 3 * rec + 2, "Test actor needs STUN headroom for 3 recoveries.");
                    assert.isAtLeast(endMax, 3 * rec + 2, "Test actor needs END headroom for 3 recoveries.");

                    await updateMultipleCharacteristicsOnActor(testActor, { STUN: { value: 2 }, END: { value: 2 } });

                    // The recovery accumulator is module-level state with an unknown remainder
                    // banked from prior time advances. Step one second at a time until a recovery
                    // lands; the bank is then at (or within a couple of seconds of) zero.
                    let calibrated = false;
                    for (let i = 0; i < 13 && !calibrated; i++) {
                        await game.time.advance(1);
                        calibrated = await settle(() => getCharacteristicValueFromActor(testActor, "STUN") > 2, 400);
                    }
                    assert.isTrue(calibrated, "Expected an out-of-combat recovery within 13 one-second advances.");

                    const stunAfterCalibration = parseInt(getCharacteristicValueFromActor(testActor, "STUN"));
                    const endAfterCalibration = parseInt(getCharacteristicValueFromActor(testActor, "END"));

                    // A single 25 second advance is two 12 second recoveries with 1 second banked.
                    await game.time.advance(25);
                    assert.isTrue(
                        await settle(
                            () => getCharacteristicValueFromActor(testActor, "STUN") === stunAfterCalibration + 2 * rec,
                        ),
                        `Expected exactly two recoveries (+${2 * rec} STUN) from a 25 second advance. ` +
                            `STUN=${getCharacteristicValueFromActor(testActor, "STUN")} expected=${stunAfterCalibration + 2 * rec}`,
                    );
                    assert.equal(
                        parseInt(getCharacteristicValueFromActor(testActor, "END")),
                        endAfterCalibration + 2 * rec,
                        "Expected exactly two recoveries of END from a 25 second advance.",
                    );

                    // The banked second plus 11 more crosses the next 12 second boundary.
                    await game.time.advance(11);
                    assert.isTrue(
                        await settle(
                            () => getCharacteristicValueFromActor(testActor, "STUN") === stunAfterCalibration + 3 * rec,
                        ),
                        "Expected the banked remainder second to count toward the next recovery (1 banked + 11 = 12).",
                    );
                });

                it("Should expire simultaneous effects in one batch with a single combined chat message", async function () {
                    const startTime = game.time.worldTime;
                    await testActor.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Quench Expiry Alpha",
                            duration: { startTime, seconds: 5 },
                            changes: [noopChange],
                            flags: { [game.system.id]: { expiresOn: "segmentEnd", source: "Quench Test" } },
                        },
                        {
                            name: "Quench Expiry Beta",
                            duration: { startTime, seconds: 5 },
                            changes: [noopChange],
                            flags: { [game.system.id]: { expiresOn: "segmentEnd", source: "Quench Test" } },
                        },
                    ]);
                    assert.equal(testActor.effects.size, 2, "Setup should add two temporary effects.");

                    const priorMessageIds = new Set(game.messages.map((m) => m.id));

                    await game.time.advance(7);

                    assert.isTrue(
                        await settle(() => testActor.effects.size === 0),
                        "Expected both expired effects to be bulk deleted.",
                    );
                    await settle(() =>
                        game.messages.some((m) => !priorMessageIds.has(m.id) && m.speaker?.actor === testActor.id),
                    );

                    const expiryMessages = game.messages.filter(
                        (m) => !priorMessageIds.has(m.id) && m.speaker?.actor === testActor.id,
                    );
                    assert.equal(expiryMessages.length, 1, "Expected a single combined expiry chat message.");
                    assert.include(expiryMessages[0].content, "Quench Expiry Alpha", "Combined message lists Alpha.");
                    assert.include(expiryMessages[0].content, "Quench Expiry Beta", "Combined message lists Beta.");
                });

                it("Should expire and delete effects that lack system flags without throwing", async function () {
                    const startTime = game.time.worldTime;
                    await testActor.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Quench Malformed Effect",
                            duration: { startTime, seconds: 5 },
                            changes: [noopChange],
                        },
                    ]);

                    const priorMessageIds = new Set(game.messages.map((m) => m.id));

                    await game.time.advance(7);

                    assert.isTrue(
                        await settle(() => testActor.effects.size === 0),
                        "Expected the flag-less effect to be deleted rather than crash expireEffects.",
                    );
                    await settle(() =>
                        game.messages.some((m) => !priorMessageIds.has(m.id) && m.speaker?.actor === testActor.id),
                    );

                    const expiryMessage = game.messages.find(
                        (m) => !priorMessageIds.has(m.id) && m.speaker?.actor === testActor.id,
                    );
                    assert.isOk(expiryMessage, "Expected an expiry chat message for the flag-less effect.");
                    assert.include(expiryMessage.content, "an unknown source", "Missing source falls back gracefully.");
                });

                it("Should still expire effects on actors whose only temporary effect is disabled", async function () {
                    const startTime = game.time.worldTime;
                    await testActor.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "Quench Disabled Effect",
                            disabled: true,
                            duration: { startTime, seconds: 5 },
                            changes: [noopChange],
                            flags: { [game.system.id]: { expiresOn: "segmentEnd", source: "Quench Test" } },
                        },
                    ]);

                    // Disabled effects are excluded from core actor.temporaryEffects, so this actor
                    // looks idle to a naive gate; the world-time pre-filter must still process it.
                    assert.equal(
                        testActor.temporaryEffects.length,
                        0,
                        "Core temporaryEffects should exclude the disabled effect (precondition).",
                    );

                    await game.time.advance(7);

                    assert.isTrue(
                        await settle(() => testActor.effects.size === 0),
                        "Expected the disabled temporary effect to expire and be deleted.",
                    );
                });
            });
        },
        { displayName: "HERO: World Time Recovery & Expiry" },
    );
}
