import { HeroSystem6eCombatantSingle } from "./combatant-single.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor/actor-active-effects.mjs";
import {
    endHaymakerManeuver,
    expireManeuverNextPhaseEffects,
    maneuverHasBlockTrait,
    maneuverHasDodgeTrait,
} from "./item/maneuver.mjs";
import { userInteractiveVerifyOptionallyPromptThenSpendResources } from "./item/item-resources.mjs";
import { rehydrateAttackItem } from "./item/item-attack.mjs";
import {
    expireEffects,
    forceDeleteKeys,
    gmActive,
    isQuenchTestRunning,
    toHHMMSS,
    whisperUserTargetsForActor,
} from "./utility/util.mjs";

const ROLL_RETENTION_SEGMENTS = 24; // two full Turns

const warnedSettingKeys = new Set();
/**
 * Reads a world setting, degrading to the fallback when it is not registered
 * (early init, isolated tests). Warns once per key so hot paths stay quiet.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function _getSetting(key, fallback) {
    try {
        return game.settings.get(game.system.id, key);
    } catch (e) {
        if (!warnedSettingKeys.has(key)) {
            warnedSettingKeys.add(key);
            console.warn(`Unable to read the "${key}" setting`, e);
        }
        return fallback;
    }
}

export class HeroSystem6eCombatSingle extends Combat {
    /** Latch: an abort declaration is in flight; read by the tracker's bare-status hook and maneuver.mjs. */
    static _abortFlowActive = false;

    /**
     * Current active Segment, read from database flags so every client agrees.
     * @type {number}
     */
    get segment() {
        if (!game.system?.id) return 12;
        if (!this.started) return 12;
        return this.getFlag(game.system.id, "currentSegment") ?? 12;
    }

    /**
     * Absolute segment of the current combat position (round * 12 + segment).
     * @type {number}
     */
    get currentAbs() {
        return HeroSystem6eCombatantSingle.absoluteSegment(this.round, this.segment);
    }

    /**
     * The current combat position for chat cards, e.g. "Segment 4 of Turn 2".
     * @type {string}
     */
    get currentPhaseLabel() {
        return HeroSystem6eCombatantSingle.phaseLabel(this.currentAbs);
    }

    /**
     * Acting-priority sentinel for the end-of-segment delayed-action landing
     * stop (Haymaker, Extra Segment): far below any real DEX so every combatant
     * outranks it and the stop always comes last in the segment.
     */
    static LANDING_STOP_PRIORITY = -999;

    /**
     * Whether the pointer currently sits on an end-of-segment landing stop.
     * @type {boolean}
     */
    get atDelayedLandingStop() {
        if (!game.system?.id || !this.started) return false;
        const priority = this.getFlag(game.system.id, "actingPriority");
        return (
            priority !== null && priority !== undefined && priority <= HeroSystem6eCombatSingle.LANDING_STOP_PRIORITY
        );
    }

    /* -------------------------------------------- */
    /*  Combat event ledger                         */
    /* -------------------------------------------- */

    /**
     * Append-only audit log of what happened in this combat, stored as an object
     * flag keyed by zero-padded sequence (`e000042`) so each append writes a single
     * flag path (tiny socket diffs) — a flag ARRAY would be replaced wholesale on
     * every write. Events are generic envelopes so the log can grow into a full
     * audit record (actions, damage, resources):
     *
     *   { t, abs, round, segment, ts, userId,
     *     combatantId?, actorId?, name?, img?, priority?,   // denormalized snapshot
     *     data? }
     *
     * The name/img/priority snapshot lets the tracker render history rows for
     * combatants that have since been removed. Rewinds APPEND a `rewind` event;
     * history is never deleted by turn flow — the log lives and dies with the
     * combat document (End Combat deletes it; a rewind past the start purges it).
     */

    /**
     * Whether this combat has recorded any ledger events.
     * @type {boolean}
     */
    get hasLedger() {
        const log = this.getFlag(game.system.id, "eventLog");
        return !!log && Object.keys(log).length > 0;
    }

    /**
     * Assembles a ledger event envelope at the current combat position.
     * @param {string} type - Namespaced event type, e.g. "hold.use"
     * @param {object} [options]
     * @param {Combatant} [options.combatant] - Subject; snapshots id/name/img/priority
     * @param {number} [options.priority] - Overrides the snapshotted priority
     * @param {object} [options.data] - Type-specific payload
     * @returns {object}
     */
    buildEvent(type, { combatant = null, priority = null, data = undefined, abs = null } = {}) {
        // Events describing a position being committed (pointer moves) pass the
        // TARGET abs; the document still reads the pre-update position here
        const eventAbs = abs ?? this.currentAbs;
        const event = {
            t: type,
            abs: eventAbs,
            round: HeroSystem6eCombatantSingle.roundOf(eventAbs),
            segment: HeroSystem6eCombatantSingle.segmentOf(eventAbs),
            ts: game.time.worldTime,
            userId: game.user.id,
        };
        if (combatant) {
            event.combatantId = combatant.id;
            event.actorId = combatant.actorId ?? null;
            event.name = combatant.name ?? combatant.actor?.name ?? null;
            event.img = combatant.img ?? combatant.actor?.img ?? null;
            if (combatant.hidden) event.hidden = true;
            event.priority = priority ?? this.getInitiativePriority(combatant, event.segment, { queryAbs: event.abs });
        } else if (priority !== null) {
            event.priority = priority;
        }
        if (data !== undefined) event.data = data;
        return event;
    }

    /**
     * Allocates monotonic event sequence numbers. The cursor rides ahead of the
     * persisted eventLogSeq flag so several payloads built before any of them
     * commit still get distinct keys (only the GM client writes the log).
     * @param {number} count
     * @returns {number} First allocated sequence number
     * @private
     */
    _allocateEventSeqs(count) {
        const persistedNext = this.getFlag(game.system.id, "eventLogSeq") ?? 0;
        this._eventSeqCursor = Math.max(this._eventSeqCursor ?? 0, persistedNext);
        const start = this._eventSeqCursor;
        this._eventSeqCursor += count;
        return start;
    }

    /**
     * Builds the flag-path fragment that appends the given events, for inlining
     * into an update payload that is being committed anyway (pointer moves) —
     * atomic with the move and no extra round-trips.
     * @param {object[]} events
     * @returns {Record<string, object|number>}
     */
    eventLogAppendPayload(events) {
        if (!events?.length) return {};
        const start = this._allocateEventSeqs(events.length);
        const payload = {};
        events.forEach((event, i) => {
            const seq = start + i;
            payload[`flags.${game.system.id}.eventLog.e${String(seq).padStart(6, "0")}`] = { seq, ...event };
        });
        payload[`flags.${game.system.id}.eventLogSeq`] = start + events.length;
        return payload;
    }

    /**
     * Appends events to the combat ledger. Non-GM clients relay through the GM
     * (players cannot write combat flags). The log is never pruned — it lives
     * and dies with the combat document (deleted on End Combat; purged by a
     * rewind past the start).
     * @param {object[]} events
     * @returns {Promise<void>}
     */
    async logEvents(events) {
        if (!events?.length) return;
        if (!game.user.isGM) {
            this._requestGmTurnAction("logCombatEvent", { events });
            return;
        }
        await this.update(this.eventLogAppendPayload(events));
    }

    /**
     * Appends a single event to the combat ledger.
     * @param {string} type
     * @param {object} [options] - See {@link buildEvent}
     * @returns {Promise<void>}
     */
    async logEvent(type, options = {}) {
        return this.logEvents([this.buildEvent(type, options)]);
    }

    /**
     * Reads ledger events, oldest first.
     * @param {object} [options]
     * @param {number} [options.fromAbs] - Only events at or after this absolute segment
     * @param {number} [options.toAbs] - Only events at or before this absolute segment
     * @param {string[]} [options.types] - Only these event types
     * @returns {object[]}
     */
    getEventLog({ fromAbs = null, toAbs = null, types = null } = {}) {
        const log = this.getFlag(game.system.id, "eventLog") ?? {};
        return Object.values(log)
            .filter((event) => {
                if (fromAbs !== null && (event.abs ?? 0) < fromAbs) return false;
                if (toAbs !== null && (event.abs ?? 0) > toAbs) return false;
                if (types && !types.includes(event.t)) return false;
                return true;
            })
            .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    }

    /**
     * What actually happened in a past segment, assembled from the ledger: one row
     * per acting combatant with the position they acted at, using the denormalized
     * snapshot so rows survive combatant deletion. Returns null when the ledger has
     * nothing for that segment (pre-ledger combats fall back to live computation).
     * @param {number} abs
     * @returns {{combatantId: string|null, actorId: string|null, name: string, img: string|null,
     *            priority: number, kind: string, detail: string|null}[]|null}
     */
    historyRowsForSegment(abs) {
        if (!this.hasLedger) return null;
        const rows = new Map();
        const kindRank = { acted: 0, haymaker: 1, "held-forfeit": 2, "held-used": 3, aborted: 4 };
        const addRow = (event, kind, { priority = null, detail = null } = {}) => {
            if (!event.combatantId && !event.actorId) return;
            const key = event.combatantId ?? event.actorId;
            const row = {
                combatantId: event.combatantId ?? null,
                actorId: event.actorId ?? null,
                name: event.name ?? "Unknown",
                img: event.img ?? null,
                hidden: !!event.hidden,
                priority: priority ?? event.priority ?? 0,
                kind,
                detail,
            };
            const existing = rows.get(key);
            if (!existing || (kindRank[kind] ?? 0) >= (kindRank[existing.kind] ?? 0)) rows.set(key, row);
        };

        let sawSegment = false;
        for (const event of this.getEventLog()) {
            const atAbs = event.abs === abs;
            if (atAbs) sawSegment = sawSegment || ["turn.start", "segment.start", "round.start"].includes(event.t);
            switch (event.t) {
                case "turn.start":
                    if (atAbs) addRow(event, "acted");
                    break;
                case "hold.use":
                    if (atAbs) addRow(event, "held-used");
                    break;
                case "hold.demote":
                case "hold.forfeit":
                case "hold.release":
                    if (atAbs) addRow(event, "held-forfeit");
                    break;
                case "abort.declare":
                    // The consumed Phase renders in the segment it was spent from;
                    // recompute a missing priority at the spent slot so the row
                    // keeps its DEX position
                    if (event.data?.spentAbs === abs) {
                        let priority = event.priority || null;
                        const live = priority ? null : this.combatants.get(event.combatantId);
                        if (live) {
                            priority = this.getInitiativePriority(live, HeroSystem6eCombatantSingle.segmentOf(abs), {
                                queryAbs: abs,
                            });
                        }
                        addRow(event, "aborted", { priority, detail: event.data?.toAction ?? null });
                    }
                    break;
                case "haymaker.resolve":
                    if (atAbs) addRow(event, "haymaker");
                    break;
            }
        }
        if (!sawSegment && rows.size === 0) return null;
        return [...rows.values()].sort((a, b) => b.priority - a.priority);
    }

    /**
     * Rolls a tie-break entry for one combatant: a 0-99 roll. With the Fast Draw
     * GM option on, the roll is dealt in bands — FAST_DRAW owners roll
     * 50-99, everyone else 0-49 — so owners always outrank non-owners at the same
     * DEX while still rolling off among themselves. Banding at roll time keeps
     * every fraction a plain two-decimal value; flipping the setting mid-combat
     * takes effect with the next segment's rolls.
     * @param {Combatant} combatant
     * @returns {{r: number}}
     * @protected
     */
    _rollTieBreak(combatant) {
        const fastDraw = !!_getSetting("fastDrawTieBreak", false);
        if (!fastDraw) return { r: Math.floor(Math.random() * 100) };
        const hasFastDraw = !!combatant.actor?.items.find((i) => i.system?.XMLID === "FAST_DRAW");
        return { r: (hasFastDraw ? 50 : 0) + Math.floor(Math.random() * 50) };
    }

    /**
     * Resolves a stored tie-break entry to the initiative fraction: r * 0.01, a
     * plain two-decimal value (Fast Draw banding happens at roll time). Legacy
     * entries carrying a packed fd sub-roll keep the original read-time
     * interpretation so in-flight combats preserve their recorded order; scalar
     * entries from even older combats read as plain rolls.
     * @param {{r: number, fd?: number|null}|number|undefined} rollEntry
     * @returns {number} 0..0.99
     * @protected
     */
    _tieBreakerFraction(rollEntry) {
        const entry = typeof rollEntry === "number" ? { r: rollEntry } : (rollEntry ?? { r: 50 });
        if (entry.fd !== undefined) {
            const fastDraw = !!_getSetting("fastDrawTieBreak", false);
            if (fastDraw) {
                if (entry.fd !== null) return 0.5 + entry.fd * 0.0049;
                return (entry.r ?? 50) * 0.0049;
            }
        }
        return (entry.r ?? 50) * 0.01;
    }

    /**
     * Rolls fresh tie-breaker entries for every combatant. Rolls are keyed by
     * root actor id so every token of the same base actor shares one roll and
     * therefore ties on the same DEX, letting the tracker group them.
     * @returns {Record<string, {r: number, fd: number|null}>}
     * @protected
     */
    _buildSegmentRollMap() {
        const newSegmentMap = {};
        for (const combatant of this.combatants) {
            const rollKey = this._tieRollKey(combatant);
            newSegmentMap[rollKey] ??= this._rollTieBreak(combatant);
            // Per-member sub-roll: members of a shared entry shuffle within the
            // group's position each segment
            (newSegmentMap[rollKey].m ??= {})[combatant.tokenId || combatant.id] ??= Math.floor(Math.random() * 100);
        }
        return newSegmentMap;
    }

    /**
     * A mutation-safe copy of the segmentRolls flag. Callers mutate and write
     * back; editing the live getFlag return in place corrupts Foundry's update
     * diffing.
     * @returns {object}
     * @private
     */
    _segmentRollsClone() {
        return foundry.utils.deepClone(this.getFlag(game.system.id, "segmentRolls") ?? {});
    }

    /**
     * Generates or fetches the tie-breaker roll map for an absolute segment. Maps
     * are keyed by ABSOLUTE segment so ties re-roll every Turn (tied characters
     * roll off per Segment) while rewinds within recorded history reuse the
     * original rolls.
     * @param {number|string} targetAbs - Absolute segment (round*12+segment)
     * @returns {Promise<Record<string, {r: number, fd: number|null}>>}
     * @protected
     */
    async _generateSegmentRollCache(targetAbs) {
        const masterRollsCache = this._segmentRollsClone();

        // Recorded rolls are reused so rewinds keep their original order
        if (masterRollsCache[targetAbs]) {
            return masterRollsCache[targetAbs];
        }

        const newSegmentMap = this._buildSegmentRollMap();

        masterRollsCache[targetAbs] = newSegmentMap;

        const payload = { [`flags.${game.system.id}.segmentRolls`]: masterRollsCache };
        if (this.started && game.user.isGM) {
            Object.assign(
                payload,
                this.eventLogAppendPayload([
                    this.buildEvent("tie.roll", {
                        abs: Number(targetAbs) || undefined,
                        data: { rolls: newSegmentMap },
                    }),
                ]),
            );
        }
        await this.update(payload);

        return newSegmentMap;
    }

    /**
     * Final sort tiebreak, stable across delete-and-re-add: combatant ids change on
     * re-creation, so equal-priority pairs would silently flip order. Token (or
     * actor) identity persists; the id compare stays only as the total-order
     * backstop for tokenless duplicates.
     * @param {Combatant} a
     * @param {Combatant} b
     * @returns {number}
     */
    static stableTiebreak(a, b) {
        const keyA = a.tokenId || a.actorId || a.id;
        const keyB = b.tokenId || b.actorId || b.id;
        return keyA.localeCompare(keyB) || a.id.localeCompare(b.id);
    }

    /**
     * The key a combatant's tie-break roll is stored under. Tokens of the same
     * base actor share one roll (and therefore group in the tracker) unless the
     * combatant has been split out of its group with the soloTieRoll flag, or
     * grouping is disabled world-wide via the combatTrackerGrouping setting.
     * @param {Combatant} combatant
     * @returns {string}
     */
    _tieRollKey(combatant) {
        if (game.system?.id && combatant.getFlag?.(game.system.id, "soloTieRoll")) {
            return `solo:${combatant.tokenId || combatant.id}`;
        }
        const grouping = !!_getSetting("combatTrackerGrouping", true);
        if (!grouping) return `solo:${combatant.tokenId || combatant.id}`;
        return combatant.actorId || combatant.id;
    }

    /**
     * The combatant's per-member sub-roll within its shared roll entry, or null.
     * @param {Combatant} combatant
     * @param {object} rollsMap - One absolute segment's roll map
     * @returns {number|null}
     * @private
     */
    _memberSubRoll(combatant, rollsMap) {
        const entry = rollsMap?.[this._tieRollKey(combatant)];
        if (!entry || typeof entry === "number") return null;
        return entry.m?.[combatant.tokenId || combatant.id] ?? null;
    }

    /**
     * Equal-priority ordering. An anchored hold shares its anchor's exact scalar,
     * so adjacency is decided HERE: each side projects through its anchor chain
     * to an unanchored root, roots order by the normal tie rules, and same-root
     * pairs order by their offset chains ("before" sorts above the anchor,
     * "after" below). Projection keeps the comparator TRANSITIVE — every
     * combatant maps to one (root, offsets) key and keys compare
     * lexicographically, never mixing per-pair regimes.
     * @param {Combatant} a
     * @param {Combatant} b
     * @param {number|null} [queryAbs] - Position being ordered; defaults to current
     * @returns {number}
     */
    tieBreakOrder(a, b, queryAbs = null) {
        const abs = queryAbs ?? this.currentAbs;
        const projA = this._anchorProjection(a, abs);
        const projB = this._anchorProjection(b, abs);
        if (projA.root.id !== projB.root.id) return this._rootTieBreakOrder(projA.root, projB.root, abs);
        const depth = Math.max(projA.offsets.length, projB.offsets.length);
        for (let i = 0; i < depth; i++) {
            const offA = projA.offsets[i] ?? 0;
            const offB = projB.offsets[i] ?? 0;
            // Larger offsets act earlier: +1 = before the anchor, -1 = after
            if (offA !== offB) return offB - offA;
        }
        return HeroSystem6eCombatSingle.stableTiebreak(a, b);
    }

    /**
     * Projects a combatant to its adjacency root: while it carries an anchored
     * positional hold (live, or spent this segment) that genuinely resolves, it
     * compares AS its anchor, offset one step to the declared side. Offsets are
     * returned root-first so chains compare lexicographically — the anchor's
     * own position within ITS neighbourhood dominates the holder's.
     * @param {Combatant} combatant
     * @param {number} abs - Absolute segment being ordered
     * @returns {{root: Combatant, offsets: number[]}}
     * @private
     */
    _anchorProjection(combatant, abs) {
        const offsets = [];
        let current = combatant;
        const seen = new Set([current.id]);
        for (;;) {
            const hold = current.holdsPositionAtAbs?.(abs) ? current.heldAction : null;
            const spent = !hold && current.spentHoldAtAbs?.(abs) ? current.spentHoldPosition : null;
            const anchor = hold?.anchor ?? spent?.anchor ?? null;
            if (!anchor?.combatantId || seen.has(anchor.combatantId)) break;
            const target = this.combatants.get(anchor.combatantId);
            if (!target?.actor) break;
            // An unresolvable live anchor means the holder falls back to its
            // snapshot scalar — there is no adjacency to project
            if (hold && this.resolveHoldAnchorPriority(hold, abs) === null) break;
            offsets.push(anchor.relation === "before" ? 1 : -1);
            seen.add(anchor.combatantId);
            current = target;
        }
        return { root: current, offsets: offsets.reverse() };
    }

    /**
     * Equal-priority ordering between unanchored roots. Members sharing a roll
     * entry (a ×N group) shuffle per segment via their sub-rolls — the same
     * roll-off ungrouped tied combatants get — highest first; everything
     * else (and missing rolls) falls back to the re-add-stable identity compare.
     * @param {Combatant} a
     * @param {Combatant} b
     * @param {number} abs - Absolute segment being ordered
     * @returns {number}
     * @private
     */
    _rootTieBreakOrder(a, b, abs) {
        const keyA = this._tieRollKey(a);
        const keyB = this._tieRollKey(b);
        // Different roll groups tied on the same priority order by GROUP first,
        // keeping the comparator TRANSITIVE: mixing per-member sub-roll order
        // (inside a group) with identity order (against outsiders) would allow
        // sort cycles and bounce nextTurn's tie re-admission.
        if (keyA !== keyB) {
            return keyA.localeCompare(keyB) || HeroSystem6eCombatSingle.stableTiebreak(a, b);
        }
        const rollsFlag = this.getFlag(game.system.id, "segmentRolls") ?? {};
        const rollsMap = rollsFlag[abs] ?? rollsFlag[HeroSystem6eCombatantSingle.segmentOf(abs)] ?? {};
        // A missing sub-roll compares as -1 (below every real roll): comparing
        // rolls for some pairs but identity for others is intransitive — an
        // unbackfilled member could cycle the sort
        const subA = this._memberSubRoll(a, rollsMap) ?? -1;
        const subB = this._memberSubRoll(b, rollsMap) ?? -1;
        if (subA !== subB) return subB - subA;
        return HeroSystem6eCombatSingle.stableTiebreak(a, b);
    }

    /**
     * Ensures every combatant has a roll entry (and a member sub-roll) in every
     * recorded map — newcomers, split/rejoined members, and re-adds otherwise
     * sort at defaults. Mutates the passed cache.
     * @param {object} masterRollsCache
     * @param {Combatant[]|Collection} [combatants]
     * @returns {boolean} Whether anything was added
     * @private
     */
    _backfillTieRolls(masterRollsCache, combatants = this.combatants) {
        let dirty = false;
        for (const rollsMap of Object.values(masterRollsCache)) {
            if (typeof rollsMap !== "object" || rollsMap === null) continue;
            for (const combatant of combatants) {
                const rollKey = this._tieRollKey(combatant);
                let entry = rollsMap[rollKey];
                if (typeof entry === "number") continue; // legacy scalar: leave as-is
                if (entry === undefined) {
                    rollsMap[rollKey] = entry = this._rollTieBreak(combatant);
                    dirty = true;
                }
                const memberKey = combatant.tokenId || combatant.id;
                entry.m ??= {};
                if (entry.m[memberKey] === undefined) {
                    entry.m[memberKey] = Math.floor(Math.random() * 100);
                    dirty = true;
                }
            }
        }
        return dirty;
    }

    /**
     * Splits a combatant out of (or rejoins it to) its same-actor ×N group by
     * giving it an independent tie-break roll. GM bookkeeping: the backfill and
     * ledger writes are combat-flag updates players cannot commit.
     * @param {string} combatantId
     * @param {boolean} solo
     * @returns {Promise<void>}
     */
    async setCombatantSoloTieRoll(combatantId, solo) {
        return this.setCombatantsSoloTieRoll([combatantId], solo);
    }

    /**
     * Batched split/rejoin for several members at once (the context menu's
     * "Split All from Group"): one flag write, one roll backfill, one ledger
     * append, one pointer resync, and a single summary card instead of N of
     * everything.
     * @param {string[]} combatantIds
     * @param {boolean} solo
     * @returns {Promise<void>}
     */
    async setCombatantsSoloTieRoll(combatantIds, solo) {
        if (!game.user.isGM) return;
        const combatants = combatantIds.map((id) => this.combatants.get(id)).filter((c) => !!c);
        if (combatants.length === 0) return;

        await this.updateEmbeddedDocuments(
            "Combatant",
            combatants.map((c) => ({
                _id: c.id,
                [`flags.${game.system.id}.${solo ? "soloTieRoll" : "-=soloTieRoll"}`]: solo ? true : null,
            })),
        );

        if (!this.started) {
            this.collection.render();
            return;
        }

        // Backfill the members' (new) roll keys into every recorded map so they
        // don't sort at the +0.50 default
        const masterRollsCache = this._segmentRollsClone();
        const activeId = this.combatant?.id ?? null;
        const payload = {};
        if (this._backfillTieRolls(masterRollsCache, combatants)) {
            payload[`flags.${game.system.id}.segmentRolls`] = masterRollsCache;
        }
        Object.assign(
            payload,
            this.eventLogAppendPayload(
                combatants.map((combatant) => this.buildEvent(solo ? "group.split" : "group.rejoin", { combatant })),
            ),
        );
        await this.update(payload);

        // Mid-segment priority change: refresh changed initiatives and keep the
        // pointer on the active combatant (actingPriority deliberately untouched)
        const updates = this.combatants
            .map((c) => ({ _id: c.id, initiative: this.getInitiativePriority(c, this.segment) }))
            .filter((u) => this.combatants.get(u._id)?.initiative !== u.initiative);
        if (updates.length > 0) await this.updateEmbeddedDocuments("Combatant", updates);
        await this.resyncTurnPointer(activeId);
        const [first] = combatants;
        const groupLabel = `${first.actor?.name ?? first.name} ×${combatants.length}`;
        await this._combatCard(
            first,
            combatants.length === 1
                ? solo
                    ? `${first.name} acts separately from their group (own tie-break rolls).`
                    : `${first.name} rejoins their group.`
                : solo
                  ? `${groupLabel}: every member now acts separately (own tie-break rolls).`
                  : `${groupLabel}: members rejoin their group.`,
        );
    }

    /**
     * HERO rolls no initiative in this tracker: priorities derive from DEX + the
     * per-segment tie-break rolls. Core's roll paths (row d20, Roll All/NPCs,
     * macros, modules) would otherwise write the raw formula over them.
     * @override
     */
    async rollInitiative() {
        return this;
    }

    /** @override */
    async rollAll() {
        return this;
    }

    /** @override */
    async rollNPC() {
        return this;
    }

    /**
     * V14 combatant comparison hook.
     * @override
     */
    compareCombatants(a, b) {
        return this._sortCombatants(a, b, this);
    }

    /**
     * Sorting comparator behind compareCombatants, also used directly for
     * predicted-turns computations. Descending initiative priorities.
     * @param {Combatant} a
     * @param {Combatant} b
     * @param {Combat} [combatDoc]
     * @param {object} [options]
     * @param {number} [options.segment] - Explicit segment to sort under (defaults to the active segment)
     * @param {number} [options.queryAbs] - Exact absolute segment being scored
     * @override
     */
    _sortCombatants(a, b, combatDoc, { segment = null, queryAbs = null } = {}) {
        const parentCombat = combatDoc ?? this ?? a.combat;
        let currentSegment = 12;

        if (segment !== null) {
            currentSegment = segment;
        } else if (game.system?.id && parentCombat) {
            const isStarted = parentCombat.started ?? parentCombat.fields?.started ?? false;
            if (isStarted) {
                currentSegment = parentCombat.getFlag(game.system.id, "currentSegment") ?? 12;
            }
        }

        if (!parentCombat) return 0;

        // Segment eligibility sorts before priority so inactive combatants sink to
        // the bottom, keeping the turns array identical on every client
        const aEligible = a.occupiesSegment?.(currentSegment) ?? false;
        const bEligible = b.occupiesSegment?.(currentSegment) ?? false;

        if (aEligible !== bEligible) {
            return aEligible ? -1 : 1;
        }

        return parentCombat._comparePriority(a, b, parentCombat, currentSegment, { queryAbs });
    }

    /**
     * Compares the initiative priorities of two combatants dynamically.
     * Higher initiative scores take action first (descending order).
     * @param {Combatant} a - First combatant for comparison
     * @param {Combatant} b - Second combatant for comparison
     * @param {Combat} [combatDoc] - The parent combat document instance reference
     * @param {number} [targetSegment] - Optional future segment index context to evaluate under
     * @returns {number} Sorting weight integer
     * @protected
     */
    _comparePriority(a, b, combatDoc, targetSegment, { queryAbs = null } = {}) {
        const parentCombat = combatDoc ?? this ?? a.combat;
        if (!parentCombat) return 0;

        const priorityA = parentCombat.getInitiativePriority(a, targetSegment, { queryAbs });
        const priorityB = parentCombat.getInitiativePriority(b, targetSegment, { queryAbs });

        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Descending order (highest score acts first)
        }

        return parentCombat.tieBreakOrder
            ? parentCombat.tieBreakOrder(a, b, queryAbs)
            : HeroSystem6eCombatSingle.stableTiebreak(a, b);
    }

    /**
     * Recompiles the predicted sorted turns for a segment: pending initiative
     * updates are overlaid on prototype clones (Object.create keeps document
     * getters live while overriding initiative), then the shared
     * eligibility-then-priority sort is applied. Returns the sorted clones
     * unfiltered — callers apply their own occupiesSegment filter and findIndex.
     * @param {number} segment - Segment number (1-12) to predict for
     * @param {object} [options]
     * @param {number} [options.queryAbs] - Exact absolute segment being scored
     * @param {object[]} [options.initiativeUpdates] - Pending {_id, initiative} combatant updates
     * @returns {Combatant[]}
     * @private
     */
    _predictTurns(segment, { queryAbs = null, initiativeUpdates = null } = {}) {
        const initiativeById = new Map((initiativeUpdates ?? []).map((u) => [u._id, u]));
        const predicted = this.combatants.map((c) => {
            const match = initiativeById.get(c.id);
            const clone = Object.create(c);
            if (match) {
                Object.defineProperty(clone, "initiative", {
                    value: match.initiative,
                    writable: true,
                    configurable: true,
                });
            }
            return clone;
        });
        predicted.sort((a, b) => this._sortCombatants(a, b, this, { segment, queryAbs }));
        return predicted;
    }

    /**
     * Computes a combatant's decimal initiative priority.
     * @param {Combatant} combatant - The participant document to calculate priority for
     * @param {number} [targetSegment] - Optional segment window context (defaults to active segment)
     * @param {object} [options]
     * @param {boolean} [options.ignoreHold] - Score the natural Phase position even when a
     *   positional hold exists (used for the position a combatant just acted at)
     * @param {number} [options.queryAbs] - Exact absolute segment being scored. Segment
     *   numbers alias across Turns (the same number recurs every 12 segments), so
     *   callers scoring a position outside the current Turn must pass it; the default
     *   resolves to the first occurrence at or after the current combat position.
     * @param {Set<string>} [options._anchorSeen] - Internal: anchor ids already being
     *   resolved in this call chain (anchored-hold cycle guard)
     * @returns {number} Comprehensive decimal initiative priority score
     */
    getInitiativePriority(combatant, targetSegment, { ignoreHold = false, queryAbs = null, _anchorSeen = null } = {}) {
        if (!combatant?.actor) return 0;

        const parentCombat = combatant.combat ?? this;
        const activeSegment = targetSegment ?? parentCombat?.segment ?? 12;

        const combatSegment = parentCombat?.segment ?? activeSegment;
        const combatAbs = HeroSystem6eCombatantSingle.absoluteSegment(parentCombat?.round ?? 0, combatSegment);
        const scoredAbs = queryAbs ?? combatAbs + ((activeSegment - combatSegment + 12) % 12);

        // Aborted combatants keep their natural priority — the skip lives entirely in
        // _takesTurnInSegment. Turn is an index into the sorted array, and the
        // consumed Phase must render at its DEX position.

        const actorDoc = combatant.actor;
        const characteristicKey = actorDoc.system?.initiativeCharacteristic ?? "dex";
        const characteristicObj = actorDoc.system?.characteristics?.[characteristicKey];

        const baseScore = characteristicObj?.value ?? 10;

        // Lightning Reflexes raises effective DEX for acting order only.
        // Unrestricted All Actions levels always apply; scoped purchases (single action,
        // group, HTH/ranged — the character may only execute that action when acting
        // early) apply only while the combatant elevated themselves this segment.
        const lr = combatant.lightningReflexes ?? { always: 0, scoped: null };
        let lightningReflexesLevels = lr.always;
        if (lr.scoped && combatant.lrElevatedAbs === scoredAbs) {
            lightningReflexesLevels += lr.scoped.levels;
        }

        const spdObj = actorDoc.system?.characteristics?.spd;
        const resolvedSpd = spdObj?.value ?? 2;

        const hasPhase = combatant.hasPhaseInSegment ? combatant.hasPhaseInSegment(activeSegment, scoredAbs) : false;
        // A positional Held Action slots the combatant at their declared DEX in the declared
        // segment; event/generic holds occupy no initiative position (tracker panel instead).
        // A spent hold keeps the acted position for display sorting until the segment ends.
        const positionalHold = !ignoreHold && combatant.holdsPositionAtAbs?.(scoredAbs) ? combatant.heldAction : null;
        const spentHold = combatant.spentHoldAtAbs?.(scoredAbs) ? combatant.spentHoldPosition : null;

        if (resolvedSpd <= 0 || (!hasPhase && !positionalHold && !spentHold)) {
            return 0;
        }

        // Maps are keyed by absolute segment; segment-number keys are the legacy
        // shape from in-flight combats and read as a fallback
        const rollsFlag = (parentCombat ? parentCombat.getFlag(game.system.id, "segmentRolls") : null) ?? {};
        const segmentRolls = rollsFlag[scoredAbs] ?? rollsFlag[activeSegment] ?? {};
        // Rolls are keyed by root actor id (or a solo key for split members); fall
        // back to combatant id for pre-existing combats
        const rollKey = (parentCombat ?? this)._tieRollKey?.(combatant) ?? (combatant.actorId || combatant.id);
        const tieBreakerEntry =
            segmentRolls[rollKey] ?? segmentRolls[combatant.actorId || combatant.id] ?? segmentRolls[combatant.id];
        const tieBreakerFraction = this._tieBreakerFraction(tieBreakerEntry);

        if (positionalHold) {
            // An anchored hold tracks its anchor's LIVE position — whatever tie-break
            // roll, LR elevation, or hold of their own the anchor ends up with —
            // instead of a number guessed at declaration (#4602)
            if (positionalHold.anchor) {
                const anchored = this.resolveHoldAnchorPriority(positionalHold, scoredAbs, _anchorSeen ?? new Set());
                if (anchored !== null) return anchored;
            }
            // The declared DEX is the exact acting position: LR and maneuver offsets
            // don't move it, and an explicitly declared decimal pins the tie-break
            return (positionalHold.dex ?? baseScore) + (positionalHold.fraction ?? tieBreakerFraction);
        }
        if (spentHold) {
            return (spentHold.dex ?? baseScore) + (spentHold.fraction ?? tieBreakerFraction);
        }

        // A Haymaker does not move the character's DEX position (the wind-up
        // resolves at the end of the next Segment; see the haymaker combatant flag)
        return baseScore + lightningReflexesLevels + tieBreakerFraction;
    }

    /**
     * Resolves a positional hold anchored to another combatant ("act right after X"
     * — a holding character chooses their reentry point exactly) to the
     * anchor's own live priority in the scored segment. The holder shares the
     * anchor's EXACT scalar — which side of the anchor they act on is an ordering
     * fact, decided by {@link tieBreakOrder}'s anchor projection, not a sub-decimal
     * offset. Returns null when the anchor cannot be resolved — combatant gone, no
     * Phase or held slot in that segment, or an anchor cycle — and the caller falls
     * back to the declaration-time DEX snapshot.
     * @param {{anchor?: {combatantId: string, relation?: string}}} hold
     * @param {number} scoredAbs - Absolute segment the hold is being scored at
     * @param {Set<string>} [seen] - Anchor ids already being resolved (cycle guard)
     * @returns {number|null}
     */
    resolveHoldAnchorPriority(hold, scoredAbs, seen = new Set()) {
        const anchorId = hold?.anchor?.combatantId;
        if (!anchorId || seen.has(anchorId)) return null;
        const target = this.combatants.get(anchorId);
        if (!target?.actor) return null;
        seen.add(anchorId);
        const segment = HeroSystem6eCombatantSingle.segmentOf(scoredAbs);
        const priority = this.getInitiativePriority(target, segment, { queryAbs: scoredAbs, _anchorSeen: seen });
        return priority > 0 ? priority : null;
    }

    /**
     * Whether a combatant actually receives a turn in the given segment: they must have
     * a Phase there (or a positional Held Action declared for it), must not be skipped
     * as defeated when the core tracker's Skip Defeated setting is on, and must not have
     * aborted their Phase. Event/generic holds receive no turn; they act on demand via
     * the tracker's Held Actions panel.
     * @param {Combatant} combatant
     * @param {number} segment
     * @param {object} [options]
     * @param {boolean} [options.ignoreAbort] - Treat a lingering aborted status as spent
     *   because the aborted Phase already passed earlier in the same advance
     * @param {number} [options.queryAbs] - Exact absolute segment being probed. A 12-step
     *   scan ends on the same segment NUMBER in the next round, so position-bound
     *   records (spent holds, abort spends, held slots) must compare by absolute
     *   position or this round's records block next round's Phase.
     * @param {boolean} [options.ignoreHold] - Evaluate the natural Phase as if a pending
     *   positional hold were already consumed (used for the ending combatant whose
     *   taken held slot is spent asynchronously after the advance commits)
     * @returns {boolean}
     * @protected
     */
    _takesTurnInSegment(combatant, segment, { ignoreAbort = false, queryAbs = null, ignoreHold = false } = {}) {
        const actor = combatant?.actor;
        if (!actor) return false;
        if ((this.settings?.skipDefeated ?? false) && combatant.isOutOfCombat) return false;
        const currentAbs = this.currentAbs;
        const abs = queryAbs ?? currentAbs + ((segment - this.segment + 12) % 12);
        if (!ignoreAbort && (combatant.abortAppliesAtAbs?.(abs) ?? actor.statuses.has("aborted"))) return false;
        // A spent hold already consumed this segment's action (using a Held Action
        // replaces the Phase: no character gets two Phases in one Segment)
        if (combatant.spentHoldAtAbs?.(abs)) return false;
        const hold = ignoreHold ? null : combatant.heldAction;
        // A positional hold commits the banked Phase to its declared slot
        if (hold?.mode === "position") return combatant.holdsPositionAtAbs(abs);
        // A wound-up Haymaker consumes the declarer's natural Phase in its
        // landing segment (6E2 69 High-SPD Haymakers)
        if (this.haymakerConsumesPhaseAt(combatant, abs)) return false;
        return combatant.hasPhaseInSegment?.(segment, abs) ?? false;
    }

    /** @override */
    async startCombat() {
        console.log(`[${game.system.id}] Initializing Hero System Turn 1 at Segment 12...`);
        this._playCombatSound("startEncounter");

        // A reused Combat document (core Reset, prior run) still carries the last
        // run's flags — holds, ledger, SPD baselines — and the fresh ledger events
        // below would append onto the old log's history (#2669)
        const priorRun =
            this.getFlag(game.system.id, "currentSegment") !== undefined ||
            this.getFlag(game.system.id, "eventLog") !== undefined;
        if (priorRun) await this._handleCombatStartReset({ notify: false });

        const startPayload = { round: 1, started: true };
        startPayload[`flags.${game.system.id}.currentSegment`] = 12;
        startPayload[`flags.${game.system.id}.recoveredRounds`] = [];

        // Combat opens at Turn 1 Segment 12 (abs 24); the roll map nests under its
        // abs key to preserve the multi-segment flag shape
        const startAbs = HeroSystem6eCombatantSingle.absoluteSegment(1, 12);
        const initialRolls = (await this._generateSegmentRollCache(startAbs)) || {};
        startPayload[`flags.${game.system.id}.segmentRolls`] = { [startAbs]: initialRolls };

        // Score at the opening abs explicitly: round is still 0 here, so the
        // default query would miss the roll map just written under startAbs
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, 12, { queryAbs: startAbs }),
            });
        });

        const startTurns = this._predictTurns(12, { queryAbs: startAbs, initiativeUpdates: combatantUpdates });

        const targetActorDoc = startTurns.find((t) => this._takesTurnInSegment(t, 12, { queryAbs: startAbs }));
        const targetCombatantId = targetActorDoc?.id || null;

        const finalTargetTurnsArray = startTurns.filter((t) => t.occupiesSegment?.(12) ?? false);

        const absoluteStartTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);
        startPayload.turn = absoluteStartTurnIndex !== -1 ? absoluteStartTurnIndex : 0;
        startPayload[`flags.${game.system.id}.actingPriority`] = targetActorDoc
            ? this.getInitiativePriority(targetActorDoc, 12, { queryAbs: startAbs })
            : null;

        const startEvents = [this.buildEvent("segment.start", { abs: startAbs })];
        if (targetActorDoc) {
            startEvents.push(
                this.buildEvent("turn.start", {
                    combatant: targetActorDoc,
                    abs: startAbs,
                    data: { turnIndex: startPayload.turn, storedActingPriority: null },
                }),
            );
        }
        Object.assign(startPayload, this.eventLogAppendPayload(startEvents));

        // Core fires this inside its own startCombat, which this override never
        // reaches — modules (turn timers, automation) listen for it
        Hooks.callAll("combatStart", this, startPayload);

        const result = await this.update({ ...startPayload, combatants: combatantUpdates });

        // V14 refreshes combat-duration effect tracking at combat start; the
        // registry does not exist on V13
        await getDocumentClass("ActiveEffect").registry?.refresh?.("combatStart", { combat: this });

        // Combat opens on Segment 12: offer/apply Lightning Reflexes right away.
        // The boundary maintenance also fires this for the start update; auto
        // mode dedups via lrElevatedAbs, prompt mode can double-whisper
        await this._segmentStartLightningReflexes();
        return result;
    }

    /**
     * Combatants who could elevate a scoped Lightning Reflexes purchase in the
     * current segment: a natural Phase here, no hold or spent action, not already
     * up, and not locked out by Stunned or an abort.
     * @returns {Combatant[]}
     * @private
     */
    _lrElevationCandidates() {
        const currentAbs = this.currentAbs;
        const activeId = this.combatant?.id;
        return this.combatants.filter((c) => {
            const actor = c.actor;
            if (!actor) return false;
            if (!c.lightningReflexes?.scoped) return false;
            if (c.id === activeId) return false;
            if (c.lrElevatedAbs === currentAbs) return false;
            if (!c.hasPhaseInSegment(this.segment)) return false;
            if (c.heldAction) return false;
            if (c.spentHoldInSegment?.(this.segment)) return false;
            if (actor.statuses.has("stunned")) return false;
            if (c.abortAppliesAtAbs?.(currentAbs) ?? actor.statuses.has("aborted")) return false;
            if ((this.settings?.skipDefeated ?? false) && c.isOutOfCombat) return false;
            return true;
        });
    }

    /**
     * Segment-start Lightning Reflexes handling. With the lrAutoElevate world
     * setting on, every candidate is elevated immediately (preempting the pointer
     * when a stop outranks the incoming actor); otherwise each candidate's owners
     * get a whispered prompt with an Act Early button — players rarely watch the
     * tracker at the top of a segment.
     * @private
     */
    async _segmentStartLightningReflexes() {
        if (!this.started) return;
        const candidates = this._lrElevationCandidates();
        if (candidates.length === 0) return;

        const autoElevate = !!_getSetting("lrAutoElevate", false);

        const currentAbs = this.currentAbs;

        if (!autoElevate) {
            for (const combatant of candidates) {
                const scoped = combatant.lightningReflexes.scoped;
                const whisper = whisperUserTargetsForActor(combatant.actor);
                if (whisper.length === 0) continue;
                const effectiveDex = Math.floor(this.getInitiativePriority(combatant, this.segment) + scoped.levels);
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
                    whisper,
                    content: `<p><b>Segment ${this.segment}</b>: ${foundry.utils.escapeHTML(combatant.actor.name)} can act early at effective DEX ${effectiveDex} with Lightning Reflexes (only: ${foundry.utils.escapeHTML(scoped.label)}).</p>
                        <button type="button" class="hero-lr-act-early" data-combat-id="${this.id}" data-combatant-id="${combatant.id}">⚡ Act Early (DEX ${effectiveDex})</button>`,
                });
            }
            return;
        }

        // Auto mode: elevate every candidate up front. The active id is captured
        // before the write — the re-sort can shift the stored turn index
        const activeId = this.combatant?.id ?? null;
        await this.updateEmbeddedDocuments(
            "Combatant",
            candidates.map((c) => ({ _id: c.id, [`flags.${game.system.id}.lrElevatedAbs`]: currentAbs })),
        );

        const announce = (list, whisper) =>
            list.length > 0
                ? ChatMessage.create({
                      speaker: { alias: "Lightning Reflexes" },
                      content: `${foundry.utils.escapeHTML(list.map((c) => c.actor.name).join(", "))} act${list.length === 1 ? "s" : ""} early this Segment (Lightning Reflexes).`,
                      ...(whisper ? { whisper } : {}),
                  })
                : Promise.resolve();
        await announce(
            candidates.filter((c) => !c.hidden),
            null,
        );
        await announce(
            candidates.filter((c) => c.hidden),
            ChatMessage.getWhisperRecipients("GM"),
        );

        await this.logEvents(
            candidates.map((c) => this.buildEvent("lr.elevate", { combatant: c, data: { auto: true } })),
        );

        // A stop that outranks the incoming actor preempts the pointer, exactly as a
        // manual elevation would
        const sorted = [...candidates].sort((a, b) => this._comparePriority(a, b, this, this.segment));
        const top = sorted[0];
        // fromMaintenance: this runs INSIDE the maintenance chain — settling
        // would await the chain currently executing (a self-deadlock that only
        // the settle timeout unwinds)
        if (top) await this.lrPreemptPointer(top.id, activeId, { fromMaintenance: true });
    }

    /**
     * Moves the turn pointer onto an elevated Lightning Reflexes stop when it
     * outranks the position the current actor is acting at. Shared by the manual
     * tracker toggle, the chat Act Early button, and segment-start auto-elevation.
     * Non-GM callers relay to the GM: the update carries the actingPriority flag,
     * which core forbids players from writing.
     * @param {string} combatantId - The elevated combatant
     * @param {string|null} [activeId] - The active combatant captured BEFORE the
     *   elevation flag was written (flag writes re-sort the turns array under the
     *   stored index, so the live lookup can drift)
     * @returns {Promise<void>}
     */
    async lrPreemptPointer(combatantId, activeId = this.combatant?.id ?? null, { fromMaintenance = false } = {}) {
        if (!game.user.isGM) {
            this._requestGmTurnAction("lrPreempt", { combatantId, activeId });
            return;
        }
        if (!fromMaintenance) await this.settleMaintenance();
        const combatant = this.combatants.get(combatantId);
        if (!this.started || combatant?.lrElevatedAbs !== this.currentAbs) return;
        if (!activeId || activeId === combatantId) return;
        // Reached via the async maintenance chain, chat buttons, and the socket
        // relay — staleness guards (#4558): the displaced combatant must still
        // exist, and the threshold is re-read HERE, not at capture time, so a
        // concurrent advance that already passed the elevated position bails out
        // below instead of pointing the turn backward. (A strict active-identity
        // check is deliberately NOT used: the elevation flag write itself re-sorts
        // the turns array under the stored index, so the live lookup drifts even
        // without any real advance.)
        if (!this.combatants.has(activeId)) return;

        const elevatedPriority = this.getInitiativePriority(combatant, this.segment);
        const active = this.combatants.get(activeId);
        const actingPriority =
            this.getFlag(game.system.id, "actingPriority") ??
            (active ? this.getInitiativePriority(active, this.segment) : -Infinity);
        if (elevatedPriority <= actingPriority) return;

        const index = this.turns.findIndex((t) => t.id === combatantId);
        if (index === -1) return;
        const preemptPayload = { turn: index, [`flags.${game.system.id}.actingPriority`]: elevatedPriority };
        Object.assign(
            preemptPayload,
            this.eventLogAppendPayload([
                this.buildEvent("lr.preempt", {
                    combatant,
                    priority: elevatedPriority,
                    data: {
                        displacedId: activeId,
                        actingPriority: Number.isFinite(actingPriority) ? actingPriority : null,
                    },
                }),
                this.buildEvent("turn.start", {
                    combatant,
                    priority: elevatedPriority,
                    data: { turnIndex: index, storedActingPriority: null, viaLrPreempt: true },
                }),
            ]),
        );
        // previousCombatantId=self suppresses the DISPLACED combatant's phase end
        // (their Phase continues); lrPreempt lets the elevated combatant's own
        // Phase START still run (idempotent, so the natural-slot return is safe)
        await this.update(preemptPayload, { direction: 1, previousCombatantId: combatantId, lrPreempt: true });
    }

    /**
     * Points the turn index back at the given combatant after a mid-segment
     * priority change re-sorted the turns array. previousCombatantId is the active
     * combatant itself so the natural-turn hold consumption's self-advance guard
     * (and the Phase start/end work) skip this pointer-only update.
     * @param {string|null} activeId
     * @returns {Promise<void>}
     */
    async resyncTurnPointer(activeId) {
        if (!this.started || !activeId) return;
        const index = this.turns.findIndex((t) => t.id === activeId);
        if (index === -1 || index === this.turn) return;
        try {
            await this.update({ turn: index }, { direction: 1, previousCombatantId: activeId });
        } catch (e) {
            console.warn(`Unable to re-sync the turn pointer`, e);
        }
    }

    /**
     * Relays a turn-flow operation to the active GM over the system socket. Core
     * permits non-GM Combat updates only on round/turn/combatants, and every
     * advance here carries system flags (segment, acting priority, tie-breaker
     * rolls), so players cannot commit them directly.
     * @param {string} operation
     * @param {object} [payload]
     * @returns {this}
     * @private
     */
    _requestGmTurnAction(operation, payload = {}) {
        if (!gmActive()) {
            ui.notifications.warn(`Could not perform this operation because there is no GM connected.`);
            return this;
        }
        game.socket.emit(`system.${game.system.id}`, {
            operation,
            combatId: this.id,
            userId: game.user.id,
            ...payload,
        });
        return this;
    }

    /**
     * Emits core's pre-update turn-flow hook (combatTurn, or combatRound when the
     * update changes the round) for module compatibility: the flow overrides here
     * commit their own updates, so core's emit points in nextTurn / nextRound /
     * previousTurn / previousRound never run. Fired on the committing client only,
     * before the update, exactly like core.
     * @param {object} updateData
     * @param {object} updateOptions
     * @private
     */
    _emitTurnFlowHook(updateData, updateOptions) {
        const hook = updateData.round !== undefined && updateData.round !== this.round ? "combatRound" : "combatTurn";
        Hooks.callAll(hook, this, updateData, updateOptions);
    }

    /**
     * Advances to the next turn: within-segment selection first, then a segment scan.
     * @override
     */
    async nextTurn() {
        if (!game.user.isGM) return this._requestGmTurnAction("nextTurn");
        await this.settleMaintenance();

        const allCombatants = this.combatants.contents;
        const activeSegment = this.segment;
        // Captured before the writes below move the combat position
        const currentAbs = this.currentAbs;

        // Captured before any writes below re-sort the turns array under the index.
        // A landing stop is not anyone's Phase: leaving it must not run the
        // parked-on declarer's phase-end work or held-slot bookkeeping.
        const ending = this.atDelayedLandingStop ? null : (this.combatant ?? null);

        // Scoped Lightning Reflexes is played as Phase-splitting (table ruling):
        // the elevated stop covers only the scoped action, and ending it
        // returns the rest of the Phase to the segment at natural DEX. The elevation
        // is consumed up front so every selection below sees the natural priority.
        let lrRemainderId = null;
        if (this.started && ending?.lrElevatedAbs === currentAbs) {
            // Captured while the flag still applies: the spent stop keeps displaying
            // at the elevated position for the rest of the segment
            const elevatedPriority = this.getInitiativePriority(ending, activeSegment);
            // render: false — this intermediate write re-sorts the turns array under
            // the still-stale index; rendering now would flash the combatant's
            // natural row before the real turn update lands
            await ending.update(
                {
                    [`flags.${game.system.id}.lrElevatedAbs`]: null,
                    [`flags.${game.system.id}.spentLrPosition`]: {
                        segmentAbs: currentAbs,
                        priority: elevatedPriority,
                    },
                },
                { render: false },
            );
            lrRemainderId = ending.id;
        }

        // Within-segment selection runs on LIVE priorities rather than the cached turns
        // array, so a positional hold declared mid-segment re-enters the order at its
        // declared DEX without waiting for a re-sort. The ending combatant's acting
        // position is their natural Phase unless they just acted at their held slot.
        const endingHold = ending?.heldAction;
        const endingAtHeldSlot =
            endingHold?.mode === "position" &&
            endingHold.segmentAbs === currentAbs &&
            ending.heldSlotTakenAt(currentAbs);
        // The threshold is the position the ending combatant ACTED at, recorded when
        // their turn began — live priorities move mid-segment (Aid/Drain) and would
        // re-admit combatants who already acted or skip ones who have not
        const storedActingPriority = this.getFlag(game.system.id, "actingPriority");
        const endingPriority =
            storedActingPriority ??
            (ending ? this.getInitiativePriority(ending, activeSegment, { ignoreHold: !endingAtHeldSlot }) : Infinity);

        const stillToAct = allCombatants.filter((c) => {
            if (!this._takesTurnInSegment(c, activeSegment, { queryAbs: currentAbs })) return false;
            const cHold = c.heldAction;
            const cHeldHere = cHold?.mode === "position" && cHold.segmentAbs === currentAbs;
            // A held slot only comes up once
            if (cHeldHere && c.heldSlotTakenAt(currentAbs)) return false;
            // The ending combatant re-enters the segment only via an unused held slot
            // or as the natural-DEX remainder of a just-ended Lightning Reflexes stop
            if (c.id === ending?.id && !cHeldHere && c.id !== lrRemainderId) return false;
            const priority = this.getInitiativePriority(c, activeSegment);
            if (priority < endingPriority) return true;
            return (
                priority === endingPriority &&
                !!ending &&
                c.id !== ending.id &&
                this.tieBreakOrder(c, ending, currentAbs) > 0
            );
        });

        const ctx = {
            allCombatants,
            activeSegment,
            currentAbs,
            ending,
            endingAtHeldSlot,
            storedActingPriority,
            endingPriority,
            stillToAct,
        };

        const within = await this._advanceWithinSegment(ctx);
        if (within) return within.result;
        const landing = await this._advanceToLandingStop(ctx);
        if (landing) return landing.result;
        return this._advanceToNextSegment(ctx);
    }

    /**
     * Commits the end-of-segment landing stop: once the segment's real stops are
     * done, pending priority-null delayed actions (Haymaker, Extra Segment) get
     * a genuine pointer stop of their own — the GM sees the landing arrive and
     * advances past it deliberately instead of the cards flashing by mid-jump.
     * The maintenance chain fires the roll/apply cards as the pointer lands; the
     * records survive (marked landed) so the marker row and the stop hold until
     * the segment is left. Null when there is nothing to land or the stop
     * already happened.
     * @private
     */
    async _advanceToLandingStop({ currentAbs, ending }) {
        if (this.atDelayedLandingStop) return null;
        const landings = this.pendingLandingsAt(currentAbs);
        if (!landings.length) return null;
        const first = landings[0];
        const index = this.turns.findIndex((t) => t.id === first.combatant.id);
        const payload = {
            turn: index !== -1 ? index : 0,
            [`flags.${game.system.id}.actingPriority`]: HeroSystem6eCombatSingle.LANDING_STOP_PRIORITY,
        };
        Object.assign(
            payload,
            this.eventLogAppendPayload([
                this.buildEvent("delayed.stop", {
                    combatant: first.combatant,
                    data: { count: landings.length, resolveAbs: currentAbs },
                }),
            ]),
        );
        // landingStop: the declarer may already hold the pointed-at row, making
        // this a flags-only diff — the option tells _onUpdate it is still a
        // real pointer movement (cards must fire, phase-end must run)
        const landingOptions = {
            direction: 1,
            previousCombatantId: ending?.id ?? null,
            landingStop: true,
        };
        this._emitTurnFlowHook(payload, landingOptions);
        return {
            result: await this.update(payload, landingOptions),
        };
    }

    /**
     * Selects and commits the next actor within the current segment; null when the
     * segment has no eligible actor left (the caller falls through to the segment scan).
     * @private
     */
    async _advanceWithinSegment({
        allCombatants,
        activeSegment,
        currentAbs,
        ending,
        storedActingPriority,
        endingPriority,
        stillToAct,
    }) {
        if (stillToAct.length === 0) return null;

        stillToAct.sort((a, b) => this._comparePriority(a, b, this, activeSegment));
        const target = stillToAct[0];

        // A mid-segment hold changes live priorities, and any embedded combatant write
        // re-sorts the turns array — so the turn index must address the RE-SORTED
        // order. Only changed initiatives persist: unchanged writes are wasted
        // round-trips, and any single combatant write re-sorts every client.
        let inlineCombatantUpdates = this.combatants
            .map((c) => ({
                _id: c.id,
                initiative: this.getInitiativePriority(c, activeSegment),
            }))
            .filter((u) => this.combatants.get(u._id)?.initiative !== u.initiative);

        // Landing on a positional holder's declared slot marks it taken in the
        // same update, so ending that turn consumes the hold race-free
        const targetHold = target.heldAction;
        if (targetHold?.mode === "position" && targetHold.segmentAbs === currentAbs) {
            const targetUpdate = inlineCombatantUpdates.find((u) => u._id === target.id);
            if (targetUpdate) targetUpdate[`flags.${game.system.id}.heldSlotTakenAbs`] = currentAbs;
            else
                inlineCombatantUpdates.push({
                    _id: target.id,
                    [`flags.${game.system.id}.heldSlotTakenAbs`]: currentAbs,
                });
        }

        // Players may only write combatants they own; the GM-side _onUpdate
        // backfills any slot-taken marker dropped here
        if (!game.user.isGM) {
            inlineCombatantUpdates = inlineCombatantUpdates.filter((u) => this.combatants.get(u._id)?.isOwner);
        }

        const predictedTurns = [...allCombatants]
            .sort((a, b) => this._sortCombatants(a, b, this))
            .filter((t) => t.occupiesSegment?.(activeSegment) ?? false);
        const targetIndex = predictedTurns.findIndex((t) => t.id === target.id);

        if (targetIndex === -1) return null;

        // Completed turns raise the segment's high-water mark: a Lightning
        // Reflexes elevation may only slot below it — positions above it have
        // genuinely been passed, while the current actor merely being up has not
        const priorHighWater = this.getFlag(game.system.id, "segmentHighWater");
        const segmentHighWater = ending ? Math.max(priorHighWater ?? -Infinity, endingPriority) : priorHighWater;
        const withinSegmentPayload = {
            turn: targetIndex,
            [`flags.${game.system.id}.actingPriority`]: this.getInitiativePriority(target, activeSegment),
            [`flags.${game.system.id}.segmentHighWater`]: Number.isFinite(segmentHighWater) ? segmentHighWater : null,
        };
        if (game.user.isGM) {
            Object.assign(
                withinSegmentPayload,
                this.eventLogAppendPayload([
                    this.buildEvent("turn.start", {
                        combatant: target,
                        abs: currentAbs,
                        data: { turnIndex: targetIndex, storedActingPriority: storedActingPriority ?? null },
                    }),
                ]),
            );
        }
        const withinSegmentOptions = { direction: 1, previousCombatantId: ending?.id };
        this._emitTurnFlowHook(withinSegmentPayload, withinSegmentOptions);
        return {
            result: await this.update(
                { ...withinSegmentPayload, combatants: inlineCombatantUpdates },
                withinSegmentOptions,
            ),
        };
    }

    /**
     * Scans forward for the next segment with an eligible actor and commits the
     * cross-segment landing (rolls, initiative refresh, pointer, events).
     * @private
     */
    async _advanceToNextSegment({
        allCombatants,
        activeSegment,
        currentAbs,
        ending,
        endingAtHeldSlot,
        storedActingPriority,
    }) {
        let nextSegment = activeSegment;
        let nextRoundCycle = this.round;
        let segmentDeltaCount = 0;
        const updateData = {};
        let segmentActorsFound = false;

        // An abort spends the combatant's next Phase: the scan passes over that Phase's
        // segment, after which they count as able to act again (the status itself is
        // cleared by _clearExpiredAborts once those segments have elapsed). Keyed
        // id → the abs the Phase was consumed at, so target selection can re-admit
        // strictly past it — including bare statuses, which record no spentAbs.
        const abortSpentIds = new Map(
            allCombatants
                .filter((c) => {
                    if (!c.abortEffect) return false;
                    // Declared aborts record the exact Phase they consume; bare statuses
                    // fall back to matching the ending segment
                    const spentAbs = c.abortSpentAbs;
                    if (spentAbs !== null) return spentAbs <= currentAbs;
                    return c.hasPhaseInSegment(activeSegment);
                })
                .map((c) => [c.id, c.abortSpentAbs ?? currentAbs]),
        );

        for (let check = 1; check <= 12; check++) {
            nextSegment++;
            segmentDeltaCount++;
            if (nextSegment > 12) {
                nextSegment = 1;
                nextRoundCycle += 1;

                await this._executePostSegment12Recovery(nextRoundCycle - 1);
            }

            const scanAbs = nextRoundCycle * 12 + nextSegment;
            const foundActors = allCombatants.filter((c) => {
                if (c.abortEffect && !abortSpentIds.has(c.id)) {
                    const spentAbs = c.abortSpentAbs;
                    const spendsHere =
                        spentAbs !== null ? spentAbs <= scanAbs : c.hasPhaseInSegment(nextSegment, scanAbs);
                    if (spendsHere) abortSpentIds.set(c.id, spentAbs ?? scanAbs);
                    return false;
                }
                // The ending combatant's taken held slot is spent by the post-update
                // maintenance; the scan already treats the hold as consumed or the
                // still-live effect blocks every probe and the advance dead-ends
                return this._takesTurnInSegment(c, nextSegment, {
                    ignoreAbort: true,
                    queryAbs: scanAbs,
                    ignoreHold: c.id === ending?.id && endingAtHeldSlot,
                });
            });
            // A segment holding only a delayed-action landing still gets a stop
            if (foundActors.length > 0 || this.pendingLandingsAt(scanAbs).length > 0) {
                segmentActorsFound = true;
                break;
            }
        }

        if (!segmentActorsFound) {
            ui.notifications.warn(`No combatant can take a turn; the tracker did not advance.`);
            return this;
        }

        const nextAbs = nextRoundCycle * 12 + nextSegment;
        // LIVE flag object, not _segmentRollsClone(): the fresh map written below
        // must be visible to this call's own priority reads (getInitiativePriority
        // re-reads the flag) before the update commits. The persisted payload is
        // the explicit rollsDelta, so the clone helper's diff hazard does not
        // apply here.
        const masterRollsCache = this.getFlag(game.system.id, "segmentRolls") ?? {};
        let updatedRollsCache = masterRollsCache[nextAbs];

        let freshRollMap = null;
        if (!updatedRollsCache) {
            updatedRollsCache = this._buildSegmentRollMap();
            masterRollsCache[nextAbs] = updatedRollsCache;
            freshRollMap = updatedRollsCache;
        }
        // Persist only the DELTA: the new abs entry plus forced deletions for maps
        // outside the two-Turn rewind window (flag updates merge, so assigning the
        // whole map here would clobber the deletion markers and re-send an
        // ever-growing payload every advance). Numeric prune also retires legacy
        // segment-number keys (1-12).
        const rollsDelta = {};
        if (freshRollMap) rollsDelta[nextAbs] = freshRollMap;
        for (const key of Object.keys(masterRollsCache)) {
            const keyAbs = Number(key);
            if (Number.isFinite(keyAbs) && keyAbs < currentAbs - ROLL_RETENTION_SEGMENTS) {
                delete masterRollsCache[key];
                rollsDelta[key] = foundry.data.operators.ForcedDeletion.create();
            }
        }
        if (Object.keys(rollsDelta).length > 0) {
            updateData[`flags.${game.system.id}.segmentRolls`] = rollsDelta;
        }
        let targetCombatantId = null;
        const upcomingActors = allCombatants.filter((c) =>
            this._takesTurnInSegment(c, nextSegment, {
                // Only a STRICTLY-PAST consumed Phase re-admits the aborter: an abort
                // spending exactly at the landing segment is being consumed here —
                // re-admitting would hand the aborter a stop at the very Phase the
                // abort consumed (and phase-start work would expire their defenses).
                // The Map value covers bare statuses too, which record no spentAbs.
                ignoreAbort: (abortSpentIds.get(c.id) ?? Infinity) < nextAbs,
                queryAbs: nextAbs,
                ignoreHold: c.id === ending?.id && endingAtHeldSlot,
            }),
        );

        if (upcomingActors.length > 0) {
            upcomingActors.sort((a, b) => {
                return this._comparePriority(a, b, this, nextSegment, { queryAbs: nextAbs });
            });
            targetCombatantId = upcomingActors[0]?.id || null;
        }

        // Landing-only segment (e.g. a Haymaker declared by the fight's last
        // actor): park the pointer on the declarer as the landing stop directly
        let landingOnlyStop = false;
        if (!targetCombatantId) {
            const landing = this.pendingLandingsAt(nextAbs)[0];
            if (landing) {
                targetCombatantId = landing.combatant.id;
                landingOnlyStop = true;
            }
        }

        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, nextSegment, { queryAbs: nextAbs }),
            });
        });

        // Landing on a positional holder's declared slot marks it taken in the same update
        const incomingHold = this.combatants.get(targetCombatantId)?.heldAction;
        if (incomingHold?.mode === "position" && incomingHold.segmentAbs === nextRoundCycle * 12 + nextSegment) {
            const targetUpdate = combatantUpdates.find((u) => u._id === targetCombatantId);
            if (targetUpdate) targetUpdate[`flags.${game.system.id}.heldSlotTakenAbs`] = incomingHold.segmentAbs;
        }

        // Persist only changed initiatives, and for players only owned combatants;
        // the GM-side _onUpdate backfills any dropped slot-taken marker
        let persistedCombatantUpdates = combatantUpdates.filter(
            (u) => this.combatants.get(u._id)?.initiative !== u.initiative || Object.keys(u).length > 2,
        );
        if (!game.user.isGM) {
            persistedCombatantUpdates = persistedCombatantUpdates.filter((u) => this.combatants.get(u._id)?.isOwner);
        }

        const recompiledTurns = this._predictTurns(nextSegment, {
            queryAbs: nextAbs,
            initiativeUpdates: combatantUpdates,
        });

        const finalTargetTurnsArray = recompiledTurns.filter((t) => t.occupiesSegment?.(nextSegment) ?? false);

        let absoluteTargetTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);
        // A landing-only declarer may occupy no position in the segment — the
        // eligible entries sort to the front, so the full-array index still lands
        if (absoluteTargetTurnIndex === -1 && landingOnlyStop) {
            absoluteTargetTurnIndex = recompiledTurns.findIndex((t) => t.id === targetCombatantId);
        }

        updateData.round = nextRoundCycle;
        updateData.turn = absoluteTargetTurnIndex !== -1 ? absoluteTargetTurnIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = nextSegment;
        const incomingCombatant = this.combatants.get(targetCombatantId);
        updateData[`flags.${game.system.id}.actingPriority`] = landingOnlyStop
            ? HeroSystem6eCombatSingle.LANDING_STOP_PRIORITY
            : incomingCombatant
              ? this.getInitiativePriority(incomingCombatant, nextSegment, { queryAbs: nextAbs })
              : null;
        // A fresh segment has no completed turns yet
        updateData[`flags.${game.system.id}.segmentHighWater`] = null;

        if (game.user.isGM) {
            const crossEvents = [];
            if (nextRoundCycle !== this.round) crossEvents.push(this.buildEvent("round.start", { abs: nextAbs }));
            crossEvents.push(this.buildEvent("segment.start", { abs: nextAbs }));
            if (freshRollMap) {
                crossEvents.push(
                    this.buildEvent("tie.roll", { abs: nextAbs, data: { segment: nextSegment, rolls: freshRollMap } }),
                );
            }
            if (incomingCombatant && !landingOnlyStop) {
                crossEvents.push(
                    this.buildEvent("turn.start", {
                        combatant: incomingCombatant,
                        abs: nextAbs,
                        data: { turnIndex: updateData.turn, storedActingPriority: storedActingPriority ?? null },
                    }),
                );
            } else if (landingOnlyStop && incomingCombatant) {
                crossEvents.push(
                    this.buildEvent("delayed.stop", {
                        combatant: incomingCombatant,
                        abs: nextAbs,
                        data: { count: this.pendingLandingsAt(nextAbs).length, resolveAbs: nextAbs },
                    }),
                );
            }
            Object.assign(updateData, this.eventLogAppendPayload(crossEvents));
        }

        const updateOptions = {
            direction: 1,
            // The CAPTURED ending combatant, not the live pointer: intermediate
            // combatant updates (LR de-elevation) re-sort turns under the stored
            // index and this.combatant can drift to a different row
            previousCombatantId: ending?.id ?? null,
            previousSegment: activeSegment,
            segmentsElapsed: segmentDeltaCount,
        };
        if (segmentDeltaCount > 0) {
            updateOptions.worldTime = { delta: segmentDeltaCount };
        }

        this._emitTurnFlowHook(updateData, updateOptions);
        const result = await this.update({ ...updateData, combatants: persistedCombatantUpdates }, updateOptions);

        return result;
    }

    /**
     * Steps back one turn; rewinding past the start resets the encounter.
     * @override
     */
    async previousTurn() {
        if (!game.user.isGM) return this._requestGmTurnAction("previousTurn");
        await this.settleMaintenance();

        if (this.round === 1 && this.segment === 12 && (this.turn ?? 0) === 0) {
            console.log(`[${game.system.id}] Rewinding past initial turn boundary. Resetting encounter state...`);

            return this._resetToUnstarted();
        }

        const allCombatants = this.combatants.contents;
        const turns = this.turns;
        const activeSegment = this.segment;

        const currentFilteredIndex = turns.findIndex((t) => t.id === this.combatant?.id);

        // Captured before the writes below move the combat position
        const currentAbs = this.currentAbs;

        const ctx = { allCombatants, turns, activeSegment, currentFilteredIndex, currentAbs };

        const landingRewind = await this._rewindOffLandingStop(ctx);
        if (landingRewind) return landingRewind.result;

        const lrRewind = await this._rewindOntoLrStop(ctx);
        if (lrRewind) return lrRewind.result;

        if (currentFilteredIndex > 0) return this._rewindWithinSegment(ctx);

        return this._rewindToPreviousSegment(ctx);
    }

    /**
     * Rewinds OFF an end-of-segment landing stop back onto the segment's last
     * real stop. The landing stop is not a turns entry, so the standard index
     * walk would step through rows that hold no turn in this segment; landed
     * records un-land so the stop re-fires on replay. A landing-only segment
     * (no real stops) delegates straight to the cross-segment rewind — falling
     * through to the index walk would create phantom stops.
     * @private
     */
    async _rewindOffLandingStop({ allCombatants, activeSegment, currentAbs }) {
        if (!this.atDelayedLandingStop) return null;
        const combatantUpdates = [];
        for (const { combatant, id } of this.pendingLandingsAt(currentAbs, { includeLanded: true })) {
            combatantUpdates.push({
                _id: combatant.id,
                [`flags.${game.system.id}.delayedActions.${id}.landed`]: false,
            });
        }
        const stops = allCombatants
            .filter((c) => this._takesTurnInSegment(c, activeSegment, { queryAbs: currentAbs }))
            .sort((a, b) => this._comparePriority(a, b, this, activeSegment, { queryAbs: currentAbs }));
        const target = stops.at(-1) ?? null;
        if (!target) {
            if (combatantUpdates.length) await this.updateEmbeddedDocuments("Combatant", combatantUpdates);
            return { result: await this._rewindToPreviousSegment({ allCombatants, activeSegment }) };
        }
        const targetPriority = this.getInitiativePriority(target, activeSegment, { queryAbs: currentAbs });
        const payload = {
            turn: Math.max(
                this.turns.findIndex((t) => t.id === target.id),
                0,
            ),
            [`flags.${game.system.id}.actingPriority`]: targetPriority,
            [`flags.${game.system.id}.segmentHighWater`]: null,
        };
        Object.assign(
            payload,
            this.eventLogAppendPayload([
                this.buildEvent("rewind", { combatant: target, data: { targetAbs: currentAbs } }),
            ]),
        );
        // Same undo semantics as _rewindWithinSegment: the landed-on stop
        // re-opens, so declarations made at or after it come undone with it
        const { resets, haymakerTeardowns } = this._rewindHoldFlagResets(currentAbs, { targetPriority });
        for (const reset of resets) {
            const existing = combatantUpdates.find((u) => u._id === reset._id);
            if (existing) Object.assign(existing, reset);
            else combatantUpdates.push(reset);
        }
        const rewindOptions = { direction: -1, previousCombatantId: this.combatant?.id };
        this._emitTurnFlowHook(payload, rewindOptions);
        const result = await this.update({ ...payload, combatants: combatantUpdates }, rewindOptions);
        await this._teardownRewoundHaymakers(haymakerTeardowns);
        return { result };
    }

    /**
     * Resets the encounter to its unstarted pre-combat state after rewinding past the start.
     * @private
     */
    async _resetToUnstarted() {
        await this._handleCombatStartReset();

        const resetPayload = { started: false, round: 0, turn: 0 };
        resetPayload[`flags.${game.system.id}.currentSegment`] = 12;
        resetPayload[`flags.${game.system.id}.recoveredRounds`] = [];

        return this.update(resetPayload, { direction: -1 });
    }

    /**
     * Rewinds back ONTO a completed scoped-LR stop this segment, restoring its
     * elevation; null when no such stop sits between here and the previous turns entry.
     * A completed scoped-LR stop is not a turns entry, so the standard index
     * walk would skip straight past it (often into the previous segment) and
     * the flag resets would erase it.
     * @private
     */
    async _rewindOntoLrStop({ allCombatants, turns, activeSegment, currentFilteredIndex, currentAbs }) {
        const currentPriority =
            this.getFlag(game.system.id, "actingPriority") ??
            (this.combatant ? this.getInitiativePriority(this.combatant, activeSegment) : -Infinity);
        const spentLrStops = allCombatants
            .map((c) => ({ combatant: c, spent: c.getFlag(game.system.id, "spentLrPosition") }))
            .filter(({ spent }) => spent?.segmentAbs === currentAbs && spent.priority > currentPriority)
            .sort((a, b) => a.spent.priority - b.spent.priority);
        if (spentLrStops.length === 0) return null;

        const { combatant: stop, spent } = spentLrStops[0];
        const regularPrev = currentFilteredIndex > 0 ? turns[currentFilteredIndex - 1] : null;
        const regularPriority = regularPrev ? this.getInitiativePriority(regularPrev, activeSegment) : Infinity;
        if (!(spent.priority < regularPriority)) return null;

        const previousId = this.combatant?.id;
        // Restore the elevation render-suppressed: the re-sort under the
        // still-stale index must not paint before the pointer lands
        await stop.update(
            {
                [`flags.${game.system.id}.lrElevatedAbs`]: currentAbs,
                [`flags.${game.system.id}.spentLrPosition`]: null,
            },
            { render: false },
        );
        const stopIndex = this.turns.findIndex((t) => t.id === stop.id);
        const payload = {
            turn: stopIndex !== -1 ? stopIndex : 0,
            [`flags.${game.system.id}.actingPriority`]: spent.priority,
            [`flags.${game.system.id}.segmentHighWater`]: null,
        };
        Object.assign(
            payload,
            this.eventLogAppendPayload([
                this.buildEvent("rewind", { combatant: stop, data: { targetAbs: currentAbs } }),
            ]),
        );
        const lrRewindOptions = { direction: -1, previousCombatantId: previousId };
        this._emitTurnFlowHook(payload, lrRewindOptions);
        return { result: await this.update(payload, lrRewindOptions) };
    }

    /**
     * Steps the pointer back one entry within the current segment's turns array.
     * @private
     */
    async _rewindWithinSegment({ turns, activeSegment, currentFilteredIndex, currentAbs }) {
        const targetCombatant = turns[currentFilteredIndex - 1];
        const masterTargetIndex = turns.findIndex((t) => t.id === targetCombatant.id);

        const targetPriority = this.getInitiativePriority(targetCombatant, activeSegment);
        const inlineUpdateData = {
            turn: masterTargetIndex !== -1 ? masterTargetIndex : 0,
            [`flags.${game.system.id}.actingPriority`]: targetPriority,
            // Rewinds forget completed turns; lenient for re-declared elevations
            [`flags.${game.system.id}.segmentHighWater`]: null,
        };
        Object.assign(
            inlineUpdateData,
            this.eventLogAppendPayload([
                this.buildEvent("rewind", {
                    combatant: targetCombatant,
                    data: { targetAbs: currentAbs },
                }),
            ]),
        );
        const { resets, haymakerTeardowns } = this._rewindHoldFlagResets(currentAbs, { targetPriority });

        const rewindOptions = { direction: -1, previousCombatantId: this.combatant?.id };
        this._emitTurnFlowHook(inlineUpdateData, rewindOptions);
        const result = await this.update({ ...inlineUpdateData, combatants: resets }, rewindOptions);
        await this._teardownRewoundHaymakers(haymakerTeardowns);
        return result;
    }

    /**
     * Scans backward for the previous segment with an eligible actor and commits
     * the cross-segment rewind landing; resets the encounter past the start.
     * @private
     */
    async _rewindToPreviousSegment({ allCombatants, activeSegment }) {
        let prevSegment = activeSegment;
        let prevRoundCycle = this.round;
        let segmentDeltaCount = 0;
        const updateData = {};
        let segmentActorsFound = false;

        for (let check = 1; check <= 12; check++) {
            prevSegment--;
            segmentDeltaCount--;
            if (prevSegment < 1) {
                prevSegment = 12;
                prevRoundCycle -= 1;

                if (prevRoundCycle < 1) {
                    return this._resetToUnstarted();
                }
            }

            const rewindProbeAbs = prevRoundCycle * 12 + prevSegment;
            const foundActors = allCombatants.filter((c) =>
                this._takesTurnInSegment(c, prevSegment, { queryAbs: rewindProbeAbs }),
            );
            if (foundActors.length > 0) {
                segmentActorsFound = true;
                break;
            }
        }

        if (!segmentActorsFound) return this;

        const prevAbs = prevRoundCycle * 12 + prevSegment;
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: this.getInitiativePriority(combatant, prevSegment, { queryAbs: prevAbs }),
            });
        });

        const recompiledTurns = this._predictTurns(prevSegment, {
            queryAbs: prevAbs,
            initiativeUpdates: combatantUpdates,
        });

        const finalTargetTurnsArray = recompiledTurns.filter((t) => t.occupiesSegment?.(prevSegment) ?? false);

        let targetCombatantId = null;
        const targetActors = allCombatants.filter((c) =>
            this._takesTurnInSegment(c, prevSegment, { queryAbs: prevAbs }),
        );

        if (targetActors.length > 0) {
            targetActors.sort((a, b) => {
                return this._comparePriority(a, b, this, prevSegment, { queryAbs: prevAbs });
            });
            targetCombatantId = targetActors[targetActors.length - 1]?.id || null;
        }

        const absoluteTargetTurnIndex = finalTargetTurnsArray.findIndex((t) => t.id === targetCombatantId);

        updateData.round = prevRoundCycle;
        updateData.turn = absoluteTargetTurnIndex !== -1 ? absoluteTargetTurnIndex : 0;
        updateData[`flags.${game.system.id}.currentSegment`] = prevSegment;
        const rewindTarget = this.combatants.get(targetCombatantId);
        updateData[`flags.${game.system.id}.actingPriority`] = rewindTarget
            ? this.getInitiativePriority(rewindTarget, prevSegment, { queryAbs: prevAbs })
            : null;
        updateData[`flags.${game.system.id}.segmentHighWater`] = null;
        Object.assign(
            updateData,
            this.eventLogAppendPayload([this.buildEvent("rewind", { data: { targetAbs: prevAbs } })]),
        );

        // The rewind lands ON the segment's last stop and re-opens it — flag
        // resets key off that landing priority (declarations before it survive).
        // Prediction above only reads the initiative entries, so merging the
        // flag resets in afterwards is safe.
        const { resets, haymakerTeardowns } = this._rewindHoldFlagResets(prevAbs, {
            targetPriority: updateData[`flags.${game.system.id}.actingPriority`],
        });
        for (const reset of resets) {
            const existing = combatantUpdates.find((u) => u._id === reset._id);
            if (existing) Object.assign(existing, reset);
            else combatantUpdates.push(reset);
        }

        const updateOptions = { direction: -1, previousCombatantId: this.combatant?.id };
        if (segmentDeltaCount < 0) {
            updateOptions.worldTime = { delta: segmentDeltaCount };
        }

        this._emitTurnFlowHook(updateData, updateOptions);
        const result = await this.update({ ...updateData, combatants: combatantUpdates }, updateOptions);
        await this._teardownRewoundHaymakers(haymakerTeardowns);
        return result;
    }

    /**
     * Advance the tracker forward by an entire Turn Cycle (12 Segments / 12 Seconds).
     * @override
     */
    async nextRound() {
        if (!game.user.isGM) return this._requestGmTurnAction("nextRound");
        await this.settleMaintenance();

        const updateData = {
            round: this.round + 1,
            turn: 0,
        };
        updateData[`flags.${game.system.id}.currentSegment`] = this.segment;
        updateData[`flags.${game.system.id}.actingPriority`] = null;
        updateData[`flags.${game.system.id}.segmentHighWater`] = null;

        // The landing position is a fresh absolute segment: roll its tie-breaks
        // (nextTurn's cross-segment block never runs on a full-Turn skip)
        const landingAbs = (this.round + 1) * 12 + this.segment;
        const roundRollsCache = this._segmentRollsClone();
        if (!roundRollsCache[landingAbs]) {
            roundRollsCache[landingAbs] = this._buildSegmentRollMap();
            // Flag updates merge: sending only the new entry avoids re-writing the map
            updateData[`flags.${game.system.id}.segmentRolls`] = { [landingAbs]: roundRollsCache[landingAbs] };
        }

        Object.assign(
            updateData,
            this.eventLogAppendPayload([
                this.buildEvent("round.start", {
                    abs: landingAbs,
                    data: { skippedTurn: true },
                }),
            ]),
        );

        // Skipping a full Turn crosses Post-Segment 12 exactly once
        if (this.started && this.round > 0) {
            await this._executePostSegment12Recovery(this.round);
        }

        const updateOptions = { direction: 1, turnAdvance: true };
        updateOptions.worldTime = { delta: 12 };

        this._emitTurnFlowHook(updateData, updateOptions);
        return this.update({ ...updateData, combatants: [] }, updateOptions);
    }

    /**
     * Rewind the tracker backward by an entire Turn Cycle (12 Segments / 12 Seconds).
     * @override
     */
    async previousRound() {
        if (!game.user.isGM) return this._requestGmTurnAction("previousRound");
        await this.settleMaintenance();

        let targetRound = this.round - 1;
        if (targetRound < 1) targetRound = 1;

        const updateData = {
            round: targetRound,
            turn: 0,
        };
        updateData[`flags.${game.system.id}.actingPriority`] = null;
        updateData[`flags.${game.system.id}.segmentHighWater`] = null;
        Object.assign(
            updateData,
            this.eventLogAppendPayload([
                this.buildEvent("rewind", { data: { targetAbs: targetRound * 12 + this.segment } }),
            ]),
        );

        // Rewinding into round 1 clamps the timeline back to the starting segment (12)
        const isUnstartedBoundary = targetRound === 1;
        updateData[`flags.${game.system.id}.currentSegment`] = isUnstartedBoundary ? 12 : this.segment;

        // Landed records whose stop is now at/ahead of the target un-land so the
        // stop re-fires on replay — otherwise pendingLandingsAt excludes them
        // forever and the landing degrades to a silent record delete
        const targetAbs = targetRound * 12 + this.segment;
        const combatantUpdates = [];
        for (const combatant of this.combatants) {
            const update = {};
            for (const [delayedId, record] of this.delayedActionsFor(combatant)) {
                if (delayedId === "legacy-haymaker") continue;
                if (record?.landed && (record.resolveAbs ?? -Infinity) >= targetAbs) {
                    update[`flags.${game.system.id}.delayedActions.${delayedId}.landed`] = false;
                }
            }
            if (Object.keys(update).length > 0) combatantUpdates.push({ _id: combatant.id, ...update });
        }

        const updateOptions = { direction: -1 };
        updateOptions.worldTime = { delta: -12 };

        this._emitTurnFlowHook(updateData, updateOptions);
        return this.update({ ...updateData, combatants: combatantUpdates }, updateOptions);
    }

    /**
     * Posts a combat-flow chat card, whispered to the GM for hidden combatants so
     * their names and tactical state don't leak to players.
     * @param {Combatant} combatant
     * @param {string} content
     * @param {object} [options]
     * @param {boolean} [options.ownersOnly] - Whisper to the actor's owners
     * @private
     */
    _combatCard(combatant, content, { ownersOnly = false } = {}) {
        const data = { speaker: ChatMessage.getSpeaker({ actor: combatant.actor }), content };
        if (combatant.hidden) data.whisper = ChatMessage.getWhisperRecipients("GM");
        else if (ownersOnly) data.whisper = whisperUserTargetsForActor(combatant.actor);
        return ChatMessage.create(data);
    }

    /**
     * Combatant flag resets for a rewind. Slot-taken markers on LIVE holds at or
     * after the target position are cleared so replayed held slots come up again.
     * Spent-hold records are retained: spending deleted the holding effect, and
     * nothing can restore it — clearing the record would re-admit the holder for a
     * second action in the replayed segment. Undoing a spent hold is a manual GM
     * correction (re-declare the hold).
     * @param {number} targetAbs
     * @param {object} [options]
     * @param {number|null} [options.targetPriority] - Priority of the stop the rewind lands on
     * @returns {{resets: object[], haymakerTeardowns: Combatant[]}} Combatant update
     *   payloads keyed by _id, plus combatants whose pending Haymaker un-declared
     *   (the caller ends the wind-up AFTER the update applies)
     * @private
     */
    _rewindHoldFlagResets(targetAbs, { targetPriority = null } = {}) {
        const resets = [];
        const haymakerTeardowns = [];
        // A declaration "un-happens" only when the rewind re-opens its stop or an
        // earlier one: landings in a LATER segment never undo it, landings in an
        // earlier segment always do, and within the declaration's own segment the
        // landed-on stop re-opens — declarations made at or after that stop
        // (priority at or below the landing priority) come undone with it.
        const rewindUndoes = (declaredAbs, declaredPriority) => {
            if ((declaredAbs ?? Infinity) > targetAbs) return true;
            if ((declaredAbs ?? Infinity) < targetAbs) return false;
            if (targetPriority === null || targetPriority === undefined) return false;
            if (declaredPriority === null || declaredPriority === undefined) return true;
            return declaredPriority <= targetPriority;
        };
        for (const combatant of this.combatants) {
            const update = {};
            if (combatant.heldAction?.mode === "position" && (combatant.heldSlotTakenAbs ?? -1) >= targetAbs) {
                update[`flags.${game.system.id}.heldSlotTakenAbs`] = null;
            }
            // Declared LR elevations survive rewinds outright: the flag is bound to
            // its absolute segment, so a rewind to an earlier position simply leaves
            // it pending and the replay re-runs the stop when the count returns to
            // it. A completed stop within the rewind's own segment stays acted when
            // it happened BEFORE the rewind target; otherwise it un-acts and its
            // elevation comes back as pending.
            const spentLr = combatant.getFlag(game.system.id, "spentLrPosition");
            if (spentLr && spentLr.segmentAbs >= targetAbs) {
                const staysActed =
                    spentLr.segmentAbs === targetAbs && targetPriority !== null && spentLr.priority > targetPriority;
                if (!staysActed) {
                    update[`flags.${game.system.id}.spentLrPosition`] = null;
                    update[`flags.${game.system.id}.lrElevatedAbs`] = spentLr.segmentAbs;
                }
            }
            // A SPD change detected at or after the rewind target is un-detected: the
            // baseline reverts so the replay re-fires the lockout from its own position.
            // Lockouts recorded before the target stand — the change already happened.
            const lockout = combatant.getFlag(game.system.id, "spdLockout");
            if (lockout && (lockout.lockoutStartAbs ?? Infinity) >= targetAbs) {
                update[`flags.${game.system.id}.spdLockout`] = null;
                update[`flags.${game.system.id}.knownSpd`] = lockout.previousKnown ?? lockout.previousSpd;
            }
            // A deferred voluntary change declared at or after the target is re-detected on replay
            const pendingSpd = combatant.getFlag(game.system.id, "pendingSpd");
            if (pendingSpd && (pendingSpd.declaredAbs ?? Infinity) >= targetAbs) {
                update[`flags.${game.system.id}.pendingSpd`] = null;
            }
            // Records predating declaredPriority fall back to the declarer's own
            // natural stop in the declaration segment
            const naturalPriorityAt = (abs) =>
                this.getInitiativePriority(combatant, HeroSystem6eCombatantSingle.segmentOf(abs), { queryAbs: abs });
            // A Haymaker wound up at or after the rewind's landing stop is undone
            const haymaker = combatant.getFlag(game.system.id, "haymaker");
            if (
                haymaker &&
                rewindUndoes(
                    haymaker.declaredAbs,
                    haymaker.declaredPriority ?? naturalPriorityAt(haymaker.declaredAbs ?? targetAbs),
                )
            ) {
                update[`flags.${game.system.id}.haymaker`] = null;
                haymakerTeardowns.push(combatant);
            }
            // Likewise delayed actions declared at or after the landing stop
            const delayed = combatant.getFlag(game.system.id, "delayedActions") ?? {};
            for (const [delayedId, record] of Object.entries(delayed)) {
                if (
                    rewindUndoes(
                        record?.declaredAbs,
                        record?.declaredPriority ?? naturalPriorityAt(record?.declaredAbs ?? targetAbs),
                    )
                ) {
                    update[`flags.${game.system.id}.delayedActions.-=${delayedId}`] = null;
                    if (record?.kind === "haymaker") haymakerTeardowns.push(combatant);
                } else if (record?.landed && (record.resolveAbs ?? -Infinity) >= targetAbs) {
                    // The surviving record's landing stop is at/after the rewind
                    // target: un-land it so the stop re-fires on replay
                    update[`flags.${game.system.id}.delayedActions.${delayedId}.landed`] = false;
                }
            }
            if (Object.keys(update).length > 0) resets.push({ _id: combatant.id, ...update });
        }
        return { resets, haymakerTeardowns };
    }

    /**
     * Ends the Haymaker wind-up (the -5 DCV effect and active maneuver item) for
     * combatants whose pending Haymaker a rewind just un-declared — a bare record
     * delete would strand the maneuver active with no landing left to clean it up.
     * Runs AFTER the rewind update so a surviving sibling record keeps the wind-up.
     * @param {Combatant[]} combatants
     * @private
     */
    async _teardownRewoundHaymakers(combatants) {
        for (const combatant of new Set(combatants)) {
            if (this.delayedActionsFor(combatant, "haymaker").length > 0) continue;
            await endHaymakerManeuver(combatant.actor, { token: combatant.token });
        }
    }

    /**
     * Completely resets custom system flags and child initiative fields,
     * dropping the encounter state machine back onto the "Start Combat" panel.
     * @returns {Promise<HeroCombat>}
     * @private
     */
    async _handleCombatStartReset({ notify = true } = {}) {
        if (notify) ui.notifications.info(`[${game.system.id}] Resetting combat encounter to default startup state.`);

        // Null initiative restores the dice icon
        const combatantUpdates = [];
        this.combatants.forEach((combatant) => {
            combatantUpdates.push({
                _id: combatant.id,
                initiative: null,
                [`flags.${game.system.id}.heldSlotTakenAbs`]: null,
                [`flags.${game.system.id}.spentHoldPosition`]: null,
                [`flags.${game.system.id}.lrElevatedAbs`]: null,
                [`flags.${game.system.id}.spentLrPosition`]: null,
                // A fresh combat re-seeds the SPD baseline; out-of-combat changes are
                // free (only mid-Turn changes are restricted) and stale lockouts
                // reference the previous run's absolute positions
                [`flags.${game.system.id}.spdLockout`]: null,
                [`flags.${game.system.id}.knownSpd`]: null,
                [`flags.${game.system.id}.pendingSpd`]: null,
                [`flags.${game.system.id}.haymaker`]: null,
                [`flags.${game.system.id}.delayedActions`]: null,
                [`flags.${game.system.id}.spentEndOn`]: null,
                [`flags.${game.system.id}.koRecoveredOn`]: null,
                [`flags.${game.system.id}.koRecoveredAbs`]: null,
                [`flags.${game.system.id}.koStartAbs`]: null,
            });
        });

        const resetData = {
            started: false,
            round: 0,
            turn: null,
        };

        resetData[`flags.${game.system.id}`] = forceDeleteKeys([
            "currentSegment",
            "segmentRolls",
            "recoveredRounds",
            "actingPriority",
            "segmentHighWater",
            "eventLog",
            "eventLogSeq",
        ]);

        return this.update({ ...resetData, combatants: combatantUpdates });
    }

    /**
     * Processes recovery calculations and returns true if an update was committed.
     * @param {number} roundToRecover
     * @returns {Promise<boolean>}
     * @private
     */
    async _executePostSegment12Recovery(roundToRecover) {
        // Runs inline on the single client that advances the tracker; non-GM
        // advances are relayed to a GM before reaching this point. Gating on the
        // active GM here would silently skip recovery for any other GM's advance.
        if (!game.user.isGM) return false;

        const recoveredRounds = this.getFlag(game.system.id, "recoveredRounds") ?? [];
        if (recoveredRounds.includes(roundToRecover)) {
            await ChatMessage.create({
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                author: game.user._id,
                content: `Post-Segment 12 (Turn ${roundToRecover})
                <p>Skipping because this has already been performed on this turn during this combat.
                This typically occurs when rewinding combat.</p>`,
            });
            return false;
        }

        // Persist the guard before any actor is touched: if the caller's advance never
        // commits (no eligible combatant found), recovery must not re-apply on retry
        await this.setFlag(game.system.id, "recoveredRounds", [...recoveredRounds, roundToRecover]);
        await this.logEvent("recovery.post12", { data: { round: roundToRecover } });

        const automation = _getSetting("automation", "none");

        const heading = `Post-Segment 12 (Turn ${roundToRecover})`;
        let publicItems = "";
        let hiddenItems = "";

        // Knocked out characters still take Post-Segment 12 Recoveries (that is how they
        // wake up); isDefeated here is core's (defeated toggle or dead), not isOutOfCombat
        for (const combatant of this.combatants.filter((c) => !c.isDefeated || c.hasPlayerOwner)) {
            const actor = combatant.actor;
            if (!actor) continue;

            if (
                automation === "all" ||
                (automation === "npcOnly" && actor.type === "npc") ||
                (automation === "pcEndOnly" && actor.type === "pc")
            ) {
                // TakeRecovery works on synthetic token actors (unlinked tokens) and applies the
                // recovery exclusions: KO'd below -10 STUN, holding breath, dead NPCs, bases,
                // negative REC.
                let recoveryText =
                    (await actor.TakeRecovery({
                        asAction: false,
                        token: combatant.token,
                        preventRecoverFromStun: true,
                    })) || "";

                // END RESERVE recovers at its own REC rate
                for (const endReserveItem of actor.items.filter((o) => o.system.XMLID === "ENDURANCERESERVE")) {
                    const ENDURANCERESERVEREC = endReserveItem.findModsByXmlid("ENDURANCERESERVEREC");
                    if (ENDURANCERESERVEREC) {
                        const newValue = Math.min(
                            endReserveItem.system.LEVELS,
                            endReserveItem.system.value + parseInt(ENDURANCERESERVEREC.LEVELS),
                        );
                        if (newValue > endReserveItem.system.value) {
                            const delta = newValue - endReserveItem.system.value;
                            await endReserveItem.update({ "system.value": newValue });
                            recoveryText += `${recoveryText ? " " : ""}${endReserveItem.name} +${delta} END.`;
                        }
                    }
                }

                // A character recovered above 0 STUN is no longer knocked out (#4567)
                if (actor.statuses.has("knockedOut") && (actor.getCharacteristic("stun")?.value ?? 0) > 0) {
                    await actor.toggleStatusEffect(
                        HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id,
                        {
                            active: false,
                        },
                    );
                    recoveryText += `${recoveryText ? " " : ""}${actor.name} regains consciousness.`;
                }

                if (recoveryText) {
                    const showToAll = !combatant.hidden && (combatant.hasPlayerOwner || actor.type === "pc");
                    if (showToAll) {
                        publicItems += `<li>${recoveryText}</li>`;
                    } else {
                        hiddenItems += `<li>${recoveryText}</li>`;
                    }
                }
            }
        }

        // The Turn boundary always announces publicly; NPC recoveries stay GM-only
        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            author: game.user._id,
            content: publicItems ? `${heading}<ul>${publicItems}</ul>` : heading,
        };
        await ChatMessage.create(chatData);

        if (hiddenItems) {
            await ChatMessage.create({
                ...chatData,
                content: `${heading}<ul>${hiddenItems}</ul>`,
                whisper: ChatMessage.getWhisperRecipients("GM"),
            });
        }

        return true;
    }

    /**
     * Post-database update handler. Executes on all clients when combat values change.
     * @override
     */
    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);

        // Only the active GM runs side effects so multiple connected GMs don't double-fire them
        if (!game.users.activeGM?.isSelf) return;

        // started is a derived getter (round > 0), not a schema field: the
        // startCombat/reset payloads' started key never survives into the
        // update diff, so this guard cannot fire and combat-start updates DO
        // run the boundary maintenance below (with no previousSegment option,
        // i.e. elapsedSegments undefined). The first combatant's phase-start
        // work at combat start depends on that, so the sweeps must treat
        // undefined as "nothing elapsed" rather than being skipped here.
        if (changed.started !== undefined) return;

        const turnChanged = changed.turn !== undefined;
        const roundChanged = changed.round !== undefined;
        const systemFlagKey = `flags.${game.system.id}`;
        const flagsChanged = foundry.utils.hasProperty(changed, systemFlagKey);

        // If neither the phase pointers nor the custom segment properties updated, exit early
        if (!turnChanged && !roundChanged && !flagsChanged) return;

        // Rewinding must not consume holds or expire effects
        const direction = foundry.utils.getProperty(options, "direction") ?? 1;
        if (direction < 0) return;

        const prevId = foundry.utils.getProperty(options, "previousCombatantId");

        // Segment-boundary maintenance. turnAdvance marks a full-Turn skip (nextRound), where
        // every SPD 1-12 has had a Phase; roundChanged covers the segment-12-to-segment-12
        // wrap, where the currentSegment flag value is unchanged.
        const turnAdvance = foundry.utils.getProperty(options, "turnAdvance") === true;
        const newSegment = foundry.utils.getProperty(changed, `${systemFlagKey}.currentSegment`);
        const boundary = newSegment !== undefined || roundChanged || turnAdvance;

        // Only pointer movement starts a new Phase: flag-only bookkeeping updates
        // (event-log appends, the recovery ledger) must not run turn side effects.
        // A landing stop is real pointer movement even when the declarer already
        // holds the pointed-at row — the diff drops the identical turn index and
        // the update arrives flags-only, so the explicit option carries it through
        const landingStopMove = foundry.utils.getProperty(options, "landingStop") === true;
        if (!turnChanged && !boundary && !landingStopMove) return;

        let elapsedSegments;
        if (boundary) {
            // Segments that just ended, oldest first; empty segments count because an
            // aborted combatant's spent Phase may fall in a segment nobody acted in
            const previousSegment = turnAdvance ? null : foundry.utils.getProperty(options, "previousSegment");
            if (turnAdvance) {
                elapsedSegments = null; // A full Turn elapsed: every SPD 1-12 had a Phase
            } else if (previousSegment !== undefined && previousSegment !== null) {
                const segmentsElapsed = foundry.utils.getProperty(options, "segmentsElapsed") ?? 1;
                if (segmentsElapsed >= 12) elapsedSegments = null;
                else
                    elapsedSegments = Array.fromRange(segmentsElapsed).map((i) => ((previousSegment - 1 + i) % 12) + 1);
            }
        }

        // One ordered chain so every step sees its predecessors' writes. Chains
        // from successive updates are SERIALIZED: Foundry doesn't await _onUpdate,
        // and two concurrently-running chains would each resolve the same due
        // delayed actions / grant the same per-Phase work before either's flag
        // delete lands
        const runMaintenance = async () => {
            if (boundary) {
                // SPD-change lockouts first so the hold/abort checks see updated phase
                // eligibility; passed-hold cleanup before the natural-turn clear so
                // spent positional holds are never re-carded
                await this._maintainSpdChanges();
                await this._clearSpentHoldPositions();
                await this._demotePassedPositionalHolds();
                if (turnAdvance) await this._consumeExpiredHeldActions();
                await this._clearExpiredAborts(elapsedSegments);
                await this._grantKoPhaseRecoveries(elapsedSegments);
            }

            // Delayed actions can land mid-segment (Delayed Phase's half-DEX
            // position, Extra Phase's own-Phase activation), so this runs on
            // every pointer move, not just at boundaries
            await this._resolveDelayedActions();

            const previousCombatant = prevId ? this.combatants.get(prevId) : null;
            if (previousCombatant?.actor) {
                await this._expireCustomSystemEffects(previousCombatant.actor);

                // A positional hold is spent the moment its held turn ends within the
                // same segment — used if the pointer actually took the slot; passed
                // over unused it demotes to a generic hold (cross-segment endings go
                // through _demotePassedPositionalHolds). A hold declared THIS segment
                // hasn't had its slot yet (the ending turn was the declarer's natural
                // Phase), so declaredAbs === currentAbs is exempt unless the slot was
                // taken.
                const hold = previousCombatant.heldAction;
                if (hold?.mode === "position") {
                    const currentAbs = this.currentAbs;
                    if (hold.segmentAbs === currentAbs) {
                        const slotTaken = previousCombatant.heldSlotTakenAt(currentAbs);
                        if (slotTaken) {
                            await this._spendHold(previousCombatant, { used: true });
                        } else if (hold.declaredAbs !== currentAbs) {
                            await this._demoteHold(previousCombatant);
                        }
                    }
                }
            }

            // A landing stop parks the pointer on the declarer without granting
            // them a Phase: none of the "the active combatant's Phase begins"
            // work below may run — hold consumption, maneuver expiry (the
            // Haymaker's own +4 DC / -5 DCV wind-up is a maneuverNextPhaseEffect
            // and MUST survive to the roll), phase start, or the stunned skip
            const atLandingStop = this.atDelayedLandingStop;

            if (!atLandingStop) await this._consumeActiveCombatantHold(prevId);
            if (boundary) await this._segmentStartLightningReflexes();

            // Phase end/start work skips pure pointer resyncs — within-segment
            // updates that land back on the same combatant (mid-segment re-sorts,
            // reconcile repairs) are not a Phase transition. An LR preempt also
            // passes prev=self (the interrupted combatant's Phase is NOT ending),
            // but the elevated combatant's own Phase genuinely BEGINS with it.
            const activeCombatant = this.combatant;
            const isResync = !boundary && !landingStopMove && prevId !== undefined && prevId === activeCombatant?.id;
            const lrPreempt = foundry.utils.getProperty(options, "lrPreempt") === true;
            if (!isResync && !lrPreempt && previousCombatant?.actor) {
                await this._onPhaseEnd(previousCombatant, { segmentChanged: boundary });
            }

            // Backfill the slot-taken marker when the update that landed here couldn't
            // write it (player-initiated advances only persist combatants they own)
            const activeHold = activeCombatant?.heldAction;
            if (activeHold?.mode === "position") {
                const nowAbs = this.currentAbs;
                if (activeHold.segmentAbs === nowAbs && !activeCombatant.heldSlotTakenAt(nowAbs)) {
                    await activeCombatant.setFlag(game.system.id, "heldSlotTakenAbs", nowAbs);
                }
            }

            // The incoming combatant's Phase begins: maneuver effects that last "until
            // your next Phase" (Dodge, Block, Brace…) expire now. Effects created at
            // the current world time survive — they were declared this instant.
            // Because aborted Phases are skipped outright, an abort's modifiers
            // naturally persist to the Phase after the spent one.
            if (activeCombatant?.actor && !atLandingStop) {
                await expireManeuverNextPhaseEffects(activeCombatant.actor);
            }
            if ((!isResync || lrPreempt) && activeCombatant?.actor && !atLandingStop) {
                await this._onPhaseStart(activeCombatant);
            }

            // Auto-skip option (#3280): a Stunned character's Phase is spent
            // recovering — the stop advances itself, and _onPhaseEnd
            // clears the stun and cards the recovery as the turn ends. Deferred
            // OUT of the chain: nextTurn settles maintenance and would self-
            // deadlock awaiting the very chain running it (cf. LR auto-elevate).
            if (!isResync && !atLandingStop && activeCombatant?.actor?.statuses.has("stunned")) {
                const stunnedAutoSkip = !!_getSetting("stunnedAutoSkip", false);
                if (stunnedAutoSkip) {
                    const stunnedId = activeCombatant.id;
                    setTimeout(() => {
                        // Re-validate at fire time: the pointer may have moved, the
                        // stun may have been removed, or the combat ended
                        if (!this.started || this.combatant?.id !== stunnedId) return;
                        if (!this.combatant.actor?.statuses.has("stunned")) return;
                        this.nextTurn().catch((e) => console.error(e));
                    }, 0);
                }
            }
        };
        this._maintenanceChain = (this._maintenanceChain ?? Promise.resolve())
            .then(runMaintenance)
            .catch((e) => console.error(e));
    }

    /**
     * Awaits all queued segment maintenance. Pointer-reading entry points call
     * this first: the chains' combatant writes re-sort the turns array under the
     * numeric turn index, so live reads (this.combatant, isActive checks) taken
     * mid-flight can catch a transiently drifted pointer. Settled state is
     * always consistent.
     * @returns {Promise<void>}
     */
    async settleMaintenance({ timeout = 2000 } = {}) {
        // Bounded: a chain can legitimately stall on a user dialog (STUN-for-END
        // upkeep confirmation) — degrade to unsettled reads instead of hanging
        // the pointer controls behind it
        const deadline = new Promise((resolve) => setTimeout(() => resolve("timeout"), timeout));
        let chain;
        while ((chain = this._maintenanceChain)) {
            const winner = await Promise.race([chain.then(() => "chain"), deadline]);
            if (winner === "timeout") return;
            if (this._maintenanceChain === chain) break;
        }
    }

    /**
     * End-of-Phase work for the combatant whose turn just ended (port of the legacy
     * tracker's _onEndTurn): END-for-movement reporting, Stunned recovery at the end
     * of the character's own Phase (#4565), the KO'd per-Phase free Recovery that
     * wakes characters above STUN -10 (#4567), and — at segment boundaries — turning
     * off non-persistent constant items for Stunned/KO'd actors.
     * @param {Combatant} combatant
     * @param {object} [options]
     * @param {boolean} [options.segmentChanged]
     * @private
     */
    async _onPhaseEnd(combatant, { segmentChanged = false } = {}) {
        if (!this.started) return;
        const actor = combatant?.actor;
        if (!actor) return;

        // Show END spent for movement this Phase (spent realtime by the token's
        // movement recording); the counter resets at the next Phase start
        const endUsedForMovement = combatant.getFlag(game.system.id, "endUsedForMovement") || 0;
        if (endUsedForMovement > 0) {
            await ChatMessage.create({
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                author: game.user._id,
                speaker: ChatMessage.getSpeaker({ actor, token: combatant.token }),
                content: `${combatant.name} spent ${endUsedForMovement} END for movement this Phase.`,
                whisper: whisperUserTargetsForActor(actor),
            });
        }

        // At the end of the Segment, non-Persistent powers and skill levels turn
        // off for Stunned/KO'd actors
        if (segmentChanged) {
            for (const other of this.combatants) {
                const otherActor = other.actor;
                if (!otherActor) continue;
                if (otherActor.statuses.has("stunned") || otherActor.statuses.has("knockedOut")) {
                    for (const item of otherActor.getActiveConstantItems?.() ?? []) {
                        if (item.isActivatable?.()) await item.turnOff();
                    }
                }
            }
        }

        // Stunned clears at the end of the character's own Phase. The KO'd
        // per-Phase free Recovery is NOT granted here: RAW lands it at the very
        // end of the segment, and Skip Defeated means a KO'd combatant usually
        // never holds the pointer at all — _grantKoPhaseRecoveries sweeps every
        // KO'd combatant's Phases (skipped or not) at each segment boundary
        if (actor.statuses.has("stunned")) {
            await actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id, {
                active: false,
            });
            await this._combatCard(
                combatant,
                `${combatant.name} recovers from being stunned — their Phase was spent recovering and was skipped.`,
            );
        }
    }

    /**
     * The per-Phase free Recovery for Knocked Out characters (6E2 108, 5ER 411:
     * a KO'd character "cannot do anything except take Recoveries" and must take
     * one every Phase, at the very end of the segment — but never in the segment
     * they were Knocked Out). Runs at segment boundaries over every KO'd
     * combatant with a natural Phase in a just-ended segment, so Phases skipped
     * by Skip Defeated still recover. That Recovery (without
     * preventRecoverFromStun) is what wakes them once STUN climbs above 0;
     * deeply unconscious characters (STUN < -10) recover on the Post-Segment 12
     * path only, per the Recovery Time Table.
     * @param {number[]|null} [elapsedSegments] - Just-ended segment numbers, oldest
     *   first; null when a full Turn (12+) elapsed. Undefined means no segments
     *   elapsed (the combat-start update is a boundary write with no
     *   previousSegment) — treating it as a full Turn would sweep the 12
     *   pre-combat positions and grant phantom Recoveries that wake the
     *   character before the first advance.
     * @private
     */
    async _grantKoPhaseRecoveries(elapsedSegments) {
        if (!this.started) return;
        if (elapsedSegments === undefined) return;
        const currentAbs = this.currentAbs;
        const count = elapsedSegments?.length ?? 12;
        // Combat opens at Turn 1 Segment 12: no Phase can predate that position
        const combatStartAbs = HeroSystem6eCombatantSingle.absoluteSegment(1, 12);
        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            if (!actor?.statuses.has("knockedOut")) continue;
            const koStartAbs = combatant.getFlag(game.system.id, "koStartAbs");
            // Monotonic high-water stamp: overlapping chains and rewind replays
            // must not grant a second Recovery for the same Phase
            const granted = combatant.getFlag(game.system.id, "koRecoveredAbs") ?? 0;
            for (let abs = Math.max(currentAbs - count, combatStartAbs); abs < currentAbs; abs++) {
                // Re-checked per Phase, not per sweep: an earlier grant in this
                // very loop may have woken the character (TakeRecovery without
                // preventRecoverFromStun clears the KO once STUN climbs above 0)
                // or lifted them out of the every-Phase band
                if (!actor.statuses.has("knockedOut")) break;
                if ((actor.getCharacteristic("stun")?.value ?? 0) < -10) break;
                if (abs <= granted) continue;
                if (koStartAbs !== undefined && koStartAbs !== null && abs <= koStartAbs) continue;
                const segment = HeroSystem6eCombatantSingle.segmentOf(abs);
                if (!combatant.hasPhaseInSegment(segment, abs)) continue;
                await combatant.setFlag(game.system.id, "koRecoveredAbs", abs);
                await this._combatCard(
                    combatant,
                    `${combatant.name} is Knocked Out — their Phase in ${HeroSystem6eCombatantSingle.phaseLabel(abs)} is spent on a free Recovery.`,
                );
                await actor.TakeRecovery({ asAction: false, token: combatant.token });
            }
        }
    }

    /**
     * Start-of-Phase work for the incoming combatant (port of the legacy tracker's
     * _onStartTurn): movement-history reset, turnStart effect expiry (adjustment
     * fades — without it drains never fade during combat), non-combat movement
     * shutoff, the resource-upkeep chat card with its Breakfall button (#4559),
     * next-Phase DCV-penalty cleanup, and the instant-AoE region prompt (#4554).
     * Idempotent across re-fires and rewind replays via the spentEndOn key.
     * @param {Combatant} combatant
     * @private
     */
    async _onPhaseStart(combatant) {
        if (!this.started) return;
        const actor = combatant?.actor;
        if (!actor) return;
        const segmentNumber = this.segment;

        // Once per Phase: the stamp makes re-fires (LR split-Phase returns,
        // pointer repairs, overlapping update chains) and rewind replays no-ops —
        // without it a mid-Phase re-entry wipes the movement/END already accrued
        const roundSegmentKey = this.round + segmentNumber / 100;
        if ((combatant.getFlag(game.system.id, "spentEndOn") || 0) >= roundSegmentKey) return;
        await combatant.update({ [`flags.${game.system.id}.spentEndOn`]: roundSegmentKey });

        // Clear movement history and the END-for-movement counter
        try {
            if (combatant.token?.clearMovementHistory) {
                await combatant.setFlag(game.system.id, "endUsedForMovement", 0);
                await combatant.token.clearMovementHistory();
            }
        } catch (e) {
            console.error(e);
        }

        // Effects that expire at the start of the character's own Phase
        try {
            await expireEffects(actor, "turnStart");
        } catch (e) {
            console.error(e);
        }

        // Stop nonCombatMovement
        if (actor.statuses.has("nonCombatMovement")) {
            await actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.nonCombatMovementEffect.id, {
                active: false,
            });
        }

        // Spend resources for all active powers (the Phase-start stamp above
        // already guarantees once-per-Phase)
        await this._phaseStartUpkeepCard(combatant, segmentNumber);

        // Some attacks include a DCV penalty applied as an ActiveEffect flagged
        // nextPhase; it goes away at the start of our Phase
        const removeOnNextPhase = actor.effects.filter(
            (o) => o.flags[game.system.id]?.nextPhase && o.duration.startTime < game.time.worldTime,
        );
        for (const ae of removeOnNextPhase) {
            await ae.delete();
        }

        // Instant AoE templates have done their work once the Phase moves on (#4554)
        try {
            await promptToDeleteAoeInstantRegions();
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Posts the Phase-start resource-upkeep chat card: statuses, temporary
     * effects, continuing-power and encumbrance costs, and a Breakfall prompt.
     * @private
     */
    async _phaseStartUpkeepCard(combatant, segmentNumber) {
        const actor = combatant.actor;

        let content = "";
        let tempContent = "";
        let startContent = "";

        if (actor.statuses.size > 0) {
            startContent += `Has the following statuses: ${Array.from(actor.statuses).join(", ")}<br>`;
        }

        for (const ae of actor.temporaryEffects) {
            const remaining = ae._prepareDuration().remaining;
            const remainingText = remaining > 0 ? `in ${toHHMMSS(remaining)}` : "0s";
            tempContent += `<li>${ae.name} fades ${remainingText} ${ae.flags[game.system.id]?.expiresOn ?? ""}</li>`;
        }
        if (tempContent) {
            startContent += `Has the following temporary effects: <ul>${tempContent}</ul>`;
        }

        /**
         * @type {HeroSystemItemResourcesToUse}
         */
        const spentResources = {
            totalEnd: 0,
            totalReserveEnd: 0,
            totalCharges: 0,
        };

        for (const powerUsingResourcesToContinue of actor.items.filter(
            (item) =>
                item.isActive === true && // Is the power active?
                item.type !== "skill" && // Natural skills are always on, but only use resources when used/rolled
                item.system.duration !== CONFIG.HERO.DURATION_TYPES.INSTANT && // Is the power non instant
                (!item.system.MODIFIER?.find(
                    (o) =>
                        (o.XMLID === "COSTSEND" && o.OPTIONID === "ACTIVATE") || o.XMLID === "COSTSENDONLYTOACTIVATE",
                ) || // Does the power use END continuously?
                    (item.system.chargeModifier && !item.system.chargeModifier.CONTINUING)), // Does the power use charges but is not continuous (as that is tracked by an effect when made active)?
        )) {
            const {
                error,
                warning,
                resourcesUsedDescription,
                resourcesUsedDescriptionRenderedRoll,
                resourcesRequired,
            } = await userInteractiveVerifyOptionallyPromptThenSpendResources(powerUsingResourcesToContinue, {});

            if (error || warning) {
                content += `<li>(${powerUsingResourcesToContinue.name} ${error || warning}: power turned off)</li>`;
                await powerUsingResourcesToContinue.toggle();
            } else if (!(
                resourcesRequired.totalCharges === 0 &&
                resourcesRequired.totalEnd === 0 &&
                resourcesRequired.totalReserveEnd === 0
            )) {
                content += resourcesUsedDescription
                    ? `<li>${powerUsingResourcesToContinue.detailedName()} spent ${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}</li>`
                    : "";

                spentResources.totalEnd += resourcesRequired.totalEnd;
                spentResources.totalReserveEnd += resourcesRequired.totalReserveEnd;
                spentResources.totalCharges += resourcesRequired.totalCharges;
            }
        }

        // Encumbrance END upkeep
        const encumbered = actor.effects.find((effect) => effect.flags?.[game.system.id]?.encumbrance);
        if (encumbered) {
            const endCostPerTurn = Math.abs(parseInt(encumbered.flags?.[game.system.id]?.dcvDex)) - 1;
            if (endCostPerTurn > 0) {
                spentResources.totalEnd += endCostPerTurn;
                content += `<li>${encumbered.name} (${endCostPerTurn})</li>`;

                const value = parseInt(actor.getCharacteristic("end").value);
                await actor.updateCharacteristics([["end", { value: value - endCostPerTurn }]], {});
            }
        }

        if (
            startContent !== "" ||
            content !== "" ||
            spentResources.totalEnd > 0 ||
            spentResources.totalReserveEnd > 0 ||
            spentResources.totalCharges > 0
        ) {
            if (spentResources.totalEnd > 0 || spentResources.totalReserveEnd > 0 || spentResources.totalCharges > 0) {
                content = `${startContent}Spent ${spentResources.totalEnd} END, ${spentResources.totalReserveEnd} reserve END, and ${
                    spentResources.totalCharges
                } charge${spentResources.totalCharges > 1 ? "s" : ""} on turn ${
                    this.round
                } segment ${segmentNumber}:<ul>${content}</ul>`;
            } else {
                content = startContent;
            }

            // BREAKFALL from prone? Not while Stunned or KO'd — that Phase is
            // consumed by the recovery, so no maneuver is available
            if (actor.statuses.has("prone") && !actor.statuses.has("stunned") && !actor.statuses.has("knockedOut")) {
                const breakFallItem = actor.items.find((o) => o.system.XMLID === "BREAKFALL" && o.isActive);
                if (breakFallItem) {
                    content += `
                            <button class="roll-breakfall"
                                data-actor-uuid="${actor.uuid}"
                                data-target-token-id="${combatant.tokenId}"
                                title="You can use BREAKFALL to regain control from being prone without the need to take a Half Phase action.">
                                Roll Breakfall
                            </button>
                        `;
                }
            }

            await ChatMessage.create({
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content,
                whisper: whisperUserTargetsForActor(actor),
                speaker: ChatMessage.getSpeaker({ actor, token: combatant.token }),
            });
        }
    }

    /* -------------------------------------------- */
    /*  Delayed actions (Extra Time, Haymaker)      */
    /* -------------------------------------------- */

    /**
     * Delayed actions are things declared now that land later: a Haymaker (end of
     * the next Segment), or a power/attack with the Extra Time Limitation.
     * Stored on the combatant flag `delayedActions` keyed by id:
     *
     *   { kind: "haymaker"|"attack"|"activation",
     *     label, itemUuid, declaredAbs, resolveAbs,
     *     declaredPriority,  // stop position at declaration; rewinds keep the record
     *                        // until the landing re-opens that stop (null on old records)
     *     priority,          // marker position in the landing segment; null = very end
     *     landed,            // end-of-segment records: the landing stop fired its
     *                        // cards; the record persists until the segment is left
     *     gmPrompted,        // non-haymaker records: the incapacity adjudication
     *                        // whisper went out once already
     *     commit,            // true = no other Actions until it resolves (Extra Phase)
     *     targetTokenIds,    // live targets at declaration
     *     actionData? }      // roll-at-landing attacks only; rides to the landing card
     *
     * actionData (built by buildDelayedActionData in item-attack.mjs) is the replay
     * contract the landing card's roll/fail buttons consume:
     *
     *   { formData,          // sanitized dialog inputs (primitives only)
     *     targetTokenIds, userId,
     *     itemJson,          // dehydrateAttackItem snapshot — stringified ONCE
     *     originalItemUuid, actorUuid,
     *     prepaid }          // Extra Time paid resources at declaration; the replay
     *                        // passes prepaid+noResourceUse so nothing is re-charged.
     *                        // Haymakers set false — END is paid with the landing roll.
     *
     * The timeline shows a marker row in the landing segment; resolution happens in
     * the pointer-move maintenance chain; a chat Cancel button covers interruption
     * (GM-adjudicated — RAW makes interruption a judgment call, and END spent up
     * front stays spent).
     */

    /**
     * Resolves the combatant a given actor acts through. Synthetic token actors
     * share the base actor's id, so an actorId match alone would pin every
     * unlinked ×N sibling to the first combatant — match by token when possible.
     * @param {Actor} actor
     * @returns {Combatant|null}
     */
    combatantForActor(actor) {
        if (!actor) return null;
        if (actor.isToken && actor.token?.id) {
            return this.combatants.find((c) => c.tokenId === actor.token.id) ?? null;
        }
        return this.combatants.find((c) => c.actorId === actor.id) ?? null;
    }

    /**
     * Classifies an item's Extra Time Limitation into a delayed-action plan, or
     * null when the item has none that needs scheduling (Full Phase is pure action
     * economy; durations resolve on the character's DEX N segments later).
     * @param {Actor} actor
     * @param {Item} item
     * @returns {{kind: string, label: string, resolveAbs: number, priority: number|null,
     *            commit: boolean}|null}
     */
    extraTimePlan(actor, item) {
        if (!this.started || !actor || !item) return null;
        const extraTime = item.findModsByXmlid?.("EXTRATIME");
        if (!extraTime) return null;
        const combatant = this.combatantForActor(actor);
        if (!combatant) return null;

        const currentAbs = this.currentAbs;
        const characteristicKey = actor.system?.initiativeCharacteristic ?? "dex";
        const dex = actor.system?.characteristics?.[characteristicKey]?.value ?? 10;
        const optionId = extraTime.OPTIONID ?? "";
        const alias = extraTime.OPTION_ALIAS ?? extraTime.ALIAS ?? "";
        const matches = (needle) => optionId === needle.id || alias.toLowerCase().includes(needle.text);

        // Delayed Phase (-1/4): activates at HALF the character's DEX in the same
        // Phase (a Half Phase Action still happens at normal DEX)
        if (matches({ id: "DELAYEDPHASE", text: "delayed phase" })) {
            return {
                kind: "attack",
                label: `${item.name} (Delayed Phase)`,
                resolveAbs: currentAbs,
                priority: Math.floor(dex / 2),
                commit: false,
            };
        }
        // Extra Segment (-1/2): activates at the very end of the NEXT Segment,
        // multiple such powers in DEX order; a moved target is missed (adjudicated)
        if (matches({ id: "SEGMENT", text: "extra segment" })) {
            return {
                kind: "attack",
                label: `${item.name} (Extra Segment)`,
                resolveAbs: currentAbs + 1,
                priority: null,
                commit: false,
            };
        }
        // Full Phase (-1/2): activates on normal DEX; pure action economy — nothing
        // to schedule
        if (matches({ id: "FULL", text: "full phase" })) return null;
        // Extra Phase (-3/4): activates on the character's DEX in their SECOND
        // Phase; no other Actions in between or the power stops; END paid up front
        if (matches({ id: "EXTRA", text: "extra phase" })) {
            const spd = combatant.combatSpd;
            return {
                kind: "attack",
                label: `${item.name} (Extra Phase)`,
                resolveAbs: spd > 0 ? HeroSystem6eCombatantSingle.nextPhaseAbs(spd, currentAbs + 1) : currentAbs + 12,
                priority: dex,
                commit: true,
            };
        }
        // Durations: activates on the character's DEX N segments later; they may
        // act in the meantime unless the power needs an Attack Roll —
        // table-adjudicated, noted on the card
        const durations = [
            { id: "TURN", text: "1 turn", segments: 12 },
            { id: "MINUTE", text: "1 minute", segments: 60 },
            { id: "FIVEMINUTES", text: "5 minutes", segments: 300 },
            { id: "TWENTYMINUTES", text: "20 minutes", segments: 1200 },
            { id: "HOUR", text: "1 hour", segments: 3600 },
            { id: "SIXHOURS", text: "6 hours", segments: 21600 },
            { id: "DAY", text: "1 day", segments: 86400 },
        ];
        for (const duration of durations) {
            if (matches(duration)) {
                return {
                    kind: "attack",
                    label: `${item.name} (Extra Time: ${extraTime.OPTION_ALIAS ?? duration.text})`,
                    resolveAbs: currentAbs + duration.segments,
                    priority: dex,
                    commit: false,
                };
            }
        }
        // Longer periods (a week and up) cannot land inside a combat
        return null;
    }

    /**
     * Registers a delayed action for the actor's combatant and cards it with a
     * Cancel button. Owners write their own combatant flags, so no GM relay is
     * needed; the ledger append relays itself for players.
     * @param {Actor} actor
     * @param {object} plan - See {@link extraTimePlan}; itemUuid/targetTokenIds added here
     * @param {Item} [item]
     * @returns {Promise<string|null>} The delayed-action id, or null
     */
    async scheduleDelayedAction(actor, plan, item = null) {
        if (!this.started || !actor || !plan) return null;
        const combatant = this.combatantForActor(actor);
        if (!combatant) return null;
        // Dedupe: a pending record for the same item/label means this activation
        // is already underway (the item shows no active state until it lands)
        const planItemUuid = item?.uuid ?? plan.itemUuid ?? null;
        const duplicate = [...this.delayedActionsFor(combatant)].some(
            ([, r]) => (planItemUuid && r.itemUuid === planItemUuid) || r.label === plan.label,
        );
        if (duplicate) {
            ui.notifications.warn(`${plan.label} is already underway for ${actor.name}.`);
            return null;
        }
        const id = foundry.utils.randomID();
        const currentAbs = this.currentAbs;
        const record = {
            kind: plan.kind,
            label: plan.label,
            itemUuid: item?.uuid ?? plan.itemUuid ?? null,
            declaredAbs: currentAbs,
            declaredPriority: this.getFlag(game.system.id, "actingPriority") ?? null,
            resolveAbs: plan.resolveAbs,
            priority: plan.priority ?? null,
            commit: !!plan.commit,
            targetTokenIds: Array.from(game.user.targets ?? []).map((t) => t.id),
        };
        // Roll-at-resolution attacks carry their declaration inputs for the replay
        if (plan.actionData) record.actionData = plan.actionData;
        await combatant.setFlag(game.system.id, `delayedActions.${id}`, record);

        const landing =
            record.priority !== null
                ? `at DEX ${record.priority} in ${HeroSystem6eCombatantSingle.phaseLabel(record.resolveAbs)}`
                : `at the very end of ${HeroSystem6eCombatantSingle.phaseLabel(record.resolveAbs)}`;
        const commitText = record.commit ? " They can take no other Actions until it does." : "";
        await this._combatCard(
            combatant,
            `${actor.name} begins ${record.label} — it goes off ${landing}.${commitText}
            <button type="button" class="hero-delayed-now" data-combat-id="${this.id}" data-combatant-id="${combatant.id}" data-delayed-id="${id}">Resolve now</button>
            <button type="button" class="hero-delayed-cancel" data-combat-id="${this.id}" data-combatant-id="${combatant.id}" data-delayed-id="${id}">Cancel (interrupted)</button>`,
        );
        await this.logEvent("delayed.declare", { combatant, data: { ...record, id } });
        return id;
    }

    /**
     * Schedules a declared Haymaker's delayed landing: the attack resolves at the
     * end of the NEXT Segment, with the -5 DCV effect persisting until then.
     * Called from the attack workflow instead of ending the maneuver immediately.
     * @param {Actor} actor
     * @param {Item} [item] - The attack the Haymaker boosts
     * @returns {Promise<boolean>} Whether a resolution was scheduled
     */
    async scheduleHaymaker(actor, item = null) {
        if (!this.started || !actor) return false;
        const currentAbs = this.currentAbs;
        const id = await this.scheduleDelayedAction(
            actor,
            {
                kind: "haymaker",
                label: "their Haymaker",
                resolveAbs: currentAbs + 1,
                priority: null,
                commit: false,
            },
            item,
        );
        return id !== null;
    }

    /**
     * A delayed record's declared targets that still resolve to tokens.
     * @param {object} record
     * @returns {{name: string, hidden: boolean}[]}
     */
    delayedTargets(record) {
        const ids = record?.targetTokenIds?.length ? record.targetTokenIds : (record?.actionData?.targetTokenIds ?? []);
        const targets = [];
        for (const id of ids) {
            const doc = this.scene?.tokens?.get(id) ?? canvas?.tokens?.get(id)?.document;
            if (doc) targets.push({ name: doc.name, hidden: !!doc.hidden });
        }
        return targets;
    }

    /**
     * Display names of a delayed record's targets for chat cards. Cards render the
     * same content for every recipient, so GM-hidden tokens are masked outright.
     * @param {object} record
     * @returns {string[]}
     */
    delayedTargetNames(record) {
        return this.delayedTargets(record).map((t) => (t.hidden ? "a hidden target" : t.name));
    }

    /**
     * Pending end-of-segment landings at an absolute position (priority-null
     * records: Haymakers, Extra Segment attacks). These get a genuine pointer
     * stop after the segment's real stops. The legacy single-flag haymaker
     * predates the landing-stop flow and resolves on the pass-through path.
     * @param {number} abs
     * @param {object} [options]
     * @param {boolean} [options.includeLanded] - Also return records whose stop already fired
     * @returns {{combatant: Combatant, id: string, record: object}[]}
     */
    pendingLandingsAt(abs, { includeLanded = false } = {}) {
        const landings = [];
        for (const combatant of this.combatants) {
            for (const [id, record] of this.delayedActionsFor(combatant)) {
                if (id === "legacy-haymaker") continue;
                if (record.priority !== null && record.priority !== undefined) continue;
                if (record.resolveAbs !== abs) continue;
                if (record.landed && !includeLanded) continue;
                landings.push({ combatant, id, record });
            }
        }
        return landings;
    }

    /**
     * High-SPD Haymakers (6E2 69, applied in both editions per table ruling): a
     * character winding up a Haymaker is "still performing the Haymaker in the
     * next Segment, and therefore loses his Phase in that Segment". True while a
     * pending haymaker record lands at the given position — cancelling the
     * Haymaker deletes the record and the Phase comes straight back, because the
     * exclusion is derived from the live record, never stored.
     * @param {Combatant} combatant
     * @param {number} abs
     * @returns {boolean}
     */
    haymakerConsumesPhaseAt(combatant, abs) {
        return this.delayedActionsFor(combatant, "haymaker").some(([, record]) => record.resolveAbs === abs);
    }

    /**
     * Whether the combatant has any scheduled delayed action, optionally of a kind.
     * Reads the legacy single haymaker flag from in-flight combats too.
     * @param {Combatant} combatant
     * @param {string} [kind]
     * @returns {boolean}
     */
    hasDelayedAction(combatant, kind = null) {
        return this.delayedActionsFor(combatant, kind).length > 0;
    }

    /**
     * The combatant's scheduled delayed actions as [id, record] pairs (legacy
     * haymaker flag included), optionally filtered by kind.
     * @param {Combatant} combatant
     * @param {string} [kind]
     * @returns {[string, object][]}
     */
    delayedActionsFor(combatant, kind = null) {
        const records = Object.entries(combatant?.getFlag(game.system.id, "delayedActions") ?? {});
        const legacy = combatant?.getFlag(game.system.id, "haymaker");
        if (legacy) {
            records.push(["legacy-haymaker", { kind: "haymaker", label: "their Haymaker", commit: false, ...legacy }]);
        }
        return records.filter(([, record]) => !kind || record.kind === kind);
    }

    /**
     * Cancels a scheduled delayed action (interruption: the character took damage,
     * was Stunned/Knocked Out, or the target moved — GM-adjudicated; END already
     * spent stays spent per RAW).
     * @param {string} combatantId
     * @param {string} [delayedId] - Defaults to the combatant's only/legacy record
     * @returns {Promise<void>}
     */
    async cancelDelayedAction(combatantId, delayedId = null) {
        const combatant = this.combatants.get(combatantId);
        if (!combatant) return;
        if (!combatant.isOwner) {
            ui.notifications.warn(`Only ${combatant.name}'s owner (or the GM) can cancel this.`);
            return;
        }
        const records = this.delayedActionsFor(combatant);
        const entry = delayedId ? records.find(([id]) => id === delayedId) : records[0];
        if (!entry) {
            ui.notifications.warn(
                `${combatant.name} has no pending delayed action — it already resolved or was cancelled.`,
            );
            return;
        }
        await this._finishDelayedAction(combatant, entry[0], entry[1], { cancelled: true });
    }

    /**
     * Resolves a scheduled delayed action immediately (owner/GM fiat — e.g. the
     * table rules the moment has come, or wants to skip the wait).
     * @param {string} combatantId
     * @param {string} [delayedId] - Defaults to the combatant's only/legacy record
     * @returns {Promise<void>}
     */
    async resolveDelayedActionNow(combatantId, delayedId = null) {
        const combatant = this.combatants.get(combatantId);
        if (!combatant) return;
        if (!combatant.isOwner) {
            ui.notifications.warn(`Only ${combatant.name}'s owner (or the GM) can resolve this.`);
            return;
        }
        const records = this.delayedActionsFor(combatant);
        const entry = delayedId ? records.find(([id]) => id === delayedId) : records[0];
        if (!entry) {
            ui.notifications.warn(
                `${combatant.name} has no pending delayed action — it already resolved or was cancelled.`,
            );
            return;
        }
        if (entry[1]?.landed) {
            // The landing stop already fired this record's cards — resolving
            // "again" would mint a second, independently rollable attack card
            ui.notifications.warn(
                `${combatant.name}'s ${entry[1].label ?? "delayed action"} is already resolving — use its roll card.`,
            );
            return;
        }
        await this._finishDelayedAction(combatant, entry[0], entry[1], { cancelled: false, early: true });
    }

    /**
     * Backward-compatible alias for in-flight Haymaker cancel buttons.
     * @param {string} combatantId
     * @returns {Promise<void>}
     */
    async cancelHaymaker(combatantId) {
        const combatant = this.combatants.get(combatantId);
        if (!combatant?.isOwner) return;
        const entry = this.delayedActionsFor(combatant, "haymaker")[0];
        if (entry) await this._finishDelayedAction(combatant, entry[0], entry[1], { cancelled: true });
    }

    /**
     * Voids any outstanding roll cards for a delayed record: their buttons grey
     * out and a click explains the attack already resolved. A landed record's
     * roll card outlives the record when the landing is cancelled at the stop
     * (Stunned at the last moment) — without this the cancelled attack could
     * still be rolled from chat. Players relay through the GM socket.
     * @param {string} delayedId
     * @private
     */
    async _voidDelayedRollCards(delayedId) {
        if (!delayedId) return;
        for (const message of game.messages.contents) {
            const payload = message.getFlag(game.system.id, "delayedAttack");
            if (!payload || payload.delayedId !== delayedId || payload.resolved) continue;
            if (game.user.isGM) {
                await message.setFlag(game.system.id, "delayedAttack.resolved", true);
            } else {
                game.socket.emit(`system.${game.system.id}`, {
                    operation: "markDelayedCardResolved",
                    userId: game.user.id,
                    messageId: message.id,
                });
            }
        }
    }

    /**
     * Resolves delayed actions whose moment has arrived. Runs on every pointer
     * move: a record lands when its segment has fully passed, when the count
     * passes below its declared position within the segment, or — for records
     * that activate on the character's own DEX — when their Phase begins.
     * @private
     */
    async _resolveDelayedActions() {
        if (!this.started) return;
        const currentAbs = this.currentAbs;
        const actingPriority = this.getFlag(game.system.id, "actingPriority");
        const activeId = this.combatant?.id ?? null;
        const atLandingStop = this.atDelayedLandingStop;
        for (const combatant of this.combatants) {
            for (const [id, record] of this.delayedActionsFor(combatant)) {
                const endOfSegment = record.priority === null || record.priority === undefined;
                if (endOfSegment && id !== "legacy-haymaker") {
                    // Landing-stop flow: the roll/apply cards fire when the pointer
                    // ARRIVES at the stop; the record stays (marked landed) so the
                    // marker row and the stop hold, then cleans up silently once
                    // the segment is left. Jumping past without a stop (nextRound,
                    // replays) falls back to the old pass-through resolution.
                    if (record.landed) {
                        if (currentAbs > record.resolveAbs) {
                            await combatant.update({ [`flags.${game.system.id}.delayedActions.-=${id}`]: null });
                        }
                    } else if (currentAbs === record.resolveAbs && atLandingStop) {
                        await this._finishDelayedAction(combatant, id, record, { cancelled: false, keepMarker: true });
                    } else if (currentAbs > record.resolveAbs) {
                        await this._finishDelayedAction(combatant, id, record, { cancelled: false });
                    }
                    continue;
                }
                const segmentPassed = currentAbs > record.resolveAbs;
                const countPassed =
                    currentAbs === record.resolveAbs &&
                    record.priority !== null &&
                    record.priority !== undefined &&
                    actingPriority !== null &&
                    actingPriority !== undefined &&
                    actingPriority < record.priority;
                // priority-null records resolve at the very END of the segment —
                // the declarer's own natural Phase in the landing segment must not
                // pull the landing forward to their Phase start
                const ownPhase =
                    currentAbs === record.resolveAbs &&
                    record.priority !== null &&
                    record.priority !== undefined &&
                    combatant.id === activeId;
                if (segmentPassed || countPassed || ownPhase) {
                    await this._finishDelayedAction(combatant, id, record, { cancelled: false });
                }
            }
        }
    }

    /**
     * Shared teardown: clears the record, performs kind-specific work (Haymaker
     * effect/maneuver cleanup; deferred activations actually turn on), cards the
     * outcome, and ledgers it.
     * @param {Combatant} combatant
     * @param {string} id
     * @param {object} record
     * @param {object} options
     * @param {boolean} options.cancelled
     * @param {boolean} [options.early]
     * @param {string} [options.reason] - Cancellation cause, appended to the outcome card
     * @param {boolean} [options.keepMarker] - Landing-stop flow: fire the cards but
     *   mark the record landed instead of deleting it, so the marker row and the
     *   stop persist until the segment is left
     * @private
     */
    async _finishDelayedAction(
        combatant,
        id,
        record,
        { cancelled, early = false, reason = null, keepMarker = false } = {},
    ) {
        const actor = combatant.actor;
        const momentLabel = early
            ? `${this.currentPhaseLabel}, early`
            : HeroSystem6eCombatantSingle.phaseLabel(record.resolveAbs ?? 0);
        // Declaration labels read "their Haymaker" for the "X begins…" card;
        // possessive outcome cards drop the pronoun ("X's their Haymaker" #4603)
        const label = (record.label ?? "").replace(/^their\s+/i, "");
        const targetNames = this.delayedTargetNames(record);
        const targetText = targetNames.length ? ` against ${targetNames.join(", ")}` : "";
        if (id === "legacy-haymaker") {
            await combatant.update({ [`flags.${game.system.id}.haymaker`]: null });
        } else if (keepMarker && !cancelled) {
            await combatant.setFlag(game.system.id, `delayedActions.${id}.landed`, true);
        } else {
            // Cancelling after the landing stop fired: the roll card is already
            // out — void it so the cancelled attack can't still be rolled
            if (cancelled && record.landed) await this._voidDelayedRollCards(id);
            await combatant.update({ [`flags.${game.system.id}.delayedActions.-=${id}`]: null });
        }

        // A cancelled Haymaker (or a legacy declare-now record) ends the maneuver
        // here; a roll-at-landing Haymaker keeps it ACTIVE — its +4 DC / -5 DCV
        // must still apply to the roll, and the attack flow's own tail turns the
        // maneuver off once the attack has rolled
        if (record.kind === "haymaker" && (cancelled || !record.actionData)) {
            await endHaymakerManeuver(actor, { token: combatant.token });
        }

        let outcome;
        if (cancelled) {
            outcome = `${actor?.name}'s ${label} is interrupted and lost${reason ? ` — ${reason}` : ""}${record.kind === "activation" ? " (resources already spent stay spent)" : ""}.`;
        } else if (record.kind === "activation") {
            const item = record.itemUuid ? fromUuidSync(record.itemUuid) : null;
            if (item && !item.isActive) {
                // Resources and rolls were paid when the activation began (RAW:
                // END up front); delayedResolution skips re-charging them
                await item.turnOn({ delayedResolution: true, token: combatant.token });
            }
            outcome = item?.isActive
                ? `${actor?.name}'s ${label} activates now (${momentLabel}).`
                : `${actor?.name}'s ${label} finished its Extra Time but could not activate — adjudicate (interrupted? Stunned?).`;
        } else if ((record.kind === "attack" || record.kind === "haymaker") && record.actionData) {
            // The attack is ROLLED now (it happens when it goes off); the stored
            // declaration rides on the message flag
            outcome = null;
            const hint =
                record.kind === "haymaker"
                    ? "+4 Damage Classes; END is paid with this roll. If the target moved 1m+ or the attacker took Knockback, was Stunned, or Knocked Out, the Haymaker fails — use the failure button instead: the Phase is wasted but the END is still owed."
                    : "A target that moved since the declaration is missed automatically; resources were already spent when the activation began.";
            const failButton =
                record.kind === "haymaker"
                    ? `\n                    <button type="button" class="hero-delayed-fail">Fails — spend END only</button>`
                    : "";
            const rollCard = {
                speaker: ChatMessage.getSpeaker({ actor }),
                content: `${actor?.name}'s ${label} ${record.kind === "haymaker" ? "lands" : "goes off"} now (${momentLabel})${targetText} — roll the attack.
                    <button type="button" class="hero-delayed-roll">Roll the attack now</button>${failButton}
                    <p class="hint">${hint}</p>`,
                flags: {
                    [game.system.id]: {
                        // delayedId ties the card back to its record so a
                        // cancel-after-landing can void the outstanding roll
                        delayedAttack: { itemUuid: record.itemUuid, delayedId: id, ...record.actionData },
                    },
                },
            };
            if (combatant.hidden) rollCard.whisper = ChatMessage.getWhisperRecipients("GM");
            await ChatMessage.create(rollCard);
        } else if (record.kind === "haymaker") {
            outcome = `${actor?.name}'s ${label} resolves now${targetText} — apply its damage (${momentLabel}).`;
        } else {
            outcome = `${actor?.name}'s ${label} goes off now (${momentLabel})${targetText} — resolve its effect. A target that moved since the declaration is missed automatically.`;
        }
        if (outcome) await this._combatCard(combatant, outcome);
        await this.logEvent(cancelled ? "delayed.cancel" : "delayed.resolve", {
            combatant,
            data: { id, kind: record.kind, label: record.label, resolveAbs: record.resolveAbs ?? null, early },
        });
    }

    /* -------------------------------------------- */
    /*  Combatant add/delete reconciliation         */
    /* -------------------------------------------- */

    /** @override */
    _preCreateDescendantDocuments(parent, collection, data, options, userId) {
        super._preCreateDescendantDocuments(parent, collection, data, options, userId);
        if (collection === "combatants" && this.started) {
            // Captured before core re-sorts turns under the numeric index
            this._pointerBeforeCombatantChange = this.combatant?.id ?? null;
        }
    }

    /** @override */
    _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
        super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
        if (collection !== "combatants") return;
        const activeIdBefore = this._pointerBeforeCombatantChange ?? null;
        this._pointerBeforeCombatantChange = null;
        if (!game.users.activeGM?.isSelf || !this.started) return;
        this._reconcileCreatedCombatants(documents, activeIdBefore).catch((e) => console.error(e));
    }

    /** @override */
    _preDeleteDescendantDocuments(parent, collection, ids, options, userId) {
        super._preDeleteDescendantDocuments(parent, collection, ids, options, userId);
        if (collection === "combatants" && this.started) {
            // Snapshot while the combatants (and their priorities) still resolve;
            // only present on the initiating client — _onDelete falls back otherwise
            this._preDeleteCapture = {
                activeId: this.combatant?.id ?? null,
                events: ids
                    .map((id) => {
                        const combatant = this.combatants.get(id);
                        if (!combatant) return null;
                        return this.buildEvent("combatant.remove", {
                            combatant,
                            data: { snapshot: { tokenId: combatant.tokenId ?? null } },
                        });
                    })
                    .filter(Boolean),
            };
        }
    }

    /**
     * Deleting the combat clears hold/abort effects bound to its combatants —
     * no maintenance path matches a dead combatant id, so they would orphan on
     * the actors (stuck icon, hidden Release/Use entries).
     * @override
     */
    _onDelete(options, userId) {
        super._onDelete(options, userId);
        if (userId !== game.user.id) return;
        const combatantIds = new Set(this.combatants.map((c) => c.id));
        for (const combatant of this.combatants) {
            for (const effect of combatant.actor?.effects ?? []) {
                const isHold = effect.statuses.has("holding");
                const isAbort = effect.statuses.has("aborted");
                if (!isHold && !isAbort) continue;
                const record = effect.getFlag(game.system.id, isHold ? "hold" : "abort");
                // Unbound records and records bound to THIS combat are dead;
                // records bound to another combat stay untouched
                if (!record?.combatantId || combatantIds.has(record.combatantId)) {
                    effect.delete().catch((e) => console.warn(`Combat-delete effect cleanup failed`, e));
                }
            }
        }
    }

    /** @override */
    _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
        super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
        if (collection !== "combatants") return;
        const capture = this._preDeleteCapture ?? null;
        this._preDeleteCapture = null;
        if (!game.users.activeGM?.isSelf || !this.started) return;
        this._reconcileDeletedCombatants(capture, documents).catch((e) => console.error(e));
    }

    /**
     * Repairs combat state after combatants join mid-combat: duplicate adds are
     * removed, tie-break rolls are backfilled for every recorded position (a
     * newcomer otherwise sorts at the +0.50 default — #4566), initiative and the
     * SPD baseline are seeded, stale hold/abort effects bound to removed combatants
     * are cleared, and the turn index is re-pointed at the active combatant.
     * @param {Combatant[]} created
     * @param {string|null} activeIdBefore
     * @private
     */
    async _reconcileCreatedCombatants(created, activeIdBefore) {
        // 1. De-dupe: a token (or tokenless actor) fields exactly one combatant
        const deleteIds = new Set();
        let legacyDupes = false;
        for (const combatant of created) {
            if (!this.combatants.has(combatant.id)) continue;
            const key = combatant.tokenId || combatant.actorId;
            if (!key) continue;
            const dupes = this.combatants.filter((c) => (c.tokenId || c.actorId) === key);
            if (dupes.length <= 1) continue;
            if (dupes.length > 2) legacyDupes = true;
            const keeper = dupes.find((c) => !created.some((n) => n.id === c.id)) ?? dupes[0];
            for (const dupe of dupes) {
                if (dupe.id !== keeper.id && created.some((n) => n.id === dupe.id)) deleteIds.add(dupe.id);
            }
        }
        if (deleteIds.size > 0) {
            await this.deleteEmbeddedDocuments("Combatant", [...deleteIds]);
            ui.notifications.info(`Duplicate combatant(s) removed — one combatant per token.`);
        }
        if (legacyDupes) {
            ui.notifications.warn(
                `This combat has legacy per-Phase duplicate combatants. Run game.herosystem6e.migrateCombatsToSingleCombatantTracker() to collapse them.`,
            );
        }
        const survivors = created.filter((c) => this.combatants.has(c.id));
        if (survivors.length === 0) return;

        // 2. Backfill tie-break rolls (and member sub-rolls) for every recorded position
        const masterRollsCache = this._segmentRollsClone();
        const rollsDirty = this._backfillTieRolls(masterRollsCache, survivors);

        // 3. Stale effect reconciliation: hold/abort records bound to a combatant
        // no longer in this combat are meaningless on re-add
        for (const combatant of survivors) {
            for (const effect of combatant.actor?.effects ?? []) {
                const isHold = effect.statuses.has("holding");
                const isAbort = effect.statuses.has("aborted");
                if (!isHold && !isAbort) continue;
                const record = effect.getFlag(game.system.id, isHold ? "hold" : "abort");
                if (record?.combatantId && !this.combatants.has(record.combatantId)) {
                    await effect.delete();
                    await this._combatCard(
                        combatant,
                        `${combatant.actor.name}'s stale ${isHold ? "Held Action" : "abort"} from a removed combatant was cleared.`,
                    );
                }
            }
        }

        // 4. Seed initiative and the SPD-change baseline. knownSpd must be the
        // OBJECT shape: a scalar normalizes as source=effective, and a combatant
        // added with an SPD-modifying effect would trip a bogus adjustment lockout
        await this.updateEmbeddedDocuments(
            "Combatant",
            survivors.map((c) => ({
                _id: c.id,
                initiative: this.getInitiativePriority(c, this.segment),
                [`flags.${game.system.id}.knownSpd`]: {
                    effective: c.combatSpd,
                    source: Number(c.actor?._source?.system?.characteristics?.spd?.value ?? c.combatSpd),
                },
            })),
        );

        // 5. Re-point the turn index at the active combatant (the index addresses a
        // freshly sorted array) and commit rolls + ledger in one update
        const payload = {};
        if (rollsDirty) payload[`flags.${game.system.id}.segmentRolls`] = masterRollsCache;
        Object.assign(
            payload,
            this.eventLogAppendPayload(survivors.map((c) => this.buildEvent("combatant.add", { combatant: c }))),
        );
        const activeId = activeIdBefore ?? this.combatant?.id ?? null;
        if (activeId && this.combatants.has(activeId)) {
            const index = this.turns.findIndex((t) => t.id === activeId);
            if (index !== -1 && index !== this.turn) payload.turn = index;
        }
        // previousCombatantId marks the index repair as a resync — without it the
        // active combatant would get a spurious mid-Phase start (movement wipe)
        await this.update(payload, { direction: 1, previousCombatantId: activeId ?? undefined });
    }

    /**
     * Repairs combat state after combatants are removed mid-combat: the removal is
     * ledgered with a snapshot (history rows survive), and the turn index is
     * re-pointed — at the surviving active combatant, or at the next combatant by
     * the recorded acting-priority threshold when the active one was deleted. When
     * the deletion empties the segment entirely, the pointer advances to the next
     * populated segment instead of stranding the combat on "nobody's turn".
     * @param {{activeId: string|null, events: object[]}|null} capture
     * @param {Combatant[]} documents - The deleted combatant documents (detached)
     * @private
     */
    async _reconcileDeletedCombatants(capture, documents) {
        // The initiating client snapshots in _preDelete; other clients (e.g. the GM
        // relaying a player deletion) reconstruct from the detached documents
        const events =
            capture?.events ??
            documents.map((combatant) =>
                this.buildEvent("combatant.remove", {
                    combatant,
                    priority: 0,
                    data: { snapshot: { tokenId: combatant.tokenId ?? null } },
                }),
            );
        const activeId = capture?.activeId ?? this.previous?.combatantId ?? null;
        const payload = this.eventLogAppendPayload(events);

        if (activeId && this.combatants.has(activeId)) {
            const index = this.turns.findIndex((t) => t.id === activeId);
            if (index !== -1 && index !== this.turn) payload.turn = index;
        } else if (activeId) {
            // The active combatant was deleted: select the next actor below the
            // recorded acting position, exactly as nextTurn's threshold does
            const segment = this.segment;
            const currentAbs = this.currentAbs;
            const priorPriority = this.getFlag(game.system.id, "actingPriority");
            const candidates = this.combatants.contents
                .filter((c) => {
                    if (!this._takesTurnInSegment(c, segment, { queryAbs: currentAbs })) return false;
                    const hold = c.heldAction;
                    const heldHere = hold?.mode === "position" && hold.segmentAbs === currentAbs;
                    if (heldHere && c.heldSlotTakenAt(currentAbs)) return false;
                    if (priorPriority === null || priorPriority === undefined) return true;
                    return this.getInitiativePriority(c, segment) < priorPriority;
                })
                .sort((a, b) => this._comparePriority(a, b, this, segment));
            const target = candidates[0] ?? null;
            if (target) {
                const index = this.turns.findIndex((t) => t.id === target.id);
                if (index !== -1) {
                    payload.turn = index;
                    payload[`flags.${game.system.id}.actingPriority`] = this.getInitiativePriority(target, segment);
                }
            } else if (this.combatants.size > 0) {
                // Deletion emptied the segment: ledger the removals, then a
                // same-segment landing stop if one is due, else advance to the
                // next populated segment (ending: null — the deleted combatant
                // gets no phase-end work; nobody re-enters via a held slot)
                await this.update(payload, { direction: 1, previousCombatantId: activeId ?? undefined });
                const landing = await this._advanceToLandingStop({ currentAbs: this.currentAbs, ending: null });
                if (landing) return;
                await this._advanceToNextSegment({
                    allCombatants: this.combatants.contents,
                    activeSegment: this.segment,
                    currentAbs: this.currentAbs,
                    ending: null,
                    endingAtHeldSlot: false,
                    storedActingPriority: this.getFlag(game.system.id, "actingPriority"),
                });
                return;
            }
        }
        // A surviving active combatant makes this a pure resync (prev === active,
        // phase work skipped); when the active was deleted, prev resolves to no
        // combatant and the successor's Phase start runs normally
        await this.update(payload, { direction: 1, previousCombatantId: activeId ?? undefined });
    }

    /**
     * Clears an event/generic hold when the holder's natural turn comes around: the
     * arriving Phase replaces the banked one. Guarded against self-advance from the
     * declaring Phase itself (declaring a hold ends the turn, which would otherwise
     * consume the hold in the same breath). In sparse combats every advance leads
     * from the holder back to the holder, so the guard checks the recorded
     * declaration position rather than exempting all self-advances — otherwise a
     * solo holder banks an extra action forever. Bare-status holds carry no record
     * and stay GM-adjudicated. Positional holds are exempt; they expire with their
     * slot.
     * @param {string|undefined} previousCombatantId
     * @private
     */
    async _consumeActiveCombatantHold(previousCombatantId) {
        if (!this.started) return;
        const combatant = this.combatant;
        const actor = combatant?.actor;
        const hold = combatant?.heldAction;
        if (!actor || !hold) return;
        if (combatant.id === previousCombatantId) {
            const declaredAbs = hold.declaredAbs;
            if (declaredAbs === undefined || declaredAbs >= this.currentAbs) return;
        }
        if (!combatant.hasPhaseInSegment(this.segment)) return;
        // Positional holds expire with their slot, never at a natural Phase
        if (hold.mode === "position") return;

        const holdingEffect = combatant.heldActionEffect;
        if (!holdingEffect) return;
        await holdingEffect.delete();

        await this._combatCard(
            combatant,
            `${actor.name}'s Held Action was replaced by their natural Phase in ${this.currentPhaseLabel}.`,
        );
        await this.logEvent("hold.consume", { combatant, data: { mode: hold.mode } });
    }

    /**
     * Detects SPD changes (Aid/Drain, form switches) since the previous segment boundary and
     * applies the SPD-change lockout: the character cannot act until both the old and the new
     * SPD would have had a Phase. Also clears lockouts once they have passed.
     * Detection polls at segment boundaries so ActiveEffect-driven changes are caught without
     * actor-update hooks; a change made and reverted within one segment is intentionally ignored.
     * @private
     */
    async _maintainSpdChanges() {
        if (!this.started) return;

        const currentAbs = this.currentAbs;
        const combatantUpdates = [];

        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            if (!actor) continue;

            // The baseline tracks both the effective SPD (with active effects) and
            // the sheet's source value: an effective-only change is adjustment-driven
            // (Aid/Drain — the mandatory lockout applies); a source change is a
            // voluntary edit, which only takes effect at Post-Segment 12
            const sourceSpd = Number(actor._source?.system?.characteristics?.spd?.value);
            const pending = combatant.getFlag(game.system.id, "pendingSpd");
            const rawKnown = combatant.getFlag(game.system.id, "knownSpd");
            const known =
                rawKnown === undefined || rawKnown === null
                    ? undefined
                    : typeof rawKnown === "object"
                      ? rawKnown
                      : { effective: rawKnown, source: rawKnown };
            const lockout = combatant.getFlag(game.system.id, "spdLockout");

            if (known === undefined) {
                combatantUpdates.push({
                    _id: combatant.id,
                    [`flags.${game.system.id}.knownSpd`]: { effective: combatant.combatSpd, source: sourceSpd },
                });
                continue;
            }

            // A deferred voluntary change applies once Post-Segment 12 has passed
            // since it was declared — the change is free at that point
            if (pending) {
                const declaredRound = HeroSystem6eCombatantSingle.roundOf(pending.declaredAbs ?? currentAbs);
                if (currentAbs > declaredRound * 12 + 12) {
                    combatantUpdates.push({
                        _id: combatant.id,
                        [`flags.${game.system.id}.pendingSpd`]: null,
                        [`flags.${game.system.id}.knownSpd`]: { effective: pending.newSpd, source: sourceSpd },
                    });
                    await this._combatCard(
                        combatant,
                        `${actor.name}'s SPD change to ${pending.newSpd} takes effect (Post-Segment 12 has passed).`,
                        { ownersOnly: true },
                    );
                    await this.logEvent("spd.clear", {
                        combatant,
                        data: { previousSpd: known.effective, newSpd: pending.newSpd, deferred: true },
                    });
                }
                continue;
            }

            // combatant.combatSpd would report the OLD value while a pendingSpd flag
            // exists, so read the live effective SPD directly here
            const spd = combatant.combatSpd;

            if (spd !== known.effective || (Number.isFinite(sourceSpd) && sourceSpd !== known.source)) {
                const sourceChanged = Number.isFinite(sourceSpd) && sourceSpd !== known.source;
                const effectiveChanged = spd !== known.effective;

                // Purely voluntary (sheet edit): defer to Post-Segment 12 —
                // voluntary changes wait for the end of the Turn
                if (sourceChanged && !effectiveChangedBeyondSource(spd, known, sourceSpd)) {
                    combatantUpdates.push({
                        _id: combatant.id,
                        [`flags.${game.system.id}.pendingSpd`]: { newSpd: spd, declaredAbs: currentAbs },
                    });
                    await this._combatCard(
                        combatant,
                        `${actor.name}'s SPD was changed from ${known.effective} to ${spd}. A voluntary SPD change takes effect at Post-Segment 12; until then they act at SPD ${known.effective}.`,
                        { ownersOnly: true },
                    );
                    await this._whisperSpdOverridePrompt(combatant, known.effective, spd);
                    await this.logEvent("spd.deferred", {
                        combatant,
                        data: { previousSpd: known.effective, newSpd: spd },
                    });
                    continue;
                }

                // Adjustment-driven (or mixed): the mandatory lockout applies now
                const update = {
                    _id: combatant.id,
                    [`flags.${game.system.id}.knownSpd`]: { effective: spd, source: sourceSpd },
                };
                if (sourceChanged && effectiveChanged) {
                    // Both moved in one poll window: treat as adjustment, but tell the GM
                    await ChatMessage.create({
                        content: `<p>${actor.name}'s SPD changed in both sheet value and active effects at once; treating it as an adjustment-driven change (lockout applies). Use Cancel Abort/rewind tools if this was a voluntary edit.</p>`,
                        whisper: ChatMessage.getWhisperRecipients("GM"),
                    });
                }
                Object.assign(update, this._spdLockoutUpdate(combatant, known, spd, currentAbs));
                combatantUpdates.push(update);
                continue;
            }

            if (lockout?.lockoutEndAbs && currentAbs >= lockout.lockoutEndAbs) {
                await combatant.unsetFlag(game.system.id, "spdLockout");
                await this.logEvent("spd.clear", { combatant, data: { previousSpd: lockout.previousSpd } });
            }
        }

        if (combatantUpdates.length > 0) {
            await this.updateEmbeddedDocuments("Combatant", combatantUpdates);
        }

        // Helper hoisted for readability: a source-only change means the effective
        // SPD moved exactly with the sheet (no separate adjustment component)
        function effectiveChangedBeyondSource(spd, known, sourceSpd) {
            const sourceDelta = sourceSpd - (known.source ?? sourceSpd);
            return spd - known.effective !== sourceDelta;
        }
    }

    /**
     * Builds the spdLockout flag entry (and posts the card + ledger event) for an
     * adjustment-driven SPD change, using the edition-appropriate rule:
     * 6e — cannot act until both SPDs would have had a Phase;
     * 5e — cannot act until the next Segment that is a Phase for BOTH.
     * @param {Combatant} combatant
     * @param {{effective: number, source: number}} known
     * @param {number} newSpd
     * @param {number} currentAbs
     * @returns {object} Flag-path fragment for the combatant update
     * @private
     */
    _spdLockoutUpdate(combatant, known, newSpd, currentAbs) {
        const oldSpd = known.effective;
        // A change from or to SPD 0 has no pending old/new Phase to wait for
        if (!(oldSpd > 0 && newSpd > 0)) return {};

        const is5e = !!combatant.actor?.is5e;
        const lockoutEndAbs = is5e
            ? HeroSystem6eCombatantSingle.nextSharedPhaseAbs(oldSpd, newSpd, currentAbs)
            : Math.max(
                  HeroSystem6eCombatantSingle.nextPhaseAbs(oldSpd, currentAbs),
                  HeroSystem6eCombatantSingle.nextPhaseAbs(newSpd, currentAbs),
              );
        if (lockoutEndAbs <= currentAbs) return {};

        const ruleText = is5e
            ? `They cannot act until the next Segment that is a Phase for both SPDs`
            : `They cannot act until both SPDs would have had a Phase`;
        this._combatCard(
            combatant,
            `${combatant.actor.name}'s SPD changed from ${oldSpd} to ${newSpd}. ${ruleText} (${HeroSystem6eCombatantSingle.phaseLabel(lockoutEndAbs)}).`,
        ).catch((e) => console.error(e));
        this.logEvent("spd.lockout", {
            combatant,
            data: { previousSpd: oldSpd, newSpd, lockoutEndAbs, is5e },
        }).catch((e) => console.error(e));

        return {
            [`flags.${game.system.id}.spdLockout`]: {
                previousSpd: oldSpd,
                // Rewinds revert to the full pre-change baseline
                previousKnown: known,
                lockoutEndAbs,
                lockoutStartAbs: currentAbs,
            },
        };
    }

    /**
     * Whispers the GM an "apply immediately" escape hatch for a deferred voluntary
     * SPD change (GM fiat: treat it as an immediate change with the normal lockout).
     * @param {Combatant} combatant
     * @param {number} oldSpd
     * @param {number} newSpd
     * @private
     */
    async _whisperSpdOverridePrompt(combatant, oldSpd, newSpd) {
        const whisper = ChatMessage.getWhisperRecipients("GM");
        if (whisper.length === 0) return;
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
            whisper,
            content: `<p>${combatant.actor.name}'s voluntary SPD change (${oldSpd} → ${newSpd}) is deferred to Post-Segment 12.</p>
                <button type="button" class="hero-spd-apply-now" data-combat-id="${this.id}" data-combatant-id="${combatant.id}">Apply immediately (with SPD-change lockout)</button>`,
        });
    }

    /**
     * GM fiat: applies a deferred voluntary SPD change right now, with the normal
     * adjustment-style lockout.
     * @param {string} combatantId
     * @returns {Promise<void>}
     */
    async applyPendingSpdNow(combatantId) {
        if (!game.user.isGM || !this.started) return;
        const combatant = this.combatants.get(combatantId);
        const pending = combatant?.getFlag(game.system.id, "pendingSpd");
        if (!pending) return;
        const rawKnown = combatant.getFlag(game.system.id, "knownSpd");
        const known =
            typeof rawKnown === "object" && rawKnown !== null ? rawKnown : { effective: rawKnown, source: rawKnown };
        const currentAbs = this.currentAbs;
        const sourceSpd = Number(combatant.actor?._source?.system?.characteristics?.spd?.value);
        const update = {
            _id: combatant.id,
            [`flags.${game.system.id}.pendingSpd`]: null,
            [`flags.${game.system.id}.knownSpd`]: { effective: pending.newSpd, source: sourceSpd },
        };
        Object.assign(update, this._spdLockoutUpdate(combatant, known, pending.newSpd, currentAbs));
        await this.updateEmbeddedDocuments("Combatant", [update]);
    }

    /**
     * Handles positional Held Actions whose declared segment has been left behind.
     * A slot the pointer actually took is spent; a slot that passed UNUSED demotes
     * to a generic hold — the banked Phase persists until the null zone (the hold
     * is only lost when the segment of the holder's next natural Phase begins,
     * handled by _consumeActiveCombatantHold / _consumeExpiredHeldActions).
     * Within-segment passes are caught by the previous-combatant check in _onUpdate.
     * @private
     */
    async _demotePassedPositionalHolds() {
        if (!this.started) return;
        const currentAbs = this.currentAbs;
        for (const combatant of this.combatants) {
            const hold = combatant.heldAction;
            if (hold?.mode !== "position" || hold.segmentAbs >= currentAbs) continue;
            const used = combatant.heldSlotTakenAt(hold.segmentAbs);
            if (used) {
                // The segment moved on, so there is no acted position left to display
                await this._spendHold(combatant, { used: true, retainPosition: false });
            } else {
                await this._demoteHold(combatant);
            }
        }
    }

    /**
     * Converts an unused positional hold into a generic one: the declared slot
     * passed, but the banked Phase survives to the null zone.
     * @param {Combatant} combatant
     * @private
     */
    async _demoteHold(combatant) {
        const effect = combatant.heldActionEffect;
        const hold = combatant.heldAction;
        if (!effect || hold?.mode !== "position") return;
        await effect.update({
            [`flags.${game.system.id}.hold`]: {
                mode: "generic",
                "-=segmentAbs": null,
                "-=dex": null,
                "-=fraction": null,
                "-=anchor": null,
                demotedFrom: { segmentAbs: hold.segmentAbs, dex: hold.dex },
            },
        });
        await combatant.update({ [`flags.${game.system.id}.heldSlotTakenAbs`]: null });
        const actor = combatant.actor;
        const positionLabel = hold.anchor
            ? `right ${hold.anchor.relation === "before" ? "before" : "after"} ${hold.anchor.name ?? "their anchor"}`
            : `DEX ${hold.dex}`;
        await this._combatCard(
            combatant,
            `${actor?.name}'s held position (${positionLabel} in ${HeroSystem6eCombatantSingle.phaseLabel(hold.segmentAbs)}) passed without being used; the Held Action is banked until their next Phase.`,
        );
        await this.logEvent("hold.demote", {
            combatant,
            // The slot that passed unused, not the boundary the cleanup ran at
            abs: hold.segmentAbs ?? null,
            data: { segmentAbs: hold.segmentAbs, dex: hold.dex ?? null, anchor: hold.anchor ?? null },
        });
    }

    /**
     * Drops display-position records once their segment has passed.
     * @private
     */
    async _clearSpentHoldPositions() {
        if (!this.started) return;
        const currentAbs = this.currentAbs;
        for (const combatant of this.combatants) {
            const spent = combatant.spentHoldPosition;
            if (spent && spent.segmentAbs < currentAbs) {
                await combatant.unsetFlag(game.system.id, "spentHoldPosition");
            }
            // Lightning Reflexes elevation is likewise a single-segment record
            const lrAbs = combatant.lrElevatedAbs;
            if (lrAbs !== null && lrAbs < currentAbs) {
                await combatant.unsetFlag(game.system.id, "lrElevatedAbs");
            }
            const spentLr = combatant.getFlag(game.system.id, "spentLrPosition");
            if (spentLr && spentLr.segmentAbs < currentAbs) {
                await combatant.unsetFlag(game.system.id, "spentLrPosition");
            }
        }
    }

    /**
     * Consumes a positional hold at the end of its held turn: the effect (and status
     * icon) go away immediately, while a display-only combatant flag keeps the acted
     * position in the tracker until the segment ends.
     * @param {Combatant} combatant
     * @param {object} [options]
     * @param {boolean} [options.used] - The holder actually acted at their held slot
     * @param {boolean} [options.retainPosition] - Keep the acted position for display
     * @private
     */
    async _spendHold(combatant, { used = false, retainPosition = true } = {}) {
        const actor = combatant.actor;
        const effect = combatant.heldActionEffect;
        const hold = combatant.heldAction;
        if (!actor || !effect || !hold) return;
        await effect.delete();
        const spent = retainPosition && hold.mode === "position" ? this.#spentRecordForSlot(hold) : null;
        await combatant.update(this.#holdSpendUpdate(spent));
        await this._combatCard(
            combatant,
            used
                ? `${actor.name} used their Held Action in ${this.currentPhaseLabel}.`
                : `${actor.name}'s held turn passed without being used; the Held Action is spent (${this.currentPhaseLabel}).`,
        );
        await this.logEvent(used ? "hold.use" : "hold.forfeit", {
            combatant,
            // Ledger the outcome at the SLOT's segment: cross-segment cleanup runs
            // at the next boundary, and the default (current) abs would file the
            // row one segment late — on top of the holder's genuine acted row
            abs: hold.mode === "position" ? (hold.segmentAbs ?? null) : null,
            data: {
                mode: hold.mode,
                segmentAbs: hold.segmentAbs ?? null,
                dex: hold.dex ?? null,
                anchor: hold.anchor ?? null,
            },
        });
    }

    /**
     * The display record for a positional hold spent at its declared slot.
     * An anchored slot resolves to concrete numbers as it is spent — the
     * display record must not drift if the anchor later moves or leaves.
     * The anchor itself is retained: the spent row shares the anchor's
     * exact scalar, so ordering still needs the adjacency side.
     * @param {object} hold
     * @returns {{segmentAbs: number, dex: number, fraction?: number, anchor?: object}}
     */
    #spentRecordForSlot(hold) {
        const anchored = hold.anchor ? this.resolveHoldAnchorPriority(hold, hold.segmentAbs) : null;
        const dex = anchored !== null ? Math.floor(anchored) : hold.dex;
        const fraction = anchored !== null ? anchored - Math.floor(anchored) : hold.fraction;
        return {
            segmentAbs: hold.segmentAbs,
            dex,
            ...(fraction !== undefined ? { fraction } : {}),
            ...(anchored !== null
                ? {
                      anchor: {
                          combatantId: hold.anchor.combatantId,
                          relation: hold.anchor.relation === "before" ? "before" : "after",
                      },
                  }
                : {}),
        };
    }

    /**
     * Combatant update payload for spending a hold.
     * @param {object|null} spent - Display-position record to retain, if any
     * @returns {object}
     */
    #holdSpendUpdate(spent) {
        return {
            // A stale slot-taken marker would spend the NEXT hold declared this segment
            [`flags.${game.system.id}.heldSlotTakenAbs`]: null,
            ...(spent ? { [`flags.${game.system.id}.spentHoldPosition`]: spent } : {}),
        };
    }

    /**
     * Using (or aborting with) a Held Action consumes this segment's action: it takes
     * the place of the Phase — a character cannot have two Phases in one Segment.
     * Records the acted position so turn flow skips the natural Phase and the
     * tracker keeps the row where they acted.
     * @param {Combatant} combatant
     * @param {{mode: string, segmentAbs?: number, dex?: number}|null} hold - The hold as it was before deletion
     */
    async recordSpentAction(combatant, hold) {
        if (!this.started || !hold) return;
        const currentAbs = this.currentAbs;
        const atOwnSlot = hold.mode === "position" && hold.segmentAbs === currentAbs;
        // A positional hold consumed away from its declared slot (abort, early
        // interrupt) still uses up this segment's action like any other hold
        const replacesNaturalPhase = !atOwnSlot && combatant.hasPhaseInSegment(this.segment);
        if (!atOwnSlot && !replacesNaturalPhase) return;
        const spent = atOwnSlot
            ? this.#spentRecordForSlot(hold)
            : { segmentAbs: currentAbs, dex: Math.floor(this.getInitiativePriority(combatant, this.segment)) };
        await combatant.update(this.#holdSpendUpdate(spent));
    }

    /**
     * Whether the combatant has already used their action this Segment: they spent
     * a Held Action here, or their turn in the sorted order has already passed.
     * @param {Combatant} combatant
     * @returns {boolean}
     */
    actedThisSegment(combatant) {
        if (!this.started) return false;
        const turnIndex = this.turns?.findIndex((t) => t.id === combatant.id) ?? -1;
        return (
            combatant.spentHoldInSegment(this.segment) ||
            (combatant.occupiesSegment?.(this.segment) && turnIndex !== -1 && turnIndex < (this.turn ?? 0))
        );
    }

    /**
     * Why the combatant cannot take a voluntary action right now, or null when
     * unblocked. A Stunned character can take no Action at all — not even Aborting;
     * an aborted character cannot act again until the Phase they aborted has passed.
     * @param {Combatant} combatant
     * @returns {string|null}
     */
    blockedActionReason(combatant) {
        const actor = combatant?.actor;
        if (!actor) return null;
        if (actor.statuses.has("stunned")) {
            return `${actor.name} is Stunned and can take no Actions — not even Aborting.`;
        }
        if (this.started) {
            const currentAbs = this.currentAbs;
            // Extra Phase (and kin): no other Actions while the activation runs
            const committed = (this.delayedActionsFor?.(combatant) ?? []).find(
                ([, record]) =>
                    record.commit && (record.declaredAbs ?? 0) <= currentAbs && currentAbs <= (record.resolveAbs ?? 0),
            );
            if (committed) {
                return `${actor.name} is activating ${committed[1].label} and can take no other Actions until it goes off.`;
            }
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
     * until the next Segment.
     * @param {Combatant} combatant
     * @returns {string|null}
     */
    blockedAbortReason(combatant) {
        const shared = this.blockedActionReason(combatant);
        if (shared) return shared;
        if (!this.started) return null;
        if (this.actedThisSegment(combatant)) {
            return `${combatant.actor.name} has already acted this Segment and cannot Abort until the next Segment.`;
        }
        return null;
    }

    /**
     * The Phases a fresh abort would consume from the current combat position: the
     * current Phase when the pointer is on the combatant (their DEX came up without
     * acting — e.g. a Held Action interrupt), otherwise the next full Phase; an
     * Extra Phase power consumes the one after as well.
     * @param {Combatant} combatant
     * @param {{extraPhase?: boolean}} [options]
     * @returns {{isActive: boolean, firstAbs: number, spentAbs: number, nextActAbs: number}}
     */
    abortCost(combatant, { extraPhase = false } = {}) {
        const currentAbs = this.currentAbs;
        const isActive = this.combatant?.id === combatant.id;
        const spd = combatant.combatSpd;
        const firstAbs = isActive ? currentAbs : HeroSystem6eCombatantSingle.nextPhaseAbs(spd, currentAbs);
        const spentAbs = extraPhase ? HeroSystem6eCombatantSingle.nextPhaseAbs(spd, firstAbs + 1) : firstAbs;
        const nextActAbs = HeroSystem6eCombatantSingle.nextPhaseAbs(spd, spentAbs + 1);
        return { isActive, firstAbs, spentAbs, nextActAbs };
    }

    /**
     * Creates a status effect for one combatant of the actor. toggleStatusEffect
     * cannot be used when a sibling combatant of the same (linked) actor already
     * carries the status — it would reuse (and the caller would overwrite) the
     * sibling's effect — so a parallel effect is created from the status definition.
     * @param {Actor} actor
     * @param {string} statusId
     * @returns {Promise<ActiveEffect|null>}
     */
    async createStatusEffectFor(actor, statusId) {
        if (!actor.statuses.has(statusId)) {
            await actor.toggleStatusEffect(statusId, { active: true });
            return actor.effects.find((e) => e.statuses.has(statusId)) ?? null;
        }
        // Adopt a bare same-status effect nobody owns (a token-HUD toggle carries
        // no combatantId) — a parallel duplicate could never be consumed by any
        // tracker flow and would orphan the status on the actor forever
        const flagKey = { holding: "hold", aborted: "abort" }[statusId];
        const orphan = flagKey
            ? actor.effects.find((e) => e.statuses.has(statusId) && !e.getFlag(game.system.id, flagKey)?.combatantId)
            : null;
        if (orphan) return orphan;
        const effectData = await ActiveEffect.implementation.fromStatusEffect(statusId);
        return (await ActiveEffect.implementation.create(effectData.toObject(), { parent: actor })) ?? null;
    }

    /**
     * Applies the defensive maneuver chosen in the abort dialog through the actor's
     * real maneuver item, so the effect carries its CV changes and the standard
     * next-Phase expiry flags. Falls back to the bare status icon for actors without
     * the item (e.g. tokens that never went through upload).
     * @param {Actor} actor
     * @param {string} statusId - dodge or block
     */
    async applyAbortDefense(actor, statusId) {
        // Match by maneuver trait, not exact XMLID: uploaded dodge/block items can
        // carry XMLID "MANEUVER" (custom maneuvers); a bare-status fallback would
        // add a second "Dodging" effect alongside the maneuver's own
        const trait = { dodge: maneuverHasDodgeTrait, block: maneuverHasBlockTrait }[statusId];
        const maneuverItem = trait
            ? actor.items.find((i) => ["maneuver", "martialart"].includes(i.type) && trait(i))
            : null;
        if (maneuverItem) {
            if (!maneuverItem.isActive) await maneuverItem.toggle();
            return;
        }
        await actor.toggleStatusEffect(statusId, { active: true });
    }

    /**
     * Applies an abort to a defensive Action. A held Phase is spent instead
     * when the combatant is holding — no further Phase is lost;
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
     */
    async declareAbort(combatant, options = {}) {
        // Latched for the whole declaration: the defense toggle re-enters
        // promptOutOfTurnAbortForManeuver, and creating the aborted status fires
        // the bare-status-toggle hook — neither may re-prompt for the abort this
        // very flow is declaring. STATIC: the hook and prompt read the latch
        // through the class (via the combat instance's constructor).
        HeroSystem6eCombatSingle._abortFlowActive = true;
        try {
            return await this.#declareAbortInner(combatant, options);
        } finally {
            HeroSystem6eCombatSingle._abortFlowActive = false;
        }
    }

    /**
     * @see declareAbort
     */
    async #declareAbortInner(
        combatant,
        { toAction = "a defensive Action", statusId = null, extraPhase = false, force = false } = {},
    ) {
        const actor = combatant?.actor;
        if (!this.started || !combatant?.isOwner || !actor) return false;
        // A RECORDED abort is final; a bare aborted status (token-HUD toggle,
        // stale effect from an interrupted flow) is ADOPTED below — otherwise
        // the unrecorded effect binds at every segment and never clears
        const existingAbortEffect = combatant.abortEffect;
        if (existingAbortEffect?.getFlag(game.system.id, "abort")) {
            ui.notifications.warn(`${actor.name} has already Aborted.`);
            return false;
        }
        const adoptingBareStatus = !!existingAbortEffect;
        // The isActive read below must see settled pointer state, or an abort on
        // the active combatant can silently skip its end-of-turn
        await this.settleMaintenance?.();

        if (!force) {
            if (adoptingBareStatus) {
                // The bare status itself reads as an abort lockout — only the
                // guards that are NOT the effect being adopted apply
                if (actor.statuses.has("stunned")) {
                    ui.notifications.warn(`${actor.name} is Stunned and can take no Actions — not even Aborting.`);
                    return false;
                }
            } else {
                const reason = this.blockedAbortReason(combatant);
                if (reason) {
                    ui.notifications.warn(reason);
                    return false;
                }
            }
        }

        if (statusId) await this.applyAbortDefense(actor, statusId);

        // A held Phase absorbs the abort — no further Phases are lost
        const holdingEffect = combatant.heldActionEffect;
        if (holdingEffect) {
            const hold = combatant.heldAction;
            await holdingEffect.delete();
            await this.recordSpentAction(combatant, hold);
            await this._combatCard(
                combatant,
                `${actor.name} Aborts to ${toAction} using their Held Action in ${this.currentPhaseLabel} — no further Phase is lost.`,
            );
            await this.logEvent("abort.declare", {
                combatant,
                // The acted position: a holder often has no natural Phase here, so
                // the default event priority would compute 0 and the ledger row
                // would sort to the segment bottom
                priority: this.getFlag(game.system.id, "actingPriority") ?? undefined,
                data: { toAction, viaHold: true, spentAbs: this.currentAbs },
            });
            return true;
        }

        const abortEffect = await this.createStatusEffectFor(actor, "aborted");

        // SPD 0 has no Phase to consume; bind the record (spentAbs null = until removed)
        // and leave the cost for the GM to adjudicate
        if (combatant.combatSpd <= 0) {
            if (abortEffect)
                await abortEffect.setFlag(game.system.id, "abort", { spentAbs: null, combatantId: combatant.id });
            await this._combatCard(combatant, `${actor.name} Aborts to ${toAction} in ${this.currentPhaseLabel}.`);
            await this.logEvent("abort.declare", { combatant, data: { toAction, spentAbs: null } });
            return true;
        }

        const { isActive, firstAbs, spentAbs, nextActAbs } = this.abortCost(combatant, { extraPhase });
        if (abortEffect) await abortEffect.setFlag(game.system.id, "abort", { spentAbs, combatantId: combatant.id });

        const { phaseLabel } = HeroSystem6eCombatantSingle;
        const costText = extraPhase
            ? `their Phases in ${phaseLabel(firstAbs)} and ${phaseLabel(spentAbs)} (Extra Phase)`
            : isActive
              ? `their current Phase (${phaseLabel(spentAbs)})`
              : `their Phase in ${phaseLabel(spentAbs)}`;
        await this._combatCard(
            combatant,
            `${actor.name} Aborts to ${toAction} — this consumes ${costText}; they cannot act again until ${phaseLabel(nextActAbs)}.`,
        );
        // Log the ledger row at the consumed Phase's natural priority — the
        // default declaration-position priority is 0 out of turn
        await this.logEvent("abort.declare", {
            combatant,
            priority: this.getInitiativePriority(combatant, HeroSystem6eCombatantSingle.segmentOf(spentAbs), {
                queryAbs: spentAbs,
            }),
            data: { toAction, spentAbs, extraPhase },
        });

        if (isActive) {
            try {
                await this.nextTurn();
            } catch (e) {
                console.warn(`Unable to advance the turn after an abort`, e);
            }
        }
        return true;
    }

    /**
     * Whether a scoped Lightning Reflexes elevation is possible for this combatant
     * right now: "available" while the elevated position is still ahead of the
     * segment's count, "elevated" while an elevation can still be cancelled (its
     * turn has not arrived), null otherwise.
     * @param {Combatant|null} combatant
     * @returns {"available"|"elevated"|null}
     */
    lrElevationState(combatant) {
        if (!this.started || !combatant?.isOwner || !combatant.actor) return null;
        const scoped = combatant.lightningReflexes?.scoped;
        if (!scoped) return null;

        const currentAbs = this.currentAbs;
        const turnIndex = this.turns?.findIndex((t) => t.id === combatant.id) ?? -1;
        const reached = turnIndex !== -1 && turnIndex <= (this.turn ?? 0);

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
        if (!combatant.hasPhaseInSegment(this.segment)) return null;
        if (combatant.heldAction) return null;
        if (combatant.spentHoldInSegment?.(this.segment)) return null;
        if (reached) return null;
        const elevatedPriority = this.getInitiativePriority(combatant, this.segment) + scoped.levels;
        const highWater = this.getFlag(game.system.id, "segmentHighWater") ?? null;
        if (highWater !== null && elevatedPriority >= highWater) return null;
        return "available";
    }

    /**
     * Toggles a scoped Lightning Reflexes elevation for the current segment. The
     * elevated character acts at DEX + LR but may only execute the scoped action;
     * cancelling before the elevated turn arrives restores the natural position.
     * The pointer is re-synced to the same active combatant, since the flag write
     * re-sorts the turns array under the stored index.
     * @param {string} combatantId
     */
    async toggleLrElevation(combatantId) {
        const combatant = this.combatants.get(combatantId);
        const actor = combatant?.actor;
        if (!this.started || !combatant?.isOwner || !actor) return;

        const state = this.lrElevationState(combatant);
        if (!state) return;
        const activeId = this.combatant?.id ?? null;

        if (state === "elevated") {
            await combatant.unsetFlag(game.system.id, "lrElevatedAbs");
            await this._combatCard(combatant, `${actor.name} stands down to their natural DEX.`);
            await this.logEvent("lr.cancel", { combatant });
        } else {
            const blocked = this.blockedActionReason(combatant);
            if (blocked) return void ui.notifications.warn(blocked);
            await combatant.setFlag(game.system.id, "lrElevatedAbs", this.currentAbs);
            const elevatedPriority = this.getInitiativePriority(combatant, this.segment);
            await this._combatCard(
                combatant,
                `${actor.name} acts early at effective DEX ${Math.floor(elevatedPriority)} (Lightning Reflexes — only: ${combatant.lightningReflexes.scoped.label}); the rest of their Phase follows at their natural DEX.`,
            );
            await this.logEvent("lr.elevate", { combatant, priority: elevatedPriority, data: { auto: false } });

            // Elevating above the unacted current actor preempts the pointer: the
            // count has not reached that position, so the LR stop goes first and the
            // displaced actor re-enters via the acting-priority threshold afterwards.
            // lrPreemptPointer re-checks and, for players, relays through the GM.
            const actingPriority =
                this.getFlag(game.system.id, "actingPriority") ??
                (activeId ? this.getInitiativePriority(this.combatants.get(activeId), this.segment) : -Infinity);
            if (activeId && activeId !== combatant.id && elevatedPriority > actingPriority) {
                await this.lrPreemptPointer(combatant.id, activeId);
                return;
            }
        }

        // Re-point the turn index at the same active combatant: the flag write
        // re-sorted the turns array under the stored index
        await this.resyncTurnPointer?.(activeId);
    }

    /**
     * Removes the held-action status from every combatant: only invoked for
     * full-Turn skips, where every SPD 1-12 had a Phase that replaces the hold.
     * Per-turn clearing lives in _consumeActiveCombatantHold.
     * @private
     */
    async _consumeExpiredHeldActions() {
        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            const hold = combatant.heldAction;
            if (!actor || !hold) continue;

            const holdingEffect = combatant.heldActionEffect;
            if (!holdingEffect) continue;

            // The hold is consumed by the rule, not by a duration, so delete it explicitly
            await holdingEffect.delete();

            await this._combatCard(combatant, `${actor.name}'s Held Action was consumed by their natural Phase.`);
            await this.logEvent("hold.consume", { combatant, data: { mode: hold.mode ?? null } });
        }
    }

    /**
     * Clears the aborted status from combatants whose spent Phase has now passed.
     * Aborting uses the character's next full Phase; once the Segment containing that
     * Phase ends they may act again on their following Phase.
     * @param {number[]|null|undefined} elapsedSegments - Segments that just ended, oldest
     *   first; null when a full Turn elapsed, undefined when unknown (skip)
     * @private
     */
    async _clearExpiredAborts(elapsedSegments) {
        if (elapsedSegments === undefined) return;

        const currentAbs = this.currentAbs;
        for (const combatant of this.combatants) {
            const actor = combatant.actor;
            const abortedEffect = combatant.abortEffect;
            if (!actor || !abortedEffect) continue;
            const spentAbs = combatant.abortSpentAbs;
            if (spentAbs !== null) {
                // The spent Phase's segment must have fully passed
                if (currentAbs <= spentAbs) continue;
            } else if (elapsedSegments !== null && !elapsedSegments.some((s) => combatant.hasPhaseInSegment(s))) {
                continue;
            }

            await abortedEffect.delete();

            await this._combatCard(
                combatant,
                `${actor.name}'s aborted Phase has passed (now ${this.currentPhaseLabel}); they may act again on their next Phase.`,
            );
            await this.logEvent("abort.expire", { combatant, data: { spentAbs } });
        }
    }

    /**
     * Scans a combatant's actor sheet and auto-expires matching active effect keys
     * tracked inside the global HERO configuration dictionary.
     * @param {Actor} actor
     * @private
     */
    async _expireCustomSystemEffects(actor) {
        if (!actor) return;

        const expiryEvents = CONFIG.HERO?.activeEffectExpiryEvents;
        if (!expiryEvents) return;
        const customSystemKeys = Object.keys(expiryEvents);

        const matchingEffects = actor.effects.filter((effect) => {
            const activeExpiryKey = effect.duration?.expiry;
            return customSystemKeys.includes(activeExpiryKey);
        });

        if (matchingEffects.length === 0) return;

        // Default to V14's disable behavior
        const expiryAction = foundry.utils.getProperty(CONFIG, "ActiveEffect.expiryAction") ?? "disable";

        const effectsToDelete = [];
        const updatesToApply = [];

        for (const effect of matchingEffects) {
            const activeExpiryKey = effect.duration?.expiry;

            if (activeExpiryKey === "phaseEnd") {
                if (expiryAction === "delete") {
                    effectsToDelete.push(effect.id);
                } else {
                    if (effect.statuses?.size > 0) {
                        // Status-carrying effects must not linger disabled
                        effectsToDelete.push(effect.id);
                    } else {
                        updatesToApply.push({
                            _id: effect.id,
                            disabled: true,
                        });
                    }
                }
            }
        }

        if (effectsToDelete.length > 0) {
            await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        }
        if (updatesToApply.length > 0) {
            await actor.updateEmbeddedDocuments("ActiveEffect", updatesToApply);
        }
    }
}

