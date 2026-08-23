import { HeroSystem6eCombatantSingle } from "./combatant-single.mjs";
import { HeroSystem6eCombatSingle } from "./combat-single.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor/actor-active-effects.mjs";
import { overrideCanAct } from "./settings/settings-helpers.mjs";
import { activeSingleTrackerCombatFor, isQuenchTestRunning } from "./utility/util.mjs";

const { CombatTracker } = foundry.applications.sidebar.tabs;

// Segment-math idioms shared with the combatant model (absolute segments are
// monotonic across Turns; combat begins at Turn 1, Segment 12)
const { absoluteSegment, segmentOf, roundOf, phaseLabel } = HeroSystem6eCombatantSingle;

export class HeroSystem6eCombatTrackerSingle extends CombatTracker {
    /** Combatant id this app instance last auto-scrolled to (sidebar and popout scroll independently). */
    _lastAutoScrolledId;

    /** Whether the delegated condition-icon click handler is bound to this app's element. */
    _heroEffectsClickBound = false;

    /** Absolute segment seen by the last context build; stale expansion overrides sweep on change. */
    _lastSeenAbs;

    static {
        Hooks.on("renderCombatTracker", decorateTrackerRender);
        Hooks.on("renderChatMessageHTML", wireTimingContestButton);
        Hooks.on("createActiveEffect", routeBareStatusToggle);
        Hooks.on("createActiveEffect", cancelDelayedOnIncapacity);
        Hooks.on("createActiveEffect", stampKnockoutMoment);
        Hooks.once("ready", rebuildTurnsAtReady);
        Hooks.on("renderCombatTrackerConfig", injectTrackerConfigFields);
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
        this._persistSegmentExpansion(combatId);
    }

    _persistSegmentExpansion(combatId) {
        try {
            localStorage.setItem(
                this._segmentExpansionStorageKey(combatId),
                JSON.stringify(this._getSegmentExpansion(combatId)),
            );
        } catch (e) {
            console.warn(`Unable to persist segment expansion state`, e);
        }
    }

    /**
     * Drops expansion overrides for segments the fight has moved past, restoring
     * the collapsed default for passed segments.
     * @param {string} combatId
     * @param {number} currentAbs
     * @private
     */
    _dropStaleSegmentOverrides(combatId, currentAbs) {
        const overrides = this._getSegmentExpansion(combatId);
        let dirty = false;
        for (const key of Object.keys(overrides)) {
            const abs = Number(key);
            if (!Number.isFinite(abs)) continue; // "held" panel key
            // Keys are absolute segments (legacy bare-segment keys are all < 24
            // and sweep themselves out here on the first pass)
            if (abs < currentAbs) {
                delete overrides[key];
                dirty = true;
            }
        }
        if (dirty) this._persistSegmentExpansion(combatId);
    }

    /**
     * Sanitizes render options before core sees them.
     * @override
     * @protected
     */
    async _onRender(context, options) {
        const safeContext = context || {};

        // Hand core a CLONE: programmatic renders (Quench) reach core's
        // `"turn" in renderData.find(...)` probe with no matching entry and crash.
        // The original options must stay untouched — renderContext is a STRING
        // ("updateCombat") the render hooks use to spot real combat updates.
        const invalid = !options || typeof options !== "object" || Array.isArray(options);
        const safeOptions = invalid ? {} : { ...options };
        // This tracker owns auto-scrolling (segment timeline + sticky held panel make
        // core's offset math wrong anyway), so skip core's scroll block entirely.
        safeOptions.parts = [];

        await super._onRender(safeContext, safeOptions);

        // Owners toggle conditions by clicking their icons (delegated; the app
        // element persists across renders, so bind once per instance)
        if (!this._heroEffectsClickBound && this.element) {
            this.element.addEventListener("click", this._onTokenEffectClick.bind(this));
            this._heroEffectsClickBound = true;
        }
    }

    /**
     * Guards the footer's full-Turn step buttons against misclicks (legacy-tracker
     * parity): a Round jump crosses 12 segments of maintenance and Post-Segment 12
     * recovery, and spent holds are not restored on rewind — so it must be held
     * behind the OverrideCanAct key. Core routes the footer buttons through this
     * fallback with the Combat method name in data-action.
     * @override
     * @protected
     */
    async _onClickAction(event, target) {
        const action = target?.dataset?.action;
        if (["previousRound", "nextRound"].includes(action) && this.viewed?.started && !overrideCanAct) {
            const overrideKeyText = game.keybindings.get(game.system.id, "OverrideCanAct")?.[0]?.key ?? "ControlLeft";
            return ui.notifications.warn(
                `Skipping a full Turn is unusual. Hold ${overrideKeyText} and click again to confirm.`,
            );
        }
        return super._onClickAction(event, target);
    }

    /** Row width is tight: only the most impactful condition icons fit. */
    static MAX_ROW_EFFECT_ICONS = 4;

    /**
     * Combat-relevant effects for a row: core's showIcon filter, then the
     * system's combat classification (most impactful first), then alike effects
     * collapsed into one entry (all aids, all drains, impaired senses). Both the
     * render context and the click handler derive from this list, so the icon
     * DOM index always maps back to the same entry.
     * @param {Actor} actor
     * @returns {{img: string, name: string, effects: ActiveEffect[]}[]}
     * @private
     */
    _rowEffectEntries(actor) {
        const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;
        const defeatedId = CONFIG.specialStatusEffects?.DEFEATED;
        const classified = [];
        for (const effect of actor?.appliedEffects ?? []) {
            if (defeatedId && effect.statuses.has(defeatedId)) continue;
            if (
                effect.showIcon !== SHOW_ICON.ALWAYS &&
                !(effect.showIcon === SHOW_ICON.CONDITIONAL && effect.isTemporary)
            ) {
                continue;
            }
            const rank = HeroSystem6eActorActiveEffects.combatTrackerClassification(effect);
            if (!rank) continue;
            classified.push({ effect, ...rank });
        }
        classified.sort((a, b) => a.tier - b.tier || a.order - b.order || a.effect.name.localeCompare(b.effect.name));

        // A lone group member keeps its own icon and name; two or more collapse
        // into the generic group entry at the first member's priority slot
        const statusEffectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;
        const groupDisplay = {
            senses: { name: "Senses Impaired" },
            aid: { name: "Aided", img: statusEffectsObj.aidEffect.img },
            drain: { name: "Drained", img: statusEffectsObj.drainEffect.img },
        };
        const entries = [];
        const byGroup = new Map();
        for (const { effect, group } of classified) {
            const existing = group ? byGroup.get(group) : null;
            if (existing) {
                existing.effects.push(effect);
                existing.name = groupDisplay[group].name;
                existing.img = groupDisplay[group].img ?? existing.effects[0].img;
                continue;
            }
            const entry = { img: effect.img, name: effect.name, effects: [effect] };
            if (group) byGroup.set(group, entry);
            entries.push(entry);
        }
        return entries;
    }

    /**
     * Replaces core's unfiltered effect icons with the classified, grouped list,
     * capped to the few icons a row can fit. The tooltip still enumerates every
     * combat-relevant effect, including grouped members and overflow.
     * @override
     */
    async _prepareTurnContext(combat, combatant, index) {
        const turn = await super._prepareTurnContext(combat, combatant, index);
        try {
            const entries = this._rowEffectEntries(combatant.actor);
            const icons = entries
                .slice(0, HeroSystem6eCombatTrackerSingle.MAX_ROW_EFFECT_ICONS)
                .map((e) => ({ img: e.img, name: e.effects.length > 1 ? `${e.name} (×${e.effects.length})` : e.name }));
            const tooltipEntries = entries.flatMap((e) => e.effects.map((ae) => ({ img: ae.img, name: ae.name })));
            turn.effects = { icons, tooltip: this._formatEffectsTooltip(tooltipEntries) };
        } catch (e) {
            console.warn(`Combat-relevant effect row build failed`, e);
        }
        return turn;
    }

    /**
     * Click-to-toggle for row condition icons (feedback + #4546: standing up from
     * prone should be one click). Owners only; only simple single-status actor
     * conditions toggle — maneuver/item effects and hold/abort statuses are owned
     * by their own flows.
     * @param {MouseEvent} event
     * @private
     */
    async _onTokenEffectClick(event) {
        const img = event.target?.closest?.("img.token-effect");
        if (!img) return;
        const li = img.closest(".combatant[data-combatant-id]");
        const combatant = this.viewed?.combatants.get(li?.dataset.combatantId);
        const actor = combatant?.actor;
        if (!actor || !combatant.isOwner) return;
        event.preventDefault();
        event.stopPropagation();

        const entries = this._rowEffectEntries(actor).slice(0, HeroSystem6eCombatTrackerSingle.MAX_ROW_EFFECT_ICONS);
        const index = [...(img.parentElement?.querySelectorAll("img.token-effect") ?? [])].indexOf(img);
        const entry = entries[index];
        const effect = entry?.effects.length === 1 ? entry.effects[0] : null;
        // Toggle only simple actor-level conditions (prone, stunned…):
        // - grouped icons (aids, drains, senses) have no single toggle target
        // - item effects (maneuvers) store their localized NAME in statuses and
        //   belong to their item's toggle, not toggleStatusEffect
        // - multi-status effects would be deleted then partially re-created
        // - holds/aborts carry bookkeeping the tracker flows own
        if (!effect || effect.statuses.size !== 1 || effect.parent !== actor) return;
        const [status] = effect.statuses;
        // encumbered is weight-derived: a click-toggle would be recreated by the
        // next encumbrance recalc (or orphan the penalties)
        if (["holding", "aborted", "encumbered"].includes(status)) return;
        if (!CONFIG.statusEffects?.some((s) => s.id === status)) return;
        await actor.toggleStatusEffect(status);
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
        await super._prepareTrackerContext(context, options);
        const combat = this.viewed;
        if (!combat?.started) return this._previewUnstartedTurns(context, combat);

        const masterTurns = context.turns || [];
        const masterById = new Map(masterTurns.map((t) => [t.id, t]));
        const activeCombatantId = combat.combatant?.id || null;

        this._decorateAbortTooltips(combat, masterTurns);

        const currentAbs = absoluteSegment(combat.round, combat.segment);
        const startAbs = absoluteSegment(1, 12);

        const { membersAt, historyAt, segmentPopulation, hiddenPopulation } = this._segmentQueryHelpers(
            combat,
            currentAbs,
        );
        const { positions, windowAbs, hiddenOnlyAbs } = this._selectTimelinePositions(combat, {
            currentAbs,
            startAbs,
            membersAt,
            segmentPopulation,
            hiddenPopulation,
        });

        // Disposition tinting follows Foundry's own turn-marker disposition setting
        let dispositionTint = false;
        try {
            dispositionTint = !!game.settings.get("core", Combat.CONFIG_SETTING)?.turnMarker?.disposition;
        } catch (e) {
            console.warn(`Unable to read combat tracker disposition setting`, e);
        }

        // Once the fight moves past a segment, its manual expansion override is
        // dropped so the past-default (collapsed) applies again; this also clears
        // the segment-number key aliasing across Turns (#4556/#4562)
        if (this._lastSeenAbs !== currentAbs) {
            if (this._lastSeenAbs !== undefined && currentAbs > this._lastSeenAbs) {
                this._dropStaleSegmentOverrides(combat.id, currentAbs);
            }
            this._lastSeenAbs = currentAbs;
        }

        const state = {
            combat,
            currentAbs,
            activeCombatantId,
            masterById,
            dispositionTint,
            expansionOverrides: this._getSegmentExpansion(combat.id),
            membersAt,
            historyAt,
            windowAbs,
            hiddenOnlyAbs,
            timelineTurns: [],
        };
        this._buildHeldPanel(state);
        this._buildSegmentRows(state, positions);

        context.turns = state.timelineTurns;
        // Forces core's plain-span initiative branch: if every stored initiative
        // happened to be integral, core would otherwise render editable inputs
        context.hasDecimals = true;
        return context;
    }

