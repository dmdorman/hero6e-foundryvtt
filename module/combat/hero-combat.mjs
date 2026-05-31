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

        const activeSegment = targetSegment ?? this.segment;
        const statuses = combatant.actor.statuses;

        // If the character has aborted, drop their priority to absolute 0
        if (statuses.has("aborted")) {
            return 0;
        }

        const characteristicKey = combatant.actor.system.initiativeCharacteristic ?? "dex";
        const baseScore = combatant.actor.system?.characteristics?.[characteristicKey]?.value || 0;

        const segmentRolls = this.getFlag(game.system.id, "segmentRolls")?.[activeSegment] || {};
        const tieBreakerRoll = segmentRolls[combatant.id] || 11;
        const tieBreakerFraction = (19 - tieBreakerRoll) * 0.01;

        let maneuverOffset = 0;

        // --- SUPPORT EXPLICIT "HOLDING" STATUS EFFECT ---
        if (statuses.has("holding")) {
            maneuverOffset = CONFIG.HERO.combatManeuverOffsets.heldAction ?? 100.0; // Pushes them to top priority
        } else if (statuses.has("haymaker")) {
            maneuverOffset = CONFIG.HERO.combatManeuverOffsets.haymaker ?? -3.0;
        } else if (statuses.has("delayedPhase")) {
            maneuverOffset = CONFIG.HERO.combatManeuverOffsets.delayedPhase ?? -5.0;
        }

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
     * Sort combatants acting in the current segment to the top.
     * @override
     */
    _sortCombatants(a, b) {
        const currentSegment = this.segment;

        // --- HERO 6E CORRECTION: Check both natural phase and holding status ---
        const aActs = a.hasPhaseInSegment(currentSegment) || (a.actor?.statuses.has("holding") ?? false);
        const bActs = b.hasPhaseInSegment(currentSegment) || (b.actor?.statuses.has("holding") ?? false);

        if (aActs !== bActs) return aActs ? -1 : 1;

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
     * Advance down the turn index loop, checking for fresh-phase held action overwrites.
     * @override
     */
    async nextTurn() {
        const turns = this.turns;
        const startIndex = (this.turn ?? -1) + 1;
        let targetIndex = -1;

        // 1. Scan remainder of the active segment array to find the next acting combatant
        for (let i = startIndex; i < turns.length; i++) {
            if (turns[i]?.hasPhaseInSegment(this.segment) || (turns[i]?.actor?.statuses.has("holding") ?? false)) {
                targetIndex = i;
                break;
            }
        }

        // 2. If an actor is found inside the active segment, step directly to them
        if (targetIndex !== -1) {
            return this.update({ turn: targetIndex });
        }

        // 3. Otherwise, nobody remains. Prepare chronological segment advancement.
        let nextSegment = this.segment;
        let nextRoundCycle = this.round;
        let segmentDeltaCount = 0;

        // Initialize our master update object up-front so internal loops can inject flags safely
        const updateData = {};

        // Scan segments sequentially forward (up to a max rotation loop of 12 steps)
        let foundActors = [];
        for (let check = 1; check <= 12; check++) {
            nextSegment++;
            segmentDeltaCount++; // Accumulate every calendar second crossed

            if (nextSegment > 12) {
                nextSegment = 1;
                nextRoundCycle += 1;

                // Trigger automated Post-Segment 12 Recovery Phase loops
                const roundToRecover = nextRoundCycle - 1;
                const recoveryApplied = await this._executePostSegment12Recovery(roundToRecover);

                if (recoveryApplied) {
                    const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
                    recoveredRounds.push(roundToRecover);
                    updateData[`flags.${game.system.id}.recoveredRounds`] = recoveredRounds;
                }
            }

            // Filter all actors who act naturally or are holding an action in this upcoming segment
            foundActors = turns.filter(
                (t) => t.hasPhaseInSegment(nextSegment) || (t.actor?.statuses.has("holding") ?? false),
            );
            if (foundActors.length > 0) {
                break;
            }
        }

        // 4. TRANSACTION BOUNDARY GENERATION: Cache 3d6 tie-breakers for the upcoming segment
        const updatedRollsCache = await this._generateSegmentRollCache(nextSegment);
        updateData[`flags.${game.system.id}.segmentRolls`] = updatedRollsCache;

        // 5. DETERMINING FIRST ACTIVE ACTOR SAFELY VIA IN-MEMORY SIMULATION
        let targetCombatantId = null;
        if (foundActors.length > 0) {
            // Sort our local reference block using the fresh roll definitions we just computed
            foundActors.sort((a, b) => {
                // Evaluate the looking-ahead priority score manually to dodge database cache lag
                const getProjPriority = (combatant) => {
                    if (!combatant?.actor) return 0;
                    if (combatant.actor.statuses.has("aborted")) return 0;

                    const chKey = combatant.actor.system.initiativeCharacteristic ?? "dex";
                    const base = combatant.actor.system?.characteristics?.[chKey]?.value || 0;
                    const rolls = updatedRollsCache[nextSegment] || {};
                    const rollValue = rolls[combatant.id] || 11;
                    const fraction = (19 - rollValue) * 0.01;

                    let offset = 0;
                    const s = combatant.actor.statuses;
                    if (s.has("holding")) offset = CONFIG.HERO.combatManeuverOffsets.heldAction ?? 100.0;
                    else if (s.has("haymaker")) offset = CONFIG.HERO.combatManeuverOffsets.haymaker ?? -3.0;
                    else if (s.has("delayedPhase")) offset = CONFIG.HERO.combatManeuverOffsets.delayedPhase ?? -5.0;

                    return base + fraction + offset;
                };

                const pA = getProjPriority(a);
                const pB = getProjPriority(b);
                if (pA !== pB) return pB - pA;
                return (b.initiative || 0) - (a.initiative || 0);
            });

            // Capture the ID of the winner of the priority stack
            targetCombatantId = foundActors[0]?.id;
        }

        // --- GENERIC PHASE END EXPIRY PROCESSING FOR SEGMENT LEAPS ---
        const incomingCombatant = this.combatants.get(targetCombatantId);
        if (incomingCombatant?.actor?.statuses.has("aborted")) {
            const phaseEndEffects = incomingCombatant.actor.effects.filter((e) => e.duration?.expiry === "phaseEnd");
            for (const effect of phaseEndEffects) {
                await effect.delete();
            }
        }

        // 6. COMPILE EMBEDDED CHILD DATA WITH RECALCULATED INITIATIVES
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            // Determine initiative based on the upcoming rolls map
            const rolls = updatedRollsCache[nextSegment] || {};
            const rollValue = rolls[combatant.id] || 11;
            const chKey = combatant.actor?.system?.initiativeCharacteristic ?? "dex";
            const base = combatant.actor?.system?.characteristics?.[chKey]?.value || 0;
            let finalInitiative = base + (19 - rollValue) * 0.01;

            if (combatant.actor) {
                const s = combatant.actor.statuses;
                if (s.has("holding")) finalInitiative += CONFIG.HERO.combatManeuverOffsets.heldAction ?? 100.0;
                else if (s.has("haymaker")) finalInitiative += CONFIG.HERO.combatManeuverOffsets.haymaker ?? -3.0;
                else if (s.has("delayedPhase"))
                    finalInitiative += CONFIG.HERO.combatManeuverOffsets.delayedPhase ?? -5.0;
                if (s.has("aborted")) finalInitiative = 0;
            }

            combatantUpdates.push({
                _id: combatant.id,
                initiative: finalInitiative,
            });
        });

        // 7. ARRANGE TURNS MATRIX MANUALLY TO DERIVE TRUE DATABASE POINTER INDEX
        // Clone turns list and update local values to map out exactly how Foundry will sort them on the server side
        const mockTurns = [...turns];
        mockTurns.forEach((t) => {
            const match = combatantUpdates.find((u) => u._id === t.id);
            if (match) t.initiative = match.initiative;
        });

        // Re-run standard collection sorting using our updated values
        mockTurns.sort((a, b) => {
            const aActs = a.hasPhaseInSegment(nextSegment) || (a.actor?.statuses.has("holding") ?? false);
            const bActs = b.hasPhaseInSegment(nextSegment) || (b.actor?.statuses.has("holding") ?? false);
            if (aActs !== bActs) return aActs ? -1 : 1;

            if (a.initiative !== b.initiative) return (b.initiative || 0) - (a.initiative || 0);
            return a.id.localeCompare(b.id); // Core core engine final alpha id fallback sort
        });

        // Find our prioritized combatant inside the freshly sorted blueprint array
        const absoluteTargetTurnIndex = mockTurns.findIndex((t) => t.id === targetCombatantId);

        // 8. Populate master data object
        updateData.round = nextRoundCycle;
        updateData.turn = absoluteTargetTurnIndex !== -1 ? absoluteTargetTurnIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = nextSegment;
        updateData.combatants = combatantUpdates;

        // 9. Package options context parameters
        const updateOptions = {
            direction: 1,
            previousCombatantId: this.combatant?.id,
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
        if (this.round === 1 && this.segment === 12 && (this.turn ?? 0) === 0) {
            return this._handleCombatStartReset();
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

        // Segment boundary crossed. Calculate backwards leap distance.
        for (let check = 1; check <= 12; check++) {
            prevSegment--;
            segmentDeltaCount++;

            if (prevSegment < 1) {
                prevSegment = 12;
                prevRoundCycle = Math.max(1, prevRoundCycle - 1);
            }

            // --- HERO 6E CORRECTION: Include Holding Characters in the Prev Segment Look-Behind ---
            const actorsInPrevSegment = turns.filter((t) => {
                const hasNaturalPhase = t.hasPhaseInSegment(prevSegment);
                const isHoldingAction = t.actor?.statuses.has("holding") ?? false;
                return hasNaturalPhase || isHoldingAction;
            });

            if (actorsInPrevSegment.length > 0) {
                actorsInPrevSegment.sort((a, b) => {
                    const priorityA = this.getInitiativePriority(a, prevSegment);
                    const priorityB = this.getInitiativePriority(b, prevSegment);
                    if (priorityA !== priorityB) return priorityB - priorityA;
                    return (b.initiative || 0) - (a.initiative || 0);
                });

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
        // ─── HERO 6E BOUNDARY CHECK ───
        // Reset combat if we are on Turn 1, OR if we are on Turn 2 but haven't completed a full cycle yet
        // (Jumping backward 12 seconds from Turn 2, Segment 1-11 would push the timeline before Turn 1 Segment 12).
        if (this.round === 1 || (this.round === 2 && this.segment < 12)) {
            return this._handleCombatStartReset();
        }

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
     * Completely resets custom system flags and child initiative fields,
     * dropping the encounter state machine back onto the "Start Combat" panel.
     * @returns {Promise<HeroCombat>}
     * @private
     */
    async _handleCombatStartReset() {
        // 1. Prepare child collection updates to flip tokens back to dice icons
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: null,
            });
        });

        // 2. Compile parent settings payload using -= syntax to fully purge keys
        const resetData = {
            started: false,
            round: 0,
            turn: null,
            [`flags.${game.system.id}.-=currentSegment`]: null,
            [`flags.${game.system.id}.-=segmentRolls`]: null,
            [`flags.${game.system.id}.-=recoveredRounds`]: null,
            combatants: combatantUpdates,
        };

        ui.notifications.info("Hero System 6e | Resetting combat encounter to default startup state.");
        return this.update(resetData);
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

        // Extract the combatant who just concluded their action phase
        const previousCombatant = this.combatants.get(options.previousCombatantId);
        if (!previousCombatant?.actor) return;

        this._maintainTacticalStatuses(previousCombatant);
    }

    /**
     * Evaluates action economies and removes spent tactical statuses post-turn.
     * @param {Combatant} combatant
     * @private
     */
    async _maintainTacticalStatuses(combatant) {
        const statuses = combatant.actor.statuses;

        // ─── HERO 6E RULE: EXPIRE HELD ACTION POST-TURN ───
        // If they concluded their turn, and this segment matches their natural speed-chart phase,
        // their held action is officially consumed/expired.
        if (statuses.has("holding") && combatant.hasPhaseInSegment(this.segment)) {
            const holdingEffect = combatant.actor.effects.find((e) => e.statuses.has("holding"));
            if (holdingEffect) {
                await holdingEffect.delete();

                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
                    flavor: `<strong>Action Economy Notice</strong>`,
                    content: `${combatant.actor.name}'s Held Action was consumed by their natural Phase in Segment ${this.segment}.`,
                });
            }
        }

        // Call your global generic ActiveEffect cleaner for standard phaseEnd triggers (like aborted)
        this._expireCustomSystemEffects(combatant.actor);
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
                    if (effect.statuses.size > 0) {
                        // Aborted?
                        effectsToDelete.push(effect.id);
                    } else {
                        updatesToApply.push({
                            _id: effect.id,
                            disabled: true,
                        });
                    }
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
