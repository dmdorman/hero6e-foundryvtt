export class HeroCombatant extends Combatant {
    /**
     * Determine if this combatant has a phase in a specific segment.
     * Hero System 6e standard speed chart mapping.
     * @param {number} segment (1-12)
     * @returns {boolean}
     */
    hasPhaseInSegment(segment) {
        const spd = this.actor?.system?.characteristics?.spd?.value || 2; // Default to 2

        // Standard Hero System 6e Phase Table
        const phaseTable = {
            1: [12],
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

        const activeSegments = phaseTable[Math.clamp(spd, 1, 12)] || [6, 12];
        return activeSegments.includes(segment);
    }
}
