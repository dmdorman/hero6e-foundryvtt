import { HEROSYS } from "../herosystem6e.mjs";

export class HeroSystem6eTokenDocument extends TokenDocument {
    constructor(data, context) {
        super(data, context);
    }

    _prepareDetectionModes() {
        if (!this.sight.enabled) return;

        // By default you must have a light source to see the map
        const initialRange = this.sight.range;
        this.sight.range = 0;

        const lightMode = this.detectionModes.find((m) => m.id === "lightPerception");
        if (!lightMode) {
            this.detectionModes.push({ id: "lightPerception", enabled: true, range: null });
        } else {
            lightMode.range = null;
            lightMode.enabled = true;
        }
        const basicMode = this.detectionModes.find((m) => m.id === "basicSight");
        if (!basicMode) {
            this.detectionModes.push({ id: "basicSight", enabled: true, range: 0 });
        } else {
            basicMode.range = 0;
            basicMode.enabled = true;
        }

        try {
            // GENERIC SIGHTGROUP (no lights required; INFRAREDPERCEPTION, NIGHTVISION, etc)
            const SIGHTGROUP = this.actor?.items.find(
                (item) =>
                    item.baseInfo?.type.includes("sense") &&
                    item.system.GROUP === "SIGHTGROUP" &&
                    //item.system.OPTIONID === undefined && // DETECT
                    item.isActive,
            );
            if (SIGHTGROUP) {
                const basicMode = this.detectionModes.find((m) => m.id === "basicSight");
                basicMode.range = null;
                this.sight.range = null; // You can see without a light source
            }

            // GENERIC NON-SIGHTGROUP (not including MENTALGROUP which is unsupported)
            const NONSIGHTGROUP = this.actor?.items.find(
                (item) =>
                    item.baseInfo?.type.includes("sense") &&
                    item.system.GROUP !== "SIGHTGROUP" &&
                    item.system.GROUP !== "MENTALGROUP" &&
                    item.isActive,
            );
            const heroSense = this.detectionModes.find((m) => m.id === "heroSense");
            if (NONSIGHTGROUP) {
                if (!heroSense) {
                    this.detectionModes.push({ id: "heroSense", enabled: true, range: null });
                } else {
                    heroSense.range = null;
                    heroSense.enabled = true;
                }
            } else {
                if (heroSense) {
                    heroSense.enabled = false;
                }
            }

            // Update Sight so people don't get confused when looking at the UI
            if (initialRange !== this.sight.range) {
                this.update({ "sight.range": this.sight.range });
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export class HeroSystem6eToken extends foundry.canvas.placeables.Token {
    constructor(document) {
        super(document);
    }

    getData() {
        let data = super.getData();
        data.bar3 = this.token.flags.bar3;
        return data;
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
}