    /** Unstarted combat: DEX (+ always-on LR) previews replace core's d20 initiative. */
    _previewUnstartedTurns(context, combat) {
        // HERO rolls no initiative: unstarted rows preview DEX (+ always-on LR)
        // instead of the core d20 button. hasDecimals forces the plain-span
        // branch of the core template, which also removes the GM-editable input.
        for (const turn of context.turns ?? []) {
            const combatant = combat?.combatants.get(turn.id);
            const actor = combatant?.actor;
            if (!actor) {
                turn.initiative = "\u2014";
                turn.hasRolled = true;
                continue;
            }
            const characteristicKey = actor.system?.initiativeCharacteristic ?? "dex";
            const dex = actor.system?.characteristics?.[characteristicKey]?.value ?? 10;
            const preview = dex + (combatant.lightningReflexes?.always ?? 0);
            turn.initiative = String(preview);
            turn.hasRolled = true;
            turn._heroPreview = preview;
        }
        context.turns?.sort((a, b) => (b._heroPreview ?? -1) - (a._heroPreview ?? -1));
        context.hasDecimals = true;
        return context;
    }

    /**
     * Aborted rows: surface WHEN the lockout clears in the icon tooltip
     * (the status only deletes once the spent Phase's segment has passed).
     */
    _decorateAbortTooltips(combat, masterTurns) {
        for (const turn of masterTurns) {
            try {
                const combatant = combat.combatants.get(turn.id);
                const abortEffect = combatant?.abortEffect;
                if (!abortEffect?.getFlag(game.system.id, "abort")) continue;
                const spentAbs = combatant.abortSpentAbs;
                const clearsText =
                    spentAbs === null
                        ? `${abortEffect.name} — lasts until removed (GM adjudicates)`
                        : `${abortEffect.name} — clears after ${phaseLabel(spentAbs)} ends`;
                const entries = Array.isArray(turn.effects) ? turn.effects : (turn.effects?.icons ?? []);
                for (const entry of entries) {
                    if (entry?.name === abortEffect.name) entry.name = clearsText;
                }
                // Core builds the row's visible tooltip string before this pass runs;
                // renaming the icon entries alone only reaches the img alt text
                if (typeof turn.effects?.tooltip === "string" && turn.effects.tooltip.includes(abortEffect.name)) {
                    turn.effects.tooltip = turn.effects.tooltip.replace(abortEffect.name, clearsText);
                }
            } catch (e) {
                console.warn(`Abort tooltip decoration failed`, e);
            }
        }
    }

    /**
     * Per-render segment queries: live members at an absolute position, ledger
     * history for passed segments (cached), and combined population.
     */
    _segmentQueryHelpers(combat, currentAbs) {
        const membersAt = (abs) => {
            const segment = segmentOf(abs);
            const isPast = abs < currentAbs;
            return combat.combatants.filter((c) => {
                if (!c.actor) return false;
                // Core filters hidden combatants out of player-facing turns; match it here
                if (c.hidden && !game.user.isGM) return false;
                // A positional Held Action commits the banked Phase to exactly its
                // declared slot — natural Phases don't render while one is pending
                // (mirrors occupiesSegment; also stops double rows feeding #4557)
                if (c.heldAction?.mode === "position") {
                    return !isPast && (c.holdsPositionAtAbs(abs) || c.spentHoldAtAbs(abs));
                }
                // queryAbs matters: the SPD-lockout window is an absolute range,
                // and a bare segment number aliases across Turns
                if (c.hasPhaseInSegment(segment, abs)) return true;
                // A spent hold keeps displaying at the acted position until the
                // segment ends; event/generic holds render in the panel instead
                return !isPast && c.spentHoldAtAbs(abs);
            });
        };

        // Past segments render from the combat ledger when it has records: what actually
        // happened, including combatants that have since been removed. Live computation
        // is the fallback for combats predating the ledger.
        const historyCache = new Map();
        const historyAt = (abs) => {
            if (abs >= currentAbs) return null;
            if (!historyCache.has(abs)) {
                let rows = combat.historyRowsForSegment?.(abs) ?? null;
                if (rows && !game.user.isGM) rows = rows.filter((row) => !row.hidden);
                historyCache.set(abs, rows);
            }
            return historyCache.get(abs);
        };
        const segmentPopulation = (abs) => historyAt(abs)?.length ?? membersAt(abs).length;

        // GM-hidden stops at a position, player view only (the GM sees the real
        // rows). Feeds the "Unknown" placeholder: an all-hidden segment must
        // still occupy the timeline or the ±window walks straight past it into
        // the next Turn (the players-only orange next-Turn header bug).
        const hiddenPopulation = (abs) => {
            if (game.user.isGM) return 0;
            const segment = segmentOf(abs);
            if (abs < currentAbs) {
                return (combat.historyRowsForSegment?.(abs) ?? []).filter((row) => row.hidden).length;
            }
            return combat.combatants.filter((c) => {
                if (!c.actor || !c.hidden) return false;
                if (c.heldAction?.mode === "position") {
                    return c.holdsPositionAtAbs(abs) || c.spentHoldAtAbs(abs);
                }
                return c.hasPhaseInSegment(segment, abs) || c.spentHoldAtAbs(abs);
            }).length;
        };

        return { membersAt, historyAt, segmentPopulation, hiddenPopulation };
    }

    /**
     * Chooses which absolute segments render: the current Turn's non-empty
     * segments, the previous/next-2 non-empty window (nearest future one
     * auto-expands), and delayed-action landing segments. For players, segments
     * populated ONLY by GM-hidden combatants still occupy the timeline (they
     * render as condensed "Unknown" placeholders) — dropping them made the
     * forward window walk off the current Turn's end and paint the next Turn's
     * first segment as if it were imminent.
     */
    _selectTimelinePositions(combat, { currentAbs, startAbs, membersAt, segmentPopulation, hiddenPopulation }) {
        const hiddenOnlyAbs = new Set();
        const markHiddenOnly = (abs) => {
            if (abs !== currentAbs) hiddenOnlyAbs.add(abs);
        };
        // Candidate positions: every non-empty segment of the current Turn, clamped to combat start
        const positions = new Set([currentAbs]);
        for (let segment = 1; segment <= 12; segment++) {
            const abs = absoluteSegment(combat.round, segment);
            if (abs < startAbs) continue;
            if (segmentPopulation(abs) > 0) {
                positions.add(abs);
            } else if (hiddenPopulation(abs) > 0) {
                positions.add(abs);
                markHiddenOnly(abs);
            }
        }

        // Include the previous 2 and next 2 non-empty segments, across Turn boundaries,
        // but only auto-expand the nearest one in each direction.
        // Past segments default to collapsed headers (#4556/#4562); only the
        // nearest FUTURE segment auto-expands — and never a placeholder.
        // Hidden-only positions render (as condensed placeholders) but do NOT
        // consume the ±2 window budget: a player whose nearest neighbours are
        // all GM-hidden must still see their own next visible Phases.
        const windowAbs = new Set();
        let found = 0;
        for (let abs = currentAbs - 1; abs >= startAbs && found < 2; abs--) {
            if (segmentPopulation(abs) > 0) {
                positions.add(abs);
                found++;
            } else if (hiddenPopulation(abs) > 0) {
                positions.add(abs);
                markHiddenOnly(abs);
            }
        }
        found = 0;
        let futureExpanded = false;
        for (let abs = currentAbs + 1; abs <= currentAbs + 24 && found < 2; abs++) {
            const visible = membersAt(abs).length > 0;
            if (!visible && hiddenPopulation(abs) === 0) continue;
            positions.add(abs);
            if (!visible) {
                markHiddenOnly(abs);
                continue;
            }
            if (!futureExpanded) {
                windowAbs.add(abs);
                futureExpanded = true;
            }
            found++;
        }

        // A delayed action's landing segment always renders, even if otherwise
        // empty — but a GM-hidden combatant's landing must not leak an otherwise
        // empty segment header to players. A VISIBLE combatant's landing also
        // un-marks the placeholder: the marker row must render, not be swallowed
        // by an "Unknown" band covering hidden bystanders
        for (const combatant of combat.combatants) {
            if (combatant.hidden && !game.user.isGM) continue;
            for (const [, record] of combat.delayedActionsFor?.(combatant) ?? []) {
                if (record.resolveAbs >= currentAbs && record.resolveAbs <= currentAbs + 24) {
                    positions.add(record.resolveAbs);
                    hiddenOnlyAbs.delete(record.resolveAbs);
                }
            }
        }

        return { positions, windowAbs, hiddenOnlyAbs };
    }

    /** Pushes the Held Actions panel (event/generic holders) onto the timeline. */
    _buildHeldPanel(state) {
        const { combat, masterById, dispositionTint, expansionOverrides, timelineTurns } = state;
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
                        (a.actor.system?.characteristics?.dex?.value ?? 0) ||
                    HeroSystem6eCombatSingle.stableTiebreak(a, b),
            );

