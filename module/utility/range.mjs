import { getRoundedFavorPlayerDownDistanceInSystemUnits } from "./units.mjs";
import HeroSystem6eMeasuredTemplate from "../measuretemplate.mjs";

/**
 * Calculate range based on a provided distance in metres. Range penalties are essentially
 * the same in 5e and 6e, but there is a difference in the rounding of the distance.
 *
 * @param {number} distanceInMetres
 * @param {object} actor
 *
 * @returns {number} rangePenalty
 */
export function calculateRangePenaltyFromDistanceInMetres(distanceInMetres, actor) {
    const is5e = actor?.system?.is5e;
    const roundedDistanceInMetres =
        getRoundedFavorPlayerDownDistanceInSystemUnits(distanceInMetres, actor) * (is5e ? 2 : 1);
    const basicRangePenalty = Math.ceil(Math.log2(roundedDistanceInMetres / 8)) * 2;
    const rangePenalty = Math.max(0, basicRangePenalty);

    return rangePenalty;
}

/**
 * Calculate the distance between 2 tokens
 *
 * @param {object} origin MeasuredTemplate or Token or {x: number, y: number, elevation?: number}
 * @param {object} target MeasuredTemplate or Token or {x: number, y: number, elevation?: number}
 *
 * @returns {number} distanceInMetres
 */
export function calculateDistanceBetween(origin, target) {
    // Note: canvas.grid.measureDistance is deprecated as of Foundry v12. When we add better support for
    // templates here, also consider updating to use the new api (canvas.grid.measurePath)
    const originalMeasureDistance = canvas.grid.measureDistance(origin, target, {
        gridSpaces: true,
    });

    // We don't yet support measuring 3D distance between a token and a template volume, so we
    // return the original distance
    const templateInvolved =
        origin._object instanceof HeroSystem6eMeasuredTemplate ||
        target._object instanceof HeroSystem6eMeasuredTemplate;
    if (templateInvolved) {
        return originalMeasureDistance;
    }

    const originElevation = origin.document ? origin.document.elevation || 0 : origin.elevation || 0;
    const targetElevation = target.document ? target.document.elevation || 0 : target.elevation || 0;
    if (originElevation === targetElevation) {
        return originalMeasureDistance;
    }

    // We need to decide on an actor to use for the system units. Since both objects being measured are tokens,
    // we can use the origin token's actor.
    const rulesActor = origin.actor;
    const threeDDistance = Math.sqrt(
        Math.pow(originElevation - targetElevation, 2) + Math.pow(originalMeasureDistance, 2),
    );

    return getRoundedFavorPlayerDownDistanceInSystemUnits(threeDDistance, rulesActor);
}
