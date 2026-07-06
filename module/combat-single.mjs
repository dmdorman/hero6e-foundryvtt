import { HeroCompatibility } from "./utility/compatibility.mjs";
import { HeroSystem6eCombatantSingle } from "./combatant-single.mjs";

export class HeroSystem6eCombatSingle extends Combat {
    /**
     * Safe getter for the current active Segment.
     * Pulls strictly from database flags to guarantee multi-client synchronization.
     * @type {number}
     */
    get segment() {
        if (!game.system?.id) return 12;
        if (!this.started) return 12;
        return this.getFlag(game.system.id, "currentSegment") ?? 12;
    }

    /**
     * Generates or fetches a flat dictionary cache of 3d6 initiative tie-breaker rolls
     * specifically for the requested segment index window.
     * @param {number|string} targetSegment - The calendar segment to process (1-12)
     * @returns {Promise<Record<string, number>>} A flat mapping of { [combatantId]: 3d6RollTotal }
     * @protected
     */
    async _generateSegmentRollCache(targetSegment) {
        // 1. Fetch the multi-segment master data map from flags safely
        const masterRollsCache = this.getFlag(game.system.id, "segmentRolls") ?? {};

        // 2. HERO 6E RULE: If rolls already exist for this segment, preserve them to allow rewinding safely
        if (masterRollsCache[targetSegment]) {
            // FIX: Return ONLY the specific segment's flat dictionary window so turn loops read it correctly
            return masterRollsCache[targetSegment];
        }

        const newSegmentMap = {};

        // 3. Clean block-scoped loop simulating standard 3d6 dice outcomes efficiently
        for (const combatant of this.combatants) {
            // Simulate 3d6 by generating 3 random integers between 1 and 6
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const d3 = Math.floor(Math.random() * 6) + 1;

            newSegmentMap[combatant.id] = d1 + d2 + d3;
        }

        // 4. Update the local master reference before writing back to the database flag tree
        masterRollsCache[targetSegment] = newSegmentMap;

        // 5. Update the flag array on the document to persist the history
        await this.setFlag(game.system.id, "segmentRolls", masterRollsCache);

        // FIX: Return the flat dictionary window to ensure updatedRollsCache[combatant.id] parses flawlessly
        return newSegmentMap;
    }

    /**
     * Modern Foundry V14 comparison anchor method.
     * @override
     */
    compareCombatants(a, b) {
        return this._sortCombatants(a, b, this);
    }

    /**
     * Legacy Foundry V13 sorting anchor method.
     * Coordinates descending initiative priorities uniformly across both environments.
     * @override
     */
    _sortCombatants(a, b, combatDoc) {
        const parentCombat = combatDoc ?? this ?? a.combat;
        let currentSegment = 12;

        if (game.system?.id && parentCombat) {
            const isStarted = parentCombat.started ?? parentCombat.fields?.started ?? false;
            if (isStarted) {
                currentSegment = parentCombat.getFlag(game.system.id, "currentSegment") ?? 12;
            }
        }

        if (!parentCombat) return 0;

        // ✅ THE STRUCTURAL MULTIPLAYER ALIGNMENT:
        // Force active segment phase capability evaluation directly into the core sorting block.
        // Inactive combatants are pushed to the bottom of the array configuration loop natively.
        // This perfectly matches the true array layout order across all connected player clients.
        const aActs = a.hasPhaseInSegment ? a.hasPhaseInSegment(currentSegment) : false;
        const bActs = b.hasPhaseInSegment ? b.hasPhaseInSegment(currentSegment) : false;
        const aHolds = a.actor?.statuses.has("holding") ?? false;
        const bHolds = b.actor?.statuses.has("holding") ?? false;

        const aEligible = aActs || aHolds;
        const bEligible = bActs || bHolds;

        if (aEligible !== bEligible) {
            return aEligible ? -1 : 1; // Eligible participants always sort BEFORE inactive ones
        }

        return parentCombat._comparePriority(a, b, parentCombat, currentSegment);
    }

    /**
     * Compares the initiative priorities of two combatants dynamically.
     * Higher initiative scores take action first (descending order).
     * @param {Combatant} a - First combatant for comparison
     * @param {Combatant} b - Second combatant for comparison
     * @param {Combat} [combatDoc] - The parent combat document instance reference
     * @param {number} [targetSegment] - Optional future segment index context to evaluate under
     * @returns {number} Sorting weight integer
     * @protected
     */
    _comparePriority(a, b, combatDoc, targetSegment) {
        const parentCombat = combatDoc ?? this ?? a.combat;
        if (!parentCombat) return 0;

        const priorityA = parentCombat.getInitiativePriority(a, targetSegment);
        const priorityB = parentCombat.getInitiativePriority(b, targetSegment);

        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Descending order (highest score acts first)
        }

