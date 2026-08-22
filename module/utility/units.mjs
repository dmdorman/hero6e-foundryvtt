import { roundFavorPlayerTowardsZero } from "./round.mjs";
import { squelch } from "./util.mjs";

export const lbsInOneKg = 2.2046226218;
export const kgsInOneLb = 1 / lbsInOneKg;

export function getHeftUnits() {
    const metricUnits = game.settings.get(game.system.id, "metricUnits");
    return metricUnits ? "kg" : "lbs";
}

export function getMonetaryUnits(/*actor*/) {
    // PH: FIXME: Get them from the HDC campaign rules otherwise default to $
    return "$";
}

/**
 * A note about units reflecting distance
 *
 * Hero System and the FoundryVTT system force us to use a number of different units for measurements.
 *
 * Hero System 5e uses 2m hexes (1 hex = 1")
 * Hero System 6e uses metres (no hexes)
 * Internally, we typically use system units (" or m) depending on the system of the actor/item.
 *
 * FoundryVTT uses grid units of any dimension (defined on a per scene basis) or pixels if we're dealing with canvas.
 */

export function getSystemDisplayUnits(is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    return is5e ? '"' : "m";
}

/**
 *
 * @param {number} distanceInSystemUnits
 * @param {boolean} is5e
 * @returns number
 */
export function convertSystemUnitsToMetres(distanceInSystemUnits, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    return distanceInSystemUnits * (is5e ? 2 : 1);
}

/**
 *
 * @param {number} distanceInHexes
 * @param {boolean} is5e
 * @returns number - number of system units of the hex (same for 5e and double for 6e)
 */
export function convertHexesToSystemUnits(distanceInHexes, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    return distanceInHexes * (is5e ? 1 : 2);
}

export function hexDistanceToSystemDisplayString(distanceInHexes, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    return `${convertHexesToSystemUnits(distanceInHexes, is5e)}${getSystemDisplayUnits(is5e)}`;
}

/**
 * Return the distance in the nearest rounded down system units.
 * 8.9m is 8m in 6e and 4" in 5e.
 * 9.9m is 9m in 6e and 4" in 5e.
 *
 * @param {number} distanceInMetres
 * @param {boolean} is5e
 * @returns number
 */
export function getRoundedDownDistanceInSystemUnits(distanceInMetres, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    const roundedDistanceInMetres = is5e ? Math.floor(distanceInMetres / 2) : Math.floor(distanceInMetres);

    return roundedDistanceInMetres;
}

/**
 * Return the distance in system units rounded off in Player Favor
 * 8.1m is 8m in 6e and 4" in 5e.
 * 8.5m is 8m in 6e and 4" in 5e.
 * 8.9m is 9m in 6e and 4" in 5e.
 * 9.1m is 9m in 6e and 4" in 5e.
 * 9.5m is 10m in 6e and 5" in 5e.
 * 9.9m is 10m in 6e and 5" in 5e.
 *
 * @param {number} distanceInMetres
 * @param {boolean} is5e
 * @returns number
 */
export function getRoundedFavorPlayerTowardsZeroDistanceInSystemUnits(distanceInMetres, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    const roundedDistanceInMetres = is5e
        ? roundFavorPlayerTowardsZero(distanceInMetres / 2)
        : roundFavorPlayerTowardsZero(distanceInMetres);

    return roundedDistanceInMetres;
}

/**
 * Return the distance in the nearest rounded up system units.
 * 8.9m is 9m in 6e and 5" in 5e.
 * 9.9m is 10m in 6e and 5" in 5e.
 *
 * NOTE: Only works for positive numbers
 *
 * @param {number} distanceInMetres
 * @param {boolean} is5e
 * @returns number
 */
export function getRoundedUpDistanceInSystemUnits(distanceInMetres, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    const roundedDistanceInMetres = is5e ? Math.ceil(distanceInMetres / 2) : Math.ceil(distanceInMetres);

    return roundedDistanceInMetres;
}

