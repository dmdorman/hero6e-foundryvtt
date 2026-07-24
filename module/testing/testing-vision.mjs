import { calculateDistanceBetween } from "../utility/range.mjs";

/**
 * Structured vision verification pipeline optimized for rapid iteration.
 * Directly injects the external quench tracking instance at execution runtime.
 * @param {object} quench - The external Quench tracking framework instance.
 */
export function registerVisionTests(quench) {
    quench.registerBatch(
        `${game.system.id}.Vision`,
        (context) => {
            const { describe, it, assert, before, after } = context;

            // Targeted Iteration Isolation: Focus execution entirely on the Vision module
            describe.only("Vision", () => {
                // --- UNIT TESTS LEVEL ---
                describe.only("Unit tests", () => {
                    it("Should resolve true via SIGHT FRINGE math if adjacent despite active invisibility", () => {
                        const detectionMode = CONFIG.Canvas.detectionModes["heroTargetingV14"];

                        const activeSenses = {
                            NORMALSIGHT: { ACTIVE: true, RANGED: true, TARGETING: true, SENSEGROUP: "SIGHTGROUP" },
                        };

                        const targetInvisibility = {
                            SIGHTGROUP: true,
                            NORMALSIGHT: true,
                            NO_FRINGE: false,
                            BRIGHT_FRINGE: false,
                        };

                        // Mock distance exactly evaluating to 1.5 meters / 1 grid space
                        const calculatedDistance = { distance: 1.5, gridSpaces: 1 };

                        const originalLog = console.log;
                        console.log = () => {}; // Suppress output text strings during strict math validation

                        try {
                            const isDetected = detectionMode._resolveSensoryMatrix(
                                activeSenses,
                                targetInvisibility,
                                calculatedDistance,
                                false,
                                {},
                                {},
                                true,
                            );
                            assert.isTrue(
                                isDetected,
                                "Matrix processor failed to unlock adjacent proximity fringe overrides.",
                            );
                        } finally {
                            console.log = originalLog;
                        }
                    });
                });

                // --- WORKFLOW / SCENE WORKFLOW TESTS LEVEL ---
                describe.only("Integration", () => {
                    let testScene;
                    let pcActor;
                    let invisibleActor;
                    let tokenDocA;
                    let tokenDocB;
                    let originalScene;
                    const sceneName = "Quench Vision Test Arena";

                    before(async () => {
                        originalScene = game.scenes.viewed;
                        testScene = await Scene.create({
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
                            active: true,
                        });

                        // Deterministic Canvas View Switch Guard
                        if (canvas.scene?.id !== testScene.id) {
                            console.warn("Quench Vision: Requesting secure canvas switch.");
                            // Fire the view update transaction natively
                            await testScene.view();
                        }

                        // Comprehensive Hook-Driven Synchronization Check
                        if (!canvas.ready || canvas.loading) {
                            console.warn("Quench Vision: Halting execution thread until canvasReady resolves.");
                            await new Promise((resolve) => Hooks.once("canvasReady", resolve));
                        }

                        pcActor = await Actor.create({
                            name: "Breeze 5e",
                            type: "pc",
                            system: { is5e: true },
                            img: "icons/svg/sword.svg",
                        });

                        invisibleActor = await Actor.create({
                            name: "Spectral Knight",
                            type: "npc",
                            system: { is5e: false },
                            img: "icons/svg/shield.svg",
                        });

                        const createdTokens = await testScene.createEmbeddedDocuments("Token", [
                            { name: pcActor.name, actorId: pcActor.id, x: 0, y: 0, actorLink: true },
                            { name: invisibleActor.name, actorId: invisibleActor.id, x: 500, y: 0, actorLink: true },
                        ]);

                        tokenDocA = createdTokens[0];
                        tokenDocB = createdTokens[1];
                    });

                    after(async () => {
                        // Lifecycle Disposal Guards: Prevent stale data rows from leaking to other user clients
                        if (pcActor) await pcActor.delete();
                        if (invisibleActor) await invisibleActor.delete();

                        const fallbackScene = originalScene ?? game.scenes.contents.find((s) => s.id !== testScene?.id);

                        if (fallbackScene && canvas.scene?.id !== fallbackScene.id) {
                            // Passing loading: false tells the V14 engine to break stale asset resource holds instantly
                            await fallbackScene.view({ loading: false });

                            if (!canvas.ready) {
                                await new Promise((resolve) => Hooks.once("canvasReady", resolve));
                            }
                        }

                        // Introduce a micro-task pause delay to clear out active token rendering ticks safely
                        await new Promise((resolve) => setTimeout(resolve, 1));

                        // Clear database entities
                        if (testScene) {
                            await testScene.delete();
                            testScene = null;
                        }
                    });

                    it("Should accurately track canvas distance separation parameters via live scene token metrics", () => {
                        // Proxy Actor Isolation: Call distance validation loops on the live token instances directly
                        const calculatedDistance = calculateDistanceBetween(tokenDocA, tokenDocB);

                        assert.equal(
                            calculatedDistance.gridSpaces,
                            5,
                            "Canvas scene spacing matrix grid spaces evaluated incorrectly.",
                        );
                    });
                });
            });
        },
        { displayName: "HERO: Vision" },
    );
}
