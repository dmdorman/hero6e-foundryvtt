import { roundFavorPlayerAwayFromZero } from "./round.mjs";
import { getSystemDisplayUnits } from "./units.mjs";

import { HEROSYS } from "../herosystem6e.mjs";

import { getCostPerHalfDie, getCostPerDiePip, HeroSystem6eItem } from "../item/item.mjs";

export function combatSkillLevelsForAttack(item) {
    if (!item.system._active) {
        console.error(`Missing _active`, item, this);
    }

    const results = {
        ocv: 0,
        dcvHth: 0,
        dcvRanged: 0,
        dmcv: 0,
        omcv: 0,
        dc: 0,
        details: [],
    };

    if (!item.actor) {
        return results;
    }

    // PH: FIXME: Same questions as PSL usage, do CSLs stack for base item and effective attack item? Would seem they should.
    for (const cslSkill of item.csls) {
        const detail = {
            ocv: 0,
            dcvHth: 0,
            dcvRanged: 0,
            dmcv: 0,
            omcv: 0,
            dc: 0,
            item: cslSkill,
        };

        for (let i = 0; i < cslSkill.system.csl.length; i++) {
            if (detail[cslSkill.system.csl[i]] !== undefined) {
                detail[cslSkill.system.csl[i]]++;
            } else {
                console.error(
                    `${cslSkill.detailedName()}: unhandled CSL specification, retargeting to +ocv`,
                    cslSkill.system.csl,
                );
                detail.ocv++;
            }
        }

        // Add to result summary
        results.details.push(detail);
        for (const key of ["ocv", "dcvHth", "dcvRanged", "omcv", "dmcv", "dc"]) {
            results[key] += detail[key];
        }
    }

    return results;
}

const zeroDiceParts = Object.freeze({
    dc: 0,
    d6Count: 0,
    d6Less1DieCount: 0,
    halfDieCount: 0,
    constant: 0,
});

/**
 * @typedef {Object} HeroSystemFormulaDiceParts
 * @property {number} d6Count - number of whole dice (e.g. 73d6)
 * @property {number} d6Less1DieCount - 1 or 0 1d6-1 terms (e.g. 1d6-1)
 * @property {number} halfDieCount - 1 or 0 half dice terms (e.g. ½d6)
 * @property {number} constant - 1 or 0 reflecting a +1 (e.g. 2d6 + 1)
 * @property {number} dc - damage class with factional DCs allowed
 */
/**
 * @typedef {HeroSystemFormulaTag}
 * @property {string} value - value of the tag
 * @property {string} name - name of the tag
 * @property {string} title - tooltip string
 */
/**
 * @typedef {HeroSystemFormulaDicePartsBundle}
 * @property {HeroSystemFormulaDiceParts} diceParts
 * @property {array.<HeroSystemFormulaTag>} tags
 */

function characteristicDicePartsToDc(charDiceParts) {
    return charDiceParts.d6Count + charDiceParts.halfDieCount * 0.6;
}

/**
 * Return the dice and half dice roll for this characteristic value. Doesn't support +1 intentionally.
 * @param {number} value
 * @returns {HeroSystemFormulaDiceParts}
 */
export function characteristicValueToDiceParts(value) {
    const charDiceParts = {
        dc: 0,
        d6Count: Math.trunc(value / 5) || 0,
        d6Less1DieCount: 0,
        halfDieCount: Math.round((value % 5) / 5) || 0,
        constant: 0,
    };

    // Calculate the effective DC from the dice parts so we don't turn 7 STR into 1.4 DC (which is 1d6+1).
    charDiceParts.dc = characteristicDicePartsToDc(charDiceParts);

    return charDiceParts;
}

/**
 * Can only push and reduce so much. Make sure we're not exceeding basic boundaries.
 *
 * @param {number} startingRealCost
 * @param {number} desiredEffectiveRealCost
 */
export function calculateReduceOrPushRealCost(startingRealCost, desiredEffectiveRealCost) {
    let pushedRealPoints = 0;

    // Can't set to less than 1 CP
    // Follow superheroic rules and don't allow more than 10 points of pushing
    const effectiveRealCost = Math.min(
        Math.max(1, desiredEffectiveRealCost),
        startingRealCost + Math.min(10, startingRealCost),
    );

    // PH: FIXME: Not allowed to more than double active points

    if (effectiveRealCost > startingRealCost) {
        pushedRealPoints = effectiveRealCost - startingRealCost;
    }

    return {
        effectiveRealCost,
        pushedRealPoints,
    };
}

/**
 * Build an item that is based on STR.
 *
 * @param {number} effectiveStr
 */
export function buildStrengthItem(effectiveStr, actor, name) {
    const strengthItem = new HeroSystem6eItem(
        HeroSystem6eItem.itemDataFromXml(
            `<POWER XMLID="__STRENGTHDAMAGE" ID="1709333792635" BASECOST="0.0" LEVELS="1" ALIAS="__InternalStrengthPlaceholder" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
            actor,
        ),
        {
            parent: actor,
        },
    );

    strengthItem.name = name;

    strengthItem.changePowerLevel(effectiveStr);

    return strengthItem;
}

export function effectiveStrength(item, options) {
    // PH: FIXME: Should get rid of this _active.effectiveStr
    if (item.system._active.effectiveStr != undefined) {
        return item.system._active.effectiveStr;
    } else if (options.effectiveStr != undefined) {
        return options.effectiveStr;
    }

    return parseInt(item.actor?.system.characteristics.str?.value || 0);
}

export function calculateStrengthMinimumForItem(itemWithStrengthMinimum, strengthMinimumModifier) {
    let strMinimumValue = parseInt(strengthMinimumModifier.OPTION_ALIAS?.match(/^\d+$/)?.[0] || 0);

    // Aaron's attempt to parse OPTIONID="9-13" as found in Julia (Red) Augusta.hdc
    if (!strMinimumValue) {
        strMinimumValue = parseInt(strengthMinimumModifier.OPTIONID?.match(/^\d+-(\d+)$/)?.[1] || 0);
    }

    // Newer HDC files (post 2022?) have OPTION_ALIAS defined to give us the minimum strength range. If players have filled in the exact value
    // as "<number>" then use that, otherwise fallback to calculating an estimate based on a range. Note a STR minimum of less than 1 is not allowed.
    if (strMinimumValue === 0) {
        // Older HDC files seem to have to calculate it based on the limitation value
        const limitationBaseCost = strengthMinimumModifier.BASECOST;
        if (itemWithStrengthMinimum.id) {
            console.warn(
                `${itemWithStrengthMinimum.actor?.name}/${itemWithStrengthMinimum.detailedName()} really making a guess with STRMINIMUM limitations. Update HDC to newer HD version and set the modifier's OPTION field to just the minimum STR.`,
            );
        } else {
            console.info(
                `${itemWithStrengthMinimum.actor?.name}/${itemWithStrengthMinimum.detailedName()} really making a guess with STRMINIMUM limitations. Update HDC to newer HD version and set the modifier's OPTION field to just the minimum STR.`,
            );
        }

        if (limitationBaseCost == -0.25) {
            // -1/4 limitation is str min 1-5.
            strMinimumValue = 5;
        } else if (limitationBaseCost == -0.5) {
            // -2/4 limitation is str min 6-14.
            strMinimumValue = 14;
        } else if (limitationBaseCost == -0.75) {
            // -3/4 limitation is str min 15-17.
            strMinimumValue = 17;
        } else if (limitationBaseCost == -1) {
            // -1 limitation is str min 18+.
            strMinimumValue = 20;
        } else {
            console.error(
                `${itemWithStrengthMinimum.detailedName()} has ${strengthMinimumModifier.XMLID} with unrecognized limitation of ${limitationBaseCost} levels`,
            );
        }
    }

    // PH: FIXME: None of the minima modifiers (two hands, brace, etc) are considered here.

    return strMinimumValue;
}

