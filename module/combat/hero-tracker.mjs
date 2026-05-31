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
        // 1. Let Foundry assemble the core combatant turns layout dataset natively
        await super._prepareTrackerContext(context, options);
        if (!this.viewed) return;

        const currentSegment = this.viewed.segment;
        const masterTurns = context.turns || [];

        // 2. Build a fresh timeline array map
        const timelineTurns = [];

        // ─── PART A: PROCESS CURRENT SEGMENT ───
        const currentActors = masterTurns.filter((t) => {
            const combatant = this.viewed.combatants.get(t.id);
            const isHolding = combatant?.actor?.statuses.has("holding") ?? false;
            const hasPhase = combatant ? combatant.hasPhaseInSegment(currentSegment) : false;
            return hasPhase || isHolding;
        });

        currentActors.forEach((t) => {
            const combatant = this.viewed.combatants.get(t.id);
            if (combatant?.actor?.statuses.has("holding")) {
                t.css = t.css ? `${t.css} is-holding-action` : "is-holding-action";
                t.name = `⏳ [HELD] ${t.name}`;
            }
        });

        timelineTurns.push(...currentActors);

        // ─── PART B: CALCULATE FUTURE SEGMENTS ROADMAP ───
        let lookupSegment = currentSegment;
        let lookaheadStepsCount = 0;

        for (let check = 1; check <= 12; check++) {
            lookupSegment++;
            if (lookupSegment > 12) lookupSegment = 1;

            const futureActors = masterTurns.filter((t) => {
                const combatant = this.viewed.combatants.get(t.id);
                return combatant ? combatant.hasPhaseInSegment(lookupSegment) : false;
            });

            if (futureActors.length > 0) {
                lookaheadStepsCount++;

                const fakeId = `seg-header-${lookupSegment}`;

                timelineTurns.push({
                    id: fakeId,
                    name: `Segment ${lookupSegment}`,
                    img: "icons/svg/clockwork.svg",
                    css: "hero-timeline-header-row",
                    hasRolled: true,
                    initiative: futureActors.length,
                    isFakeHeader: true,
                });

                futureActors.forEach((t) => {
                    // Clone the turn object reference so modifying its layout tags does not mutate the master cache
                    const clone = { ...t };

                    // ─── FIX: REMOVE OR SUPPRESS THE NATIVE "active" CLASS FROM FUTURE PREVIEWS ───
                    if (clone.css) {
                        // Replace word boundary occurrences of "active" with an empty string, cleaning up excess whitespace
                        clone.css = clone.css.replace(/\bactive\b/g, "").trim();
                        clone.css = clone.css ? `${clone.css} future-segment-preview` : "future-segment-preview";
                    } else {
                        clone.css = "future-segment-preview";
                    }

                    timelineTurns.push(clone);
                });
            }

            if (lookaheadStepsCount >= 2) break;
        }

        // 4. SWAP TRACKER STREAM CONTEXT DIRECTLY OVER TO THE NEW TIMELINE BUNDLE
        context.turns = timelineTurns;
    }
}
