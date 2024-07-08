import { HEROSYS } from "./herosystem6e.mjs";
import { clamp } from "./utility/compatibility.mjs";
import { whisperUserTargetsForActor, expireEffects } from "./utility/util.mjs";

export class HeroSystem6eCombat extends Combat {
    constructor(data, context) {
        super(data, context);

        this.previous = this.previous || {
            combatantId: null,
        };
    }

    getUniqueTokens() {
        // this.combatants.contents.reduce((accumulator, item) => {if (!accumulator.find(o=> o.tokenId === item.tokenId)) {accumulator.push(item);} return accumulator;},[])
        const results = [];
        for (const c of this.combatants.contents) {
            if (!results.find((o) => o.id === c.token.object?.id)) {
                results.push(c.token.object);
            }
        }
        return results;
    }

    getUniqueCombatants() {
        const results = [];
        for (const c of this.combatants.values()) {
            if (!results.find((o) => o.token.object.id === c.token.object?.id)) {
                results.push(c);
            }
        }
        return results;
    }

    /**
     * Roll initiative for one or multiple Combatants within the Combat entity
     * @param {string|string[]} ids     A Combatant id or Array of ids for which to roll
     * @param {object} [options={}]     Additional options which modify how initiative rolls are created or presented.
     * @param {string|null} [options.formula]         A non-default initiative formula to roll. Otherwise the system default is used.
     * @param {boolean} [options.updateTurn=true]     Update the Combat heroTurn after adding new initiative scores to keep the heroTurn on the same Combatant.
     * @param {object} [options.messageOptions={}]    Additional options with which to customize created Chat Messages
     * @return {Promise<Combat>}        A promise which resolves to the updated Combat entity once updates are complete.
     */

