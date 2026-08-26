// Rounding rules for cost calculations. We do not limit rounding to 1 because something
// may or may not be used for a cost calculation. That minimum cost is handled elsewhere.
//
// Whenever something in the rules requires multiplication or
// division, handle round-offs as follows: results ending in .1 to .4
// round to the next integer number towards 0, results ending in .6 to
// .9 round to the next integer number away from 0, and results ending in .5
// round towards or away, whichever is to the advantage of the Player Character.
//
// NOTE: The Hero System assumes that all numbers being rounded are positive but we don't
//       always deal with positive numbers (e.g. range penalties) so we do not use only
//       whole numbers and rounding up or down as described in the books - we are more general.
//
// See FRed. pg 7 and 6e Vol 1 pg 12. Both require rounding to 1 decimal digit.
// NOTE: Fraction rounding for advantages/limitations does not follow these rules.

export function numberToOneDecimalDigit(number) {
    return truncatedNumber10TimesLarger(number) / 10;
}

/**
 * Clamp num to [min, max]. Unlike Math.clamp, an inverted range (max < min, e.g. a drained
 * characteristic max below its floor) collapses to min instead of producing garbage.
 *
 * @param {number} num
 * @param {number} min
 * @param {number} max
 * @returns number
 */
export function clamp(num, min, max) {
    if (max < min) {
        max = min;
    }

    return Math.min(Math.max(num, min), max);
}

function truncatedNumber10TimesLarger(number) {
    return Math.trunc(number * 10);
}

/**
 *
 * @param {number} number - The number to be rounded towards or away from 0 if the decimal digit is 5 otherwise following the usual rules
 * @param {number} roundToZeroAt - The decimal digit (expressed as an integer) where we should be rounding towards 0
 * @returns number
 */
function roundFavorToOrAwayFromZero(number, roundToZeroAt) {
    // Since we only work with 1 decimal digit, we'll avoid floating point comparisons
    // by working with a number that is 10 times larger. The Hero system never works with numbers
    // that are large enough that we have to worry about overflowing JavaScript's number type.
    const adjustedNumber10TimesLarger = truncatedNumber10TimesLarger(number);
    const abs10TimesLargerDecimalDigit = Math.abs(adjustedNumber10TimesLarger % 10);

    // Round towards 0
    if (abs10TimesLargerDecimalDigit <= roundToZeroAt) {
        return (
            (adjustedNumber10TimesLarger < 0
                ? adjustedNumber10TimesLarger + abs10TimesLargerDecimalDigit
                : adjustedNumber10TimesLarger - abs10TimesLargerDecimalDigit) / 10
        );
    }

    // Round away from 0
    return (
        (adjustedNumber10TimesLarger < 0
            ? adjustedNumber10TimesLarger - (10 - abs10TimesLargerDecimalDigit)
            : adjustedNumber10TimesLarger + (10 - abs10TimesLargerDecimalDigit)) / 10
    );
}

/**
 * Truncate number to 1 decimal digit and then round towards 0 if the decimal is 0.0 to 0.5 or away if 0.6 - 0.9.
 *
 * @param {number} number
 * @returns number
 */
export function roundFavorPlayerTowardsZero(number) {
    return roundFavorToOrAwayFromZero(number, 5);
}

/**
 * Truncate number to 1 decimal digit and then round towards 0 if the decimal is 0.0 to 0.4 or away if 0.5 - 0.9.
 *
 * @param {number} number
 * @returns number
 */
export function roundFavorPlayerAwayFromZero(number) {
    return roundFavorToOrAwayFromZero(number, 4);
}