function isNonKillingStrengthBasedManeuver(item) {
    return (
        !item.doesKillingDamage &&
        item.system.usesStrength &&
        (item.isMartialManeuver ||
            (item.isCombatManeuver &&
                (item.system.XMLID === "STRIKE" ||
                    item.system.XMLID === "DISARM" ||
                    item.system.XMLID === "GRABBY" ||
                    item.system.XMLID === "MOVEBY" ||
                    item.system.XMLID === "MOVETHROUGH" ||
                    item.system.XMLID === "PULLINGAPUNCH" ||
                    item.system.XMLID === "SHOVE" ||
                    item.system.XMLID === "THROW")))
    );
}

export function isRangedCombatManeuver(item) {
    return item.isCombatManeuver && item.isRanged;
}

export function isHthCombatManeuver(item) {
    return item.isCombatManeuver && item.isHth;
}

export function isRangedMartialManeuver(item) {
    // PH: FIXME: Is this CATEGORY check wrong or should we be modifying item::isRanged?
    return item.isMartialManeuver && item.system.CATEGORY === "Ranged";
}

export function isHthMartialManeuver(item) {
    return item.isMartialManeuver && isManeuverHthCategory(item);
}

// NOTE: HD has a bug where custom martial maneuvers have CATEGORY of "Hand to Hand" (note lower case)
export function isManeuverHthCategory(item) {
    return item.system.CATEGORY === "Hand To Hand" || item.system.CATEGORY === "Hand to Hand";
}

function isManeuverThatIsUsingAWeapon(item, options) {
    if (!item.system._active) {
        console.error(`Missing _active`, item, options, item);
    }
    return (
        (item.isMartialManeuver || item.isCombatManeuver) &&
        !!(item.system._active.maWeaponItem || options.maWeaponItem)
    );
}

function isManeuverThatIsUsingAnEmptyHand(item, options) {
    if (!item.system._active) {
        console.error(`Missing _active`, item, options, item);
    }
    return (
        (item.isMartialManeuver || item.isCombatManeuver) && !(item.system._active.maWeaponItem || options.maWeaponItem)
    );
}

// The [ ...DC] damage placeholders that can appear in maneuver EFFECT text ([NORMALDC],
// [KILLINGDC], [FLASHDC], [NNDDC], and their [WEAPON...] variants). [STRDC] is deliberately
// excluded — it substitutes a STR value, not a damage formula.
const replaceableDamagePlaceholderRegex = /\[(?:WEAPON)?(?:NORMAL|KILLING|FLASH|NND)?DC\]/g;

export function getManueverEffectWithPlaceholdersReplaced(item) {
    const maneuverEffect = getManeuverEffect(item);
    if (maneuverEffect) {
        let effectString = maneuverEffect;
        // let rangeString = "";
        // let dcsString = "";

        if (item.causesDamageEffect()) {
            const { diceParts } = calculateDicePartsForItem(item, { ignoreDeadlyBlow: true });
            const doesDiceOfDamage =
                diceParts.d6Count + diceParts.d6Less1DieCount + diceParts.halfDieCount + diceParts.constant;
            if (maneuverEffect.search(/\[STRDC\]/) > -1) {
                // PH: FIXME: Offensive Ranged Disarm and Ranged Disarm are shown as [WEAPONDC] but are not offensive and should be caught in this.
                //            How to determine these martial maneuvers behave like this generically?
                // Cheat a bit. d6Count for strength is ~DC.
                const effectiveStrength = diceParts.d6Count * 5;
                effectString = maneuverEffect.replace("[STRDC]", `${effectiveStrength} STR`);
            } else if (doesDiceOfDamage) {
                // This does some damage.
                const damageFormula = dicePartsToEffectFormula(diceParts);
                if (damageFormula) {
                    const nnd = maneuverEffect.indexOf("NNDDC") > -1 || maneuverEffect.indexOf("WEAPONNNDDC") > -1;
                    const killing =
                        maneuverEffect.indexOf("KILLINGDC") > -1 || maneuverEffect.indexOf("WEAPONKILLINGDC") > -1;

                    const diceFormula = `${damageFormula}${nnd ? " NND" : ""}${killing ? (isManeuverHthCategory(item) ? " HKA" : " RKA") : ""}`;

                    if (isManeuverThatDoesReplaceableDamageType(item)) {
                        effectString = maneuverEffect.replace(replaceableDamagePlaceholderRegex, diceFormula);
                    } else if (parseInt(item.system.DC || 0) > 0) {
                        // Custom maneuvers have no [DC] placeholder in their effect text; lead with
                        // the dice the way Hero Designer displays them (e.g. "5 1/2d6 Strike").
                        // The DC gate keeps placeholderless non-damage maneuvers (Dodge, Escape) clean.
                        effectString = `${diceFormula} ${maneuverEffect}`;
                    }
                }
            }
        }

        return effectString;
    }
}

export function getManeuverEffect(item) {
    return item.system.USEWEAPON || item.system.USEWEAPON === "Yes" ? item.system.WEAPONEFFECT : item.system.EFFECT;
}

export function isManeuverThatDoesReplaceableDamageType(item) {
    const effect = getManeuverEffect(item);

    if (!effect) {
        return false;
    }

    return effect.search(replaceableDamagePlaceholderRegex) > -1;
}

// Maneuver's EFFECT indicates normal damage or is Strike (exception)
export function isManeuverThatDoesNormalDamage(item) {
    const effect = getManeuverEffect(item);

    return (
        (item.isMartialManeuver || item.isCombatManeuver) &&
        (effect.search(/NORMALDC/) > -1 ||
            effect.search(/WEAPONDC/) > -1 ||
            effect.search(/STRDC/) > -1 ||
            item.system.XMLID === "STRIKE")
    );
}

function doubleDamageLimit() {
    return game.settings.get(HEROSYS.module, "DoubleDamageLimit");
}

/**
 * Get the number DCs for martial maneuvers or return 0
 *
 * @param {HeroSystem6eItem} item
 * @returns {number}
 */
export function getExtraMartialDcsOrZero(item) {
    if (!item.isMartialManeuver) {
        return 0;
    }

    return getExtraMartialDcs(item);
}

