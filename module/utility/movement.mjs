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
 *
 * The mode `"none"` means the actor has no way to move.
 */

/**
 * HUD action key for the no-movement state.
 *
 * HERO registers this key in `CONFIG.Token.movement.actions` with a maximum combat and non-combat distance
 * of 0. A token that cannot move holds it, so every report of allowed distance reads 0. A token that holds
 * nothing instead inherits {@link CONFIG.Token.movement.defaultAction}, which would report that mode's
 * distance for a character who has none.
 *
 * @type {string}
 */
export const MOVEMENT_NONE_ACTION = "NONE";

/**
 * Convert a movement mode to the HUD action key that stores it.
 *
 * Characteristic keys are lowercase and HUD action keys are uppercase. The mode `"none"` becomes
 * `MOVEMENT_NONE_ACTION`, which is a registered action worth 0 distance.
 *
 * @param {string} movementKey A movement characteristic key, or `"none"`.
 *
 * @returns {string} The HUD action key.
 */
export function movementActionForMode(movementKey) {
    return movementKey.toUpperCase();
}

/**
 * Return the actor flag path that holds the active movement characteristic key.
 *
 * Computed lazily. `game.system.id` does not exist when this module is first evaluated, so a top-level
 * constant built from it throws and takes the whole module down with it.
 *
 * @returns {string} A Foundry property path, for example `"flags.hero6efoundryvttv2.activeMovement"`.
 */