export const daysPerGregorianYear = 365.2425;
export const secondsPerGregorianYear = 31556952;
export const turnsPerGregorianYear = 31556952 / 12;

export const astronomicalUnitsInMetres = 1.496e11;
export const lightYearInMetres = 9.461e15;
export const parsecInLightYears = 3.26156;
export const parsecInMetres = parsecInLightYears * lightYearInMetres;

/**
 * Converts scene grid units to meters with spam-safe parameters for loop paths.
 * @param {object} [options={}] - Configuration flags
 * @param {boolean} [options.silent=false] - If true, squelches UI toast alerts
 * @param {Scene} [options.scene=null] - Explicit target scene to look up
 * @returns {number} Distance multiplier float value
 */
export function gridUnitsToMeters(options = {}) {
    const silent = options.silent ?? false;

    // V14 MULTI-SCENE GUARD: Fallback to active canvas scene ONLY if no explicit scene context is provided
    const targetScene = options.scene ?? game.scenes?.current ?? game.canvas?.scene;
    const units = targetScene?.grid?.units ?? "m";

    let distanceMultiplier;
    if (units === "m") {
        distanceMultiplier = 1;
    } else if (units === '"') {
        distanceMultiplier = 2; // Hero system hexes (5e)
    } else if (units === "km") {
        distanceMultiplier = 1000;
    } else if (units === "ft") {
        distanceMultiplier = 0.3048;
    } else if (units === "miles") {
        distanceMultiplier = 1609.34;
    } else if (units === "au") {
        distanceMultiplier = astronomicalUnitsInMetres;
    } else if (units === "ly") {
        distanceMultiplier = lightYearInMetres;
    } else if (units === "pc") {
        distanceMultiplier = parsecInMetres;
    } else {
        // Only compile error toast messages if silent parameter is explicitly false
        if (!silent && !squelch(targetScene?.name || "scene")) {
            ui.notifications.error(
                `Scene "${targetScene?.name}" has unknown grid units (${units}). Fix your scene grid.`,
            );
        }
        distanceMultiplier = 1;
    }
    return distanceMultiplier;
}

/**
 * Try to translate the grid into meters (i.e. m/grid unit)
 *
 * @returns number
 */
export function getGridSizeInMeters() {
    const distance = game.canvas.grid.distance || 1;
    const distanceMultiplier = gridUnitsToMeters();

    return distance * distanceMultiplier;
}

/**
 * Given a distance in meters, translate that into rounded up number of grids
 *
 * @param {number} distanceInMeters
 * @returns number
 */
export function roundDistanceInMetersUpToNumberOfGridUnits(distanceInMeters) {
    const gridSizeInMeters = getGridSizeInMeters();

    if (distanceInMeters % gridSizeInMeters !== 0) {
        distanceInMeters += gridSizeInMeters - (distanceInMeters % gridSizeInMeters);
    }

    return distanceInMeters;
}

export function currentSceneUsesHexGrid() {
    return !(
        game.scenes.current?.grid.type === CONST.GRID_TYPES.GRIDLESS ||
        game.scenes.current?.grid.type === CONST.GRID_TYPES.SQUARE
    );
}

/**
 * Calculate the velocity in system units (5e is " and 6e in m).
 *
 * @param {Object} actor
 *
 * @returns {Number}
 */
export function calculateVelocityInSystemUnits(actor) {
    let velocity;

    // Simplistic velocity calc using current movement
    // TODO: This is likely wrong for Teleport and other movements with quirky velocity rules.
    velocity = parseInt(actor.system.characteristics[actor.activeMovement]?.value || 0);

    // Sanity check
    if (velocity <= 0) {
        console.warn(`Calculated velocity of ${velocity} is invalid, using simplistic calculation`);
        velocity = Math.max(0, parseInt(actor.system.characteristics[actor.activeMovement]?.value || 0));
    }

    return velocity;
}
