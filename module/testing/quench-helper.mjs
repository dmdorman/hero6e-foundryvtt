import { HeroSystem6eItem } from "../item/item.mjs";

const { Actor } = foundry.documents;

export async function createQuenchActor({ quench, contents, is5e, actorType: type = "pc", name, img }) {
    const CHARACTER_NAME = contents?.match(/CHARACTER_NAME=".*?"/)?.[0];
    name ??= CHARACTER_NAME?.match(/CHARACTER_NAME="(.*?)"/)?.[1] || "";

    function generateQuenchTitleRecursive(quench) {
        // '__root/hero6efoundryvttv2.utils.defense_root/Resistant Protection/rPD 1'
        if (!quench.parent) {
            return quench.title.replace(/\W+/g, "");
        }
        return `${generateQuenchTitleRecursive(quench.parent)}/${quench.title.replace(/\W+/g, "")}`;
    }

    // Need to be a bit careful as we can create invalid XML if name has special characters
    const quenchName = `_Quench ${Date.now().toString()} ${name.replace(
        /\W+/g,
        " ",
    )} ${generateQuenchTitleRecursive(quench.currentTest || quench.test)}`;

    // Delete any previous leftover actors for this test
    const oldQuenchActors = game.actors.filter((a) => a.name.includes(quench.title));
    await Actor.deleteDocuments(oldQuenchActors.map((m) => m.id));

    if (is5e === undefined) {
        throw new Error("missing is5e");
    }

    // Create new actor for this test
    const actor = await Actor.create(
        {
            name: quenchName,
            type,
            img,
        },
        { is5e, quenchCreate: true },
    );

    if (contents) {
        // Is this a full actor
        if (contents.includes("CHARACTER_NAME")) {
            await actor.uploadFromXml(contents.replace(CHARACTER_NAME, `CHARACTER_NAME="${quenchName}"`), {
                quenchUpload: true,
            });
            if (actor.is5e !== is5e) {
                throw new Error(`${actor.name} has mismatched is5e`);
            }
        } // Likely item contents
        else {
            // Add item
            await HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(contents, actor), { parent: actor });
        }
    }

    // PH: FIXME: This is done as a part of the uploadFromXml... why do we need to do it here? Is it needed only for
    // where we create via itemDataFromXml? It creates one failure which indicates incorrect code.
    await actor.fullHealth();

    return actor;
}

export async function deleteQuenchActor({ quench, actor }) {
    if (actor == null) {
        throw new Error("missing actor");
    } else if (quench == null) {
        throw new Error("missing quench");
    }

    // Careful undefined comparisons are tricky
    try {
        if (
            quench.tests?.find((t) => t?.state !== "passed") ||
            quench.currentTest?.state === "failed" ||
            quench.suites?.find((s) => s.tests.find((t) => t.state !== "passed")) ||
            quench.test?.parent.suites?.find((s) => s.tests.find((t) => t.state === "failed")) ||
            quench.test?.parent.tests?.find((t) => t.state === "failed")
        ) {
            console.error("skipping deletion of actor because tests failed");
            return;
        }
    } catch (e) {
        console.error(e);
    }

    await actor.delete();
}

export function registerGlobalSetup(quench) {
    quench.registerBatch(
        `${game.system.id}.a.global-setup`,
        (context) => {
            const { describe, it } = context;

            describe("Global Module Setup", function () {
                // Combats FIRST: once the actor sweep runs, leaked combats lose the
                // _Quench actor names this filter needs
                it("Delete '_Quench' combats", async () => {
                    // Test combats are created with the _Quench name prefix. The
                    // fallback sweeps unnamed leaks, but only when at least one
                    // combatant provably belongs to a _Quench actor — a real saved
                    // encounter whose actors were deleted must survive this
                    const ids = game.combats
                        .filter(
                            (c) =>
                                c.name?.startsWith("_Quench") ||
                                (c.combatants.some((ct) => ct.actor?.name?.startsWith("_Quench")) &&
                                    c.combatants.every((ct) => !ct.actor || ct.actor.name.startsWith("_Quench"))),
                        )
                        .map((c) => c.id);
                    if (ids.length > 0) await Combat.deleteDocuments(ids);
                });

                it("Delete '_Quench' actors", async () => {
                    await Actor.deleteDocuments(
                        game.actors.filter((a) => a.name.startsWith("_Quench")).map((o) => o.id),
                    );
                });
            });
        },
        {
            // Display name for the batch in the Quench UI.
            displayName: "Global Setup",
        },
    );
}

