import { HeroCompatibility } from "./utility/compatibility.mjs";
import { HeroSystem6eCombatantSingle } from "./combatant-single.mjs";
import { expireManeuverNextPhaseEffects } from "./item/maneuver.mjs";

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
     * Rolls a fresh 0-99 initiative tie-breaker for every combatant. Rolls are keyed by
     * root actor id so every token of the same base actor shares one roll and therefore
     * ties on the same DEX, letting the tracker group them.
     * @returns {Record<string, number>} A flat mapping of { [rollKey]: 0-99 }
     * @protected
     */
    _buildSegmentRollMap() {
        const newSegmentMap = {};
        for (const combatant of this.combatants) {
            const rollKey = combatant.actorId || combatant.id;
            newSegmentMap[rollKey] ??= Math.floor(Math.random() * 100);
        }
        return newSegmentMap;
    }

    /**
     * Generates or fetches a flat dictionary cache of 0-99 initiative tie-breaker rolls
     * specifically for the requested segment index window.
     * @param {number|string} targetSegment - The calendar segment to process (1-12)
     * @returns {Promise<Record<string, number>>} A flat mapping of { [rollKey]: 0-99 }
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

        const newSegmentMap = this._buildSegmentRollMap();

        // 3. Update the local master reference before writing back to the database flag tree
        masterRollsCache[targetSegment] = newSegmentMap;

        // 4. Update the flag array on the document to persist the history
        await this.setFlag(game.system.id, "segmentRolls", masterRollsCache);

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
        const aEligible = a.occupiesSegment?.(currentSegment) ?? false;
        const bEligible = b.occupiesSegment?.(currentSegment) ?? false;

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
     * @param {object} [options]
     * @param {boolean} [options.ignoreHold] - Score the natural Phase position even when a
     *   positional hold exists (used for the position a combatant just acted at)
     * @returns {number} Comprehensive decimal initiative priority score
     */
    getInitiativePriority(combatant, targetSegment, { ignoreHold = false } = {}) {
        if (!combatant?.actor) return 0;

        const parentCombat = combatant.combat ?? this;
        const activeSegment = targetSegment ?? parentCombat?.segment ?? 12;
        const statuses = combatant.actor.statuses;

        // Aborted combatants keep their natural priority: the skip lives entirely in
        // _takesTurnInSegment. Zeroing here re-sorted them mid-segment (turn is an
        // index into the sorted array) and rendered the consumed Phase at 0.00 instead
        // of struck through at its DEX position.

        const actorDoc = combatant.actor;
        const characteristicKey = actorDoc.system?.initiativeCharacteristic ?? "dex";
        const characteristicObj = actorDoc.system?.characteristics?.[characteristicKey];

        const baseScore = characteristicObj?.value ?? 10;

        // Lightning Reflexes raises effective DEX for acting order only (6E1 116; 5ER 96).
        // Unrestricted All Actions levels always apply; scoped purchases (single action,
        // group, HTH/ranged — the character may only execute that action when acting
        // early) apply only while the combatant elevated themselves this segment.
        const lr = combatant.lightningReflexes ?? { always: 0, scoped: null };
        let lightningReflexesLevels = lr.always;
        if (lr.scoped && combatant.lrElevatedAbs !== null) {
            const combatSegment = parentCombat?.segment ?? activeSegment;
            const combatAbs = HeroSystem6eCombatantSingle.absoluteSegment(parentCombat?.round ?? 0, combatSegment);
            const queryAbs = combatAbs + ((activeSegment - combatSegment + 12) % 12);
            if (combatant.lrElevatedAbs === queryAbs) lightningReflexesLevels += lr.scoped.levels;
        }

        const spdObj = actorDoc.system?.characteristics?.spd;
        const resolvedSpd = spdObj?.value ?? 2;

        const hasPhase = combatant.hasPhaseInSegment ? combatant.hasPhaseInSegment(activeSegment) : false;
        // A positional Held Action slots the combatant at their declared DEX in the declared
        // segment; event/generic holds occupy no initiative position (tracker panel instead).
        // A spent hold keeps the acted position for display sorting until the segment ends.
        const positionalHold =
            !ignoreHold && combatant.holdsPositionInSegment?.(activeSegment) ? combatant.heldAction : null;
        const spentHold = combatant.spentHoldInSegment?.(activeSegment) ? combatant.spentHoldPosition : null;

        if (resolvedSpd <= 0 || (!hasPhase && !positionalHold && !spentHold)) {
            return 0;
        }

        const segmentRolls = parentCombat
            ? parentCombat.getFlag(game.system.id, "segmentRolls")?.[activeSegment] || {}
            : {};
        // Rolls are keyed by root actor id; fall back to combatant id for pre-existing combats
        const tieBreakerRoll = segmentRolls[combatant.actorId || combatant.id] ?? segmentRolls[combatant.id] ?? 50;
        const tieBreakerFraction = tieBreakerRoll * 0.01;

        if (positionalHold) {
            // The declared DEX is the exact acting position: LR and maneuver offsets don't move it
            return (positionalHold.dex ?? baseScore) + tieBreakerFraction;
        }
        if (spentHold) {
            return (spentHold.dex ?? baseScore) + tieBreakerFraction;
        }

        let maneuverOffset = 0;
        if (statuses.has("haymaker")) {
            maneuverOffset = CONFIG.HERO?.combatManeuverOffsets?.haymaker ?? -3.0;
        } else if (statuses.has("delayedPhase")) {
            maneuverOffset = CONFIG.HERO?.combatManeuverOffsets?.delayedPhase ?? -5.0;
        }

        return baseScore + lightningReflexesLevels + tieBreakerFraction + maneuverOffset;
    }

    /**
     * Whether a combatant actually receives a turn in the given segment: they must have
     * a Phase there (or a positional Held Action declared for it), must not be skipped
     * as defeated when the core tracker's Skip Defeated setting is on, and must not have
     * aborted their Phase. Event/generic holds receive no turn; they act on demand via
     * the tracker's Held Actions panel.
     * @param {Combatant} combatant
     * @param {number} segment
     * @param {object} [options]
     * @param {boolean} [options.ignoreAbort] - Treat a lingering aborted status as spent
     *   because the aborted Phase already passed earlier in the same advance
     * @returns {boolean}
     * @protected
     */
    _takesTurnInSegment(combatant, segment, { ignoreAbort = false } = {}) {
        const actor = combatant?.actor;
        if (!actor) return false;
        if ((this.settings?.skipDefeated ?? false) && combatant.isOutOfCombat) return false;
        if (!ignoreAbort && actor.statuses.has("aborted")) {
            const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
            const queryAbs = currentAbs + ((segment - this.segment + 12) % 12);
            if (combatant.abortAppliesAtAbs?.(queryAbs) ?? true) return false;
        }
        // A spent hold already consumed this segment's action (using a Held Action
        // replaces the Phase: he cannot have two Phases in one Segment, 6E2 20)
        if (combatant.spentHoldInSegment?.(segment)) return false;
        const hold = combatant.heldAction;
        // A positional hold commits the banked Phase to its declared slot
        if (hold?.mode === "position") return combatant.holdsPositionInSegment(segment);
        return combatant.hasPhaseInSegment?.(segment) ?? false;
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

        const startInitiativeById = new Map(combatantUpdates.map((u) => [u._id, u]));
        const startTurns = this.combatants.map((c) => {
            const match = startInitiativeById.get(c.id);
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
            const aActs = a.occupiesSegment ? a.occupiesSegment(12) : false;
            const bActs = b.occupiesSegment ? b.occupiesSegment(12) : false;
            if (aActs !== bActs) return aActs ? -1 : 1;
            return this._comparePriority(a, b, this, 12);
        });

        const targetActorDoc = startTurns.find((t) => this._takesTurnInSegment(t, 12));
        const targetCombatantId = targetActorDoc?.id || null;

        const finalTargetTurnsArray = HeroCompatibility.isV14
            ? startTurns.filter((t) => t.occupiesSegment?.(12) ?? false)
            : startTurns;

        const absoluteStartTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);
        startPayload.turn = absoluteStartTurnIndex !== -1 ? absoluteStartTurnIndex : 0;
        startPayload[`flags.${game.system.id}.actingPriority`] = targetActorDoc
            ? this.getInitiativePriority(targetActorDoc, 12)
            : null;

        const result = await HeroCompatibility.updateEmbedded(this, "combatants", combatantUpdates, startPayload);
        if (!HeroCompatibility.isV14) this._turns = null;
        return result;
    }

    /**
     * Advance down the turn index loop, checking for fresh-phase held action overwrites.
     * @override
     */
    /**
     * @param {object} [options]
     * @param {string|null} [options.lrStandDownId] - Combatant who just cancelled a
     *   Lightning Reflexes elevation on their own (unacted) turn: they re-enter the
     *   segment at their natural DEX instead of being excluded as the ending combatant
     * @override
     */
    async nextTurn({ lrStandDownId = null } = {}) {
        const allCombatants = this.combatants.contents;
        const activeSegment = this.segment;
        const currentAbsNow = this.round * 12 + activeSegment;

        // Within-segment selection runs on LIVE priorities rather than the cached turns
        // array, so a positional hold declared mid-segment re-enters the order at its
        // declared DEX without waiting for a re-sort. The ending combatant's acting
        // position is their natural Phase unless they just acted at their held slot.
        const ending = this.combatant ?? null;
        const endingHold = ending?.heldAction;
        const endingAtHeldSlot =
            endingHold?.mode === "position" &&
            endingHold.segmentAbs === currentAbsNow &&
            ending.getFlag(game.system.id, "heldSlotTakenAbs") === currentAbsNow;
        // The threshold is the position the ending combatant ACTED at, recorded when
        // their turn began — live priorities move mid-segment (Aid/Drain) and would
        // re-admit combatants who already acted or skip ones who have not
        const storedActingPriority = this.getFlag(game.system.id, "actingPriority");
        const endingPriority =
            storedActingPriority ??
            (ending ? this.getInitiativePriority(ending, activeSegment, { ignoreHold: !endingAtHeldSlot }) : Infinity);

        const stillToAct = allCombatants.filter((c) => {
            if (!this._takesTurnInSegment(c, activeSegment)) return false;
            const cHold = c.heldAction;
            const cHeldHere = cHold?.mode === "position" && cHold.segmentAbs === currentAbsNow;
            // A held slot only comes up once
            if (cHeldHere && c.getFlag(game.system.id, "heldSlotTakenAbs") === currentAbsNow) return false;
            // The ending combatant re-enters the segment only via an unused held slot
            // or by standing down from an unacted Lightning Reflexes elevation
            if (c.id === ending?.id && !cHeldHere && c.id !== lrStandDownId) return false;
            const priority = this.getInitiativePriority(c, activeSegment);
            if (priority < endingPriority) return true;
            return priority === endingPriority && !!ending && c.id !== ending.id && c.id.localeCompare(ending.id) > 0;
        });

        if (stillToAct.length > 0) {
            stillToAct.sort((a, b) => this._comparePriority(a, b, this, activeSegment));
            const target = stillToAct[0];

            // A mid-segment hold changes live priorities, and any embedded combatant write
            // re-sorts the turns array — so the turn index must address the RE-SORTED
            // order. Only changed initiatives persist: unchanged writes are wasted
            // round-trips, and any single combatant write re-sorts every client.
            let inlineCombatantUpdates = this.combatants
                .map((c) => ({
                    _id: c.id,
                    initiative: this.getInitiativePriority(c, activeSegment),
                }))
                .filter((u) => this.combatants.get(u._id)?.initiative !== u.initiative);

            // Landing on a positional holder's declared slot marks it taken in the
            // same update, so ending that turn consumes the hold race-free
            const targetHold = target.heldAction;
            if (targetHold?.mode === "position" && targetHold.segmentAbs === currentAbsNow) {
                const targetUpdate = inlineCombatantUpdates.find((u) => u._id === target.id);
                if (targetUpdate) targetUpdate[`flags.${game.system.id}.heldSlotTakenAbs`] = currentAbsNow;
                else
                    inlineCombatantUpdates.push({
                        _id: target.id,
                        [`flags.${game.system.id}.heldSlotTakenAbs`]: currentAbsNow,
                    });
            }

            // Players may only write combatants they own; the GM-side _onUpdate
            // backfills any slot-taken marker dropped here
            if (!game.user.isGM) {
                inlineCombatantUpdates = inlineCombatantUpdates.filter((u) => this.combatants.get(u._id)?.isOwner);
            }

            let predictedTurns = [...allCombatants].sort((a, b) => this._sortCombatants(a, b, this));
            if (HeroCompatibility.isV14) {
                predictedTurns = predictedTurns.filter((t) => t.occupiesSegment?.(activeSegment) ?? false);
            }
            const targetIndex = predictedTurns.findIndex((t) => t.id === target.id);

            if (targetIndex !== -1) {
                if (!HeroCompatibility.isV14) this._turns = null;
                const result = await HeroCompatibility.updateEmbedded(
                    this,
                    "combatants",
                    inlineCombatantUpdates,
                    {
                        turn: targetIndex,
                        [`flags.${game.system.id}.actingPriority`]: this.getInitiativePriority(target, activeSegment),
                    },
                    { direction: 1, previousCombatantId: ending?.id },
                );
                if (!HeroCompatibility.isV14) {
                    this._turns = null;
                    this.setupTurns();
                }
                return result;
            }
        }

        let nextSegment = activeSegment;
        let nextRoundCycle = this.round;
        let segmentDeltaCount = 0;
        const updateData = {};
        let segmentActorsFound = false;

        // An abort spends the combatant's next Phase: the scan passes over that Phase's
        // segment, after which they count as able to act again (the status itself is
        // cleared by _clearExpiredAborts once those segments have elapsed). Aborted
        // combatants with a Phase in the segment now ending have already spent it.
        const abortSpentIds = new Set(
            allCombatants
                .filter((c) => {
                    if (!(c.actor?.statuses.has("aborted") ?? false)) return false;
                    // Declared aborts record the exact Phase they consume; bare statuses
                    // fall back to matching the ending segment
                    const spentAbs = c.abortSpentAbs;
                    if (spentAbs !== null) return spentAbs <= currentAbsNow;
                    return c.hasPhaseInSegment(activeSegment);
                })
                .map((c) => c.id),
        );

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

            const foundActors = allCombatants.filter((c) => {
                if ((c.actor?.statuses.has("aborted") ?? false) && !abortSpentIds.has(c.id)) {
                    const spentAbs = c.abortSpentAbs;
                    const scanAbs = nextRoundCycle * 12 + nextSegment;
                    const spendsHere = spentAbs !== null ? spentAbs <= scanAbs : c.hasPhaseInSegment(nextSegment);
                    if (spendsHere) abortSpentIds.add(c.id);
                    return false;
                }
                return this._takesTurnInSegment(c, nextSegment, { ignoreAbort: true });
            });
            if (foundActors.length > 0) {
                segmentActorsFound = true;
                break;
            }
        }

        if (!segmentActorsFound) return this;

        const masterRollsCache = this.getFlag(game.system.id, "segmentRolls") ?? {};
        let updatedRollsCache = masterRollsCache[nextSegment];

        if (!updatedRollsCache) {
            updatedRollsCache = this._buildSegmentRollMap();
            masterRollsCache[nextSegment] = updatedRollsCache;
        }
        updateData[`flags.${game.system.id}.segmentRolls`] = masterRollsCache;

        let targetCombatantId = null;
        const upcomingActors = allCombatants.filter((c) =>
            this._takesTurnInSegment(c, nextSegment, { ignoreAbort: abortSpentIds.has(c.id) }),
        );

        if (upcomingActors.length > 0) {
            upcomingActors.sort((a, b) => {
                return this._comparePriority(a, b, this, nextSegment);
            });
            targetCombatantId = upcomingActors[0]?.id || null;
        }

        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, nextSegment),
            });
        });

        // Landing on a positional holder's declared slot marks it taken in the same update
        const incomingHold = this.combatants.get(targetCombatantId)?.heldAction;
        if (incomingHold?.mode === "position" && incomingHold.segmentAbs === nextRoundCycle * 12 + nextSegment) {
            const targetUpdate = combatantUpdates.find((u) => u._id === targetCombatantId);
            if (targetUpdate) targetUpdate[`flags.${game.system.id}.heldSlotTakenAbs`] = incomingHold.segmentAbs;
        }

        // Persist only changed initiatives, and for players only owned combatants;
        // the GM-side _onUpdate backfills any dropped slot-taken marker
        let persistedCombatantUpdates = combatantUpdates.filter(
            (u) => this.combatants.get(u._id)?.initiative !== u.initiative || Object.keys(u).length > 2,
        );
        if (!game.user.isGM) {
            persistedCombatantUpdates = persistedCombatantUpdates.filter((u) => this.combatants.get(u._id)?.isOwner);
        }

        const initiativeById = new Map(combatantUpdates.map((u) => [u._id, u]));
        const recompiledTurns = this.combatants.map((c) => {
            const match = initiativeById.get(c.id);
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
            const aE = a.occupiesSegment?.(nextSegment) ?? false;
            const bE = b.occupiesSegment?.(nextSegment) ?? false;
            if (aE !== bE) return aE ? -1 : 1;
            return this._comparePriority(a, b, this, nextSegment);
        });

        const finalTargetTurnsArray = HeroCompatibility.isV14
            ? recompiledTurns.filter((t) => t.occupiesSegment?.(nextSegment) ?? false)
            : recompiledTurns;

        const absoluteTargetTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);

        updateData.round = nextRoundCycle;
        updateData.turn = absoluteTargetTurnIndex !== -1 ? absoluteTargetTurnIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = nextSegment;
        const incomingCombatant = this.combatants.get(targetCombatantId);
        updateData[`flags.${game.system.id}.actingPriority`] = incomingCombatant
            ? this.getInitiativePriority(incomingCombatant, nextSegment)
            : null;

        const updateOptions = {
            direction: 1,
            previousCombatantId: this.combatant?.id,
            previousSegment: activeSegment,
            segmentsElapsed: segmentDeltaCount,
        };
        if (segmentDeltaCount > 0) {
            updateOptions.worldTime = { delta: segmentDeltaCount };
        }

        if (!HeroCompatibility.isV14) {
            this._turns = null;
        }

        const result = await HeroCompatibility.updateEmbedded(
            this,
            "combatants",
            persistedCombatantUpdates,
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
            : turns.filter((t) => this._takesTurnInSegment(t, activeSegment));

        const currentFilteredIndex = currentActiveTurns.findIndex((t) => t.id === this.combatant?.id);

        if (currentFilteredIndex > 0) {
            const targetCombatant = currentActiveTurns[currentFilteredIndex - 1];
            const masterTargetIndex = turns.findIndex((t) => t.id === targetCombatant.id);

            if (!HeroCompatibility.isV14) {
                this._turns = null;
            }

            const inlineUpdateData = {
                turn: masterTargetIndex !== -1 ? masterTargetIndex : 0,
                [`flags.${game.system.id}.actingPriority`]: this.getInitiativePriority(targetCombatant, activeSegment),
            };
            const rewindResets = this._rewindHoldFlagResets(this.round * 12 + activeSegment);

            const result = await HeroCompatibility.updateEmbedded(this, "combatants", rewindResets, inlineUpdateData);

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

            const foundActors = allCombatants.filter((c) => this._takesTurnInSegment(c, prevSegment));
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
        for (const reset of this._rewindHoldFlagResets(prevRoundCycle * 12 + prevSegment)) {
            const existing = combatantUpdates.find((u) => u._id === reset._id);
            if (existing) Object.assign(existing, reset);
            else combatantUpdates.push(reset);
        }

        const initiativeById = new Map(combatantUpdates.map((u) => [u._id, u]));
        const recompiledTurns = this.combatants.map((c) => {
            const match = initiativeById.get(c.id);
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
            const aE = a.occupiesSegment?.(prevSegment) ?? false;
            const bE = b.occupiesSegment?.(prevSegment) ?? false;
            if (aE !== bE) return aE ? -1 : 1;
            return this._comparePriority(a, b, this, prevSegment);
        });

        const finalTargetTurnsArray = HeroCompatibility.isV14
            ? recompiledTurns.filter((t) => t.occupiesSegment?.(prevSegment) ?? false)
            : recompiledTurns;

        let targetCombatantId = null;
        const targetActors = allCombatants.filter((c) => this._takesTurnInSegment(c, prevSegment));

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
        const rewindTarget = this.combatants.get(targetCombatantId);
        updateData[`flags.${game.system.id}.actingPriority`] = rewindTarget
            ? this.getInitiativePriority(rewindTarget, prevSegment)
            : null;

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
        updateData[`flags.${game.system.id}.actingPriority`] = null;

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
        updateData[`flags.${game.system.id}.actingPriority`] = null;

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
     * Posts a combat-flow chat card, whispered to the GM for hidden combatants so
     * their names and tactical state don't leak to players.
     * @param {Combatant} combatant
     * @param {string} content
     * @private
     */
    _combatCard(combatant, content) {
        const data = { speaker: ChatMessage.getSpeaker({ actor: combatant.actor }), content };
        if (combatant.hidden) data.whisper = ChatMessage.getWhisperRecipients("GM");
        return ChatMessage.create(data);
    }

    /**
     * Combatant flag resets for a rewind: slot-taken markers and spent-hold display
     * records at or after the target position must not survive, or replayed held
     * slots are skipped as already used.
     * @param {number} targetAbs
     * @returns {object[]} Combatant update payloads keyed by _id
     * @private
     */
    _rewindHoldFlagResets(targetAbs) {
        const resets = [];
        for (const combatant of this.combatants) {
            const update = {};
            if ((combatant.getFlag(game.system.id, "heldSlotTakenAbs") ?? -1) >= targetAbs) {
                update[`flags.${game.system.id}.heldSlotTakenAbs`] = null;
            }
            if ((combatant.spentHoldPosition?.segmentAbs ?? -1) >= targetAbs) {
                update[`flags.${game.system.id}.spentHoldPosition`] = null;
            }
            if ((combatant.lrElevatedAbs ?? -1) >= targetAbs) {
                update[`flags.${game.system.id}.lrElevatedAbs`] = null;
            }
            if (Object.keys(update).length > 0) resets.push({ _id: combatant.id, ...update });
        }
        return resets;
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
                [`flags.${game.system.id}.heldSlotTakenAbs`]: null,
                [`flags.${game.system.id}.spentHoldPosition`]: null,
                [`flags.${game.system.id}.lrElevatedAbs`]: null,
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
            "actingPriority",
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

        // Knocked out characters still take Post-Segment 12 Recoveries (that is how they
        // wake up); isDefeated here is core's (defeated toggle or dead), not isOutOfCombat
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

        const prevId = foundry.utils.getProperty(options, "previousCombatantId");

        // Segment-boundary maintenance. turnAdvance marks a full-Turn skip (nextRound), where
        // every SPD 1-12 has had a Phase; roundChanged covers the segment-12-to-segment-12
        // wrap, where the currentSegment flag value is unchanged.
        const turnAdvance = foundry.utils.getProperty(options, "turnAdvance") === true;
        const newSegment = foundry.utils.getProperty(changed, `${systemFlagKey}.currentSegment`);
        if (newSegment !== undefined || roundChanged || turnAdvance) {
            // Segments that just ended, oldest first; empty segments count because an
            // aborted combatant's spent Phase may fall in a segment nobody acted in
            const previousSegment = turnAdvance ? null : foundry.utils.getProperty(options, "previousSegment");
            let elapsedSegments;
            if (turnAdvance) {
                elapsedSegments = null; // A full Turn elapsed: every SPD 1-12 had a Phase
            } else if (previousSegment !== undefined && previousSegment !== null) {
                const segmentsElapsed = foundry.utils.getProperty(options, "segmentsElapsed") ?? 1;
                if (segmentsElapsed >= 12) elapsedSegments = null;
                else
                    elapsedSegments = Array.fromRange(segmentsElapsed).map((i) => ((previousSegment - 1 + i) % 12) + 1);
            }
            (async () => {
                // SPD-change lockouts first so the hold/abort checks see updated phase
                // eligibility; passed-hold cleanup before the natural-turn clear so
                // spent positional holds are never re-carded
                await this._maintainSpdChanges();
                await this._clearSpentHoldPositions();
                await this._clearPassedPositionalHolds();
                if (turnAdvance) await this._consumeExpiredHeldActions(null);
                await this._clearExpiredAborts(elapsedSegments);
                await this._consumeActiveCombatantHold(prevId);
            })().catch((e) => console.error(e));
        } else {
            // Turn-only advance within a segment: the natural-turn clear still applies
            this._consumeActiveCombatantHold(prevId).catch((e) => console.error(e));
        }

        const previousCombatant = prevId ? this.combatants.get(prevId) : null;
        if (previousCombatant?.actor) {
            this._expireCustomSystemEffects(previousCombatant.actor);

            // A positional hold is spent the moment its held turn ends within the same
            // segment — used if the pointer actually took the slot, forfeit if it was
            // passed over; cross-segment endings go through _clearPassedPositionalHolds.
            // A hold declared THIS segment hasn't had its slot yet (the ending turn was
            // the declarer's natural Phase), so declaredAbs === currentAbs is exempt
            // unless the slot was taken.
            const hold = previousCombatant.heldAction;
            if (hold?.mode === "position") {
                const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
                if (hold.segmentAbs === currentAbs) {
                    const slotTaken = previousCombatant.getFlag(game.system.id, "heldSlotTakenAbs") === currentAbs;
                    if (slotTaken) {
                        this._spendHold(previousCombatant, { used: true }).catch((e) => console.error(e));
                    } else if (hold.declaredAbs !== currentAbs) {
                        this._spendHold(previousCombatant).catch((e) => console.error(e));
                    }
                }
            }
        }

        // Backfill the slot-taken marker when the update that landed here couldn't
        // write it (player-initiated advances only persist combatants the player owns)
        const activeCombatant = this.combatant;
        const activeHold = activeCombatant?.heldAction;
        if (activeHold?.mode === "position") {
            const nowAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
            if (
                activeHold.segmentAbs === nowAbs &&
                activeCombatant.getFlag(game.system.id, "heldSlotTakenAbs") !== nowAbs
            ) {
                activeCombatant.setFlag(game.system.id, "heldSlotTakenAbs", nowAbs).catch((e) => console.error(e));
            }
        }

        // The incoming combatant's Phase begins: maneuver effects that last "until your
        // next Phase" (Dodge, Block, Brace…) expire now. Effects created at the current
        // world time survive — they were declared this instant. Because aborted Phases
        // are skipped outright, an abort's modifiers naturally persist to the Phase
        // after the spent one (6E2 22).
        if (activeCombatant?.actor) {
            expireManeuverNextPhaseEffects(activeCombatant.actor).catch((e) => console.error(e));
        }
    }

    /**
     * Clears an event/generic hold when the holder's natural turn comes around: the
     * arriving Phase replaces the banked one. Guarded against self-advance — when the
     * turn arrived directly from the holder's own ending turn (declaring a hold ends
     * the turn, and in sparse combats the next stop can be the holder's own next
     * Phase), the hold survives to the next full cycle. Positional holds are exempt;
     * they expire with their slot.
     * @param {string|undefined} previousCombatantId
     * @private
     */
    async _consumeActiveCombatantHold(previousCombatantId) {
        if (!this.started) return;
        const combatant = this.combatant;
        const actor = combatant?.actor;
        if (!actor?.statuses.has("holding")) return;
        if (combatant.id === previousCombatantId) return;
        if (!combatant.hasPhaseInSegment(this.segment)) return;
        // Positional holds expire with their slot, never at a natural Phase
        if (combatant.heldAction?.mode === "position") return;

        const holdingEffect = actor.effects.find((e) => e.statuses.has("holding"));
        if (!holdingEffect) return;
        await holdingEffect.delete();

        await this._combatCard(
            combatant,
            `${actor.name}'s Held Action was replaced by their natural Phase in Segment ${this.segment}.`,
        );
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
                        await this._combatCard(
                            combatant,
                            `${combatant.actor.name}'s SPD changed from ${knownSpd} to ${spd}. They cannot act until both SPDs would have had a Phase (Segment ${((lockoutEndAbs - 1) % 12) + 1}).`,
                        );
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
     * Clears positional Held Actions whose declared segment has been left behind:
     * the held turn came and went without the holder acting, so the hold is spent.
     * Within-segment passes are caught by the previous-combatant check in _onUpdate;
     * event/generic holds are unaffected (they expire at the null zone instead).
     * @private
     */
    async _clearPassedPositionalHolds() {
        if (!this.started) return;
        const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
        for (const combatant of this.combatants) {
            const hold = combatant.heldAction;
            if (hold?.mode !== "position" || hold.segmentAbs >= currentAbs) continue;
            const used = combatant.getFlag(game.system.id, "heldSlotTakenAbs") === hold.segmentAbs;
            // The segment moved on, so there is no acted position left to display
            await this._spendHold(combatant, { used, retainPosition: false });
        }
    }

    /**
     * Drops display-position records once their segment has passed.
     * @private
     */
    async _clearSpentHoldPositions() {
        if (!this.started) return;
        const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
        for (const combatant of this.combatants) {
            const spent = combatant.spentHoldPosition;
            if (spent && spent.segmentAbs < currentAbs) {
                await combatant.unsetFlag(game.system.id, "spentHoldPosition");
            }
            // Lightning Reflexes elevation is likewise a single-segment record
            const lrAbs = combatant.lrElevatedAbs;
            if (lrAbs !== null && lrAbs < currentAbs) {
                await combatant.unsetFlag(game.system.id, "lrElevatedAbs");
            }
        }
    }

    /**
     * Consumes a positional hold at the end of its held turn: the effect (and status
     * icon) go away immediately, while a display-only combatant flag keeps the acted
     * position in the tracker until the segment ends.
     * @param {Combatant} combatant
     * @param {object} [options]
     * @param {boolean} [options.used] - The holder actually acted at their held slot
     * @param {boolean} [options.retainPosition] - Keep the acted position for display
     * @private
     */
    async _spendHold(combatant, { used = false, retainPosition = true } = {}) {
        const actor = combatant.actor;
        const effect = actor?.effects.find((e) => e.statuses.has("holding"));
        const hold = combatant.heldAction;
        if (!effect || !hold) return;
        await effect.delete();
        if (retainPosition && hold.mode === "position") {
            await combatant.setFlag(game.system.id, "spentHoldPosition", {
                segmentAbs: hold.segmentAbs,
                dex: hold.dex,
            });
        }
        await this._combatCard(
            combatant,
            used
                ? `${actor.name} used their Held Action.`
                : `${actor.name}'s held turn passed without being used; the Held Action is spent.`,
        );
    }

    /**
     * Removes the held-action status from every combatant whose natural speed-chart
     * Phase falls in the segment that just began; their Phase replaces the hold.
     * Only invoked for full-Turn skips (segment === null); per-turn clearing lives in
     * _consumeActiveCombatantHold. The segment parameter is kept for the strict-RAW
     * null zone should it return as a setting.
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

            await this._combatCard(
                combatant,
                `${actor.name}'s Held Action was consumed by their natural Phase${segment !== null ? ` in Segment ${segment}` : ""}.`,
            );
        }
    }

    /**
     * Clears the aborted status from combatants whose spent Phase has now passed.
     * Aborting uses the character's next full Phase; once the Segment containing that
     * Phase ends they may act again on their following Phase (6E2 22; 5ER 361).
     * @param {number[]|null|undefined} elapsedSegments - Segments that just ended, oldest
     *   first; null when a full Turn elapsed, undefined when unknown (skip)
     * @private
     */
    async _clearExpiredAborts(elapsedSegments) {
        if (elapsedSegments === undefined) return;

        const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            if (!actor?.statuses.has("aborted")) continue;
            const spentAbs = combatant.abortSpentAbs;
            if (spentAbs !== null) {
                // The spent Phase's segment must have fully passed
                if (currentAbs <= spentAbs) continue;
            } else if (elapsedSegments !== null && !elapsedSegments.some((s) => combatant.hasPhaseInSegment(s))) {
                continue;
            }

            const abortedEffect = actor.effects.find((e) => e.statuses.has("aborted"));
            if (!abortedEffect) continue;

            await abortedEffect.delete();

            await this._combatCard(
                combatant,
                `${actor.name}'s aborted Phase has passed; they may act again on their next Phase.`,
            );
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