export function getExtraMartialDcs(item) {
    // PH: FIXME: It is possible to use fewer than the maximum number of EXTRADCs and RANGEDCs. Need a mechanism for this.

    let extraDcItems;
    if (isHthMartialManeuver(item)) {
        const extraHthDcItems = item.actor?.items.filter((item) => item.system.XMLID === "EXTRADC") || [];
        extraDcItems = extraHthDcItems;
    } else if (isRangedMartialManeuver(item)) {
        const extraRangedDcItems = item.actor?.items.filter((item) => item.system.XMLID === "RANGEDDC") || [];
        extraDcItems = extraRangedDcItems;
    } else {
        console.error(
            `getExtraMartialDcs called for ${item.actor?.name}/${item.detailedName()} that is not a martial maneuver`,
        );
    }

    const numExtraDcs = extraDcItems.reduce((accum, current) => accum + parseInt(current.system.LEVELS || 0), 0);
    return numExtraDcs;
}

function addExtraMartialDcsToBundle(item, dicePartsBundle) {
    const numExtraDcs = getExtraMartialDcs(item);
    let extraDcLevels = numExtraDcs;

    const baseAttackItem = dicePartsBundle.baseAttackItem || item;

    // 5E extraDCLevels are halved for unarmed killing attacks
    // PH FIXME: Need better logic here for 6e damage doubling behavior
    if (baseAttackItem.is5e && baseAttackItem.doesKillingDamage) {
        extraDcLevels = Math.floor(extraDcLevels / 2);
    }

    if (extraDcLevels > 0) {
        const extraDcDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, extraDcLevels);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, extraDcDiceParts);

        dicePartsBundle.diceParts = addDiceParts(baseAttackItem, dicePartsBundle.diceParts, extraDcDiceParts);
        dicePartsBundle.tags.push({
            value: `${formula}`,
            name: "Extra DCs",
            title: `${numExtraDcs.signedString()}DC${numExtraDcs !== extraDcLevels ? " (halved due to 5e killing attack)" : ""} -> ${formula}`,
        });
    }
}

/**
 * Determine DC solely from item/attack. A DC is NOT a die of damage.
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} options
 */
