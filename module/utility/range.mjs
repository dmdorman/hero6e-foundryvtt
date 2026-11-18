import { getRoundedFavorPlayerTowardsZeroDistanceInSystemUnits, gridUnitsToMeters } from "./units.mjs";
import HeroSystem6eMeasuredTemplate from "../measuretemplate.mjs";
import { roundFavorPlayerTowardsZero } from "./round.mjs";

/**
 * Calculate range based on a provided distance in meters. Range penalties are essentially
 * the same in 5e and 6e, but there is a difference in the rounding of the distance.
 *
 * @param {number} distanceInMeters
 * @param {object} actor
 *
 * @returns {number} rangePenalty
 */
export function calculateRangePenaltyFromDistanceInMeters(distanceInMeters, actor) {
    const is5e = actor?.system?.is5e;
    const roundedDistanceInMeters =
        getRoundedFavorPlayerTowardsZeroDistanceInSystemUnits(distanceInMeters, is5e) * (is5e ? 2 : 1);
    const basicRangePenalty = Math.ceil(Math.log2(roundedDistanceInMeters / 8)) * 2;
    const rangePenalty = Math.max(0, basicRangePenalty);

    return rangePenalty;
}

/**
 * Calculate the distance between 2 tokens
 *
 * @param {object} origin MeasuredTemplate or Token or {x: number, y: number, elevation?: number}
 * @param {object} target MeasuredTemplate or Token or {x: number, y: number, elevation?: number}
 *
 * @returns {number} distanceInMeters
 */
export function calculateDistanceBetween(origin, target) {
    if (!origin || !target) {
        return {
            distance: 0,
            cost: 0,
            gridSpaces: 0,
        };
    }

    // V14 origin is likely a region, which can have several shapes.
    // We are going to use the x/y of the first shape.

    const path = [];
    try {
        path.push({
            x: origin.getCenterPoint?.().x ?? origin.shapes?.[0]?.x ?? origin.x,
            y: origin.getCenterPoint?.().y ?? origin.shapes?.[0]?.y ?? origin.y,
        });
        path.push({
            x: target.getCenterPoint?.().x ?? target.shapes?.[0]?.x ?? target.x,
            y: target.getCenterPoint?.().y ?? target.shapes?.[0]?.y ?? target.y,
        });
    } catch (e) {
        console.error(e, origin, target);
    }

    const distanceMeasurePath = canvas.grid.measurePath(path);
    const originalMeasureDistanceMeters = roundFavorPlayerTowardsZero(
        distanceMeasurePath.distance * gridUnitsToMeters(),
    );

    // We don't yet support measuring 3D distance between a token and a template volume, so we
    // return the original distance
    const templateInvolved =
        origin._object instanceof HeroSystem6eMeasuredTemplate ||
        target._object instanceof HeroSystem6eMeasuredTemplate ||
        // V14 uses regions for AOE templates.
        origin.documentName === "Region" ||
        target.documentName === "Region";
    if (templateInvolved) {
        return {
            distance: originalMeasureDistanceMeters,
            cost: distanceMeasurePath.cost,
            gridSpaces: distanceMeasurePath.spaces,
        };
    }

    const originElevation = origin.document ? origin.document.elevation || 0 : origin.elevation || 0;
    const targetElevation = target.document ? target.document.elevation || 0 : target.elevation || 0;
    if (originElevation === targetElevation) {
        return {
            distance: originalMeasureDistanceMeters,
            cost: distanceMeasurePath.cost,
            gridSpaces: distanceMeasurePath.spaces,
        };
    }

    // We need to decide on an actor to use for the system units. Since both objects being measured are tokens,
    // we can use the origin token's actor.
    const rulesActor = origin.actor ?? foundry.utils.fromUuidSync(origin.flags[game.system.id]?.actorUuid);
    const threeDDistance = Math.sqrt(
        Math.pow(originElevation - targetElevation, 2) + Math.pow(originalMeasureDistanceMeters, 2),
    );

    return {
        distance: getRoundedFavorPlayerTowardsZeroDistanceInSystemUnits(threeDDistance, rulesActor.is5e),
        cost: 0, // FIXME: to be implemented
        gridSpaces: 0, // FIXME: to be implemented
    };
}
