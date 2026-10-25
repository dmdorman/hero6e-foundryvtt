import {
    createQuenchActor,
    createQuenchScene,
    deleteQuenchActor,
    deleteQuenchScenes,
    setQuenchTimeout,
    waitForNotificationQueueToClear,
} from "./quench-helper.mjs";

import { HeroSystem6eItem } from "../item/item.mjs";
import { _calcKnockback } from "../item/item-attack.mjs";
import { getAndSetGameSetting } from "../settings/settings-helpers.mjs";
import {
    MOVEMENT_NONE_ACTION,
    MOVEMENT_SYNC_OPTION,
    actorMovementKey,
    activeMovementFlag,
    asTokenDocument,
    changedMovementCharacteristic,
    defaultMovementKey,
    linkedTokenDocuments,
    movementDisplayName,
    movementKeyForAction,
    movementPropagationSettled,
    ownedMovementKeys,
    propagateMovementMode,
    tokenMovementKey,
} from "../utility/movement.mjs";
import { calculateVelocityInSystemUnits } from "../utility/units.mjs";

/**
 * Non-killing attack, so the airborne modifier is the only knockback dice change under test.
 */
const ENERGY_BLAST_XML = `
    <POWER XMLID="ENERGYBLAST" ID="1759950000001" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Quench Movement Mode Energy Blast" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
        <NOTES />
    </POWER>
`;

/**
 * Return the knockback tags that record the airborne modifier.
 *
 * @param {object} knockbackResult The value `_calcKnockback` returned.
 * @returns {object[]} The "target is in the air" tags.
 */
function airborneTags(knockbackResult) {
    return knockbackResult.knockbackTags.filter((tag) => tag.name === "target is in the air");
}

/**
 * Sleep for a fixed time.
 *
 * @param {number} ms Milliseconds to wait.
 * @returns {Promise<void>} Resolves after the wait.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * View a scene and wait until the canvas shows it.
 *
 * @param {Scene} scene The scene to view.
 * @returns {Promise<void>} Resolves when the canvas shows that scene.
 */
async function viewSceneAndWait(scene) {
    await scene.view();
    const deadline = Date.now() + 15000;
    while (!(canvas.ready && canvas.scene?.id === scene.id) && Date.now() < deadline) {
        await sleep(50);
    }
    if (canvas.scene?.id !== scene.id) {
        throw new Error(`Canvas did not switch to scene "${scene.name}"`);
    }
}

/**
 * Control a token and bind the shared token HUD to it, the way a canvas click does.
 *
 * `BasePlaceableHUD#bind` is the same entry point the canvas uses, so the rendered palette is real.
 *
 * @param {Token} placeable The canvas token to bind the HUD to.
 * @returns {Promise<TokenHUD>} The bound token HUD.
 */
async function bindTokenHud(placeable) {
    canvas.tokens.activate({ tool: "select" });
    await sleep(100);

    if (!placeable.control({ releaseOthers: true })) {
        throw new Error(`Could not control token "${placeable.name}"`);
    }

    const hud = canvas.hud.token;
    await hud.bind(placeable);

    if (hud.object !== placeable) {
        throw new Error(`Token HUD did not bind to "${placeable.name}"`);
    }
    return hud;
}

/**
 * Click a movement action button in the rendered token HUD.
 *
 * Dispatches a real click, so Foundry's own `TokenHUD#onSelectMovementAction` handler runs.
 *
 * HERO registers no Default entry. Pass `""` to pick the `No movement` entry that stands in for a token
 * with no mode to pick.
 *
 * @param {TokenHUD} hud The rendered token HUD.
 * @param {string} action The HUD action key, for example `"FLIGHT"`.
 * @returns {Promise<void>} Resolves once the click landed on a real button.
 */
async function clickHudMovementAction(hud, action) {
    const button = [...hud.element.querySelectorAll('[data-action="movementAction"]')].find(
        (candidate) => candidate.dataset.movementAction === action,
    );

    if (!button) {
        const available = [...hud.element.querySelectorAll('[data-action="movementAction"]')]
            .map((candidate) => JSON.stringify(candidate.dataset.movementAction))
            .join(", ");
        throw new Error(`HUD has no movement button "${action}". Available: ${available}`);
    }

    button.click();
}

/**
 * Return the movement action keys the HUD currently marks active.
 *
 * @param {TokenHUD} hud The rendered token HUD.
 * @returns {string[]} The active movement action keys.
 */
function hudActiveMovementActions(hud) {
    return [...hud.element.querySelectorAll('[data-action="movementAction"].active')].map(
        (button) => button.dataset.movementAction,
    );
}

/**
 * Return every movement action key the HUD renders.
 *
 * @param {TokenHUD} hud The rendered token HUD.
 * @returns {string[]} The rendered movement action keys, in palette order.
 */
function hudMovementActionKeys(hud) {
    return [...hud.element.querySelectorAll('[data-action="movementAction"]')].map(
        (button) => button.dataset.movementAction,
    );
}

/**
 * Return the movement palette entries the HUD renders, with what the player sees.
 *
 * @param {TokenHUD} hud The rendered token HUD.
 * @returns {{key: string, label: string, active: boolean, icon: string}[]} Entries in palette order.
 */