export function activeMovementFlag() {
    return `flags.${game.system.id}.activeMovement`;
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
 * The HUD sends an uppercase action key such as `"FLIGHT"`. The token configuration sheet and macros can
 * still send `null`. A cleared selection resolves to running. A selection the actor does not own resolves
 * to the default mode, which covers a power drained to zero since the player made the selection.
 *
 * `MOVEMENT_NONE_ACTION` resolves to `"none"`. Players cannot select that action, so it reaches here only
 * when the token holds the no-movement state.
 *
 * @param {HeroSystem6eActor} actor Actor the selection applies to.
 * @param {string|null} movementAction The HUD action key, or null for no selection.
 *
 * @returns {string} A movement characteristic key the actor owns, or `"none"`.
 */
export function movementKeyForAction(actor, movementAction) {
    const ownedKeys = ownedMovementKeys(actor);

    if (ownedKeys.length === 0 || movementAction === MOVEMENT_NONE_ACTION) {
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

    // An unlinked token reads its own copy of the actor, so it must not inherit another token's mode.
    return game.scenes.contents.flatMap((scene) =>
        scene.tokens.filter((token) => token.isLinked && token.actorId === actor.id),
    );
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
 * @param {string|null} movementAction The new HUD action key, or null for no selection.
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
 * Queue a movement mode re-resolve behind any propagation already in flight.
 *
 * @param {HeroSystem6eActor} actor Actor whose characteristics changed.
 *
 * @returns {Promise<void>} Resolves when this re-resolve and any it waited behind have finished.
 */
export function queueResyncMovementMode(actor) {
    propagationChain = propagationChain
        .then(() => resyncMovementMode(actor))
        .catch((error) => {
            console.warn(`Hero System 6e: movement mode resync failed: ${error.message}`, error);
        });

    return propagationChain;
}

/**
 * Report whether this client owns movement writes.
 *
 * Propagation writes the actor flag and the tokens of every scene. The GM holds those rights, so the GM
 * takes the job and a player client never fails on a token it cannot write. `game.users.activeGM` names
 * one GM, so two connected GMs do not both write. With no GM connected, the client that made the change
 * propagates as far as its own rights allow.
 *
 * @param {string} userId The id of the user who made the originating change.
 *
 * @returns {boolean} True when this client must propagate.
 */
export function isMovementPropagationOwner(userId) {
    const owner = game.users.activeGM ?? null;

    return owner ? owner.id === game.user.id : userId === game.user.id;
}

/**
 * Report whether an actor change touches a movement characteristic.
 *
 * A change to a movement value can cost the actor its selected mode, so the caller re-resolves the mode.
 * The check covers the whole characteristic, because a max change recomputes the value.
 *
 * @param {HeroSystem6eActor} actor Actor that changed.
 * @param {object} changed The change object `_onUpdate` received.
 *
 * @returns {boolean} True when a movement characteristic changed.
 */
export function changedMovementCharacteristic(actor, changed) {
    const characteristics = changed?.system?.characteristics;

    if (!characteristics) {
        return false;
    }

    const movementPowers = actor.system.is5e ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers;

    return Object.keys(foundry.utils.flattenObject(characteristics)).some((path) => movementPowers[path.split(".")[0]]);
}

/**
 * Return a promise that resolves once the propagation queue has fully drained.
 *
 * Each propagation queues one follow-up round that finds nothing left to write. Awaiting a snapshot of
 * the chain returns before that follow-up runs, so this loops until the chain reference stops changing.
 * Use it to read a settled state instead of guessing at a delay.
 *
 * @internal
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
 * Propagate a movement mode to the actor and to the tokens that read that actor.
 *
 * The actor flag is the authoritative record. Each token also receives the matching HUD action key,
 * because the token HUD highlights from the token's own persisted value. Writing every affected token
 * makes each HUD show the same selection.
 *
 * A linked token shares one actor with all that actor's tokens, so the fan-out spans all scenes. An
 * unlinked token holds its own copy of the actor, so the fan-out covers only that token.
 *
 * The originating token is part of the fan-out. That lets a cleared selection land on the actor default,
 * such as `RUNNING`, instead of staying `null`.
 *
 * An actor with no movement power, such as a base2, resolves to `"none"`. The fan-out then stores `null`
 * on every linked token, which is the value that clears the HUD highlight.
 *
 *
 * @param {HeroSystem6eTokenDocument} sourceTokenDocument The token whose movementAction changed.
 * @param {string|null} movementAction The new HUD action key, or null for no selection.
 *
 * @returns {Promise<void>} Resolves when the actor and every linked token are in sync.
 */
export async function propagateMovementMode(sourceTokenDocument, movementAction) {
    const actor = sourceTokenDocument?.actor;

    if (!actor) {
        return;
    }

    await writeMovementMode(actor, movementKeyForAction(actor, movementAction));
}

/**
 * Replace a stored movement mode the actor can no longer use.
 *
 * An effect can drain the characteristic behind the selected mode. The stored mode must then move to a
 * mode the actor can still move on, or to "none" when no movement power is left, and every token has to
 * follow so the HUD stops highlighting the unusable mode.
 *
 * An actor with no stored mode is left alone. Nothing needs correcting, and writing one would touch every
 * token of that actor on any characteristic change.
 *
 * @param {HeroSystem6eActor} actor Actor whose characteristics changed.
 *
 * @returns {Promise<void>} Resolves when the actor and its tokens hold a usable mode.
 */
export async function resyncMovementMode(actor) {
    const storedKey = actor ? foundry.utils.getProperty(actor, activeMovementFlag()) : undefined;

    if (storedKey === undefined || storedKey === null) {
        return;
    }

    const resolvedKey = actorMovementKey(actor);

    if (resolvedKey === storedKey) {
        return;
    }

    await writeMovementMode(actor, resolvedKey);
}

/**
 * Write a resolved movement mode to the actor and to the tokens that read it.
 *
 * @param {HeroSystem6eActor} actor Actor that holds the mode.
 * @param {string} movementKey Resolved movement characteristic key, or "none".
 *
 * @returns {Promise<void>} Resolves when the actor and its tokens hold the mode.
 */
async function writeMovementMode(actor, movementKey) {
    // An actor with no movement power, such as a base2 actor or a character whose last power an effect
    // drained, holds the registered no-movement action. That action reports a maximum combat and non-combat
    // distance of 0, so the ruler, the HUD, and any distance report agree the token cannot move.
    // Storing null instead would inherit CONFIG.Token.movement.defaultAction, which hands the token the
    // running distance it does not have.
    const actionKey = movementActionForMode(movementKey);

    if (foundry.utils.getProperty(actor, activeMovementFlag()) !== movementKey) {
        await actor.update({ [activeMovementFlag()]: movementKey });
    }

    // An unlinked token owns a copy of the actor, so only that token reads this mode. A world actor is
    // shared by every token linked to it, in every scene.
    // Compare the stored value, not the getter. The getter infers RUNNING for a null selection, which
    // would hide a token that still needs the explicit value written.
    const tokens = actor.parent?.documentName === "Token" ? [actor.parent] : linkedTokenDocuments(actor);
    const staleTokens = tokens.filter((token) => token._source.movementAction !== actionKey);

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

    await writeTokenActions(updatesByScene, `movement mode "${movementKey}"`);
}

/**
 * Write movement actions to tokens, grouped by scene, without triggering propagation.
 *
 * `TokenDocument.updateDocuments` takes one parent scene, so callers group the updates first.
 *
 * @param {Map<string, object[]>} updatesByScene Token updates keyed by scene id.
 * @param {string} description What is being written, for the warning when a scene cannot be written.
 *
 * @returns {Promise<void>} Resolves when every writable scene holds the new actions.
 */
async function writeTokenActions(updatesByScene, description) {
    for (const [sceneId, updates] of updatesByScene) {
        const scene = game.scenes.get(sceneId);

        try {
            await foundry.documents.TokenDocument.updateDocuments(updates, {
                parent: scene,
                [MOVEMENT_SYNC_OPTION]: true,
            });
        } catch (error) {
            // A player who lacks permission for another scene's token must not break their own selection.
            console.warn(`Hero System 6e: could not sync ${description} to scene "${scene?.name}": ${error.message}`);
        }
    }
}

/**
 * Return the movement action a token should hold.
 *
 * A token with no action inherits `CONFIG.Token.movement.defaultAction`, which reports the running distance
 * even for an actor who cannot move. This resolves the actor's mode instead, so movers hold their mode and
 * tokens that cannot move hold `MOVEMENT_NONE_ACTION`, which is worth 0 distance.
 *
 * @param {HeroSystem6eTokenDocument} tokenDocument Token to read.
 *
 * @returns {string} The HUD action key.
 */
export function movementActionForToken(tokenDocument) {
    return movementActionForMode(actorMovementKey(tokenDocument.actor));
}

/**
 * Build the update that gives one token the movement action its actor can use.
 *
 * @param {HeroSystem6eTokenDocument} tokenDocument Token that holds no action.
 *
 * @returns {object} Token update data for `TokenDocument.updateDocuments`.
 */
function initializeUpdateForToken(tokenDocument) {
    return { _id: tokenDocument.id, movementAction: movementActionForToken(tokenDocument) };
}

/**
 * Queue a new token's movement action behind any propagation already in flight.
 *
 * A token created without an action inherits the default, which reports a distance its actor may not have.
 * `TokenDocument#_onCreate` calls this on the client that owns movement writes.
 *
 * @param {HeroSystem6eTokenDocument} tokenDocument The token that was created.
 *
 * @returns {Promise<void>} Resolves when this write and any it waited behind have finished.
 */
export function queueInitializeTokenMovementAction(tokenDocument) {
    propagationChain = propagationChain
        .then(async () => {
            if (!tokenDocument || tokenDocument._source.movementAction) {
                return;
            }

            const update = initializeUpdateForToken(tokenDocument);

            await writeTokenActions(
                new Map([[tokenDocument.parent.id, [update]]]),
                `a movement action to token "${tokenDocument.name}"`,
            );
        })
        .catch((error) => {
            console.warn(`Hero System 6e: assigning a movement action failed: ${error.message}`, error);
        });

    return propagationChain;
}
