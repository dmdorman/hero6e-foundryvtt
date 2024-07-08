// DAMAGE CLASS (DC)
//
// Different dice of damage are not the same – 2d6 of Killing
// Damage is much more likely to injure a target than a 2d6
// Normal Damage attack. For comparisons between damage
// types, Champions uses Damage Classes (“DC”).
//
// An attack’s DC is based on the number of Active Points in
// it divided by 5. Thus, a Blast 6d6 and an HKA 2d6 (each with
// 30 Active Points) each have 6 DCs; if added STR increases that
// HKA to 3d6+1, it counts as 10 DCs; and so on.
//
// For attacks with Advantages, determine the DCs by
// making a special Active Point calculation that only counts
// Advantages that directly affect how the victim takes damage.
// The GM makes the final call on which Advantages this includes,
// but typically, the following Advantages qualify: Area Of
// Effect, Armor Piercing, AVAD, Autofire, Charges (Boostable),
// Constant, Cumulative, Damage Over Time, Does BODY, Does
// Knockback, Double Knockback, Increased STUN Multiplier,
// MegaScale in some instances, Penetrating, Sticky, Time Limit,
// Transdimensional, Trigger, Uncontrolled, Usable As Attack,
// Variable Advantage, and Variable Special Effects.

// Determine DC solely from item/attack
export function convertToDcFromItem(item, options) {
    let actor = item.actor;
    let dc = 0;
    let tags = [];
    let end = 0;

    // Killing Attack
    if (item.system.killing) {
        dc += parseInt(item.system.dice) * 3;
        //dc += parseInt(item.system.DC) || (parseInt(item.system.value) * 3)
        switch (item.system.extraDice) {
            case "pip":
                dc += 1;
                break;
            case "half":
            case "one-pip":
                dc += 2;
                break;
        }
        tags.push({ value: `${dc.signedString()}DC`, name: item.name });
    } else {
        // Normal Attack
        dc += parseInt(item.system.dice);
        let _tag = `${dc.signedString()}DC`;
        switch (item.system.extraDice) {
            case "pip":
                dc += 0.2;
                _tag += " plus 1";
                break;
            case "half":
                dc += 0.5;
                _tag += " plus 1d3";
                break;
        }
        tags.push({ value: _tag, name: item.name });
    }

    // Boostable Charges
    if (options?.boostableCharges) {
        const _value = parseInt(options.boostableCharges);
        dc += _value;
        tags.push({ value: `${_value.signedString()}DC`, name: "boostable" });
    }

    // Combat Skill Levels

    for (const csl of CombatSkillLevelsForAttack(item)) {
        if (csl && csl.dc > 0) {
            // Simple +1 DC for now (checking on discord to found out rules for use AP ratio)
            dc += csl.dc;

            // Each DC should roughly be 5 active points
            // let dcPerAp =  ((dc * 5) / (item.system.activePointsDc || item.system.activePoints)) || 1;
            // let ratio = (dcPerAp || 5) / 5;  // Typically 1 to 1 radio
            // dc += (csl.dc * dcPerAp);
            // console.log(dcPerAp, dc, csl.dc)

            tags.push({
                value: `${csl.dc.signedString()}DC`,
                name: csl.item.name,
            });
        }
    }

    // Move By (add in velocity)
    // ((STR/2) + (v/10))d6; attacker takes 1/3 damage
    //
    // A character can accelerate at a rate of 5m per meter, up to their
    // maximum normal Combat Movement in meters per Phase. Thus
    // a character with 50m of Flight would be moving at a velocity of
    // 5m after traveling one meter, 10m after traveling two meters,
    // 15m after traveling three meters, and so on, up to 50m after
    // traveling ten meters.
    //
    // Currently assuming token starts at 0 velocity and ends at 0 velocity.
    // Under this assumption the max velocity is half the speed.

    let velocityDC = 0;
    // [NORMALDC] +v/5 Strike, FMove
    // ((STR/2) + (v/10))d6; attacker takes 1/3 damage
    if ((item.system.EFFECT || "").match(/v\/\d/)) {
        //if (["MOVEBY", "MOVETHROUGH"].includes(item.system.XMLID)) {
        if (!options) {
            options = {};
        }
        options.velocity = parseInt(options?.velocity || 0);
        let divisor = parseInt(item.system.EFFECT.match(/v\/(\d+)/)[1]); //10;
        // if (item.system.XMLID === "MOVETHROUGH") {
        //     divisor = 6;
        // }
        velocityDC = Math.floor(options.velocity / divisor);
        if (velocityDC > 0) {
            dc += velocityDC;
            tags.push({
                value: `${velocityDC.signedString()}DC`,
                name: "Velocity",
                title: `Velocity (${options.velocity}) / ${divisor}`,
            });
        }
    }

    // Add in STR
    if (item.system.usesStrength) {
        let str = parseInt(
            options?.effectivestr != undefined ? options?.effectivestr : actor?.system.characteristics.str.value || 0,
        );

        // MOVEBY halves STR
        if (item.system.XMLID === "MOVEBY") {
            str = str / 2;
        }

        // STRMINIMUM
        // A character using a weapon only adds damage for every full 5 points of STR he has above the weapon’s STR Minimum
        const STRMINIMUM = item.findModsByXmlid("STRMINIMUM");
        if (STRMINIMUM) {
            const strMinimum = parseInt(STRMINIMUM.OPTION_ALIAS.match(/\d+/)?.[0] || 0);
            //if (strMinimum && str > strMinimum) {
            const strMinDc = Math.ceil(strMinimum / 5);
            dc -= strMinDc;
            tags.push({
                value: `-${strMinDc}DC`,
                name: "STR Minimum",
                title: `${STRMINIMUM.OPTION_ALIAS} ${STRMINIMUM.ALIAS}`,
            });
            //}
        }

        let str5 = Math.floor(str / 5);
        dc += str5;
        end += Math.max(1, Math.round(str / 10));
        tags.push({
            value: `${str5.signedString()}DC`,
            name: "STR",
            title: item.system.XMLID === "MOVEBY" ? "MoveBy is half STR" : "",
        });
    }

    // Add in TK
    if (item.system.usesTk) {
        let tkItems = actor.items.filter((o) => o.system.XMLID === "TELEKINESIS");
        let str = 0;
        for (const item of tkItems) {
            str += parseInt(item.system.LEVELS) || 0;
        }
        str = options?.effectivestr != undefined ? options?.effectivestr : str;
        let str5 = Math.floor(str / 5);
        dc += str5;
        end += Math.max(1, Math.round(str / 10));
        tags.push({ value: `${str5.signedString()}DC`, name: "TK" });
    }

    // ActiveEffects
    if (item.actor) {
        for (const ae of item.actor.appliedEffects.filter((o) => !o.disabled && o.flags?.target === item.uuid)) {
            for (const change of ae.changes.filter((o) => o.key === "system.value" && o.value != 0 && o.mode === 2)) {
                const _value = parseInt(change.value);
                dc += _value;
                tags.push({
                    value: `${_value.signedString()}DC`,
                    name: ae.name,
                });
            }
        }
    }

    // Add in Haymaker to any non-maneuver attack DCV based attack
    if (item.actor) {
        const haymakerManeuver = item.actor.items.find(
            (o) => o.type == "maneuver" && o.name === "Haymaker" && o.system.active,
        );
        if (haymakerManeuver) {
            // && item.type != 'maneuver' && item.system.targets == 'dcv')
            if (item.name == "Strike" || item.type != "maneuver") {
                if (item.system.targets == "dcv") {
                    dc += 4;
                    tags.push({ value: `4DC`, name: "Haymaker" });
                } else {
                    if (options?.isAction)
                        ui.notifications.warn("Haymaker can only be used with attacks targeting DCV.", {
                            localize: true,
                        });
                }
            } else {
                if (options?.isAction)
                    ui.notifications.warn("Haymaker cannot be combined with another maneuver (except for Strike).", {
                        localize: true,
                    });
            }
        }
    }

    // WEAPON MASTER (also check that item is present as a custom ADDER)
    if (item.actor) {
        const WEAPON_MASTER = item.actor.items.find((o) => o.system.XMLID === "WEAPON_MASTER");
        if (WEAPON_MASTER) {
            const weaponMatch = (WEAPON_MASTER.system.ADDER || []).find(
                (o) => o.XMLID === "ADDER" && o.ALIAS === (item.system.ALIAS || item.name),
            );
            if (weaponMatch) {
                const dcPlus = 3 * Math.max(1, parseInt(WEAPON_MASTER.system.LEVELS) || 1);
                dc += dcPlus;
                tags.push({
                    value: `+${dcPlus}DC`,
                    name: "WeaponMaster",
                    title: WEAPON_MASTER.system.OPTION_ALIAS,
                });
            }
        }
    }

    // DEADLYBLOW
    // Only check if it has been turned off

    const DEADLYBLOW = item.actor?.items.find((o) => o.system.XMLID === "DEADLYBLOW");
    if (DEADLYBLOW) {
        item.system.conditionalAttacks ??= {};
        item.system.conditionalAttacks[DEADLYBLOW.id] ??= {
            ...DEADLYBLOW,
            id: DEADLYBLOW.id,
        };
        item.system.conditionalAttacks[DEADLYBLOW.id].checked ??= true;
    }

    if (item.actor) {
        for (const key in item.system.conditionalAttacks) {
            const conditionalAttack = item.actor.items.find((o) => o.id === key);
            if (!conditionalAttack) {
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
            if (!item.system.conditionalAttacks[key].checked) continue;

            switch (conditionalAttack.system.XMLID) {
                case "DEADLYBLOW": {
                    const dcPlus = 3 * Math.max(1, parseInt(conditionalAttack.system.LEVELS) || 1);
                    dc += dcPlus;
                    tags.push({
                        value: `+${dcPlus}DC`,
                        name: "DeadlyBlow",
                        title: conditionalAttack.system.OPTION_ALIAS,
                    });
                    break;
                }
                default:
                    console.warn("Unhandled conditionalAttack", conditionalAttack);
            }
        }
    }

    if (item.actor?.statuses?.has("underwater")) {
        dc = Math.max(0, dc - 2);
        tags.push({ value: `-2DC`, name: "Underwater" });
    }

    // Programmer warning
    if (dc <= 0) {
        console.warn("DC <= 0", dc, item);
    }

    return { dc: dc, tags: tags, end: end };
}

/**
 * This is not perfect as it has to make a guess at if the 2 DC chunks are a 1/2d6 or 1d6-1. Make a guess by looking
 * at the extraDice for a hint if available. Otherwise default to 1/2d6
 */
// TODO: Does 0.2, 0.5, and 1 as partials for 5AP/DC scale correctly when the costs are > 5AP/die?/
export function calculateDiceFormulaParts(item, dc) {
    const usesDieLessOne = item.system.extraDice === "one-pip";
    let d6Count = 0;
    let halfDieCount = 0;
    let constant = 0;

    if (dc) {
        // Normal Attack
        if (!item.system.killing) {
            // NOTE: This is ugly because with floating point calculations we need to use epsilon comparisons (see https://randomascii.wordpress.com/2012/02/25/comparing-floating-point-numbers-2012-edition/ for instance)
            //       However due to the fact that Number.EPSILON doesn't scale based on input we're going to make our tolerances based on the fact that we
            //       can only have 3 possible values x.0, x.2, and x.5 for any whole number x >= 0. If we make our epsilon 0.1 it'll more than do for
            //       values of x < a few million.
            const ourEpsilon = 0.1;

            d6Count = Math.floor(dc);
            // d3Count = DC % 1 >= 0.5 ? 1 : 0
            halfDieCount = (dc % 1) - 0.5 >= -ourEpsilon ? 1 : 0;
            // constant = (DC % 1 >= 0.2 && DC % 1 < 0.5) ? 1 : 0
            constant = (dc % 1) - 0.2 >= -ourEpsilon && (dc % 1) - 0.5 < -ourEpsilon ? 1 : 0;
        }

        // Killing Attack
        else {
            d6Count = Math.floor(dc / 3);
            halfDieCount = Math.floor((dc % 3) / 2);
            constant = Math.floor((dc % 3) % 2);
        }
    }

    return {
        isKilling: item.system.killing,
        d6Count,
        halfDieCount: usesDieLessOne ? 0 : halfDieCount,
        d6Less1DieCount: usesDieLessOne ? halfDieCount : 0,
        constant,
    };
}

export function getDiceFormulaFromItemDC(item, DC) {
    const formulaParts = calculateDiceFormulaParts(item, DC);

    return `${
        formulaParts.d6Count + formulaParts.d6Less1DieCount + formulaParts.halfDieCount > 0
            ? `${
                  formulaParts.d6Count + formulaParts.d6Less1DieCount
                      ? `${formulaParts.d6Count + formulaParts.d6Less1DieCount}`
                      : ""
              }${formulaParts.halfDieCount ? `½` : ""}d6`
            : ""
    }${
        formulaParts.constant
            ? formulaParts.d6Count + formulaParts.d6Less1DieCount + formulaParts.halfDieCount > 0
                ? "+1"
                : "1"
            : `${formulaParts.d6Less1DieCount > 0 ? "-1" : ""}`
    }`;
}

export function CombatSkillLevelsForAttack(item) {
    let results = [];

    // Guard
    if (!item.actor) return results;

    const cslSkills = item.actor.items.filter(
        (o) =>
            ["MENTAL_COMBAT_LEVELS", "COMBAT_LEVELS"].includes(o.system.XMLID) &&
            (o.system.ADDER || []).find((p) => p.ALIAS === item.system.ALIAS || p.ALIAS === item.name) &&
            o.system.active != false,
    );

    for (const cslSkill of cslSkills) {
        let result = {
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
