/**
 * Maneuver Bases And Elements.
 *
 * Per Ultimate Martial Artist a maneuver's effect is a list of BASES (the core action) and
 * ELEMENTS (flavour for the action) (e.g. "Block", "Abort", "Target Falls", "Grab Two Limbs"), not free prose.
 *
 */

/**
 * Every maneuver element the automation recognizes, defined exactly once.
 *
 *   includes — case-insensitive substring(s) marking the element present. An
 *              array means "any of".
 *   excludes — case-insensitive substrings that disqualify an otherwise match
 *   regex    — used instead of `includes` when the element isn't a fixed phrase
 *
 **/
const MANEUVER_BASES_AND_ELEMENTS = Object.freeze({
    abort: { includes: "ABORT" },
    attackerFalls: { includes: "YOU FALL" },
    bind: { includes: "BIND", excludes: ["MUST FOLLOW", "CAN ONLY BE USED AFTER"] },
    block: { includes: "BLOCK", excludes: ["MUST FOLLOW", "CAN ONLY BE USED AFTER"] },
    crush: { includes: "CRUSH", excludes: ["MUST FOLLOW", "CAN ONLY BE USED AFTER"] },
    disable: { includes: "DISABLE", excludes: ["MUST FOLLOW", "CAN ONLY BE USED AFTER"] },
    disarm: { includes: "DISARM", excludes: ["MUST FOLLOW", "CAN ONLY BE USED AFTER"] },
    dodge: { includes: "DODGE", excludes: ["MUST FOLLOW", "CAN ONLY BE USED AFTER"] },
    exert: { includes: "[STRDC]" },
    flashDc: { includes: "[FLASHDC]" },
    fmove: { includes: "FMOVE" },
    grab: {
        includes: "GRAB",
        excludes: ["GRAB WEAPON", "MUST FOLLOW", "CAN ONLY BE USED AFTER", "VS. GRAB", "VERSUS GRAB"],
    },
    grabWeapon: { includes: "GRAB WEAPON" },
    halfMoveRequired: { includes: "HALF MOVE REQUIRED" },
    killingDc: { includes: ["[KILLINGDC]", "[WEAPONKILLINGDC]"] },
    lastingRestriction: { includes: "LASTING RESTRICTION" },
    mustFollow: { includes: "MUST FOLLOW" },
    nndDc: { includes: ["[NNDDC]", "[WEAPONNNDDC]"] },
    normalDc: { includes: ["[NORMALDC]", "[WEAPONDC]"] },
    prone: { includes: "PRONE" },
    requiresBothHands: { includes: "BOTH HANDS" },
    response: { includes: "CAN ONLY BE USED AFTER" },
    root: { includes: "TO RESIST SHOVE" },
    shove: { includes: "SHOVE", excludes: ["TO RESIST SHOVE"] },
    strike: { includes: "STRIKE" },
    takeFullDmg: { regex: /TAKES?\s+FULL\s+(DMG|DAMAGE)/i },
    takeHalfDmg: { regex: /TAKES?\s+HALF\s+(DMG|DAMAGE)/i },
    throw: { includes: ["TARGET FALLS", "HE FALLS", "OPPONENT FALLS"] },
    velocity: { regex: /v\/(\d+)/i },
    weaponDc: { includes: "[WEAPONDC]" },
});

/**
 * The maneuver's effect text, upper-cased, so element matching can be done
 * without worrying about case.
 *
 * @param {HeroSystem6eItem} item The maneuver (or attack) item to read.
 * @returns {string} The upper-cased effect text, or "" if the item has none.
 */
export function getManeuverEffect(item) {
    // PH: FIXME: Should be picking WEAPONEFFECT only if it's a weapon based usage. There is presently
    //            no good way to do that as USEWEAPON seems to be always "No".
    return item.system.EFFECT || item.system.WEAPONEFFECT || "";
}

/**
 * The maneuver's effect text, upper-cased, so element matching can be done
 * without worrying about case.
 *
 * @param {HeroSystem6eItem} item The maneuver (or attack) item to read.
 * @returns {string} The upper-cased effect text, or "" if the item has none.
 */
export function getManeuverEffectCapitalized(item) {
    return getManeuverEffect(item).toUpperCase();
}

/**
 * Split effect text into its constituent elements. HD files EFFECT/WEAPONEFFECT
 * are bases and/or elements written with either "," or ";" as separators.
 *
 * @param {string} text
 *
 * @returns {string[]}
 */
function splitBasesAndElementsFromEffectField(item) {
    const effectText = getManeuverEffect(item);
    if (!effectText) {
        return [];
    }

    return effectText
        .split(/[,;]/)
        .map((element) => element.trim())
        .filter(Boolean);
}

/**
 * The basis or element of the given kind that the item effect contains.
 *
 * Matching is case-insensitive, but the returned string keeps the original
 * casing (trimmed) so callers can display or further parse what was actually
 * written. When several elements match, the first one wins.
 *
 * @param {HeroSystem6eItem} item
 * @param {string} basisOrElementKey - Element to search for. String must be a key of MANEUVER_BASES_AND_ELEMENTS
 *
 * @returns {string|undefined} The matching basis/element text as written, or
 *   undefined when the effect does not include it. Truthy when present, so a bare
 *   `if (maneuverBasisOrElement(...))` still reads as a presence check; cast with
 *   `!!` wherever a true boolean is required.
 */
export function maneuverBasisOrElement(item, basisOrElementKey) {
    const elementDefinition = MANEUVER_BASES_AND_ELEMENTS[basisOrElementKey];
    if (!elementDefinition) {
        console.error(`${item.detailedName()}: Unknown maneuver basis or element "${basisOrElementKey}"`);
        return undefined;
    }
    const markers = elementDefinition.includes
        ? [elementDefinition.includes].flat().map((marker) => marker.toUpperCase())
        : [];

    // Keep the original casing for the return value; only the haystack we match
    // against is upper-cased, so matching stays case-insensitive.
    const basesAndElements = splitBasesAndElementsFromEffectField(item);

    return basesAndElements.find((presentBasisOrElement) => {
        const uppercaseBasisOrElement = presentBasisOrElement.toUpperCase();
        const matched = elementDefinition.regex
            ? elementDefinition.regex.test(uppercaseBasisOrElement)
            : markers.some((marker) => uppercaseBasisOrElement.includes(marker));
        if (!matched) {
            return false;
        }

        return !(elementDefinition.excludes ?? []).some((exclusion) =>
            uppercaseBasisOrElement.includes(exclusion.toUpperCase()),
        );
    });
}