export function registerGlobalTeardown(quench) {
    quench.registerBatch(
        `${game.system.id}.z.global-teardown`, // Use a unique key for your module.
        (context) => {
            const { describe, it } = context;

            describe("Global Teardown", function () {
                // Combats FIRST: once the actor sweep runs, leaked combats lose the
                // _Quench actor names this filter needs
                it("Delete '_Quench' combats", async () => {
                    // Test combats are created with the _Quench name prefix. The
                    // fallback sweeps unnamed leaks, but only when at least one
                    // combatant provably belongs to a _Quench actor — a real saved
                    // encounter whose actors were deleted must survive this
                    const ids = game.combats
                        .filter(
                            (c) =>
                                c.name?.startsWith("_Quench") ||
                                (c.combatants.some((ct) => ct.actor?.name?.startsWith("_Quench")) &&
                                    c.combatants.every((ct) => !ct.actor || ct.actor.name.startsWith("_Quench"))),
                        )
                        .map((c) => c.id);
                    if (ids.length > 0) await Combat.deleteDocuments(ids);
                });

                it("Delete '_Quench' actors", async () => {
                    // The end-to-end tests create tokens, make sure they get deleted
                    const activeScene = game.scenes.active ?? game.scenes.contents?.[0];
                    if (activeScene) {
                        await activeScene.deleteEmbeddedDocuments(
                            "Token",
                            activeScene.tokens.filter((t) => t.name.startsWith("_Quench")).map((o) => o.id),
                        );
                    }

                    // Various tests create actors, make sure they get deleted
                    await Actor.deleteDocuments(
                        game.actors.filter((a) => a.name.startsWith("_Quench")).map((o) => o.id),
                    );
                });

                it("Delete '_Quench' scenes", async () => {
                    await deleteQuenchScenes();
                });
            });
        },
        {
            // Display name for the batch in the Quench UI.
            displayName: "Global Teardown",
        },
    );
}

/**
 * Wait until a Token's canvas placeable has finished drawing.
 *
 * @param {TokenDocument} tokenDoc The token document whose placeable should be drawn.
 * @param {number} timeoutMs How long to wait before giving up.
 * @returns {Promise<Token|null>} The drawn token placeable, or whatever object is available on timeout.
 */
export async function waitForTokenDrawn(tokenDoc, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const obj = tokenDoc.object ?? canvas.tokens?.get(tokenDoc.id);
        // targetArrows is created at the end of Token#_draw(), so its presence means drawing finished.
        if (obj?.targetArrows) {
            return obj;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return tokenDoc.object ?? canvas.tokens?.get(tokenDoc.id) ?? null;
}

/**
 * Poll until a condition becomes true. Some combat side effects (held-action
 * consumption, boundary maintenance) run async after the update commits.
 *
 * @param {() => boolean} condition
 * @param {number} timeoutMs
 * @param {number} intervalMs
 * @returns {Promise<boolean>} The condition's final value.
 */
export async function waitUntil(condition, timeoutMs = 3000, intervalMs = 50) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (condition()) return true;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return condition();
}

/**
 * Snapshot of the current chat message ids, for later diffing with
 * {@link messagesSince}.
 * @returns {Set<string>}
 */
export function snapshotMessages() {
    return new Set(game.messages.contents.map((m) => m.id));
}

/**
 * Chat messages created since a {@link snapshotMessages} snapshot.
 * @param {Set<string>} snapshot
 * @returns {ChatMessage[]}
 */
export function messagesSince(snapshot) {
    return game.messages.contents.filter((m) => !snapshot.has(m.id));
}