        const panelExpanded = expansionOverrides["held"] ?? true;
        if (panelHolders.length > 0) {
            const panelHeader = {
                id: "held-panel-header",
                _id: "held-panel-header",
                name: `⏳ Held Actions (${panelHolders.length})`,
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
            timelineTurns.push(this._markActorless(panelHeader));

            for (const combatant of panelHolders) {
                const row = this._baseRowFor(combatant, masterById.get(combatant.id));
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

    /**
     * Player-view stand-in for a run of segments populated only by GM-hidden
     * combatants: one condensed band — players learn something acts between the
     * neighbouring segments without learning how much or exactly when.
     */
    _pushUnknownPlaceholder(state, abs) {
        const headerId = `seg-header-unknown-${abs}`;
        const headerTurn = {
            id: headerId,
            _id: headerId,
            name: "Unknown",
            img: "icons/svg/mystery-man.svg",
            css: ["hero-timeline-header-row", "hero-unknown-header", "segment-collapsed"].join(" "),
            hasRolled: true,
            initiative: null,
            isFakeHeader: true,
            active: false,
        };
        state.timelineTurns.push(this._markActorless(headerTurn));
    }

    /** Renders each selected segment: a header row plus member/history/marker rows. */
    _buildSegmentRows(state, positions) {
        const { combat, currentAbs, expansionOverrides, windowAbs, membersAt, historyAt, timelineTurns } = state;
        const sorted = [...positions].sort((a, b) => a - b);
        for (let i = 0; i < sorted.length; i++) {
            const abs = sorted[i];
            if (state.hiddenOnlyAbs?.has(abs)) {
                // Consecutive hidden-only positions condense into ONE band
                while (i + 1 < sorted.length && state.hiddenOnlyAbs.has(sorted[i + 1])) i++;
                this._pushUnknownPlaceholder(state, abs);
                continue;
            }
            const segment = segmentOf(abs);
            const round = roundOf(abs);
            const isCurrent = abs === currentAbs;
            const isPast = abs < currentAbs;
            const isNextTurn = round > combat.round;
            const expanded = isCurrent || (expansionOverrides[abs] ?? windowAbs.has(abs));

            // _comparePriority breaks priority ties by combatant id, keeping the order stable;
            // the exact position matters because segment numbers alias across Turns
            const members = membersAt(abs).sort((a, b) =>
                combat._comparePriority(a, b, combat, segment, { queryAbs: abs }),
            );
            const historyRows = isPast ? historyAt(abs) : null;

            const roundLabel = round === combat.round ? "" : ` (Turn ${round})`;
            const stateLabel = isCurrent ? " — Current" : isPast ? " — Passed" : "";
            // Delayed-action markers count as rows — a segment rendered solely for
            // a landing would otherwise read "(0)" above a visible marker
            const delayedCount = isPast
                ? 0
                : combat.combatants.reduce((n, c) => {
                      if (c.hidden && !game.user.isGM) return n;
                      return n + (combat.delayedActionsFor?.(c) ?? []).filter(([, r]) => r.resolveAbs === abs).length;
                  }, 0);
            const countLabel = ` (${(historyRows?.length ?? members.length) + delayedCount})`;

            const headerId = `seg-header-${round}-${segment}`;
            const headerTurn = {
                id: headerId,
                _id: headerId,
                name: `Segment ${segment}${roundLabel}${stateLabel}${countLabel}`,
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
            timelineTurns.push(this._markActorless(headerTurn));

            // Member rows always render; a collapsed segment hides them via class so
            // expansion toggles animate in place without a re-render
            const memberClasses = `timeline-member hero-seg-abs-${abs}${expanded ? "" : " segment-member-hidden"}`;
            const seg = { abs, segment, isCurrent, isPast, isNextTurn, memberClasses, members };

            if (historyRows) {
                this._buildHistoryRows(state, seg, historyRows);
                continue;
            }

            const entries = this._collectSegmentEntries(state, seg);
            const groups = this._groupSegmentEntries(combat, entries);
            for (const group of groups) {
                this._pushGroupRows(state, seg, group);
            }
        }
    }

    /** Renders a passed segment's rows from the combat ledger (including since-removed combatants). */
    _buildHistoryRows(state, seg, historyRows) {
        const { combat, masterById, dispositionTint, timelineTurns } = state;
        const { abs, memberClasses } = seg;
        for (const [idx, h] of historyRows.entries()) {
            const live = h.combatantId ? combat.combatants.get(h.combatantId) : null;
            const rowId = live ? live.id : `ledger-${abs}-${idx}`;
            // "acted from hold", not "held": the live segment showed "(acted)"
            // once the hold was spent, and the ledger row must not read as if the
            // action reverted to a pending hold when the segment passed (#feedback)
            const kindLabel =
                {
                    "held-used": " (acted from hold)",
                    "held-forfeit": " (hold spent)",
                    aborted: " (aborted)",
                    haymaker: " (haymaker)",
                }[h.kind] ?? "";
            const row = this._baseRowFor(live, live ? masterById.get(live.id) : null, {
                overrides: { id: rowId, _id: rowId, hidden: false, defeated: false },
                imgFallback: false,
            });
            row.id = rowId;
            row._id = rowId;
            row.name = `${h.name}${kindLabel}`;
            row.img = h.img || row.img || "icons/svg/mystery-man.svg";
            row.initiative = (h.priority ?? 0).toFixed(2);
            row.hasRolled = true;
            row.active = false;
            row.effects = { icons: [], tooltip: "" };
            row.css = [
                (row.css || "").replace(/\bactive\b/g, "").trim(),
                "past-segment-preview",
                "hero-history-row",
                memberClasses,
                live ? "" : "hero-history-removed",
            ]
                .filter(Boolean)
                .join(" ");
            if (live && dispositionTint) row.css = `${row.css} ${this._dispositionClass(live)}`.trim();
            if (!live) this._markActorless(row);
            timelineTurns.push(row);
        }
    }

    /**
     * Assembles a live segment's sorted acting entries: members plus LR
     * shadows/spent stops and delayed-action markers.
     */
    _collectSegmentEntries(state, seg) {
        const { combat } = state;
        const { abs, segment, isPast, members } = seg;
        // An elevated scoped-LR combatant occupies two visible positions: the LR
        // stop, and a shadow row where the rest of the Phase lands at natural DEX
        const entries = [];
        for (const combatant of members) {
            const priority = combat.getInitiativePriority(combatant, segment, { queryAbs: abs });
            entries.push({ combatant, priority, lrShadow: false });
            if (combatant.lrElevatedAbs === abs) {
                const scopedLevels = combatant.lightningReflexes?.scoped?.levels ?? 0;
                if (scopedLevels > 0) {
                    entries.push({ combatant, priority: priority - scopedLevels, lrShadow: true });
                }
            }
            // A completed LR stop stays visible at the elevated position for the
            // rest of the segment (the natural row above is the Phase remainder)
            const spentLr = combatant.getFlag(game.system.id, "spentLrPosition");
            if (spentLr?.segmentAbs === abs) {
                entries.push({ combatant, priority: spentLr.priority, lrShadow: false, lrSpent: true });
            }
        }
        // Delayed actions land at their scheduled position (declared DEX, or the
        // very end of the segment when none): inert marker rows
        if (!isPast) {
            for (const combatant of combat.combatants) {
                if (combatant.hidden && !game.user.isGM) continue;
                for (const [delayedId, record] of combat.delayedActionsFor?.(combatant) ?? []) {
                    if (record.resolveAbs !== abs) continue;
                    entries.push({
                        combatant,
                        priority: record.priority ?? -1,
                        lrShadow: false,
                        delayed: record,
                        delayedId,
                    });
                }
            }
        }
        // Same order _comparePriority produces: priority descending, then the
        // per-segment sub-roll shuffle within a shared roll group
        entries.sort(
            (a, b) =>
                b.priority - a.priority ||
                (combat.tieBreakOrder
                    ? combat.tieBreakOrder(a.combatant, b.combatant, abs)
                    : HeroSystem6eCombatSingle.stableTiebreak(a.combatant, b.combatant)),
        );
        return entries;
    }

    /**
     * Tokens of the same root actor tied on the same priority act back to back;
     * collapse them into a single row with a count. The row represents the active
     * member when the group contains it so click/hover target the acting token.
     */
    _groupSegmentEntries(combat, entries) {
        const groups = [];
        for (const entry of entries) {
            const rollKey = combat._tieRollKey?.(entry.combatant) ?? (entry.combatant.actorId || entry.combatant.id);
            const key = `${rollKey}${entry.lrShadow ? ":lr-shadow" : ""}${entry.delayed ? `:delayed:${entry.delayedId}` : ""}${entry.lrSpent ? ":lr-spent" : ""}`;
            const prev = groups.at(-1);
            if (prev && prev.key === key && prev.priority === entry.priority && !entry.delayed && !entry.lrSpent) {
                prev.combatants.push(entry.combatant);
            } else {
                groups.push({
                    key,
                    priority: entry.priority,
                    combatants: [entry.combatant],
                    lrShadow: entry.lrShadow,
                    delayed: entry.delayed ?? null,
                    delayedId: entry.delayedId ?? null,
                    lrSpent: !!entry.lrSpent,
                });
            }
        }
        return groups;
    }

    /** Renders one display group: an optional exploded ×N summary header plus its member rows. */
    _pushGroupRows(state, seg, group) {
        const { combat, currentAbs, activeCombatantId, masterById, dispositionTint, timelineTurns } = state;
        const { abs, isCurrent, isPast, isNextTurn, memberClasses } = seg;
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
            const row = this._baseRowFor(combatant, masterById.get(combatant.id));

            // A rolled numeric initiative keeps core's d20 roll button away
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
                memberClasses,
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

            if (group.lrSpent) {
                // The acted LR stop: inert display of where the scoped action
                // happened; the combatant's live row is the Phase remainder
                row.name = `↯ ${row.name} (acted early)`;
                row.effects = { icons: [], tooltip: "" };
                row.active = false;
                row.css = `${row.css} hero-lr-row hero-lr-spent ${stateCss} ${memberClasses}`.trim();
                timelineTurns.push(row);
                continue;
            }

            if (group.delayed) {
                // Delayed-action landing: informational marker, no controls
                // (a truthy initiative keeps core's d20 roll button away)
                const record = group.delayed;
                // Per-user masking: the GM sees hidden targets' real names
                const targetNames = (combat.delayedTargets?.(record) ?? []).map((t) =>
                    t.hidden && !game.user.isGM ? "Unknown" : t.name,
                );
                const vsText = targetNames.length ? ` vs ${targetNames.join(", ")}` : "";
                // The landing is a REAL pointer stop: when the pointer sits on it,
                // the marker row is the active turn (only the parked-on declarer's —
                // two simultaneous landings must not paint two active rows)
                const landedActive =
                    isCurrent && !!record.landed && !!combat.atDelayedLandingStop && combatant.id === activeCombatantId;
                row.name =
                    record.kind === "haymaker"
                        ? `💥 ${row.name} — Haymaker ${record.landed ? "lands NOW" : "resolves"}${vsText}`
                        : `⏳ ${row.name} — ${record.label}${record.landed ? " — NOW" : ""}${vsText}`;
                row.initiative =
                    record.priority !== null && record.priority !== undefined ? String(record.priority) : "—";
                row.effects = { icons: [], tooltip: "" };
                row.active = landedActive;
                row.css =
                    `${row.css} hero-haymaker-row hero-delayed-row hero-delayed-id-${group.delayedId} ${stateCss} ${memberClasses} ${landedActive ? "active" : ""}`.trim();
                timelineTurns.push(row);
                continue;
            }

            // Positional holds render at their declared slot with the held marker;
            // spent holds keep the row at the acted position; the holder's
            // natural-Phase rows stay unmarked
            if (!isPast && combatant.holdsPositionAtAbs(abs)) {
                row.css = `${row.css} is-holding-action hero-held-row`.trim();
                row.name = `⏳ ${row.name} (held)`;
            } else if (!isPast && combatant.spentHoldAtAbs(abs)) {
                row.css = `${row.css} is-holding-action`.trim();
                // Present tense while the used Held Action is still the active
                // turn; past tense once the pointer has moved on (#4603)
                const acting = combatant.id === activeCombatantId && abs === currentAbs;
                row.name = `${row.name} (${acting ? "acting" : "acted"})`;
            } else if (
                !isPast &&
                (combatant.abortSpentAbs === abs ||
                    (combatant.abortSpentAbs === null && combatant.abortAppliesAtAbs?.(abs)))
            ) {
                // The Phase an abort consumed stays visible but greyed, so the
                // table can see where the cost lands. Unrecorded aborts (bare
                // status toggles) grey every Phase while the status binds.
                row.css = `${row.css} hero-aborted-row`.trim();
                row.name = `${row.name} (aborted)`;
            } else if (!isPast && combat.haymakerConsumesPhaseAt?.(combatant, abs)) {
                // High-SPD Haymaker (6E2 69): the wind-up consumes this natural
                // Phase — visible but greyed, like an abort's spent Phase.
                // Cancelling the Haymaker brings the Phase straight back.
                row.css = `${row.css} hero-aborted-row`.trim();
                row.name = `${row.name} (Phase lost — Haymaker winds up)`;
            }

            // An elevated scoped-LR combatant acts early this segment only; the
            // shadow row marks where the rest of the Phase lands afterwards
            if (!group.lrShadow && combatant.lrElevatedAbs === abs) {
                row.css = `${row.css} hero-lr-row`.trim();
                row.name = `↯ ${row.name} (LR)`;
            } else if (group.lrShadow) {
                row.css = `${row.css} hero-lr-shadow`.trim();
                row.name = `${row.name} (rest of Phase)`;
                row.effects = { icons: [], tooltip: "" };
            }

            row.css = `${row.css} ${stateCss} ${memberClasses}`.trim();
            if (isCurrent && combatant.id === activeCombatantId && !group.lrShadow) {
                row.active = true;
                row.css = `${row.css} active`.trim();
            }

            timelineTurns.push(row);
        }
    }

    /**
     * Fresh mutable context row for a timeline entry: a clone of core's prepared
     * turn when one exists, else a minimal synthetic stand-in.
     * @param {Combatant|null} combatant - Live combatant backing the row, if any
     * @param {object|null|undefined} base - Core's prepared turn entry for the row, if any
     * @param {object} [options]
     * @param {object} [options.overrides] - Field overrides for the synthetic fallback
     * @param {boolean} [options.imgFallback] - Backfill row.img from the combatant
     * @returns {object}
     * @private
     */
    _baseRowFor(combatant, base, { overrides = {}, imgFallback = true } = {}) {
        const row = base
            ? { ...base }
            : {
                  ...(combatant
                      ? {
                            id: combatant.id,
                            _id: combatant.id,
                            name: combatant.name,
                            hidden: combatant.hidden,
                            defeated: combatant.isDefeated,
                        }
                      : {}),
                  css: "",
                  ...overrides,
              };
        if (imgFallback) {
            // || not ??: an import without an image stores "" which would
            // otherwise render as a broken <img> showing its alt text (#2657)
            row.img = row.img || combatant.img || combatant.actor?.img || "icons/svg/mystery-man.svg";
        }
        return row;
    }

    /**
     * Marks a synthetic row actorless: null token/actor getters keep core's
     * row-decoration helpers from treating it as a real combatant.
     * @param {object} row
     * @returns {object} The same row
     * @private
     */
    _markActorless(row) {
        Object.defineProperty(row, "token", { get: () => null, configurable: true, enumerable: true });
        Object.defineProperty(row, "actor", { get: () => null, configurable: true, enumerable: true });
        return row;
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
     * Core handlers are delegated from the tracker root, so event.currentTarget
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
        // Skip fake layout rows and missing documents
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

        // The Held Actions panel header toggles its expansion in place (no render:
        // a full re-render restores a stale scrollTop and yanks the list around)
        if (combatantId === "held-panel-header") {
            if (!this.viewed) return;
            const expand = row.classList.contains("segment-collapsed");
            this._setSegmentExpansion(this.viewed.id, "held", expand);
            row.classList.toggle("segment-collapsed", !expand);
            row.classList.toggle("segment-expanded", expand);
            row.closest(".combat-tracker")
                ?.querySelector(".hero-held-scroll-wrapper")
                ?.classList.toggle("hero-held-collapsed", !expand);
            return;
        }

        // Segment headers toggle their expansion in place; the current segment is
        // always expanded. Member rows carry hero-seg-abs-<abs> linkage classes so
        // the flip animates via CSS without a re-render.
        if (combatantId.startsWith("seg-header-")) {
            if (!this.viewed || row.classList.contains("active-segment-header-slot")) return;
            const parts = combatantId.split("-");
            const segment = parseInt(parts.at(-1));
            const round = parseInt(parts.at(-2));
            if (Number.isNaN(segment) || Number.isNaN(round)) return;
            const expand = row.classList.contains("segment-collapsed");
            const abs = absoluteSegment(round, segment);
            // Keyed by ABSOLUTE segment: a bare number would alias this Turn's
            // passed header with next Turn's future one
            this._setSegmentExpansion(this.viewed.id, abs, expand);
            row.classList.toggle("segment-collapsed", !expand);
            row.classList.toggle("segment-expanded", expand);
            row.closest(".combat-tracker")
                ?.querySelectorAll(`.hero-seg-abs-${abs}`)
                .forEach((li) => li.classList.toggle("segment-member-hidden", !expand));
            return;
        }

        // Synthetic rows have no combatant to click, pan, or ping
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

        // A token on another scene level has no canvas object, so core's
        // control-and-pan silently does nothing — view its level first
        if (event.type !== "dblclick") {
            const levelSwitch = this._viewCombatantLevel(this.viewed.combatants.get(combatantId));
            if (levelSwitch) return levelSwitch.then(() => super._onCombatantMouseDown(event, row));
        }

        return super._onCombatantMouseDown(event, row);
    }

    /**
     * Switches the canvas to the level the combatant's token occupies.
     * @param {Combatant} combatant
     * @returns {Promise<Scene>|null} The view change, or null when none is needed
     * @protected
     */
    _viewCombatantLevel(combatant) {
        const levelId = combatant?.token?._source?.level;
        if (!levelId || !canvas.ready || combatant.sceneId !== canvas.scene?.id) return null;
        if (canvas.level?.id === levelId || !canvas.scene.levels?.get(levelId)) return null;
        return canvas.scene.view({ level: levelId });
    }

    /** @override */
    async _onPanToCombatant(combatant) {
        await this._viewCombatantLevel(combatant);
        return super._onPanToCombatant(combatant);
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
        // Key on the tie-roll key, not the raw actorId: combatants deliberately
        // split out of the group carry a solo key and must not be swept along
        const combat = this.viewed;
        if (typeof combat._tieRollKey === "function") {
            const key = combat._tieRollKey(representative);
            return combat.combatants.filter((c) => combat._tieRollKey(c) === key);
        }
        const key = representative.actorId || representative.id;
        return combat.combatants.filter((c) => (c.actorId || c.id) === key);
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
     * Whether same-actor grouping is enabled world-wide; the split/rejoin
     * context options are meaningless (and hidden) without it.
     * @returns {boolean}
     * @private
     */
    _groupingEnabled() {
        try {
            return !!game.settings.get(game.system.id, "combatTrackerGrouping");
        } catch (e) {
            void e; // setting not registered yet
            return true;
        }
    }

    /**
     * Adds Hold/Abort entries to the row context menu and guards every entry against
     * the tracker's synthetic rows (segment headers, group summaries, the held panel).
     * @override
     */
    _getEntryContextOptions() {
        // HERO rolls no initiative in this tracker (priorities derive from DEX +
        // the per-segment tie rolls), so core's Clear/Reroll Initiative entries
        // could only corrupt the derived values
        const coreInitiativeOptions = new Set(["COMBATANT.ACTIONS.Clear", "COMBATANT.ACTIONS.Reroll"]);
        const options = super._getEntryContextOptions().filter((option) => !coreInitiativeOptions.has(option.label));
        const getCombatant = (li) => this.viewed?.combatants.get(li.dataset?.combatantId) ?? null;

        for (const option of options) {
            const visible = option.visible;
            // Core entries (Update, Remove…) act on the representative only, which
            // is misleading on a ×N group summary row — hide them there
            option.visible = (li) =>
                !li.classList.contains("hero-group-row") &&
                !!getCombatant(li) &&
                (typeof visible === "function" ? visible.call(this, li) : (visible ?? true));
        }

        options.push(
            {
                label: "Hold Action…",
                icon: "fa-solid fa-hourglass-half",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    // Holds are declared on the character's own Phase; declaring out
                    // of turn would let the banked Phase land earlier than it should.
                    // The GM is exempt for NPC bookkeeping.
                    return (
                        !!combatant?.isOwner &&
                        !!this.viewed?.started &&
                        !combatant.heldAction &&
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
                    return !!combatant?.isOwner && !!combatant.heldAction;
                },
                onClick: (event, li) => this._onUseHeldAction(li.dataset.combatantId),
            },
            {
                label: "Re-declare Hold…",
                icon: "fa-solid fa-hourglass-half",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    if (!combatant?.isOwner || !combatant.heldAction) return false;
                    // The banked Phase can be re-pointed when its moment arrives: the
                    // pointer is on the holder (held-slot interrupt) or the hold waits
                    // in the panel; the GM may re-point at any time
                    if (game.user.isGM) return true;
                    return this.viewed?.combatant?.id === combatant.id || combatant.heldAction.mode !== "position";
                },
                onClick: (event, li) => this._onRedeclareHoldAction(li.dataset.combatantId),
            },
            {
                label: "Release Hold",
                icon: "fa-solid fa-hand",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!combatant.heldAction;
                },
                onClick: (event, li) => this._onReleaseHeldAction(li.dataset.combatantId),
            },
            {
                label: "Split from Group",
                icon: "fa-solid fa-arrow-right-from-bracket",
                visible: (li) => {
                    if (!game.user.isGM || !this._groupingEnabled()) return false;
                    // The ×N summary row represents the whole group — splitting "it"
                    // would really split whichever member's id the row carries.
                    // Explode the group and split individual members instead.
                    if (li.classList?.contains("hero-group-row")) return false;
                    const combatant = getCombatant(li);
                    if (!combatant || combatant.getFlag(game.system.id, "soloTieRoll")) return false;
                    // Only meaningful when a same-actor sibling exists to group with
                    return this.viewed.combatants.some(
                        (c) => c.id !== combatant.id && c.actorId && c.actorId === combatant.actorId,
                    );
                },
                onClick: (event, li) => this.viewed?.setCombatantSoloTieRoll?.(li.dataset.combatantId, true),
            },
            {
                label: "Split All from Group",
                icon: "fa-solid fa-arrows-split-up-and-left",
                visible: (li) => {
                    if (!game.user.isGM || !this._groupingEnabled()) return false;
                    const combatant = getCombatant(li);
                    if (!combatant?.actorId || combatant.getFlag(game.system.id, "soloTieRoll")) return false;
                    // Only for a genuine ×N group: two or more non-solo members
                    return (
                        this.viewed.combatants.filter(
                            (c) => c.actorId === combatant.actorId && !c.getFlag(game.system.id, "soloTieRoll"),
                        ).length > 1
                    );
                },
                onClick: (event, li) => {
                    const combat = this.viewed;
                    const combatant = combat?.combatants.get(li.dataset.combatantId);
                    if (!combatant?.actorId) return;
                    const ids = combat.combatants
                        .filter((c) => c.actorId === combatant.actorId && !c.getFlag(game.system.id, "soloTieRoll"))
                        .map((c) => c.id);
                    combat.setCombatantsSoloTieRoll?.(ids, true);
                },
            },
            {
                label: "Rejoin Group",
                icon: "fa-solid fa-arrow-right-to-bracket",
                visible: (li) => {
                    if (!game.user.isGM || !this._groupingEnabled()) return false;
                    return !!getCombatant(li)?.getFlag(game.system.id, "soloTieRoll");
                },
                onClick: (event, li) => this.viewed?.setCombatantSoloTieRoll?.(li.dataset.combatantId, false),
            },
            {
                label: "Rejoin All to Group",
                icon: "fa-solid fa-arrows-to-dot",
                visible: (li) => {
                    if (!game.user.isGM || !this._groupingEnabled()) return false;
                    const combatant = getCombatant(li);
                    if (!combatant?.actorId) return false;
                    // Meaningful once two or more members are split out
                    return (
                        this.viewed.combatants.filter(
                            (c) => c.actorId === combatant.actorId && c.getFlag(game.system.id, "soloTieRoll"),
                        ).length > 1
                    );
                },
                onClick: (event, li) => {
                    const combat = this.viewed;
                    const combatant = combat?.combatants.get(li.dataset.combatantId);
                    if (!combatant?.actorId) return;
                    const ids = combat.combatants
                        .filter((c) => c.actorId === combatant.actorId && c.getFlag(game.system.id, "soloTieRoll"))
                        .map((c) => c.id);
                    combat.setCombatantsSoloTieRoll?.(ids, false);
                },
            },
            {
                label: "Remove Group from Combat",
                icon: "fa-solid fa-users-slash",
                visible: (li) => {
                    if (!game.user.isGM) return false;
                    const combatant = getCombatant(li);
                    const combat = this.viewed;
                    if (!combatant || !combat?._tieRollKey) return false;
                    // Same membership rule the ×N display grouping uses; split-out
                    // (solo) members are their own group and keep the single remove
                    const key = combat._tieRollKey(combatant);
                    return combat.combatants.filter((c) => combat._tieRollKey(c) === key).length > 1;
                },
                onClick: async (event, li) => {
                    const combat = this.viewed;
                    const combatant = combat?.combatants.get(li.dataset.combatantId);
                    if (!combatant || !game.user.isGM) return;
                    const key = combat._tieRollKey(combatant);
                    const ids = combat.combatants.filter((c) => combat._tieRollKey(c) === key).map((c) => c.id);
                    await combat.deleteEmbeddedDocuments("Combatant", ids);
                },
            },
            {
                label: "Act Early (Lightning Reflexes)",
                icon: "fa-solid fa-bolt-lightning",
                visible: (li) => this.viewed?.lrElevationState(getCombatant(li)) === "available",
                onClick: (event, li) => this._onToggleLrElevation(li.dataset.combatantId),
            },
            {
                label: "Cancel Act Early (LR)",
                icon: "fa-solid fa-rotate-left",
                visible: (li) => this.viewed?.lrElevationState(getCombatant(li)) === "elevated",
                onClick: (event, li) => this._onToggleLrElevation(li.dataset.combatantId),
            },
            {
                label: "Abort…",
                icon: "fa-solid fa-shield-halved",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!this.viewed?.started && !combatant.abortEffect;
                },
                onClick: (event, li) => this._onAbortAction(li.dataset.combatantId),
            },
            {
                label: "Cancel Abort",
                icon: "fa-solid fa-rotate-left",
                visible: (li) => {
                    const combatant = getCombatant(li);
                    return !!combatant?.isOwner && !!combatant.abortEffect;
                },
                onClick: (event, li) => this._onCancelAbort(li.dataset.combatantId),
            },
        );

        return options;
    }

    /**
     * Resolves a handler's target combatant behind the shared ownership guard.
     * @param {string} combatantId
     * @param {object} [options]
     * @param {boolean} [options.requireStarted] - The combat must have started
     * @param {boolean} [options.requireActor] - The combatant must have an actor
     * @param {string|null} [options.requireEffect] - Combatant getter (e.g. "heldActionEffect") whose effect must exist
     * @returns {{combat: Combat, combatant: Combatant, actor: Actor|null, effect: ActiveEffect|null}|null}
     * @private
     */
    _resolveOwnedCombatant(combatantId, { requireStarted = false, requireActor = false, requireEffect = null } = {}) {
        const combat = this.viewed;
        const combatant = combat?.combatants.get(combatantId);
        if (!combatant?.isOwner) return null;
        if (requireStarted && !combat.started) return null;
        const actor = combatant.actor;
        if (requireActor && !actor) return null;
        const effect = requireEffect ? (combatant[requireEffect] ?? null) : null;
        if (requireEffect && !effect) return null;
        return { combat, combatant, actor, effect };
    }

    /**
     * Posts a hold-related chat card.
     * @param {Combatant} combatant
     * @param {string} content
     * @private
     */
    _holdCard(combatant, content) {
        // The engine owns the card policy (speaker, hidden-combatant GM whisper)
        return this.viewed?._combatCard?.(combatant, content);
    }

    /**
     * The shared Hold Action dialog: a position (segment + DEX, only legal
     * segments offered per the null zone), an event trigger, or a
     * generic hold. A decimal DEX (e.g. 13.12) pins the exact tie-break position;
     * whole numbers keep the segment's random tie-break roll.
     * @param {Combatant} combatant
     * @param {object} [options]
     * @param {string} [options.title] - Dialog title prefix
     * @param {object} [options.initial] - Existing hold to prefill (re-declare)
     * @returns {Promise<{mode: string, segmentAbs?: number, dex?: number, fraction?: number,
     *                    trigger?: string}|null>}
     * @private
     */
    async _holdDeclarationDialog(combatant, { title = "Hold Action", initial = null } = {}) {
        const combat = this.viewed;
        const actor = combatant.actor;
        const currentAbs = absoluteSegment(combat.round, combat.segment);
        const characteristicKey = actor.system?.initiativeCharacteristic ?? "dex";
        const ownDex = actor.system?.characteristics?.[characteristicKey]?.value ?? 10;
        // Only unrestricted All Actions LR raises the holding position — holding is
        // not the scoped action a restricted purchase was bought for
        const actingDex = ownDex + (combatant.lightningReflexes?.always ?? 0);
        // Same-segment holds must slot below the position the count has reached
        const actingThreshold = combat.getFlag(game.system.id, "actingPriority") ?? actingDex;

        // Legal window: from now up to (not including) the segment of the next natural
        // Phase — a Held Action is lost the moment that segment begins (null zone)
        const spd = combatant.combatSpd;
        const nextNaturalAbs = spd > 0 ? HeroSystem6eCombatantSingle.nextPhaseAbs(spd, currentAbs + 1) : currentAbs;
        const segmentChoices = [];
        for (let abs = currentAbs; abs < nextNaturalAbs; abs++) {
            const segment = segmentOf(abs);
            const round = roundOf(abs);
            segmentChoices.push({
                abs,
                label: `Segment ${segment}${round === combat.round ? "" : ` (Turn ${round})`}`,
            });
        }

        const defaultDexValue =
            initial?.mode === "position" && initial.dex !== undefined
                ? initial.fraction !== undefined
                    ? (initial.dex + initial.fraction).toFixed(2)
                    : String(initial.dex)
                : String(Math.max(0, ownDex - 1));
        const initialSegmentAbs = initial?.mode === "position" ? initial.segmentAbs : null;
        // Two branches only: "generic" is the event branch with a blank trigger
        const preferredMode = initial?.mode ?? (segmentChoices.length ? "position" : "event");
        const checkedMode = preferredMode === "position" && segmentChoices.length ? "position" : "event";

        const { escapeHTML } = foundry.utils;

        // The one predicate for both the anchor dropdown and the submit
        // validation: has the anchor's stop in the CURRENT segment already
        // passed the acting count? "after" tolerates an equal-priority anchor
        // the tie order places after the holder (re-admission still reaches the
        // slot); "before" needs the anchor strictly below the count.
        const anchorStopPassed = (target, relation, priority) => {
            priority ??= combat.getInitiativePriority(target, segmentOf(currentAbs), { queryAbs: currentAbs });
            if (priority > actingThreshold) return true;
            if (priority < actingThreshold) return false;
            if (relation === "before") return true;
            return combat.tieBreakOrder(target, combatant, currentAbs) <= 0;
        };

        // Anchored reentry ("act right after X") tracks the anchor's live position; a
        // numeric DEX cannot, because tie-break fractions re-roll every segment (#4602).
        // Eligible anchors per candidate segment: only combatants who actually receive
        // a stop there (natural Phase or held slot; defeated/aborted/spent excluded)
        // that is still reachable, ordered by acting position.
        const anchorChoicesByAbs = {};
        for (const choice of segmentChoices) {
            const segment = segmentOf(choice.abs);
            anchorChoicesByAbs[choice.abs] = combat.combatants.contents
                .filter((c) => c.id !== combatant.id && c.actor && (!c.hidden || game.user.isGM))
                .filter((c) => combat._takesTurnInSegment(c, segment, { queryAbs: choice.abs }))
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    priority: combat.getInitiativePriority(c, segment, { queryAbs: choice.abs }),
                    combatant: c,
                }))
                .filter(
                    (entry) => choice.abs !== currentAbs || !anchorStopPassed(entry.combatant, "after", entry.priority),
                )
                .sort((a, b) => b.priority - a.priority);
        }
        const anchorOptionsHTML = (abs, selectedId) =>
            (anchorChoicesByAbs[abs] ?? [])
                .map(
                    (entry) =>
                        `<option value="${entry.id}" ${entry.id === selectedId ? "selected" : ""}>${escapeHTML(entry.name)} (DEX ${Math.floor(entry.priority)})</option>`,
                )
                .join("");

        const selectedSegmentAbs = segmentChoices.some((c) => c.abs === initialSegmentAbs)
            ? initialSegmentAbs
            : (segmentChoices[0]?.abs ?? null);
        const initialAnchorId = initial?.mode === "position" ? (initial.anchor?.combatantId ?? null) : null;
        const initialRelation = initial?.anchor?.relation === "before" ? "before" : "after";
        // Anchoring is the friendlier default; only a redeclared numeric hold opens
        // on the DEX branch. An unanchorable segment flips to DEX at render time.
        const initialKind = initialAnchorId || initial?.mode !== "position" ? "anchor" : "dex";

        const positionOption = segmentChoices.length
            ? `<label class="hero-hold-mode"><input type="radio" name="hold-mode" value="position" ${checkedMode === "position" ? "checked" : ""}> A later spot in the turn order</label>
               <div class="hero-hold-branch" data-hold-branch="position">
                   <div class="form-group">
                       <label>Segment</label>
                       <select name="hold-segment">${segmentChoices
                           .map(
                               (choice) =>
                                   `<option value="${choice.abs}" ${choice.abs === initialSegmentAbs ? "selected" : ""}>${choice.label}</option>`,
                           )
                           .join("")}</select>
                   </div>
                   <div class="form-group">
                       <label><input type="radio" name="hold-position-kind" value="anchor" ${initialKind === "anchor" ? "checked" : ""}> Next to a combatant</label>
                       <div class="form-fields">
                           <select name="hold-anchor-relation">
                               <option value="after" ${initialRelation === "after" ? "selected" : ""}>Right after</option>
                               <option value="before" ${initialRelation === "before" ? "selected" : ""}>Right before</option>
                           </select>
                           <select name="hold-anchor">${anchorOptionsHTML(selectedSegmentAbs, initialAnchorId)}</select>
                       </div>
                   </div>
                   <div class="form-group">
                       <label><input type="radio" name="hold-position-kind" value="dex" ${initialKind === "dex" ? "checked" : ""}> At a DEX count</label>
                       <input type="number" name="hold-dex" value="${defaultDexValue}" min="0" max="99.99" step="0.01">
                   </div>
               </div>`
            : "";
        const content = `<fieldset class="hero-hold-dialog">
            <legend>Hold until</legend>
            ${positionOption}
            <label class="hero-hold-mode"><input type="radio" name="hold-mode" value="event" ${checkedMode === "event" ? "checked" : ""}> An event happens</label>
            <div class="hero-hold-branch" data-hold-branch="event">
                <div class="form-group">
                    <input type="text" name="hold-trigger" placeholder="e.g. the guard turns around" value="${escapeHTML(initial?.trigger ?? "")}">
                </div>
                <p class="hint">Leave the event blank for a generic hold — when you may act is the GM's call.</p>
            </div>
            <p class="hint">The Held Action is lost when the segment of your next natural Phase begins.</p>
        </fieldset>`;

        const result = await foundry.applications.api.DialogV2.wait({
            window: { title: `${title} — ${actor.name}` },
            content,
            // The unselected mode's whole branch hides (progressive disclosure);
            // within the position branch, DEX count and anchor are mutually
            // exclusive — the unchecked one's controls grey out — and the anchor
            // list re-filters per segment
            render: (event, dialog) => {
                const root = dialog.element;
                if (!root) return;
                const modeRadios = [...root.querySelectorAll('input[name="hold-mode"]')];
                const branches = [...root.querySelectorAll("[data-hold-branch]")];
                const syncBranches = () => {
                    const mode = modeRadios.find((r) => r.checked)?.value ?? "event";
                    for (const branch of branches) {
                        branch.classList.toggle("hero-hold-branch-hidden", branch.dataset.holdBranch !== mode);
                    }
                };
                for (const r of modeRadios) r.addEventListener("change", syncBranches);
                syncBranches();

                const segmentSelect = root.querySelector('select[name="hold-segment"]');
                const anchorSelect = root.querySelector('select[name="hold-anchor"]');
                if (!segmentSelect || !anchorSelect) return;
                const dexInput = root.querySelector('input[name="hold-dex"]');
                const kindRadios = [...root.querySelectorAll('input[name="hold-position-kind"]')];
                const relationSelect = root.querySelector('select[name="hold-anchor-relation"]');
                const syncControls = () => {
                    const kind = kindRadios.find((r) => r.checked)?.value ?? "dex";
                    if (dexInput) dexInput.disabled = kind !== "dex";
                    anchorSelect.disabled = kind !== "anchor";
                    if (relationSelect) relationSelect.disabled = kind !== "anchor";
                };
                const rebuildAnchors = () => {
                    const prior = anchorSelect.value;
                    anchorSelect.innerHTML = anchorOptionsHTML(parseInt(segmentSelect.value), prior || initialAnchorId);
                    // A segment nobody acts in cannot be anchored
                    const anchorKind = kindRadios.find((r) => r.value === "anchor");
                    const dexKind = kindRadios.find((r) => r.value === "dex");
                    if (anchorKind) {
                        anchorKind.disabled = !anchorSelect.options.length;
                        if (anchorKind.disabled && anchorKind.checked && dexKind) dexKind.checked = true;
                    }
                    syncControls();
                };
                segmentSelect.addEventListener("change", rebuildAnchors);
                for (const r of kindRadios) r.addEventListener("change", syncControls);
                rebuildAnchors();
            },
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
                            positionKind: form["hold-position-kind"]?.value ?? "dex",
                            dexRaw: parseFloat(form["hold-dex"]?.value),
                            anchorId: form["hold-anchor"]?.value || null,
                            relation: form["hold-anchor-relation"]?.value ?? "after",
                            trigger: form["hold-trigger"]?.value.trim() ?? "",
                        };
                    },
                },
                { action: "cancel", label: "Cancel" },
            ],
            rejectClose: false,
        });
        if (!result || result === "cancel") return null;

        if (result.mode === "position") {
            const segmentAbs = Number.isFinite(result.segmentAbs) ? result.segmentAbs : currentAbs;
            if (result.positionKind === "anchor") {
                const anchorTarget = result.anchorId ? combat.combatants.get(result.anchorId) : null;
                if (!anchorTarget) {
                    ui.notifications.warn(`Select a combatant to hold next to.`);
                    return null;
                }
                const segment = segmentOf(segmentAbs);
                const targetPriority = combat.getInitiativePriority(anchorTarget, segment, { queryAbs: segmentAbs });
                if (!(targetPriority > 0)) {
                    ui.notifications.warn(
                        `${anchorTarget.name} has no Phase or held position in ${phaseLabel(segmentAbs)}.`,
                    );
                    return null;
                }
                const relation = result.relation === "before" ? "before" : "after";
                if (segmentAbs === currentAbs && anchorStopPassed(anchorTarget, relation, targetPriority)) {
                    ui.notifications.warn(
                        `${anchorTarget.name}'s acting position has already passed this Segment — hold next to them in a later Segment instead.`,
                    );
                    return null;
                }
                return {
                    mode: "position",
                    segmentAbs,
                    // Declaration-time snapshot: the fallback acting position should
                    // the anchor later vanish from the segment
                    dex: Math.floor(targetPriority),
                    anchor: { combatantId: anchorTarget.id, relation, name: anchorTarget.name },
                };
            }
            const dexRaw = Number.isFinite(result.dexRaw) ? result.dexRaw : Math.max(0, ownDex - 1);
            const dex = Math.floor(dexRaw);
            const fraction = Number.isInteger(dexRaw) ? undefined : Math.round((dexRaw - dex) * 100) / 100;
            // An integer entry is judged pessimistically: its random fraction could
            // land anywhere below the next whole DEX
            const effective = dex + (fraction ?? 1);
            if (segmentAbs === currentAbs && effective >= actingThreshold) {
                ui.notifications.warn(
                    `A same-segment hold must slot below the current acting position (${actingThreshold.toFixed(2)}).`,
                );
                return null;
            }
            return { mode: "position", segmentAbs, dex, ...(fraction !== undefined ? { fraction } : {}) };
        }
        // A blank event IS the generic hold — the dialog no longer offers a
        // separate "generic" choice
        return result.trigger ? { mode: "event", trigger: result.trigger } : { mode: "generic" };
    }

    /**
     * Human-readable clause for a hold declaration's target ("until DEX 13.12 in
     * Segment 4", "until right after Grond in Segment 4", "— until: the guard
     * turns around").
     * @param {object} hold
     * @returns {string}
     * @private
     */
    _holdDescription(hold) {
        if (hold.mode === "position") {
            const where = phaseLabel(hold.segmentAbs);
            if (hold.anchor) {
                const relation = hold.anchor.relation === "before" ? "before" : "after";
                return `until right ${relation} ${hold.anchor.name ?? "their anchor"} in ${where}`;
            }
            return `until DEX ${hold.fraction !== undefined ? (hold.dex + hold.fraction).toFixed(2) : hold.dex} in ${where}`;
        }
        if (hold.mode === "event") return hold.trigger ? `— until: ${hold.trigger}` : "until a declared event";
        return "with no declared condition";
    }

    /**
     * Declares a fresh Held Action for the combatant and ends their turn.
     * @param {string} combatantId
     * @protected
     */
    async _onDeclareHoldAction(combatantId) {
        const resolved = this._resolveOwnedCombatant(combatantId, { requireStarted: true, requireActor: true });
        if (!resolved) return;
        const { combat, combatant, actor } = resolved;
        if (combatant.heldAction) return;
        const blocked = combat.blockedActionReason(combatant);
        if (blocked) return void ui.notifications.warn(blocked);
        // Holds are declared on the character's own Phase; the GM may backfill
        if (!game.user.isGM && combat.combatant?.id !== combatant.id) {
            return void ui.notifications.warn(`Held Actions are declared on the character's own Phase.`);
        }
        // One banked Phase, ever: a combatant who already used this Segment's
        // action cannot bank another
        if (combat.actedThisSegment(combatant)) {
            if (!game.user.isGM) {
                return void ui.notifications.warn(
                    `${actor.name} has already acted this Segment and cannot declare a Held Action.`,
                );
            }
            const proceed = await foundry.applications.api.DialogV2.confirm({
                window: { title: `Hold Action — ${actor.name}` },
                content: `<p>${actor.name} has already acted this Segment. Declare a Held Action anyway?</p>`,
                rejectClose: false,
            });
            if (!proceed) return;
        }

        const currentAbs = absoluteSegment(combat.round, combat.segment);
        const choice = await this._holdDeclarationDialog(combatant);
        if (!choice) return;

        const hold = {
            ...choice,
            declaredAbs: currentAbs,
            id: foundry.utils.randomID(),
            combatantId: combatant.id,
        };
        const description = this._holdDescription(hold);

        await this._applyHoldingEffect(combatant, hold);
        await this._holdCard(
            combatant,
            `${actor.name} holds their action ${description} (declared in ${phaseLabel(currentAbs)}).`,
        );
        await combat.logEvent("hold.declare", {
            combatant,
            data: {
                mode: hold.mode,
                segmentAbs: hold.segmentAbs ?? null,
                dex: hold.dex ?? null,
                fraction: hold.fraction ?? null,
                anchor: hold.anchor ?? null,
                trigger: hold.trigger ?? null,
            },
        });

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
     * Re-declares an existing Held Action in place — the banked Phase moves to a new
     * position/condition without being spent and without granting a new Phase. The
     * null-zone window is recomputed from the current position; declaredAbs is
     * refreshed so the hold expires relative to the re-declaration.
     * @param {string} combatantId
     * @protected
     */
    async _onRedeclareHoldAction(combatantId) {
        const resolved = this._resolveOwnedCombatant(combatantId, {
            requireStarted: true,
            requireEffect: "heldActionEffect",
        });
        if (!resolved) return;
        const { combat, combatant, effect } = resolved;
        const blocked = combat.blockedActionReason(combatant);
        if (blocked) return void ui.notifications.warn(blocked);

        const currentAbs = absoluteSegment(combat.round, combat.segment);
        const existing = combatant.heldAction;
        const choice = await this._holdDeclarationDialog(combatant, {
            title: "Re-declare Hold",
            initial: existing,
        });
        if (!choice) return;

        const hold = {
            ...choice,
            declaredAbs: currentAbs,
            id: foundry.utils.randomID(),
            combatantId: combatant.id,
        };
        // Replace the flag wholesale in ONE write: setFlag merges (stale position
        // keys would survive a conversion to event/generic), and a delete-then-set
        // pair leaves a window where every client reads a bare generic hold
        await effect.update({
            [`flags.${game.system.id}.-=hold`]: null,
            [`flags.${game.system.id}.hold`]: hold,
        });

        const description = this._holdDescription(hold);
        await this._holdCard(
            combatant,
            `${combatant.actor.name} re-declares their Held Action ${description} (in ${phaseLabel(currentAbs)}).`,
        );
        await combat.logEvent("hold.redeclare", {
            combatant,
            data: {
                mode: hold.mode,
                segmentAbs: hold.segmentAbs ?? null,
                dex: hold.dex ?? null,
                fraction: hold.fraction ?? null,
                anchor: hold.anchor ?? null,
                trigger: hold.trigger ?? null,
            },
        });
    }

    /**
     * Creates the holding effect that carries a hold declaration.
     * @param {Combatant} combatant
     * @param {object} hold
     * @returns {Promise<ActiveEffect|null>}
     * @private
     */
    async _applyHoldingEffect(combatant, hold) {
        const effect = await this.viewed?.createStatusEffectFor(combatant.actor, "holding");
        if (effect) await effect.setFlag(game.system.id, "hold", hold);
        return effect;
    }

    /**
     * Consumes a Held Action: the holder acts right now, at whatever point in the
     * order the table has reached. The turn pointer is deliberately not moved.
     * @param {string} combatantId
     * @protected
     */
    async _onUseHeldAction(combatantId) {
        const resolved = this._resolveOwnedCombatant(combatantId, { requireEffect: "heldActionEffect" });
        if (!resolved) return;
        const { combat, combatant, actor, effect } = resolved;
        const blocked = combat.blockedActionReason(combatant);
        if (blocked) return void ui.notifications.warn(blocked);
        const hold = combatant.heldAction;
        await effect.delete();
        await combat.recordSpentAction(combatant, hold);
        await this._holdCard(
            combatant,
            `${actor.name} uses their Held Action in ${combat.currentPhaseLabel}.
            <div class="card-buttons">
                <button type="button" class="hero-timing-contest" data-combat-id="${combat.id}" data-combatant-id="${combatant.id}">
                    <i class="fa-solid fa-stopwatch"></i> Timing contest vs the current actor
                </button>
            </div>
            <p class="hint">Only if the Actions collide: defensive (abortable-to) Actions simply go first — no roll needed.</p>`,
        );
        await combat.logEvent("hold.use", { combatant, data: { mode: hold?.mode ?? null } });
    }

    /**
     * Drops a Held Action without acting.
     * @param {string} combatantId
     * @protected
     */
    async _onReleaseHeldAction(combatantId) {
        const resolved = this._resolveOwnedCombatant(combatantId, { requireEffect: "heldActionEffect" });
        if (!resolved) return;
        const { combatant, actor, effect } = resolved;
        const hold = combatant.heldAction;
        await effect.delete();
        // Releasing at the held slot still forfeits that position (the banked Phase is
        // gone); releasing anywhere else costs nothing — the natural Phase stays
        const combat = this.viewed;
        const releaseAbs = combat ? absoluteSegment(combat.round, combat.segment) : null;
        if (hold?.mode === "position" && hold.segmentAbs === releaseAbs) {
            await combat.recordSpentAction(combatant, hold);
        }
        await this._holdCard(
            combatant,
            `${actor.name} releases their Held Action without acting in ${this.viewed.currentPhaseLabel}.`,
        );
        await this.viewed.logEvent("hold.release", { combatant, data: { mode: hold?.mode ?? null } });
    }

    /**
     * UI entry point for the scoped Lightning Reflexes act-early toggle; the
     * state mutation lives on the combat engine (toggleLrElevation).
     * @param {string} combatantId
     * @protected
     */
    async _onToggleLrElevation(combatantId) {
        return this.viewed?.toggleLrElevation(combatantId);
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
        const resolved = this._resolveOwnedCombatant(combatantId, { requireStarted: true, requireActor: true });
        if (!resolved) return;
        const { combat, combatant, actor } = resolved;
        // Only a RECORDED abort blocks; a bare status gets adopted by the flow
        if (combatant.abortEffect?.getFlag(game.system.id, "abort")) return;

        const reason = combat.blockedAbortReason(combatant);
        if (reason && !game.user.isGM) return void ui.notifications.warn(reason);
        if (reason) {
            const proceed = await foundry.applications.api.DialogV2.confirm({
                window: { title: `Abort — ${actor.name}` },
                content: `<p>${reason}</p><p>Abort anyway?</p>`,
                rejectClose: false,
            });
            if (!proceed) return;
        }

        const holding = !!combatant.heldAction;
        let costLine;
        if (holding) {
            costLine = "The Held Action will be spent — no further Phase is lost.";
        } else if (combatant.combatSpd <= 0) {
            costLine = "No Phases on the Speed Chart — the GM adjudicates the cost.";
        } else {
            const { isActive, spentAbs, nextActAbs } = combat.abortCost(combatant);
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
        await combat.declareAbort(combatant, {
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
        const resolved = this._resolveOwnedCombatant(combatantId, { requireEffect: "abortEffect" });
        if (!resolved) return;
        const { combatant, effect } = resolved;
        await effect.delete();
        await this.viewed.logEvent("abort.cancel", { combatant });
    }
}

/**
 * Post-render decoration: header title, active-row highlight, injected controls.
 * Null-guarded throughout for unlinked V14 Quench test models.
 */
function decorateTrackerRender(app, html, _context, options) {
    // AppV2 fires renderCombatTracker for every subclass: the legacy tracker's
    // rows lack this tracker's classes, so touching them only strips state
    if (!(app instanceof HeroSystem6eCombatTrackerSingle)) return;
    const element = html;
    if (!element) return;
    // Scopes single-tracker-only CSS (e.g. hiding core's Roll All / Roll NPCs
    // buttons) to this app so it never leaks onto the legacy tracker.
    // BEFORE the started-guard: the buttons must stay hidden on an
    // un-started combat too
    element.classList.add("hero-single-tracker");

    // Per-client density preference (#3157); non-active rows shrink via CSS
    let compact = false;
    try {
        compact = !!game.settings.get(game.system.id, "combatTrackerCompact");
    } catch (e) {
        console.warn(`Unable to read the compact tracker setting`, e);
    }
    element.classList.toggle("hero-compact", compact);

    // Core marks row portraits loading="lazy"; every re-render recreates them
    // and they paint a frame late, flickering on busy trackers. The rows are
    // already on screen, so decode them eagerly and synchronously.
    for (const img of element.querySelectorAll("img.token-image")) {
        img.loading = "eager";
        img.decoding = "sync";
    }

    // Before the started-guard: the unstarted DEX preview gets tooltips too
    injectInitiativeTooltips(app, element);

    if (!app?.viewed || !app.viewed.started) return;

    const encounterTitle = element.querySelector(".combat-tracker-header .encounter-title");
    if (encounterTitle) {
        encounterTitle.textContent = `Turn=${app.viewed.round} Segment=${app.viewed.segment}.${app.viewed.turn}`;
    }

    autoScrollToActive(app, element, options);
    gatherHeldPanel(element);
    injectDelayedControls(app, element);
    markEffectIconsClickable(app, element);
    injectHoldControls(app, element);
    injectLrControls(app, element);
}

/**
 * Legacy-tracker-parity composition tooltip on each row's initiative value,
 * e.g. "14DEX 4SPD 2LR". Post-render decoration because core's tracker template
 * has no tooltip slot in its initiative markup. Scoped LR levels count only on
 * rows displaying an elevated position (hero-lr-row), never the Phase remainder.
 */
function injectInitiativeTooltips(app, element) {
    const combat = app.viewed;
    if (!combat) return;
    for (const li of element.querySelectorAll("li.combatant[data-combatant-id]")) {
        if (li.classList.contains("hero-history-row") || li.classList.contains("hero-delayed-row")) continue;
        const combatant = combat.combatants.get(li.dataset.combatantId);
        const actor = combatant?.actor;
        if (!actor) continue;
        const initiativeEl = li.querySelector(".token-initiative");
        if (!initiativeEl) continue;
        const charKey = actor.system?.initiativeCharacteristic || "dex";
        const charValue = actor.system?.characteristics?.[charKey]?.value ?? 0;
        const lr = combatant.lightningReflexes;
        let lrLevels = lr?.always ?? 0;
        if (li.classList.contains("hero-lr-row")) lrLevels += lr?.scoped?.levels ?? 0;
        const lrText = lrLevels > 0 ? ` ${lrLevels}LR` : "";
        initiativeEl.dataset.tooltip = `${charValue}${charKey.toUpperCase()} ${combatant.combatSpd}SPD${lrText}`;
    }
}

/** Clears core's active highlights, re-marks the acting row, and auto-scrolls it into view. */
function autoScrollToActive(app, element, options) {
    // Clear core's active highlights; the correct row is re-marked below
    element.querySelectorAll(".combatant.active").forEach((el) => {
        el.classList.remove("active");
    });

    // Highlight only inside the current segment group; the exploded-group
    // summary row reuses the active member's id and must not match
    const activeId = app.viewed.combatant?.id;
    if (activeId) {
        // At a landing stop the acting "turn" is the delayed marker row, not the
        // declarer's (possibly greyed) natural-Phase row
        const delayedStopRow = app.viewed.atDelayedLandingStop
            ? element.querySelector(
                  `.current-segment-member.hero-delayed-row[data-combatant-id="${activeId}"], .current-segment-member.hero-delayed-row[data-id="${activeId}"]`,
              )
            : null;
        const activeRow =
            delayedStopRow ??
            element.querySelector(
                `.current-segment-member:not(.hero-group-parent):not(.hero-lr-shadow):not(.hero-lr-spent)[data-combatant-id="${activeId}"], .current-segment-member:not(.hero-group-parent):not(.hero-lr-shadow):not(.hero-lr-spent)[data-id="${activeId}"]`,
            );
        if (activeRow) {
            activeRow.classList.add("active");
            // Per-app guard: the sidebar and a popout are separate instances and
            // must each follow the fight. Scroll only on real combat updates —
            // or a window's very first render — never on cosmetic re-renders.
            const isCombatUpdate = options?.renderContext === "updateCombat";
            const firstRender = app._lastAutoScrolledId === undefined;
            if ((isCombatUpdate || firstRender) && app._lastAutoScrolledId !== activeId) {
                app._lastAutoScrolledId = activeId;
                // Pin the current segment header near the top of the viewport
                // (below the sticky held panel), keeping the acting row visible;
                // deep segments fall back to centering the acting row (#4556)
                const tracker = activeRow.closest(".combat-tracker");
                const headerRow = tracker?.querySelector(".active-segment-header-slot");
                if (tracker && headerRow) {
                    const stickyOffset =
                        (tracker.querySelector(".combatant.hero-held-panel-header")?.offsetHeight ?? 0) +
                        (tracker.querySelector(".hero-held-scroll-wrapper:not(.hero-held-collapsed)")?.offsetHeight ??
                            0);
                    const trackerRect = tracker.getBoundingClientRect();
                    const headerRect = headerRow.getBoundingClientRect();
                    const activeRect = activeRow.getBoundingClientRect();
                    if (activeRect.top - headerRect.top > tracker.clientHeight / 2) {
                        activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
                    } else {
                        const delta = headerRect.top - trackerRect.top - stickyOffset - 4;
                        tracker.scrollTo({ top: Math.max(0, tracker.scrollTop + delta), behavior: "smooth" });
                    }
                } else {
                    activeRow.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            }
        }
    }
}

/**
 * Gathers panel member rows into a pinned container beneath the header; the
 * container caps at 20vh and scrolls when more holders than that pile up.
 */
function gatherHeldPanel(element) {
    const panelHeaderRow = element.querySelector(".combatant.hero-held-panel-header");
    const panelMemberRows = element.querySelectorAll("li.combatant.hero-held-panel-member");
    if (panelHeaderRow && panelMemberRows.length > 0 && !element.querySelector(".hero-held-scroll-wrapper")) {
        const wrapper = document.createElement("li");
        wrapper.className = `hero-held-scroll-wrapper${
            panelHeaderRow.classList.contains("segment-collapsed") ? " hero-held-collapsed" : ""
        }`;
        const list = document.createElement("ol");
        list.className = "hero-held-scroll plain";
        wrapper.appendChild(list);
        panelHeaderRow.after(wrapper);
        panelMemberRows.forEach((li) => list.appendChild(li));
    }
}

/** Inline icon-button factory for injected row controls. */
function makeInlineControl(icon, tooltip, onClick) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = `inline-control combatant-control icon fa-solid ${icon}`;
    control.dataset.tooltip = tooltip;
    control.setAttribute("aria-label", tooltip);
    control.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        onClick();
    });
    return control;
}

/** Delayed-action markers: owners get inline Resolve-now / Cancel controls. */
function injectDelayedControls(app, element) {
    element.querySelectorAll("li.combatant.hero-delayed-row[data-combatant-id]").forEach((li) => {
        if (li.querySelector(".hero-delayed-controls")) return;
        const combatant = app.viewed.combatants.get(li.dataset.combatantId);
        if (!combatant?.isOwner) return;
        const delayedId = [...li.classList]
            .find((cls) => cls.startsWith("hero-delayed-id-"))
            ?.slice("hero-delayed-id-".length);
        if (!delayedId) return;
        const wrap = document.createElement("span");
        wrap.className = "hero-delayed-controls";
        wrap.append(
            makeInlineControl("fa-bolt", "Resolve now", () =>
                app.viewed.resolveDelayedActionNow?.(combatant.id, delayedId),
            ),
            makeInlineControl("fa-xmark", "Cancel (interrupted)", () =>
                app.viewed.cancelDelayedAction?.(combatant.id, delayedId),
            ),
        );
        li.appendChild(wrap);
    });
}

/** Owners can click condition icons to toggle them (prone → stand up, etc.). */
function markEffectIconsClickable(app, element) {
    element.querySelectorAll("li.combatant[data-combatant-id] .token-effects").forEach((container) => {
        const li = container.closest("li.combatant");
        const combatant = app.viewed.combatants.get(li?.dataset.combatantId);
        if (combatant?.isOwner && container.querySelector("img.token-effect")) {
            container.classList.add("hero-effects-clickable");
        }
    });
}

/**
 * Compact hold controls: panel rows show "⚡ <condition>" (the use control for
 * owners, a passive label otherwise); positional timeline rows get a plain ⚡.
 */
function injectHoldControls(app, element) {
    element.querySelectorAll("li.combatant.hero-held-row").forEach((li) => {
        const combatant = app.viewed.combatants.get(li.dataset.combatantId);
        if (!combatant?.heldAction) return;
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
}

/**
 * Lightning Reflexes: owners of scoped-LR combatants get an act-early
 * toggle on their current-segment row while the position is reachable.
 */
function injectLrControls(app, element) {
    element
        .querySelectorAll(
            "li.combatant.current-segment-member:not(.hero-group-parent):not(.hero-lr-shadow):not(.hero-lr-spent)",
        )
        .forEach((li) => {
            const combatant = app.viewed.combatants.get(li.dataset.combatantId);
            const state = app.viewed.lrElevationState?.(combatant);
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
}

/**
 * Timing-contest button on Held Action use cards: simultaneous Actions
 * are resolved by opposed characteristic rolls.
 */
function wireTimingContestButton(_message, html) {
    const button = html?.querySelector?.("button.hero-timing-contest");
    if (!button || button.dataset.heroContestWired) return;
    button.dataset.heroContestWired = "true";
    button.addEventListener("click", () => onTimingContest(button));
}

/**
 * Opposed timing contest for a simultaneous Held Action: the holder
 * contests the CURRENT combat actor — the one whose Action the
 * held interrupt collides with. Both sides make their characteristic roll
 * (DEX, or EGO for Mental Powers); the larger success margin acts first and
 * equal margins are simultaneous.
 * @param {HTMLButtonElement} button - The card button carrying combat/combatant ids
 */
async function onTimingContest(button) {
    const combat = game.combats.get(button.dataset.combatId);
    const holder = combat?.combatants.get(button.dataset.combatantId);
    if (!combat || !holder?.actor) {
        return void ui.notifications.warn(`The combat or the holding combatant no longer exists.`);
    }
    if (!game.user.isGM && !holder.isOwner) return;

    // The contest is against whoever is acting NOW; a held action used on the
    // holder's own turn collides with nobody
    const opponent = combat.combatant;
    if (!opponent?.actor || opponent.id === holder.id) {
        return void ui.notifications.warn(
            `No opposing current actor to contest — the timing contest applies when a Held Action collides with another combatant's Action.`,
        );
    }

    const { escapeHTML } = foundry.utils;
    const charOptions = ["dex", "ego"].map((key) => `<option value="${key}">${key.toUpperCase()}</option>`).join("");
    const content = `<fieldset>
            <legend>Simultaneous Actions — vs ${escapeHTML(opponent.name)}</legend>
            <div class="form-group">
                <label>${escapeHTML(holder.name)} rolls</label>
                <select name="holder-char">${charOptions}</select>
            </div>
            <div class="form-group">
                <label>${escapeHTML(opponent.name)} rolls</label>
                <select name="opponent-char">${charOptions}</select>
            </div>
            <p class="hint">Mental Powers contest EGO instead of DEX.</p>
        </fieldset>`;

    const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: `Timing Contest — ${holder.name} vs ${opponent.name}` },
        content,
        buttons: [
            {
                action: "roll",
                label: "Roll",
                default: true,
                callback: (event, btn) => ({
                    holderChar: btn.form.elements["holder-char"].value,
                    opponentChar: btn.form.elements["opponent-char"].value,
                }),
            },
            { action: "cancel", label: "Cancel" },
        ],
        rejectClose: false,
    });
    if (!choice || choice === "cancel") return;

    const rollSide = async (combatant, key) => {
        const characteristic = combatant.actor.system?.characteristics?.[key];
        const target = characteristic?.roll ?? Math.round(9 + (characteristic?.value ?? 10) / 5);
        const roll = await new Roll("3d6").evaluate();
        return { combatant, key, target, roll, margin: target - roll.total };
    };
    const holderSide = await rollSide(holder, choice.holderChar);
    const opponentSide = await rollSide(opponent, choice.opponentChar);

    const line = (side) =>
        `${escapeHTML(side.combatant.name)}: ${side.key.toUpperCase()} roll ${side.target}-, rolled ${side.roll.total} (${
            side.margin >= 0 ? `made it by ${side.margin}` : `missed by ${-side.margin}`
        })`;
    const verdict =
        holderSide.margin === opponentSide.margin
            ? `The Actions occur <b>simultaneously</b>.`
            : `<b>${escapeHTML(
                  (holderSide.margin > opponentSide.margin ? holderSide : opponentSide).combatant.name,
              )}</b> acts first.`;
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: holder.actor }),
        rolls: [holderSide.roll, opponentSide.roll].map((r) => r.toJSON()),
        content: `<p><b>Timing contest</b></p>
                <p>${line(holderSide)}</p>
                <p>${line(opponentSide)}</p>
                <p>${verdict}</p>
                <p class="hint">The roll-off loser cannot then Abort.</p>`,
    });
}

