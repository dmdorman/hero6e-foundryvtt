/**
 * A temporary method to be used during the transition to make it easy to find bits of code
 * that are dependent on v12 or v13 checks.
 *
 * @returns boolean
 */
export function isGameV13OrLater() {
    return foundry.utils.isNewerVersion(game.version, "12.343");
}

/**
 * A temporary method to be used during the transition to make it easy to find bits of code
 * that are dependent on v13 or v14 checks.
 *
 * @returns boolean
 */
export function isGameV14OrLater() {
    return foundry.utils.isNewerVersion(game.version, "14.352"); // Ignore the prototype versions - 352 is the last prototype version
}

/**
 * FoundryVTT overloads Math to add the clamped or clamp method depending on the version.
 * Just provide a straight implementation.
 *
 * If max < min then min = max
 *
 * @param {number} num - The number to clamp
 * @param {number} min - The lower bound to clamp num to
 * @param {number} max - The upper bound to clamp num to
 *
 * @returns number
 */
export function clamp(num, min, max) {
    if (max < min) {
        max = min;
    }

    return Math.min(Math.max(num, min), max);
}
