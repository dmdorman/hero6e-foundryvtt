import { HeroSystem6eActor } from "../actor/actor.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { captureChatBaseline, deleteRunChatMessages } from "./quench-chat.mjs";

// Quench runs batches in key order, so the `a.` and `z.` prefixes keep global setup
// first and global teardown last. These names exclude the `${game.system.id}.` prefix.
// Callers that select these suites must import them here rather than repeat the strings.
export const GLOBAL_SETUP_SUITE = "a.global-setup";
export const GLOBAL_TEARDOWN_SUITE = "z.global-teardown";

/**
 * Create one Quench actor, upload its export, and restore its health.
 *
 * `actorType` is required. `Actor.create` returns nothing when the type is missing or unregistered,
 * so a caller that leaves it out gets no actor and no Foundry error.
 *
 * A full actor export can change the type. `uploadFromXml` reads the export `TEMPLATE` attribute and
 * updates `actor.type` to match (`module/actor/actor-upload.mjs:371`). This helper rejects a finished
 * actor of another type, so a row cannot claim one type and test another. The retype never produces
 * npc. The upload treats pc and npc as one bucket, so an npc actor keeps its type and matches.
 *
 * @param {object} options Creation options.
 * @param {object} options.quench The Quench context. Names the actor after the running suite.
 * @param {string} [options.contents] Hero Designer XML: a full actor export, or one item.
 * @param {boolean} options.is5e Edition for the created document.
 * @param {string} options.actorType One of `CONFIG.HERO.creatableActorTypes`.
 * @param {string} [options.name] Fixture name. Defaults to the XML `CHARACTER_NAME`.
 * @param {string} [options.img] Actor image.
 * @returns {Promise<HeroSystem6eActor>} The created actor, with the export uploaded.
 * @throws {Error} When `is5e` or `actorType` is missing, when no document was created, when the
 *                 upload states another edition, or when the finished actor is another type.
 */
