import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { HeroSystem6eCombatTrackerSingle } from "../combatTracker-single.mjs";
import { roundFavorPlayerAwayFromZero } from "../utility/round.mjs";
import {
    setQuenchTimeout,
    createQuenchScene,
    deleteQuenchScenes,
    waitForNotificationQueueToClear,
} from "./quench-helper.mjs";

const { Actor, TokenDocument } = foundry.documents;

export function registerStatusEffectTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.statusEffects`,
        (context) => {
            const { describe, it, before, beforeEach, after, assert } = context;

            // Awaitable promise helper that resolves exactly when a specific Foundry hook settles
            const waitForHook = (hookName) =>
                new Promise((resolve) => Hooks.once(hookName, (...args) => resolve(args)));
            const getSceneTokenDocuments = () =>
                canvas.scene?.tokens?.contents ?? Array.from(canvas.scene?.tokens ?? []);
            const getSceneTokenIdsForActor = (actor) =>
                new Set(
                    getSceneTokenDocuments()
                        .filter(
                            (tokenDocument) =>
                                tokenDocument.actorId === actor.id ||
                                tokenDocument.actor?.id === actor.id ||
                                tokenDocument.actor === actor,
                        )
                        .map((tokenDocument) => tokenDocument.id),
                );
            const tintMatchesExpected = (actualTint, expectedTint) =>
                foundry.utils.Color.from(actualTint).css === foundry.utils.Color.from(expectedTint).css;
            const getTokenUpdateTint = (update) => update?.["texture.tint"] ?? update?.texture?.tint;
            const waitForActorTokenTintUpdate = async (actor, getUpdates, expectedTint, timeoutMs = 1000) => {
                const started = Date.now();
                while (Date.now() - started < timeoutMs) {
                    const tintUpdates = (getUpdates() ?? []).filter(
                        (u) => u["texture.tint"] !== undefined || u.texture?.tint !== undefined,
                    );
                    const actorTokenIds = getSceneTokenIdsForActor(actor);
                    const update = tintUpdates.find(
                        (u) =>
                            (actorTokenIds.has(u._id) || tintUpdates.length === 1) &&
                            tintMatchesExpected(getTokenUpdateTint(u), expectedTint),
                    );
                    if (update) return update;
                    await new Promise((resolve) => setTimeout(resolve, 20));
                }
                return null;
            };

            describe("Actor Status Effect State Machine Matrix", function () {
                setQuenchTimeout(this);
                let quenchActor = null;
                let effectsObj = null;

                before(async function () {
                    await waitForNotificationQueueToClear();
                    await createQuenchScene({
                        quench: this,
                    });

                    effectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;

                    quenchActor = await Actor.create({
                        name: "_Quench_Status_Tester",
                        type: "pc",
                        img: "icons/svg/mystery-man.svg",
                    });
                });

                after(async function () {
                    if (quenchActor) {
                        // Await the hook to track document cleanup safely
                        const hookPromise = waitForHook("deleteActor");
                        await quenchActor.delete();
                        await hookPromise;
                    }

                    await deleteQuenchScenes();
                });

                beforeEach(async function () {
                    const effectIds = quenchActor.effects.map((e) => e.id);
                    if (effectIds.length > 0) {
                        const hookPromise = waitForHook("deleteActiveEffect");
                        await quenchActor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
                        await hookPromise; // Blocks until the collection is completely empty
                    }
                });

                it("Dead Lockout Check", async function () {
                    // Track the effect creation step deterministically
                    let hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.deadEffect.id, { active: true });
                    await hookPromise;

                    assert.ok(quenchActor.statuses.has(effectsObj.deadEffect.id), "Actor successfully seeded as Dead.");

                    const koResult = await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id, {
                        active: true,
                    });
                    const stunResult = await quenchActor.toggleStatusEffect(effectsObj.stunEffect.id, { active: true });

                    assert.strictEqual(koResult, false, "Toggling knockedOut while dead returns false.");
                    assert.strictEqual(stunResult, false, "Toggling stun while dead returns false.");
                    assert.ok(!quenchActor.statuses.has(effectsObj.knockedOutEffect.id), "KnockedOut status blocked.");
                    assert.ok(!quenchActor.statuses.has(effectsObj.stunEffect.id), "Stunned status blocked.");
                });

                it("KnockedOut Lockout Blocks Stunned", async function () {
                    const hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id, { active: true });
                    await hookPromise;
                    assert.ok(
                        quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "Actor successfully seeded as KnockedOut.",
                    );

                    const stunResult = await quenchActor.toggleStatusEffect(effectsObj.stunEffect.id, {
                        active: true,
                    });

                    assert.strictEqual(stunResult, false, "Toggling stun while knockedOut returns false.");
                    assert.ok(!quenchActor.statuses.has(effectsObj.stunEffect.id), "Stunned status blocked.");
                    assert.ok(quenchActor.statuses.has(effectsObj.knockedOutEffect.id), "KnockedOut overlay retained.");
                });

                it("Prone Implication Chains (KO)", async function () {
                    const hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id, { active: true });
                    await hookPromise;

                    assert.ok(quenchActor.statuses.has(effectsObj.knockedOutEffect.id), "KnockedOut applied.");
                    assert.ok(
                        quenchActor.statuses.has(effectsObj.proneEffect.id),
                        "Prone automatically implied via KO.",
                    );
                });

                it("Prone Implication Chains (Asleep)", async function () {
                    const hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.asleepEffect.id, { active: true });
                    await hookPromise;

                    assert.ok(quenchActor.statuses.has(effectsObj.asleepEffect.id), "Asleep applied.");
                    assert.ok(
                        quenchActor.statuses.has(effectsObj.proneEffect.id),
                        "Prone automatically implied via Asleep.",
                    );
                });

                it("Prone Implication Chains (Unconscious)", async function () {
                    const hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.unconsciousEffect.id, { active: true });
                    await hookPromise;

                    assert.ok(quenchActor.statuses.has(effectsObj.unconsciousEffect.id), "Unconscious applied.");
                    assert.ok(
                        quenchActor.statuses.has(effectsObj.proneEffect.id),
                        "Prone automatically implied via Unconscious.",
                    );
                });

                it("KnockedOut Cleans Up Stunned", async function () {
                    let hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.stunEffect.id, { active: true });
                    await hookPromise;
                    assert.ok(quenchActor.statuses.has(effectsObj.stunEffect.id), "Actor is initially Stunned.");

                    // Moving to KO drops stun (deletes an embedded document)
                    hookPromise = waitForHook("deleteActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id, { active: true });
                    await hookPromise;

                    assert.ok(
                        quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "KnockedOut applied successfully.",
                    );
                    assert.ok(!quenchActor.statuses.has(effectsObj.stunEffect.id), "Stunned was dropped cleanly.");
                });

                it("Manual Toggle Flip Removes KnockedOut", async function () {
                    // Token HUD and sheet toggles call toggleStatusEffect without an
                    // explicit active flag; the second call must remove the status.
                    let hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id);
                    await hookPromise;
                    assert.ok(quenchActor.statuses.has(effectsObj.knockedOutEffect.id), "KnockedOut applied via flip.");

                    hookPromise = waitForHook("deleteActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id);
                    await hookPromise;
                    assert.ok(
                        !quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "KnockedOut removed via flip.",
                    );
                    assert.ok(
                        !quenchActor.effects.some((e) => e.statuses.has(effectsObj.knockedOutEffect.id)),
                        "No lingering KnockedOut active effect.",
                    );
                });

                it("Dead Cleans Up KnockedOut", async function () {
                    let hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id, { active: true });
                    await hookPromise;
                    assert.ok(
                        quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "Actor is initially KnockedOut.",
                    );

                    hookPromise = waitForHook("deleteActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.deadEffect.id, { active: true });
                    await hookPromise;

                    assert.ok(quenchActor.statuses.has(effectsObj.deadEffect.id), "Dead applied successfully.");
                    assert.ok(
                        !quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "KnockedOut was dropped cleanly.",
                    );
                });

                it("Full Health Cleanup Operations", async function () {
                    const effectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;

                    await quenchActor.toggleStatusEffect(effectsObj.stunEffect.id, { active: true });
                    await quenchActor.toggleStatusEffect(effectsObj.asleepEffect.id, { active: true });
                    await quenchActor.toggleStatusEffect(effectsObj.unconsciousEffect.id, { active: true });

                    await quenchActor.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "_Quench_Maneuver",
                            img: "icons/svg/shield.svg",
                            flags: { [game.system.id]: { type: "maneuverNextPhaseEffect" } },
                        },
                    ]);

                    // Intercept the mass document drop inside fullHealth
                    const hookPromise = waitForHook("deleteActiveEffect");
                    await quenchActor.fullHealth();
                    await hookPromise;

                    assert.strictEqual(quenchActor.effects.size, 0, "All core active effects dropped.");
                    assert.ok(!quenchActor.statuses.has(effectsObj.stunEffect.id), "Stunned cleared.");
                    assert.ok(!quenchActor.statuses.has(effectsObj.asleepEffect.id), "Asleep cleared.");
                    assert.ok(!quenchActor.statuses.has(effectsObj.unconsciousEffect.id), "Unconscious cleared.");
                });

                it("Token HUD Interface Click Simulation and FullHealth Cleanup", async function () {
                    const effectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;

                    const tokenData = await quenchActor.getTokenDocument({ x: 100, y: 100 });

                    let tokenHook = waitForHook("createToken");
                    const [canvasTokenDoc] = await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
                    await tokenHook;

                    const canvasTokenInstance = canvasTokenDoc.object;
                    assert.ok(canvasTokenInstance, "Token instance successfully created.");

                    canvas.tokens.hud.bind(canvasTokenInstance);

                    // Wait for the effect update loop to clear the pipeline
                    let hookPromise = waitForHook("createActiveEffect");
                    await canvas.tokens.hud.actor.toggleStatusEffect(effectsObj.stunEffect.id, {
                        active: true,
                        overlay: true,
                    });
                    await hookPromise;

                    assert.ok(
                        quenchActor.statuses.has(effectsObj.stunEffect.id),
                        "Actor records Stunned state via Token HUD.",
                    );

                    canvas.tokens.hud.clear();

                    hookPromise = waitForHook("deleteActiveEffect");
                    await quenchActor.fullHealth();
                    await hookPromise;

                    assert.strictEqual(
                        quenchActor.effects.size,
                        0,
                        "Actor sheet cleared of the HUD-applied ActiveEffect.",
                    );
                    assert.ok(
                        !quenchActor.statuses.has(effectsObj.stunEffect.id),
                        "Stunned state removed from statuses Set.",
                    );
                    assert.strictEqual(
                        canvasTokenDoc.actor.effects.size,
                        0,
                        "Token actor proxy effects list is clean.",
                    );

                    tokenHook = waitForHook("deleteToken");
                    await canvasTokenDoc.delete();
                    await tokenHook;
                });

                it("Manage knockout states via dynamic PC thresholds", async function () {
                    const tokenHook = waitForHook("createToken");
                    const tokenDocument = await TokenDocument.create(
                        { actorId: quenchActor.id, name: quenchActor.name, x: 0, y: 0 },
                        { parent: canvas.scene },
                    );
                    await tokenHook;

                    let capturedUpdates = null;
                    const originalUpdate = canvas.scene.updateEmbeddedDocuments;
                    canvas.scene.updateEmbeddedDocuments = async function (embeddedName, updates) {
                        if (
                            embeddedName === "Token" &&
                            updates.some(
                                (update) => update["texture.tint"] !== undefined || update.texture?.tint !== undefined,
                            )
                        ) {
                            capturedUpdates = updates;
                        }
                        return originalUpdate.apply(this, arguments);
                    };

                    try {
                        const colors = CONFIG.HERO.statusColors;

                        // A. DOWNWARD DAMAGE PATH
                        // 1. Drop STUN to -1 (Yellow)
                        await quenchActor.update({ "system.characteristics.stun.value": -1 });
                        let tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            quenchActor,
                            () => capturedUpdates,
                            colors.KO_DEFAULT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_DEFAULT_TINT).css,
                            "PC at STUN -1 should be assigned the yellowish configuration tint.",
                        );

                        // 2. Drop STUN to -11 (Stays Yellow for PC)
                        capturedUpdates = null;
                        await quenchActor.update({ "system.characteristics.stun.value": -11 });
                        await quenchActor.toggleStatusEffect("knockedOut", { active: true, overlay: true });
                        tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            quenchActor,
                            () => capturedUpdates,
                            colors.KO_DEFAULT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_DEFAULT_TINT).css,
                            "PC at STUN -11 should remain assigned the yellowish configuration tint.",
                        );

                        // 3. Drop STUN to -31 (Red)
                        capturedUpdates = null;
                        await quenchActor.update({ "system.characteristics.stun.value": -31 });
                        tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            quenchActor,
                            () => capturedUpdates,
                            colors.KO_COMBAT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_COMBAT_TINT).css,
                            "PC at STUN -31 should shift to the critical reddish combat tint.",
                        );

                        // B. NEW: UPWARD HEALING RECOVERY PATH
                        // 4. Heal back up to -1 from -31 (Should shift back from Red to Yellow!)
                        capturedUpdates = null;
                        await quenchActor.update({ "system.characteristics.stun.value": -1 });
                        await quenchActor.toggleStatusEffect("knockedOut", { active: true, overlay: true });
                        tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            quenchActor,
                            () => capturedUpdates,
                            colors.KO_DEFAULT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_DEFAULT_TINT).css,
                            "Healing PC back to STUN -1 should return the texture configuration tint to yellow.",
                        );
                    } finally {
                        canvas.scene.updateEmbeddedDocuments = originalUpdate;
                        await tokenDocument.delete();
                    }
                });

                it("Prone halves DCV value as well as max on 6e", async function () {
                    const actor6e = await Actor.create({
                        name: "_Quench_6e_Prone_Tester",
                        type: "pc",
                        img: "icons/svg/mystery-man.svg",
                        system: { is5e: false },
                    });

                    try {
                        const dcvMaxBefore = actor6e.system.characteristics.dcv.max;
                        assert.ok(dcvMaxBefore > 0, "6e actor starts with a positive DCV max.");
                        assert.strictEqual(
                            actor6e.system.characteristics.dcv.value,
                            dcvMaxBefore,
                            "6e actor starts with DCV value at max.",
                        );

                        const hookPromise = waitForHook("createActiveEffect");
                        await actor6e.toggleStatusEffect(effectsObj.proneEffect.id, { active: true });
                        await hookPromise;

                        const dcv = actor6e.system.characteristics.dcv;
                        assert.ok(dcv.max < dcvMaxBefore, "Prone lowered the DCV max.");
                        assert.strictEqual(dcv.value, dcv.max, "DCV value follows the halved max on 6e.");

                        await actor6e.toggleStatusEffect(effectsObj.proneEffect.id, { active: false });
                        assert.strictEqual(
                            actor6e.system.characteristics.dcv.max,
                            dcvMaxBefore,
                            "DCV max restored after prone removed.",
                        );
                        assert.strictEqual(
                            actor6e.system.characteristics.dcv.value,
                            dcvMaxBefore,
                            "DCV value restored after prone removed.",
                        );
                    } finally {
                        await actor6e.delete();
                    }
                });

                it("KO cascade prone effect carries its DCV halving changes", async function () {
                    const hookPromise = waitForHook("createActiveEffect");
                    await quenchActor.toggleStatusEffect(effectsObj.knockedOutEffect.id, { active: true });
                    await hookPromise;

                    const proneAE = quenchActor.effects.find((e) => e.statuses.has(effectsObj.proneEffect.id));
                    assert.ok(proneAE, "Prone effect created via KO cascade.");

                    // V13 keeps changes at effect.changes; V14 moved them to effect.system.changes
                    const changes = proneAE.changes?.length ? proneAE.changes : (proneAE.system?.changes ?? []);
                    assert.ok(
                        changes.some((change) => change.key === "system.characteristics.dcv.max"),
                        "Cascaded prone effect kept its DCV halving change.",
                    );
                });

                it("Redundant halving dedup keeps a co-located ADD change intact", async function () {
                    const dcvMaxBefore = quenchActor.system.characteristics.dcv.max;

                    // Prone and Stunned each carry an independent 0.5 MULTIPLY on the same key,
                    // exercising the MULTIPLY-only dedup in _removeRedundantHalvingActiveEffects
                    await quenchActor.toggleStatusEffect(effectsObj.proneEffect.id, { active: true });
                    await quenchActor.toggleStatusEffect(effectsObj.stunEffect.id, { active: true });

                    // An ADD sharing the halved key must survive the MULTIPLY-only dedup
                    await quenchActor.createEmbeddedDocuments("ActiveEffect", [
                        {
                            name: "_Quench_DCV_Aid",
                            changes: [
                                {
                                    key: "system.characteristics.dcv.max",
                                    value: "4",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                                },
                            ],
                        },
                    ]);

                    const expectedDcvMax = roundFavorPlayerAwayFromZero((dcvMaxBefore + 4) * 0.5);
                    assert.strictEqual(
                        quenchActor.system.characteristics.dcv.max,
                        expectedDcvMax,
                        "ADD applied before the single surviving 0.5 MULTIPLY, per priority order.",
                    );
                });

                it("Post-Segment-12 recovery does not wake a KO'd character", async function () {
                    await quenchActor.update({ "system.characteristics.stun.value": 20 });
                    await quenchActor.update({ "system.characteristics.stun.value": -5 });
                    assert.ok(quenchActor.statuses.has(effectsObj.knockedOutEffect.id), "Actor KO'd at negative STUN.");

                    await quenchActor.update(
                        { "system.characteristics.stun.value": 10 },
                        { preventRecoverFromStun: true },
                    );
                    assert.ok(
                        quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "preventRecoverFromStun keeps the actor KO'd despite positive STUN.",
                    );

                    await quenchActor.update({ "system.characteristics.stun.value": 12 });
                    assert.ok(
                        !quenchActor.statuses.has(effectsObj.knockedOutEffect.id),
                        "Normal recovery clears knockedOut.",
                    );
                });

                it("BODY at or below negative max marks dead; recovery clears it", async function () {
                    const bodyMax = quenchActor.system.characteristics.body.max;
                    assert.ok(bodyMax > 0, "Actor starts with a positive BODY max.");

                    await quenchActor.update({ "system.characteristics.body.value": -bodyMax });
                    assert.ok(quenchActor.statuses.has(effectsObj.deadEffect.id), "Actor marked dead at -BODY max.");

                    await quenchActor.update({ "system.characteristics.body.value": bodyMax });
                    assert.ok(
                        !quenchActor.statuses.has(effectsObj.deadEffect.id),
                        "Dead cleared when BODY recovers above the threshold.",
                    );
                });

                it("fullHealth preserves permanent (durationless) effects", async function () {
                    await quenchActor.createEmbeddedDocuments("ActiveEffect", [
                        { name: "_Quench_Permanent_Buff", img: "icons/svg/upgrade.svg" },
                    ]);
                    await quenchActor.toggleStatusEffect(effectsObj.stunEffect.id, { active: true });

                    const hookPromise = waitForHook("deleteActiveEffect");
                    await quenchActor.fullHealth();
                    await hookPromise;

                    assert.ok(
                        !quenchActor.statuses.has(effectsObj.stunEffect.id),
                        "Temporary status effect removed by fullHealth.",
                    );
                    assert.ok(
                        quenchActor.effects.some((e) => e.name === "_Quench_Permanent_Buff"),
                        "Permanent effect survives fullHealth.",
                    );
                });

                it("Re-tint texture when knockedOut actor changes type", async function () {
                    const npcTestActor = await Actor.create({
                        name: "_Quench_Status_NPC_Tester",
                        type: "pc",
                        img: "icons/svg/mystery-man.svg",
                        system: { characteristics: { stun: { value: 20, max: 20 } } },
                    });

                    await npcTestActor._changeType("npc");

                    const tokenHook = waitForHook("createToken");
                    const tokenDocument = await TokenDocument.create(
                        { actorId: npcTestActor.id, name: npcTestActor.name, x: 0, y: 0 },
                        { parent: canvas.scene },
                    );
                    await tokenHook;

                    let capturedUpdates = null;
                    const originalUpdate = canvas.scene.updateEmbeddedDocuments;
                    canvas.scene.updateEmbeddedDocuments = async function (embeddedName, updates) {
                        if (
                            embeddedName === "Token" &&
                            updates.some(
                                (update) => update["texture.tint"] !== undefined || update.texture?.tint !== undefined,
                            )
                        ) {
                            capturedUpdates = updates;
                        }
                        return originalUpdate.apply(this, arguments);
                    };

                    try {
                        const colors = CONFIG.HERO.statusColors;

                        // A. NPC TO PC PATH
                        // 1. Drop NPC to -11 (Red)
                        await npcTestActor.update({ "system.characteristics.stun.value": -11 });
                        let tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            npcTestActor,
                            () => capturedUpdates,
                            colors.KO_COMBAT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_COMBAT_TINT).css,
                            "NPC at STUN -11 should use the critical reddish configuration tint.",
                        );

                        // 2. Convert NPC to PC (Should shift Red ➔ Yellow because threshold is now -30)
                        capturedUpdates = null;
                        await npcTestActor._changeType("pc");
                        await npcTestActor.toggleStatusEffect("knockedOut", { active: true, overlay: true });
                        tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            npcTestActor,
                            () => capturedUpdates,
                            colors.KO_DEFAULT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_DEFAULT_TINT).css,
                            "Converting to PC should dynamically adjust the texture target payload back to yellow.",
                        );

                        // B. NEW: PC TO NPC REVERSE PATH
                        // 3. Convert PC back to NPC (Should shift Yellow ➔ Red because threshold drops back to -10)
                        capturedUpdates = null;
                        await npcTestActor._changeType("npc");
                        await npcTestActor.toggleStatusEffect("knockedOut", { active: true, overlay: true });
                        tokenTargetUpdate = await waitForActorTokenTintUpdate(
                            npcTestActor,
                            () => capturedUpdates,
                            colors.KO_COMBAT_TINT,
                        );
                        assert.equal(
                            foundry.utils.Color.from(getTokenUpdateTint(tokenTargetUpdate)).css,
                            foundry.utils.Color.from(colors.KO_COMBAT_TINT).css,
                            "Converting back to NPC should dynamically return the texture layout tint to red.",
                        );
                    } finally {
                        canvas.scene.updateEmbeddedDocuments = originalUpdate;
                        await tokenDocument.delete();
                        await npcTestActor.delete();
                    }
                });
            });

            describe("Combat Tracker Effect Classification", function () {
                setQuenchTimeout(this);
                const classify = (effect) => HeroSystem6eActorActiveEffects.combatTrackerClassification(effect);

                it("ranks incapacitation above CV modifiers, key characteristics, and misc", function () {
                    const tiers = ["knockedOut", "prone", "bleeding", "regeneration"].map(
                        (status) => classify({ statuses: new Set([status]) }).tier,
                    );
                    assert.deepEqual(tiers, [1, 2, 3, 4]);
                });

                it("orders within a tier by impact (dead before stunned before blind)", function () {
                    const [dead, stunned, blind] = ["dead", "stunned", "blind"].map((status) =>
                        classify({ statuses: new Set([status]) }),
                    );
                    assert.ok(dead.order < stunned.order, "dead outranks stunned");
                    assert.ok(stunned.order < blind.order, "stunned outranks blind");
                });

                it("classifies unknown effects by the characteristics their changes touch", function () {
                    const withChange = (key) => ({
                        statuses: new Set(),
                        changes: [{ key: `system.characteristics.${key}.max`, value: -1 }],
                    });
                    assert.equal(classify(withChange("dcv")).tier, 2);
                    assert.equal(classify(withChange("end")).tier, 3);
                    assert.equal(classify(withChange("str")).tier, 4);
                    assert.isNull(classify({ statuses: new Set(), changes: [] }), "no combat impact hides");
                });

                it("classifies adjustments by sign and target characteristic", function () {
                    const adjustment = (activePoints, key) => ({
                        statuses: new Set(),
                        flags: { [game.system.id]: { type: "adjustment", adjustmentActivePoints: activePoints } },
                        system: {
                            changes: [{ key: `system.characteristics.${key}.max`, value: activePoints }],
                        },
                    });
                    const stunDrain = classify(adjustment(-5, "stun"));
                    assert.equal(stunDrain.tier, 3);
                    assert.equal(stunDrain.group, "drain");
                    const strAid = classify(adjustment(5, "str"));
                    assert.equal(strAid.tier, 4);
                    assert.equal(strAid.group, "aid");
                });

                it("hides natural body healing", function () {
                    assert.isNull(classify({ statuses: new Set(), XMLID: "naturalBodyHealing" }));
                });

                it("builds priority-sorted, grouped row entries", async function () {
                    const effectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;
                    const trackerActor = await Actor.create({
                        name: "_Quench_Tracker_Effects",
                        type: "pc",
                        img: "icons/svg/mystery-man.svg",
                    });
                    try {
                        await trackerActor.toggleStatusEffect(effectsObj.proneEffect.id, { active: true });
                        await trackerActor.toggleStatusEffect(effectsObj.entangledEffect.id, { active: true });
                        await trackerActor.toggleStatusEffect(effectsObj.hearingSenseDisabledEffect.id, {
                            active: true,
                        });
                        await trackerActor.toggleStatusEffect(effectsObj.radioSenseDisabledEffect.id, {
                            active: true,
                        });
                        const adjustment = (name, activePoints, key) => ({
                            name,
                            img: "icons/svg/aura.svg",
                            showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
                            flags: { [game.system.id]: { type: "adjustment", adjustmentActivePoints: activePoints } },
                            system: {
                                changes: [
                                    {
                                        key: `system.characteristics.${key}.max`,
                                        value: activePoints,
                                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                                    },
                                ],
                            },
                        });
                        await trackerActor.createEmbeddedDocuments("ActiveEffect", [
                            adjustment("DRAIN 5 STUN", -5, "stun"),
                            adjustment("DRAIN 3 DEX", -3, "dex"),
                            {
                                name: "Natural Body Healing",
                                img: "icons/svg/regen.svg",
                                showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
                                flags: { [game.system.id]: { XMLID: "naturalBodyHealing" } },
                            },
                        ]);

                        const entries = HeroSystem6eCombatTrackerSingle.prototype._rowEffectEntries.call(
                            null,
                            trackerActor,
                        );
                        assert.deepEqual(
                            entries.map((e) => e.name),
                            [
                                effectsObj.entangledEffect.name,
                                effectsObj.proneEffect.name,
                                "Drained",
                                "Senses Impaired",
                            ],
                            "entangled > prone > drains (grouped, at the STUN drain's tier) > senses (grouped)",
                        );
                        assert.equal(entries.find((e) => e.name === "Drained").effects.length, 2);
                        assert.equal(entries.find((e) => e.name === "Senses Impaired").effects.length, 2);
                    } finally {
                        await trackerActor.delete();
                    }
                });
            });
        },
        { displayName: "HERO: Status Effects Logic" },
    );
}
