import { HEROSYS } from "./herosystem6e.mjs";

const scrollIntoViewOptions = { block: "center" };

export class HeroSystem6eCombatTracker extends CombatTracker {
    static get defaultOptions() {
        var path = `systems/${HEROSYS.module}/templates/combat/combat-tracker.hbs`;
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: path,
            //scrollY: [], // Do not save ['.directory-list'] scrollY positions, were just going to override them.
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".segment-hasItems").click((ev) => this._onSegmentToggleContent(ev));
    }

    async _onCombatControl(event) {
        const target = event.target;
        if (["fas fa-step-backward", "fas fa-step-forward"].includes(target.className) && !event.shiftKey) {
            return await ui.notifications.warn(`Changing turns is unusual. Hold SHIFT to change turn.`);
        }

        await super._onCombatControl(event);
    }

    _onSegmentToggleContent(event) {
        event.preventDefault();

        const header = event.currentTarget;
        const segment = header.closest(".segment-container");
        const content = segment.querySelector(".segment-content");
        content.style.display = content.style.display === "none" ? "block" : "none";
    }

    async getData(options) {
        const context = await super.getData(options);

        context.alphaTesting = game.settings.get(game.system.id, "alphaTesting");

        // Initialize segments
        context.segments = [];
        for (let s = 1; s <= 12; s++) {
            context.segments[s] = [];
        }

        // Looks like super.getData returns a minimal combatant, need to add flags.
        // Handle segments while were at it (as it is stored in flags.segment)
        let activeSegment = 12;
        for (let t = 0; t < context.turns.length; t++) {
            const turn = context.turns[t];
            turn.flags = context.combat.combatants.find((c) => c.id === turn.id)?.flags;

            // Add combatant to proper segment
            if (turn.flags?.segment) {
                context.segments[turn.flags.segment].push(turn);
            } else {
                //context.segments[12].push(turn);
                //console.error("Unknown segment");
            }

            // Active Segment
            if (turn.active) {
                activeSegment = turn.flags.segment;
            }

            // Alpha testing debugging
            if (context.alphaTesting) {
                turn.name += ` [${t}]`;
            }
        }
        context.segments[activeSegment].active = true;

        // for (const combatant of context.combat.turns) {
        //     if (!combatant.visible) continue;

        //     // Shouldn't be needed but #736 seems to suggest otherwise
        //     if (!context.turns[t]) {
        //         console.error("context.turns[t] is ", context.turns[t]);
        //         continue;
        //     }

        //     // Sanity check that shouldn't be necessary
        //     if (context.turns[t].name != combatant.name) {
        //         console.error(`${context.turns[t].name} != ${combatant.name}`);
        //         continue;
        //     }

        //     //context.turns[t].flags = combatant.flags;
        //     const s = parseInt(context.turns[t].flags.segment) || 12;
        //     context.segments[s].push(context.turns[t]);
        //     t++;
        // }

        // if (context.combat) {
        //     // Active Segment is expanded, all others are collapsed
        //     context.activeSegments = [];
        //     for (let i = 1; i <= 12; i++) {
        //         const active =
        //             i === context.combat.combatant?.flags?.segment ||
        //             (!context.combat.combatant && i === 12);

        //         context.activeSegments[i] = active;
        //         if (active) {
        //             context.combat.segment = i;
        //         }
        //     }
        // }

        return context;
    }

    /**
     * Scroll the combat log container to ensure the current Combatant turn is centered vertically
     */
    scrollToTurn() {
        //console.log("scrollToTurn", this.viewed?.turn);
        const combat = this.viewed;
        if (!combat || combat.turn === null) return;
        let active = this.element.find(".combatant.active")[0];
        if (!active) return;

        // scrollIntoViewIfNeeded is better but non-standard.
        active.scrollIntoView(scrollIntoViewOptions);

        // Store scroll positions (nott working with browser reload)
        // const element = this.element;
        // if (element.length && this.options.scrollY)
        //     this._saveScrollPositions(element);
    }

    async _render(...args) {
        //console.log("_render");

        await super._render(args);
        await ui.combat.scrollToTurn();
    }
}