// Legacy combatant/combat bookkeeping keys the single-combatant model does not use,
// plus single-stack transients that must not survive a model conversion.
const LEGACY_COMBATANT_FLAG_KEYS = [
    "initiative",
    "initiativeCharacteristic",
    "segment",
    "spd",
    "initiativeTooltip",
    "lightningReflexes",
    "spentEndOn",
    "koRecoveredOn",
    "koRecoveredAbs",
    "koStartAbs",
    "endUsedForMovement",
    "heroHistory",
    "heldSlotTakenAbs",
    "spentHoldPosition",
    "lrElevatedAbs",
    "spentLrPosition",
    "spdLockout",
    "knownSpd",
    "pendingSpd",
    "haymaker",
    "delayedActions",
    "soloTieRoll",
];
const LEGACY_COMBAT_FLAG_KEYS = [
    "segment",
    "postSegment12Round",
    "heroCurrent",
    "currentSegment",
    "segmentRolls",
    "recoveredRounds",
    "actingPriority",
    "segmentHighWater",
    "eventLog",
    "eventLogSeq",
];

/**
 * Migrates existing combats into the single-combatant data model. The retired
 * legacy tracker kept one combatant per Phase segment (doubled for Lightning
 * Reflexes); this collapses each token to a single combatant, purges legacy turn
 * bookkeeping, and resets every combat to its pre-start state — the segment
 * timeline is rebuilt when combat is begun again. Idempotent; runs from the
 * version-gated world migration and stays available on the console:
 *
 *   game.herosystem6e.migrateCombatsToSingleCombatantTracker()
 *   game.herosystem6e.migrateCombatsToSingleCombatantTracker({ dryRun: true })
 *
 * @param {object} [options]
 * @param {boolean} [options.dryRun] - Log the plan without writing anything
 * @returns {Promise<object[]>} Per-combat report of what was (or would be) changed
 */
