import { roundFavorPlayerTowardsZero } from "./round.mjs";
import { actorMovementKey, asTokenDocument } from "./movement.mjs";
import { squelch } from "./util.mjs";

/**
 * Conversion factors for mass, length, and time.
 *
 * Imperial factors follow the 1959 international yard and pound agreement.
 *
 * Keep every conversion factor in this file, at its exact defined value. Derive a factor that has no
 * literal of its own. A rounded factor hands its error to everything derived from it.
 */

export const kgPerLb = 0.45359237;

export const cmPerInch = 2.54;

export function convertLbsToKg(weightInLbs) {
    return weightInLbs * kgPerLb;
}

export function convertKgToLbs(massInKg) {
    return massInKg / kgPerLb;
}

export function convertInchesToCm(lengthInInches) {
    return lengthInInches * cmPerInch;
}

export function convertCmToInches(lengthInCm) {
    return lengthInCm / cmPerInch;
}

export function metricUnitsEnabled() {
    return game.settings.get(game.system.id, "metricUnits");
}

export function getHeftUnits() {
    return metricUnitsEnabled() ? "kg" : "lbs";
}

/**
 * Height in the unit a sheet draws: centimetres when metric, inches otherwise.
 *
 * Documents store inches. This converts for the drawing step only, and rounds nothing, because the
 * field's declared `step` owns precision.
 *
 * @param {number} lengthInInches Stored height.
 * @returns {number} The height in display units.
 */
export function heightInDisplayUnits(lengthInInches) {
    return metricUnitsEnabled() ? convertInchesToCm(lengthInInches) : lengthInInches;
}

/**
 * Weight in the unit a sheet draws: kilograms when metric, pounds otherwise.
 *
 * Documents store pounds. This converts for the drawing step only, and rounds nothing, because the
 * field's declared `step` owns precision.
 *
 * @param {number} massInLbs Stored weight.
 * @returns {number} The weight in display units.
 */
export function weightInDisplayUnits(massInLbs) {
    return metricUnitsEnabled() ? convertLbsToKg(massInLbs) : massInLbs;
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
 * Hero System 6e uses meters (no hexes)
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
export function convertSystemUnitsToMeters(distanceInSystemUnits, is5e) {
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
 * @param {number} distanceInMeters
 * @param {boolean} is5e
 * @returns number
 */
export function getRoundedDownDistanceInSystemUnits(distanceInMeters, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    const roundedDistanceInMeters = is5e ? Math.floor(distanceInMeters / 2) : Math.floor(distanceInMeters);

    return roundedDistanceInMeters;
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
 * @param {number} distanceInMeters
 * @param {boolean} is5e
 * @returns number
 */
export function getRoundedFavorPlayerTowardsZeroDistanceInSystemUnits(distanceInMeters, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    const roundedDistanceInMeters = is5e
        ? roundFavorPlayerTowardsZero(distanceInMeters / 2)
        : roundFavorPlayerTowardsZero(distanceInMeters);

    return roundedDistanceInMeters;
}

/**
 * Return the distance in the nearest rounded up system units.
 * 8.9m is 9m in 6e and 5" in 5e.
 * 9.9m is 10m in 6e and 5" in 5e.
 *
 * NOTE: Only works for positive numbers
 *
 * @param {number} distanceInMeters
 * @param {boolean} is5e
 * @returns number
 */
export function getRoundedUpDistanceInSystemUnits(distanceInMeters, is5e) {
    if (is5e !== false && is5e !== true) {
        if (!squelch("units5e")) {
            console.warn(`bad is5e parameter, using DefaultEdition`, is5e);
        }
        const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
        is5e = DefaultEdition;
    }

    const roundedDistanceInMeters = is5e ? Math.ceil(distanceInMeters / 2) : Math.ceil(distanceInMeters);

    return roundedDistanceInMeters;
}

export const daysPerGregorianYear = 365.2425;
export const secondsPerGregorianYear = daysPerGregorianYear * 60 * 60 * 24;
export const turnsPerGregorianYear = secondsPerGregorianYear / 12;

export const metersPerFoot = 0.3048;
export const metersPerMile = 5280 * metersPerFoot;

// Per IAU 2012 standard.
export const metersPerAstronomicalUnit = 149597870700;

// Per IAU standard: one Julian year (365.25 days) at 299792458 m/s. The Julian year fixes the unit; a
// Gregorian year would put this light year 2.1e-5 relative below every published figure.
export const metersPerLightYear = 9.4607304725808e15;

const arcsecondsPerRadian = (180 / Math.PI) * 60 * 60;

// Per IAU 2015. The `tan` form differs by 8e-12 relative, below any measurable need.
export const metersPerParsec = arcsecondsPerRadian * metersPerAstronomicalUnit;

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
        distanceMultiplier = metersPerFoot;
    } else if (units === "miles") {
        distanceMultiplier = metersPerMile;
    } else if (units === "au") {
        distanceMultiplier = metersPerAstronomicalUnit;
    } else if (units === "ly") {
        distanceMultiplier = metersPerLightYear;
    } else if (units === "pc") {
        distanceMultiplier = metersPerParsec;
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
 * Pass the thing that is moving. A token resolves through its actor, so a token and its actor give the
 * same answer. The actor holds the active movement mode, and every linked token stays in sync with it.
 *
 * @param {HeroSystem6eActor|HeroSystem6eToken|HeroSystem6eTokenDocument} mover Actor or token that moves.
 *
 * @returns {number} Velocity in the current scene's system units.
 */
export function calculateVelocityInSystemUnits(mover) {
    const tokenDocument = asTokenDocument(mover);
    const actor = tokenDocument?.actor ?? mover;
    const movementKey = actorMovementKey(actor);

    // An actor with no movement characteristic, such as a base2, has nothing to move on.
    if (movementKey === "none") {
        return 0;
    }

    // Simplistic velocity calc using current movement
    // TODO: This is likely wrong for Teleport and other movements with quirky velocity rules.
    const velocity = parseInt(actor.getMovementCharacteristic(movementKey)?.value || 0);

    return Math.max(0, velocity);
}
