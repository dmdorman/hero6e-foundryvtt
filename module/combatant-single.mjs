export class HeroSystem6eCombatantSingle extends Combatant {
    /**
     * Speed Chart (6E1 17; 5ER 20). SPD 0 or below has no Phases
     * (Post-Segment 12 Recovery only).
     * @type {Record<number, number[]>}
     */
    static speedChart = {
        1: [7],
        2: [6, 12],
        3: [4, 8, 12],
        4: [3, 6, 9, 12],
        5: [3, 5, 8, 10, 12],
        6: [2, 4, 6, 8, 10, 12],
        7: [2, 4, 6, 7, 9, 11, 12],
        8: [2, 3, 5, 6, 8, 9, 11, 12],
        9: [2, 3, 4, 6, 7, 8, 10, 11, 12],
        10: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
        11: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    };

    /**
     * Monotonic segment counter across rounds, for comparing combat positions.
     * @param {number} round
     * @param {number} segment - 1-12
     * @returns {number}
     */
    static absoluteSegment(round, segment) {
        return round * 12 + segment;
    }

    /**
     * Segment number (1-12) of an absolute segment.
     * @param {number} abs
     * @returns {number}
     */
    static segmentOf(abs) {
        return ((abs - 1) % 12) + 1;
    }

    /**
     * Turn (round) number of an absolute segment.
     * @param {number} abs
     * @returns {number}
     */
    static roundOf(abs) {
        return Math.floor((abs - 1) / 12);
    }

    /**
     * The first absolute segment at or after fromAbs in which the given SPD has a Phase.
     * @param {number} spd
     * @param {number} fromAbs
     * @returns {number}
     */
    static nextPhaseAbs(spd, fromAbs) {
        const systemSpeedChart = CONFIG.HERO?.speedChart || HeroSystem6eCombatantSingle.speedChart;
        const phases = systemSpeedChart[Math.min(12, Math.max(1, spd))] || [];
        for (let abs = fromAbs; abs < fromAbs + 12; abs++) {
            if (phases.includes(((abs - 1) % 12) + 1)) return abs;
        }
        return fromAbs;
    }

    /**
     * Details of this combatant's Held Action (6E2 20-21; 5ER 360-361), or null when
     * not holding. Declared via the tracker's Hold Action dialog, which stores the
     * declaration on the holding effect; a bare holding status (e.g. token HUD toggle)
     * counts as a generic hold.
     * @type {{mode: "position"|"event"|"generic", segmentAbs?: number, dex?: number, trigger?: string}|null}
     */
    get heldAction() {
        const effect = this.actor?.effects.find((e) => e.statuses.has("holding"));
        if (!effect) return null;
        return effect.getFlag(game.system.id, "hold") ?? { mode: "generic" };
    }

    /**
     * True when a positional Held Action places this combatant in the given absolute segment.
     * @param {number} abs
     * @returns {boolean}
     */
    holdsPositionAtAbs(abs) {
        const hold = this.heldAction;
        return hold?.mode === "position" && hold.segmentAbs === abs;
    }

    /**
     * Segment-number variant for turn-flow checks. Unambiguous despite the modulo because
     * the hold window is always shorter than a full Turn (null zone, 6E2 21).
     * @param {number} segmentNumber - 1-12
     * @returns {boolean}
     */
    holdsPositionInSegment(segmentNumber) {
        const hold = this.heldAction;
        return hold?.mode === "position" && HeroSystem6eCombatantSingle.segmentOf(hold.segmentAbs) === segmentNumber;
    }

    /**
     * Display-only record of a spent positional hold: the combatant keeps sorting at
     * the DEX they acted at for the rest of that segment, without the holding effect.
     * Written on consumption, cleaned up at segment boundaries.
     * @type {{segmentAbs: number, dex: number}|null}
     */
    get spentHoldPosition() {
        if (!game.system?.id) return null;
        return this.getFlag(game.system.id, "spentHoldPosition") ?? null;
    }

    /**
     * @param {number} abs
     * @returns {boolean}
     */
    spentHoldAtAbs(abs) {
        return this.spentHoldPosition?.segmentAbs === abs;
    }

    /**
     * @param {number} segmentNumber - 1-12
     * @returns {boolean}
     */
    spentHoldInSegment(segmentNumber) {
        const spent = this.spentHoldPosition;
        return !!spent && HeroSystem6eCombatantSingle.segmentOf(spent.segmentAbs) === segmentNumber;
    }

    /**
     * The absolute segment of the Phase this combatant's abort consumes, recorded at
     * declaration (6E2 22: aborting uses the NEXT full Phase). Null for aborts applied
     * without the tracker (bare status toggles), which fall back to segment matching.
     * @type {number|null}
     */
    get abortSpentAbs() {
        const effect = this.actor?.effects.find((e) => e.statuses.has("aborted"));
        return effect?.getFlag(game.system.id, "abort")?.spentAbs ?? null;
    }

    /**
     * Whether this combatant occupies an initiative position in the segment: a spent
     * hold's acted position, a positional hold's declared slot, or a natural Phase.
     * A positional hold commits the banked Phase to its slot, so natural Phases don't
     * count while one is pending.
     * @param {number} segmentNumber - 1-12
     * @returns {boolean}
     */
    occupiesSegment(segmentNumber) {
        if (this.spentHoldInSegment(segmentNumber)) return true;
        const hold = this.heldAction;
        if (hold?.mode === "position") return this.holdsPositionInSegment(segmentNumber);
        return this.hasPhaseInSegment(segmentNumber);
    }

    /**
     * Out of the fight for turn-skipping purposes: the tracker's defeated toggle, dead,
     * or knocked out. Deliberately NOT an isDefeated override — core computes the skull
     * toggle's next state from isDefeated, so broadening that getter inverts the toggle
     * for KO'd combatants (skull becomes inert / strips dead from group members).
     * @type {boolean}
     */
    get isOutOfCombat() {
        return this.isDefeated || !!this.actor?.statuses.has("dead") || !!this.actor?.statuses.has("knockedOut");
    }

    /**
     * Effective Speed for phase purposes: 0 when drained below 1, otherwise clamped
     * to the 1-12 speed chart range since characters cannot act more than once per segment.
     * Traverses cross-generation document data layers to find the true Speed score.
     * @type {number}
     */
    get combatSpd() {
        if (!this.actor) return 0;

        const rawSource =
            this.actor._source?.system ||
            this.actor.system?._source ||
            this.actor.data?._source?.system ||
            this.actor.data?.system ||
            {};
        const spdObj =
            this.actor.system?.characteristics?.spd ||
            this.actor.data?.system?.characteristics?.spd ||
            rawSource.characteristics?.spd ||
            rawSource.data?.characteristics?.spd;

        const rawSpd = spdObj?.value ?? spdObj?.total ?? spdObj?.base ?? spdObj?.current ?? 2;

        if (rawSpd <= 0) return 0;
        return Math.min(12, rawSpd);
    }

    /**
     * Evaluates if this participant possesses an active action phase
     * in the specified speed chart calendar segment index.
     * @param {number} segmentIndex - Speed Chart segment column to examine (1-12)
     * @returns {boolean} True if the combatant is capable of taking a turn
     */
    hasPhaseInSegment(segmentIndex) {
        const spd = this.combatSpd;
        if (spd <= 0) return false;

        const systemSpeedChart = CONFIG.HERO?.speedChart || HeroSystem6eCombatantSingle.speedChart;
        const activePhases = systemSpeedChart[spd] || [];
        if (!activePhases.includes(segmentIndex)) return false;

        // A character whose SPD changed mid-Turn cannot act until both the old and the
        // new SPD would have had a Phase (6E2 17; 5ER 357). The lockout flag is written
        // and cleared by the combat's segment-boundary maintenance.
        const lockout = game.system?.id ? this.getFlag(game.system.id, "spdLockout") : null;
        const combat = this.combat;
        if (lockout?.lockoutEndAbs && combat?.started) {
            const currentAbs = HeroSystem6eCombatantSingle.absoluteSegment(combat.round, combat.segment);
            const currentSegment = ((currentAbs - 1) % 12) + 1;
            // First occurrence of the queried segment at or after the current combat position
            const queryAbs = currentAbs + ((segmentIndex - currentSegment + 12) % 12);
            if (queryAbs < lockout.lockoutEndAbs) return false;
        }

        return true;
    }
}
