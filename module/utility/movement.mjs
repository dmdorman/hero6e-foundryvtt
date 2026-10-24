/**
 * Movement mode ownership, resolution, and propagation.
 *
 * The actor is the source of truth for the active movement mode. The actor also owns the movement
 * characteristics, so capability and selection live together. A character is one body in Hero, so
 * one mode applies to that character no matter how many tokens represent it.
 *
 * The token HUD writes its selection to `TokenDocument#movementAction`, and it reads that same
 * persisted field to highlight the current choice. The HUD reads `_source.movementAction` directly,
 * so a derived getter cannot make the HUD agree across tokens. Instead, every movement write fans out:
 * the actor flag and every linked token receive the same value. Each token HUD then shows the same
 * selection because each token carries the same value.
 *
 * The HUD registers its action keys in uppercase, such as `FLIGHT` and `GLIDING`. Characteristic keys
 * are lowercase, such as `flight` and `gliding`. The helpers below convert between the two.
 */

/**
 * Movement modes that place the character in the air.
 *
 * @type {ReadonlyArray<string>}
 */
export const AIRBORNE_MOVEMENT_KEYS = Object.freeze(["flight", "gliding"]);

/**
 * Return the actor flag path that holds the active movement characteristic key.
 *
 * Computed lazily. `game.system.id` does not exist when this module is first evaluated, so a top-level
 * constant built from it throws and takes the whole module down with it.
 *
 * @returns {string} A Foundry property path, for example `"flags.hero6efoundryvttv2.activeMovement"`.
 */
export function activeMovementFlag() {
    return `flags.${game.system.id || "hero6efoundryvttv2"}.activeMovement`;
}

/**
 * Return the movement characteristic keys the actor owns, in schema order.
 *
 * An actor owns a movement characteristic when its value is greater than zero. A drained power drops
 * out of the list, so a caller never resolves to a mode the actor cannot use.
 *
 * @param {HeroSystem6eActor} actor Actor to read.
 *
 * @returns {string[]} Characteristic keys, for example ["running", "flight"].
 */
export function ownedMovementKeys(actor) {
    const characteristics = actor?.system?.characteristics;

    if (!characteristics) {
        return [];
    }

    const movementPowers = actor.system.is5e ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers;

    const movementKeys = Object.keys(characteristics).filter((key) => movementPowers[key]);

    return movementKeys.filter((key) => {
        const value = parseInt(actor.getMovementCharacteristic(key)?.value) || 0;

        return value > 0;
    });
}

/**
 * Return the display name for a movement characteristic key.
 *
 * @param {string} movementKey A movement characteristic key, for example `"flight"`.
 *
 * @returns {string} The display name, for example `"Flight"`. Falls back to the key itself.
 */
export function movementDisplayName(movementKey) {
    const allMovementPowers = CONFIG.HERO.movementPowers5e ?? CONFIG.HERO.movementPowers;

    return allMovementPowers?.[movementKey] ?? movementKey;
}

/**
 * Return the key to use when no specific mode is selected.
 *
 * A cleared selection means moving on foot, so running wins when the actor owns it. A character who
 * cannot run falls back to the first movement power the actor owns.
 *
 * @param {string[]} ownedKeys Movement keys the actor owns, from `ownedMovementKeys`.
 *
 * @returns {string} A movement key, or `"none"` when the actor owns no movement power.
 */
export function defaultMovementKey(ownedKeys) {
    if (ownedKeys.length === 0) {
        return "none";
    }

    return ownedKeys.includes("running") ? "running" : ownedKeys[0];
}

/**
 * Resolve a token HUD action to a movement characteristic key the actor can use.
 *
 * The HUD sends an uppercase action key such as `"FLIGHT"`, or `null` when the player picks Default.
 * A cleared selection resolves to running. A selection the actor does not own resolves to the default
 * mode, which covers a power drained to zero since the player made the selection.
 *
 * @param {HeroSystem6eActor} actor Actor the selection applies to.
 * @param {string|null} movementAction The HUD action key, or null for Default.
 *
 * @returns {string} A movement characteristic key the actor owns, or `"none"`.
 */