function hudMovementEntries(hud) {
    return [...hud.element.querySelectorAll('[data-action="movementAction"]')].map((entry) => ({
        key: entry.dataset.movementAction,
        label: entry.textContent.trim(),
        active: entry.classList.contains("active"),
        icon: entry.querySelector("i")?.className ?? "",
    }));
}

/**
 * Wait until the movement palette holds the expected number of entries.
 *
 * The HUD re-renders from the updateToken hook, so the palette trails the document write.
 *
 * @param {TokenHUD} hud The rendered token HUD.
 * @param {number} expectedCount How many entries to wait for.
 * @param {number} [timeoutMs=5000] How long to wait.
 * @returns {Promise<boolean>} True when the palette reached that size.
 */
async function waitForHudMovementEntryCount(hud, expectedCount, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (hudMovementEntries(hud).length === expectedCount) {
            return true;
        }
        await sleep(25);
    }

    return false;
}

/**
 * Wait until the actor flag holds the expected movement key.
 *
 * The click handler updates the token document asynchronously, so the actor write is not immediate.
 *
 * @param {HeroSystem6eActor} actor The actor to watch.
 * @param {string} expectedKey The movement key the flag should hold.
 * @param {number} [timeoutMs=5000] How long to wait.
 * @returns {Promise<boolean>} True when the flag reached the expected key.
 */
async function waitForActorMovementFlag(actor, expectedKey, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        await movementPropagationSettled();
        if (foundry.utils.getProperty(actor, activeMovementFlag()) === expectedKey) {
            return true;
        }
        await sleep(25);
    }

    return false;
}

/**
 * Release the token HUD so it cannot hold a destroyed token between tests.
 *
 * @returns {Promise<void>} Resolves when the HUD is released and closed.
 */
async function releaseTokenHud() {
    const hud = canvas.hud?.token;

    if (!hud) {
        return;
    }

    canvas.tokens.releaseAll();
    if (hud.rendered) {
        await hud.close();
    }
}

