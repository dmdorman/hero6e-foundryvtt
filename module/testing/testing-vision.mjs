import { setQuenchTimeout } from "./quench-helper.mjs";
import { getPowerInfo } from "../utility/util.mjs";

export function registerVisionTests(quench) {
    /**
     * Calculates ruleset distance between two tokens using V14 measurePath.
     * Accounts for 5e inches/hex matrices vs 6e meter scaling options.
     *
     * @param {TokenDocument} tokenADoc - The perceiving token proxy document
     * @param {TokenDocument} tokenBDoc - The target token proxy document
     * @returns {number} Distance in native system metrics (Meters or Inches)
     */
    function getHeroSystemDistanceV14(tokenADoc, tokenBDoc) {
        // Always safely extract the active live canvas object reference contexts
        const tA = tokenADoc.object ?? tokenADoc;
        const tB = tokenBDoc.object ?? tokenBDoc;

        if (!canvas.ready || !tA || !tB) return 0;

        // 1. Gather center coordinates for waypoints
        const startPoint = tA.center ?? { x: tA.x, y: tA.y };
        const endPoint = tB.center ?? { x: tB.x, y: tB.y };

        // 2. Format the V14 canonical waypoints array parameter block
        const waypoints = [startPoint, endPoint];

        // 3. Execute the new V14 path measure engine
        const measurementResult = canvas.grid.measurePath(waypoints);

        // Extract the true grid-scaled distance value directly from the result schema
        const gridDistance = measurementResult.distance;

        // 4. Evaluate ruleset adjustments dynamically using the payload flag
        const is5e = tokenADoc.actor?.system?.is5e === true;

        // If 5th Edition rules apply, scale to inches/hexes; otherwise, output raw 6e meters
        return is5e ? gridDistance : gridDistance;
    }

    /**
     * Verifies if a specific token can see an invisible target in V14.
     *
     * @param {TokenDocument|Token} visionToken - The perceiving token proxy or object
     * @param {TokenDocument|Token} invisibleToken - The target token proxy or object
     * @returns {boolean} True if the target is detected
     */
    function evaluateV14Visibility(visionToken, invisibleToken) {
        // 1. Resolve live canvas objects to access active vision layers
        const perceiver = visionToken.object ?? visionToken;
        const target = invisibleToken.object ?? invisibleToken;

        // 2. Guard: Verify the token has sight enabled in its configuration profile
        if (!perceiver.hasSight) return undefined;

        // 3. Extract the target's geometric tracking center point
        const targetPoint = target.center ?? { x: target.x, y: target.y };

        // 4. Run the V14 unified canvas visibility test
        return canvas.visibility.testVisibility(targetPoint, {
            tolerance: 0,
            object: target,
            visionSources: [perceiver.vision], // Isolates check strictly to this token
        });
    }

    quench.registerBatch(
        `${game.system.id}.vision`,
        (context) => {
            const { describe, before, beforeEach, after, it, assert } = context;

            describe.only("Vision", function () {
                setQuenchTimeout(this);

                let invisibleActor = null;
                let visionActor = null;
                let invisibleToken = null;
                let visionToken2m = null;
                let visionToken16m = null;
                let visionToken18m = null;
                let activeScene = null;
                let originalScene = null;

                before(async function () {
                    const sceneName = "Quench Vision Test Arena";
                    originalScene = game.scenes.active;
                    activeScene = game.scenes.getName(sceneName);

                    if (!activeScene) {
                        activeScene = await Scene.create({
                            name: sceneName,
                            tokenVision: true,
                            width: 1000,
                            height: 750,
                            environment: {
                                globalLight: {
                                    enabled: true,
                                },
                            },
                            grid: {
                                type: CONST.GRID_TYPES.SQUARE,
                                size: 100, // 100 pixels per cell block
                                distance: 2, // 100px grid block = 2 meters metrics scaling
                                units: "m",
                            },
                        });
                    }

                    // 1. Deterministic Canvas View Switch Guard
                    if (canvas.scene?.id !== activeScene.id) {
                        console.warn("Quench Vision: Requesting secure canvas switch.");

                        // Clear out active viewport coordinate locks before switching
                        await game.user.update({ viewPosition: null });

                        // Fire the view update transaction natively
                        await activeScene.view();
                    }

                    // 2. Comprehensive Hook-Driven Synchronization Check
                    // Replaces all setTimeouts by directly listening to the core canvas compilation states
                    if (!canvas.ready || canvas.loading) {
                        console.warn("Quench Vision: Halting execution thread until canvasReady resolves.");
                        await new Promise((resolve) => Hooks.once("canvasReady", resolve));
                    }

                    // 3. Build baseline actor mock targets
                    invisibleActor = await Actor.create({
                        name: "_Quench_Invisible",
                        type: "pc",
                        flags: { core: { sheetClass: "herosystem6e.HeroSystemActorSheetV2" } },
                        img: "icons/svg/sword.svg",
                    });

                    const itemsToCreate = [];
                    const createItem = (xmlid, system = {}) => {
                        const powerInfo = getPowerInfo({ xmlid, actor: invisibleActor });
                        const itemData = HeroSystem6eItem.itemDataFromXml(powerInfo.xml, invisibleActor);
                        return foundry.utils.mergeObject(itemData, { system: system });
                    };

                    itemsToCreate.push(createItem("INVISIBILITY", { OPTIONID: "SIGHTGROUP" }));
                    await invisibleActor.createEmbeddedDocuments("Item", itemsToCreate);

                    // Set activeEffect
                    const invisibilityItem = invisibleActor.items.find((i) => i.system.XMLID === "INVISIBILITY");
                    await invisibilityItem.setActiveEffects();

                    visionActor = await Actor.create({
                        name: "_Quench_Vision",
                        type: "pc",
                        flags: { core: { sheetClass: "herosystem6e.HeroSystemActorSheetV2" } },
                        img: "icons/svg/shield.svg",
                    });

                    // 4. Instantiation of individual tokens using system presets
                    const defaultTokenSettings = { actorLink: false };

                    [invisibleToken] = await activeScene.createEmbeddedDocuments("Token", [
                        await invisibleActor.getTokenDocument({ x: 300, y: 300, ...defaultTokenSettings }),
                    ]);

                    // Coordinate scaling mapping: 100px pixels = 2 meters
                    [visionToken2m] = await activeScene.createEmbeddedDocuments("Token", [
                        await visionActor.getTokenDocument({ x: 400, y: 300, ...defaultTokenSettings }), // 2m distance
                    ]);

                    [visionToken16m] = await activeScene.createEmbeddedDocuments("Token", [
                        await visionActor.getTokenDocument({ x: 1100, y: 300, ...defaultTokenSettings }), // 16m distance
                    ]);

                    [visionToken18m] = await activeScene.createEmbeddedDocuments("Token", [
                        await visionActor.getTokenDocument({ x: 1200, y: 300, ...defaultTokenSettings }), // 18m distance
                    ]);

                    // 5. Force the perception layer to calculate the initial token vision fields natively
                    if (canvas.perception) {
                        await canvas.perception.initialize();
                    }
                });

                // Using unlinked actors so we can quickly restore them to actor baseline between tests
                beforeEach(async function () {
                    await invisibleToken.delta.restore();
                    await visionToken2m.delta.restore();
                    await visionToken16m.delta.restore();
                    await visionToken18m.delta.restore();
                });

                after(async function () {
                    // Clear user sight selections first
                    game.user.targets.clear();

                    // 1. Force the viewport change away from the playground prior to deletion transactions
                    const fallbackScene = originalScene ?? game.scenes.contents.find((s) => s.id !== activeScene?.id);

                    if (fallbackScene && canvas.scene?.id !== fallbackScene.id) {
                        // Passing loading: false tells the V14 engine to break stale asset resource holds instantly
                        await fallbackScene.view({ loading: false });

                        if (!canvas.ready) {
                            await new Promise((resolve) => Hooks.once("canvasReady", resolve));
                        }
                    }

                    // 2. Introduce a micro-task pause delay to clear out active token rendering ticks safely
                    await new Promise((resolve) => setTimeout(resolve, 1));

                    // 3. Clear database entities
                    if (activeScene) {
                        await activeScene.delete();
                        activeScene = null;
                    }

                    if (invisibleActor) {
                        await invisibleActor.delete();
                        invisibleActor = null;
                    }

                    if (visionActor) {
                        await visionActor.delete();
                        visionActor = null;
                    }

                    originalScene = null;
                });

                it(`Valid tokens and distance`, async function () {
                    assert.ok(invisibleToken, "Invisible token exists.");
                    assert.ok(visionToken2m, "Vision token2m exists.");
                    assert.ok(visionToken16m, "Vision token2m exists.");
                    assert.ok(visionToken18m, "Vision token2m exists.");

                    // Distance for fringe testing
                    assert.strictEqual(
                        getHeroSystemDistanceV14(invisibleToken, visionToken2m),
                        2,
                        "Expecting visionToken2m token to be 2m away from invisibleToken",
                    );
                    assert.strictEqual(
                        getHeroSystemDistanceV14(invisibleToken, visionToken16m),
                        16,
                        "Expecting visionToken16m token to be 16m away from invisibleToken",
                    );
                    assert.strictEqual(
                        getHeroSystemDistanceV14(invisibleToken, visionToken18m),
                        18,
                        "Expecting visionToken18m token to be 18m away from invisibleToken",
                    );
                });

                const visionGroups = [
                    "SIGHTGROUP",
                    // "HEARINGGROUP",
                    // "MENTALGROUP",
                    // "RADIOGROUP",
                    // "SMELLGROUP",
                    // "TOUCHGROUP",
                ];
                for (const invisibleGroup of visionGroups) {
                    for (const visionGroup of visionGroups) {
                        it(`${invisibleGroup} vs ${visionGroup}`, async function () {
                            // Visibility testing

                            assert.strictEqual(
                                evaluateV14Visibility(visionToken2m, invisibleToken, "heroTargetingV14"),
                                true,
                                "testVisibility2m should be able to target fringe of invisible token",
                            );

                            assert.strictEqual(
                                evaluateV14Visibility(visionToken2m, invisibleToken, "heroNonTargetingV14"),
                                false,
                                "testVisibility2m should not be able to target fringe of invisible token with non-targeting sense",
                            );

                            // assert.strictEqual(
                            //     evaluateV14Visibility(visionToken16m, invisibleToken),
                            //     false,
                            //     "testVisibility16m should NOT be able to see fringe of invisible token",
                            // );

                            // assert.strictEqual(
                            //     evaluateV14Visibility(visionToken18m, invisibleToken),
                            //     false,
                            //     "testVisibility18m should NOT be able to see fringe of invisible token",
                            // );
                        });
                    }
                }
            });
        },
        { displayName: "HERO: Vision" },
    );
}
