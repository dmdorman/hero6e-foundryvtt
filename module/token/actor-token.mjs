import { HEROSYS } from "../herosystem6e.mjs";
import { convertSystemUnitsToMetres, gridUnitsToMeters } from "../utility/units.mjs";

const { TokenDocument } = foundry.documents;
const { Token } = foundry.canvas.placeables;

export class HeroSystem6eTokenDocument extends TokenDocument {
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
        super._prepareDetectionModes();
        if (!this.sight.enabled) return;
        this.detectionModes.heroNonTargetingV14 ??= { enabled: true, range: Infinity };
        this.detectionModes.heroTargetingV14 ??= { enabled: true, range: Infinity };
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
            const masterCombatant = this.combatant;
            const endStart = masterCombatant.getFlag(game.system.id, "endUsedForMovement") || 0;
            const endCost = this._movementHistoryEndCost;
            const endValue = this.actor.system.characteristics.end?.value;
            if (!Number.isFinite(endCost) || !Number.isFinite(endValue)) {
                return;
            }
            masterCombatant.setFlag(game.system.id, "endUsedForMovement", endCost);
            this.actor.update({
                [`system.characteristics.end.value`]: endValue - (endCost - endStart),
            });
        }
    }

    #movementPossibilities(action) {
        const movementActiveEffects = this.actor.appliedEffects.filter((ae) =>
            ae.changes.find(
                (c) =>
                    c.key === `system.characteristics.${action.toLowerCase()}.max` &&
                    c.type === CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD, // FIXME: We can have AEs like STR0 that are not appropriate to consider
            ),
        );
        const is5e = this.actor.is5e;
        const possibleMovements = [];
        let aeGrantedDistance = 0;
        for (const ae of movementActiveEffects) {
            const aeDistance =
                parseInt(
                    ae.changes.find(
                        (c) =>
                            c.key === `system.characteristics.${action.toLowerCase()}.max` &&
                            c.type === CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                    ).value,
                ) || 0;
            aeGrantedDistance += Math.max(0, aeDistance);
            possibleMovements.push({
                name: ae.name,
                ae,
                action: action,
                distanceUnused: convertSystemUnitsToMetres(Math.max(0, aeDistance), is5e),
                // Actor-embedded AEs (encumbrance, adjustments) have no owning item; charge as inherent movement
                endPer1mMovement: Number.isFinite(ae.parent?.endPer1mMovement) ? ae.parent.endPer1mMovement : 0.1,
            });
        }
        // characteristicMax already includes the AE ADD contributions counted above
        const characteristicMax = parseInt(this.actor.system.characteristics[action.toLowerCase()]?.max) || 0;
        const inherentDistance = Math.max(0, characteristicMax - aeGrantedDistance);
        if (inherentDistance > 0) {
            possibleMovements.push({
                name: "inherent",
                action: action,
                distanceUnused: convertSystemUnitsToMetres(inherentDistance, is5e),
                endPer1mMovement: 0.1,
            });
        }
        // Use least expensive movements first
        return possibleMovements.sort(({ endPer1mMovement: a }, { endPer1mMovement: b }) => a - b);
    }

    get _movementHistoryEndCost() {
        let endCost = 0;
        try {
            // waypoint.cost is in scene grid units (spaces * grid.distance)
            const gridToMeters = gridUnitsToMeters({ scene: this.parent, silent: true });
            const movementCapabilities = {};
            for (const waypoint of this.movementHistory) {
                let costInMeters = waypoint.cost * gridToMeters;
                if (!Number.isFinite(costInMeters) || costInMeters <= 0) {
                    continue;
                }
                movementCapabilities[waypoint.action] ??= this.#movementPossibilities(waypoint.action);
                for (const capability of movementCapabilities[waypoint.action]) {
                    const used = Math.max(0, Math.min(costInMeters, capability.distanceUnused));
                    costInMeters -= used;
                    endCost += used * capability.endPer1mMovement;
                    capability.distanceUnused -= used;
                    if (costInMeters <= 0) {
                        break;
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

export class HeroSystem6eToken extends Token {
    constructor(document) {
        super(document);
    }

    async _drawEffects() {
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
