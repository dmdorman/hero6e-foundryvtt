export class HeroCombatTracker extends CombatTracker {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/herosystem6e/templates/combat-tracker.html",
        });
    }

    /** @override */
    async getData(options = {}) {
        const data = await super.getData(options);
        if (!this.viewed) return data;

        // Relabel terms for the HTML headers
        data.turns.forEach((t) => {
            const combatant = this.viewed.combatants.get(t.id);
            // Flag if they are skipped this segment so your CSS can dim or hide them
            t.hasPhase = combatant ? combatant.hasPhaseInSegment(this.viewed.segment) : false;
        });

        return data;
    }
}
