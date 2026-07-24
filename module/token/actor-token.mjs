import { HEROSYS } from "../herosystem6e.mjs";
import { HeroCompatibility } from "../utility/compatibility.mjs";
import { roundFavorPlayerAwayFromZero } from "../utility/round.mjs";

// v13 has namespaced these. Remove when support is no longer provided. Also remove from eslint template.
const FoundryVttTokenDocument = foundry.appv1?.sheets?.TokenDocument || TokenDocument;
const FoundryVttToken = foundry.canvas?.placeables?.Token || Token;

export class HeroSystem6eTokenDocument extends FoundryVttTokenDocument {
    constructor(data, context) {
        super(data, context);
    }

    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        // Make sure the number is not duplicated
        if (this.actor?.prototypeToken?.appendNumber) {
            const initialNumber = parseInt(this.name.match(/\((\d+)\)/)?.[1]) || 1;
            if (initialNumber > 0) {
                const baseName = this.name.replace(this.name.match(/\((\d+)\)/)?.[0], "").trim();
                for (let n = initialNumber; n < initialNumber + 100; n++) {
                    const sisterToken = canvas.scene.tokens.find((t) => t.name === `${baseName} (${n})`);
                    if (!sisterToken) {
                        this.updateSource({
                            name: `${baseName} (${n})`,
                        });
                        break;
                    }
                }
            }
        }
    }

    _prepareDetectionModes() {
        // V14 FRAMEWORK GUARD: If V14, do not run legacy document-level setup
        if (HeroCompatibility.isV14) {
            super._prepareDetectionModes();
            this._prepareDetectionModesV14();

            return;
        }

        if (this.sight.visionMode !== "heroVision") {
            super._prepareDetectionModes();
            return;
        }

        // The rest is for our custom HEROVISION
        if (!this.sight.enabled) return;
        if (!this.isOwner) return;
        if (!this.id) return;

        // To see the map you must have DETECT + SENSE
        // Anything with 'detect limited class of physical objects'

        // By default you must have a light source to see the map
        const initialRange = this.sight.range;
        this.sight.range = 0;

        // default lightPerception & basicSight detections
        //super._prepareDetectionModes();

        // Maximum distance we can see is based on perception.  This is typically 125m+ so rarely impacts scene.
        // Only 5e INT/PERCEPTION can go below 9.  6e INT cannot go below 0.  5e INT can go below 0.
        // THE RANGE OF SENSES
        // The Range Modifier (page 144) applies to all PER Rolls with Ranged
        // Senses; this effectively restricts their Range significantly. The rules
        // don’t establish any absolute outer limit or boundary for a Ranged
        // Sense; the GM should establish the limit based on common sense
        // and the situation. As a guideline, when the Range Modifier exceeds
        // the point where it reduces a character’s PER Roll to 0 or below,
        // things become too blurry, indistinct, or obscured for the character
        // to perceive, even if he rolls a 3.
        let maxRange = 8;
        // TODO: Fix PERCEPTION.system.roll so we don't have to poke into INT
        //const PERCEPTION = this.actor?.items.find((i) => i.system.XMLID === "PERCEPTION");
        if (this.actor && this.actor.system.characteristics.int) {
            //9 + (INT/5)
            const perRoll = 9 + roundFavorPlayerAwayFromZero(parseInt(this.actor.system.characteristics.int.value) / 5);
            const pwr = perRoll / 2 + 2;
            maxRange = Math.floor(Math.max(maxRange, Math.pow(2, pwr)));
        }

        const lightMode = this.detectionModes.find((m) => m.id === "lightPerception");
        if (!lightMode) {
            this.detectionModes.push({ id: "lightPerception", enabled: true, range: maxRange });
        } else {
            lightMode.range = maxRange;
            lightMode.enabled = true;
        }
        const basicMode = this.detectionModes.find((m) => m.id === "basicSight");
        if (!basicMode) {
            this.detectionModes.push({ id: "basicSight", enabled: true, range: maxRange });
        } else {
            basicMode.range = maxRange;
            basicMode.enabled = true;
        }

        try {
            // GENERIC SIGHTGROUP (no lights required; INFRAREDPERCEPTION, NIGHTVISION, etc)
            const SIGHTGROUP = this.actor?.items.find(
                (item) =>
                    item.isSense &&
                    item.system.GROUP === "SIGHTGROUP" &&
                    //item.system.OPTIONID === undefined && // DETECT
                    item.isActive,
            );

            if (SIGHTGROUP && !this.actor?.statuses.has("blind")) {
                const basicMode = this.detectionModes.find((m) => m.id === "basicSight");
                basicMode.range = maxRange;
                this.sight.range = maxRange; // You can see without a light source
            }

            // A special vision that can see the map (like targeting touch)
            let blindVisionItem = this.actor?.items.find(
                (i) =>
                    i.isActive &&
                    i.isSense &&
                    i.isRangedSense &&
                    (i.isTargeting || ["TOUCHGROUP", "SMELLGROUP"].includes(i.system.GROUP)) &&
                    (!this.token?.actor?.statuses.has("blind") || i.system.GROUP !== "SIGHTGROUP"),
            );
            if (blindVisionItem) {
                const basicMode = this.detectionModes.find((m) => m.id === "basicSight");
                basicMode.range = maxRange;
                this.sight.range = maxRange; // You can see without a light source
            }

            // Assume we can use non-targeting senses to detect tokens
            const heroDetectSight = this.detectionModes.find((m) => m.id === "heroDetectSight");
            if (!heroDetectSight) {
                this.detectionModes.push({ id: "heroDetectSight", enabled: true, range: maxRange });
            } else {
                heroDetectSight.range = maxRange;
                heroDetectSight.enabled = true;
            }

            // Update Sight so people don't get confused when looking at the UI
            if (initialRange !== this.sight.range) {
                this.update({ "sight.range": this.sight.range });
            }
        } catch (e) {
            console.error(e);
        }
    }

    _prepareDetectionModesV14() {
        if (!this.sight.enabled) return;
        this.detectionModes.heroNonTargetingV14 ??= { enabled: true, range: Infinity };
        this.detectionModes.heroTargetingV14 ??= { enabled: true, range: Infinity };
    }

    static async createCombatants(tokens, { combat } = {}) {
        if (combat === undefined && game.combats.viewed) {
            combat ??= game.combats.viewed;
        }
        if (combat) {
            console.debug(
                `createCombatants/before: ${combat.current.name} segment=${combat.current.segment} init=${combat.current.initiative}`,
                combat,
            );
        }

        await super.createCombatants(tokens, combat);

        combat ??= game.combats.viewed;
        console.debug(
            `createCombatants/after: ${combat.current.name} segment=${combat.current.segment} init=${combat.current.initiative}`,
            combat,
        );
    }

    static async deleteCombatants(tokens, { combat } = {}) {
        await super.deleteCombatants(tokens, combat);

        combat ??= game.combats.viewed;
        if (combat?.extraCombatants) {
            await combat.extraCombatants();
        }
    }

    /**
     * Called when the movement is recorded or cleared.
     * @protected
     */
    _onMovementRecorded() {
        super._onMovementRecorded();

        // Only owners have permission to perform updates
        if (!this.isOwner) {
            return;
        }

        // Track END for movement when in combat and it is the active combatant
        if (game.combat?.combatant?.tokenId === this.id) {
            const masterCombatant = game.combat.getCombatantByToken(this.combatant.tokenId);
            const endStart = masterCombatant.getFlag(game.system.id, "endUsedForMovement") || 0;
            const endCost = this._movementHistoryEndCost;
            const endDelta = endCost - endStart;
            masterCombatant.setFlag(game.system.id, "endUsedForMovement", endCost);
            this.actor.update({
                [`system.characteristics.end.value`]: this.actor.system.characteristics.end.value - endDelta,
            });
        }
    }

    #movementPossibilities(action) {
        const movementActiveEffects = this.actor.appliedEffects.filter((ae) =>
            ae.changes.find(
                (c) =>
                    c.key === `system.characteristics.${action.toLowerCase()}.max` &&
                    c.mode === CONST.ACTIVE_EFFECT_MODES.ADD, // FIXME: We can have AEs like STR0 that are not appropriate to consider
            ),
        );
        const possibleMovements = [];
        for (const ae of movementActiveEffects) {
            possibleMovements.push({
                name: ae.name,
                ae,
                action: action,
                distanceUnused:
                    parseInt(
                        ae.changes.find((c) => c.key === `system.characteristics.${action.toLowerCase()}.max`).value,
                    ) || 0,
                endPer1mMovement: ae.parent.endPer1mMovement,
            });
        }
        const characteristicMax = this.actor.system.characteristics[action.toLowerCase()]?.max;
        if (characteristicMax) {
            possibleMovements.push({
                name: "inherent",
                action: action,
                distanceUnused: parseInt(characteristicMax) || 0,
                endPer1mMovement: 0.1,
            });
        }
        // Use least expensive movements first
        return possibleMovements.sort(({ endPer1mMovement: a }, { endPer1mMovement: b }) => a - b);
    }

    get _movementHistoryEndCost() {
        let endCost = 0;
        try {
            const movementCapabilities = {};
            for (const waypoint of this.movementHistory) {
                if (waypoint.cost > 0) {
                    let cost = waypoint.cost;
                    movementCapabilities[waypoint.action] ??= this.#movementPossibilities(waypoint.action);
                    for (const capability of movementCapabilities[waypoint.action]) {
                        const used = Math.max(0, Math.min(cost, capability.distanceUnused));
                        cost -= used;
                        endCost += capability.endPer1mMovement;
                        capability.distanceUnused -= used;
                    }
                }
            }
        } catch (e) {
            console.error(`Unable to calculate END use of movement for ${this.name}`, e);
        }

        // Movement rounds up
        endCost = Math.ceil(endCost);

        console.log(`${this.name} movement cost ${endCost} END.`);

        return endCost;
    }
}

