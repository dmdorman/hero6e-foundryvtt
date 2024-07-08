export function getSystemDisplayUnits(is5e) {
    if (is5e !== false && is5e !== true && is5e !== undefined) {
        console.error("bad paramater", is5e);
    }
    return is5e ? '"' : "m";
}

/**
 *
 * @param {object} actor
 * @returns number
 */
export function convertSystemUnitsToMetres(distanceInSystemUnits, actor) {
    return distanceInSystemUnits * actor?.system?.is5e ? 2 : 1;
}

/**
 * Return the distance in the nearest rounded down system units.
 * 8.9m is 8m in 6e and 4" in 5e.
 * 9.9m is 9m in 6e and 4" in 5e.
 *
 * @param {number} distanceInMetres
 * @param {object} actor
 * @returns number
 */
export function getRoundedDownDistanceInSystemUnits(distanceInMetres, actor) {
    const is5e = actor?.system?.is5e;

    const roundedDistanceInMetres = is5e ? Math.floor(distanceInMetres / 2) : Math.floor(distanceInMetres);

    return roundedDistanceInMetres;
}

/**
 * Return the distance in the nearest rounded up system units.
 * 8.9m is 9m in 6e and 5" in 5e.
 * 9.9m is 10m in 6e and 5" in 5e.
 *
 * @param {number} distanceInMetres
 * @param {object} actor
 * @returns number
 */
export function getRoundedUpDistanceInSystemUnits(distanceInMetres, actor) {
    const is5e = actor?.system?.is5e;

    const roundedDistanceInMetres = is5e ? Math.ceil(distanceInMetres / 2) : Math.ceil(distanceInMetres);

    return roundedDistanceInMetres;
}
