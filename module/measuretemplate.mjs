import {
    currentSceneUsesHexGrid,
    getRoundedUpDistanceInSystemUnits,
    getSystemDisplayUnits,
    gridUnitsToMeters,
} from "./utility/units.mjs";

function isHexTemplatesEnabled() {
    return game.settings.get(game.system.id, "HexTemplates");
}

export default class HeroSystem6eMeasuredTemplate extends foundry.canvas.placeables.MeasuredTemplate {
    async _onClickLeft(event) {
        await super._onClickLeft(event);

        await this.selectObjects();
        await game.user.broadcastActivity({
            targets: Array.from(game.user.targets.map((o) => o.id)),
        });
    }

    /**
     * In 5e shapes are based on a hex grid so don't have typical Euclidean shapes.
     * While lines (ray) can be represented easily, other shapes cannot. Fall back to
     * approximating the shapes with typical Euclidean shapes but attempt to override where
     * appropriate.
     *
     * @returns PIXI.Points
     */
    _computeShape() {
        const { t: shapeType, distance, direction, angle } = this.document;

        const HexTemplates = isHexTemplatesEnabled();
        const hexGrid = currentSceneUsesHexGrid();

        if (HexTemplates && hexGrid) {
            if (shapeType === "circle") {
                const vertices = game.canvas.grid.getCircle({ x: 0, y: 0 }, distance);

                return new PIXI.Polygon(...vertices);
            } else if (shapeType === "cone") {
                const vertices = game.canvas.grid.getCone({ x: 0, y: 0 }, distance, direction, angle);

                return new PIXI.Polygon(...vertices);
            }
        }

        return super._computeShape();
    }

    /**
     * FoundryVTT, quite reasonably, reports euclidianly factually correct text values. Unfortunately, we have 2 problems with this:
     * - 5e does not match euclidian geometry for radius as the first 1"/2m is actually 0.5"/1m in the scene.
     * - We would like templates created from 5e powers should report their distances in " regardless of the scene units.
     *
     * NOTE: This is a potential maintenance headache as we're not able to call the super with the way it's implemented in v13.
     */
    _refreshRulerText() {
        const { t: shapeType, distance: numGridUnits, flags } = this.document;

        // Provide intelligent defaults as it's possible to create templates independently of an AoE attack.
        const is5e = flags[game.system.id]?.is5e ?? false;
        const usesHexTemplate = flags[game.system.id]?.usesHexTemplate ?? isHexTemplatesEnabled();

        if (shapeType === "circle" || shapeType === "cone" || shapeType === "ray") {
            const originalSizeInMeters = numGridUnits * gridUnitsToMeters() + (usesHexTemplate ? 1 : 0);
            const distanceInSystemUnits = getRoundedUpDistanceInSystemUnits(originalSizeInMeters, is5e);
            const systemUnit = getSystemDisplayUnits(is5e);
            const systemUnitsText = `${distanceInSystemUnits}${systemUnit}`;

            const gridUnit = game.canvas.grid.units;
            const originalSizeInGridUnits = originalSizeInMeters / gridUnitsToMeters();
            const gridUnitsText = `${originalSizeInGridUnits}${gridUnit}`;

            // Show in the system units and then, if different, the size in grid units.
            this.ruler.text = `${systemUnitsText}${systemUnit !== gridUnit ? ` (${gridUnitsText})` : ""}`;
        } else if (shapeType === "rect") {
            this.ruler.text = "This space for rent";
        } else {
            super._refreshRulerText();
        }

        this.ruler.position.set(this.ray.dx + 10, this.ray.dy + 5);
    }

    async _onUpdate(data, options, userId) {
        await super._onUpdate(data, options, userId);

        // Update user targets only if we moved the template (effectively an owner of the template) or if we are the author of the template
        if (game.user.id !== userId && game.user.id !== this.document.author.id) return;

        this._computeShape();
        await this.selectObjects({ checkPositions: true, templateData: data });
        game.user.broadcastActivity({
            targets: Array.from(game.user.targets.map((target) => target.id)),
        });
    }

    _onRelease(...args) {
        console.log("_onRelease", ...args);
        super._onRelease(...args);
    }

    async _refreshTemplate(...args) {
        await super._refreshTemplate(...args);

        // A tad hacky here. When template is first rendered we don't want to selectObjects
        if (game.user.id !== this.document.author?.id) return;

        await this.selectObjects({ checkPositions: true, templateData: this });

        if (!this.isPreview) {
            await game.user.broadcastActivity({
                targets: Array.from(game.user.targets.map((target) => target.id)),
            });
        }
    }

    // Tokens within template
    getTokensInTemplate() {
        // PERSONALIMMUNITY - We are going to exclude the actor that created the template if they are immune
        const PERSONALIMMUNITY = (this.document.flags?.[game.system.id]?.item?.system?.MODIFIER || []).find(
            (modifier) => modifier.XMLID === "PERSONALIMMUNITY",
        );

        const _start = Date.now();

        const tokensInside = canvas.tokens.placeables.filter((token) => {
            // Translate the token's absolute canvas center into the template's local coordinate system
            const localX = token.center.x - this.document.x;
            const localY = token.center.y - this.document.y;

            return this.shape.contains(localX, localY);
        });

        const _end = Date.now();
        if (_end - _start > 100) {
            console.warn(`getTokenInTemplate took ${_end - _start}ms`);
        }

        if (PERSONALIMMUNITY) {
            const tokensInsideWithoutPersonalImmunity = tokensInside.filter(
                (t) => t.actor?.id !== this.document.flags?.[game.system.id]?.actor?._id,
            );
            return tokensInsideWithoutPersonalImmunity;
        }

        return tokensInside;
    }

    // Update user.targets based on which tokens are in the template
    async selectObjects() {
        const targets = [];

        for (const token of this.getTokensInTemplate()) {
            if (!token?.hidden) {
                targets.push(token.id);
            }
        }

        if (JSON.stringify(targets) !== JSON.stringify(Array.from(game.user.targets).map((target) => target.id))) {
            if (game.user._onUpdateTokenTargets) {
                // V13 #2292
                await game.user._onUpdateTokenTargets(targets);
            } else {
                // V12 #2292
                // V14 replaced User#updateTokenTargets with TokenLayer#setTargets
                if (typeof canvas.tokens?.setTargets === "function") {
                    canvas.tokens.setTargets(targets);
                } else {
                    await game.user.updateTokenTargets(targets);
                }
            }
        }
    }
}