export function calculateAddedDicePartsFromItem(item, baseAttackItem, options) {
    // PH: FIXME: Consider separating out into maneuver and non maneuver components as much of the complication is realted to that.

    const addedDamageBundle = {
        diceParts: zeroDiceParts,
        tags: [],
        baseAttackItem,
    };
    const velocityDamageBundle = {
        diceParts: zeroDiceParts,
        tags: [],
        baseAttackItem,
    };

    // EXTRADCs and RANGEDDCs
    // 5e EXTRADC and RANGEDDCs for armed killing attacks count at full DCs but do NOT count towards the base DC. FRed pg. 406.
    // 6e doesn't have the concept of base and added DCs but do the same in case they turn on the doubling rule.
    if (item.isMartialManeuver && (item.system._active.maWeaponItem || options.maWeaponItem)) {
        addExtraMartialDcsToBundle(item, addedDamageBundle);
    }

    // For Haymaker (with Strike presumably) and non killing Martial Maneuvers, STR is the main base (source of) damage and the maneuver is additional damage.
    // These maneuvers are added without consideration of advantages in 5e but not in 6e.
    // For maneuvers with a weapon, the weapon is the main base (source of) damage and the maneuver is additional damage.
    if (isNonKillingStrengthBasedManeuver(item) || isManeuverThatIsUsingAWeapon(item, options)) {
        const rawManeuverDc = parseInt(item.system.DC);

        let maneuverDC = rawManeuverDc;
        if (item.is5e && baseAttackItem.doesKillingDamage) {
            maneuverDC = Math.floor(rawManeuverDc / 2);
        }

        // Martial Maneuvers in 5e ignore advantages (FRed pg 407). Everything else cares about them.
        const alteredManeuverDc =
            item.is5e && item.isMartialManeuver ? maneuverDC * (1 + baseAttackItem._advantagesAffectingDc) : maneuverDC;
        const maneuverDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, alteredManeuverDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, maneuverDiceParts);

        addedDamageBundle.diceParts = addDiceParts(baseAttackItem, addedDamageBundle.diceParts, maneuverDiceParts);
        addedDamageBundle.tags.push({
            value: formula === "0" ? "" : `${formula}`, // Hide the formula if it's 0 as it looks ugly
            name: item.name,
            title: `${rawManeuverDc.signedString()}DC${maneuverDC !== rawManeuverDc ? " (halved due to 5e killing attack)" : ""} -> ${formula}`,
        });
    }

    // Add in STR if it isn't the base damage type. We want to consider the original item as it could be a maneuver.
    if (baseAttackItem.system.usesStrength) {
        // PH: FIXME: We want to consider the original item as it could be a maneuver.

        addStrengthToBundle(baseAttackItem, options, addedDamageBundle, true, false);
    }

    // Boostable Charges
    if (options.boostableCharges != undefined && options.boostableCharges > 0) {
        // Each used boostable charge, to a max of 4, increases the damage class by 1.
        const boostChargesDc = Math.min(4, parseInt(options.boostableCharges));
        const boostableDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, boostChargesDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, boostableDiceParts);

        addedDamageBundle.diceParts = addDiceParts(baseAttackItem, addedDamageBundle.diceParts, boostableDiceParts);
        addedDamageBundle.tags.push({
            value: `${formula}`,
            name: "Boostable Charges",
            title: `${boostChargesDc}DC -> ${formula}`,
        });
    }

    // Combat Skill Levels. These are added is added in without consideration of advantages in 5e but not in 6e.
    // The interpretation of the rules is that you can accumulate DC levels across different CSLs rather than then having to all be from the
    // same CSL.
    // PH: TODO: 5E Superheroic: Each 2 CSLs modify the killing attack BODY roll by +1 (cannot exceed the max possible roll). Obviously no +1/2 DC.
    // PH: TODO: 5E Superheroic: Each 2 CSLs modify the normal attack STUN roll by +3 (cannot exceed the max possible roll). Obviously no +1/2 DC.
    // PH: TODO: THE ABOVE 2 NEED NEW HERO ROLLER FUNCTIONALITY.
    let dcSum = 0;
    for (const cslDetail of combatSkillLevelsForAttack(item).details) {
        if (cslDetail.dc > 0) {
            // Takes 2 CLS for +1 DC
            dcSum += cslDetail.dc;
            if (dcSum > 1) {
                const actualDcEffect = Math.floor(dcSum / 2);
                dcSum -= 2 * actualDcEffect;

                // CSLs in 5e ignore advantages (FRed pg 407). In 6e they care about it.
                const alteredCslDc = item.is5e ? actualDcEffect * (1 + item._advantagesAffectingDc) : actualDcEffect;
                const cslDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, alteredCslDc);
                const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, cslDiceParts);
                addedDamageBundle.diceParts = addDiceParts(baseAttackItem, addedDamageBundle.diceParts, cslDiceParts);
                addedDamageBundle.tags.push({
                    value: `+${formula}`,
                    name: cslDetail.item.name,
                    title: `${actualDcEffect.signedString()}DC -> ${formula}`,
                });
            } else {
                addedDamageBundle.tags.push({
                    value: `+0d6`,
                    name: cslDetail.item.name,
                    title: `Insufficient accumulated CSLs w/ DC so far -> +0d6`,
                });
            }
        }
    }

    // Move By, Move By, etc - Maneuvers that add in velocity
    // [NORMALDC] +v/5 Strike, FMove
    // ((STR/2) + (v/10))d6; attacker takes 1/3 damage

    const velocityMatch = (item.system.EFFECT || "").match(/v\/(\d+)/);
    if (velocityMatch) {
        const velocity = parseInt(options.velocity || 0);
        const divisor = parseInt(velocityMatch[1]);
        const velocityDc = Math.floor(velocity / divisor); // There is no rounding

        const velocityDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, velocityDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, velocityDiceParts);

        // Velocity adding to normal damage does not count towards any doubling rules.
        const bundleToUse = item.doesKillingDamage ? addedDamageBundle : velocityDamageBundle;

        bundleToUse.diceParts = addDiceParts(baseAttackItem, bundleToUse.diceParts, velocityDiceParts);
        bundleToUse.tags.push({
            value: `${formula}`,
            name: "Velocity",
            title: `${velocity}${getSystemDisplayUnits(item.is5e)}/${divisor} -> ${formula}`,
        });
    }

    // Applied effects
    for (const ae of item.actor?.appliedEffects.filter(
        (ae) => !ae.disabled && ae.flags?.[game.system.id]?.target === item.uuid,
    ) || []) {
        for (const change of ae.changes.filter(
            (change) =>
                change.key === "system.value" &&
                change.value !== 0 &&
                change.type === CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
        )) {
            const value = parseInt(change.value);
            const aeDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, value);
            const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, aeDiceParts);

            addedDamageBundle.diceParts = addDiceParts(baseAttackItem, addedDamageBundle.diceParts, aeDiceParts);
            addedDamageBundle.tags.push({
                value: `${formula}`,
                name: ae.name,
                title: `${value}DC -> ${formula}`,
            });
        }
    }

    // Is there a haymaker active and thus part of this attack? Haymaker is added in without consideration of advantages in 5e but not in 6e.
    // Also in 5e killing haymakers get the DC halved.
    if (options.haymakerManeuverActiveItem) {
        // Can haymaker anything except for maneuvers because it is a maneuver itself. The strike maneuver is the 1 exception.
        // PH: FIXME: Implement the exceptions: See 6e v2 pg. 99. 5e has none?
        if (
            !["maneuver", "martialart"].includes(item.type) ||
            (item.isCombatManeuver && item.system.XMLID === "STRIKE")
        ) {
            const rawHaymakerDc = parseInt(options.haymakerManeuverActiveItem.system.DC);

            let haymakerDC = rawHaymakerDc;
            if (item.is5e && item.doesKillingDamage) {
                haymakerDC = Math.floor(rawHaymakerDc / 2);
            }

            // Haymakers in 5e ignore advantages (FRed pg 407) so we have to compensate.
            // 6e is sensible in this regard.
            const alteredHaymakerDc = item.is5e ? haymakerDC * (1 + item._advantagesAffectingDc) : haymakerDC;
            const haymakerDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, alteredHaymakerDc);
            const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, haymakerDiceParts);

            addedDamageBundle.diceParts = addDiceParts(baseAttackItem, addedDamageBundle.diceParts, haymakerDiceParts);
            addedDamageBundle.tags.push({
                value: `${formula}`,
                name: "Haymaker",
                title: `${rawHaymakerDc}DC${haymakerDC !== rawHaymakerDc ? " (halved due to 5e killing attack)" : ""} -> ${formula}`,
            });
        }
    }

    // DEADLYBLOW
    // Only check if it has been turned off
    // PH: FIXME: This function should not be changing the item.system. Please fix me by moving this to somewhere in the user flow.
    const deadlyBlows = item.actor?.items.filter((item) => item.system.XMLID === "DEADLYBLOW") || [];
    deadlyBlows.forEach((deadlyBlow) => {
        item.system.conditionalAttacks ??= {};
        item.system.conditionalAttacks[deadlyBlow.id] = deadlyBlow;
        item.system.conditionalAttacks[deadlyBlow.id].system.checked ??= true;
    });

    if (item.actor) {
        for (const key in item.system.conditionalAttacks) {
            const conditionalAttack = item.actor.items.find((item) => item.id === key);
            if (!conditionalAttack) {
                // FIXME: This is the wrong place to be playing with the database. Should be done at the
                //            to hit phase.
                // Quench and other edge cases where item.id is null
                if (item.id) {
                    console.warn("conditionalAttack is empty");
                    delete item.system.conditionalAttacks[key];
                    // NOTE: typically we await here, but this isn't an async function.
                    // Shouldn't be a problem.
                    item.update({
                        [`system.conditionalAttacks`]: item.system.conditionalAttacks,
                    });
                }
                continue;
            }

            // If unchecked or missing then assume it is enabled
            if (!conditionalAttack.system.checked) continue;

            // Make sure conditionalAttack applies (only for DEADLYBLOW at the moment)
            if (typeof conditionalAttack.baseInfo?.appliesTo === "function") {
                if (!conditionalAttack.baseInfo.appliesTo(item)) continue;
            }

            switch (conditionalAttack.system.XMLID) {
                case "DEADLYBLOW": {
                    if (!options.ignoreDeadlyBlow) {
                        const deadlyDc = 3 * Math.max(1, parseInt(conditionalAttack.system.LEVELS) || 1);
                        const deadlyBlowDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, deadlyDc);
                        const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, deadlyBlowDiceParts);

                        addedDamageBundle.diceParts = addDiceParts(
                            baseAttackItem,
                            addedDamageBundle.diceParts,
                            deadlyBlowDiceParts,
                        );
                        addedDamageBundle.tags.push({
                            value: `${formula}`,
                            name: "DeadlyBlow",
                            title: `${deadlyDc}DC -> ${formula}`,
                        });
                    }

                    break;
                }

                default:
                    console.warn("Unhandled conditionalAttack", conditionalAttack);
            }
        }
    }

    // FIXME: Environmental Movement: Aquatic Environments should actually counteract this.
    // FIXME: Not everything should be affected by this. For instance, should mental powers be affected? What about electricity based SFX?
    // Characters fighting underwater or while swimming are at -2
    // DCV and -2 DCs to all attacks unless they make an appropriate
    // Skill Roll or have TF: SCUBA. A character who stands
    // in water while he fights is at -2 DCV (and typically also suffer
    // Poor Footing penalties) unless he makes a Breakfall roll.
    if (item.actor?.statuses?.has("underwater")) {
        const underwaterDc = 2; // NOTE: Working with 2 DC and then subtracting
        const underwaterDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, underwaterDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, underwaterDiceParts);

        addedDamageBundle.diceParts = subtractDiceParts(
            baseAttackItem,
            addedDamageBundle.diceParts,
            underwaterDiceParts,
        );
        addedDamageBundle.tags.push({
            value: `-(${formula})`,
            name: "Underwater",
            title: `-${underwaterDc}DC -> ${formula}`,
        });
    }

    return {
        addedDamageBundle,
        velocityDamageBundle,
    };
}