export function movementKeyForAction(actor, movementAction) {
    const ownedKeys = ownedMovementKeys(actor);

    if (ownedKeys.length === 0) {
        return "none";
    }

    if (typeof movementAction === "string" && movementAction !== "") {
        const movementKey = movementAction.toLowerCase();

        if (ownedKeys.includes(movementKey)) {
            return movementKey;
        }
    }

    return defaultMovementKey(ownedKeys);
}

/**
 * Return the TokenDocument behind a handle, or null when the handle is not a token.
 *
 * Accepts a canvas `Token` or a `TokenDocument`. A canvas Token carries its document one level down.
 *
 * @param {HeroSystem6eToken|HeroSystem6eTokenDocument|null} handle The handle to unwrap.
 *
 * @returns {HeroSystem6eTokenDocument|null} The token document, or null when the handle is not a token.
 */
export function asTokenDocument(handle) {
    if (handle instanceof foundry.documents.TokenDocument) {
        return handle;
    }

    if (handle?.document instanceof foundry.documents.TokenDocument) {
        return handle.document;
    }

    return null;
}

/**
 * Resolve the movement characteristic key an actor uses.
 *
 * Reads the actor flag written by `propagateMovementMode`. A stored key that the actor no longer owns
 * falls back to the default mode, so a drained power cannot leave the actor reporting a mode it cannot
 * use.
 *
 * @param {HeroSystem6eActor} actor Actor to read.
 *
 * @returns {string} A movement characteristic key, or `"none"` when the actor owns no movement power.
 */
export function actorMovementKey(actor) {
    const ownedKeys = ownedMovementKeys(actor);

    if (ownedKeys.length === 0) {
        return "none";
    }

    const storedKey = foundry.utils.getProperty(actor, activeMovementFlag());

    if (typeof storedKey === "string" && ownedKeys.includes(storedKey)) {
        return storedKey;
    }

    return defaultMovementKey(ownedKeys);
}

/**
 * Resolve the movement characteristic key a token uses.
 *
 * The actor holds the mode, so this reads the actor behind the token. Every linked token stays in sync
 * with the actor, so the answer does not depend on which token the caller holds.
 *
 * @param {HeroSystem6eToken|HeroSystem6eTokenDocument} token Token to read. Either form.
 *
 * @returns {string} A movement characteristic key, or `"none"` when the token has no actor.
 */
export function tokenMovementKey(token) {
    const tokenDocument = asTokenDocument(token);

    return actorMovementKey(tokenDocument?.actor);
}

/**
 * Return every token document linked to an actor, across all scenes.
 *
 * Foundry 14 has no `actor.getTokenDocuments()`. The scene documents hold the token documents, so walk
 * the scene collection.
 *
 * @param {HeroSystem6eActor} actor Actor to search for.
 *
 * @returns {HeroSystem6eTokenDocument[]} Token documents, one per token of that actor.
 */
export function linkedTokenDocuments(actor) {
    if (!actor) {
        return [];
    }

    return game.scenes.contents.flatMap((scene) => scene.tokens.filter((token) => token.actorId === actor.id));
}

/**
 * Serialize propagation so overlapping changes cannot interleave.
 *
 * A player can change the mode again before an earlier propagation finishes. Running both at once lets
 * an older write land after a newer one and leave the actor and its tokens on a stale mode. Chaining each
 * propagation behind the previous one keeps the last change last.
 *
 * @type {Promise<void>}
 */
let propagationChain = Promise.resolve();

/**
 * Queue a movement mode propagation behind any propagation already in flight.
 *
 * `_onUpdate` cannot await the propagation, so callers get ordering rather than completion. Await the
 * returned promise when you need to know the actor and its tokens are in sync.
 *
 * @param {HeroSystem6eTokenDocument} sourceTokenDocument The token whose movementAction changed.
 * @param {string|null} movementAction The new HUD action key, or null for Default.
 *
 * @returns {Promise<void>} Resolves when this propagation and any it waited behind have finished.
 */