export async function createQuenchActor({ quench, contents, is5e, actorType: type, name, img }) {
    const CHARACTER_NAME = contents?.match(/CHARACTER_NAME=".*?"/)?.[0];
    name ??= CHARACTER_NAME?.match(/CHARACTER_NAME="(.*?)"/)?.[1] || "";

    function generateQuenchTitleRecursive(quench) {
        // '__root/hero6efoundryvttv2.utils.defense_root/Resistant Protection/rPD 1'
        if (!quench.parent) {
            return quench.title.replace(/\W+/g, "");
        }
        return `${generateQuenchTitleRecursive(quench.parent)}/${quench.title.replace(/\W+/g, "")}`;
    }

    // Sanitized ancestor path of the current suite. The name and the sweep below share this value.
    const titlePath = generateQuenchTitleRecursive(quench.currentTest || quench.test || quench);

    // Need to be a bit careful as we can create invalid XML if name has special characters
    const quenchName = `_Quench ${Date.now().toString()} ${name.replace(/\W+/g, " ")} ${titlePath}`;

    if (is5e === undefined) {
        throw new Error("missing is5e");
    }

    if (type === undefined) {
        throw new Error("missing actorType");
    }

    // Create new actor for this test
    const actor = await HeroSystem6eActor.create(
        {
            name: quenchName,
            type,
            img,
        },
        { is5e, quenchCreate: true },
    );

    if (!actor) {
        throw new Error(`createQuenchActor: Foundry created no actor for actorType "${type}"`);
    }

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

    if (actor.type !== type) {
        throw new Error(
            `createQuenchActor: asked for actorType "${type}" but the actor reads "${actor.type}" ` +
                `(template ${actor.system.CHARACTER.TEMPLATE?.name ?? "none"})`,
        );
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

/**
 * Delete the `_Quench` combats the suites left behind.
 *
 * Combats go first. Once the actor sweep runs, a leaked combat loses the `_Quench` actor names this
 * filter needs.
 *
 * Test combats carry the `_Quench` name prefix. The fallback sweeps unnamed leaks, but only when every
 * combatant provably belongs to a `_Quench` actor. A real saved encounter whose actors were deleted
 * must survive this.
 *
 * @returns {Promise<string[]>} The combat ids deleted.
 */
export async function deleteQuenchCombats() {
    const ids = game.combats
        .filter(
            (c) =>
                c.name?.startsWith("_Quench") ||
                (c.combatants.some((ct) => ct.actor?.name?.startsWith("_Quench")) &&
                    c.combatants.every((ct) => !ct.actor || ct.actor.name.startsWith("_Quench"))),
        )
        .map((c) => c.id);

    if (ids.length > 0) {
        await Combat.deleteDocuments(ids);
    }

    return ids;
}

/**
 * Delete the `_Quench` tokens and actors the suites left behind.
 *
 * Tokens go first, because a token whose actor is already gone is harder to identify. Both sweeps
 * run even when the first one fails, so a token problem cannot strand actors.
 *
 * @returns {Promise<{tokenIds: string[], actorIds: string[]}>} The ids actually deleted.
 * @throws {Error} When a sweep fails. Names each failure and reports what was deleted first.
 */
export async function deleteQuenchTokensAndActors() {
    const activeScene = game.scenes.active ?? game.scenes.contents?.[0];
    const failures = [];
    const deleted = { tokenIds: [], actorIds: [] };

    const tokenIds = activeScene ? activeScene.tokens.filter((t) => t.name.startsWith("_Quench")).map((t) => t.id) : [];

    if (tokenIds.length > 0) {
        try {
            await activeScene.deleteEmbeddedDocuments("Token", tokenIds);
            deleted.tokenIds = tokenIds;
        } catch (err) {
            failures.push(`tokens: ${err?.message ?? err}`);
        }
    }

    const actorIds = game.actors.filter((a) => a.name.startsWith("_Quench")).map((a) => a.id);

    if (actorIds.length > 0) {
        try {
            await HeroSystem6eActor.deleteDocuments(actorIds);
            deleted.actorIds = actorIds;
        } catch (err) {
            failures.push(`actors: ${err?.message ?? err}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(
            `Incomplete _Quench cleanup - ${failures.join("; ")}. Deleted ` +
                `${deleted.tokenIds.length} tokens and ${deleted.actorIds.length} actors before the failure.`,
        );
    }

    return deleted;
}

/**
 * Delete every `_Quench` fixture from the world: chat messages, combats, tokens, actors, then scenes.
 *
 * Both global batches call this through Mocha. `abortAndRunGlobalTeardown` also calls it directly
 * when Mocha cannot run the batch, so the cleanup does not depend on the runner. Each sweep runs
 * even when an earlier one fails, so no failure strands a later fixture type.
 *
 * @returns {Promise<{messages: number, combats: number, tokens: number, actors: number, scenes: number}>}
 *                    How many of each fixture type were deleted.
 * @throws {Error} When a sweep fails. Names each failure and reports the partial counts.
 */
export async function deleteQuenchFixtures() {
    const failures = [];
    const counts = { messages: 0, combats: 0, tokens: 0, actors: 0, scenes: 0 };

    // Chat first. A short log makes everything after it cheaper to render.
    try {
        counts.messages = (await deleteRunChatMessages()).deleted;
    } catch (err) {
        failures.push(`chat messages: ${err?.message ?? err}`);
    }

    try {
        counts.combats = (await deleteQuenchCombats()).length;
    } catch (err) {
        failures.push(`combats: ${err?.message ?? err}`);
    }

    try {
        const deleted = await deleteQuenchTokensAndActors();
        counts.tokens = deleted.tokenIds.length;
        counts.actors = deleted.actorIds.length;
    } catch (err) {
        failures.push(String(err?.message ?? err));
    }

    try {
        const before = game.scenes.filter((s) => s.name.startsWith("_Quench")).length;
        await deleteQuenchScenes();
        counts.scenes = before - game.scenes.filter((s) => s.name.startsWith("_Quench")).length;
    } catch (err) {
        failures.push(`scenes: ${err?.message ?? err}`);
    }

    if (failures.length > 0) {
        throw new Error(
            `Incomplete _Quench fixture cleanup - ${failures.join("; ")}. Deleted ` +
                `${counts.messages} chat messages, ${counts.combats} combats, ${counts.tokens} tokens, ` +
                `${counts.actors} actors, ${counts.scenes} scenes.`,
        );
    }

    return counts;
}

/**
 * Register one batch that deletes every `_Quench` fixture.
 *
 * Global setup and global teardown share this body. Their purpose is the same: leave no `_Quench`
 * residue in the world. They differ only in the batch key, which sets when Quench runs them.
 * Quench runs batches in registration order, and the keys sort `a.global-setup` first and
 * `z.global-teardown` last.
 *
 * Each fixture type gets its own `it` step. A failure then names the fixture type in the Quench UI
 * instead of pointing at the wrong one.
 *
 * @param {object} quench The Quench instance.
 * @param {object} identity The batch identity.
 * @param {string} identity.suiteKey Suite name without the system prefix.
 * @param {string} identity.displayName Batch name shown in the Quench UI.
 * @param {{title: string, run: Function}} identity.chatStep The chat sweep this batch runs first.
 */
function registerFixtureCleanupBatch(quench, { suiteKey, displayName, chatStep }) {
    quench.registerBatch(
        `${game.system.id}.${suiteKey}`,
        (context) => {
            const { describe, it } = context;

            describe(displayName, function () {
                // Mocha's 2000ms default is too short when several actors are created at the same time.
                setQuenchTimeout(this, 20000);

                // The chat step runs first in both batches. Global setup records the log the run must
                // not touch. Global teardown clears the log the run produced.
                it(chatStep.title, async () => {
                    await chatStep.run();
                });

                // Combats first: the actor sweep removes the _Quench actor names this filter needs.
                it("Delete '_Quench' combats", async () => {
                    await deleteQuenchCombats();
                });

                // Tokens before actors: a token whose actor is already gone is harder to identify.
                it("Delete '_Quench' tokens and actors", async () => {
                    await deleteQuenchTokensAndActors();
                });

                it("Delete '_Quench' scenes", async () => {
                    await deleteQuenchScenes();
                });
            });
        },
        { displayName },
    );
}

export function registerGlobalSetup(quench) {
    registerFixtureCleanupBatch(quench, {
        suiteKey: GLOBAL_SETUP_SUITE,
        displayName: "HERO: Global Setup",
        chatStep: { title: "Record the chat baseline", run: captureChatBaseline },
    });
}

export function registerGlobalTeardown(quench) {
    registerFixtureCleanupBatch(quench, {
        suiteKey: GLOBAL_TEARDOWN_SUITE,
        displayName: "HERO: Global Teardown",
        chatStep: { title: "Delete chat messages the run created", run: deleteRunChatMessages },
    });
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

    const quenchScene = await foundry.documents.Scene.create(
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
        await foundry.documents.Scene.deleteDocuments(quenchIds);
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
 * Set the Mocha timeout for one Quench suite. Call this in the batch's outer describe block, so every
 * nested suite and test inherits the value. This function supplies no fallback: each batch states its
 * own budget. Mocha's own 2000 ms default is too short when several actors are created at once, so a
 * batch that forgets to call this fails for the wrong reason.
 *
 * @param {object} quench The Mocha suite context (`this`) of the outer describe block.
 * @param {number} timeoutMs Milliseconds to allow. Must be a positive finite number.
 * @throws {TypeError} If timeoutMs is missing or is not a positive finite number.
 */
export function setQuenchTimeout(quench, timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TypeError(`setQuenchTimeout requires a positive timeout in milliseconds, got ${timeoutMs}.`);
    }
    quench.timeout(timeoutMs);
}
