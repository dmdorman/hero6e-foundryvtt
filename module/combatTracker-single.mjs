import { HeroSystem6eCombatantSingle } from "./combatant-single.mjs";
import { HeroCompatibility } from "./utility/compatibility.mjs";

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
            // Exclude the exploded-group summary row, which reuses the active member's id
            const activeId = app.viewed.combatant?.id;
            if (activeId) {
                const activeRow = element.querySelector(
                    `.current-segment-member:not(.hero-group-parent)[data-combatant-id="${activeId}"], .current-segment-member:not(.hero-group-parent)[data-id="${activeId}"]`,
                );
                if (activeRow) {
                    activeRow.classList.add("active");
                    if (lastScrolledCombatantId !== activeId) {
                        lastScrolledCombatantId = activeId;
                        activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
                    }
                }
            }

            // Gather panel member rows into a pinned container beneath the header; the
            // container caps at 20vh and scrolls when more holders than that pile up
            const panelHeaderRow = element.querySelector(".combatant.hero-held-panel-header");
            const panelMemberRows = element.querySelectorAll("li.combatant.hero-held-panel-member");
            if (panelHeaderRow && panelMemberRows.length > 0 && !element.querySelector(".hero-held-scroll-wrapper")) {
                const wrapper = document.createElement("li");
                wrapper.className = "hero-held-scroll-wrapper";
                const list = document.createElement("ol");
                list.className = "hero-held-scroll plain";
                wrapper.appendChild(list);
                panelHeaderRow.after(wrapper);
                panelMemberRows.forEach((li) => list.appendChild(li));
            }

            // Compact hold controls: panel rows show "⚡ <condition>" (the use control for
            // owners, a passive label otherwise); positional timeline rows get a plain ⚡
            element.querySelectorAll("li.combatant.hero-held-row").forEach((li) => {
                const combatant = app.viewed.combatants.get(li.dataset.combatantId);
                if (!combatant?.actor?.statuses.has("holding")) return;
                const controls = li.querySelector(".combatant-controls");
                if (!controls || controls.querySelector(".hero-use-held, .hero-held-condition")) return;

                const isPanelRow = li.classList.contains("hero-held-panel-member");
                const hold = combatant.heldAction;
                const conditionLabel = (hold?.mode === "event" && hold.trigger) || "Held Action";

                if (!combatant.isOwner) {
                    if (isPanelRow) {
                        const label = document.createElement("span");
                        label.className = "hero-held-condition";
                        const icon = document.createElement("i");
                        icon.className = "fa-solid fa-hourglass-half";
                        label.append(icon, ` ${conditionLabel}`);
                        controls.prepend(label);
                    }
                    return;
                }

                const button = document.createElement("button");
                button.type = "button";
                button.setAttribute("aria-label", "Use Held Action");
                button.dataset.tooltip = "Use Held Action";
                button.addEventListener("click", (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    app._onUseHeldAction(li.dataset.combatantId);
                });
                if (isPanelRow) {
                    button.className = "inline-control combatant-control hero-use-held hero-use-held-compact";
                    const icon = document.createElement("i");
                    icon.className = "fa-solid fa-bolt";
                    const label = document.createElement("span");
                    label.textContent = conditionLabel;
                    button.append(icon, label);
                } else {
                    button.className = "inline-control combatant-control icon fa-solid fa-bolt hero-use-held";
                }
                controls.prepend(button);
            });

            // Lightning Reflexes: owners of scoped-LR combatants get an act-early
            // toggle on their current-segment row while the position is reachable
            element.querySelectorAll("li.combatant.current-segment-member:not(.hero-group-parent)").forEach((li) => {
                const combatant = app.viewed.combatants.get(li.dataset.combatantId);
                const state = app._lrElevationState?.(combatant);
                if (!state) return;
                const controls = li.querySelector(".combatant-controls");
                if (!controls || controls.querySelector(".hero-lr-elevate")) return;

                const button = document.createElement("button");
                button.type = "button";
                const label =
                    state === "elevated" ? "Cancel Act Early (Lightning Reflexes)" : "Act Early (Lightning Reflexes)";
                button.setAttribute("aria-label", label);
                button.dataset.tooltip = label;
                button.className = `inline-control combatant-control icon fa-solid fa-bolt-lightning hero-lr-elevate${
                    state === "elevated" ? " hero-lr-elevated" : ""
                }`;
                button.addEventListener("click", (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    app._onToggleLrElevation(li.dataset.combatantId);
                });
                controls.prepend(button);
            });
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

    /**
     * Root actor ids of groups the user manually exploded, per combat id.
     * The group containing the active combatant is always exploded.
     * @type {Record<string, Set<string>>}
     */
    #explodedGroups = {};

    _getExplodedGroups(combatId) {
        return (this.#explodedGroups[combatId] ??= new Set());
    }

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
                // A positional Held Action occupies exactly its declared slot, and a spent
                // hold keeps displaying at the acted position until the segment ends;
                // event/generic holds render in the Held Actions panel instead
                return !isPast && (c.holdsPositionAtAbs(abs) || c.spentHoldAtAbs(abs));
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

        // The single tracker follows only Foundry's own disposition setting; the legacy
        // combatTrackerDispositionHighlighting system setting applies to the old tracker
        let dispositionTint = false;
        try {
            dispositionTint = !!game.settings.get("core", Combat.CONFIG_SETTING)?.turnMarker?.disposition;
        } catch (e) {
            console.warn(`Unable to read combat tracker disposition setting`, e);
        }

        const expansionOverrides = this._getSegmentExpansion(combat.id);
        const timelineTurns = [];

        // Event/generic holders occupy no initiative slot; they wait in a panel above the
        // timeline until activated (⚡), released, or expired by their natural Phase
        const panelHolders = combat.combatants
            .filter((c) => {
                if (!c.actor) return false;
                if (c.hidden && !game.user.isGM) return false;
                const hold = c.heldAction;
                return !!hold && hold.mode !== "position";
            })
            .sort(
                (a, b) =>
                    (b.actor.system?.characteristics?.dex?.value ?? 0) -
                        (a.actor.system?.characteristics?.dex?.value ?? 0) || a.id.localeCompare(b.id),
            );

        const panelExpanded = expansionOverrides["held"] ?? true;
        if (panelHolders.length > 0) {
            const panelHeader = {
                id: "held-panel-header",
                _id: "held-panel-header",
                name: `${panelExpanded ? "▼" : "▶"} ⏳ Held Actions (${panelHolders.length})`,
                img: "icons/svg/clockwork.svg",
                css: [
                    "hero-timeline-header-row",
                    "collapsible-segment-header-slot",
                    "hero-held-panel-header",
                    panelExpanded ? "segment-expanded" : "segment-collapsed",
                ].join(" "),
                hasRolled: true,
                initiative: panelHolders.length,
                isFakeHeader: true,
                active: false,
            };
            Object.defineProperty(panelHeader, "token", { get: () => null, configurable: true, enumerable: true });
            Object.defineProperty(panelHeader, "actor", { get: () => null, configurable: true, enumerable: true });
            timelineTurns.push(panelHeader);

            if (panelExpanded) {
                for (const combatant of panelHolders) {
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
                    row.initiative = null;
                    row.hasRolled = true;
                    row.active = false;
                    row.effects = { icons: [], tooltip: "" };
                    row.css = `${(row.css || "").replace(/\bactive\b/g, "").trim()} hero-held-row hero-held-panel-member`;
                    if (dispositionTint) row.css = `${row.css} ${this._dispositionClass(combatant)}`.trim();
                    timelineTurns.push(row);
                }
            }
        }

        for (const abs of [...positions].sort((a, b) => a - b)) {
            const segment = segmentOf(abs);
            const round = roundOf(abs);
            const isCurrent = abs === currentAbs;
            const isPast = abs < currentAbs;
            const isNextTurn = round > combat.round;
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
                    isNextTurn ? "next-turn-header-slot" : "",
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
                // Multi-member groups explode into their individual members beneath the ×N
                // header row, indented so the hierarchy is clear. The group holding the
                // active combatant is always exploded; others explode on demand.
                const isGroup = group.combatants.length > 1;
                const isActiveGroup = isGroup && isCurrent && group.combatants.some((c) => c.id === activeCombatantId);
                const exploded = isActiveGroup || (isGroup && this._getExplodedGroups(combat.id).has(group.key));
                const representative = group.combatants.find((c) => c.id === activeCombatantId) ?? group.combatants[0];
                const stateCss = isPast
                    ? "past-segment-preview"
                    : !isCurrent
                      ? `future-segment-preview${isNextTurn ? " next-turn-preview" : ""}`
                      : "current-segment-member";

                const buildRow = (combatant) => {
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
                    if (dispositionTint) row.css = `${row.css || ""} ${this._dispositionClass(combatant)}`.trim();
                    row.active = false;
                    row.css = (row.css || "").replace(/\bactive\b/g, "").trim();
                    return row;
                };

                if (exploded) {
                    // Summary header above the members; it carries the representative's id
                    // (never the active highlight) so hover still targets a real token.
                    // Clicking it collapses the group unless the group is the active one.
                    const parentRow = buildRow(representative);
                    parentRow.name = `▼ ${parentRow.name} ×${group.combatants.length}`;
                    parentRow.effects = { icons: [], tooltip: "" };
                    parentRow.css = [
                        parentRow.css,
                        stateCss,
                        "hero-group-row hero-group-parent",
                        isActiveGroup ? "hero-group-locked" : "",
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                    timelineTurns.push(parentRow);
                }

                for (const combatant of exploded ? group.combatants : [representative]) {
                    const row = buildRow(combatant);
                    if (exploded) {
                        row.css = `${row.css} hero-group-exploded`.trim();
                    } else if (isGroup) {
                        // Collapsed group header: clicking explodes it into its members
                        row.name = `▶ ${row.name} ×${group.combatants.length}`;
                        row.effects = { icons: [], tooltip: "" };
                        row.css = `${row.css} hero-group-row hero-group-collapsed`.trim();
                    }

                    // Positional holds render at their declared slot with the held marker;
                    // spent holds keep the row at the acted position; the holder's
                    // natural-Phase rows stay unmarked
                    if (!isPast && combatant.holdsPositionAtAbs(abs)) {
                        row.css = `${row.css} is-holding-action hero-held-row`.trim();
                        row.name = `⏳ ${row.name} (held)`;
                    } else if (!isPast && combatant.spentHoldAtAbs(abs)) {
                        row.css = `${row.css} is-holding-action`.trim();
                        row.name = `${row.name} (acted)`;
                    } else if (
                        !isPast &&
                        (combatant.abortSpentAbs === abs ||
                            (combatant.abortSpentAbs === null && combatant.abortAppliesAtAbs?.(abs)))
                    ) {
                        // The Phase an abort consumed stays visible but greyed, so the
                        // table can see where the cost lands (6E2 22). Unrecorded aborts
                        // (bare status toggles) grey every Phase while the status binds.
                        row.css = `${row.css} hero-aborted-row`.trim();
                        row.name = `${row.name} (aborted)`;
                    }

                    // An elevated scoped-LR combatant acts early this segment only
                    if (combatant.lrElevatedAbs === abs) {
                        row.css = `${row.css} hero-lr-row`.trim();
                        row.name = `↯ ${row.name} (LR)`;
                    }

                    row.css = `${row.css} ${stateCss}`.trim();
                    if (isCurrent && combatant.id === activeCombatantId) {
                        row.active = true;
                        row.css = `${row.css} active`.trim();
                    }

                    timelineTurns.push(row);
                }
            }
        }

        context.turns = timelineTurns;
        return context;
    }

    /**
     * Row tint class for the combatant's token disposition.
     * @param {Combatant} combatant
     * @returns {string}
     * @protected
     */
    _dispositionClass(combatant) {
        const token = combatant.token;
        switch (token?.disposition) {
            case CONST.TOKEN_DISPOSITIONS.FRIENDLY:
                return token.hasPlayerOwner
                    ? "combat-tracker-hero-disposition-player"
                    : "combat-tracker-hero-disposition-friendly";
            case CONST.TOKEN_DISPOSITIONS.NEUTRAL:
                return "combat-tracker-hero-disposition-neutral";
            case CONST.TOKEN_DISPOSITIONS.HOSTILE:
                return "combat-tracker-hero-disposition-hostile";
            case CONST.TOKEN_DISPOSITIONS.SECRET:
                return "combat-tracker-hero-disposition-secret";
            default:
                return "";
        }
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

        // The Held Actions panel header toggles its expansion
        if (combatantId === "held-panel-header") {
            if (!this.viewed) return;
            this._setSegmentExpansion(this.viewed.id, "held", row.classList.contains("segment-collapsed"));
            this.render();
            return;
        }

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

        // Group headers toggle their explosion; the active group cannot be collapsed
        if (row.classList.contains("hero-group-row")) {
            if (row.classList.contains("hero-group-locked")) return;
            const key = this.viewed.combatants.get(combatantId)?.actorId || combatantId;
            const explodedGroups = this._getExplodedGroups(this.viewed.id);
            if (row.classList.contains("hero-group-collapsed")) explodedGroups.add(key);
            else explodedGroups.delete(key);
            this.render();
            return;
        }

        return super._onCombatantMouseDown(event, row);
    }

    /**
     * All combatants sharing the clicked group row's root actor.
     * @param {string} combatantId
     * @returns {Combatant[]}
     * @private
     */
    _groupMembers(combatantId) {
        const representative = this.viewed?.combatants.get(combatantId);
        if (!representative) return [];
        const key = representative.actorId || representative.id;
        return this.viewed.combatants.filter((c) => (c.actorId || c.id) === key);
    }

    /**
     * Group header hide/defeated/ping buttons apply to every member of the group.
     * Pan stays single-target: there is only one camera.
     * @override
     */
    _onCombatantControl(event, target) {
        const row = target.closest("[data-combatant-id]");
        const action = target.dataset.action;
        if (!row?.classList.contains("hero-group-row")) return super._onCombatantControl(event, target);

        const members = this._groupMembers(row.dataset.combatantId);
        switch (action) {
            case "toggleHidden":
                return Promise.all(members.map((c) => this._onToggleHidden(c)));
            case "toggleDefeated": {
                // Mirrors core _onToggleDefeatedStatus for the whole group: every member
                // converges on the representative's next state. Linked tokens share one
                // actor document, so the status is set once per unique actor — concurrent
                // per-combatant toggles race and stack duplicate defeated/dead effects.
                const isDefeated = !this.viewed.combatants.get(row.dataset.combatantId)?.isDefeated;
                const flagUpdates = members.map((c) => ({ _id: c.id, defeated: isDefeated }));
                const uniqueActors = [
                    ...new Map(members.filter((c) => c.actor).map((c) => [c.actor.uuid, c.actor])).values(),
                ];
                return (async () => {
                    await this.viewed.updateEmbeddedDocuments("Combatant", flagUpdates);
                    const defeatedId = CONFIG.specialStatusEffects.DEFEATED;
                    for (const actor of uniqueActors) {
                        await actor.toggleStatusEffect(defeatedId, { overlay: true, active: isDefeated });
                    }
                })();
            }
            case "pingCombatant": {
                // Ping only visible members to avoid one core warning per hidden token;
                // fall back to the representative so an empty result still warns once
                const pingable = members.filter(
                    (c) => c.sceneId === canvas.scene?.id && c.token?.object && this._isTokenVisible(c.token.object),
                );
                if (pingable.length === 0) return super._onCombatantControl(event, target);
                return Promise.all(pingable.map((c) => this._onPingCombatant(c)));
            }
            default:
                return super._onCombatantControl(event, target);
        }
    }

    /**
     * Adds Hold/Abort entries to the row context menu and guards every entry against
     * the tracker's synthetic rows (segment headers, group summaries, the held panel).
     * @override
     */
    _getEntryContextOptions() {
        const options = super._getEntryContextOptions();
        const getCombatant = (li) => this.viewed?.combatants.get(li.dataset?.combatantId) ?? null;

        for (const option of options) {
            const visible = option.visible ?? option.condition;
            const guarded = (li) =>
                !!getCombatant(li) && (typeof visible === "function" ? visible.call(this, li) : (visible ?? true));
            // V14 reads visible/onClick/label; real V13 reads condition/callback/name
            option.visible = guarded;
            option.condition = guarded;
        }

        options.push(
            {
                label: "Hold Action…",
                icon: "fa-solid fa-hourglass-half",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    // Holds are declared on the character's own Phase (6E2 20); declaring
                    // out of turn would let the banked Phase land earlier than it should.
                    // The GM is exempt for NPC bookkeeping.
                    return (
                        !!combatant?.isOwner &&
                        !!this.viewed?.started &&
                        !combatant.actor?.statuses.has("holding") &&
                        (game.user.isGM || this.viewed?.combatant?.id === combatant.id)
                    );
                },
                onClick: (event, li) => this._onDeclareHoldAction(li.dataset.combatantId),
            },
            {
                label: "Use Held Action",
                icon: "fa-solid fa-bolt",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!combatant.actor?.statuses.has("holding");
                },
                onClick: (event, li) => this._onUseHeldAction(li.dataset.combatantId),
            },
            {
                label: "Release Hold",
                icon: "fa-solid fa-hand",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!combatant.actor?.statuses.has("holding");
                },
                onClick: (event, li) => this._onReleaseHeldAction(li.dataset.combatantId),
            },
            {
                label: "Act Early (Lightning Reflexes)",
                icon: "fa-solid fa-bolt-lightning",
                visible: (li) => this._lrElevationState(getCombatant(li)) === "available",
                onClick: (event, li) => this._onToggleLrElevation(li.dataset.combatantId),
            },
            {
                label: "Cancel Act Early (LR)",
                icon: "fa-solid fa-rotate-left",
                visible: (li) => this._lrElevationState(getCombatant(li)) === "elevated",
                onClick: (event, li) => this._onToggleLrElevation(li.dataset.combatantId),
            },
            {
                label: "Abort…",
                icon: "fa-solid fa-shield-halved",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!this.viewed?.started && !combatant.actor?.statuses.has("aborted");
                },
                onClick: (event, li) => this._onAbortAction(li.dataset.combatantId),
            },
            {
                label: "Cancel Abort",
                icon: "fa-solid fa-rotate-left",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!combatant.actor?.statuses.has("aborted");
                },
                onClick: (event, li) => this._onCancelAbort(li.dataset.combatantId),
            },
        );

        // Mirror the V14 entry fields onto the V13 names so both cores render them
        for (const option of options) {
            option.name ??= option.label;
            option.condition ??= option.visible;
            option.callback ??= (li) => option.onClick?.(null, li);
        }
        return options;
    }

    /**
     * Posts a hold-related chat card, whispered to the GM for hidden combatants.
     * @param {Combatant} combatant
     * @param {string} content
     * @private
     */
    _holdCard(combatant, content) {
        const data = { speaker: ChatMessage.getSpeaker({ actor: combatant.actor }), content };
        if (combatant.hidden) data.whisper = ChatMessage.getWhisperRecipients("GM");
        return ChatMessage.create(data);
    }

    /**
     * Opens the Hold Action declaration dialog (6E2 20-21; 5ER 360-361) and applies the
     * chosen hold: a position (segment + DEX, validated against the null zone by only
     * offering legal segments), an event trigger, or a generic hold.
     * @param {string} combatantId
     * @protected
     */
    async _onDeclareHoldAction(combatantId) {
        const combat = this.viewed;
        const combatant = combat?.combatants.get(combatantId);
        const actor = combatant?.actor;
        if (!combat?.started || !combatant?.isOwner || !actor) return;
        if (actor.statuses.has("holding")) return;
        const blocked = this._blockedActionReason(combatant);
        if (blocked) return void ui.notifications.warn(blocked);
        // Holds are declared on the character's own Phase (6E2 20); the GM may backfill
        if (!game.user.isGM && combat.combatant?.id !== combatant.id) {
            return void ui.notifications.warn(`Held Actions are declared on the character's own Phase.`);
        }

        const currentAbs = combat.round * 12 + combat.segment;
        const characteristicKey = actor.system?.initiativeCharacteristic ?? "dex";
        const ownDex = actor.system?.characteristics?.[characteristicKey]?.value ?? 10;
        // Only unrestricted All Actions LR raises the holding position — holding is
        // not the scoped action a restricted purchase was bought for
        const actingDex = ownDex + (combatant.lightningReflexes?.always ?? 0);

        // Legal window: from now up to (not including) the segment of the next natural
        // Phase — a Held Action is lost the moment that segment begins (null zone)
        const spd = combatant.combatSpd;
        const nextNaturalAbs = spd > 0 ? HeroSystem6eCombatantSingle.nextPhaseAbs(spd, currentAbs + 1) : currentAbs;
        const segmentChoices = [];
        for (let abs = currentAbs; abs < nextNaturalAbs; abs++) {
            const segment = ((abs - 1) % 12) + 1;
            const round = Math.floor((abs - 1) / 12);
            segmentChoices.push({
                abs,
                label: `Segment ${segment}${round === combat.round ? "" : ` (Turn ${round})`}`,
            });
        }

        const positionOption = segmentChoices.length
            ? `<label><input type="radio" name="hold-mode" value="position" checked> Until a position</label>
               <div class="form-group">
                   <label>Segment</label>
                   <select name="hold-segment">${segmentChoices
                       .map((choice) => `<option value="${choice.abs}">${choice.label}</option>`)
                       .join("")}</select>
                   <label>DEX</label>
                   <input type="number" name="hold-dex" value="${ownDex}" min="0" max="99" step="1">
               </div>`
            : "";

        const content = `<fieldset class="hero-hold-dialog">
            <legend>Hold until</legend>
            ${positionOption}
            <label><input type="radio" name="hold-mode" value="event" ${positionOption ? "" : "checked"}> An event</label>
            <div class="form-group">
                <input type="text" name="hold-trigger" placeholder="e.g. if the guard turns around">
            </div>
            <label><input type="radio" name="hold-mode" value="generic"> Generic (no precondition — GM discretion)</label>
        </fieldset>`;

        const result = await foundry.applications.api.DialogV2.wait({
            window: { title: `Hold Action — ${actor.name}` },
            content,
            buttons: [
                {
                    action: "hold",
                    label: "Hold",
                    default: true,
                    callback: (event, button) => {
                        const form = button.form.elements;
                        return {
                            mode: form["hold-mode"].value,
                            segmentAbs: parseInt(form["hold-segment"]?.value),
                            dex: parseInt(form["hold-dex"]?.value),
                            trigger: form["hold-trigger"]?.value.trim() ?? "",
                        };
                    },
                },
                { action: "cancel", label: "Cancel" },
            ],
            rejectClose: false,
        });
        if (!result || result === "cancel") return;

        let hold;
        let description;
        if (result.mode === "position") {
            const segmentAbs = Number.isFinite(result.segmentAbs) ? result.segmentAbs : currentAbs;
            const dex = Number.isFinite(result.dex) ? result.dex : ownDex;
            if (segmentAbs === currentAbs && dex >= actingDex) {
                ui.notifications.warn(`A same-segment hold must target a DEX below ${actingDex}.`);
                return;
            }
            hold = { mode: "position", segmentAbs, dex, declaredAbs: currentAbs };
            const segment = ((segmentAbs - 1) % 12) + 1;
            const round = Math.floor((segmentAbs - 1) / 12);
            description = `until DEX ${dex} in Segment ${segment}${round === combat.round ? "" : ` (Turn ${round})`}`;
        } else if (result.mode === "event") {
            hold = { mode: "event", trigger: result.trigger };
            description = result.trigger ? `— until: ${result.trigger}` : "until a declared event";
        } else {
            hold = { mode: "generic" };
            description = "with no declared condition";
        }

        await actor.toggleStatusEffect("holding", { active: true });
        const effect = actor.effects.find((e) => e.statuses.has("holding"));
        if (effect) await effect.setFlag(game.system.id, "hold", hold);
        await this._holdCard(combatant, `${actor.name} holds their action ${description}.`);

        // Declaring a hold IS the combatant's Phase: end their turn
        if (combat.combatant?.id === combatant.id) {
            try {
                await combat.nextTurn();
            } catch (e) {
                console.warn(`Unable to advance the turn after declaring a hold`, e);
            }
        }
    }

    /**
     * Consumes a Held Action: the holder acts right now, at whatever point in the
     * order the table has reached. The turn pointer is deliberately not moved.
     * @param {string} combatantId
     * @protected
     */
    async _onUseHeldAction(combatantId) {
        const combat = this.viewed;
        const combatant = combat?.combatants.get(combatantId);
        const actor = combatant?.actor;
        const effect = actor?.effects.find((e) => e.statuses.has("holding"));
        if (!combatant?.isOwner || !effect) return;
        const blocked = this._blockedActionReason(combatant);
        if (blocked) return void ui.notifications.warn(blocked);
        const hold = combatant.heldAction;
        await effect.delete();
        await this._recordSpentAction(combatant, hold);
        await this._holdCard(combatant, `${actor.name} uses their Held Action.`);
    }

    /**
     * Using (or aborting with) a Held Action consumes this segment's action: it takes
     * the place of the Phase — a character cannot have two Phases in one Segment
     * (6E2 20; 5ER 360). Records the acted position so turn flow skips the natural
     * Phase and the tracker keeps the row where they acted.
     * @param {Combatant} combatant
     * @param {{mode: string, segmentAbs?: number, dex?: number}|null} hold - The hold as it was before deletion
     * @private
     */
    async _recordSpentAction(combatant, hold) {
        const combat = this.viewed;
        if (!combat?.started || !hold) return;
        const currentAbs = combat.round * 12 + combat.segment;
        const atOwnSlot = hold.mode === "position" && hold.segmentAbs === currentAbs;
        const replacesNaturalPhase = hold.mode !== "position" && combatant.hasPhaseInSegment(combat.segment);
        if (!atOwnSlot && !replacesNaturalPhase) return;
        const dex = atOwnSlot ? hold.dex : Math.floor(combat.getInitiativePriority(combatant, combat.segment));
        await combatant.setFlag(game.system.id, "spentHoldPosition", { segmentAbs: currentAbs, dex });
    }

    /**
     * Drops a Held Action without acting.
     * @param {string} combatantId
     * @protected
     */
    async _onReleaseHeldAction(combatantId) {
        const combatant = this.viewed?.combatants.get(combatantId);
        const actor = combatant?.actor;
        const effect = actor?.effects.find((e) => e.statuses.has("holding"));
        if (!combatant?.isOwner || !effect) return;
        const hold = combatant.heldAction;
        await effect.delete();
        // Releasing at the held slot still forfeits that position (the banked Phase is
        // gone); releasing an event/generic hold costs nothing — the natural Phase stays
        if (hold?.mode === "position") await this._recordSpentAction(combatant, hold);
        await this._holdCard(combatant, `${actor.name} releases their Held Action without acting.`);
    }

    /**
     * Whether a scoped Lightning Reflexes elevation is possible for this combatant
     * right now: "available" while the elevated position is still ahead of the
     * segment's count, "elevated" while an elevation can still be cancelled (its
     * turn has not arrived), null otherwise.
     * @param {Combatant|null} combatant
     * @returns {"available"|"elevated"|null}
     * @protected
     */
    _lrElevationState(combatant) {
        const combat = this.viewed;
        if (!combat?.started || !combatant?.isOwner || !combatant.actor) return null;
        const scoped = combatant.lightningReflexes?.scoped;
        if (!scoped) return null;

        const currentAbs = combat.round * 12 + combat.segment;
        const turnIndex = combat.turns?.findIndex((t) => t.id === combatant.id) ?? -1;
        const reached = turnIndex !== -1 && turnIndex <= (combat.turn ?? 0);

        if (combatant.lrElevatedAbs === currentAbs) {
            // Cancellable until the elevated stop arrives; ending that stop returns
            // the rest of the Phase at natural DEX automatically (nextTurn)
            return reached ? null : "elevated";
        }

        // Elevation moves this segment's natural Phase earlier: it needs a Phase here,
        // an action still unspent, and an elevated position the count has not passed.
        // A position only counts as passed once someone has COMPLETED a turn above it
        // (the segment high-water mark) — the current actor merely being up has not
        // passed it; elevating above them preempts the pointer instead.
        if (!combatant.hasPhaseInSegment(combat.segment)) return null;
        if (combatant.actor.statuses.has("holding")) return null;
        if (combatant.spentHoldInSegment?.(combat.segment)) return null;
        if (reached) return null;
        const elevatedPriority = combat.getInitiativePriority(combatant, combat.segment) + scoped.levels;
        const highWater = combat.getFlag(game.system.id, "segmentHighWater") ?? null;
        if (highWater !== null && elevatedPriority >= highWater) return null;
        return "available";
    }

    /**
     * Toggles a scoped Lightning Reflexes elevation for the current segment. The
     * elevated character acts at DEX + LR but may only execute the scoped action
     * (6E1 116; 5ER 96); cancelling before the elevated turn arrives restores the
     * natural position. The pointer is re-synced to the same active combatant, since
     * the flag write re-sorts the turns array under the stored index.
     * @param {string} combatantId
     * @protected
     */
    async _onToggleLrElevation(combatantId) {
        const combat = this.viewed;
        const combatant = combat?.combatants.get(combatantId);
        const actor = combatant?.actor;
        if (!combat?.started || !combatant?.isOwner || !actor) return;

        const state = this._lrElevationState(combatant);
        if (!state) return;
        const activeId = combat.combatant?.id ?? null;

        if (state === "elevated") {
            await combatant.unsetFlag(game.system.id, "lrElevatedAbs");
            await this._holdCard(combatant, `${actor.name} stands down to their natural DEX.`);
        } else {
            const blocked = this._blockedActionReason(combatant);
            if (blocked) return void ui.notifications.warn(blocked);
            const currentAbs = combat.round * 12 + combat.segment;
            await combatant.setFlag(game.system.id, "lrElevatedAbs", currentAbs);
            const elevatedPriority = combat.getInitiativePriority(combatant, combat.segment);
            await this._holdCard(
                combatant,
                `${actor.name} acts early at effective DEX ${Math.floor(elevatedPriority)} (Lightning Reflexes — only: ${combatant.lightningReflexes.scoped.label}); the rest of their Phase follows at their natural DEX.`,
            );

            // Elevating above the unacted current actor preempts the pointer: the
            // count has not reached that position, so the LR stop goes first and the
            // displaced actor re-enters via the acting-priority threshold afterwards
            const actingPriority =
                combat.getFlag(game.system.id, "actingPriority") ??
                (activeId ? combat.getInitiativePriority(combat.combatants.get(activeId), combat.segment) : -Infinity);
            if (activeId && activeId !== combatant.id && elevatedPriority > actingPriority) {
                if (!HeroCompatibility.isV14) {
                    combat._turns = null;
                    combat.setupTurns();
                }
                const index = combat.turns.findIndex((t) => t.id === combatant.id);
                if (index !== -1) {
                    try {
                        await combat.update(
                            { turn: index, [`flags.${game.system.id}.actingPriority`]: elevatedPriority },
                            { direction: 1, previousCombatantId: combatant.id },
                        );
                    } catch (e) {
                        console.warn(`Unable to preempt the turn pointer for Lightning Reflexes`, e);
                    }
                    return;
                }
            }
        }

        await this._resyncTurnPointer(combat, activeId);
    }

    /**
     * Points the turn index back at the given combatant after a mid-segment priority
     * change re-sorted the turns array. previousCombatantId is the active combatant
     * itself so the natural-turn hold consumption's self-advance guard skips this
     * pointer-only update.
     * @param {Combat} combat
     * @param {string|null} activeId
     * @private
     */
    async _resyncTurnPointer(combat, activeId) {
        if (!combat?.started || activeId === null) return;
        if (!HeroCompatibility.isV14) {
            combat._turns = null;
            combat.setupTurns();
        }
        const index = combat.turns.findIndex((t) => t.id === activeId);
        if (index === -1 || index === combat.turn) return;
        try {
            await combat.update({ turn: index }, { direction: 1, previousCombatantId: activeId });
        } catch (e) {
            console.warn(`Unable to re-sync the turn pointer`, e);
        }
    }

    /**
     * Why the combatant cannot take a voluntary action right now, or null when
     * unblocked. A Stunned character can take no Action at all — not even Aborting
     * (6E2 105); an aborted character cannot act again until the Phase they aborted
     * has passed (6E2 22; 5ER 361).
     * @param {Combatant} combatant
     * @returns {string|null}
     * @private
     */
    _blockedActionReason(combatant) {
        const combat = this.viewed;
        const actor = combatant?.actor;
        if (!actor) return null;
        if (actor.statuses.has("stunned")) {
            return `${actor.name} is Stunned and can take no Actions — not even Aborting.`;
        }
        if (combat?.started && actor.statuses.has("aborted")) {
            const currentAbs = combat.round * 12 + combat.segment;
            if (combatant.abortAppliesAtAbs?.(currentAbs)) {
                const spentAbs = combatant.abortSpentAbs;
                const until =
                    spentAbs === null
                        ? "their aborted Phase has passed"
                        : `Segment ${HeroSystem6eCombatantSingle.segmentOf(spentAbs)} has passed`;
                return `${actor.name} has Aborted and cannot act again until ${until}.`;
            }
        }
        return null;
    }

    /**
     * Why a fresh abort is illegal right now, or null. Beyond the shared action
     * guards, a character who already used their Phase this Segment cannot Abort
     * until the next Segment (6E2 22; 5ER 361).
     * @param {Combatant} combatant
     * @returns {string|null}
     * @private
     */
    _blockedAbortReason(combatant) {
        const shared = this._blockedActionReason(combatant);
        if (shared) return shared;
        const combat = this.viewed;
        if (!combat?.started) return null;
        const turnIndex = combat.turns?.findIndex((t) => t.id === combatant.id) ?? -1;
        const actedThisSegment =
            combatant.spentHoldInSegment(combat.segment) ||
            (combatant.occupiesSegment?.(combat.segment) && turnIndex !== -1 && turnIndex < (combat.turn ?? 0));
        if (actedThisSegment) {
            return `${combatant.actor.name} has already acted this Segment and cannot Abort until the next Segment.`;
        }
        return null;
    }

    /**
     * The Phases a fresh abort would consume from the current combat position: the
     * current Phase when the pointer is on the combatant (their DEX came up without
     * acting — e.g. a Held Action interrupt), otherwise the next full Phase; an
     * Extra Phase power consumes the one after as well (6E2 22).
     * @param {Combatant} combatant
     * @param {{extraPhase?: boolean}} [options]
     * @returns {{isActive: boolean, firstAbs: number, spentAbs: number, nextActAbs: number}}
     * @private
     */
    _abortCost(combatant, { extraPhase = false } = {}) {
        const combat = this.viewed;
        const currentAbs = combat.round * 12 + combat.segment;
        const isActive = combat.combatant?.id === combatant.id;
        const spd = combatant.combatSpd;
        const firstAbs = isActive ? currentAbs : HeroSystem6eCombatantSingle.nextPhaseAbs(spd, currentAbs);
        const spentAbs = extraPhase ? HeroSystem6eCombatantSingle.nextPhaseAbs(spd, firstAbs + 1) : firstAbs;
        const nextActAbs = HeroSystem6eCombatantSingle.nextPhaseAbs(spd, spentAbs + 1);
        return { isActive, firstAbs, spentAbs, nextActAbs };
    }

    /**
     * Applies an abort to a defensive Action (6E2 21-22; 5ER 361). A held Phase is
     * spent instead when the combatant is holding — no further Phase is lost;
     * otherwise the consumed Phase is recorded and the aborted status enforces the
     * lockout until it passes. When the abort replaces the current Phase, the turn
     * advances.
     * @param {Combatant} combatant
     * @param {object} [options]
     * @param {string} [options.toAction] - Defensive action label for the chat card
     * @param {string} [options.statusId] - Maneuver status to apply alongside (e.g. dodge, block)
     * @param {boolean} [options.extraPhase] - The power takes an Extra Phase: two Phases are consumed
     * @param {boolean} [options.force] - Skip the legality guards (GM override)
     * @returns {Promise<boolean>} Whether the abort was applied
     * @protected
     */
    async _declareAbort(
        combatant,
        { toAction = "a defensive Action", statusId = null, extraPhase = false, force = false } = {},
    ) {
        const combat = this.viewed;
        const actor = combatant?.actor;
        if (!combat?.started || !combatant?.isOwner || !actor) return false;
        if (actor.statuses.has("aborted")) return false;

        if (!force) {
            const reason = this._blockedAbortReason(combatant);
            if (reason) {
                ui.notifications.warn(reason);
                return false;
            }
        }

        if (statusId) await this._applyAbortDefense(actor, statusId);

        // A held Phase absorbs the abort — no further Phases are lost (6E2 22; 5ER 361)
        const holdingEffect = actor.effects.find((e) => e.statuses.has("holding"));
        if (holdingEffect) {
            const hold = combatant.heldAction;
            await holdingEffect.delete();
            await this._recordSpentAction(combatant, hold);
            await this._holdCard(
                combatant,
                `${actor.name} Aborts to ${toAction} using their Held Action — no further Phase is lost.`,
            );
            return true;
        }

        await actor.toggleStatusEffect("aborted", { active: true });

        // SPD 0 has no Phase to consume; leave the bare status for the GM to adjudicate
        if (combatant.combatSpd <= 0) {
            await this._holdCard(combatant, `${actor.name} Aborts to ${toAction}.`);
            return true;
        }

        const { isActive, firstAbs, spentAbs, nextActAbs } = this._abortCost(combatant, { extraPhase });
        const abortEffect = actor.effects.find((e) => e.statuses.has("aborted"));
        if (abortEffect) await abortEffect.setFlag(game.system.id, "abort", { spentAbs });

        const { segmentOf } = HeroSystem6eCombatantSingle;
        const costText = extraPhase
            ? `their Phases in Segments ${segmentOf(firstAbs)} and ${segmentOf(spentAbs)} (Extra Phase)`
            : isActive
              ? "their current Phase"
              : `their Phase in Segment ${segmentOf(spentAbs)}`;
        await this._holdCard(
            combatant,
            `${actor.name} Aborts to ${toAction} — this consumes ${costText}; they cannot act again until Segment ${segmentOf(nextActAbs)}.`,
        );

        if (isActive) {
            try {
                await combat.nextTurn();
            } catch (e) {
                console.warn(`Unable to advance the turn after an abort`, e);
            }
        }
        return true;
    }

    /**
     * Applies the defensive maneuver chosen in the abort dialog through the actor's
     * real maneuver item, so the effect carries its CV changes and the standard
     * next-Phase expiry flags. Falls back to the bare status icon for actors without
     * the item (e.g. tokens that never went through upload).
     * @param {Actor} actor
     * @param {string} statusId - dodge or block
     * @private
     */
    async _applyAbortDefense(actor, statusId) {
        const xmlid = { dodge: "DODGE", block: "BLOCK" }[statusId];
        const maneuverItem = xmlid
            ? actor.items.find((i) => ["maneuver", "martialart"].includes(i.type) && i.system?.XMLID === xmlid)
            : null;
        if (maneuverItem) {
            if (!maneuverItem.isActive) await maneuverItem.toggle();
            return;
        }
        await actor.toggleStatusEffect(statusId, { active: true });
    }

    /**
     * Opens the abort declaration dialog: what the character aborts to (flavor for
     * the chat card; Dodge and Block also activate their maneuver) and, for the
     * GM, whether the power takes an Extra Phase. Blocked aborts warn players; the
     * GM may override.
     * @param {string} combatantId
     * @protected
     */
    async _onAbortAction(combatantId) {
        const combat = this.viewed;
        const combatant = combat?.combatants.get(combatantId);
        const actor = combatant?.actor;
        if (!combat?.started || !combatant?.isOwner || !actor) return;
        if (actor.statuses.has("aborted")) return;

        const reason = this._blockedAbortReason(combatant);
        if (reason && !game.user.isGM) return void ui.notifications.warn(reason);
        if (reason) {
            const proceed = await foundry.applications.api.DialogV2.confirm({
                window: { title: `Abort — ${actor.name}` },
                content: `<p>${reason}</p><p>Abort anyway?</p>`,
                rejectClose: false,
            });
            if (!proceed) return;
        }

        const { segmentOf, roundOf } = HeroSystem6eCombatantSingle;
        const holding = actor.statuses.has("holding");
        let costLine;
        if (holding) {
            costLine = "The Held Action will be spent — no further Phase is lost.";
        } else if (combatant.combatSpd <= 0) {
            costLine = "No Phases on the Speed Chart — the GM adjudicates the cost.";
        } else {
            const { isActive, spentAbs, nextActAbs } = this._abortCost(combatant);
            const roundLabel = roundOf(spentAbs) === combat.round ? "" : ` (Turn ${roundOf(spentAbs)})`;
            costLine = isActive
                ? `This consumes the current Phase and ends the turn; ${actor.name} cannot act again until Segment ${segmentOf(nextActAbs)}.`
                : `This consumes the Phase in Segment ${segmentOf(spentAbs)}${roundLabel}; ${actor.name} cannot act again until Segment ${segmentOf(nextActAbs)}.`;
        }

        const extraPhaseOption =
            game.user.isGM && !holding && combatant.combatSpd > 0
                ? `<label><input type="checkbox" name="abort-extra-phase"> Power takes an Extra Phase (consumes two Phases)</label>`
                : "";

        const content = `<fieldset class="hero-hold-dialog">
            <legend>Abort to</legend>
            <div class="form-group">
                <select name="abort-action">
                    <option value="dodge">Dodge</option>
                    <option value="block">Block</option>
                    <option value="dive">Dive For Cover</option>
                    <option value="other">Other defensive Action</option>
                </select>
                <input type="text" name="abort-detail" placeholder="details, e.g. activate Force Field">
            </div>
            ${extraPhaseOption}
            <p class="hint">${costLine}</p>
        </fieldset>`;

        const result = await foundry.applications.api.DialogV2.wait({
            window: { title: `Abort — ${actor.name}` },
            content,
            buttons: [
                {
                    action: "abort",
                    label: "Abort",
                    default: true,
                    callback: (event, button) => {
                        const form = button.form.elements;
                        return {
                            action: form["abort-action"].value,
                            detail: form["abort-detail"]?.value.trim() ?? "",
                            extraPhase: !!form["abort-extra-phase"]?.checked,
                        };
                    },
                },
                { action: "cancel", label: "Cancel" },
            ],
            rejectClose: false,
        });
        if (!result || result === "cancel") return;

        const labels = { dodge: "Dodge", block: "Block", dive: "Dive For Cover", other: "a defensive Action" };
        const statusIds = { dodge: "dodge", block: "block" };
        // Guards already ran above (with the GM override prompt)
        await this._declareAbort(combatant, {
            toAction: result.detail || labels[result.action] || "a defensive Action",
            statusId: statusIds[result.action] ?? null,
            extraPhase: result.extraPhase,
            force: true,
        });
    }

    /**
     * Removes the aborted status — the correction tool for a mis-declared abort.
     * @param {string} combatantId
     * @protected
     */
    async _onCancelAbort(combatantId) {
        const combatant = this.viewed?.combatants.get(combatantId);
        const actor = combatant?.actor;
        if (!combatant?.isOwner || !actor?.statuses.has("aborted")) return;
        await actor.toggleStatusEffect("aborted", { active: false });
    }
}