/**
 * Calculate the base Character Points for this item.
 * This is one of those cases where Character Points means base cost.
 *
 * @param {HeroSystem6eItem} item
 * @returns {Object}
 */
export function calculateCpPerDieForItem(item) {
    const isMartialOrManeuver = ["maneuver", "martialart"].includes(item.type);
    let martialOrManeuverEquivalentApPerDice = 0;
    if (isMartialOrManeuver) {
        const effect = item.system.EFFECT;
        if (
            effect.search(/\[NORMALDC\]/) !== -1 ||
            effect.search(/\[WEAPONDC\]/) !== -1 ||
            effect.search(/\[FLASHDC\]/) !== -1 ||
            effect.search(/\[WEAPONDC\]/) !== -1 ||
            effect.search(/\[STRDC\]/) !== -1 ||
            effect.search(/STR/) !== -1
        ) {
            martialOrManeuverEquivalentApPerDice = 5;
        } else if (effect.search(/\[NNDDC\]/) !== -1 || effect.search(/\[WEAPONNNDDC\]/) !== -1) {
            martialOrManeuverEquivalentApPerDice = 10;
        } else if (effect.search(/\[KILLINGDC\]/) !== -1 || effect.search(/\[WEAPONKILLINGDC\]/) !== -1) {
            martialOrManeuverEquivalentApPerDice = 15;
        } else {
            // FIXME: We shouldn't be calculating damage dice for things that don't do damage
            // Most maneuvers don't do damage. However there are some that use STR as a base so assume normal damage.
            martialOrManeuverEquivalentApPerDice = 5;
        }
    }

    const baseCpPerDie =
        martialOrManeuverEquivalentApPerDice ||
        (item.system.XMLID === "TELEKINESIS" ? 5 : undefined) || // PH: FIXME: Kludge for time being. TK Behaves like strength
        item.baseInfo.costPerLevel(item);

    return { baseCpPerDie, isMartialOrManeuver };
}

/**
 * Given a number of DCs, return the dice formula parts for this item
 *
 * NOTE: This is ugly because with floating point calculations we need to use epsilon comparisons (see https://randomascii.wordpress.com/2012/02/25/comparing-floating-point-numbers-2012-edition/ for instance)
 *       To work around the need for epsilon comparison we just multiply by a large enough number that we're just doing integer math and ignoring the mantissa.
 *
 * A 5AP/die normal attack like energy blast: +1 pip is 2 points, +1/2d6 is 3 points, and +1d6 is 5 points.
 * This makes 3 possible breakpoints x.0, x.4, x.6 for any whole number x >=0 when we divide by the AP/5 to get the num of dice.
 *
 * A 10AP/die normal attack like ego attack: +1 pip is 3 points, +1/2d6 is 5 points, and +1d6 is 10 points.
 * This makes 3 possible breakpoints x.0, x.3, x.5 for any whole number x >=0 when we divide by the AP/10 to get the num of dice.
 *
 * A 15 AP/die killing attack: +1 pip is 5 points, +1/2d6 or +1d6-1 is 10 points, and +1d6 is 15 points.
 * This makes 3 possible breakpoints x.0, x.3333, x.6666 for any whole number x >=0 when we divide by the AP/15 to get the num of dice.
 * NOTE: These are the same breaks that 3AP/die (except for FLASH which just has to be different) and 6AP/die
 *
 * @param {HeroSystem6eItem} item
 * @param {number} dc
 * @returns
 */
export function calculateDicePartsFromDcForItem(item, dc) {
    const { baseCpPerDie, isMartialOrManeuver } = calculateCpPerDieForItem(item);

    // PH: FIXME: Some powers have "fixed" damage that doesn't get modified by advantages and DC modifiers (or at least not
    // in ways that I have taken the time to think through).
    // Examples are 6e's Absorption, Possession, dependence, and change environment.
    if (item.baseInfo.unusualDicePerDc) {
        const { diceParts } = item.baseInfo.baseEffectDicePartsBundle(item, {});
        return diceParts;
    }

    // What break points do we have for 1 pip and 1/2 die?
    const fullDieValue = 1;
    const halfDieValue = getCostPerHalfDie(item, baseCpPerDie) / baseCpPerDie;

    // FLASH has an exception, because why not. It only has a 1/2d6 adder and doesn't have +1 pip. To work around this
    // set the pipValue to the same as the halfDieValue so that we prefer the half die over a pip.
    const pipValue =
        baseCpPerDie === 3 && item.system.XMLID === "FLASH"
            ? 1.5 / 3
            : getCostPerDiePip(item, baseCpPerDie) / baseCpPerDie;

    let apPerDie;
    if (!isMartialOrManeuver && item._activePointsAffectingDcRaw !== 0) {
        // Some ugly stuff to deal with the case where we have adders to the base powers. We need to figure out
        // how much a die actually costs.
        // FIXME: would be nice to pull out the TK exception/special handling.
        const { diceParts } = item.baseInfo.baseEffectDicePartsBundle(item, {});
        let diceValue = 0;
        diceValue += diceParts.d6Count * fullDieValue;
        diceValue += (diceParts.d6Less1DieCount + diceParts.halfDieCount) * halfDieValue;
        diceValue += diceParts.constant * pipValue;
        apPerDie =
            item.system.XMLID === "TELEKINESIS" || item.system.XMLID === "__STRENGTHDAMAGE"
                ? 5 * (1 + item._advantagesAffectingDc)
                : item._activePointsAffectingDcRaw / diceValue;
    } else {
        // NOTE: Standard and optional maneuvers shouldn't be able to be advantaged but martials can
        apPerDie = baseCpPerDie * (1 + item._advantagesAffectingDc);
    }

    // NOTE: Work in positive values and positive 0 for obviousness to users
    const diceOfDamage = Math.abs((5 * dc) / apPerDie);
    const diceSign = Math.sign(dc) || 0;

    // Since the smallest interval is between 1 pip and 1/2 die (0.3 to 0.5), 0.099 is probably the smallest possible epsilon.
    // However, the results don't match tables we see in 6e vol 2 p.97 if we use that epsilon.
    // It's possible a better algorithm would produce something better but with this one:
    // 0.066666 appears to be too large. (1DC KA @ +1/4)
    // 0.04 appears to be too large. (1DC EA @ +1)
    // Epsilon observations also indicate the possibiliy that the rules (as expressed in the 6e table) only use one of the attack types (e.g. killing) to determine part dice
    // or that they were just done willy nilly and trying to fit them into a formula is a fool's game.
    const epsilon = 0.039;

    const d6Count = diceSign * Math.floor(diceOfDamage) || 0;
    const halfDieCount = diceSign * ((diceOfDamage % fullDieValue) - halfDieValue > -epsilon ? 1 : 0) || 0;
    const constant =
        diceSign *
            (item.system.XMLID === "TELEKINESIS"
                ? 0
                : (diceOfDamage % fullDieValue) - pipValue > -epsilon && !halfDieCount
                  ? 1
                  : 0) || 0;

    return {
        dc,
        d6Count,
        halfDieCount: halfDieCount,
        constant,

        // PH: FIXME: Not implemented yet
        d6Less1DieCount: 0,
    };
}