/**
 * A bare "aborted" status toggle (token HUD) routes into the real Abort
 * flow: the raw status is removed and the declaration dialog opens, so
 * the Phase cost, chat card, and ledger entry are all recorded.
 * Cancelling leaves the status off — the dialog IS the declaration.
 */
function routeBareStatusToggle(effect, _options, userId) {
    try {
        if (userId !== game.user.id) return;
        if (!effect.statuses?.has("aborted")) return;
        // Tracker-declared aborts carry the record; only raw toggles route
        if (effect.getFlag(game.system.id, "abort")) return;
        if (isQuenchTestRunning()) return;
        const tracker = ui.combat;
        if (!(tracker instanceof HeroSystem6eCombatTrackerSingle)) return;
        if (HeroSystem6eCombatSingle._abortFlowActive) return;
        const combat = tracker.viewed;
        if (!combat?.started) return;
        const actor = effect.parent;
        if (actor?.documentName !== "Actor") return;
        const combatant =
            combat.combatants.find((c) => c.actor === actor) ?? combat.combatants.find((c) => c.actorId === actor.id);
        if (!combatant?.isOwner) return;
        effect
            .delete()
            .then(() => tracker._onAbortAction(combatant.id))
            .catch((e) => console.error(e));
    } catch (e) {
        console.error(`Aborted-status toggle routing failed`, e);
    }
}