export function registerMovementModeTests(quench) {
    quench.registerBatch(
        `${game.system.id}.movementMode`,
        (context) => {
            const { after, before, beforeEach, describe, it, assert } = context;

            describe("Movement Mode", function () {
                // Actor, scene, and token creation exceeds Mocha's 2000ms default.
                setQuenchTimeout(this, 30000);

                describe("ownedMovementKeys", function () {
                    let runner6e;
                    let flyer5e;

                    before(async function () {
                        runner6e = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "Runner 6e",
                        });
                        flyer5e = await createQuenchActor({
                            quench: this,
                            is5e: true,
                            name: "Glider 5e",
                        });
                        await flyer5e.updateCharacteristics([["gliding", { value: 10 }]]);
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor: runner6e });
                        await deleteQuenchActor({ quench: this, actor: flyer5e });
                    });

                    it("Returns the movement characteristics above zero", function () {
                        assert.deepEqual(ownedMovementKeys(runner6e), ["running", "swimming", "leaping"]);
                    });

                    it("Includes gliding for a 5e actor", function () {
                        assert.include(ownedMovementKeys(flyer5e), "gliding");
                    });

                    it("Excludes gliding for a 6e actor", function () {
                        assert.notInclude(ownedMovementKeys(runner6e), "gliding");
                    });

                    it("Returns an empty array for a missing actor", function () {
                        assert.deepEqual(ownedMovementKeys(null), []);
                    });

                    it("Drops a movement power drained to zero", async function () {
                        await runner6e.updateCharacteristics([["swimming", { value: 0 }]]);
                        assert.notInclude(ownedMovementKeys(runner6e), "swimming");
                        await runner6e.updateCharacteristics([["swimming", { value: 8 }]]);
                        assert.include(ownedMovementKeys(runner6e), "swimming");
                    });
                });

                describe("changedMovementCharacteristic", function () {
                    const actor = { system: { is5e: false } };

                    it("Reports true for a nested movement characteristic change", function () {
                        const changed = { system: { characteristics: { flight: { value: 0 } } } };
                        assert.isTrue(changedMovementCharacteristic(actor, changed));
                    });

                    it("Reports true for a flattened movement change path", function () {
                        const changed = { system: { characteristics: { "flight.value": 0 } } };
                        assert.isTrue(changedMovementCharacteristic(actor, changed));
                    });

                    it("Reports false for a characteristic that is not movement", function () {
                        const changed = { system: { characteristics: { strength: { value: 25 } } } };
                        assert.isFalse(changedMovementCharacteristic(actor, changed));
                    });

                    it("Reports false when no characteristic changed", function () {
                        assert.isFalse(changedMovementCharacteristic(actor, { name: "Renamed" }));
                    });

                    it("Reports false for an empty change", function () {
                        assert.isFalse(changedMovementCharacteristic(actor, {}));
                    });
                });

                describe("defaultMovementKey", function () {
                    it("Prefers running", function () {
                        assert.equal(defaultMovementKey(["flight", "running"]), "running");
                    });

                    it("Falls back to the first owned key when the actor cannot run", function () {
                        assert.equal(defaultMovementKey(["flight", "swimming"]), "flight");
                    });

                    it("Returns none when the actor owns no movement power", function () {
                        assert.equal(defaultMovementKey([]), "none");
                    });
                });

                describe("movementKeyForAction", function () {
                    let actor;

                    before(async function () {
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: true,
                            name: "Mode Resolve 5e",
                        });
                        await actor.updateCharacteristics([
                            ["flight", { value: 20 }],
                            ["gliding", { value: 10 }],
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Lowercases the uppercase HUD action key", function () {
                        assert.equal(movementKeyForAction(actor, "FLIGHT"), "flight");
                    });

                    it("Resolves a cleared selection to running", function () {
                        assert.equal(movementKeyForAction(actor, null), "running");
                    });

                    it("Resolves an empty selection to running", function () {
                        assert.equal(movementKeyForAction(actor, ""), "running");
                    });

                    it("Resolves an unowned action to the default mode", function () {
                        assert.equal(movementKeyForAction(actor, "TUNNELING"), "running");
                    });

                    it("Resolves to none when the actor owns no movement power", function () {
                        const owned = ownedMovementKeys(actor);
                        const stripped = {
                            system: { characteristics: {} },
                            getMovementCharacteristic: () => null,
                        };
                        assert.equal(movementKeyForAction(stripped, "FLIGHT"), "none");
                        assert.isNotEmpty(owned);
                    });
                });

                describe("actorMovementKey", function () {
                    let actor;

                    before(async function () {
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "Actor Mode 6e",
                        });
                        await actor.updateCharacteristics([["flight", { value: 20 }]]);
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Returns the default mode when no flag is stored", function () {
                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), undefined);
                        assert.equal(actorMovementKey(actor), "running");
                    });

                    it("Reads the stored flag", async function () {
                        await actor.update({ [activeMovementFlag()]: "flight" });
                        assert.equal(actorMovementKey(actor), "flight");
                    });

                    it("Falls back to the default when the stored key is no longer owned", async function () {
                        await actor.update({ [activeMovementFlag()]: "flight" });
                        await actor.updateCharacteristics([["flight", { value: 0 }]]);
                        assert.equal(actorMovementKey(actor), "running");
                        await actor.updateCharacteristics([["flight", { value: 20 }]]);
                    });

                    it("Falls back to the default when the stored key is not a string", async function () {
                        await actor.update({ [activeMovementFlag()]: 42 });
                        assert.equal(actorMovementKey(actor), "running");
                    });
                });

                describe("movementDisplayName", function () {
                    it("Falls back to the key for an unknown movement", function () {
                        assert.equal(movementDisplayName("notamovementpower"), "notamovementpower");
                    });
                });

                describe("asTokenDocument", function () {
                    let scene;
                    let actor;
                    let tokenDoc;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "Unwrap Token",
                        });
                        [tokenDoc] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Returns the document it was given", function () {
                        assert.equal(asTokenDocument(tokenDoc), tokenDoc);
                    });

                    it("Unwraps the canvas Token", function () {
                        assert.equal(asTokenDocument(canvas.tokens.get(tokenDoc.id)), tokenDoc);
                    });

                    it("Returns null for an actor", function () {
                        assert.isNull(asTokenDocument(actor));
                    });

                    it("Returns null for null", function () {
                        assert.isNull(asTokenDocument(null));
                    });
                });

                describe("tokenMovementKey", function () {
                    let scene;
                    let actor;
                    let tokenDoc;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "Token Mode 6e",
                        });
                        await actor.updateCharacteristics([["flight", { value: 20 }]]);
                        [tokenDoc] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Resolves the mode from a TokenDocument", async function () {
                        await tokenDoc.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(tokenMovementKey(tokenDoc), "flight");
                    });

                    it("Resolves the mode from a canvas Token", async function () {
                        await tokenDoc.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(tokenMovementKey(canvas.tokens.get(tokenDoc.id)), "flight");
                    });

                    it("Returns none for a token with no actor", function () {
                        assert.equal(tokenMovementKey(null), "none");
                    });
                });

                describe("Movement mode propagation", function () {
                    let scene1;
                    let scene2;
                    let actor;
                    let token1;
                    let token2;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene1 = await createQuenchScene({ quench: this });
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "Fanout 6e",
                        });
                        await actor.updateCharacteristics([["flight", { value: 20 }]]);
                        scene2 = await createQuenchScene({ quench: this });
                        [token1] = await scene1.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                        [token2] = await scene2.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 50,
                                y: 50,
                            },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Writes the mode to the actor flag", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "flight");
                    });

                    it("Writes the matching HUD key back to the originating token", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(token1._source.movementAction, "FLIGHT");
                    });

                    it("Fans the mode out to a token in another scene", async function () {
                        await token1.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();

                        assert.equal(token2._source.movementAction, "RUNNING");
                        assert.equal(tokenMovementKey(token2), "running");
                    });

                    it("Finds every linked token across scenes", function () {
                        const linked = linkedTokenDocuments(actor);
                        assert.includeMembers(
                            linked.map((t) => t.id),
                            [token1.id, token2.id],
                        );
                    });

                    it("Writes the actor once per player selection", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        let actorWrites = 0;
                        const hookId = Hooks.on("updateActor", (updated) => {
                            if (updated.id === actor.id) {
                                actorWrites += 1;
                            }
                        });

                        await token1.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();
                        Hooks.off("updateActor", hookId);

                        assert.equal(actorWrites, 1);
                    });

                    it("Skips propagation for a fan-out write", async function () {
                        const options = {};
                        options[MOVEMENT_SYNC_OPTION] = true;

                        let actorWrites = 0;
                        const hookId = Hooks.on("updateActor", (updated) => {
                            if (updated.id === actor.id) {
                                actorWrites += 1;
                            }
                        });

                        token1._onUpdate({ movementAction: "FLIGHT" }, options, game.user.id);
                        await movementPropagationSettled();
                        Hooks.off("updateActor", hookId);

                        assert.equal(actorWrites, 0);
                    });

                    it("Propagates a change another client made", async function () {
                        // The GM owns propagation, so a player's click still reaches the actor and the other
                        // scenes even when the player cannot write them.
                        token1._onUpdate({ movementAction: "FLIGHT" }, {}, "someOtherUserId");
                        await movementPropagationSettled();

                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "flight");
                        assert.equal(token2._source.movementAction, "FLIGHT");
                    });

                    it("Ignores an update that does not touch movementAction", async function () {
                        let actorWrites = 0;
                        const hookId = Hooks.on("updateActor", (updated) => {
                            if (updated.id === actor.id) {
                                actorWrites += 1;
                            }
                        });

                        token1._onUpdate({ name: "Renamed" }, {}, game.user.id);
                        await movementPropagationSettled();
                        Hooks.off("updateActor", hookId);

                        assert.equal(actorWrites, 0);
                    });

                    it("Resolves a cleared selection to running on every token", async function () {
                        await token1.update({ movementAction: null });
                        await movementPropagationSettled();

                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "running");
                        assert.equal(token1._source.movementAction, "RUNNING");
                        assert.equal(token2._source.movementAction, "RUNNING");
                    });

                    it("Resolves an unowned HUD action to the default mode", async function () {
                        await token1.update({ movementAction: "TUNNELING" });
                        await movementPropagationSettled();

                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "running");
                        assert.equal(tokenMovementKey(token1), "running");
                    });

                    it("Falls back to running when the selected power is drained", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(tokenMovementKey(token1), "flight");

                        await actor.updateCharacteristics([["flight", { value: 0 }]]);
                        await movementPropagationSettled();

                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "running");
                        assert.equal(token1._source.movementAction, "RUNNING");
                        assert.equal(token2._source.movementAction, "RUNNING");

                        await actor.updateCharacteristics([["flight", { value: 20 }]]);
                        await movementPropagationSettled();
                    });

                    it("Stores none and clears every HUD key when no movement power is left", async function () {
                        // Drain every movement power the actor owns. A pc owns swimming too, so leaving one
                        // behind would resolve to that mode instead of none.
                        const movementKeys = ownedMovementKeys(actor);
                        const originalValues = movementKeys.map((key) => actor.getMovementCharacteristic(key).value);

                        try {
                            await token1.update({ movementAction: "FLIGHT" });
                            await movementPropagationSettled();

                            await actor.updateCharacteristics(movementKeys.map((key) => [key, { value: 0 }]));
                            await movementPropagationSettled();

                            assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "none");
                            assert.equal(token1._source.movementAction, MOVEMENT_NONE_ACTION);
                            assert.equal(token2._source.movementAction, MOVEMENT_NONE_ACTION);
                            assert.equal(calculateVelocityInSystemUnits(2, token1, "RUNNING"), 0);
                        } finally {
                            const restored = movementKeys.map((key, index) => [key, { value: originalValues[index] }]);

                            await actor.updateCharacteristics(restored);
                            await movementPropagationSettled();
                        }
                    });

                    it("Syncs every token when a hook cancels the actor write", async function () {
                        // Foundry drops a cancelled write silently. The tokens must still converge, so the
                        // fan-out runs whether or not the actor kept the mode.
                        const hookId = Hooks.on("preUpdateActor", (updated) => updated.id !== actor.id);

                        try {
                            await token1.update({ movementAction: "FLIGHT" });
                            await movementPropagationSettled();
                        } finally {
                            Hooks.off("preUpdateActor", hookId);
                        }

                        assert.equal(token1._source.movementAction, "FLIGHT");
                        assert.equal(token2._source.movementAction, "FLIGHT");
                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), undefined);
                    });

                    it("Leaves the actor untouched when propagateMovementMode has no token", async function () {
                        await propagateMovementMode(null, "FLIGHT");
                        await movementPropagationSettled();
                        assert.isNotEmpty(foundry.utils.getProperty(actor, activeMovementFlag()));
                    });
                });

                describe("Unlinked token movement mode", function () {
                    let scene;
                    let baseActor;
                    let token1;
                    let token2;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        baseActor = await createQuenchActor({ quench: this, is5e: false, name: "Fanout Mook 6e" });
                        await baseActor.updateCharacteristics([["flight", { value: 20 }]]);
                        [token1, token2] = await scene.createEmbeddedDocuments("Token", [
                            { name: "Mook one", actorId: baseActor.id, actorLink: false, x: 0, y: 0 },
                            { name: "Mook two", actorId: baseActor.id, actorLink: false, x: 50, y: 0 },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor: baseActor });
                    });

                    it("Stores the mode on the token delta", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        assert.equal(foundry.utils.getProperty(token1.actor, activeMovementFlag()), "flight");
                        assert.equal(tokenMovementKey(token1), "flight");
                        assert.equal(calculateVelocityInSystemUnits(2, token1, "RUNNING"), 40);
                    });

                    it("Leaves the base actor and the sibling token alone", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        assert.equal(baseActor.getFlag("hero6efoundryvttv2", "activeMovement"), undefined);
                        assert.equal(token2._source.movementAction, "RUNNING");
                        assert.equal(tokenMovementKey(token2), "running");
                    });

                    it("Gives each unlinked token its own mode", async function () {
                        await token1.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        await token2.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();

                        assert.equal(tokenMovementKey(token1), "flight");
                        assert.equal(tokenMovementKey(token2), "running");
                    });

                    it("Re-resolves only that token when its own power is drained", async function () {
                        const siblingAction = token2._source.movementAction;

                        try {
                            await token1.update({ movementAction: "FLIGHT" });
                            await movementPropagationSettled();

                            await token1.actor.updateCharacteristics([["flight", { value: 0 }]]);
                            await movementPropagationSettled();

                            assert.equal(tokenMovementKey(token1), "running");
                            assert.equal(token1._source.movementAction, "RUNNING");
                            assert.equal(token2._source.movementAction, siblingAction);
                        } finally {
                            await token1.actor.updateCharacteristics([["flight", { value: 20 }]]);
                            await movementPropagationSettled();
                        }
                    });
                });

                describe("Actor with no movement power", function () {
                    let scene;
                    let actor;
                    let tokenDoc;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        // A base2 actor has no movement characteristic at all.
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            actorType: "base2",
                            name: "No Movement base2",
                        });
                        [tokenDoc] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                        await viewSceneAndWait(scene);
                    });

                    after(async function () {
                        await releaseTokenHud();
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Resolves no mode for the actor and its token", function () {
                        assert.deepEqual(ownedMovementKeys(actor), []);
                        assert.equal(actorMovementKey(actor), "none");
                        assert.equal(tokenMovementKey(tokenDoc), "none");
                    });

                    it("Gives zero velocity", function () {
                        assert.equal(calculateVelocityInSystemUnits(tokenDoc), 0);
                    });

                    it("Stores the no-movement action on every token of the actor", async function () {
                        await tokenDoc.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        // The mode is none, so the token holds the registered action worth 0 distance.
                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "none");
                        assert.equal(tokenDoc._source.movementAction, MOVEMENT_NONE_ACTION);
                    });

                    it("Writes nothing on the next propagation", async function () {
                        await tokenDoc.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        let tokenWrites = 0;
                        const hookId = Hooks.on("updateToken", (updated) => {
                            if (updated.id === tokenDoc.id) {
                                tokenWrites += 1;
                            }
                        });

                        await propagateMovementMode(tokenDoc, "FLIGHT");
                        Hooks.off("updateToken", hookId);

                        assert.equal(tokenWrites, 0);
                    });

                    it("Offers one No movement entry and keeps the control visible", async function () {
                        const hud = await bindTokenHud(canvas.tokens.get(tokenDoc.id));
                        const entries = hudMovementEntries(hud);

                        assert.equal(entries.length, 1);
                        assert.equal(entries[0].key, MOVEMENT_NONE_ACTION);
                        assert.equal(entries[0].label, "No movement");
                        assert.include(entries[0].icon, "fa-ban");
                        assert.isTrue(entries[0].active);

                        const toggle = hud.element.querySelector(
                            '[data-action="togglePalette"][data-palette="movementActions"]',
                        );
                        assert.notEqual(toggle.style.display, "none");
                        assert.include(toggle.querySelector("i")?.className ?? "", "fa-ban");
                    });

                    it("Reports a maximum distance of 0 for the held action", function () {
                        const action = CONFIG.Token.movement.actions[tokenDoc._source.movementAction];

                        assert.equal(action.maxCombatDistanceMeters(tokenDoc), 0);
                        assert.equal(action.maxNonCombatDistanceMeters(tokenDoc), 0);
                    });
                });

                describe("No movement action", function () {
                    const noneAction = () => CONFIG.Token.movement.actions[MOVEMENT_NONE_ACTION];
                    const mover = { system: { characteristics: { running: { value: 6 } } } };

                    it("Never lets a player select it", function () {
                        assert.isFalse(noneAction().canSelect(mover));
                    });

                    it("Resolves the action key back to none, even for an actor who can move", function () {
                        assert.equal(movementKeyForAction(mover, MOVEMENT_NONE_ACTION), "none");
                    });
                });

                describe("New token movement action", function () {
                    let scene;
                    let runner;
                    let immobile;
                    let runnerToken;
                    let immobileToken;

                    before(async function () {
                        await waitForNotificationQueueToClear();

                        scene = await createQuenchScene({ quench: this });
                        await viewSceneAndWait(scene);
                        runner = await createQuenchActor({ quench: this, is5e: false, name: "Seeded Runner" });
                        immobile = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            actorType: "base2",
                            name: "Seeded Immobile",
                        });

                        [runnerToken, immobileToken] = await scene.createEmbeddedDocuments("Token", [
                            { name: "Runner", actorId: runner.id, actorLink: true, x: 0, y: 0 },
                            { name: "Immobile", actorId: immobile.id, actorLink: true, x: 20, y: 0 },
                        ]);
                        await movementPropagationSettled();
                    });

                    after(async function () {
                        releaseTokenHud();
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor: runner });
                        await deleteQuenchActor({ quench: this, actor: immobile });
                    });

                    it("Gives a new token of a mover the actor mode", function () {
                        assert.equal(runnerToken._source.movementAction, "RUNNING");
                    });

                    it("Gives a new token that cannot move the no-movement action", function () {
                        assert.equal(immobileToken._source.movementAction, MOVEMENT_NONE_ACTION);
                    });

                    it("Reports the running distance for the mover", function () {
                        const action = CONFIG.Token.movement.actions[runnerToken._source.movementAction];

                        assert.isAbove(action.maxCombatDistanceMeters(runnerToken), 0);
                        assert.isAbove(action.maxNonCombatDistanceMeters(runnerToken), 0);
                    });

                    it("Keeps a mode another token of the same actor chose", async function () {
                        await runnerToken.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        const [secondToken] = await scene.createEmbeddedDocuments("Token", [
                            { name: "Runner 2", actorId: runner.id, actorLink: true, x: 40, y: 0 },
                        ]);
                        await movementPropagationSettled();

                        assert.equal(secondToken._source.movementAction, "FLIGHT");
                    });
                });

                describe("Movement drained while the HUD is open", function () {
                    let scene;
                    let actor;
                    let tokenDoc;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        actor = await createQuenchActor({ quench: this, is5e: false, name: "Drained Movement" });
                        await actor.updateCharacteristics([["flight", { value: 20 }]]);
                        [tokenDoc] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                        await viewSceneAndWait(scene);
                    });

                    after(async function () {
                        await releaseTokenHud();
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Shows No movement once an effect drains the last power", async function () {
                        const hud = await bindTokenHud(canvas.tokens.get(tokenDoc.id));

                        await clickHudMovementAction(hud, "FLIGHT");
                        await movementPropagationSettled();
                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "flight");

                        const movementKeys = ownedMovementKeys(actor);
                        await actor.updateCharacteristics(movementKeys.map((key) => [key, { value: 0 }]));
                        await movementPropagationSettled();

                        assert.equal(foundry.utils.getProperty(actor, activeMovementFlag()), "none");
                        assert.equal(tokenDoc._source.movementAction, MOVEMENT_NONE_ACTION);

                        const settled = await waitForHudMovementEntryCount(hud, 1);
                        assert.isTrue(
                            settled,
                            `Palette: ${hudMovementEntries(hud)
                                .map((e) => e.label)
                                .join(", ")}`,
                        );

                        const [entry] = hudMovementEntries(hud);
                        assert.equal(entry.label, "No movement");
                        assert.isTrue(entry.active);
                    });
                });

                describe("Token HUD movement selection (real click)", function () {
                    let sceneA;
                    let sceneB;
                    let actor;
                    let attacker;
                    let attackItem;
                    let previousKnockbackSetting;

                    before(async function () {
                        previousKnockbackSetting = await getAndSetGameSetting("knockback", true);
                        await waitForNotificationQueueToClear();

                        actor = await createQuenchActor({
                            quench: this,
                            is5e: true,
                            name: "HUD Click 5e",
                        });
                        await actor.fullHealth();
                        await actor.updateCharacteristics([
                            ["flight", { value: 20 }],
                            ["gliding", { value: 10 }],
                        ]);

                        attacker = await createQuenchActor({
                            quench: this,
                            is5e: true,
                            name: "HUD Click Attacker 5e",
                        });
                        [attackItem] = await HeroSystem6eItem.createDocuments(
                            [HeroSystem6eItem.itemDataFromXml(ENERGY_BLAST_XML, attacker)],
                            { parent: attacker },
                        );

                        sceneA = await createQuenchScene({ quench: this, name: "_Quench_HUD_A" });
                        sceneB = await createQuenchScene({ quench: this, name: "_Quench_HUD_B" });

                        await sceneA.createEmbeddedDocuments("Token", [
                            { name: "HudOne", actorId: actor.id, actorLink: true, x: 100, y: 100 },
                            { name: "HudTwo", actorId: actor.id, actorLink: true, x: 400, y: 100 },
                        ]);
                        await sceneB.createEmbeddedDocuments("Token", [
                            { name: "HudFar", actorId: actor.id, actorLink: true, x: 200, y: 200 },
                        ]);

                        await viewSceneAndWait(sceneA);
                    });

                    after(async function () {
                        await releaseTokenHud();
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor: attacker });
                        await deleteQuenchActor({ quench: this, actor });
                        await getAndSetGameSetting("knockback", previousKnockbackSetting);
                    });

                    // A failed assertion can leave the canvas on scene B or the HUD bound to a stale token.
                    // Reset both so each test starts from a known state and reports its own cause.
                    beforeEach(async function () {
                        await releaseTokenHud();
                        await viewSceneAndWait(sceneA);
                    });

                    it("Writes the chosen mode to the actor", async function () {
                        const hud = await bindTokenHud(canvas.tokens.placeables.find((t) => t.name === "HudOne"));

                        await clickHudMovementAction(hud, "FLIGHT");

                        assert.isTrue(
                            await waitForActorMovementFlag(actor, "flight"),
                            "actor flag should read flight after the HUD click",
                        );
                    });

                    it("Marks the clicked button active on that token's own HUD", async function () {
                        const token = canvas.tokens.placeables.find((t) => t.name === "HudOne");
                        const hud = await bindTokenHud(token);

                        await clickHudMovementAction(hud, "GLIDING");
                        assert.isTrue(await waitForActorMovementFlag(actor, "gliding"));

                        await bindTokenHud(token);
                        assert.deepEqual(hudActiveMovementActions(hud), ["GLIDING"]);
                    });

                    it("Highlights the mode on a second token in the same scene", async function () {
                        const hud = await bindTokenHud(canvas.tokens.placeables.find((t) => t.name === "HudOne"));

                        await clickHudMovementAction(hud, "FLIGHT");
                        assert.isTrue(await waitForActorMovementFlag(actor, "flight"));

                        const otherToken = canvas.tokens.placeables.find((t) => t.name === "HudTwo");
                        assert.equal(otherToken.document._source.movementAction, "FLIGHT");

                        const otherHud = await bindTokenHud(otherToken);
                        assert.deepEqual(hudActiveMovementActions(otherHud), ["FLIGHT"]);
                    });

                    it("Highlights the mode on a token in another scene", async function () {
                        await viewSceneAndWait(sceneB);
                        const farHud = await bindTokenHud(canvas.tokens.placeables.find((t) => t.name === "HudFar"));

                        await clickHudMovementAction(farHud, "GLIDING");
                        assert.isTrue(await waitForActorMovementFlag(actor, "gliding"));

                        await viewSceneAndWait(sceneA);

                        const firstHud = await bindTokenHud(canvas.tokens.placeables.find((t) => t.name === "HudOne"));
                        assert.deepEqual(hudActiveMovementActions(firstHud), ["GLIDING"]);

                        const secondHud = await bindTokenHud(canvas.tokens.placeables.find((t) => t.name === "HudTwo"));
                        assert.deepEqual(hudActiveMovementActions(secondHud), ["GLIDING"]);
                    });

                    it("Offers no Default entry", async function () {
                        const token = canvas.tokens.placeables.find((t) => t.name === "HudOne");
                        const hud = await bindTokenHud(token);

                        // Core prepends a Default entry. HERO holds the mode on the actor, so the palette
                        // must not offer a selection that resolves to another mode. A player must not be able
                        // to pick the state for a character who can move.
                        assert.notInclude(hudMovementActionKeys(hud), "");
                        assert.notInclude(hudMovementActionKeys(hud), MOVEMENT_NONE_ACTION);
                    });

                    it("Reapplies the actor mode when a script clears the selection", async function () {
                        const token = canvas.tokens.placeables.find((t) => t.name === "HudOne");
                        const hud = await bindTokenHud(token);

                        await clickHudMovementAction(hud, "FLIGHT");
                        assert.isTrue(await waitForActorMovementFlag(actor, "flight"));

                        // The token configuration sheet still writes null. The actor mode must land back on
                        // running and the token must carry the matching HUD key.
                        await token.document.update({ movementAction: null });
                        assert.isTrue(await waitForActorMovementFlag(actor, "running"));

                        await bindTokenHud(token);
                        assert.deepEqual(hudActiveMovementActions(hud), ["RUNNING"]);
                    });

                    it("Drives the knockback airborne modifier through a real HUD click", async function () {
                        const targetToken = canvas.tokens.placeables.find((t) => t.name === "HudOne");
                        const hud = await bindTokenHud(targetToken);

                        await clickHudMovementAction(hud, "RUNNING");
                        assert.isTrue(await waitForActorMovementFlag(actor, "running"));
                        const grounded = await _calcKnockback(3, attackItem, { targetToken }, 1);
                        assert.isEmpty(airborneTags(grounded));

                        await clickHudMovementAction(hud, "FLIGHT");
                        assert.isTrue(await waitForActorMovementFlag(actor, "flight"));
                        const airborne = await _calcKnockback(3, attackItem, { targetToken }, 1);

                        assert.lengthOf(airborneTags(airborne), 1);
                        assert.equal(airborne.knockbackRoller.getFormula(), "3 - 1d6");
                    });
                });

                describe("Velocity follows the movement mode", function () {
                    let scene;
                    let actor;
                    let tokenDoc;

                    before(async function () {
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        actor = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "Velocity 6e",
                        });
                        await actor.updateCharacteristics([
                            ["running", { value: 12 }],
                            ["flight", { value: 40 }],
                        ]);
                        [tokenDoc] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: actor.name,
                                actorId: actor.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("Uses the running value while the mode is running", async function () {
                        await tokenDoc.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();
                        assert.equal(calculateVelocityInSystemUnits(tokenDoc), 12);
                    });

                    it("Uses the flight value while the mode is flight", async function () {
                        await tokenDoc.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(calculateVelocityInSystemUnits(tokenDoc), 40);
                    });

                    it("Gives the token and the actor the same answer", async function () {
                        await tokenDoc.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        assert.equal(calculateVelocityInSystemUnits(tokenDoc), calculateVelocityInSystemUnits(actor));
                    });

                    it("Gives the canvas Token and the actor the same answer", async function () {
                        await tokenDoc.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();
                        assert.equal(
                            calculateVelocityInSystemUnits(canvas.tokens.get(tokenDoc.id)),
                            calculateVelocityInSystemUnits(actor),
                        );
                    });
                });

                describe("Knockback dice for an airborne target", function () {
                    let scene;
                    let attacker;
                    let target;
                    let targetToken;
                    let attackItem;
                    let previousKnockbackSetting;

                    before(async function () {
                        previousKnockbackSetting = await getAndSetGameSetting("knockback", true);
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        attacker = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "KB Attacker",
                        });
                        target = await createQuenchActor({
                            quench: this,
                            is5e: false,
                            name: "KB Target",
                        });
                        await target.updateCharacteristics([["flight", { value: 20 }]]);
                        [attackItem] = await HeroSystem6eItem.createDocuments(
                            [HeroSystem6eItem.itemDataFromXml(ENERGY_BLAST_XML, attacker)],
                            { parent: attacker },
                        );
                        [targetToken] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: target.name,
                                actorId: target.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor: attacker });
                        await deleteQuenchActor({ quench: this, actor: target });
                        await getAndSetGameSetting("knockback", previousKnockbackSetting);
                    });

                    it("Applies -1d6 while the target flies", async function () {
                        await targetToken.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);
                        const tags = airborneTags(result);

                        assert.lengthOf(tags, 1);
                        assert.equal(tags[0].value, "-1d6KB");
                    });

                    it("Names the movement mode in the tag title", async function () {
                        await targetToken.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);

                        assert.include(airborneTags(result)[0].title, "Flight");
                    });

                    it("Removes the modifier when the target lands", async function () {
                        await targetToken.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);

                        assert.isEmpty(airborneTags(result));
                    });

                    it("Drops one knockback die from the formula", async function () {
                        await targetToken.update({ movementAction: "RUNNING" });
                        await movementPropagationSettled();
                        const grounded = await _calcKnockback(3, attackItem, { targetToken }, 1);

                        await targetToken.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();
                        const airborne = await _calcKnockback(3, attackItem, { targetToken }, 1);

                        assert.equal(grounded.knockbackRoller.getFormula(), "3 - 2d6");
                        assert.equal(airborne.knockbackRoller.getFormula(), "3 - 1d6");
                    });

                    it("Applies the modifier through a second token of the same actor", async function () {
                        const [otherToken] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: target.name,
                                actorId: target.id,
                                actorLink: true,
                                x: 200,
                                y: 0,
                            },
                        ]);

                        await otherToken.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken: otherToken }, 1);
                        assert.lengthOf(airborneTags(result), 1);

                        // The first token sees the same mode, because the actor holds it.
                        assert.equal(tokenMovementKey(targetToken), "flight");
                        await otherToken.delete();
                    });

                    it("Applies the modifier while the target leaps", async function () {
                        await targetToken.update({ movementAction: "LEAPING" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);

                        assert.lengthOf(airborneTags(result), 1);
                        assert.include(airborneTags(result)[0].title, "Leaping");
                    });

                    it("Applies the modifier while the target swings on a line", async function () {
                        await target.updateCharacteristics([["swinging", { value: 10 }]]);

                        try {
                            await targetToken.update({ movementAction: "SWINGING" });
                            await movementPropagationSettled();

                            const result = await _calcKnockback(3, attackItem, { targetToken }, 1);

                            assert.lengthOf(airborneTags(result), 1);
                        } finally {
                            await targetToken.update({ movementAction: "RUNNING" });
                            await target.updateCharacteristics([["swinging", { value: 0 }]]);
                            await movementPropagationSettled();
                        }
                    });

                    it("Applies no modifier when the flight power is drained", async function () {
                        await targetToken.update({ movementAction: "FLIGHT" });
                        await movementPropagationSettled();

                        await target.updateCharacteristics([["flight", { value: 0 }]]);
                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);
                        assert.isEmpty(airborneTags(result));

                        await target.updateCharacteristics([["flight", { value: 20 }]]);
                    });
                });

                describe("Knockback dice for a gliding target", function () {
                    let scene;
                    let attacker;
                    let target;
                    let targetToken;
                    let attackItem;
                    let previousKnockbackSetting;

                    before(async function () {
                        previousKnockbackSetting = await getAndSetGameSetting("knockback", true);
                        await waitForNotificationQueueToClear();
                        scene = await createQuenchScene({ quench: this });
                        attacker = await createQuenchActor({
                            quench: this,
                            is5e: true,
                            name: "Glide Attacker 5e",
                        });
                        target = await createQuenchActor({
                            quench: this,
                            is5e: true,
                            name: "Glider Target 5e",
                        });
                        await target.updateCharacteristics([["gliding", { value: 10 }]]);
                        [attackItem] = await HeroSystem6eItem.createDocuments(
                            [HeroSystem6eItem.itemDataFromXml(ENERGY_BLAST_XML, attacker)],
                            { parent: attacker },
                        );
                        [targetToken] = await scene.createEmbeddedDocuments("Token", [
                            {
                                name: target.name,
                                actorId: target.id,
                                actorLink: true,
                                x: 0,
                                y: 0,
                            },
                        ]);
                    });

                    after(async function () {
                        await deleteQuenchScenes();
                        await deleteQuenchActor({ quench: this, actor: attacker });
                        await deleteQuenchActor({ quench: this, actor: target });
                        await getAndSetGameSetting("knockback", previousKnockbackSetting);
                    });

                    it("Applies -1d6 while the target glides", async function () {
                        await targetToken.update({ movementAction: "GLIDING" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);
                        const tags = airborneTags(result);

                        assert.lengthOf(tags, 1);
                        assert.include(tags[0].title, "Gliding");
                    });

                    it("Drops one knockback die from the formula", async function () {
                        await targetToken.update({ movementAction: "GLIDING" });
                        await movementPropagationSettled();

                        const result = await _calcKnockback(3, attackItem, { targetToken }, 1);
                        assert.equal(result.knockbackRoller.getFormula(), "3 - 1d6");
                    });
                });
            });
        },
        { displayName: "HERO: Movement Mode" },
    );
}