/**
 * Add two dice parts together by DCs and then update rest of the dice parts to match the DC.
 * For example: 1/2d6 + 1/2d6 = 1d6+1 when we're talking about a straight 15 AP/die killing attack (i.e. 2DC + 2DC = 4DC)
 *              1/2d6 + 1/2d6 = 1d6 when we're talking about a straight 10 AP/die ego attack (i.e. 1DC + 1DC = 2DC)
 * @param {HeroSystem6eItem} item
 * @param {HeroSystemFormulaDiceParts} firstDiceParts
 * @param {HeroSystemFormulaDiceParts} secondDiceParts
 * @param {boolean} useDieMinusOne
 * @returns
 */
export function addDiceParts(item, firstDiceParts, secondDiceParts, useDieMinusOne) {
    const firstDc = firstDiceParts.dc;
    const secondDc = secondDiceParts.dc;
    const dcSum = firstDc + secondDc;

    const diceParts = calculateDicePartsFromDcForItem(item, dcSum);
    if (useDieMinusOne) {
        diceParts.d6Less1DieCount = diceParts.halfDieCount;
        diceParts.halfDieCount = 0;
    }

    return diceParts;
}

/**
 * Subtract the second dice parts from the first dice parts by steps and not straight math.
 * For example: 1d6+1 - 1 = 1d6 when we're talking about a straight 15 AP/die killing attack (i.e. 4DC - 1DC = 3DC)
 *              1d6 - 1/2d6 = 1/2d6 when we're talking about a straight 10 AP/die ego attack (i.e. 2DC - 1DC = 1DC)
 * @param {HeroSystem6eItem} item
 * @param {HeroSystemFormulaDiceParts} firstDiceParts
 * @param {HeroSystemFormulaDiceParts} secondDiceParts
 * @param {boolean} useDieMinusOne - Should it try to return 1d6-1 rather than 1/2d6
 * @returns
 */
export function subtractDiceParts(item, firstDiceParts, secondDiceParts, useDieMinusOne) {
    const firstDc = firstDiceParts.dc;
    const secondDc = secondDiceParts.dc;
    const dcSub = firstDc - secondDc;

    const diceParts = calculateDicePartsFromDcForItem(item, dcSub);
    if (useDieMinusOne) {
        diceParts.d6Less1DieCount = diceParts.halfDieCount;
        diceParts.halfDieCount = 0;
    }

    return diceParts;
}

/**
 * Calculate the damage dice parts for an item based on the given options
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} options
 * @returns {HeroSystemFormulaDicePartsBundle}
 */
export function calculateDicePartsForItem(item, options) {
    const {
        diceParts: baseDiceParts,
        tags: baseTags,
        baseAttackItem,
    } = item.baseInfo.baseEffectDicePartsBundle(item, options);

    // PH: FIXME: This can be removed when we don't create damage for things that aren't attacks.
    if (!baseAttackItem) {
        console.error(
            `Actor=${item.actor?.name}. Actor.type=${item.actor?.type}. ${item.detailedName()} links to a base attack item of ${baseAttackItem}.`,
        );
        return {
            diceParts: zeroDiceParts,
            tags: [],
            baseAttackItem,
        };
    }

    const {
        addedDamageBundle: { diceParts: addedDiceParts, tags: extraTags },
        velocityDamageBundle: { diceParts: velocityDiceParts, tags: velocityTags },
    } = calculateAddedDicePartsFromItem(item, baseAttackItem, options);

    // No idea if we should favour 1d6-1 or not. Try to make a guess.
    const useDieMinusOne = !!baseAttackItem.findModsByXmlid("MINUSONEPIP");

    // Max Doubling Rules
    // 5e rule and 6e optional rule: A character cannot more than double the Damage Classes of their base attack, no
    // matter how many different methods they use to add damage.

    const doubleDamageLimitTags = [];
    let sumDiceParts = addDiceParts(baseAttackItem, baseDiceParts, addedDiceParts, useDieMinusOne);
    if (doubleDamageLimit()) {
        // PH: FIXME: Need to implement these:
        // Exceptions to the rule (because it wouldn't be the hero system without exceptions) from FRed pg. 405:
        // 1) Weapons that do normal damage in superheroic campaigns
        // 2) extra damage classes for unarmed martial maneuvers
        // 3) movement bonuses to normal damage

        const baseDc = baseDiceParts.dc;
        const addDc = addedDiceParts.dc;

        const excessDc = addDc - baseDc;
        if (excessDc > 0) {
            const baseFormula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, baseDiceParts);
            const addedFormula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, addedDiceParts);

            const excessDiceParts = calculateDicePartsFromDcForItem(baseAttackItem, excessDc);
            const excessFormula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, excessDiceParts);
            doubleDamageLimitTags.push({
                value: `-(${excessFormula})`,
                name: "Double damage limit",
                title: `Base ${baseFormula}. Added ${addedFormula}. ${game.i18n.localize("Settings.DoubleDamageLimit.Hint")}`,
            });

            sumDiceParts = subtractDiceParts(baseAttackItem, sumDiceParts, excessDiceParts, useDieMinusOne);
        }
    }

    // Add velocity contributions too which were excluded from doubling considerations
    sumDiceParts = addDiceParts(baseAttackItem, sumDiceParts, velocityDiceParts, useDieMinusOne);

    // Doesn't really feel right to allow a total DC of less than 0 so cap it.
    const finalDc = Math.max(0, sumDiceParts.dc);
    let dcClampTags = [];
    if (finalDc !== sumDiceParts.dc) {
        const nonClampedEffectFormula = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, sumDiceParts);
        const adjustedDc = finalDc - sumDiceParts.dc;
        const clampedEffectFormula = dicePartsToFullyQualifiedEffectFormula(
            baseAttackItem,
            calculateDicePartsFromDcForItem(baseAttackItem, adjustedDc),
        );
        dcClampTags.push({
            value: `${clampedEffectFormula}`,
            name: "No Negative Damage",
            title: `Damage clamped to 0. ${clampedEffectFormula} added to ${nonClampedEffectFormula}`,
        });
        sumDiceParts = zeroDiceParts;
    }

    return {
        diceParts: sumDiceParts,
        tags: [...baseTags, ...extraTags, ...doubleDamageLimitTags, ...velocityTags, ...dcClampTags],
        baseAttackItem,
    };
}

export function getEffectFormulaFromItem(item, options) {
    // PH: FIXME: Need to start looking at end returned from other functions.
    const { diceParts } = calculateDicePartsForItem(item, options);

    return dicePartsToEffectFormula(diceParts);
}

