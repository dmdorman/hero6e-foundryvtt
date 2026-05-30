export class HeroCombat extends Combat {
    /**
     * Define the current Segment (remapping 'turn' to 1-12 range)
     */
    get segment() {
        return this.turn || 12; // In Hero, segment 12 is usually the starting/post-segment processing
    }

    /**
     * Override sorting. Sort combatants acting in the current segment by DEX, then INT, then roll.
     * @override
     */
    _sortCombatants(a, b) {
        const currentSegment = this.segment;
        const aActs = a.hasPhaseInSegment(currentSegment);
        const bActs = b.hasPhaseInSegment(currentSegment);

        // If one acts and the other doesn't, push the acting one to the top
        if (aActs !== bActs) return aActs ? -1 : 1;

        // Tie-breaker 1: Base DEX
        const dexA = a.actor?.system?.characteristics?.dex?.value || 0;
        const dexB = b.actor?.system?.characteristics?.dex?.value || 0;
        if (dexA !== dexB) return dexB - dexA;

        // Tie-breaker 2: Core Initiative Roll (if rolled)
        return (b.initiative || 0) - (a.initiative || 0);
    }

    /**
     * Advance to the next mechanical state in the Hero System.
     * @override
     */
    async nextTurn() {
        let currentSegment = this.segment;
        let nextSegment = currentSegment + 1;
        let nextTurnCycle = this.round;

        if (nextSegment > 12) {
            nextSegment = 1;
            nextTurnCycle += 1;
            // Note: You can trigger your Post-Segment 12 recovery logic here!
        }

        // Advance the database. We keep Foundry's 'turn' tracker matching our segment index.
        return this.update({
            round: nextTurnCycle,
            turn: nextSegment,
        });
    }

    /**
     * Reverse to the previous segment.
     * @override
     */
    async previousTurn() {
        let currentSegment = this.segment;
        let prevSegment = currentSegment - 1;
        let prevTurnCycle = this.round;

        if (prevSegment < 1) {
            prevSegment = 12;
            prevTurnCycle = Math.max(1, prevTurnCycle - 1);
        }

        return this.update({
            round: prevTurnCycle,
            turn: prevSegment,
        });
    }
}
