const { CombatTracker } = foundry.applications.sidebar.tabs;

// Last combatant auto-scrolled to, so re-renders don't yank the list back while the user browses
let lastScrolledCombatantId = null;

export class HeroSystem6eCombatTrackerSingle extends CombatTracker {
    static {
        /**
         * Updates the header and handles real-time active row highlighting fixes.
         * Enforces complete null guards to accommodate unlinked V14 Quench test models.
         */
        const onRenderTracker = (app, html) => {
            // Exit out immediately if combat hasn't formally begun, if the instance is missing,
            // or if core tracking parameters haven't finished compiling yet.
            if (!app?.viewed || !app.viewed.started) return;

            const element = html instanceof HTMLElement ? html : html;
            if (!element) return;

            // Update header titles using standard Hero System nomenclature variables
            const encounterTitle = element.querySelector(".combat-tracker-header .encounter-title");
            if (encounterTitle) {
                encounterTitle.textContent = `Turn=${app.viewed.round} Segment=${app.viewed.segment}.${app.viewed.turn}`;
            }

            // Strip any false active highlights that the core template engine miscalculated
            element.querySelectorAll(".combatant.active").forEach((el) => {
                el.classList.remove("active");
            });

            // Safely check the true active combatant ID string straight from the source database.
            // The active combatant row only carries the highlight inside the current segment group.
            const activeId = app.viewed.combatant?.id;
            if (activeId) {
                const activeRow = element.querySelector(
                    `.current-segment-member[data-combatant-id="${activeId}"], .current-segment-member[data-id="${activeId}"]`,
                );
                if (activeRow) {
                    activeRow.classList.add("active");
                    if (lastScrolledCombatantId !== activeId) {
                        lastScrolledCombatantId = activeId;
                        activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
                    }
                }
            }
        };

        Hooks.on("renderCombatTracker", onRenderTracker);
    }

    /**
     * Per-combat user overrides for segment expansion, cached from localStorage.
     * Keyed by combat id, each value maps segment number (1-12) to an explicit
     * expanded/collapsed choice. Absent segments use the automatic window default.
     * @type {Record<string, Record<number, boolean>>}
     */
    #segmentExpansion = {};

    _segmentExpansionStorageKey(combatId) {
        return `${game.system.id}.segmentExpansion.${combatId}`;
    }

    _getSegmentExpansion(combatId) {
        if (!this.#segmentExpansion[combatId]) {
            let stored = {};
            try {
                stored = JSON.parse(localStorage.getItem(this._segmentExpansionStorageKey(combatId)) ?? "{}");
            } catch (e) {
                console.warn(`Unable to parse stored segment expansion state`, e);
            }
            this.#segmentExpansion[combatId] = stored;
        }
        return this.#segmentExpansion[combatId];
    }

    _setSegmentExpansion(combatId, segment, expanded) {
        const overrides = this._getSegmentExpansion(combatId);
        overrides[segment] = expanded;
        try {
            localStorage.setItem(this._segmentExpansionStorageKey(combatId), JSON.stringify(overrides));
        } catch (e) {
            console.warn(`Unable to persist segment expansion state`, e);
        }
    }

    /**
     * Overrides the modern ApplicationV2 rendering lifecycle handler.
     * ✅ FIX: Enforces deep object sanitation on options to stop the 'turn in undefined' core crash.
     * @override
     * @protected
     */
    async _onRender(context, options) {
        let safeContext = context || {};
        let safeOptions = options;

        // Direct fix for 'Cannot use in operator to search for turn in undefined' inside programmatic tests
        if (!safeOptions || typeof safeOptions !== "object" || Array.isArray(safeOptions)) {
            safeOptions = {};
        }
        if (!safeOptions.renderContext || typeof safeOptions.renderContext !== "object") {
            safeOptions.renderContext = {};
        }

        // Inoculate mandatory core property objects scanned by the core engine with the 'in' operator
        const mandatoryKeys = ["turn", "round", "activity", "history", "combatant"];
        mandatoryKeys.forEach((key) => {
            if (!safeOptions.renderContext[key] || typeof safeOptions.renderContext[key] !== "object") {
                safeOptions.renderContext[key] = { update: [] };
            }
        });

        // Pass the safely fortified parameter dictionaries down to the native parent framework
        await super._onRender(safeContext, safeOptions);
    }