export function getFullyQualifiedEffectFormulaFromItem(item, options) {
    if (!item) {
        console.error(`Missing required item`);
        return;
    }

    const { diceParts, baseAttackItem } = calculateDicePartsForItem(item, options);

    if (!baseAttackItem) {
        console.error(
            `Actor=${item.actor?.name}. Actor.type=${item.actor?.type}. ${item.name} is missing required baseAttackItem`,
        );

        return;
    }

    const results = dicePartsToFullyQualifiedEffectFormula(baseAttackItem, diceParts);

    return results;
}

export function dicePartsToEffectFormula(diceParts) {
    return `${
        diceParts.d6Count + diceParts.d6Less1DieCount + diceParts.halfDieCount > 0
            ? `${
                  diceParts.d6Count + diceParts.d6Less1DieCount
                      ? `${diceParts.d6Count + diceParts.d6Less1DieCount}`
                      : ""
              }${diceParts.halfDieCount ? `½` : ""}d6`
            : ""
    }${
        diceParts.constant
            ? `${diceParts.d6Count + diceParts.d6Less1DieCount + diceParts.halfDieCount > 0 ? "+" : ""}${diceParts.constant}`
            : `${diceParts.d6Count + diceParts.d6Less1DieCount + diceParts.halfDieCount > 0 ? `${diceParts.d6Less1DieCount > 0 ? "-1" : ""}` : "0"}`
    }`;
}

// FIXME: Should show "N" for normal, "NND" for NND, "AP" for Armour Piercing, etc
export function dicePartsToFullyQualifiedEffectFormula(item, diceParts) {
    if (!item) {
        console.error(`Missing required item`);
        return;
    }
    return `${dicePartsToEffectFormula(diceParts)}${item.doesKillingDamage ? "K" : ""}`;
}

