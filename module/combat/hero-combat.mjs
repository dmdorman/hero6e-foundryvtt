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
     * GENERIC PRIORITY CALCULATOR
     * Returns a single numerical value representing a combatant's action priority.
     * Higher values mean higher priority (acts earlier in the segment).
     * @param {Combatant} combatant
     * @returns {number}
     */
    getInitiativePriority(combatant) {
        if (!combatant?.actor) return 0;

        const initiativeCharacteristic = combatant.actor.system.initiativeCharacteristic ?? "dex";

        const priorityValue = combatant.actor.system?.characteristics?.[initiativeCharacteristic]?.value || 0;

        return priorityValue;
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
        // Force the custom segment state to explicitly be Segment 12 on startup
        await this.setFlag(game.system.id, "currentSegment", 12);

        // PURGE RECOVERY FLAGS: Reset the recovered rounds tracker cache array completely
        await this.setFlag(game.system.id, "recoveredRounds", []);

        const firstActingIndex = this.turns.findIndex((t) => t.hasPhaseInSegment(12));
        const startingTurnIndex = firstActingIndex !== -1 ? firstActingIndex : 0;

        await super.startCombat();
        return this.update({ turn: startingTurnIndex });
    }

    /**
     * Advance down the turn index loop, bundling segment flags, time deltas,
     * and post-12 recovery caching into a single unified database update.
     * @override
     */
    async nextTurn() {
        const turns = this.turns;
        const startIndex = (this.turn ?? -1) + 1;
        let targetIndex = -1;

        // 1. Scan remainder of the active segment array to find the next acting combatant
        for (let i = startIndex; i < turns.length; i++) {
            if (turns[i]?.hasPhaseInSegment(this.segment)) {
                targetIndex = i;
                break;
            }
        }

        // 2. Step straight to them if found inside the active segment window
        if (targetIndex !== -1) {
            return this.update({ turn: targetIndex });
        }

        // 3. Otherwise, nobody remains. Initialize our master update data tracker.
        let nextSegment = this.segment;
        let nextRoundCycle = this.round;
        let foundNextActorIndex = -1;
        let segmentDeltaCount = 0;

        // Declare the master update object up-front so loops can inject sub-properties into it
        const updateData = {};

        // Scan segments sequentially forward up to a maximum complete rotation loop
        for (let check = 1; check <= 12; check++) {
            nextSegment++;
            segmentDeltaCount++; // Accumulate every calendar second crossed

            if (nextSegment > 12) {
                nextSegment = 1;
                nextRoundCycle += 1;

                // Trigger automated Post-Segment 12 Recovery Phase loops
                // We pass the round number that just concluded (nextRoundCycle - 1)
                const roundToRecover = nextRoundCycle - 1;
                const recoveryApplied = await this._executePostSegment12Recovery(roundToRecover);

                if (recoveryApplied) {
                    const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
                    recoveredRounds.push(roundToRecover);

                    // Inject the updated flag history array straight into the master data payload
                    updateData[`flags.${game.system.id}.recoveredRounds`] = recoveredRounds;
                }
            }

            // Filter all actors who have a phase configured in this upcoming segment
            const actorsInNewSegment = turns.filter((t) => t.hasPhaseInSegment(nextSegment));

            if (actorsInNewSegment.length > 0) {
                actorsInNewSegment.sort((a, b) => this._comparePriority(a, b));
                foundNextActorIndex = turns.indexOf(actorsInNewSegment[0]);
                break;
            }
        }

        // 4. Populate the remaining tracker indices and the new segment flag into the payload
        updateData.round = nextRoundCycle;
        updateData.turn = foundNextActorIndex !== -1 ? foundNextActorIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = nextSegment;

        // 5. Package tracking options correctly for V14's core database architecture
        const updateOptions = {
            direction: 1,
        };

        // Only progress worldTime if we actually stepped out of the current segment boundary
        if (segmentDeltaCount > 0) {
            updateOptions.worldTime = {
                delta: segmentDeltaCount, // Dynamically jumps forward by the exact number of seconds skipped
            };
        }

        // A single atomic update transaction that changes rounds, turns, segment flags, recovery states, and world time
        return this.update(updateData, updateOptions);
    }

    /**
     * Step backwards up the turn index loop, calculating precise chronological rewind leaps.
     * @override
     */
    async previousTurn() {
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

        if (targetIndex !== -1) {
            return this.update({ turn: targetIndex });
        }

        // 2. Segment boundary crossed. Calculate backwards leap distance.
        const startingSegment = this.segment;
        let prevSegment = startingSegment;
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

                // Target lowest priority actor when rewinding segments
                const lastActorOfSegment = actorsInPrevSegment[actorsInPrevSegment.length - 1];
                foundPrevActorIndex = turns.indexOf(lastActorOfSegment);
                break;
            }
        }

        // 3. Build single transaction update payload
        const updateData = {
            round: prevRoundCycle,
            turn: foundPrevActorIndex !== -1 ? foundPrevActorIndex : 0,
            [`flags.${game.system.id}.currentSegment`]: prevSegment,
        };

        // 4. Canonical V14 Combat Update Options
        // Rewinding a segment boundary always returns a calculated segmentDeltaCount
        const updateOptions = {
            direction: -1,
            worldTime: {
                delta: -segmentDeltaCount, // Passes the exact negative value to cleanly rewind the clock
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

        // 6. Advance the world clock by an entire Turn Cycle (12 segments = 12 seconds)
        const updateOptions = {
            direction: 1,
            worldTime: {
                delta: 12,
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
        const customSystemKeys = Object.keys(HERO.activeEffectExpiryEvents); // Returns ['onPhaseEnd', 'onSegmentEnd', 'onTurnEnd']

        // 2. Locate any active effects currently matching your system keys
        const matchingEffects = actor.effects.filter((effect) => {
            const activeExpiryKey = effect.duration?.expiry;
            return customSystemKeys.includes(activeExpiryKey);
        });

        // 3. Filter and cycle through your keys based on specific combat events
        for (const effect of matchingEffects) {
            const activeExpiryKey = effect.duration?.expiry;

            // Conditional safety gate: check if the expiration rule aligns with the active trigger window
            if (activeExpiryKey === "phaseEnd") {
                await effect._handleDurationExpiry();
            }

            // Future expansion: hook up separate validation triggers for adjacent system metrics
            // else if (activeExpiryKey === "onSegmentEnd" && flagsChanged) {
            //   await effect._handleDurationExpiry();
            // }
        }
    }
}
