export class HeroCombat extends Combat {
    constructor(...args) {
        super(...args);
        // Explicitly bind the sorting method to this class instance
        this._sortCombatants = this._sortCombatants.bind(this);
    }

    /**
     * Track the current segment as a persistent system flag.
     * If not set yet, default to Segment 12 (starting segment).
     */
    get segment() {
        return this.getFlag(game.system.id, "currentSegment") ?? 12;
    }

    /**
     * Universal initiative priority parser driven by system Status Effects.
     * @param {Combatant} combatant
     * @param {number} [targetSegment] Optional segment override for look-ahead math
     * @returns {number}
     */
    getInitiativePriority(combatant, targetSegment) {
        if (!combatant?.actor) return 0;

        // Fall back to current segment if no look-ahead override is provided
        const activeSegment = targetSegment ?? this.segment;

        // If the character has aborted, drop their priority to absolute 0
        if (combatant.actor.statuses.has("aborted")) {
            return 0;
        }

        const characteristicKey = combatant.actor.system.initiativeCharacteristic ?? "dex";
        const baseScore = combatant.actor.system?.characteristics?.[characteristicKey]?.value || 0;

        const segmentRolls = this.getFlag(game.system.id, "segmentRolls")?.[activeSegment] || {};
        const tieBreakerRoll = segmentRolls[combatant.id] || 11;
        const tieBreakerFraction = (19 - tieBreakerRoll) * 0.01;

        let maneuverOffset = 0;
        const statuses = combatant.actor.statuses;

        if (statuses.has("heldAction")) maneuverOffset = CONFIG.HERO.combatManeuverOffsets.heldAction;
        else if (statuses.has("haymaker")) maneuverOffset = CONFIG.HERO.combatManeuverOffsets.haymaker;
        else if (statuses.has("delayedPhase")) maneuverOffset = CONFIG.HERO.combatManeuverOffsets.delayedPhase;

        return baseScore + tieBreakerFraction + maneuverOffset;
    }

    /**
     * Automatically generates random tie-breaker 3d6 rolls for every combatant
     * in a given target segment, preserving existing records to support timeline shifting.
     * @param {number} targetSegment
     * @returns {Promise<object>} The updated segment roll dictionary map
     * @private
     */
    async _generateSegmentRollCache(targetSegment) {
        const allRollsCache = this.getFlag(game.system.id, "segmentRolls") ?? {};

        // If rolls already exist for this segment, preserve them to allow rewinding safely
        if (allRollsCache[targetSegment]) return allRollsCache;

        const newSegmentMap = {};
        for (const combatant of this.combatants) {
            // Simulate standard 3d6 dice outcomes
            const dice = Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1);
            const total3d6 = dice.reduce((sum, val) => sum + val, 0);

            newSegmentMap[combatant.id] = total3d6;
        }