function addStrengthToBundle(item, options, dicePartsBundle, strengthAddsToDamage, is5eHthAttack) {
    if (!item.system._active) {
        console.error(`Missing _active`, item, options, dicePartsBundle, strengthAddsToDamage, this);
    }

    // PH: FIXME: Need to figure in all the crazy rules around STR and STR with advantage.
    const baseEffectiveStrength = effectiveStrength(item, options);
    let str = baseEffectiveStrength;

    let actorStrengthItem = item.system._active.effectiveStrItem;
    if (!actorStrengthItem) {
        actorStrengthItem = buildStrengthItem(baseEffectiveStrength, item.actor, `STR used with ${item.name}`);
    }

    // When we add in strength there are a number of cases to consider:
    // - Are we adding STR to an existing baseAttackItem? If so, it adds DCs unless adding to 5e HTH in which case it adds straight dice as STR automatically gains the advantages of the HTH.
    // - Are we setting up STR as the baseAttackItem? If so, we need make sure DCs reflect the advantages of the STR item
    const baseEffectiveStrDc =
        actorStrengthItem.dcRaw * (is5eHthAttack ? 1 + dicePartsBundle.baseAttackItem._advantageCost : 1);

    dicePartsBundle.baseAttackItem ??= actorStrengthItem;
    const strDiceParts = calculateDicePartsFromDcForItem(dicePartsBundle.baseAttackItem, baseEffectiveStrDc);
    const formula = dicePartsToFullyQualifiedEffectFormula(dicePartsBundle.baseAttackItem, strDiceParts);

    dicePartsBundle.diceParts = addDiceParts(dicePartsBundle.baseAttackItem, dicePartsBundle.diceParts, strDiceParts);
    dicePartsBundle.tags.push({
        value: `${strengthAddsToDamage ? "+" : ""}${formula}`,
        name: "STR",
        title: `${str} STR -> ${strengthAddsToDamage ? "+" : ""}${formula}`,
    });

    // STRMINIMUM -
    //            - need to consider the item and any associated items such as Hand-to-Hand Attacks
    const itemsWithStrMinimum = [
        ...(item.findModsByXmlid("STRMINIMUM") ? [item] : []),
        ...(item.system._active.linkedAssociated?.map((info) =>
            info.item.findModsByXmlid("STRMINIMUM") ? info.item : undefined,
        ) || []),
    ].filter(Boolean);

    itemsWithStrMinimum.forEach((itemWithStrMinimum) => {
        const strMinimumModifier = itemWithStrMinimum.findModsByXmlid("STRMINIMUM");
        const strMinimum = calculateStrengthMinimumForItem(item, strMinimumModifier);
        str = baseEffectiveStrength - strMinimum;

        // A character using a weapon only adds STR damage for every full 5 points of STR they have above the weapon’s STR Minimum
        const postMinimaDc = Math.floor(str / 5);
        const postMinimaStr = postMinimaDc * 5;

        // PH: FIXME: should both situations consider advantages?
        const newStrDc = postMinimaDc * (strengthAddsToDamage ? 1 : 1 + item._advantagesAffectingDc);

        const strMinDiceParts = calculateDicePartsFromDcForItem(item, baseEffectiveStrDc - newStrDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(item, strMinDiceParts);

        dicePartsBundle.diceParts = subtractDiceParts(actorStrengthItem, dicePartsBundle.diceParts, strMinDiceParts);
        dicePartsBundle.tags.push({
            value: `-(${formula})`,
            name: `${itemWithStrMinimum.name} STR Minimum ${strMinimum}`,
            title: `${strMinimumModifier.ALIAS} ${strMinimumModifier.OPTION_ALIAS} (effective STR above minimum ${postMinimaStr}) -> -(${formula})`,
        });
    });

    // Any STRDC modifiers such as MOVEBY?
    const strMatch = (item.system.EFFECT || "").match(/\[STRDC\]\/(\d+)/);
    if (strMatch) {
        // It doesn't make sense to halve negative strength but haven't seen a rule for it.
        if (str >= 0) {
            const strBeforeManeuver = str;
            const divisor = parseInt(strMatch[1]);
            str = roundFavorPlayerAwayFromZero(str / divisor);

            // NOTE: intentionally using fractional DC here.
            const strDiceParts = calculateDicePartsFromDcForItem(actorStrengthItem, (strBeforeManeuver - str) / 5);
            const formula = dicePartsToFullyQualifiedEffectFormula(actorStrengthItem, strDiceParts);

            dicePartsBundle.diceParts = subtractDiceParts(actorStrengthItem, dicePartsBundle.diceParts, strDiceParts);
            dicePartsBundle.tags.push({
                value: `-(${formula})`,
                name: `${item.name} STR`,
                title: `STR divided to ${str} due to ${item.name} -> -(${formula})`,
            });
        }
    }

    return { actorStrengthItem, baseEffectiveStrength, str };
}

// PH: FIXME: Need to add a bunch of test cases for this stuff.
// if (hthAttack.is5e) {
//     // 5e rules state that STR adds to HTHATTACKs without considering advantages on the HTHATTACK.
//     // See FRed pg 408
//     // xxx;

//     non advantaged STR with non advantaged HTH (probably already have this)
//     non advantaged STR with advantaged HTH
//     advantaged STR with non advantaged HTH
//     advantaged STR with advantaged HTH
// tests with double damage limit if appropriate
// tests with STR and Move Through/movement with STR
// moveby with multiple HTH attacks (to show the bug with moveby STR calculation pulled out multiple times doesn't happen)

// } else {
//     // 6e rules state that STR adds to HTHATTACKs in the normal way.
//     non advantaged STR with non advantaged HTH
//     non advantaged STR with advantaged HTH
//     advantaged STR with non advantaged HTH
//     advantaged STR with advantaged HTH
// tests with double damage limit if appropriate
// tests with STR and Move Through/movement with STR
// moveby with multiple HTH attacks (to show the bug with moveby STR calculation pulled out multiple times doesn't happen)

// }

export function maneuverBaseEffectDicePartsBundle(item, options) {
    const baseDicePartsBundle = {
        diceParts: zeroDiceParts,
        tags: [],
        baseAttackItem: null,
    };

    if (isManeuverThatIsUsingAnEmptyHand(item, options)) {
        // For Haymaker (with Strike presumably) and Martial Maneuvers, STR is the main weapon and the maneuver is additional damage.
        // If we have Hand-to-Hand attacks then we will treat that as the base attack item
        if (isNonKillingStrengthBasedManeuver(item)) {
            // Hand-to-Hand Attacks can only be added to maneuvers that deal normal damage (not killing, NND, grabbing, etc) but
            // that filtering is done elsewhere
            const hthAttackItems =
                item.system._active.linkedAssociated
                    ?.map((info) => info.item)
                    .filter((power) => power.system.XMLID === "HANDTOHANDATTACK") || [];

            // If there is an HTH attack, make that the base attack
            // PH: FIXME: If we have multiple Hand-to-Hand attack items being combined, how should we be combining them? We should
            //            probably be checking that they all can be combined somehow. For the time being, the first one in this list
            //            will be the base attack item
            const hthBaseAttackItem = hthAttackItems[0];
            baseDicePartsBundle.baseAttackItem = hthBaseAttackItem;

            hthAttackItems.forEach((hthAttack) => {
                const { diceParts: hthAttackDiceParts, tags } = hthAttack.baseInfo.baseEffectDicePartsBundle(
                    hthAttack,
                    options,
                );

                baseDicePartsBundle.diceParts = addDiceParts(
                    baseDicePartsBundle.baseAttackItem,
                    baseDicePartsBundle.diceParts,
                    hthAttackDiceParts,
                );
                baseDicePartsBundle.tags.push(...tags);

                // Any STRDC modifiers such as MOVEBY for this maneuver? If yes, then make sure the effect of the HTH Attack
                // is also similarly modified.
                const strMatch = (item.system.EFFECT || "").match(/\[STRDC\]\/(\d+)/);
                if (strMatch) {
                    const divisor = parseInt(strMatch[1]);
                    const hthDc = hthAttack.dcRaw / divisor;

                    // NOTE: intentionally using fractional DC here.
                    const hthDiceParts = calculateDicePartsFromDcForItem(hthAttack, hthDc);
                    const formula = dicePartsToFullyQualifiedEffectFormula(hthAttack, hthDiceParts);

                    baseDicePartsBundle.diceParts = subtractDiceParts(
                        baseDicePartsBundle.baseAttackItem,
                        baseDicePartsBundle.diceParts,
                        hthDiceParts,
                    );
                    baseDicePartsBundle.tags.push({
                        value: `-(${formula})`,
                        name: `${item.name} STR (${hthAttack.name})`,
                        title: `HTH Attack divided to ${hthDc} DC due to ${item.name} -> -(${formula})`,
                    });
                }
            });

            // STR is the base attack in the case of there being no Hand-to-Hand attacks
            addStrengthToBundle(
                item,
                options,
                baseDicePartsBundle,
                !!hthBaseAttackItem,
                hthBaseAttackItem && hthBaseAttackItem.is5e,
            );
        } else {
            const rawItemBaseDc = parseInt(item.system.DC);
            let itemBaseDc = rawItemBaseDc;

            // In 5e only, DCs for killing attacks are halved.
            if (item.is5e && item.doesKillingDamage) {
                itemBaseDc = Math.floor(itemBaseDc / 2);
            }

            const diceParts = calculateDicePartsFromDcForItem(item, itemBaseDc);
            const formula = dicePartsToFullyQualifiedEffectFormula(item, diceParts);

            baseDicePartsBundle.diceParts = diceParts;
            baseDicePartsBundle.baseAttackItem = item;
            baseDicePartsBundle.tags.push({
                value: `${formula}`,
                name: item.name,
                title: `${itemBaseDc}DC${itemBaseDc !== rawItemBaseDc ? " (halved due to 5e killing attack)" : ""} -> ${formula}`,
            });
        }

        // 5e martial arts EXTRADCs and RANGEDDCs are baseDCs when unarmed. Do the same for 6e in case they use the optional damage doubling rules too.
        if (item.isMartialManeuver && !item.system.USEWEAPON) {
            addExtraMartialDcsToBundle(item, baseDicePartsBundle);
        }

        return baseDicePartsBundle;
    } else if (isManeuverThatIsUsingAWeapon(item, options)) {
        // PH: FIXME: Remove options.maWeaponItem when we have a better way of doing tests using a weapon.
        const weaponItem = item.system._active.maWeaponItem || options.maWeaponItem;

        // Base damage of this maneuver with a weapon is the weapon itself.
        // PH: FIXME: getFullyQualifiedEffectFormulaFromItem
        const { diceParts, tags } = weaponItem.baseInfo.baseEffectDicePartsBundle(weaponItem, options);
        const weaponDicePartBundle = {
            diceParts,
            tags,
            baseAttackItem: weaponItem,
        };

        // If we're using a Hand-to-Hand attack as a weapon then add STR into it.
        if (weaponItem.system.XMLID === "HANDTOHANDATTACK") {
            addStrengthToBundle(item, options, weaponDicePartBundle, true, weaponItem.is5e);
        }

        // NOTE: 5e martial arts EXTRADCs and RANGEDDCs are not baseDCs if they are armed. Do the same for 6e in case they use the optional damage doubling rules too.

        // PH: FIXME: STR minima apply to base weapon damage
        // PH: FIXME: Add rule that apply to breaking a weapon (but not here). If more than 3xBODY done to the target than base DC then weapon breaks.

        return weaponDicePartBundle;
    } else {
        console.error(`${item.detailedName()} should not be calling MANEUVER base damage`);

        return {
            diceParts: zeroDiceParts,
            tags: [],
            baseAttackItem: null,
        };
    }
}

// A few maneuver may do killing damage on their own but most will only do killing damage based on if it's
// being used with a weapon or not.
export function maneuverDoesKillingDamage(item) {
    if (item.system._active.maWeaponItem) {
        return item.system._active.maWeaponItem.doesKillingDamage;
    }

    if (item.system.WEAPONEFFECT) {
        return item.system.WEAPONEFFECT.includes("KILLING");
    } else if (item.system.EFFECT) {
        return item.system.EFFECT.includes("KILLING"); // Pretty sure there are no KILLING Combat Maneuvers
    }

    return false;
}