    /**
     * Rebuilds the tracker as a chronological segment timeline:
     * - every non-empty segment of the current Turn, in order, including passed ones
     * - plus the previous 2 and next 2 non-empty segments, even across Turn boundaries
     * - the current segment is always expanded; the prev/next window expands by default;
     *   everything else renders as a collapsed header until the user expands it, and
     *   manual expand/collapse choices persist per client
     * @override
     */
    async _prepareTrackerContext(context, options) {
        // 1. Let Foundry assemble the core combatant turns layout dataset natively
        await super._prepareTrackerContext(context, options);
        const combat = this.viewed;
        if (!combat?.started) return context;

        const masterTurns = context.turns || [];
        const masterById = new Map(masterTurns.map((t) => [t.id, t]));
        const activeCombatantId = combat.combatant?.id || null;

        // Absolute segment indices are monotonic across Turns; combat begins at Turn 1, Segment 12
        const currentAbs = combat.round * 12 + combat.segment;
        const startAbs = 1 * 12 + 12;
        const segmentOf = (abs) => ((abs - 1) % 12) + 1;
        const roundOf = (abs) => Math.floor((abs - 1) / 12);

        const membersAt = (abs) => {
            const segment = segmentOf(abs);
            const isPast = abs < currentAbs;
            return combat.combatants.filter((c) => {
                if (!c.actor) return false;
                // Core filters hidden combatants out of player-facing turns; match it here
                if (c.hidden && !game.user.isGM) return false;
                if (c.hasPhaseInSegment(segment)) return true;
                // Holders may act in the current segment or any future one
                return !isPast && c.actor.statuses.has("holding");
            });
        };

        // Candidate positions: every non-empty segment of the current Turn, clamped to combat start
        const positions = new Set([currentAbs]);
        for (let segment = 1; segment <= 12; segment++) {
            const abs = combat.round * 12 + segment;
            if (abs >= startAbs && membersAt(abs).length > 0) positions.add(abs);
        }

        // Include the previous 2 and next 2 non-empty segments, across Turn boundaries,
        // but only auto-expand the nearest one in each direction.
        const windowAbs = new Set();
        let found = 0;
        for (let abs = currentAbs - 1; abs >= startAbs && found < 2; abs--) {
            if (membersAt(abs).length > 0) {
                if (found === 0) windowAbs.add(abs);
                positions.add(abs);
                found++;
            }
        }
        found = 0;
        for (let abs = currentAbs + 1; abs <= currentAbs + 24 && found < 2; abs++) {
            if (membersAt(abs).length > 0) {
                if (found === 0) windowAbs.add(abs);
                positions.add(abs);
                found++;
            }
        }

        const expansionOverrides = this._getSegmentExpansion(combat.id);
        const timelineTurns = [];

        for (const abs of [...positions].sort((a, b) => a - b)) {
            const segment = segmentOf(abs);
            const round = roundOf(abs);
            const isCurrent = abs === currentAbs;
            const isPast = abs < currentAbs;
            const expanded = isCurrent || (expansionOverrides[segment] ?? windowAbs.has(abs));

            // _comparePriority breaks priority ties by combatant id, keeping the order stable
            const members = membersAt(abs).sort((a, b) => combat._comparePriority(a, b, combat, segment));

            const roundLabel = round === combat.round ? "" : ` (Turn ${round})`;
            const stateLabel = isCurrent ? " — Current" : isPast ? " — Passed" : "";
            const countLabel = expanded ? "" : ` (${members.length})`;
            const caret = expanded ? "▼" : "▶";

            const headerId = `seg-header-${round}-${segment}`;
            const headerTurn = {
                id: headerId,
                _id: headerId,
                name: `${caret} Segment ${segment}${roundLabel}${stateLabel}${countLabel}`,
                img: "icons/svg/clockwork.svg",
                css: [
                    "hero-timeline-header-row",
                    isCurrent ? "active-segment-header-slot" : "collapsible-segment-header-slot",
                    isPast ? "past-segment-header-slot" : "",
                    expanded ? "segment-expanded" : "segment-collapsed",
                ]
                    .filter(Boolean)
                    .join(" "),
                hasRolled: true, // Header is marked true, but its HTML container is display: none
                initiative: members.length,
                isFakeHeader: true,
                active: false,
            };
            Object.defineProperty(headerTurn, "token", { get: () => null, configurable: true, enumerable: true });
            Object.defineProperty(headerTurn, "actor", { get: () => null, configurable: true, enumerable: true });
            timelineTurns.push(headerTurn);

            if (!expanded) continue;

            // Tokens of the same root actor tied on the same priority act back to back;
            // collapse them into a single row with a count. The row represents the active
            // member when the group contains it so click/hover target the acting token.
            const groups = [];
            for (const combatant of members) {
                const key = combatant.actorId || combatant.id;
                const priority = combat.getInitiativePriority(combatant, segment);
                const prev = groups.at(-1);
                if (prev && prev.key === key && prev.priority === priority) prev.combatants.push(combatant);
                else groups.push({ key, priority, combatants: [combatant] });
            }

            for (const group of groups) {
                const combatant = group.combatants.find((c) => c.id === activeCombatantId) ?? group.combatants[0];
                const base = masterById.get(combatant.id);
                const row = base
                    ? { ...base }
                    : {
                          id: combatant.id,
                          _id: combatant.id,
                          name: combatant.name,
                          img: combatant.img ?? combatant.actor?.img ?? "icons/svg/mystery-man.svg",
                          hidden: combatant.hidden,
                          defeated: combatant.isDefeated,
                          css: "",
                      };

                // Pull the calculated priority score from the source-of-truth document method so
                // Handlebars draws the number instead of the d20 roll button
                row.initiative = group.priority.toFixed(2);
                row.hasRolled = true;
                if (group.combatants.length > 1) row.name = `${row.name} ×${group.combatants.length}`;
                row.active = false;
                row.css = (row.css || "").replace(/\bactive\b/g, "").trim();

                if (!isPast && combatant.actor?.statuses.has("holding")) {
                    row.css = `${row.css} is-holding-action`.trim();
                    row.name = `⏳ [HELD] ${row.name}`;
                }

                if (isPast) {
                    row.css = `${row.css} past-segment-preview`.trim();
                } else if (!isCurrent) {
                    row.css = `${row.css} future-segment-preview`.trim();
                } else {
                    row.css = `${row.css} current-segment-member`.trim();
                    if (combatant.id === activeCombatantId) {
                        row.active = true;
                        row.css = `${row.css} active`.trim();
                    }
                }

                timelineTurns.push(row);
            }
        }

        context.turns = timelineTurns;
        return context;
    }