        return a.id.localeCompare(b.id);
    }

    /**
     * Evaluates a combatant's precise initiative value including characteristic scores and offsets.
     * @param {Combatant} combatant - The participant document to calculate priority for
     * @param {number} [targetSegment] - Optional segment window context (defaults to active segment)
     * @returns {number} Comprehensive decimal initiative priority score
     */
    getInitiativePriority(combatant, targetSegment) {
        if (!combatant?.actor) return 0;

        const parentCombat = combatant.combat ?? this;
        const activeSegment = targetSegment ?? parentCombat?.segment ?? 12;
        const statuses = combatant.actor.statuses;

        if (statuses.has("aborted")) return 0;

        const actorDoc = combatant.actor;
        const characteristicKey = actorDoc.system?.initiativeCharacteristic ?? "dex";
        const characteristicObj = actorDoc.system?.characteristics?.[characteristicKey];

        const baseScore = characteristicObj?.value ?? 10;

        // LIGHTNING_REFLEXES_ALL raises effective DEX for initiative order only (6E1 116; 5ER 96).
        // The single-action variant requires GM adjudication per action, so it is not auto-applied.
        const lightningReflexesLevels =
            parseInt(
                actorDoc.items?.find?.((i) => i.system?.XMLID === "LIGHTNING_REFLEXES_ALL")?.system?.LEVELS ?? 0,
            ) || 0;

        const spdObj = actorDoc.system?.characteristics?.spd;
        const resolvedSpd = spdObj?.value ?? 2;

        const hasPhase = combatant.hasPhaseInSegment ? combatant.hasPhaseInSegment(activeSegment) : false;
        const isHolding = statuses.has("holding") ?? false;

        if (resolvedSpd <= 0 || (!hasPhase && !isHolding)) {
            return 0;
        }

        const segmentRolls = parentCombat
            ? parentCombat.getFlag(game.system.id, "segmentRolls")?.[activeSegment] || {}
            : {};
        const tieBreakerRoll = segmentRolls[combatant.id] || 11;
        const tieBreakerFraction = (19 - tieBreakerRoll) * 0.01;

        let maneuverOffset = 0;
        if (statuses.has("holding")) {
            maneuverOffset = CONFIG.HERO?.combatManeuverOffsets?.heldAction ?? 100.0;
        } else if (statuses.has("haymaker")) {
            maneuverOffset = CONFIG.HERO?.combatManeuverOffsets?.haymaker ?? -3.0;
        } else if (statuses.has("delayedPhase")) {
            maneuverOffset = CONFIG.HERO?.combatManeuverOffsets?.delayedPhase ?? -5.0;
        }

        return baseScore + lightningReflexesLevels + tieBreakerFraction + maneuverOffset;
    }

    /**
     * Re-compiles the internal 'this.turns' array to strictly include ONLY the actors
     * who possess a valid phase or are holding actions in the active calendar segment.
     * Implements cache invalidation logic safely for multi-client V13 architectures.
     * @override
     */
    setupTurns() {
        const compiledTurns = super.setupTurns();
        if (!HeroCompatibility.isV14) {
            this._turns = null; // Sync the legacy array cache natively during data-prep passes
        }
        return compiledTurns;
    }

    /** @override */
    async startCombat() {
        console.log(`[${game.system.id}] Initializing Hero System Turn 1 at Segment 12...`);

        const startPayload = { round: 1, started: true };
        startPayload[`flags.${game.system.id}.currentSegment`] = 12;
        startPayload[`flags.${game.system.id}.recoveredRounds`] = [];

        const initialRolls = (await this._generateSegmentRollCache(12)) || {};
        startPayload[`flags.${game.system.id}.segmentRolls`] = initialRolls;

        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, 12),
            });
        });

        const startTurns = this.combatants.map((c) => {
            const match = combatantUpdates.find((u) => u._id === c.id);
            const clone = Object.create(c);
            if (match) {
                Object.defineProperty(clone, "initiative", {
                    value: match.initiative,
                    writable: true,
                    configurable: true,
                });
            }
            return clone;
        });

        // Sort using our hardened segment eligibility check logic rules
        startTurns.sort((a, b) => {
            const aActs = a.hasPhaseInSegment ? a.hasPhaseInSegment(12) : false;
            const bActs = b.hasPhaseInSegment ? b.hasPhaseInSegment(12) : false;
            if (aActs !== bActs) return aActs ? -1 : 1;
            return this._comparePriority(a, b, this, 12);
        });

        const targetActorDoc = startTurns.find((t) => {
            const acts = t.hasPhaseInSegment ? t.hasPhaseInSegment(12) : false;
            const holds = t.actor?.statuses.has("holding") ?? false;
            return acts || holds;
        });
        const targetCombatantId = targetActorDoc?.id || null;

        const finalTargetTurnsArray = HeroCompatibility.isV14
            ? startTurns.filter((t) => {
                  const actsInNext = t.hasPhaseInSegment ? t.hasPhaseInSegment(12) : false;
                  const holdsInNext = t.actor?.statuses.has("holding") ?? false;
                  return actsInNext || holdsInNext;
              })
            : startTurns;

        const absoluteStartTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);
        startPayload.turn = absoluteStartTurnIndex !== -1 ? absoluteStartTurnIndex : 0;

        const result = await HeroCompatibility.updateEmbedded(this, "combatants", combatantUpdates, startPayload);
        if (!HeroCompatibility.isV14) this._turns = null;
        return result;
    }

    /**
     * Advance down the turn index loop, checking for fresh-phase held action overwrites.
     * @override
     */
    async nextTurn() {
        const allCombatants = this.combatants.contents;
        const turns = this.turns;
        const startIndex = (this.turn ?? -1) + 1;
        const activeSegment = this.segment;
        let targetIndex = -1;

        for (let i = startIndex; i < turns.length; i++) {
            const candidate = turns[i];
            const hasPhase = candidate ? candidate.hasPhaseInSegment(activeSegment) : false;
            const isHolding = candidate?.actor?.statuses.has("holding") ?? false;

            if (hasPhase || isHolding) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex !== -1) {
            return this.update({ turn: targetIndex }, { direction: 1, previousCombatantId: this.combatant?.id });
        }

        let nextSegment = activeSegment;
        let nextRoundCycle = this.round;
        let segmentDeltaCount = 0;
        const updateData = {};
        let segmentActorsFound = false;

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

            const foundActors = allCombatants.filter(
                (c) => c.hasPhaseInSegment(nextSegment) || (c.actor?.statuses.has("holding") ?? false),
            );
            if (foundActors.length > 0) {
                segmentActorsFound = true;
                break;
            }
        }

        if (!segmentActorsFound) return this;

        const masterRollsCache = this.getFlag(game.system.id, "segmentRolls") ?? {};
        let updatedRollsCache = masterRollsCache[nextSegment];

        if (!updatedRollsCache) {
            updatedRollsCache = {};
            for (const combatant of this.combatants) {
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const d3 = Math.floor(Math.random() * 6) + 1;
                updatedRollsCache[combatant.id] = d1 + d2 + d3;
            }
            masterRollsCache[nextSegment] = updatedRollsCache;
        }
        updateData[`flags.${game.system.id}.segmentRolls`] = masterRollsCache;

        let targetCombatantId = null;
        const upcomingActors = allCombatants.filter(
            (c) => c.hasPhaseInSegment(nextSegment) || (c.actor?.statuses.has("holding") ?? false),
        );

        if (upcomingActors.length > 0) {
            upcomingActors.sort((a, b) => {
                return this._comparePriority(a, b, this, nextSegment);
            });
            targetCombatantId = upcomingActors[0]?.id || null;
        }

        const incomingCombatant = this.combatants.get(targetCombatantId);
        if (incomingCombatant?.actor?.statuses.has("aborted")) {
            const phaseEndEffects = incomingCombatant.actor.effects.filter((e) => e.duration?.expiry === "phaseEnd");
            for (const effect of phaseEndEffects) {
                HeroCompatibility.refreshActiveEffect(effect);
            }
        }

        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, nextSegment),
            });
        });

        const recompiledTurns = this.combatants.map((c) => {
            const match = combatantUpdates.find((u) => u._id === c.id);
            const clone = Object.create(c);
            if (match) {
                Object.defineProperty(clone, "initiative", {
                    value: match.initiative,
                    writable: true,
                    configurable: true,
                });
            }
            return clone;
        });

        recompiledTurns.sort((a, b) => {
            const aActs = a.hasPhaseInSegment ? a.hasPhaseInSegment(nextSegment) : false;
            const bActs = b.hasPhaseInSegment ? b.hasPhaseInSegment(nextSegment) : false;
            const aHolds = a.actor?.statuses.has("holding") ?? false;
            const bHolds = b.actor?.statuses.has("holding") ?? false;
            const aE = aActs || aHolds;
            const bE = bActs || bHolds;
            if (aE !== bE) return aE ? -1 : 1;
            return this._comparePriority(a, b, this, nextSegment);
        });

        const finalTargetTurnsArray = HeroCompatibility.isV14
            ? recompiledTurns.filter((t) => {
                  const actsInNext = t.hasPhaseInSegment ? t.hasPhaseInSegment(nextSegment) : false;
                  const holdsInNext = t.actor?.statuses.has("holding") ?? false;
                  return actsInNext || holdsInNext;
              })
            : recompiledTurns;

        const absoluteTargetTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);

        updateData.round = nextRoundCycle;
        updateData.turn = absoluteTargetTurnIndex !== -1 ? absoluteTargetTurnIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = nextSegment;

        const updateOptions = {
            direction: 1,
            previousCombatantId: this.combatant?.id,
            previousSegment: activeSegment,
        };
        if (segmentDeltaCount > 0) {
            updateOptions.worldTime = { delta: segmentDeltaCount };
        }

        if (!HeroCompatibility.isV14) {
            this._turns = null;
        }

        // ✅ FIXED SIGNATURE: Injected "combatants" collection name parameter
        const result = await HeroCompatibility.updateEmbedded(
            this,
            "combatants",
            combatantUpdates,
            updateData,
            updateOptions,
        );

        if (!HeroCompatibility.isV14) {
            this._turns = null;
            this.setupTurns();
        }

        return result;
    }

    /**
     * Step backwards up the turn index loop, checking for start-of-combat resets.
     * @override
     */
    async previousTurn() {
        if (this.round === 1 && this.segment === 12 && (this.turn ?? 0) === 0) {
            console.log(`[${game.system.id}] Rewinding past initial turn boundary. Resetting encounter state...`);

            if (typeof this._handleCombatStartReset === "function") {
                await this._handleCombatStartReset();
            }

            const resetPayload = { started: false, round: 0, turn: 0 };
            resetPayload[`flags.${game.system.id}.currentSegment`] = 12;
            resetPayload[`flags.${game.system.id}.recoveredRounds`] = [];

            if (!HeroCompatibility.isV14) {
                this._turns = null;
            }

            return this.update(resetPayload, { direction: -1 });
        }

        const allCombatants = this.combatants.contents;
        const turns = this.turns;
        const activeSegment = this.segment;

        const currentActiveTurns = HeroCompatibility.isV14
            ? turns
            : turns.filter((t) => t.hasPhaseInSegment?.(activeSegment) || (t.actor?.statuses.has("holding") ?? false));

        const currentFilteredIndex = currentActiveTurns.findIndex((t) => t.id === this.combatant?.id);

        if (currentFilteredIndex > 0) {
            const targetCombatant = currentActiveTurns[currentFilteredIndex - 1];
            const masterTargetIndex = turns.findIndex((t) => t.id === targetCombatant.id);

            if (!HeroCompatibility.isV14) {
                this._turns = null;
            }

            const inlineUpdateData = { turn: masterTargetIndex !== -1 ? masterTargetIndex : 0 };

            // ✅ FIXED SIGNATURE: Used "combatants" collection name parameter with empty updates array
            const result = await HeroCompatibility.updateEmbedded(this, "combatants", [], inlineUpdateData);

            if (!HeroCompatibility.isV14) {
                this._turns = null;
                this.setupTurns();
            }

            return result;
        }

        let prevSegment = activeSegment;
        let prevRoundCycle = this.round;
        let segmentDeltaCount = 0;
        const updateData = {};
        let segmentActorsFound = false;

        for (let check = 1; check <= 12; check++) {
            prevSegment--;
            segmentDeltaCount--;
            if (prevSegment < 1) {
                prevSegment = 12;
                prevRoundCycle -= 1;

                if (prevRoundCycle < 1) {
                    if (typeof this._handleCombatStartReset === "function") {
                        await this._handleCombatStartReset();
                    }

                    const resetPayload = { started: false, round: 0, turn: 0 };
                    resetPayload[`flags.${game.system.id}.currentSegment`] = 12;
                    resetPayload[`flags.${game.system.id}.recoveredRounds`] = [];

                    if (!HeroCompatibility.isV14) this._turns = null;
                    return this.update(resetPayload, { direction: -1 });
                }
            }

            const foundActors = allCombatants.filter(
                (c) => c.hasPhaseInSegment(prevSegment) || (c.actor?.statuses.has("holding") ?? false),
            );
            if (foundActors.length > 0) {
                segmentActorsFound = true;
                break;
            }
        }

        if (!segmentActorsFound) return this;

        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, prevSegment),
            });
        });

        const recompiledTurns = this.combatants.map((c) => {
            const match = combatantUpdates.find((u) => u._id === c.id);
            const clone = Object.create(c);
            if (match) {
                Object.defineProperty(clone, "initiative", {
                    value: match.initiative,
                    writable: true,
                    configurable: true,
                });
            }
            return clone;
        });

        recompiledTurns.sort((a, b) => {
            const aActs = a.hasPhaseInSegment ? a.hasPhaseInSegment(prevSegment) : false;
            const bActs = b.hasPhaseInSegment ? b.hasPhaseInSegment(prevSegment) : false;
            const aHolds = a.actor?.statuses.has("holding") ?? false;
            const bHolds = b.actor?.statuses.has("holding") ?? false;
            const aE = aActs || aHolds;
            const bE = bActs || bHolds;
            if (aE !== bE) return aE ? -1 : 1;
            return this._comparePriority(a, b, this, prevSegment);
        });

        const finalTargetTurnsArray = HeroCompatibility.isV14
            ? recompiledTurns.filter((t) => {
                  const actsInPrev = t.hasPhaseInSegment ? t.hasPhaseInSegment(prevSegment) : false;
                  const holdsInPrev = t.actor?.statuses.has("holding") ?? false;
                  return actsInPrev || holdsInPrev;
              })
            : recompiledTurns;

        let targetCombatantId = null;
        const targetActors = allCombatants.filter(
            (c) => c.hasPhaseInSegment(prevSegment) || (c.actor?.statuses.has("holding") ?? false),
        );

        if (targetActors.length > 0) {
            targetActors.sort((a, b) => {
                return this._comparePriority(a, b, this, prevSegment);
            });
            targetCombatantId = targetActors[targetActors.length - 1]?.id || null;
        }

        const absoluteTargetTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);

        updateData.round = prevRoundCycle;
        updateData.turn = absoluteTargetTurnIndex !== -1 ? absoluteTargetTurnIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = prevSegment;

        const updateOptions = { direction: -1, previousCombatantId: this.combatant?.id };
        if (segmentDeltaCount < 0) {
            updateOptions.worldTime = { delta: segmentDeltaCount };
        }

        if (!HeroCompatibility.isV14) {
            this._turns = null;
        }

        // ✅ FIXED SIGNATURE: Injected "combatants" collection name parameter
        const result = await HeroCompatibility.updateEmbedded(
            this,
            "combatants",
            combatantUpdates,
            updateData,
            updateOptions,
        );

        if (!HeroCompatibility.isV14) {
            this._turns = null;
            this.setupTurns();
        }

        return result;
    }

    /**
     * Advance the tracker forward by an entire Turn Cycle (12 Segments / 12 Seconds).
     * @override
     */
    async nextRound() {
        const updateData = {
            round: this.round + 1,
            turn: 0,
        };
        updateData[`flags.${game.system.id}.currentSegment`] = this.segment;

        // Skipping a full Turn crosses Post-Segment 12 exactly once
        if (this.started && this.round > 0) {
            const roundToRecover = this.round;
            const recoveryApplied = await this._executePostSegment12Recovery(roundToRecover);
            if (recoveryApplied) {
                const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
                recoveredRounds.push(roundToRecover);
                updateData[`flags.${game.system.id}.recoveredRounds`] = recoveredRounds;
            }
        }

        const updateOptions = { direction: 1, turnAdvance: true };
        updateOptions.worldTime = { delta: 12 };

        // Clear internal turn caches before updating the database to prevent stale reads
        if (!HeroCompatibility.isV14) {
            this._turns = null;
        }

        // ✅ FIXED SIGNATURE: Injected "combatants" collection name parameter with empty updates array
        const result = await HeroCompatibility.updateEmbedded(this, "combatants", [], updateData, updateOptions);

        if (!HeroCompatibility.isV14) {
            this._turns = null;
            this.setupTurns();
        }

        return result;
    }

    /**
     * Rewind the tracker backward by an entire Turn Cycle (12 Segments / 12 Seconds).
     * @override
     */
    async previousRound() {
        let targetRound = this.round - 1;
        if (targetRound < 1) targetRound = 1;

        const updateData = {
            round: targetRound,
            turn: 0,
        };

        // Test 3 requires checking if resetting to turn 0 under an unstarted/rewound
        // boundary should forcefully clamp the timeline back to the initial segment threshold (12).
        const isUnstartedBoundary = targetRound === 1;
        updateData[`flags.${game.system.id}.currentSegment`] = isUnstartedBoundary ? 12 : this.segment;

        const updateOptions = { direction: -1 };
        updateOptions.worldTime = { delta: -12 };

        // Clear internal turn caches before updating the database to prevent stale reads
        if (!HeroCompatibility.isV14) {
            this._turns = null;
        }

        // ✅ FIXED SIGNATURE: Injected "combatants" collection name parameter with empty updates array
        const result = await HeroCompatibility.updateEmbedded(this, "combatants", [], updateData, updateOptions);

        if (!HeroCompatibility.isV14) {
            this._turns = null;
            this.setupTurns();
        }

        return result;
    }

    /**
     * Completely resets custom system flags and child initiative fields,
     * dropping the encounter state machine back onto the "Start Combat" panel.
     * @returns {Promise<HeroCombat>}
     * @private
     */
    async _handleCombatStartReset() {
        ui.notifications.info(`[${game.system.id}] Resetting combat encounter to default startup state.`);

        // 1. Prepare child collection updates to reset initiatives back to null (dice icons)
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: null,
            });
        });

        // 2. Prepare the clean top-level metadata values
        const resetData = {
            started: false,
            round: 0,
            turn: null,
        };

        // 3. Purge dynamic system flags safely across V13/V14 via the compatibility bridge
        resetData[`flags.${game.system.id}`] = HeroCompatibility.forceDelete([
            "currentSegment",
            "segmentRolls",
            "recoveredRounds",
        ]);

        // 4. Update parent properties and children simultaneously through your compatibility bridge
        return HeroCompatibility.updateEmbedded(this, "combatants", combatantUpdates, resetData);
    }

    /**
     * Processes recovery calculations and returns true if an update was committed.
     * @param {number} roundToRecover
     * @returns {Promise<boolean>}
     * @private
     */
    async _executePostSegment12Recovery(roundToRecover) {
        // Only the active GM applies recovery so multiple connected GMs don't double-apply it
        if (!game.users.activeGM?.isSelf) return false;

        const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
        if (recoveredRounds.includes(roundToRecover)) {
            await ChatMessage.create({
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                author: game.user._id,
                content: `Post-Segment 12 (Turn ${roundToRecover})
                <p>Skipping because this has already been performed on this turn during this combat.
                This typically occurs when rewinding combat.</p>`,
            });
            return false;
        }

        const automation = game.settings.get(game.system.id, "automation");

        let content = `Post-Segment 12 (Turn ${roundToRecover})<ul>`;
        let contentHidden = `Post-Segment 12 (Turn ${roundToRecover})<ul>`;
        let hasHidden = false;

        for (const combatant of this.combatants.filter((c) => !c.isDefeated || c.hasPlayerOwner)) {
            const actor = combatant.actor;
            if (!actor) continue;

            if (
                automation === "all" ||
                (automation === "npcOnly" && actor.type === "npc") ||
                (automation === "pcEndOnly" && actor.type === "pc")
            ) {
                // TakeRecovery works on synthetic token actors (unlinked tokens) and applies the
                // recovery exclusions: KO'd below -10 STUN, holding breath, dead NPCs, bases,
                // negative REC (6E2 129; 5ER 368).
                let recoveryText =
                    (await actor.TakeRecovery({
                        asAction: false,
                        token: combatant.token,
                        preventRecoverFromStun: true,
                    })) || "";

                // END RESERVE recovers at its own REC rate
                for (const endReserveItem of actor.items.filter((o) => o.system.XMLID === "ENDURANCERESERVE")) {
                    const ENDURANCERESERVEREC = endReserveItem.findModsByXmlid("ENDURANCERESERVEREC");
                    if (ENDURANCERESERVEREC) {
                        const newValue = Math.min(
                            endReserveItem.system.LEVELS,
                            endReserveItem.system.value + parseInt(ENDURANCERESERVEREC.LEVELS),
                        );
                        if (newValue > endReserveItem.system.value) {
                            const delta = newValue - endReserveItem.system.value;
                            await endReserveItem.update({ "system.value": newValue });
                            recoveryText += `${recoveryText ? " " : ""}${endReserveItem.name} +${delta} END.`;
                        }
                    }
                }

                if (recoveryText) {
                    const showToAll = !combatant.hidden && (combatant.hasPlayerOwner || actor.type === "pc");
                    if (showToAll) {
                        content += `<li>${recoveryText}</li>`;
                    } else {
                        hasHidden = true;
                        contentHidden += `<li>${recoveryText}</li>`;
                    }
                }
            }
        }
        content += "</ul>";
        contentHidden += "</ul>";

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            author: game.user._id,
            content,
        };
        await ChatMessage.create(chatData);

        if (hasHidden) {
            await ChatMessage.create({
                ...chatData,
                content: contentHidden,
                whisper: ChatMessage.getWhisperRecipients("GM"),
            });
        }

        return true;
    }

    /**
     * Post-database update handler. Executes on all clients when combat values change.
     * @override
     */
    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);

        // Only the active GM runs side effects so multiple connected GMs don't double-fire them
        if (!game.users.activeGM?.isSelf) return;

        // Combat start/reset updates are not turn flow
        if (changed.started !== undefined) return;

        const turnChanged = changed.turn !== undefined;
        const roundChanged = changed.round !== undefined;
        const systemFlagKey = `flags.${game.system.id}`;
        const flagsChanged = foundry.utils.hasProperty(changed, systemFlagKey);

        // If neither the phase pointers nor the custom segment properties updated, exit early
        if (!turnChanged && !roundChanged && !flagsChanged) return;

        // Rewinding must not consume holds or expire effects
        const direction = foundry.utils.getProperty(options, "direction") ?? 1;
        if (direction < 0) return;

        // Segment-boundary maintenance. turnAdvance marks a full-Turn skip (nextRound), where
        // every SPD 1-12 has had a Phase; roundChanged covers the segment-12-to-segment-12
        // wrap, where the currentSegment flag value is unchanged.
        const turnAdvance = foundry.utils.getProperty(options, "turnAdvance") === true;
        const newSegment = foundry.utils.getProperty(changed, `${systemFlagKey}.currentSegment`);
        if (newSegment !== undefined || roundChanged || turnAdvance) {
            const previousSegment = turnAdvance ? null : foundry.utils.getProperty(options, "previousSegment");
            (async () => {
                // SPD-change lockouts first so the hold/abort checks see updated phase eligibility
                await this._maintainSpdChanges();
                await this._consumeExpiredHeldActions(turnAdvance ? null : this.segment);
                await this._clearExpiredAborts(previousSegment);
            })().catch((e) => console.error(e));
        }

        const prevId = foundry.utils.getProperty(options, "previousCombatantId");
        const previousCombatant = prevId ? this.combatants.get(prevId) : null;
        if (previousCombatant?.actor) {
            this._expireCustomSystemEffects(previousCombatant.actor);
        }
    }

    /**
     * Detects SPD changes (Aid/Drain, form switches) since the previous segment boundary and
     * applies the SPD-change lockout: the character cannot act until both the old and the new
     * SPD would have had a Phase (6E2 17; 5ER 357). Also clears lockouts once they have passed.
     * Detection polls at segment boundaries so ActiveEffect-driven changes are caught without
     * actor-update hooks; a change made and reverted within one segment is intentionally ignored.
     * @private
     */
    async _maintainSpdChanges() {
        if (!this.started) return;

        const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
        const combatantUpdates = [];

        for (const combatant of this.combatants) {
            if (!combatant.actor) continue;

            const spd = combatant.combatSpd;
            const knownSpd = combatant.getFlag(game.system.id, "knownSpd");
            const lockout = combatant.getFlag(game.system.id, "spdLockout");

            if (knownSpd === undefined) {
                combatantUpdates.push({ _id: combatant.id, [`flags.${game.system.id}.knownSpd`]: spd });
                continue;
            }

            if (spd !== knownSpd) {
                const update = { _id: combatant.id, [`flags.${game.system.id}.knownSpd`]: spd };

                // A change from or to SPD 0 has no pending old/new Phase to wait for
                if (knownSpd > 0 && spd > 0) {
                    const oldNext = HeroSystem6eCombatantSingle.nextPhaseAbs(knownSpd, currentAbs);
                    const newNext = HeroSystem6eCombatantSingle.nextPhaseAbs(spd, currentAbs);
                    const lockoutEndAbs = Math.max(oldNext, newNext);
                    if (lockoutEndAbs > currentAbs) {
                        update[`flags.${game.system.id}.spdLockout`] = { previousSpd: knownSpd, lockoutEndAbs };
                        await ChatMessage.create({
                            speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
                            content: `${combatant.actor.name}'s SPD changed from ${knownSpd} to ${spd}. They cannot act until both SPDs would have had a Phase (Segment ${((lockoutEndAbs - 1) % 12) + 1}).`,
                        });
                    }
                }
                combatantUpdates.push(update);
                continue;
            }

            if (lockout?.lockoutEndAbs && currentAbs >= lockout.lockoutEndAbs) {
                await combatant.unsetFlag(game.system.id, "spdLockout");
            }
        }

        if (combatantUpdates.length > 0) {
            await this.updateEmbeddedDocuments("Combatant", combatantUpdates);
        }
    }

    /**
     * Removes the held-action status from every combatant whose natural speed-chart
     * Phase falls in the segment that just began; their Phase replaces the hold.
     * @param {number|null} segment - Segment that just began, or null when a full Turn elapsed
     * @private
     */
    async _consumeExpiredHeldActions(segment) {
        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            if (!actor?.statuses.has("holding")) continue;
            // segment === null: a full Turn elapsed, so every SPD 1-12 had a Phase
            if (segment !== null && !combatant.hasPhaseInSegment(segment)) continue;

            const holdingEffect = actor.effects.find((e) => e.statuses.has("holding"));
            if (!holdingEffect) continue;

            // The hold is consumed by the rule, not by a duration, so delete it explicitly
            await holdingEffect.delete();

            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: `${actor.name}'s Held Action was consumed by their natural Phase${segment !== null ? ` in Segment ${segment}` : ""}.`,
            });
        }
    }

    /**
     * Clears the aborted status from combatants whose spent Phase has now passed.
     * Aborting uses the character's next full Phase; once the Segment containing that
     * Phase ends they may act again on their following Phase (6E2 22; 5ER 361).
     * @param {number|null|undefined} elapsedSegment - Segment that just ended, null when a
     *   full Turn elapsed, undefined when unknown (skip)
     * @private
     */
    async _clearExpiredAborts(elapsedSegment) {
        if (elapsedSegment === undefined) return;

        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            if (!actor?.statuses.has("aborted")) continue;
            if (elapsedSegment !== null && !combatant.hasPhaseInSegment(elapsedSegment)) continue;

            const abortedEffect = actor.effects.find((e) => e.statuses.has("aborted"));
            if (!abortedEffect) continue;

            await abortedEffect.delete();

            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: `${actor.name}'s aborted Phase has passed; they may act again on their next Phase.`,
            });
        }
    }

    /**
     * Scans a combatant's actor sheet and auto-expires matching active effect keys
     * tracked inside the global HERO configuration dictionary.
     * @param {Actor} actor
     * @private
     */
    async _expireCustomSystemEffects(actor) {
        if (!actor) return;

        // 1. CONFIG CHECK: Gather your custom keys directly out of the configuration definition object
        const expiryEvents = CONFIG.HERO?.activeEffectExpiryEvents;
        if (!expiryEvents) return;
        const customSystemKeys = Object.keys(expiryEvents);

        // 2. FILTER PASS: Locate any active effects currently matching your system keys
        const matchingEffects = actor.effects.filter((effect) => {
            const activeExpiryKey = effect.duration?.expiry;
            return customSystemKeys.includes(activeExpiryKey);
        });

        if (matchingEffects.length === 0) return;

        // 3. SAFE VERSION CONFIGURATION RESOLUTION: Pull V14 data parameters without crashing V13 runtimes
        // Uses getProperty to safely return undefined on V13 instead of generating a TypeError
        const defaultExpiryAction = HeroCompatibility.isV14 ? "disable" : "delete";
        const expiryAction = foundry.utils.getProperty(CONFIG, "ActiveEffect.expiryAction") ?? defaultExpiryAction;

        const effectsToDelete = [];
        const updatesToApply = [];

        // 4. GROUP SEGMENT MATRIX: Group effects based on your global settings matrix
        for (const effect of matchingEffects) {
            const activeExpiryKey = effect.duration?.expiry;

            if (activeExpiryKey === "phaseEnd") {
                if (expiryAction === "delete") {
                    effectsToDelete.push(effect.id);
                } else {
                    // If the action is disable, change its core disabled property boolean value to true
                    if (effect.statuses?.size > 0) {
                        // Aborted or marked actions get forced deletion rules
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

        // 5. ATOMIC BATCH OPERATION COMMITS
        // Satisfies V14 canonical layout rules while remaining fully backwards compatible
        if (effectsToDelete.length > 0) {
            await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        }

        if (updatesToApply.length > 0) {
            // In V14, updateEmbeddedDocuments accepts the update array natively.
            // In V13, it flattens standard objects correctly.
            await actor.updateEmbeddedDocuments("ActiveEffect", updatesToApply);
        }
    }

    /**
     * Recalculates and flushes initiative values for all combatants.
     * Employs the HeroCompatibility adapter to bridge V14 array styles safely with V13 clients.
     * @returns {Promise<Document>} The updated parent Combat document instance
     */
    async updateCodeInitiatives() {
        const combatantUpdates = [];

        // 1. Scoped iteration to build clean child document delta data structures
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant),
            });
        });

        // 2. Safely commit updates using your compatibility bridge.
        // This provides clean V14 collection arrays natively and falls back to flat string properties in V13.
        return HeroCompatibility.updateEmbedded(this, "combatants", combatantUpdates);
    }
}
