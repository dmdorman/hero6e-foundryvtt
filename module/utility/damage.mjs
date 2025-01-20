import { HEROSYS } from "../herosystem6e.mjs";
import { RoundFavorPlayerUp } from "./round.mjs";
import { getSystemDisplayUnits } from "./units.mjs";

export function combatSkillLevelsForAttack(item) {
    const results = [];

    if (!item.actor) return results;

    const cslSkills = item.actor.items.filter(
        (o) =>
            ["MENTAL_COMBAT_LEVELS", "COMBAT_LEVELS"].includes(o.system.XMLID) &&
            (o.system.ADDER || []).find((adder) => adder.ALIAS === item.system.ALIAS || adder.ALIAS === item.name) &&
            o.isActive != false,
    );

    for (const cslSkill of cslSkills) {
        const result = {
            ocv: 0,
            dcv: 0,
            dmcv: 0,
            omcv: 0,
            dc: 0,
            skill: cslSkill,
        };

        if (result.skill && result.skill.system.csl) {
            for (let i = 0; i < parseInt(result.skill.system.LEVELS || 0); i++) {
                result[result.skill.system.csl[i]] = (result[result.skill.system.csl[i]] || 0) + 1;
            }
            result.item = result.skill;

            // Takes 2 CLS for +1 DC
            result.dc = Math.floor(result.dc / 2);

            results.push(result);
        }
    }

    return results;
}

