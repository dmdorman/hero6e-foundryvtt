const { CombatTracker } = foundry.applications.sidebar.tabs;

export class HeroCombatTracker extends CombatTracker {
    // STATIC INITIALIZATION BLOCK (Executes once when class is loaded into memory)
    static {
        Hooks.on("renderHeroCombatTracker", (app, html) => {
            if (!app.viewed?.started) return;

            const encounterTitle = html.querySelector(".combat-tracker-header .encounter-title");
            if (encounterTitle) {
                encounterTitle.textContent = `Turn=${app.viewed.round}  Segment=${app.viewed.segment}.${app.viewed.turn}`;
            } else {
                console.warn(`Unable to locate encounterTitle`);
            }
        });
    }

    /**
     * Dynamically build the layout mapping using the running world's system id.
     * @override
     */
    static get __PARTS() {
        // Safely pull the system's folder name dynamically
        const systemId = game.system.id;

        return {
            ...super.PARTS, // Keep standard core header and footer structures intact
            tracker: {
                template: `systems/${systemId}/templates/combat/combat-tracker-2.hbs`,
            },
        };
    }

    /**
     * V14 specific helper method targeting only the combatant list dataset.
     * @param {object} context The parent ApplicationV2 context being assembled
     * @param {object} options Application rendering options
     * @returns {Promise<object>} The layout sub-context containing .turns
     * @override
     */
    /** @override */
    async _prepareTrackerContext(context, options) {
        // Let Foundry assemble the core combatant turns layout data
        await super._prepareTrackerContext(context, options);

        if (!this.viewed) return;

        // Modify the core array values directly before rendering
        if (context.turns) {
            context.turns.forEach((t) => {
                const combatant = this.viewed.combatants.get(t.id);
                const hasPhase = combatant ? combatant.hasPhaseInSegment(this.viewed.segment) : false;

                // If they don't act this segment, append your custom CSS rule to their active styles string
                if (!hasPhase) {
                    t.css = t.css ? `${t.css} inactive-segment` : "inactive-segment";
                }
            });
        }
    }
}