export class HeroSystem6eToken extends FoundryVttToken {
    constructor(document) {
        super(document);
    }

    async _drawEffects() {
        if (HeroCompatibility.isV14) {
            return this._drawEffects14();
        }

        this.effects.renderable = false;

        // Clear Effects Container
        this.effects.removeChildren().forEach((c) => c.destroy());
        this.effects.bg = this.effects.addChild(new PIXI.Graphics());
        this.effects.bg.zIndex = -1;
        this.effects.overlay = null;

        // Categorize effects
        let activeEffects = this.actor?.temporaryEffects || [];
        const overlayEffect = activeEffects.findLast((e) => e.img && e.getFlag("core", "overlay"));

        // If dead or knockedOut of combat only show overlayEffect
        if (this.actor?.statuses.has("dead") || this.actor?.getKnockedOutOfCombat()) {
            activeEffects = [overlayEffect];
        }

        // Draw effects
        const promises = [];
        for (const [i, effect] of activeEffects.entries()) {
            if (!effect?.img) continue;

            // If Knocked out we want to override tint to match token tint (red = defeated)
            const promise =
                effect === overlayEffect
                    ? this._drawOverlay(
                          effect.img,
                          (overlayEffect.statuses.has("knockedOut") && this.actor?.getKnockedOutOfCombat()) ||
                              overlayEffect.statuses.has("dead")
                              ? "ff5555"
                              : effect.tint,
                      )
                    : this._drawEffect(effect.img, effect.tint);
            promises.push(
                promise.then((e) => {
                    if (e) e.zIndex = i;
                }),
            );
        }
        await Promise.allSettled(promises);

        this.effects.sortChildren();
        this.effects.renderable = true;
        this.renderFlags.set({ refreshEffects: true });
    }