export async function waitForNotificationQueueToClear(timeout = 5000) {
    // Clear any existing chat rendering backlog to protect Quench execution time limits
    const isQueueActive = () => {
        const queueLength = ui.chat._renderQueue?.length || ui.chat._pending?.length || ui.chat._batch?.length || 0;
        return queueLength > 0;
    };

    let counter = Math.floor(timeout / 10); // 500 * 10ms = 5 seconds maximum backlog buffer clearance
    while (isQueueActive() && counter-- > 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    if (isQueueActive()) {
        console.error(`waitForNotificationQueueToClear did not clear during time alloted`);
    }
}

export async function createQuenchScene(options = {}) {
    // 1. Extract and delete the quench context from options so it doesn't pollute the scene database data
    const quench = options.quench;
    delete options.quench;

    // 2. Determine a unique suffix based on the test name
    let testSuffix = "Generic";
    if (quench?.test) {
        // Collect full test title path (Suite Name -> Test Title) and replace spaces/special characters
        const fullTitle = quench.test?.fullTitle() || quench.fullTitle();
        testSuffix = fullTitle
            .replace(game.system.id, "")
            .replace(/[^a-z0-9]/gi, "_")
            .replace("__", "_")
            .substring(0, 40);
    }

    const quenchTestSceneName = `_Quench_${testSuffix}`;
    console.log(`createQuenchScene ${quenchTestSceneName}`);

    const quenchScene = await Scene.create(
        foundry.utils.mergeObject(
            {
                name: quenchTestSceneName,
                tokenVision: true,
                width: 1000,
                height: 750,
                environment: {
                    globalLight: {
                        enabled: true,
                    },
                },
                levels: [
                    {
                        name: "defaultLevel0000",
                        elevation: { bottom: 0, top: 20 },
                        background: { color: "#9c7bdc" },
                    },
                ],
                background: {
                    color: "#7804f4", // Make sure to include the '#' symbol here
                },
                grid: {
                    type: CONST.GRID_TYPES.SQUARE,
                    size: 100, // 100 pixels per cell block
                    distance: 2, // 100px grid block = 2 meters metrics scaling
                    units: "m",
                },
            },
            options,
        ),
    );

    // Deterministic Canvas View Switch Guard
    if (canvas.scene?.id !== quenchScene.id) {
        // Fire the view update transaction natively
        await quenchScene.view();
    }

    // Comprehensive Hook-Driven Synchronization Check
    if (!canvas.ready || canvas.loading) {
        console.warn("Halting execution thread until canvasReady resolves.");
        await new Promise((resolve) => Hooks.once("canvasReady", resolve));
    }

    // Comprehensive Hook-Driven Synchronization Check
    if (!canvas.ready || canvas.loading) {
        console.warn(`Quench Vision: Halting execution thread until canvasReady resolves for ${quenchScene.name}.`);
        await new Promise((resolve) => Hooks.once("canvasReady", resolve));
    }

    return quenchScene;
}

export async function deleteQuenchScenes() {
    console.log("deleteQuenchScenes");

    // 1. Explicitly await any pending UI notification cleanups
    await waitForNotificationQueueToClear();

    // 2. Safely return the to the active scene (or any non-quench scene)
    const preferedScene = !game.scenes.active.name.startsWith("_Quench")
        ? game.scenes.active
        : game.scenes.find((s) => !s.name.startsWith("_Quench"));
    if (preferedScene && preferedScene !== game.scenes.viewed) {
        const canvasIsSettled = new Promise((resolve) => Hooks.once("canvasReady", resolve));
        await preferedScene.view();
        await preferedScene.activate();
        await canvasIsSettled; // Wait for the new canvas geometry layout to completely load
    }

    // 3. Purge the database records cleanly
    const quenchScenes = game.scenes.filter((s) => s.name.startsWith("_Quench"));
    const quenchIds = quenchScenes.map((s) => s.id);

    if (quenchIds.length > 0) {
        console.log(`Deleting scenes: ${quenchScenes.map((s) => `${s.name} (${s.id})`).join(", ")}`);
        await Scene.deleteDocuments(quenchIds);
    }
}

/**
 * Waits for a specific DOM element to render within a Foundry chat card message.
 * Prioritizes thread-safe performance by cleaning up background tasks immediately upon settling.
 *
 * @param {string} elementSelector - The CSS selector string to query (e.g., ".apply-adjustment-card").
 * @param {number} [timeoutMs=5000] - Hard fallback constraint before intentional rejection.
 * @returns {Promise<Object>} Resolves to an object containing the chat message document and the found DOM node.
 */
export async function waitForElementInChat(elementSelector, timeoutMs = 5000) {
    let messageHookId = null;
    let executionTimerId = null;

    // Clear any existing chat rendering backlog to protect Quench execution time limits
    await waitForNotificationQueueToClear();

    // Unified Race Pipeline
    return Promise.race([
        // Pipeline Branch A: Monitored DOM paint tracking
        new Promise((resolve) => {
            messageHookId = Hooks.on("renderChatMessageHTML", (chatMessage, cardHtmlElement) => {
                const foundElement = cardHtmlElement.querySelector(elementSelector);

                if (foundElement) {
                    // Clean up the companion timeout task and the hook listener immediately on success
                    if (executionTimerId) clearTimeout(executionTimerId);
                    Hooks.off("renderChatMessageHTML", messageHookId);

                    // Yield execution thread frames to guarantee the browser has drawn the layout
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            resolve({ chatMessage, foundElement });
                        });
                    });
                }
            });
        }),

        // Pipeline Branch B: Fallback execution safety net
        new Promise((_, reject) => {
            executionTimerId = setTimeout(() => {
                // CRITICAL PROTECTION: Cleanly prune the listener if the timeout races first
                Hooks.off("renderChatMessageHTML", messageHookId);
                reject(new Error(`Timeout: Target element "${elementSelector}" did not render within ${timeoutMs}ms.`));
            }, timeoutMs);
        }),
    ]);
}

/**
 * The default timeout tends to be insufficient with multiple actors being created at the same time.
 * @param {*} quench
 */
export function setQuenchTimeout(quench) {
    quench.timeout(20000);
}