/**
 * Records WHEN a combatant was Knocked Out (absolute segment). The per-Phase
 * KO Recovery sweep needs it: RAW forbids a Recovery in the segment the
 * character was Knocked Out (6E2 108, 5ER 411). Runs on the client that
 * applied the status — it has owner rights on the actor's combatant.
 */
function stampKnockoutMoment(effect, _options, userId) {
    try {
        if (userId !== game.user.id) return;
        if (!effect.statuses?.has("knockedOut")) return;
        const actor = effect.parent;
        if (actor?.documentName !== "Actor") return;
        const active = activeSingleTrackerCombatFor(actor);
        if (!active) return;
        const { combat, combatant } = active;
        if (!combatant.isOwner) return;
        combatant
            .setFlag(game.system.id, "koStartAbs", combat.currentAbs)
            .catch((e) => console.error(`Knockout-moment stamp failed`, e));
    } catch (e) {
        console.error(`Knockout-moment stamp failed`, e);
    }
}

/**
 * A wound-up Haymaker fails outright when its attacker is Stunned or Knocked
 * Out before it lands (6E2 69; 5ER 389 — dying counts a fortiori). Runs on the
 * client that applied the status (that client has owner rights on the actor).
 * Extra Time interruption is explicitly GM discretion (6E1 375), so pending
 * non-Haymaker records prompt the GM instead of auto-cancelling.
 */