    async _drawEffects14() {
        this.effects.renderable = false;

        // Clear Effects Container
        this.effects.removeChildren().forEach((c) => c.destroy());
        this.effects.bg = this.effects.addChild(new PIXI.Graphics());
        this.effects.bg.zIndex = -1;
        this.effects.overlay = null;

        // Categorize effects
        const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;
        let activeEffects =
            this.actor?.appliedEffects.filter(
                (e) => e.showIcon === SHOW_ICON.ALWAYS || (e.showIcon === SHOW_ICON.CONDITIONAL && e.isTemporary),
            ) ?? [];
        const overlayEffect = activeEffects.findLast((e) => e.flags.core?.overlay);

        // If dead or knockedOut of combat only show overlayEffect
        if (this.actor?.statuses.has("dead") || this.actor?.getKnockedOutOfCombat()) {
            activeEffects = [overlayEffect];
        }

        // Draw effects
        const promises = [];
        for (const [i, effect] of activeEffects.entries()) {
            // If Knocked out we want to override tint to match token tint (red = defeated)
            const promise =
                effect === overlayEffect
                    ? this._drawOverlay(
                          effect.img,
                          (overlayEffect.statuses.has("knockedOut") && this.actor?.getKnockedOutOfCombat()) ||
                              overlayEffect.statuses.has("dead")
                              ? "ff5555"
                              : effect.tint,
                      )
                    : this._drawEffect(effect.img, effect.tint);

            promises.push(
                promise.then((e) => {
                    if (e) e.zIndex = i;
                }),
            );
        }
        await Promise.allSettled(promises);

        this.effects.sortChildren();
        this.effects.renderable = true;
        this.renderFlags.set({ refreshEffects: true });
    }

    /**
     * Add or remove the currently controlled Tokens from the active combat encounter
     * @param {Combat} [combat]    A specific combat encounter to which this Token should be added
     * @returns {Promise<Token>} The Token which initiated the toggle
     */
    async toggleCombat(combat) {
        await super.toggleCombat(combat);
    }

    _canDragLeftStart(user, event) {
        let canDragLeftStart = super._canDragLeftStart(user, event);

        // If in combat, do not allow tokens to move when it is not their turn.
        if (
            canDragLeftStart &&
            !game.user.isGM &&
            this.inCombat &&
            this.combatant.combat.started &&
            this.combatant.combat.current?.tokenId !== this.id &&
            game.settings.get(HEROSYS.module, "CombatMovementOnlyOnActorsPhase")
        ) {
            ui.notifications.warn("Combat has started and you must wait for your phase to move.");
            canDragLeftStart = false;
        }

        // Entangled tokens typically can't move
        if (canDragLeftStart && this.actor) {
            canDragLeftStart = this.actor.canMove(true, event);
        }

        return canDragLeftStart;
    }

    _onControl(options) {
        if (game.ready) game[HEROSYS.module].effectPanel.refresh();
        if (game.ready && game.combat) {
            game.combat.collection.render();
        }
        return super._onControl(options);
    }

    _onRelease(options) {
        if (game.ready) game[HEROSYS.module].effectPanel.refresh();
        if (game.ready && game.combat) {
            game.combat.collection.render();
        }
        return super._onRelease(options);
    }

    // async _onUpdate(changed, options, userId) {
    //     await super._onUpdate(changed, options, userId);
    //     if (changed._regions) {
    //         debugger;
    //     }

    // }
}
