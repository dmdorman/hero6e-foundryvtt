import { isGameV12OrLater } from "./utility/compatibility.mjs";
import { HEROSYS } from "./herosystem6e.mjs";

export default class HeroSystem6eMeasuredTemplate extends MeasuredTemplate {
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

        const HexTemplates = game.settings.get(HEROSYS.module, "HexTemplates");

        const hexGrid = !(
            game.scenes.current.grid.type === CONST.GRID_TYPES.GRIDLESS ||
            game.scenes.current.grid.type === CONST.GRID_TYPES.SQUARE
        );

        if (HexTemplates && hexGrid) {
            const isV12 = isGameV12OrLater();

            if (shapeType === "circle") {
                if (!isV12) {
                    // v11
                    // 5e is based on hexes but 6e is based on gridless. Adapt 5e templates to gridless
                    // but it's only an approximation as the 2 systems are not comparable.
                    const columnarGridArrangement =
                        game.scenes.current.grid.type === CONST.GRID_TYPES.GRIDLESS ||
                        game.scenes.current.grid.type === CONST.GRID_TYPES.SQUARE
                            ? true
                            : game.canvas.grid.grid.columnar;

                    const shapeVector = columnarGridArrangement
                        ? [canvas.dimensions.distancePixels * Math.sqrt(3), canvas.dimensions.distancePixels * 2]
                        : [canvas.dimensions.distancePixels * 2, canvas.dimensions.distancePixels * Math.sqrt(3)];

                    // Hex based circle looks like a hexagon. The hexagon has the opposite orientation of the grid.
                    // See https://www.redblobgames.com/grids/hexagons/#basics for instance.
                    const gridHexagonVertices = columnarGridArrangement
                        ? HexagonalGrid.pointyHexPoints
                        : HexagonalGrid.flatHexPoints;

                    const pixelHexagonVertices = gridHexagonVertices.map(
                        (vertex) =>
                            new PIXI.Point(
                                (vertex[0] - 0.5) * distance * shapeVector[0],
                                (vertex[1] - 0.5) * distance * shapeVector[1],
                            ),
                    );

                    return new PIXI.Polygon(...pixelHexagonVertices);
                } else {
                    // v12
                    const vertices = game.canvas.grid.getCircle({ x: 0, y: 0 }, distance);

                    return new PIXI.Polygon(...vertices);
                }
            } else if (shapeType === "cone") {
                // 5e cones are hex counted and have a flat end. We only support v12 for these.
                if (isV12) {
                    const vertices = game.canvas.grid.getCone({ x: 0, y: 0 }, distance, direction, angle);

                    return new PIXI.Polygon(...vertices);
                }
            }
        }

        return super._computeShape();
    }

    async _onUpdate(data, options, userId) {
        await super._onUpdate(data, options, userId);

        if (game.user.id !== userId) return;

        this._computeShape();
        this.selectObjects({ checkPositions: true, templateData: data });
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
        if (game.user.id !== this.document.user.id) return;

        await this.selectObjects();

        if (!this.isPreview) {
            await game.user.broadcastActivity({
                targets: Array.from(game.user.targets.map((target) => target.id)),
            });
        }
    }

    // Tokens within template
    getTokensInTemplate(options) {
        // PERSONALIMMUNITY
        const PERSONALIMMUNITY = (this.document.flags?.item?.system?.MODIFIER || []).find(
            (modifier) => modifier.XMLID === "PERSONALIMMUNITY",
        );

        const tokens = [];
        for (const token of this.scene.tokens) {
            // For some reason the only the base ITEM and ACTOR props pass into this class, so we aren't using the typical functions like actor.id instead use actor._id.
            if (this.isTokenInside(token, options)) {
                if (!PERSONALIMMUNITY || token.actor?.id !== this.document.flags?.actor?._id) {
                    tokens.push(token);
                }
            }
        }
        return tokens;
    }

    isTokenInside(token, options) {
        options = { checkShape: true, checkPositions: true, ...options };
        // Use Shape (but there are rounding issues; specifically if token and MeasuredTemplate have same hex origin)
        if (options.checkShape) {
            const actorToken = token?.object;
            const _x = actorToken.center.x - (options?.templateData?.x || this.x);
            const _y = actorToken.center.y - (options?.templateData?.y || this.y);
            if (this.shape.contains(_x, _y)) return true;
        }

        // Use positions (but some tokens may not be exactly centered on a 1 hex)
        if (options.checkPositions) {
            if (this._getGridHighlightPositions().find((o) => o.x === token.x && o.y === token.y)) return true;
        }

        return false;
    }

    // Update user.targets based on which tokens are in the template
    async selectObjects(options) {
        const targets = [];

        for (const token of this.getTokensInTemplate(options)) {
            if (!token?.hidden) {
                targets.push(token.id);
            }
        }

        if (JSON.stringify(targets) !== JSON.stringify(Array.from(game.user.targets).map((target) => target.id))) {
            await game.user.updateTokenTargets(targets);
        }
    }
}