function cancelDelayedOnIncapacity(effect, _options, userId) {
    try {
        if (userId !== game.user.id) return;
        const statuses = effect.statuses;
        if (!statuses?.size) return;
        const incapacity = ["dead", "knockedOut", "stunned"].find((s) => statuses.has(s));
        if (!incapacity) return;
        const actor = effect.parent;
        if (actor?.documentName !== "Actor") return;
        const active = activeSingleTrackerCombatFor(actor);
        if (!active) return;
        const { combat, combatant } = active;
        if (!combatant.isOwner) return;
        const records = combat.delayedActionsFor(combatant);
        if (!records.length) return;

        const statusLabel = { dead: "killed", knockedOut: "Knocked Out", stunned: "Stunned" }[incapacity];
        const work = (async () => {
            for (const [id, record] of records) {
                if (record.kind !== "haymaker") continue;
                await combat._finishDelayedAction(combatant, id, record, {
                    cancelled: true,
                    reason: `${combatant.name} was ${statusLabel} before it landed`,
                });
            }
            // gmPrompted: an incapacitation arc (Stunned → KO'd → dead) creates a
            // fresh effect per step — one adjudication prompt per record is enough
            const discretionary = records.filter(([, r]) => r.kind !== "haymaker" && !r.gmPrompted);
            if (discretionary.length) {
                const labels = discretionary.map(([, r]) => r.label).join(", ");
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor }),
                    whisper: ChatMessage.getWhisperRecipients("GM"),
                    content: `${combatant.name} was ${statusLabel} while ${labels} is pending. Extra Time
                        interruption is the GM's call (6E1 375) — use the declaration card's Cancel button
                        if it stops (spent resources stay spent).`,
                });
                for (const [id] of discretionary) {
                    if (id === "legacy-haymaker") continue;
                    await combatant.setFlag(game.system.id, `delayedActions.${id}.gmPrompted`, true);
                }
            }
        })();
        work.catch((e) => console.error(`Incapacity-driven delayed-action cancel failed`, e));
    } catch (e) {
        console.error(`Incapacity-driven delayed-action cancel failed`, e);
    }
}