export async function migrateCombatsToSingleCombatantTracker({ dryRun = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(`Only a GM can migrate combats.`);
        return [];
    }

    const report = [];
    for (const combat of game.combats) {
        // One combatant per token (or per actor for tokenless combatants); the
        // legacy per-segment and Lightning Reflexes duplicates are removed.
        // Keepers prefer a live actor so broken references are the ones culled.
        const keepers = new Map();
        const deleteIds = [];
        for (const combatant of combat.combatants) {
            const key = combatant.tokenId || combatant.actorId || combatant.id;
            const kept = keepers.get(key);
            if (!kept) {
                keepers.set(key, combatant);
            } else if (!kept.actor && combatant.actor) {
                deleteIds.push(kept.id);
                keepers.set(key, combatant);
            } else {
                deleteIds.push(combatant.id);
            }
        }

        const combatantUpdates = [];
        for (const combatant of keepers.values()) {
            const update = { _id: combatant.id };
            if (combatant.initiative !== null) update.initiative = null;

            const flagDeletes = {};
            const systemFlags = combatant.flags?.[game.system.id] ?? {};
            const staleKeys = LEGACY_COMBATANT_FLAG_KEYS.filter((key) => systemFlags[key] !== undefined);
            if (staleKeys.length > 0) flagDeletes[game.system.id] = forceDeleteKeys(staleKeys);
            // The legacy hold marker lives outside the system scope
            if (combatant.flags?.holdingAnAction !== undefined) {
                Object.assign(flagDeletes, forceDeleteKeys(["holdingAnAction"]));
            }
            if (Object.keys(flagDeletes).length > 0) update.flags = flagDeletes;

            if (Object.keys(update).length > 1) combatantUpdates.push(update);
        }

        const combatFlags = combat.flags?.[game.system.id] ?? {};
        const staleCombatKeys = LEGACY_COMBAT_FLAG_KEYS.filter((key) => combatFlags[key] !== undefined);
        const needsReset = combat.started || combat.round !== 0 || staleCombatKeys.length > 0;
        const resetPayload = { started: false, round: 0, turn: null };
        if (staleCombatKeys.length > 0) {
            resetPayload[`flags.${game.system.id}`] = forceDeleteKeys(staleCombatKeys);
        }

        const entry = {
            combat: combat.id,
            scene: combat.scene?.name ?? null,
            wasStarted: combat.started,
            combatantsRemoved: deleteIds.length,
            combatantsKept: keepers.size,
            combatantsCleaned: combatantUpdates.length,
            combatFlagsPurged: staleCombatKeys,
            reset: needsReset,
        };
        report.push(entry);

        if (dryRun) continue;
        // Reset FIRST: the combatant delete/create hooks reconcile live combat
        // state only while the combat is started — deleting before the reset
        // would append removal events to the ledger and re-point the turn,
        // racing (and dirtying) the very state this purge just cleaned
        if (needsReset) await combat.update(resetPayload);
        if (deleteIds.length > 0) await combat.deleteEmbeddedDocuments("Combatant", deleteIds);
        if (combatantUpdates.length > 0) await combat.updateEmbeddedDocuments("Combatant", combatantUpdates);
    }

    console.table(report);
    const touched = report.filter((r) => r.combatantsRemoved || r.combatantsCleaned || r.reset);
    if (dryRun || touched.length > 0) {
        ui.notifications.info(
            dryRun
                ? `Single tracker migration dry run: ${touched.length} of ${report.length} combat(s) would change (see console).`
                : `Single tracker migration: ${touched.length} of ${report.length} combat(s) converted; begin combat again to rebuild the timeline.`,
        );
    }
    return report;
}

