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

    async rollInitiative(ids) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | rollInitiative`, ids);
        }
        ids = typeof ids === "string" ? [ids] : ids;
        //const currentId = this.combatant?.id;
        // Iterate over Combatants, performing an initiative roll for each
        const updates = [];
        for (const id of ids) {
            // Get Combatant data (non-strictly)
            const combatant = this.combatants.get(id);
            if (!combatant?.isOwner) continue;

            // Produce an initiative roll for the Combatant
            const characteristic = combatant.actor?.system?.initiativeCharacteristic || "dex";
            const initValue = combatant.actor?.system.characteristics[characteristic]?.value || 0;
            if (combatant.flags.initiative != initValue || combatant.flags.initiativeCharacteristic != characteristic) {
                // monks-combat-marker shows error with tokenDocument.object is nul..
                // tokenDocument is supposed to have an object.
                // Unclear why it is missing sometimes.
                // KLUGE: Do not update initiative when tokenDocument.object is missing.
                if (combatant.token.object) {
                    updates.push({
                        _id: id,
                        "flags.initiative": initValue,
                        "flags.initiativeCharacteristic": characteristic,
                    });
                }
            }
        }
        if (!updates.length) return this;

        // Update multiple combatants
        if (updates) {
            await this.updateEmbeddedDocuments("Combatant", updates);
        }

        return this;
    }

    /**
     * Return the Array of combatants sorted into initiative order, breaking ties alphabetically by name.
     * @returns {Combatant[]}
     */
    setupTurns() {
        // if (CONFIG.debug.combat) {
        //     console.debug(`Hero | setupTurns`);
        // }

        this.turns ||= [];

        // Determine the turn order and the current turn
        const turns = this.combatants.contents.sort(this._sortCombatants);
        if (this.turn !== null) this.turn = clamp(this.turn, 0, turns.length - 1);

        // Update state tracking
        let c = turns[this.turn];
        this.current = this._getCurrentState(c);

        // One-time initialization of the previous state
        if (!this.previous) this.previous = this.current;

        // Return the array of prepared turns
        return (this.turns = turns);
    }

    /**
     * Define how the array of Combatants is sorted in the displayed list of the tracker.
     * This method can be overridden by a system or module which needs to display combatants in an alternative order.
     * The default sorting rules sort in descending order of initiative using combatant IDs for tiebreakers.
     * @param {Combatant} a     Some combatant
     * @param {Combatant} b     Some other combatant
     * @protected
     */
    _sortCombatants(a, b) {
        // Lightning Reflexes
        const lrA = Number.isNumeric(a.flags.lightningReflexes?.levels) ? a.flags.lightningReflexes.levels : 0;
        const lrB = Number.isNumeric(b.flags.lightningReflexes?.levels) ? b.flags.lightningReflexes.levels : 0;

        // Sort by segment first
        const segA = Number.isNumeric(a.flags.segment) ? a.flags.segment : -Infinity;
        const segB = Number.isNumeric(b.flags.segment) ? b.flags.segment : -Infinity;

        // Then by initiative (dex or ego)
        const initA = Number.isNumeric(a.initiative) ? a.initiative + lrA : -Infinity;
        const initB = Number.isNumeric(b.initiative) ? b.initiative + lrB : -Infinity;

        // Then by spd
        const spdA = Number.isNumeric(a.flags.spd) ? a.flags.spd : -Infinity;
        const spdB = Number.isNumeric(b.flags.spd) ? b.flags.spd : -Infinity;

        // Then by hasPlayerOwner
        // Finally by tokenId

        return (
            segA - segB ||
            initB - initA ||
            spdB - spdA ||
            a.hasPlayerOwner < b.hasPlayerOwner ||
            (a.tokenId > b.tokenId ? 1 : -1)
        );
    }

    async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onCreateDescendantDocuments`);
        }

        // Automatically roll initiative for all combatants created in the combat tracker.
        // We could use rollAll() here, but rollInitiative is probably more efficient.
        await this.rollInitiative(documents.map((o) => o.id));

        // Get current combatant
        const priorState = foundry.utils.deepClone(this.current);
        this.setupTurns();
        await this.assignSegments(priorState.tokenId);
        const combatTurn = this.getCombatTurnHero(priorState);

        // Call Super
        await super._onCreateDescendantDocuments(
            parent,
            collection,
            documents,
            data,
            { ...options, combatTurn: combatTurn },
            userId,
        );

        // Add or remove extra combatants based on SPD or Lightning Reflexes
        await this.extraCombatants();
    }

    async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onDeleteDescendantDocuments`);
        }

        // Get current combatant
        const priorState = foundry.utils.deepClone(this.current);
        this.setupTurns();
        await this.assignSegments(priorState.tokenId);
        const combatTurn = this.getCombatTurnHero(priorState);

        // Call the Super (don't render the likely incorrect turn that default foundry provides)
        await super._onDeleteDescendantDocuments(
            parent,
            collection,
            documents,
            ids,
            { ...options, combatTurn: combatTurn },
            userId,
        );

        // Add or remove extra combatants based on SPD or Lightning Reflexes (shouldn't be needed as we have overrides for combatant deletes via UI)
        await this.extraCombatants();
    }

    async assignSegments(tokenId) {
        if (!tokenId) return;

        const tokenCombatants = this.combatants.filter((o) => o.tokenId === tokenId);
        const tokenCombatantCount = tokenCombatants.length;
        if (tokenCombatantCount === 0) return;
        if (!tokenCombatants[0]?.isOwner) return;
        const actor = tokenCombatants[0].actor;
        if (!actor) return;
        const lightningReflexes = actor?.items.find(
            (o) => o.system.XMLID === "LIGHTNING_REFLEXES_ALL" || o.system.XMLID === "LIGHTNING_REFLEXES_SINGLE",
        );
        const updates = [];
        for (let c = 0; c < tokenCombatantCount; c++) {
            const _combatant = tokenCombatants[c];
            const spd = clamp(parseInt(_combatant.actor?.system.characteristics.spd?.value || 0), 1, 12);
            // const initiativeTooltip = `${
            //     _combatant.flags.initiative
            // }${_combatant.flags.initiativeCharacteristic.toUpperCase()} ${spd}SPD ${
            //     lightningReflexes?.system.LEVELS ? `${lightningReflexes.system.LEVELS}LR` : ""
            // }`;
            if (spd) {
                const segment = HeroSystem6eCombat.getSegment(spd, Math.floor(c * (lightningReflexes ? 0.5 : 1)));
                let update = {
                    _id: _combatant.id,
                    initiative: _combatant.flags.initiative,
                    "flags.segment": segment,
                    "flags.spd": spd,
                    "flags.initiativeTooltip": `${
                        _combatant.flags.initiative
                    }${_combatant.flags.initiativeCharacteristic?.toUpperCase()} ${spd}SPD`,
                };
                if (lightningReflexes && c % 2 === 0) {
                    update = {
                        ...update,
                        "flags.initiativeTooltip": `${
                            _combatant.flags.initiative
                        }${_combatant.flags.initiativeCharacteristic?.toUpperCase()} ${spd}SPD ${
                            lightningReflexes.system.LEVELS
                        }LR`,
                        initiative: _combatant.flags.initiative + parseInt(lightningReflexes?.system.LEVELS || 0),
                        "flags.lightningReflexes.levels": parseInt(lightningReflexes.system.LEVELS),
                        "flags.lightningReflexes.name":
                            lightningReflexes.system.OPTION_ALIAS || lightningReflexes.system.INPUT || "All Actions",
                    };
                } else {
                    update = {
                        ...update,
                        "flags.lightningReflexes": null,
                    };
                }
                if (
                    update.initiative != _combatant.initiative ||
                    update["flags.lightningReflexes.name"] != _combatant.flags?.lightningReflexes?.name ||
                    update["flags.segment"] != _combatant.flags?.segment
                ) {
                    updates.push(update);
                }
            }
        }
        if (updates.length > 0) {
            await this.updateEmbeddedDocuments("Combatant", updates);
        }
    }

    async extraCombatants() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | extraCombatants`);
        }

        // Only 1 GM should do this
        if (!game.users.activeGM?.isSelf) return;

        const uniqueTokens = Array.from(new Set(this.combatants.map((o) => o.tokenId))); //this.combatants.filter((c, i, ar) => ar.indexOf(c) === i);
        for (const _tokenId of uniqueTokens) {
            const _combatant = this.combatants.find((o) => o.tokenId === _tokenId && o.actor);
            if (!_combatant?.isOwner) continue;
            const actor = _combatant?.actor;
            if (actor) {
                const lightningReflexes = actor?.items.find(
                    (o) =>
                        o.system.XMLID === "LIGHTNING_REFLEXES_ALL" || o.system.XMLID === "LIGHTNING_REFLEXES_SINGLE",
                );
                const targetCombatantCount =
                    clamp(parseInt(actor.system.characteristics.spd?.value || 0), 1, 12) * (lightningReflexes ? 2 : 1);
                const tokenCombatants = this.combatants.filter((o) => o.tokenId === _tokenId);
                const tokenCombatantCount = tokenCombatants.length;

                if (tokenCombatantCount < targetCombatantCount) {
                    const toCreate = [];
                    for (let i = 0; i < targetCombatantCount - tokenCombatantCount; i++) {
                        toCreate.push(_combatant);
                    }
                    await this.createEmbeddedDocuments("Combatant", toCreate);
                    return;
                }

                if (tokenCombatantCount > targetCombatantCount) {
                    const _combatants = this.combatants.filter((o) => o.tokenId === _tokenId && o.actor);
                    await this.deleteEmbeddedDocuments(
                        "Combatant",
                        _combatants.map((o) => o.id).slice(0, tokenCombatantCount - targetCombatantCount),
                    );
                    return;
                }

                // Add custom hero flags for segments and such
                if (tokenCombatantCount === targetCombatantCount) {
                    await this.assignSegments(_tokenId);
                    //         const updates = [];
                    //         for (let c = 0; c < tokenCombatantCount; c++) {
                    //             const _combatant = tokenCombatants[c];
                    //             const spd = parseInt(_combatant.actor?.system.characteristics.spd.value);
                    //             if (spd) {
                    //                 const segment = HeroSystem6eCombat.getSegment(
                    //                     spd,
                    //                     Math.floor(c * (lightningReflexes ? 0.5 : 1)),
                    //                 );
                    //                 let update = {
                    //                     _id: _combatant.id,
                    //                     initiative: _combatant.flags.initiative,
                    //                     "flags.segment": segment,
                    //                     "flags.spd": spd,
                    //                 };
                    //                 if (lightningReflexes && c % 2 === 0) {
                    //                     update = {
                    //                         ...update,
                    //                         initiative:
                    //                             _combatant.flags.initiative + parseInt(lightningReflexes?.system.LEVELS || 0),
                    //                         "flags.lightningReflexes.levels": parseInt(lightningReflexes.system.LEVELS),
                    //                         "flags.lightningReflexes.name":
                    //                             lightningReflexes.system.OPTION_ALIAS ||
                    //                             lightningReflexes.system.INPUT ||
                    //                             "All Actions",
                    //                     };
                    //                 }
                    //                 updates.push(update);
                    //             }
                    //         }
                    //         await this.updateEmbeddedDocuments("Combatant", updates);
                }
            }
        }
    }

    static getSegment(spd, index) {
        let i = index;
        for (let segment = 1; segment <= 12; segment++) {
            if (HeroSystem6eCombat.hasPhase(spd, segment)) {
                i--;
                if (i < 0) {
                    return segment;
                }
            }
        }
        return 12;
    }

    static hasPhase(spd, segment) {
        switch (clamp(parseInt(spd), 0, 12)) {
            case 0:
                // At SPD 0, a character is frozen in place, unable to move or take any other Actions. He can only take Post-Segment 12 Recoveries,
                return [12].includes(segment);
            case 1:
                return [12].includes(segment);
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
                // if (spd < 1 && segment === 12) return true;
                // if (spd === undefined && segment === 12) return true;
                return false;
        }
    }

    /**
     * Get the current history state of the Combat encounter.
     * @param {Combatant} [combatant]       The new active combatant
     * @returns {CombatHistoryData}
     * @protected
     */
    _getCurrentState(combatant) {
        combatant ||= this.combatant;
        return {
            round: this.round,
            turn: this.turn ?? null,
            combatantId: combatant?.id || null,
            tokenId: combatant?.tokenId || null,
            segment: combatant?.flags.segment || null,
            name: combatant?.token?.name || combatant?.actor?.name || null,
            initiative: combatant?.initiative || null,
        };
    }

    /**
     * Begin the combat encounter, advancing to round 1 and turn 1
     * @returns {Promise<Combat>}
     */
    async startCombat() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | extraCombatants`);
        }
        // Hero combats start with round 1 and segment 12.
        const firstSegment12turn = this.turns.findIndex((o) => o.flags.segment === 12) || 0;

        this._playCombatSound("startEncounter");
        const updateData = {
            round: 1,
            turn: firstSegment12turn,
            "flags.-=postSegment12Round": null,
            "flags.-heroCurrent": null,
        };
        Hooks.callAll("combatStart", this, updateData);
        return this.update(updateData);
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
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onStartTurn: ${combatant.name}`);
        }

        // Only run onStartTurn on our first combatant per segment
        const lightningReflexes = combatant.actor?.items.find(
            (o) => o.system.XMLID === "LIGHTNING_REFLEXES_ALL" || o.system.XMLID === "LIGHTNING_REFLEXES_SINGLE",
        );

        await super._onStartTurn(combatant);

        if (!combatant) return;

        // Save some properties for future support for rewinding combat tracker
        // TODO: Include charges for various items
        combatant.flags.heroHistory ||= {};
        if (combatant.actor) {
            combatant.flags.heroHistory[
                `r${String(this.round).padStart(2, "0")}s${String(this.flags.segment).padStart(2, "0")}`
            ] = {
                end: combatant.actor.system.characteristics.end?.value,
                stun: combatant.actor.system.characteristics.stun?.value,
                body: combatant.actor.system.characteristics.body?.value,
            };
            const updates = [{ _id: combatant.id, "flags.heroHistory": combatant.flags.heroHistory }];
            this.updateEmbeddedDocuments("Combatant", updates);
        }

        // Expire Effects
        // We expire on our phase, not on our segment.
        await expireEffects(combatant.actor);

        // Stop holding
        if (combatant.actor.statuses.has("holding")) {
            const ae = combatant.actor.effects.find((effect) => effect.statuses.has("holding"));
            combatant.actor.removeActiveEffect(ae);
        }

        // Reset movement history
        if (window.dragRuler) {
            const dragRulerCombatant = this.getCombatantByToken(combatant.tokenId);
            if (dragRulerCombatant) {
                await dragRuler.resetMovementHistory(this, dragRulerCombatant.id);
            } else {
                console.error("Unable to find dragRulerCombatant");
            }
        }

        if (lightningReflexes && !combatant.flags.lightningReflexes) {
            //console.log("Early exit for onStartTurn for non-lightning reflexes combatant");
            return;
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

        if (content != "" && spentEnd > 0) {
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
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onEndTurn: ${combatant.name}`);
        }
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

    async _onEndSegment() {
        console.log("empty and never called");
    }

    async _onStartSegment() {
        console.log("empty and never called");
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
        if (CONFIG.debug.combat) {
            console.debug(`Hero | _onEndRound`);
        }
        super._onEndRound();

        // Make really sure we only call at the end of the round
        if (this.current.round > 1 && this.current.turn === 0) {
            await this.PostSegment12();
        }
    }

    async PostSegment12() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | PostSegment12`);
        }
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
            This typically occurs when rewinding combat or during speed changes.</p>`;
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
                const recoveryText = await combatant.actor.TakeRecovery(false, combatant.token);
                if (recoveryText) {
                    if (!combatant.hidden && combatant.hasPlayerOwner) {
                        content += "<li>" + recoveryText + "</li>";
                    } else {
                        hasHidden = true;
                        contentHidden += "<li>" + recoveryText + "</li>";
                    }
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
     * Advance the combat to the next turn
     * @returns {Promise<Combat>}
     */ async nextTurn() {
        const originalRunningSegment = this.round * 12 + this.combatant?.flags.segment;
        const originalRound = this.round;
        const _nextTurn = await super.nextTurn();
        const newRunningSegment = this.round * 12 + this.combatant?.flags.segment;
        const newRound = this.round;

        if (originalRunningSegment != newRunningSegment && originalRound === newRound) {
            const advanceTime = newRunningSegment - originalRunningSegment;
            //console.log(originalRunningSegment, newRunningSegment, newRunningSegment - originalRunningSegment);
            await game.time.advance(advanceTime);
        }

        return _nextTurn;
    }

    /**
     * Rewind the combat to the previous turn
     * @returns {Promise<Combat>}
     */
    async previousTurn() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | previousTurn`);
        }
        if (this.turn === 0 && this.round === 0) return this;
        else if (this.turn <= 0 && this.turn !== null) return this.previousRound();
        let previousTurn = (this.turn ?? this.turns.length) - 1;

        const originalRunningSegment = this.round * 12 + this.combatant.flags.segment;

        // Hero combats start with round 1 and segment 12.
        // So anything less than segment 12 will call previousTurn
        if (this.round <= 1) {
            const segment12turn = this.turns.findIndex((o) => o.flags.segment === 12) || 0;
            if (this.turn <= segment12turn) {
                return this.previousRound();
            }
        }

        // Update the document, passing data through a hook first
        const updateData = { round: this.round, turn: previousTurn };
        const updateOptions = { direction: -1, worldTime: { delta: -1 * CONFIG.time.turnTime } };
        Hooks.callAll("combatTurn", this, updateData, updateOptions);
        const _previousTurn = await this.update(updateData, updateOptions);

        const newRunningSegment = this.round * 12 + this.combatant.flags.segment;
        if (originalRunningSegment != newRunningSegment) {
            const advanceTime = newRunningSegment - originalRunningSegment;
            await game.time.advance(advanceTime);
        }

        return _previousTurn;
    }

    /**
     * Advance the combat to the next round
     * @returns {Promise<Combat>}
     */
    async nextRound() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | nextRound`);
        }
        const originalRunningSegment = this.round * 12 + this.combatant?.flags.segment;
        const _nextRound = await super.nextRound();
        const newRunningSegment = this.round * 12 + this.combatant?.flags.segment;
        if (originalRunningSegment != newRunningSegment) {
            const advanceTime = newRunningSegment - originalRunningSegment;
            await game.time.advance(advanceTime);
        }
        return _nextRound;
    }

    async previousRound() {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | previousRound`);
        }
        const originalRunningSegment = this.round * 12 + this.combatant?.flags.segment;
        const _previousRound = await super.previousRound();
        const newRunningSegment = this.round * 12 + this.combatant?.flags.segment;
        if (originalRunningSegment != newRunningSegment) {
            const advanceTime = newRunningSegment - originalRunningSegment;
            // NaN Typically occurs when previous round ends combat
            if (!isNaN(advanceTime)) {
                await game.time.advance(advanceTime);
            }
        }
        return _previousRound;
    }

    getCombatTurnHero(priorState) {
        if (CONFIG.debug.combat) {
            console.debug(`Hero | getCombatTurnHero`, priorState);
        }

        // Don't bother when combat tracker is empty
        if (this.turns.length === 0) return this.turn;

        // Combat not started
        if (this.round === 0) return this.turn;

        // Find Exact match
        let combatTurn = this.turns.findIndex(
            (o) =>
                o.id === priorState.combatantId &&
                o.flags.segment === priorState.segment &&
                o.initiative === priorState.initiative,
        );

        // find closest match
        if (combatTurn === -1) {
            combatTurn = this.turns.findIndex(
                (o) =>
                    (o.flags.segment === priorState.segment && o.initiative <= priorState.initiative) ||
                    o.flags.segment > priorState.segment,
            );
            console.log(
                `Combat Tracker was unable to find exact match.  Should only occur when current combatant changes SPD/Initiative.`,
                priorState,
                this,
            );
        }

        if (combatTurn > -1) {
            return combatTurn;
        }

        // There may be oddities when Initiative changes at last turn
        ui.notifications.warn(
            "Combat Tracker combatants were modified. Unable to determine which combatant should be active.",
        );

        return this.turn;
    }
}