/**
 * Foundry builds Combat#turns during world init, BEFORE token actors
 * exist: priorities compute against null actors, the sort degenerates to
 * document order, and the stored turn index points at the wrong row
 * after a reload. Rebuild the cached turns once ready, on every client.
 */
function rebuildTurnsAtReady() {
    try {
        let rebuilt = false;
        for (const combat of game.combats ?? []) {
            if (combat instanceof HeroSystem6eCombatSingle && combat.started) {
                combat.setupTurns();
                rebuilt = true;
            }
        }
        if (rebuilt) ui.combat?.render();
    } catch (e) {
        console.error(`Post-ready combat turn rebuild failed`, e);
    }
}

/**
 * Injects the Hero System preferences into core's Combat Tracker Settings
 * dialog (#3157). The inputs persist immediately on change: core's submit
 * handler discards unknown form fields. World settings are shown only to
 * users who can modify them.
 */
function injectTrackerConfigFields(_app, html) {
    try {
        if (!(ui.combat instanceof HeroSystem6eCombatTrackerSingle)) return;
        const root = html;
        if (!root || root.querySelector(".hero-tracker-config")) return;

        const checkboxRow = (id, settingKey) => `
                    <div class="form-group">
                        <label for="${id}">${game.i18n.localize(`Settings.${settingKey}.Name`)}</label>
                        <div class="form-fields">
                            <input type="checkbox" id="${id}" data-setting-key="${settingKey}"
                                ${game.settings.get(game.system.id, settingKey) ? "checked" : ""}>
                        </div>
                        <p class="hint">${game.i18n.localize(`Settings.${settingKey}.Hint`)}</p>
                    </div>`;

        const fieldset = document.createElement("fieldset");
        fieldset.className = "hero-tracker-config";
        fieldset.innerHTML = `
                    <legend>Hero System</legend>
                    ${checkboxRow("hero-tracker-compact", "combatTrackerCompact")}
                    ${game.user.can("SETTINGS_MODIFY") ? checkboxRow("hero-tracker-grouping", "combatTrackerGrouping") : ""}`;
        for (const input of fieldset.querySelectorAll("input[data-setting-key]")) {
            input.addEventListener("change", (event) => {
                // Applies live: each setting's onChange re-renders the tracker
                game.settings
                    .set(game.system.id, event.target.dataset.settingKey, event.target.checked)
                    .catch((e) => console.error(e));
            });
        }

        const footer = root.querySelector("footer.form-footer, .form-footer");
        if (footer) footer.before(fieldset);
        else (root.querySelector("form") ?? root).append(fieldset);
    } catch (e) {
        console.error(`Unable to inject tracker preferences into the settings dialog`, e);
    }
}
