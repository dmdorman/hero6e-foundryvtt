// src/module/combat/hero-tracker.mjs
const { CombatTracker } = foundry.applications.sidebar.tabs;

export class HeroCombatTracker extends CombatTracker {
    static {
        Hooks.on("renderHeroCombatTracker", (app, html) => {
            // 1. Exit early if combat hasn't started yet
            if (!app.viewed?.started) return;

            const currentSegment = app.viewed.segment;
            const currentRound = app.viewed.round;
            const turns = app.viewed.turns || [];

            // 2. Locate the core encounterTitle container and use Hero terms
            const encounterTitle = html.querySelector(".combat-tracker-header .encounter-title");
            if (encounterTitle) {
                encounterTitle.textContent = `Turn=${app.viewed.round}  Segment=${app.viewed.segment}.${app.viewed.turn}`;
            } else {
                console.warn(`Unable to locate encounterTitle`);
            }

            // 3. GENERATE THE FUTURE SEGMENT ROADMAP WITH ACTOR COUNTS
            // Remove any previously injected system segment bars to avoid duplication on re-renders
            html.querySelector(".hero-segment-timeline")?.remove();

            // Calculate the active count for the CURRENT segment
            const currentActiveCount = turns.filter((t) => {
                const combatant = app.viewed.combatants.get(t.id);
                return combatant ? combatant.hasPhaseInSegment(currentSegment) : false;
            }).length;

            // Calculate the upcoming 3 segments sequentially wrapping around the 12-segment calendar
            const futureSegments = [];
            let checkSegment = currentSegment;
            let checkRound = currentRound;

            for (let i = 1; i <= 3; i++) {
                checkSegment++;
                if (checkSegment > 12) {
                    checkSegment = 1;
                    checkRound++;
                }

                // Count how many combatants act in this specific look-ahead segment
                const activeInFutureSegmentCount = turns.filter((t) => {
                    const combatant = app.viewed.combatants.get(t.id);
                    return combatant ? combatant.hasPhaseInSegment(checkSegment) : false;
                }).length;

                futureSegments.push({
                    seg: checkSegment,
                    rnd: checkRound,
                    count: activeInFutureSegmentCount,
                });
            }

            // 4. CONSTRUCT THE HTML CONTAINER LAYOUT
            const timelineBar = document.createElement("div");
            timelineBar.classList.add("hero-segment-timeline", "flexrow");
            timelineBar.style.cssText = `
        padding: 6px 8px;
        background: rgba(0, 0, 0, 0.4);
        border-bottom: 1px solid var(--color-border-dark);
        font-size: var(--font-size-11);
        text-align: center;
        gap: 4px;
        align-items: center;
      `;

            // Build the active segment node incorporating its active actor count badge
            let timelineHTML = `
        <span class="seg-node active" style="background: var(--color-shadow-primary); padding: 2px 6px; border-radius: 3px; font-weight: bold; border: 1px solid var(--color-border-highlight); display: flex; align-items: center; gap: 4px;">
          Seg ${currentSegment} 
          <span style="background: rgba(255,255,255,0.15); padding: 0px 4px; border-radius: 8px; font-size: 9px;">${currentActiveCount}</span>
        </span>
        <i class="fas fa-angle-right" style="color: rgba(255,255,255,0.3)"></i>
      `;

            futureSegments.forEach((item, idx) => {
                // Soften the color opacity if a future segment has 0 actors acting in it
                const noActors = item.count === 0;
                const opacityStyle = noActors ? "opacity: 0.35;" : "opacity: 0.75;";
                const badgeColor = noActors ? "rgba(255,255,255,0.1)" : "var(--color-shadow-primary)";

                timelineHTML += `
          <span class="seg-node future" style="${opacityStyle} padding: 2px 4px; display: flex; align-items: center; gap: 4px;">
            Seg ${item.seg}${item.seg === 1 ? `<small style="font-size:9px; color:var(--color-text-hyperlink)"> (T${item.rnd})</small>` : ""}
            <span style="background: ${badgeColor}; padding: 0px 4px; border-radius: 8px; font-size: 9px; font-weight: bold;">${item.count}</span>
          </span>
        `;
                if (idx < futureSegments.length - 1) {
                    timelineHTML += `<i class="fas fa-angle-right" style="color: rgba(255,255,255,0.2)"></i>`;
                }
            });

            timelineBar.innerHTML = timelineHTML;

            // 5. INJECT ELEMENT INTO SIDEBAR CONTAINER
            const headerControls = html.querySelector(".combat-tracker-header");
            if (headerControls) {
                headerControls.after(timelineBar);
            }
        });
    }

    /** @override */
    async _prepareTrackerContext(context, options) {
        await super._prepareTrackerContext(context, options);
        if (!this.viewed) return;

        if (context.turns) {
            context.turns.forEach((t) => {
                const combatant = this.viewed.combatants.get(t.id);

                // Check BOTH conditions: Do they act naturally OR are they actively holding an action?
                const isHolding = combatant?.actor?.statuses.has("holding") ?? false;
                const hasPhase = combatant ? combatant.hasPhaseInSegment(this.viewed.segment) : false;

                const isActingThisSegment = hasPhase || isHolding;

                // Apply the gray-out styling ONLY if they truly have nothing to do this segment
                if (!isActingThisSegment) {
                    t.css = t.css ? `${t.css} inactive-segment` : "inactive-segment";
                }

                // Add a specialized class if they are holding an action
                if (isHolding) {
                    t.css = t.css ? `${t.css} is-holding-action` : "is-holding-action";

                    // INJECT A VISUAL ANCHOR INDICATOR ICON
                    // Append a small clock icon directly to their name string inside the sidebar data template
                    t.name = `⏳ [HELD] ${t.name}`;
                }
            });
        }
    }
}