    async rollInitiative(ids) {
        // Structure input data
        ids = typeof ids === "string" ? [ids] : ids;
        if (ids.length === 0) {
            ids = this.combatants.map((c) => c.id); // Roll All
        }

        if (CONFIG.debug.combat) {
            console.debug(`Hero | rollInitiative`, ids);
        }
        // We need a unique combatant for each phase the actor acts.

        const uniqueTokensToProcess = [];

        for (const id of ids) {
            const c = this.combatants.find((o) => o.id === id);
            if (!c) {
                // Looks like a timing issue.  When AID/SPD is lowered _onUpdateDescendantDocuments
                // or when _onDeleteDescendantDocuments is calld, this.combatants may not have been updated yet.
                console.warn(`Combatant ${id} was not found.`);
                continue;
            }

            const lightningReflexes = c.actor?.items.find(
                (o) => o.system.XMLID === "LIGHTNING_REFLEXES_ALL" || o.system.XMLID === "LIGHTNING_REFLEXES_SINGLE",
            );

            //Create extra combatants to match SPEED
            let targetCombatantsForToken =
                parseInt(
                    Math.min(
                        12,
                        Math.max(1, c.actor?.system.characteristics.spd?.value), // Bases don't have a SPD
                    ),
                ) * (lightningReflexes ? 2 : 1);

            const needToCreate =
                targetCombatantsForToken - this.combatants.filter((o) => o.tokenId === c.tokenId).length;

            const toCreate = [];
            for (let i = 0; i < needToCreate; i++) {
                toCreate.push({
                    tokenId: c.tokenId,
                    sceneId: c.sceneId,
                    actorId: c.actorId,
                    hidden: c.hidden,
                });
            }
            if (toCreate.length > 0) {
                await this.createEmbeddedDocuments("Combatant", toCreate);
                continue; // We just created combat documents, which will call this (RollInitiative) again
            }

            // Perhaps we have too many (SPD drain for example)
            if (needToCreate < 0) {
                await this.deleteEmbeddedDocuments("Combatant", [c.id], {
                    single: true,
                });
                continue; // We just deleted combat documents, which will call this (RollInitiative) again
            }

            if (!uniqueTokensToProcess.find((t) => t.id === c.tokenId)) {
                uniqueTokensToProcess.push(c.token);
            }
        }

        // Loop thru all the tokens/combatants with ids provided
        for (const t of uniqueTokensToProcess) {
            const lightningReflexes = t.actor?.items.find(
                (o) => o.system.XMLID === "LIGHTNING_REFLEXES_ALL" || o.system.XMLID === "LIGHTNING_REFLEXES_SINGLE",
            );

            const lightningReflexesLevels = parseInt(
                lightningReflexes?.system.LEVELS?.value ||
                    lightningReflexes?.system.LEVELS ||
                    lightningReflexes?.system.levels ||
                    lightningReflexes?.system.other.levels ||
                    0,
            );

            // Produce an initiative roll for the Combatant.
            const characteristic = t.actor?.system?.initiativeCharacteristic || "dex";
            const initValue = t.actor?.system.characteristics[characteristic]?.value || 0;
            const spdValue = t.actor?.system.characteristics.spd?.value || 0;
            const initiativeValue = initValue + spdValue / 100;

            const tokenCombatants = this.combatants.filter((c) => c.tokenId === t.id);

            // Assign a segment and Initiative
            let idx = 0;
            for (let s = 1; s <= 12; s++) {
                if (
                    HeroSystem6eCombat.hasPhase(
                        Math.max(1, tokenCombatants[idx]?.actor?.system.characteristics.spd?.value || 0),
                        s,
                    )
                ) {
                    if (lightningReflexes) {
                        const lightningReflexesAlias = `(${
                            lightningReflexes.system.OPTION_ALIAS || lightningReflexes.system.INPUT || "All Actions"
                        })`;
                        if (
                            tokenCombatants[idx].flags.segment !== s ||
                            tokenCombatants[idx].flags.initiative !== initiativeValue + lightningReflexesLevels ||
                            tokenCombatants[idx].flags.lightningReflexesAlias !== lightningReflexesAlias
                        ) {
                            await tokenCombatants[idx].update({
                                "flags.segment": s,
                                initiative: initiativeValue + lightningReflexesLevels,
                                "flags.lightningReflexesAlias": lightningReflexesAlias,
                            });
                        }
                        idx++;
                    }

                    if (
                        tokenCombatants[idx].flags.segment !== s ||
                        tokenCombatants[idx].flags.initiative !== initiativeValue
                    ) {
                        try {
                            await tokenCombatants[idx].update({
                                "flags.segment": s,
                                initiative: initiativeValue,
                                "-flags.lightningReflexesAlias": null,
                            });
                        } catch (ex) {
                            console.error(ex);
                            return;
                        }
                    }
                    idx++;
                }
            }

            // Rare case where SPD <= 0 (and for actorless tokens; bases)
            // NOTE: There is no code to prevent a SPD 0 token from acting, currently GM player needs to handle that manually.
            // A SPD 0 character can't act, but does get a postSegment12.  In theory the SPD drain will eventually fade.
            if (
                (tokenCombatants[0].actor?.system.characteristics.spd?.value || 0) <= 0 &&
                tokenCombatants[0].flags.segment !== 12
            ) {
                tokenCombatants[0].flags.segment = 12;
                await tokenCombatants[0].update({
                    "flags.segment": 12,
                    initiative: 10 + initiativeValue,
                    "-flags.lightningReflexesAlias": null,
                });
            }
        }
        return this;
    }

    /* -------------------------------------------- */

    /**
     * Return the Array of combatants sorted into initiative order, breaking ties alphabetically by name.
     * @return {Combatant[]}
     */