// Regions already offered for deletion this session. Marked BEFORE each prompt
// awaits: the tracker asks at every Phase start, and rapid advances (quench
// loops, End Turn spam) would otherwise queue an unbounded stack of modal
// dialogs for the same region. A declined region stays deletable by hand.
const promptedAoeRegionUuids = new Set();

/**
 * Offers to delete AoE regions whose effective item is INSTANT — once the phase
 * moves on, an instant AoE template has done its work.
 * @returns {Promise<void>}
 */
export async function promptToDeleteAoeInstantRegions() {
    // Nobody is present to answer during an unattended test run, and an open
    // modal stalls the Phase-start chain behind it
    if (isQuenchTestRunning()) return;

    // We only care about AoEs
    const regionsToPrompt = Array.from(canvas.regions.viewedDocuments()).filter(
        (template) => template.flags[game.system.id]?.purpose === "AoE" && !promptedAoeRegionUuids.has(template.uuid),
    );
    for (const region of regionsToPrompt) {
        // The flag snapshot is immutable, so one inspection settles the region
        // for the session whatever its duration turns out to be
        promptedAoeRegionUuids.add(region.uuid);
        const effectiveItem = rehydrateAttackItem(region.flags[game.system.id].effectiveItemJson).item;
        if (effectiveItem.system.duration !== CONFIG.HERO.DURATION_TYPES.INSTANT) continue;

        const proceed = await foundry.applications.api.DialogV2.confirm({
            window: {
                title: `Delete region ${region.name}?`,
            },
            content: `<p>The region <b>${region.name}</b> is likely no longer needed. Would you like to delete it?</p>`,
            rejectClose: false,
            modal: true,
        });

        if (proceed) {
            await region.delete();
        }
    }
}