export function queuePropagateMovementMode(sourceTokenDocument, movementAction) {
    propagationChain = propagationChain
        .then(() => propagateMovementMode(sourceTokenDocument, movementAction))
        .catch((error) => {
            console.warn(`Hero System 6e: movement mode propagation failed: ${error.message}`, error);
        });

    return propagationChain;
}

/**
 * Return a promise that resolves once the propagation queue has fully drained.
 *
 * Each propagation queues one follow-up round that finds nothing left to write. Awaiting a snapshot of
 * the chain returns before that follow-up runs, so this loops until the chain reference stops changing.
 * Use it to read a settled state instead of guessing at a delay.
 *
 * @returns {Promise<void>} Resolves when no propagation remains in flight.
 */
export async function movementPropagationSettled() {
    let previousChain = null;

    while (previousChain !== propagationChain) {
        previousChain = propagationChain;
        await previousChain;
    }
}

/**
 * Update option that marks a write as part of our own movement fan-out.
 *
 * A fan-out write lands on sibling tokens, and each of those writes would otherwise trigger another
 * propagation. That follow-up finds the actor already correct and writes it again. Tagging the fan-out
 * writes lets `_onUpdate` skip them, so one player action costs one actor write.
 *
 * @type {string}
 */
export const MOVEMENT_SYNC_OPTION = "heroSystem6eMovementSync";

/**
 * Propagate a movement mode to the actor and to every token linked to that actor.
 *
 * The actor flag is the authoritative record. Each linked token also receives the matching HUD action
 * key, because the token HUD highlights from the token's own persisted value. Writing every linked
 * token makes each HUD show the same selection.
 *
 * The originating token is part of the fan-out. That lets a cleared selection land on `RUNNING`
 * instead of staying `null`, so the actor always holds a valid mode.
 *
 * Guards make this converge. A write only happens when the stored value differs, so the follow-up
 * updates this function triggers find nothing left to change and stop.
 *
 * @param {HeroSystem6eTokenDocument} sourceTokenDocument The token whose movementAction changed.
 * @param {string|null} movementAction The new HUD action key, or null for Default.
 *
 * @returns {Promise<void>} Resolves when the actor and every linked token are in sync.
 */
export async function propagateMovementMode(sourceTokenDocument, movementAction) {
    const actor = sourceTokenDocument?.actor;

    if (!actor) {
        return;
    }

    const movementKey = movementKeyForAction(actor, movementAction);
    const actionKey = movementKey.toUpperCase();

    if (foundry.utils.getProperty(actor, activeMovementFlag()) !== movementKey) {
        await actor.update({ [activeMovementFlag()]: movementKey });
    }

    // Compare the stored value, not the getter. The getter infers RUNNING for a null selection, which
    // would hide a token that still needs the explicit value written. The HUD highlights from the stored
    // value too, so writing it explicitly keeps every token HUD identical.
    const staleTokens = linkedTokenDocuments(actor).filter((token) => token._source.movementAction !== actionKey);

    if (staleTokens.length === 0) {
        return;
    }

    // TokenDocument.updateDocuments takes one parent scene, so group the writes by scene.
    const updatesByScene = new Map();

    for (const token of staleTokens) {
        const updates = updatesByScene.get(token.parent.id) ?? [];
        updates.push({ _id: token.id, movementAction: actionKey });
        updatesByScene.set(token.parent.id, updates);
    }

    for (const [sceneId, updates] of updatesByScene) {
        const scene = game.scenes.get(sceneId);
        const options = {};
        options[MOVEMENT_SYNC_OPTION] = true;

        try {
            await foundry.documents.TokenDocument.updateDocuments(updates, { parent: scene, ...options });
        } catch (error) {
            // A player who lacks permission for another scene's token must not break their own selection.
            console.warn(
                `Hero System 6e: could not sync movement mode "${movementKey}" to scene "${scene?.name}": ${error.message}`,
            );
        }
    }
}