    setupTurns() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | Combat Setup Turns`);
        }

        // Likely never needed, but here for future reference.
        // super.setupTurns();

        // Determine the turn order and the current turn
        const turns = this.combatants.contents.sort(this._sortCombatants);
        if (this.turn !== null) this.turn = clamp(this.turn, 0, turns.length - 1);

        // Update state tracking (v12)
        // const c = turns[this.turn];
        // this.current = this._getCurrentState(c);

        // Update state tracking (v11)
        const c = turns[this.turn];
        this.current = {
            round: this.round,
            turn: this.turn,
            combatantId: c ? c.id : null,
            tokenId: c ? c.tokenId : null,
        };

        // One-time initialization of the previous state
        if (!this.previous) this.previous = this.current;

        // Return the array of prepared turns
        return (this.turns = turns);
    }

    _sortCombatants(a, b) {
        const segmentA = parseInt(a.flags.segment) || 12;
        const segmentB = parseInt(b.flags.segment) || 12;
        const initA = parseFloat(a.initiative) || 0;
        const initB = parseFloat(b.initiative) || 0;

        let segmentDifference = segmentA - segmentB;
        if (segmentDifference !== 0) {
            return segmentDifference;
        }

        const initDifference = initB - initA;
        if (initDifference !== 0) {
            return initDifference;
        }

        const typeA = a.actor?.hasPlayerOwner || a.hasPlayerOwner;
        const typeB = b.actor?.hasPlayerOwner || b.hasPlayerOwner;

        if (typeA !== typeB) {
            if (typeA) {
                return -1;
            }
            if (typeB) {
                return 1;
            }
        }

        // Force consistant sorting by token.id
        //console.warn("Sorting undetermined. Using token.id to break the tie.");
        return a.token.id.localeCompare(b.token.id);
    }

    // Standard HeroSystem rules per SPEED CHART
    static hasPhase(spd, segment) {
        switch (parseInt(spd)) {
            case 1:
                return [7].includes(segment);
            case 2:
                return [6, 12].includes(segment);
            case 3:
                return [4, 8, 12].includes(segment);
            case 4:
                return [3, 6, 9, 12].includes(segment);
            case 5:
                return [3, 5, 8, 10, 12].includes(segment);
            case 6:
                return [2, 4, 6, 8, 10, 12].includes(segment);
            case 7:
                return [2, 4, 6, 7, 9, 11, 12].includes(segment);
            case 8:
                return [2, 3, 5, 6, 8, 9, 11, 12].includes(segment);
            case 9:
                return [2, 3, 4, 6, 7, 8, 10, 11, 12].includes(segment);
            case 10:
                return [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].includes(segment);
            case 11:
                return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(segment);
            case 12:
                return true;
            default:
                if (spd < 1) return false;
                return true;
        }
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onCreateDescendantDocuments`, this);
        }

        //Missing actor?
        // let missingActors = documents.filter((o) => !o.actor);
        // {
        //     for (let c of missingActors) {
        //         ui.notifications.warn(
        //             `${c.name} references an Actor which no longer exists within the World.`,
        //         );
        //     }
        // }

        // documents = documents.filter((o) => o.actor);
        // if (documents.length === 0) return;

        // Get current combatant
        const oldCombatant = this.combatant;

        // Super
        await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

        // Setup turns in segment fashion
        //const _turns = this.setupTurns();

        // Roll initiative (again?)
        await this.rollInitiative(documents.map((o) => o.id));

        // Keep the current Combatant the same after adding new Combatants to the Combat
        if (oldCombatant) {
            this.turn = this.turns.findIndex(
                (o) => o.tokenId === oldCombatant.tokenId && o.flags.segment === oldCombatant.flags.segment,
            );
            await this.update({ turn: this.turn });
        }

        // Render the collection
        //if (this.active) this.collection.render();
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onDeleteDescendantDocuments`, this);
        }

        // Update the heroTurn order and adjust the combat to keep the combatant the same (unless they were deleted)

        // Get current (active) combatant
        const oldCombatant = this.combatant;
        const nextCombatant = this.turns[this.turn + 1 > this.turns.length ? 0 : this.turn + 1];

        // Super
        await super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);

        // Make sure we delete all combatants with the same tokenID.
        // Unless options.single = true; like when SPD lowers.
        if (!options.single) {
            if (collection === "combatants") {
                for (const doc of documents) {
                    const toDelete = this.combatants.filter((c) => c.token.id === doc.token.id);
                    if (toDelete.length > 0) {
                        await this.deleteEmbeddedDocuments(
                            "Combatant",
                            toDelete.map((c) => c.id),
                        );
                    }
                }
            }
        }

        // Setup turns in segment fashion
        // this.setupTurns();

        // When Combat is not started there is no oldCombatant (or current one), so were done.
        if (!oldCombatant) {
            return;
        }

        // If old & new combatant are the same, then default actions are appropriate.
        if (this.combatants.get(oldCombatant.id)) {
            this.turn = this.turns.findIndex(
                (o) => o.tokenId === oldCombatant.tokenId && o.flags.segment === oldCombatant.flags.segment,
            );
        } else {
            // We deleted the combatent so find turn of nextCombatant.
            // Could be on next round

            if (nextCombatant) {
                this.turn = this.turns.findIndex(
                    (o) => o.tokenId === nextCombatant.tokenId && o.flags.segment === nextCombatant.flags.segment,
                );
            } else {
                this.turn = 0;
                this.round++;
            }
        }
        await this.update({ turn: this.turn, round: this.round });

        //await this.rollInitiative(documents.map((o) => o.id));

        // Render the collection
        if (this.active) this.collection.render();
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    // Note that super is not async
    async _onUpdateDescendantDocuments(
        parent,
        collection,
        documents,
        changes,
        options,
        // eslint-disable-next-line no-unused-vars
        userId,
    ) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onUpdateDescendantDocuments`, this);
        }

        // The super calls setupTurns and slows things way down.  Don't think we really need this.
        // super._onUpdateDescendantDocuments(
        //     parent,
        //     collection,
        //     documents,
        //     changes,
        //     options,
        //     userId,
        // );

        //await this.rollInitiative(documents.map((o) => o.id));

        // Update the turn order
        const priorState = foundry.utils.deepClone(this.current);
        const combatant = this.combatant;
        this.setupTurns();
        this.#recordPreviousState(priorState);

        // When token (turns) are added or deleted this.turns likely points to the wrong turn.
        // Adjust turn order to keep the current Combatant the same (SEGMENT is important for HeroSystem)
        let sameTurn = this.turns.findIndex(
            (t) =>
                t.id === combatant?.id &&
                t.flags.segment === combatant?.flags.segment &&
                t.initiative === combatant?.initiative,
        );
        if (sameTurn < 0) sameTurn = this.turn;

        const adjustedTurn = sameTurn !== this.turn ? sameTurn : undefined;
        if (options.turnEvents !== false && adjustedTurn) {
            this._manageTurnEvents(adjustedTurn);
        }

        // Render the Collection
        if (this.active && options.render !== false) {
            this.collection.render();
        }
    }

    /**
     * Update the previous turn data.
     * Compare the state with the new current state. Only update the previous state if there is a difference.
     * @param {CombatHistoryData} priorState      A cloned copy of the current history state before changes
     */
    #recordPreviousState(priorState) {
        const current = this.current;
        const hasChanged =
            current.combatantId !== priorState.combatantId ||
            current.round !== priorState.round ||
            current.turn !== priorState.turn;
        if (hasChanged) this.previous = priorState; // FoundytVTT V11
        return hasChanged; // FoundtyVTT v12
    }

    async _onActorDataUpdate(...args) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onActorDataUpdate`, this);
        }
        super._onActorDataUpdate(...args);
        this.setupTurns();
        if (this.active) this.collection.render();
    }

    /**
     * A workflow that occurs at the start of each Combat Turn.
     * This workflow occurs after the Combat document update, new turn information exists in this.current.
     * This can be overridden to implement system-specific combat tracking behaviors.
     * This method only executes for one designated GM user. If no GM users are present this method will not be called.
     * @param {Combatant} combatant     The Combatant whose turn just started
     * @returns {Promise<void>}
     * @protected
     */
    async _onStartTurn(combatant) {
        //console.log("_onStartTurn", combatant.name, this.current);

        await super._onStartTurn(combatant);

        if (!combatant) return;

        // Expire Effects
        // We expire on our phase, not on our segment.
        await expireEffects(combatant.actor);

        // Reset movement history
        if (window.dragRuler) {
            await dragRuler.resetMovementHistory(this, combatant.id);
        }

        // STUNNING
        // The character remains Stunned and can take no
        // Actions (not even Aborting to a defensive action) until their next
        // Phase.
        // Use actor.canAct to block actions
        // Remove STUNNED effect _onEndTurn

        // Spend END for all active powers
        let content = "";
        let spentEnd = 0;

        for (const powerUsingEnd of combatant.actor.items.filter(
            (item) =>
                item.system.active === true &&
                parseInt(item.system?.end || 0) > 0 &&
                (item.system.subType || item.type) !== "attack",
        )) {
            const costEndOnlyToActivate = powerUsingEnd.system.MODIFIER?.find(
                (o) => o.XMLID === "COSTSEND" && o.OPTION === "ACTIVATE",
            );
            if (!costEndOnlyToActivate) {
                const end = parseInt(powerUsingEnd.system.end);
                const value = parseInt(this.combatant.actor.system.characteristics.end.value);
                if (value - spentEnd >= end) {
                    spentEnd += end;
                    if (end >= 0) {
                        content += `<li>${powerUsingEnd.name} (${end})</li>`;
                    }
                } else {
                    content += `<li>${powerUsingEnd.name} (insufficient END; power turned off)</li>`;
                    await powerUsingEnd.toggle();
                }
            }
        }

        const encumbered = combatant.actor.effects.find((effect) => effect.flags.encumbrance);
        if (encumbered) {
            const endCostPerTurn = Math.abs(parseInt(encumbered.flags?.dcvDex)) - 1;
            if (endCostPerTurn > 0) {
                spentEnd += endCostPerTurn;
                content += `<li>${encumbered.name} (${endCostPerTurn})</li>`;
            }
        }

        if (content != "" && !this.combatant.isFake && spentEnd > 0) {
            let segment = this.combatant.flags.segment;
            let value = parseInt(this.combatant.actor.system.characteristics.end.value);
            let newEnd = value;
            newEnd -= spentEnd;

            await this.combatant.actor.update({
                "system.characteristics.end.value": newEnd,
            });

            content = `Spent ${spentEnd} END (${value} to ${newEnd}) on turn ${this.round} segment ${segment}:<ul>${content}</ul>`;

            const token = combatant.token;
            const speaker = ChatMessage.getSpeaker({
                actor: combatant.actor,
                token,
            });
            speaker["alias"] = combatant.actor.name;

            const chatData = {
                user: game.user._id,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                content: content,
                whisper: whisperUserTargetsForActor(combatant.actor),
                speaker,
            };

            await ChatMessage.create(chatData);
        }

        // Some attacks include a DCV penalty which was added as an ActiveEffect.
        // At the beginning of our turn we make sure that AE is deleted.
        const removeOnNextPhase = combatant.actor.effects.filter(
            (o) => o.flags.nextPhase && o.duration.startTime < game.time.worldTime,
        );
        for (const ae of removeOnNextPhase) {
            await ae.delete();
        }

        // Remove Aborted
        if (combatant.actor.statuses.has("aborted")) {
            const effect = combatant.actor.effects.contents.find((o) => o.statuses.has("aborted"));
            await effect.delete();
        }
    }

    /**
     * A workflow that occurs at the end of each Combat Turn.
     * This workflow occurs after the Combat document update, prior round information exists in this.previous.
     * This can be overridden to implement system-specific combat tracking behaviors.
     * This method only executes for one designated GM user. If no GM users are present this method will not be called.
     * @param {Combatant} combatant     The Combatant whose turn just ended
     * @returns {Promise<void>}
     * @protected
     */
    async _onEndTurn(combatant) {
        super._onEndTurn(combatant);

        // At the end of the Segment, any non-Persistent Powers, and any Skill Levels of any type, turn off for STUNNED actors.
        if (this.turns?.[this.turn]?.flags.segment != this.turns?.[this.turn - 1]?.flags.segment) {
            for (let _combatant of this.combatants) {
                if (_combatant?.actor?.statuses.has("stunned") || _combatant?.actor?.statuses.has("knockedout")) {
                    for (const item of _combatant.actor.getActiveConstantItems()) {
                        await item.toggle();
                    }
                }
            }
        }

        if (combatant.actor.statuses.has("stunned")) {
            const effect = combatant.actor.effects.contents.find((o) => o.statuses.has("stunned"));

            await effect.delete();

            let content = `${combatant.actor.name} recovers from being stunned.`;
            const token = combatant.token;
            const speaker = ChatMessage.getSpeaker({
                actor: combatant.actor,
                token,
            });
            speaker["alias"] = combatant.actor.name;
            const chatData = {
                user: game.user._id,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                content: content,
                //speaker: speaker
            };

            await ChatMessage.create(chatData);
        }
    }

    /**
     * A workflow that occurs at the end of each Combat Round.
     * This workflow occurs after the Combat document update, prior round information exists in this.previous.
     * This can be overridden to implement system-specific combat tracking behaviors.
     * This method only executes for one designated GM user. If no GM users are present this method will not be called.
     * @returns {Promise<void>}
     * @protected
     */
    async _onEndRound() {
        super._onEndRound();

        // Make really sure we only call at the end of the round
        if (this.current.round > 1 && this.current.turn === 0) {
            await this.PostSegment12();
        }
    }

    // TODO: Replace with PostSegment12 activities.
    // Such as automatic recovery
    async PostSegment12() {
        // POST-SEGMENT 12 RECOVERY
        // After Segment 12 each Turn, all characters (except those deeply
        // unconscious or holding their breath) get a free Post-Segment 12
        // Recovery. This includes Stunned characters, although the Post-
        // Segment 12 Recovery does not eliminate the Stunned condition.

        // Only run this once per turn.
        // So if we go back in time, then forward again, skip PostSegment12
        if (this.flags.postSegment12Round?.[this.round]) {
            const content = `Post-Segment 12 (Turn ${this.round - 1})
            <p>Skipping because this has already been performed on this turn during this combat.  
            This typically occures when rewinding combat or during speed changes.</p>`;
            const chatData = {
                user: game.user._id,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                content: content,
            };

            await ChatMessage.create(chatData);
            return;
        }
        const postSegment12Round = this.flags.postSegment12Round || {};
        postSegment12Round[this.round] = true;

        this.update({ "flags.postSegment12Round": postSegment12Round });

        const automation = game.settings.get(HEROSYS.module, "automation");

        let content = `Post-Segment 12 (Turn ${this.round - 1})`;
        let contentHidden = `Post-Segment 12 (Turn ${this.round - 1})`;
        content += "<ul>";
        contentHidden += "<ul>";
        let hasHidden = false;
        for (const combatant of this.getUniqueCombatants().filter((o) => !o.defeated)) {
            const actor = combatant.actor;

            // Make sure we have a valid actor
            if (!actor) continue;

            // If this is an NPC and their STUN <= 0 then leave them be.
            // Typically, you should only use the Recovery Time Table for
            // PCs. Once an NPC is Knocked Out below the -10 STUN level
            // they should normally remain unconscious until the fight ends.
            // ACTOR#ONUPDATE SHOULD MARK AS DEFEATED
            // if (actor.type != "pc" && parseInt(actor.system.characteristics.stun.value) <= -10)
            // {
            //     //console.log("defeated", combatant)
            //     continue;
            // }

            // Make sure we have automation enabled
            if (
                automation === "all" ||
                (automation === "npcOnly" && actor.type == "npc") ||
                (automation === "pcEndOnly" && actor.type === "pc")
            ) {
                // Make sure combatant is visible in combat tracker
                if (!combatant.hidden) {
                    content += "<li>" + (await combatant.actor.TakeRecovery()) + "</li>";
                } else {
                    hasHidden = true;
                    contentHidden += "<li>" + (await combatant.actor.TakeRecovery()) + "</li>";
                }

                // END RESERVE
                for (const item of actor.items.filter((o) => o.system.XMLID === "ENDURANCERESERVE")) {
                    const ENDURANCERESERVEREC = item.findModsByXmlid("ENDURANCERESERVEREC");
                    if (ENDURANCERESERVEREC) {
                        const newValue = Math.min(
                            item.system.max,
                            item.system.value + parseInt(ENDURANCERESERVEREC.LEVELS),
                        );
                        if (newValue > item.system.value) {
                            const delta = newValue - item.system.value;
                            await item.update({
                                "system.value": newValue,
                            });

                            if (!combatant.hidden) {
                                content += "<li>" + `${combatant.token.name} ${item.name} +${delta}` + "</li>";
                            } else {
                                contentHidden += "<li>" + `${combatant.token.name} ${item.name} +${delta}` + "</li>";
                            }
                        }
                    }
                }
            }
        }
        content += "</ul>";
        contentHidden += "</ul>";
        const chatData = {
            user: game.user._id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: content,
        };

        await ChatMessage.create(chatData);

        if (hasHidden) {
            return ChatMessage.create({
                ...chatData,
                content: contentHidden,
                whisper: ChatMessage.getWhisperRecipients("GM"),
            });
        }
    }

    /**
     * Begin the combat encounter, advancing to round 1 and turn 1
     * @returns {Promise<Combat>}
     */
    async startCombat() {
        // Don't call super because we start on segment 12 which is never turn 0.
        //await super.startCombat();

        this._playCombatSound("startEncounter");
        const turn = this.turns.findIndex((o) => o.flags.segment === 12) || 1;
        const updateData = {
            round: 1,
            turn: turn,
            previous: { round: 1, turn: Math.max(0, turn - 1) },
            "flags.-=postSegment12Round": null,
        };
        Hooks.callAll("combatStart", this, updateData);
        await this.update(updateData);
    }

    /**
     * Rewind the combat to the previous turn
     * @returns {Promise<Combat>}
     */
    async previousTurn() {
        //console.log("previousTurn");
        if (this.turn === 0 && this.round === 0) return this;
        else if (this.turn <= 0 && this.turn !== null) return this.previousRound();

        // Hero combats start with round 1 and segment 12.
        // So anything less than segment 12 will call previousTurn
        let segment12turn = this.turns.findIndex((o) => o.flags.segment === 12) || -1;
        if (this.round <= 1 && this.turn <= segment12turn) {
            return this.previousRound();
        }

        let previousTurn = (this.turn ?? this.turns.length) - 1;

        // Determine segment
        let segment = this.combatant.flags.segment;
        let segment_prev = this.turns[previousTurn].flags.segment;
        let advanceTime = segment_prev - segment;
        if (advanceTime > 0) {
            advanceTime = 0;
        }

        // Update the document, passing data through a hook first
        const updateData = { round: this.round, turn: previousTurn };
        const updateOptions = { advanceTime, direction: -1 };
        Hooks.callAll("combatTurn", this, updateData, updateOptions);
        return this.update(updateData, updateOptions);
    }

    /**
     * Rewind the combat to the previous round
     * @returns {Promise<Combat>}
     */
    async previousRound() {
        //console.log("previousRound");
        let turn = this.round === 0 ? 0 : Math.max(this.turns.length - 1, 0);
        if (this.turn === null) turn = null;
        let round = Math.max(this.round - 1, 0);
        //let advanceTime = -1 * (this.turn || 0) * CONFIG.time.turnTime;
        //if (round > 0) advanceTime -= HERO.time.turn; //CONFIG.time.roundTime;

        // Determine segment
        let segment = this.turns[turn]?.flags.segment || null;
        let segment_prev = this.combatant?.flags.segment || null;
        // if (round > 0) {
        //     segment += 12;
        // }
        let advanceTime = segment_prev - segment;

        // Hero combats start with round 1 and segment 12.
        // So anything less than segment 12 will call previousTurn
        let segment12turn = this.turns.findIndex((o) => o.flags.segment === 12) || -1;
        if (round <= 1 && turn < segment12turn) {
            round = 0;
            turn = null;
        }
        if (round == 0) {
            turn = null;
        }

        // Update the document, passing data through a hook first
        const updateData = { round, turn };
        const updateOptions = { advanceTime, direction: -1 };
        Hooks.callAll("combatRound", this, updateData, updateOptions);
        return this.update(updateData, updateOptions);
    }

    /**
     * Advance the combat to the next turn
     * @returns {Promise<Combat>}
     */
    async nextTurn() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | nextTurn`);
        }
        let turn = this.turn ?? -1;
        let skip = this.settings.skipDefeated;

        // Determine the next turn number
        let next = null;
        if (skip) {
            for (let [i, t] of this.turns.entries()) {
                if (i <= turn) continue;
                if (t.isDefeated) continue;
                next = i;
                break;
            }
        } else next = turn + 1;

        // Maybe advance to the next round
        let round = this.round;
        if (this.round === 0 || next === null || next >= this.turns.length) {
            return this.nextRound();
        }

        // Determine segment
        let segment = this.combatant.flags.segment;
        let segment_next = this.turns[next].flags.segment;
        if (segment_next < segment) {
            segment_next += 12;
        }

        const advanceTime = segment_next - segment;

        // Update the document, passing data through a hook first
        const updateData = { round, turn: next };
        const updateOptions = {}; // { advanceTime: advanceTime, direction: 1 };

        // Advance worldtime NOW, before we _onStartTurn gets called.
        // Seems to be a bug in core foundryVTT.
        if (isNaN(advanceTime)) {
            console.error("advanceTimeis NaN");
        } else {
            await game.time.advance(advanceTime);
        }

        Hooks.callAll("combatTurn", this, updateData, updateOptions);
        let x = await this.update(updateData, updateOptions);
        console.log(x);
        return x;
    }

    /**
     * Advance the combat to the next round
     * @returns {Promise<Combat>}
     */
    async nextRound() {
        let turn = this.turn === null ? null : 0; // Preserve the fact that it's no-one's turn currently.
        if (this.settings.skipDefeated && turn !== null) {
            turn = this.turns.findIndex((t) => !t.isDefeated);
            if (turn === -1) {
                ui.notifications.warn("COMBAT.NoneRemaining", {
                    localize: true,
                });
                turn = 0;
            }
        }

        let nextRound = this.round + 1;

        // Determine segment
        let segment = this.combatant?.flags.segment || null;
        let segment_next = this.turns[0]?.flags.segment || null;
        segment_next += 12;
        const advanceTime = segment_next - segment;

        // Update the document, passing data through a hook first
        const updateData = { round: nextRound, turn };
        const updateOptions = { advanceTime, direction: 1 };
        Hooks.callAll("combatRound", this, updateData, updateOptions);
        return this.update(updateData, updateOptions);
    }
}

// class HeroCombatant extends Combatant {
//     constructor(combatant) {
//         super();
//         Object.assign(this, combatant);
//         this.id = combatant.id;
//     }

//     id = null;
//     initiative = null; //Override
//     turn = null;
//     segment = null;
//     alias = null;
//     isFake = false;
//     //hasRolled = true; // Initiative is static, but actor DEX/INT/SPD might change
// }