        allRollsCache[targetSegment] = newSegmentMap;
        return allRollsCache;
    }

    /**
     * SHARED ARRAY SORTING FUNCTION
     * Sorts combatants by their generic initialization priority values.
     * @param {Combatant} a
     * @param {Combatant} b
     * @returns {number}
     */
    _comparePriority(a, b) {
        const priorityA = this.getInitiativePriority(a);
        const priorityB = this.getInitiativePriority(b);

        if (priorityA !== priorityB) return priorityB - priorityA; // Descending (highest value acts first)

        // Tie-breaker: Fall back to Foundry's core initiative roll if values are identical
        return (b.initiative || 0) - (a.initiative || 0);
    }

    /**
     * Core sorting override mapping back to our shared prioritization loop.
     * @override
     */
    _sortCombatants(a, b) {
        const currentSegment = this.segment;
        const aActs = a.hasPhaseInSegment(currentSegment);
        const bActs = b.hasPhaseInSegment(currentSegment);

        // Filter actors acting in the current segment to the top
        if (aActs !== bActs) return aActs ? -1 : 1;

        // Apply the universal tie-breaker priority mechanics
        return this._comparePriority(a, b);
    }

    /**
     * LIFECYCLE OVERRIDE: Executes when an encounter starts or resets.
     * @override
     */
    async startCombat() {
        await this.setFlag(game.system.id, "currentSegment", 12);
        await this.setFlag(game.system.id, "recoveredRounds", []);

        const initialRolls = await this._generateSegmentRollCache(12);

        // Create an explicit structural collection array for your child document edits
        const combatantUpdates = [];

        this.combatants.forEach((combatant) => {
            const tieBreakerRoll = initialRolls?.[combatant.id] || 11;
            const characteristicKey = combatant.actor?.system?.initiativeCharacteristic ?? "dex";
            const baseScore = combatant.actor?.system?.characteristics?.[characteristicKey]?.value || 0;

            const combinedValue = baseScore + (19 - tieBreakerRoll) * 0.01;

            // V14 Architecture: Provide the ID and the raw field target parameter
            combatantUpdates.push({
                _id: combatant.id,
                initiative: combinedValue,
            });
        });

        // Unified database push pairing the parent data block and child collection arrays concurrently
        await this.update({
            [`flags.${game.system.id}.segmentRolls`]: initialRolls,
            combatants: combatantUpdates,
        });

        await super.startCombat();

        const firstActingIndex = this.turns.findIndex((t) => t.hasPhaseInSegment(12));
        return this.update({ turn: firstActingIndex !== -1 ? firstActingIndex : 0 });
    }

    /**
     * Advance down the turn index loop, shifting segment flags and
     * announcing custom system event expirations to Foundry's V14 registry.
     * @override
     */
    async nextTurn() {
        const turns = this.turns;
        const startIndex = (this.turn ?? -1) + 1;
        let targetIndex = -1;

        // 1. Scan remainder of the active segment array
        for (let i = startIndex; i < turns.length; i++) {
            if (turns[i]?.hasPhaseInSegment(this.segment)) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex !== -1) {
            // --- ACTIVE SEGMENT PHASE END EXPIRATION ANNOUNCEMENT ---
            const currentActor = turns[targetIndex]?.actor;
            if (currentActor?.statuses.has("aborted")) {
                // V14 Standard: Announce the phaseEnd event to the registry to auto-expire matching effects
                ActiveEffect.registry.refresh({ event: "phaseEnd", actor: currentActor });
            }
            return this.update({ turn: targetIndex });
        }

        // 2. Segment boundary transition triggered
        let nextSegment = this.segment;
        let nextRoundCycle = this.round;
        let foundNextActorIndex = -1;
        let segmentDeltaCount = 0;

        const updateData = {};

        for (let check = 1; check <= 12; check++) {
            nextSegment++;
            segmentDeltaCount++;

            if (nextSegment > 12) {
                nextSegment = 1;
                nextRoundCycle += 1;
                const roundToRecover = nextRoundCycle - 1;
                const recoveryApplied = await this._executePostSegment12Recovery(roundToRecover);

                if (recoveryApplied) {
                    const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
                    recoveredRounds.push(roundToRecover);
                    updateData[`flags.${game.system.id}.recoveredRounds`] = recoveredRounds;
                }
            }

            const actorsInNewSegment = turns.filter((t) => t.hasPhaseInSegment(nextSegment));
            if (actorsInNewSegment.length > 0) {
                actorsInNewSegment.sort((a, b) => {
                    const priorityA = this.getInitiativePriority(a, nextSegment);
                    const priorityB = this.getInitiativePriority(b, nextSegment);
                    if (priorityA !== priorityB) return priorityB - priorityA;
                    return (b.initiative || 0) - (a.initiative || 0);
                });

                foundNextActorIndex = turns.indexOf(actorsInNewSegment[0]);
                break;
            }
        }

        const updatedRollsCache = await this._generateSegmentRollCache(nextSegment);
        updateData[`flags.${game.system.id}.segmentRolls`] = updatedRollsCache;

        const targetCombatantIndex = foundNextActorIndex !== -1 ? foundNextActorIndex : 0;
        const incomingActor = turns[targetCombatantIndex]?.actor;

        // --- SEGMENT LEAP PHASE END EXPIRATION ANNOUNCEMENT ---
        if (incomingActor?.statuses.has("aborted")) {
            // Announce to the global framework registry that this specific actor's phase has ended
            ActiveEffect.registry.refresh({ event: "phaseEnd", actor: incomingActor });
        }

        // 3. Compile embedded child data updating initiative ranks across documents
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, nextSegment),
            });
        });

        updateData.round = nextRoundCycle;
        updateData.turn = targetCombatantIndex;
        updateData[`flags.${game.system.id}.currentSegment`] = nextSegment;
        updateData.combatants = combatantUpdates;

        // 6. Capture the combatant ID who is just finishing their phase right now
        const updateOptions = {
            direction: 1,
            previousCombatantId: this.combatant?.id, // MANUALLY INJECT FOR V14 UPSTREAM LOGIC
        };

        if (segmentDeltaCount > 0) {
            updateOptions.worldTime = { delta: segmentDeltaCount };
        }

        return this.update(updateData, updateOptions);
    }

    /**
     * Step backwards up the turn index loop, checking for start-of-combat resets.
     * @override
     */
    async previousTurn() {
        // ─── CHECK START OF COMBAT BOUNDARY RESET ───
        // If we are at Turn 1, Segment 12, and at the first acting combatant (turn 0),
        // clicking "Previous Turn" should completely wipe flags and drop back onto the "Start Combat" panel.
        if (this.round === 1 && this.segment === 12 && (this.turn ?? 0) === 0) {
            const combatantUpdates = [];
            this.combatants.forEach((combatant) => {
                combatantUpdates.push({
                    _id: combatant.id,
                    initiative: null, // Nullifies correctly to flip them back to default pre-combat dice icons
                });
            });

            const resetData = {
                started: false,
                round: 0,
                turn: null,
                [`flags.${game.system.id}.-=currentSegment`]: null,
                [`flags.${game.system.id}.-=segmentRolls`]: null,
                [`flags.${game.system.id}.-=recoveredRounds`]: null,
                combatants: combatantUpdates, // Structured child target injection
            };

            return this.update(resetData);
        }

        const turns = this.turns;
        const startIndex = (this.turn ?? 0) - 1;
        let targetIndex = -1;

        // 1. Scan backwards within the current segment window
        for (let i = startIndex; i >= 0; i--) {
            if (turns[i]?.hasPhaseInSegment(this.segment)) {
                targetIndex = i;
                break;
            }
        }

        // 2. If an actor was found earlier in the array, step directly back to their index pointer
        if (targetIndex !== -1) {
            return this.update({ turn: targetIndex });
        }

        // 3. Segment boundary crossed. Calculate backwards leap distance.
        let prevSegment = this.segment;
        let prevRoundCycle = this.round;
        let foundPrevActorIndex = -1;
        let segmentDeltaCount = 0;

        for (let check = 1; check <= 12; check++) {
            prevSegment--;
            segmentDeltaCount++; // Accumulate every calendar second wound backwards

            if (prevSegment < 1) {
                prevSegment = 12;
                prevRoundCycle = Math.max(1, prevRoundCycle - 1);
            }

            const actorsInPrevSegment = turns.filter((t) => t.hasPhaseInSegment(prevSegment));

            if (actorsInPrevSegment.length > 0) {
                actorsInPrevSegment.sort((a, b) => this._comparePriority(a, b));

                // Target lowest priority actor (last item in the sorted list) when rewinding segments
                const lastActorOfSegment = actorsInPrevSegment[actorsInPrevSegment.length - 1];
                foundPrevActorIndex = turns.indexOf(lastActorOfSegment);
                break;
            }
        }

        // 4. Build single transaction update payload including custom flags
        const updateData = {
            round: prevRoundCycle,
            turn: foundPrevActorIndex !== -1 ? foundPrevActorIndex : 0,
            [`flags.${game.system.id}.currentSegment`]: prevSegment,
        };

        // 5. Structure options payload to cleanly step the clock backward
        const updateOptions = {
            direction: -1,
            previousCombatantId: this.combatant?.id, // MANUALLY INJECT FOR V14 UPSTREAM LOGIC
            worldTime: {
                delta: -segmentDeltaCount,
            },
        };

        return this.update(updateData, updateOptions);
    }

    /**
     * Advance the tracker forward by an entire Turn Cycle (12 Segments / 12 Seconds).
     * @override
     */
    async nextRound() {
        const turns = this.turns;
        const currentRound = this.round;
        const currentSegment = this.segment;

        // 1. Moving forward an entire round means we process a Post-Segment 12 recovery for the current round
        await this._executePostSegment12Recovery(currentRound);

        // 2. Fetch the recovery history array to bundle it atomically
        const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
        if (!recoveredRounds.includes(currentRound)) {
            recoveredRounds.push(currentRound);
        }

        // 3. Increment the turn cycle (round). The segment stays exactly the same.
        const nextRoundCycle = currentRound + 1;

        // 4. Figure out who acts in this same segment in the new turn cycle
        const actorsInSegment = turns.filter((t) => t.hasPhaseInSegment(currentSegment));
        let targetTurnIndex = 0;

        if (actorsInSegment.length > 0) {
            actorsInSegment.sort((a, b) => this._comparePriority(a, b));
            targetTurnIndex = turns.indexOf(actorsInSegment[0]);
        }

        // 5. Combine everything into a single atomic database update transaction
        const updateData = {
            round: nextRoundCycle,
            turn: targetTurnIndex,
            [`flags.${game.system.id}.recoveredRounds`]: recoveredRounds,
        };

        const updateOptions = {
            direction: 1, // or -1 for previousRound
            previousCombatantId: this.combatant?.id, // MANUALLY INJECT FOR V14 UPSTREAM LOGIC
            worldTime: {
                delta: 12, // or -12
            },
        };

        return this.update(updateData, updateOptions);
    }

    /**
     * Rewind the tracker backward by an entire Turn Cycle (12 Segments / 12 Seconds).
     * @override
     */
    async previousRound() {
        const turns = this.turns;
        const currentRound = this.round;
        const currentSegment = this.segment;

        // 1. Calculate the prior turn cycle number (clamp to a minimum of 1)
        const prevRoundCycle = Math.max(1, currentRound - 1);

        // 2. Figure out who acts in this same segment in the prior turn cycle
        const actorsInSegment = turns.filter((t) => t.hasPhaseInSegment(currentSegment));
        let targetTurnIndex = 0;

        if (actorsInSegment.length > 0) {
            actorsInSegment.sort((a, b) => this._comparePriority(a, b));
            targetTurnIndex = turns.indexOf(actorsInSegment[0]);
        }

        // 3. Build the payload. We keep the segment exactly the same.
        const updateData = {
            round: prevRoundCycle,
            turn: targetTurnIndex,
        };

        // 4. Rewind the world clock by an entire Turn Cycle (12 seconds backwards)
        const updateOptions = {
            direction: -1,
            worldTime: {
                delta: -12,
            },
        };

        return this.update(updateData, updateOptions);
    }

    /**
     * Processes recovery calculations and returns true if an update was committed.
     * @param {number} roundToRecover
     * @returns {Promise<boolean>}
     * @private
     */
    async _executePostSegment12Recovery(roundToRecover) {
        // 1. Safety check: Only execute on the active GM machine to prevent multi-client calculations
        if (!game.user.isActiveGM) return false;

        const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
        if (recoveredRounds.includes(roundToRecover)) {
            await ChatMessage.create({
                //speaker: ChatMessage.getSpeaker({ actor }),
                flavor: `<strong>Post-Segment 12 Recovery (Turn ${roundToRecover})</strong>`,
                content: `skipped`,
            });
            return false;
        }

        const updates = [];

        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            if (!actor) continue;

            const rec = actor.system.characteristics?.rec?.value || 0;
            const stun = actor.system.characteristics?.stun || { value: 0, max: 0 };
            const end = actor.system.characteristics?.end || { value: 0, max: 0 };

            if (stun.value >= stun.max && end.value >= end.max) continue;

            const newStun = Math.min(stun.max, stun.value + rec);
            const newEnd = Math.min(end.max, end.value + rec);

            updates.push({
                _id: actor.id,
                "system.characteristics.stun.value": newStun,
                "system.characteristics.end.value": newEnd,
            });
        }

        if (updates.length > 0) {
            await Actor.updateDocuments(updates);
        }

        await ChatMessage.create({
            //speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `<strong>Post-Segment 12 Recovery (Turn ${roundToRecover})</strong>`,
            content: `process`,
        });

        return true;
    }

    /**
     * Post-database update handler. Executes on all clients when combat values change.
     * @override
     */
    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);

        if (!game.user.isActiveGM) return;

        const turnChanged = changed.turn !== undefined;
        const flagsChanged = changed.flags?.[game.system.id] !== undefined;
        if (!turnChanged && !flagsChanged) return;

        const previousCombatant = this.combatants.get(options.previousCombatantId);
        if (!previousCombatant?.actor) return;

        this._expireCustomSystemEffects(previousCombatant.actor);
    }

    /**
     * Scans a combatant's actor sheet and auto-expires matching active effect keys
     * tracked inside the global HERO configuration dictionary.
     * @param {Actor} actor
     * @private
     */
    async _expireCustomSystemEffects(actor) {
        // 1. Gather all of your custom keys directly out of the configuration definition object
        const customSystemKeys = Object.keys(CONFIG.HERO.activeEffectExpiryEvents);

        // 2. Locate any active effects currently matching your system keys
        const matchingEffects = actor.effects.filter((effect) => {
            const activeExpiryKey = effect.duration?.expiry;
            return customSystemKeys.includes(activeExpiryKey);
        });

        // If no effects match your criteria, exit out immediately
        if (matchingEffects.length === 0) return;

        // 3. Check what action the world takes when an effect expires ("delete" or "disable")
        // V14 core defaults to disabling effects, but modules or user configs might change this to delete.
        const expiryAction = CONFIG.ActiveEffect.expiryAction ?? "disable";

        const effectsToDelete = [];
        const updatesToApply = [];

        // 4. Group effects based on your global settings matrix
        for (const effect of matchingEffects) {
            const activeExpiryKey = effect.duration?.expiry;

            if (activeExpiryKey === "phaseEnd") {
                if (expiryAction === "delete") {
                    effectsToDelete.push(effect.id);
                } else {
                    // If the action is disable, change its core disabled property boolean value to true
                    updatesToApply.push({
                        _id: effect.id,
                        disabled: true,
                    });
                }
            }
        }

        // 5. Commit batch data operations to the database
        // This maintains your optimized single-transaction pipeline strategy!
        if (effectsToDelete.length > 0) {
            await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        }

        if (updatesToApply.length > 0) {
            await actor.updateEmbeddedDocuments("ActiveEffect", updatesToApply);
        }
    }

    /**
     * Recalculates initiative floats instantly for the active segment array matrix
     */
    async updateCodeInitiatives() {
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant),
            });
        });
        return this.update({ combatants: combatantUpdates });
    }
}