export function penaltySkillLevelsForAttack(item) {
    if (!item.actor) return [];

    const psls = item.actor.items.filter(
        (itm) =>
            ["PENALTY_SKILL_LEVELS"].includes(itm.system.XMLID) &&
            itm.adders.find((adder) => adder.ALIAS === item.name) &&
            item.isActive != false,
    );

    return psls;
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

/**
 * Return the dice and half dice roll for this characteristic value. Doesn't support +1 intentionally.
 * @param {number} value
 * @returns {HeroSystemFormulaDiceParts}
 */
export function characteristicValueToDiceParts(value) {
    return {
        dc: value / 5,
        d6Count: Math.trunc(value / 5) || 0,
        d6Less1DieCount: 0,
        halfDieCount: Math.floor((value % 5) / 5) || 0,
        constant: 0,
    };
}

function effectiveStrength(item, options) {
    // PH: FIXME: Should fix the effectivestr bit. Likely didn't realize how to do sensitivity in HTML.
    return parseInt(
        options?.effectivestr != undefined ? options?.effectivestr : item.actor?.system.characteristics.str.value || 0,
    );
}

export function calculateStrengthMinimumForItem(itemWithStrengthMinimum, strengthMinimumModifier) {
    let strMinimumValue = parseInt(strengthMinimumModifier.OPTION_ALIAS?.match(/^\d+$/)?.[0] || 0);

    // Newer HDC files (post 2022?) have OPTION_ALIAS defined to give us the minimum strength range. If players have filled in the exact value
    // as "<number>" then use that, otherwise fallback to calculating an estimate based on a range. Note a STR minimum of less than 1 is not allowed.
    if (strMinimumValue === 0) {
        // Older HDC files seem to have to calculate it based on the limitation value
        const limitationBaseCost = strengthMinimumModifier.BASECOST;
        console.warn(
            `${itemWithStrengthMinimum.name}/${itemWithStrengthMinimum.system.XMLID} really making a guess with STRMINIMUM limitations. Update HDC to newer HD version and set the modifier's OPTION field to just the minimum STR.`,
        );

        if (limitationBaseCost === "-0.25") {
            // -1/4 limitation is str min 1-5.
            strMinimumValue = 5;
        } else if (limitationBaseCost === "-0.5") {
            // -2/4 limitation is str min 6-14.
            strMinimumValue = 14;
        } else if (limitationBaseCost === "-0.75") {
            // -3/4 limitation is str min 15-17.
            strMinimumValue = 17;
        } else if (limitationBaseCost === "-1.0") {
            // -1 limitation is str min 18+.
            strMinimumValue = 20;
        } else {
            console.error(
                `${itemWithStrengthMinimum.name}/${itemWithStrengthMinimum.system.XMLID} has ${strengthMinimumModifier.system.XMLID} with unrecognized limitation of ${limitationBaseCost} levels`,
            );
        }
    }

    return strMinimumValue;
}

function isNonKillingStrengthBasedManeuver(item) {
    return (
        !item.doesKillingDamage &&
        item.system.usesStrength &&
        (item.type === "martialart" ||
            (item.type === "maneuver" &&
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

function isManeuverWithWeapon(item, options) {
    return (item.type === "martialart" || item.type === "maneuver") && !!options.maWeaponItem;
}

function isManeuverWithEmptyHand(item, options) {
    return (item.type === "martialart" || item.type === "maneuver") && !options.maWeaponItem;
}

// Maneuver's EFFECT indicates normal damage or is Strike/Pulling a Punch (exceptions)
export function isManeuverThatDoesNormalDamage(item) {
    return (
        (item.type === "martialart" || item.type === "maneuver") &&
        (item.system.EFFECT.search(/NORMALDC/) > -1 ||
            item.system.EFFECT.search(/STRDC/) > -1 ||
            item.system.XMLID === "STRIKE" ||
            item.system.XMLID === "PULLINGAPUNCH")
    );
}

function doubleDamageLimit() {
    return game.settings.get(HEROSYS.module, "DoubleDamageLimit");
}

function addExtraDcsToBundle(item, dicePartsBundle) {
    const extraDcItems = item.actor?.items.filter((item) => item.system.XMLID === "EXTRADC") || [];

    // Consider all EXTRADCs as one
    const numExtraDcs = extraDcItems.reduce((accum, current) => accum + parseInt(current.system.LEVELS || 0), 0);
    let extraDcLevels = numExtraDcs;

    // 5E extraDCLevels are halved for unarmed killing attacks
    // PH FIXME: Need better logic here for 6e damage doubling behaviour
    if (item.is5e && item.doesKillingDamage) {
        extraDcLevels = Math.floor(extraDcLevels / 2);
    }

    if (extraDcLevels > 0) {
        const extraDcDiceParts = calculateDicePartsFromDcForItem(item, extraDcLevels);
        const formula = dicePartsToFullyQualifiedEffectFormula(item, extraDcDiceParts);

        dicePartsBundle.diceParts = addDiceParts(item, dicePartsBundle.diceParts, extraDcDiceParts);
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
export function calculateAddedDicePartsFromItem(item, baseDamageItem, options) {
    // PH: FIXME: Consider separating out into maneuver and non maneuver components as much of the complication is realted to that.

    const addedDamageBundle = {
        diceParts: zeroDiceParts,
        tags: [],
    };
    const velocityDamageBundle = {
        diceParts: zeroDiceParts,
        tags: [],
    };

    // EXTRADCs
    // 5e EXTRADC for armed killing attacks count at full DCs but do NOT count towards the base DC.
    // 6e doesn't have the concept of base and added DCs but do the same in case they turn on the doubling rule.
    if (item.type === "martialart" && options.maWeaponItem) {
        // PH: FIXME: 3rd parameter needs fixing
        addExtraDcsToBundle(baseDamageItem, addedDamageBundle);
    }

    // For Haymaker (with Strike presumably) and non killing Martial Maneuvers, STR is the main base (source of) damage and the maneuver is additional damage.
    // These maneuvers are added without consideration of advantages in 5e but not in 6e.
    // For maneuvers with a weapon, the weapon is the main base (source of) damage and the maneuver is additional damage.
    if (isNonKillingStrengthBasedManeuver(item) || isManeuverWithWeapon(item, options)) {
        const rawManeuverDc = parseInt(item.system.DC);

        let maneuverDC = rawManeuverDc;
        if (item.is5e && baseDamageItem.doesKillingDamage) {
            maneuverDC = Math.floor(rawManeuverDc / 2);
        }

        // Martial Maneuvers in 5e ignore advantages. Everything else care about them.
        const alteredManeuverDc =
            item.is5e && item.type === "martialart"
                ? maneuverDC * (1 + baseDamageItem.system._advantagesDc)
                : maneuverDC;
        const maneuverDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, alteredManeuverDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, maneuverDiceParts);

        addedDamageBundle.diceParts = addDiceParts(baseDamageItem, addedDamageBundle.diceParts, maneuverDiceParts);
        addedDamageBundle.tags.push({
            value: `${formula}`,
            name: item.name,
            title: `${rawManeuverDc.signedString()}DC${maneuverDC !== rawManeuverDc ? " (halved due to 5e killing attack)" : ""} -> ${formula}`,
        });
    }

    // Add in STR if it isn't the base damage type
    if (baseDamageItem.system.usesStrength) {
        addStrengthToBundle(baseDamageItem, options, addedDamageBundle, true);
    }

    // Boostable Charges
    if (options.boostableCharges != undefined && options.boostableCharges > 0) {
        // Each used boostable charge, to a max of 4, increases the damage class by 1.
        const boostChargesDc = Math.min(4, parseInt(options.boostableCharges));
        const boostableDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, boostChargesDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, boostableDiceParts);

        addedDamageBundle.diceParts = addDiceParts(baseDamageItem, addedDamageBundle.diceParts, boostableDiceParts);
        addedDamageBundle.tags.push({
            value: `${formula}`,
            name: "Boostable Charges",
            title: `${boostChargesDc}DC -> ${formula}`,
        });
    }

    // Combat Skill Levels. These are added is added in without consideration of advantages in 5e but not in 6e.
    // PH: TODO: 5E Superheroic: Each 2 CSLs modify the killing attack BODY roll by +1 (cannot exceed the max possible roll). Obviously no +1/2 DC.
    // PH: TODO: 5E Superheroic: Each 2 CSLs modify the normal attack STUN roll by +3 (cannot exceed the max possible roll). Obviously no +1/2 DC.
    // PH: TODO: THE ABOVE 2 NEED NEW HERO ROLLER FUNCTIONALITY.
    for (const csl of combatSkillLevelsForAttack(item)) {
        if (csl.dc > 0) {
            // CSLs in 5e ignore advantages. In 6e they care about it.
            const alteredCslDc = item.is5e ? csl.dc * (1 + item.system._advantagesDc) : csl.dc;
            const cslDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, alteredCslDc);
            const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, cslDiceParts);
            addedDamageBundle.diceParts = addDiceParts(baseDamageItem, addedDamageBundle.diceParts, cslDiceParts);
            addedDamageBundle.tags.push({
                value: `+${formula}`,
                name: csl.item.name,
                title: `${csl.dc.signedString()}DC -> ${formula}`,
            });
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

        const velocityDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, velocityDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, velocityDiceParts);

        // Velocity adding to normal damage does not count towards any doubling rules.
        const bundleToUse = item.doesKillingDamage ? addedDamageBundle : velocityDamageBundle;

        bundleToUse.diceParts = addDiceParts(baseDamageItem, bundleToUse.diceParts, velocityDiceParts);
        bundleToUse.tags.push({
            value: `${formula}`,
            name: "Velocity",
            title: `${velocity}${getSystemDisplayUnits(item.is5e)}/${divisor} -> ${formula}`,
        });
    }

    // Applied effects
    for (const ae of item.actor?.appliedEffects.filter((ae) => !ae.disabled && ae.flags?.target === item.uuid) || []) {
        for (const change of ae.changes.filter(
            (change) => change.key === "system.value" && change.value !== 0 && change.mode === 2,
        )) {
            const value = parseInt(change.value);
            const aeDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, value);
            const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, aeDiceParts);

            addedDamageBundle.diceParts = addDiceParts(baseDamageItem, addedDamageBundle.diceParts, aeDiceParts);
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
        // Can haymaker anything except for maneuvers because it is a maneuver itself. The strike manuever is the 1 exception.
        // PH: FIXME: Implement the exceptions: See 6e v2 pg. 99. 5e has none?
        if (
            !["maneuver", "martialart"].includes(item.type) ||
            (item.type === "maneuver" && item.system.XMLID === "STRIKE")
        ) {
            const rawHaymakerDc = parseInt(options.haymakerManeuverActiveItem.system.DC);

            let haymakerDC = rawHaymakerDc;
            if (item.is5e && item.doesKillingDamage) {
                haymakerDC = Math.floor(rawHaymakerDc / 2);
            }

            // 5e does not consider advantages so we have to compensate and as a consequence we may have a fractional DC (yes, the rules are not self consistent).
            // 6e is sensible in this regard.
            const alteredHaymakerDc = item.is5e ? haymakerDC * (1 + item.system._advantagesDc) : haymakerDC;
            const haymakerDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, alteredHaymakerDc);
            const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, haymakerDiceParts);

            addedDamageBundle.diceParts = addDiceParts(baseDamageItem, addedDamageBundle.diceParts, haymakerDiceParts);
            addedDamageBundle.tags.push({
                value: `${formula}`,
                name: "Haymaker",
                title: `${rawHaymakerDc}DC${haymakerDC !== rawHaymakerDc ? " (halved due to 5e killing attack)" : ""} -> ${formula}`,
            });
        } else {
            // PH: FIXME: This is a poor location for this. Better off in the to hit code and reject immediately.
            if (options?.isAction)
                ui.notifications.warn("Haymaker cannot be combined with another maneuver except Strike.", {
                    localize: true,
                });
        }
    }

    // WEAPON MASTER (also check that item is present as a custom ADDER)
    // PH: FIXME: 6e only? Cost seems to indicate that this is additive to the actual base damage in the case of the damage doubling rule
    const weaponMaster = item.actor?.items.find((item) => item.system.XMLID === "WEAPON_MASTER");
    if (weaponMaster) {
        const weaponMatch = (weaponMaster.system.ADDER || []).find((o) => o.XMLID === "ADDER" && o.ALIAS === item.name);
        if (weaponMatch) {
            const weaponMasterDcBonus = 3 * Math.max(1, parseInt(weaponMaster.system.LEVELS) || 1);
            const weaponMasterDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, weaponMasterDcBonus);
            const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, weaponMasterDiceParts);

            addedDamageBundle.diceParts = addDiceParts(
                baseDamageItem,
                addedDamageBundle.diceParts,
                weaponMasterDiceParts,
            );
            addedDamageBundle.tags.push({
                value: `${formula}`,
                name: "Weapon Master",
                title: `${weaponMasterDcBonus}DC -> ${formula}`,
            });
        }
    }

    // DEADLYBLOW
    // Only check if it has been turned off
    // FIXME: This function should not be changing the item.system. Please fix me by moving this to somewhere in the user flow.
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
                        const deadlyBlowDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, deadlyDc);
                        const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, deadlyBlowDiceParts);

                        addedDamageBundle.diceParts = subtractDiceParts(
                            baseDamageItem,
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
    if (item.actor?.statuses?.has("underwater")) {
        const underwaterDc = 2; // NOTE: Working with 2 DC and then subtracting
        const underwaterDiceParts = calculateDicePartsFromDcForItem(baseDamageItem, underwaterDc);
        const formula = dicePartsToFullyQualifiedEffectFormula(baseDamageItem, underwaterDiceParts);

        addedDamageBundle.diceParts = subtractDiceParts(
            baseDamageItem,
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
 * NOTE: These are the same breaks that 3AP/die and 6AP/die
 *
 * @param {HeroSystem6eItem} item
 * @param {number} dc
 * @returns
 */
export function calculateDicePartsFromDcForItem(item, dc) {
    const isMartialOrManeuver = ["maneuver", "martialart"].includes(item.type);
    let martialOrManeuverEquivalentApPerDice = 0;
    if (isMartialOrManeuver) {
        const effect = item.system.EFFECT;
        if (effect.search("NORMALDC") !== -1) {
            martialOrManeuverEquivalentApPerDice = 5;
        } else if (effect.search("NNDDC") !== -1) {
            martialOrManeuverEquivalentApPerDice = 10;
        } else if (effect.search("KILLINGDC") !== -1) {
            martialOrManeuverEquivalentApPerDice = 15;
        } else {
            // FIXME: We shouldn't be calculating damage dice for things that don't do damage
            // Most maneuvers don't do damage. However there are some that use STR as a base so assume normal damage.
            martialOrManeuverEquivalentApPerDice = 5;
        }
    }

    const baseApPerDie =
        martialOrManeuverEquivalentApPerDice ||
        (item.system.XMLID === "TELEKINESIS" ? 5 : undefined) || // PH: FIXME: Kludge for time being. TK Behaves like strength
        item.baseInfo.costPerLevel(item);

    // FIXME: For the time being this is required because we have a few powers that can have damage effects but don't actually roll damage
    // so they have "dice" behavior but fixed damage. These show up as 0 cost per level. Examples are Possession and change environment.
    if (baseApPerDie === 0) {
        return item.baseInfo.baseEffectDiceParts(item, {});
    }

    const fullDieValue = 1;
    let halfDieValue;
    let pipValue;
    if (baseApPerDie === 5) {
        halfDieValue = 3 / 5;
        pipValue = 2 / 5;
    } else if (baseApPerDie === 10) {
        halfDieValue = 5 / 10;
        pipValue = 3 / 10;
    } else if (baseApPerDie === 15 || baseApPerDie === 6 || baseApPerDie === 3) {
        halfDieValue = 10 / 15;
        pipValue = 5 / 15;
    } else {
        console.error(`Unhandled die of damage cost ${baseApPerDie} for ${item.name}/${item.system.XMLID}`);
    }

    let apPerDie;
    if (!isMartialOrManeuver && item.system.activePointsDc !== 0) {
        // Some ugly stuff to deal with the case where we have adders to the base powers. We need to figure out
        // how much a die actually costs.
        // FIXME: would be nice to pull out the TK exception/special handling.
        const { diceParts } = item.baseInfo.baseEffectDiceParts(item, {});
        let diceValue = 0;
        diceValue += diceParts.d6Count * fullDieValue;
        diceValue += (diceParts.d6Less1DieCount + diceParts.halfDieCount) * halfDieValue;
        diceValue += diceParts.constant * pipValue;
        apPerDie =
            item.system.XMLID === "TELEKINESIS"
                ? 5 * (1 + item.system._advantagesDc)
                : item.system.activePointsDc / diceValue;
    } else {
        // NOTE: Maneuvers shouldn't be able to be advantaged but will keep this here because I'm not sure if there are exceptions
        apPerDie = baseApPerDie * (1 + item.system._advantagesDc);
    }

    // NOTE: Work in positive values and positive 0 for obviousness to users
    const diceOfDamage = Math.abs(dc * (5 / apPerDie));
    const diceSign = Math.sign(dc) || 0;

    // Since the smallest interval between 1 pip and 1/2 die is 0.3 to 0.5 so 0.099 is probably the smallest.
    // However, the results don't match tables we see in 6e vol 2 p.97 if we use that epislon.
    // It's possible a better algorithm would produce something better but with this one:
    // 0.066666 appears to be too large. (1DC KA @ +1/4)
    // 0.04 appears to be too large. (1DC EA @ +1)
    // Epsilon observations also indicate the possibiliy that the rules (as expressed in the 6e table) only use one of the attack types to determine part dice.
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

        // PH: FIXME: Not implemented yet
        d6Less1DieCount: 0,
        constant,
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
    const doubleDamageLimitTags = [];
    const {
        diceParts: baseDiceParts,
        tags: baseTags,
        baseAttackItem,
    } = item.baseInfo.baseEffectDiceParts(item, options);

    // PH: FIXME: This can be removed when we don't create damage for things that aren't attacks.
    if (!baseAttackItem) {
        console.error(
            `Actor=${item.actor?.name}. Actor.type=${item.actor?.type}. ${item.name}/${item.system.XMLID} links to a base attack item of ${baseAttackItem}.`,
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
    const useDieMinusOne = !!baseAttackItem.findModsByXmlid("MINUSONEPIP");

    // Max Doubling Rules
    // 5e rule and 6e optional rule: A character cannot more than double the Damage Classes of their base attack, no
    // matter how many different methods they use to add damage.
    let sumDiceParts = addDiceParts(baseAttackItem, baseDiceParts, addedDiceParts, useDieMinusOne);
    if (doubleDamageLimit()) {
        // PH: FIXME: Need to implement these:
        // Exceptions to the rule (because it wouldn't be the hero system without exceptions) from FRed pg. 405:
        // 1) Weapons that do normal damage (this really means not killing attacks) in superheroic campaigns
        // 2) extra damage classes for unarmed martial maneuvers
        // 3) movement bonuses to normal damage (this really means not killing attacks)

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

export function getEffectForumulaFromItem(item, options) {
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

    return dicePartsToFullyQualifiedEffectFormula(baseAttackItem, diceParts);
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
            ? diceParts.d6Count + diceParts.d6Less1DieCount + diceParts.halfDieCount > 0
                ? "+1"
                : "1"
            : diceParts.d6Count + diceParts.d6Less1DieCount + diceParts.halfDieCount > 0
              ? `${diceParts.d6Less1DieCount > 0 ? "-1" : ""}`
              : "0"
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

function addStrengthToBundle(item, options, dicePartsBundle, strengthAddsToDamage) {
    // PH: FIXME: Need to figure in all the crazy rules around STR and STR with advantage

    const actorStrengthItem = item.actor?.items.find(
        (item) => item.system.XMLID === "__STRENGTHDAMAGE" && item.name === "__InternalStrengthPlaceholder",
    );

    const baseEffectiveStrength = effectiveStrength(item, options);
    let str = baseEffectiveStrength;

    // NOTE: intentionally using fractional DC here.
    const strDiceParts = calculateDicePartsFromDcForItem(item, str / 5);
    const formula = dicePartsToFullyQualifiedEffectFormula(item, strDiceParts);

    dicePartsBundle.baseAttackItem = actorStrengthItem;
    dicePartsBundle.diceParts = addDiceParts(item, dicePartsBundle.diceParts, strDiceParts);
    dicePartsBundle.tags.push({
        value: `${strengthAddsToDamage ? "+" : ""}${formula}`,
        name: "STR",
        title: `${str} STR -> ${strengthAddsToDamage ? "+" : ""}${formula}`,
    });

    // STRMINIMUM
    // A character using a weapon only adds damage for every full 5 points of STR they has above the weapon’s STR Minimum
    const strMinimumModifier = item.findModsByXmlid("STRMINIMUM");
    if (strMinimumModifier) {
        const strMinimum = calculateStrengthMinimumForItem(item, strMinimumModifier);
        const strMinDc = Math.ceil(strMinimum / 5);

        const strMinDiceParts = calculateDicePartsFromDcForItem(item, strMinDc / 5);
        const formula = dicePartsToFullyQualifiedEffectFormula(item, strMinDiceParts);

        dicePartsBundle.diceParts = addDiceParts(item, dicePartsBundle.diceParts, strMinDiceParts);
        dicePartsBundle.tags.push({
            value: `-(${formula})`,
            name: "STR Minimum",
            title: `${strMinimumModifier.ALIAS} ${strMinimumModifier.OPTION_ALIAS} -> -(${formula})`,
        });
    }

    // Any STRDC modifiers such as MOVEBY?
    const strMatch = (item.system.EFFECT || "").match(/\[STRDC\]\/(\d+)/);
    if (strMatch) {
        // It doesn't make sense to halve negative strength
        if (str >= 0) {
            const strBeforeManeuver = str;
            const divisor = parseInt(strMatch[1]);
            str = RoundFavorPlayerUp(str / divisor);

            // NOTE: intentionally using fractional DC here.
            const strDiceParts = calculateDicePartsFromDcForItem(item, (strBeforeManeuver - str) / 5);
            const formula = dicePartsToFullyQualifiedEffectFormula(item, strDiceParts);

            dicePartsBundle.diceParts = subtractDiceParts(item, dicePartsBundle.diceParts, strDiceParts);
            dicePartsBundle.tags.push({
                value: `-(${formula})`,
                name: `${item.name} STR`,
                title: `STR divided to ${str} due to ${item.name} -> -(${formula})`,
            });
        }
    }

    return str;
}

export function maneuverBaseEffectDiceParts(item, options) {
    const baseDicePartsBundle = {
        diceParts: zeroDiceParts,
        tags: [],
        baseAttackItem: null,
    };

    // If unarmed combat
    if (isManeuverWithEmptyHand(item, options)) {
        // For Haymaker (with Strike presumably) and Martial Maneuvers, STR is the main weapon and the maneuver is additional damage
        if (isNonKillingStrengthBasedManeuver(item)) {
            // PH: FIXME: Ugly that we're adding the baseAttackItem to the dicePartsBundle. Does it make sense there?
            const str = addStrengthToBundle(item, options, baseDicePartsBundle, false);

            // If a character is using at least a 1/2 d6 of STR they can add HA damage and it will figure into the base
            // strength for damage purposes.
            // It only affects maneuvers that deal normal damage (not killing, NND, move through/by, grabbing, etc)
            if (str >= 3 && isManeuverThatDoesNormalDamage(item)) {
                const hthAttackItems = options.hthAttackItems || [];
                hthAttackItems.forEach((hthAttack) => {
                    const { diceParts: hthAttackDiceParts, tags } = hthAttack.baseInfo.baseEffectDiceParts(
                        hthAttack,
                        options,
                    );
                    baseDicePartsBundle.diceParts = addDiceParts(
                        item,
                        baseDicePartsBundle.diceParts,
                        hthAttackDiceParts,
                    );
                    baseDicePartsBundle.tags.push(...tags);

                    // Any STRDC modifiers such as MOVEBY?
                    const strMatch = (item.system.EFFECT || "").match(/\[STRDC\]\/(\d+)/);
                    if (strMatch) {
                        // It doesn't make sense to halve negative strength
                        if (str >= 0) {
                            const divisor = parseInt(strMatch[1]);
                            const hthDc = hthAttack.dcRaw / divisor;

                            // NOTE: intentionally using fractional DC here.
                            const hthDiceParts = calculateDicePartsFromDcForItem(hthAttack, hthDc);
                            const formula = dicePartsToFullyQualifiedEffectFormula(hthAttack, hthDiceParts);

                            baseDicePartsBundle.diceParts = subtractDiceParts(
                                item,
                                baseDicePartsBundle.diceParts,
                                hthDiceParts,
                            );
                            baseDicePartsBundle.tags.push({
                                value: `-(${formula})`,
                                name: `${item.name} STR (${hthAttack.name})`,
                                title: `HTH Attack divided to ${hthDc} DC due to ${item.name} -> -(${formula})`,
                            });
                        }
                    }
                });
            }
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

        // 5e martial arts EXTRADCs are baseDCs. Do the same for 6e in case they use the optional damage doubling rules too.
        if (item.type === "martialart" && !item.system.USEWEAPON) {
            addExtraDcsToBundle(item, baseDicePartsBundle);
        }

        return baseDicePartsBundle;
    } else if (isManeuverWithWeapon(item, options)) {
        // PH: FIXME: May wish to make maWeaponItem a UUID rather than the item itself.
        let weaponItem = options.maWeaponItem;
        if (!weaponItem) {
            console.warn(`Kludge: No weapon specified for ${item.name}/${item.system.XMLID}. Using placeholder.`);
            weaponItem = item.actor?.items.find((item) => item.name === "__InternalManeuverPlaceholderWeapon");
        }

        // PH: FIXME: STR minima apply to base weapon damage
        // PH: FIXME: Add rule that apply to breaking a weapon (but not here). If more than 3xBODY done to the target than base DC then weapon breaks.

        // Base damage of this maneuver with a weapon is the weapon itself.
        // PH: FIXME: getFullyQualifiedEffectFormulaFromItem
        const { diceParts, tags } = weaponItem.baseInfo.baseEffectDiceParts(weaponItem, options);

        return {
            diceParts,
            tags,
            baseAttackItem: weaponItem,
        };
    } else {
        console.error(`${item.name}/${item.system.XMLID} should not be calling MANEUVER base damage`);

        return {
            diceParts: zeroDiceParts,
            tags: [],
            baseAttackItem: null,
        };
    }
}