    /**
     * Resolves the combatant row element for a delegated tracker event.
     * Core V13 handlers are delegated from the tracker root, so event.currentTarget
     * is not the row; walk up from the event target instead.
     * @param {Event} event
     * @param {HTMLElement} [target] - Explicit target element provided by core action dispatch
     * @returns {HTMLElement|null}
     * @private
     */
    _combatantRowFromEvent(event, target) {
        if (target?.dataset?.combatantId) return target;
        return event.target?.closest?.(".combatant[data-combatant-id]") ?? null;
    }

    /** @override */
    _onCombatantHoverIn(event) {
        const row = this._combatantRowFromEvent(event);
        // GUARD: Short-circuit fake layout rows and missing document references
        if (!row || !this.viewed?.combatants?.has(row.dataset.combatantId)) return;
        return super._onCombatantHoverIn(event);
    }

    /** @override */
    _onCombatantHoverOut(event) {
        const row = this._combatantRowFromEvent(event);
        if (!row || !this.viewed?.combatants?.has(row.dataset.combatantId)) return;
        return super._onCombatantHoverOut(event);
    }

    /** @override */
    _onCombatantMouseDown(event, target) {
        const row = this._combatantRowFromEvent(event, target);
        const combatantId = row?.dataset?.combatantId;
        if (!combatantId) return;

        // Segment headers toggle their expansion; the current segment is always expanded
        if (combatantId.startsWith("seg-header-")) {
            if (!this.viewed || row.classList.contains("active-segment-header-slot")) return;
            const segment = parseInt(combatantId.split("-").pop());
            if (Number.isNaN(segment)) return;
            this._setSegmentExpansion(this.viewed.id, segment, row.classList.contains("segment-collapsed"));
            this.render();
            return;
        }

        // GUARD: Prevent clicking, panning, or pinging rows without a real combatant
        if (!this.viewed?.combatants?.has(combatantId)) return;
        return super._onCombatantMouseDown(event, row);
    }
}
