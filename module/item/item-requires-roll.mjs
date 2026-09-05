import { HEROSYS } from "../herosystem6e.mjs";

import { HeroRoll, HeroRoller } from "../heroRoller/dice.mjs";
import { calculateDicePartsForItem } from "../utility/damage.mjs";
import { FrozenSet } from "../utility/frozen-set.mjs";
import { roundFavorPlayerTowardsZero } from "../utility/round.mjs";
import { doSuccessRoll, emphasizeSuccessFailureFlavour, generateSuccessChatCard } from "../utility/success-card.mjs";
import { tokenEducatedGuess } from "../utility/util.mjs";

// Probability, in %, of that number on 3d6
const HIT_LOCATION_PROBABILITY = Object.freeze({
    3: 0.46,
    4: 1.38,
    5: 2.77,
    6: 4.62,
    7: 6.94,
    8: 9.72,
    9: 11.57,
    10: 12.5,
    11: 12.5,
    12: 11.57,
    13: 9.72,
    14: 6.94,
    15: 4.62,
    16: 2.77,
    17: 1.38,
    18: 0.46,
});

// Probability, in %, of that number or less on 3d6
const DICE_CUMULATIVE_PROBABILITY = Object.freeze({
    3: 0.46,
    4: 1.85,
    5: 4.62,
    6: 9.25,
    7: 16.2,
    8: 25.92,
    9: 37.5,
    10: 50.0,
    11: 62.5,
    12: 74.07,
    13: 83.79,
    14: 90.74,
    15: 95.37,
    16: 98.14,
    17: 99.53,
    18: 100,
});

// Translation for x or less to a limitation value only for 5e. For instance 8- is a -2 limitation per activation roll table FRed pg 283.
const HERO_SYSTEM_VALUE_OR_LESS_LIMITATION_VALUE_5E = Object.freeze({
    3: -2,
    4: -2,
    5: -2,
    6: -2,
    7: -2,
    8: -2,
    9: -1.5,
    10: -1.25,
    11: -1,
    12: -0.75,
    13: -0.75,
    14: -0.5,
    15: -0.25,
    16: 0,
    17: 0,
    18: 0,
});

// Translation for x or less to a limitation value only for 6e constant/every phase powers only. For instance 8- is a -2 limitation per requires a roll table 6e vol 1 pg 389.
const HERO_SYSTEM_VALUE_OR_LESS_LIMITATION_VALUE_FOR_CONSTANT_POWERS_6E = Object.freeze({
    3: -2,
    4: -2,
    5: -2,
    6: -2,
    7: -2,
    8: -1.75,
    9: -1.5,
    10: -1.25,
    11: -1,
    12: -0.75,
    13: -0.5,
    14: -0.25,
    15: 0, // GM permission required for this to be worth anything. Be pessimistic.
    16: 0, // GM permission required for this to be worth anything. Be pessimistic.
    17: 0, // GM permission required for this to be worth anything. Be pessimistic.
    18: 0,
});

function limitationValueFromItemAndCumulativeProbability(item, hitLocationsCumulativeProbability) {
    // What is a more reasonable activation roll number that is not smaller?
    let shouldBeLessThanValue = 18;
    for (let cumulativeValue = shouldBeLessThanValue - 1; cumulativeValue >= 3; --cumulativeValue) {
        if (DICE_CUMULATIVE_PROBABILITY[cumulativeValue] < hitLocationsCumulativeProbability) {
            break;
        }

        shouldBeLessThanValue = cumulativeValue;
    }

    return {
        shouldBeLessThanValue: shouldBeLessThanValue,
        limitationValue: item.is5e
            ? HERO_SYSTEM_VALUE_OR_LESS_LIMITATION_VALUE_5E[shouldBeLessThanValue]
            : HERO_SYSTEM_VALUE_OR_LESS_LIMITATION_VALUE_FOR_CONSTANT_POWERS_6E[shouldBeLessThanValue],
    };
}

const CAP_HIT_LOCATIONS = new FrozenSet([5]); // Protects location 5? (part of head) (NOTE: not defined properly in HD)
const HELMET_HIT_LOCATIONS = new FrozenSet([4, ...CAP_HIT_LOCATIONS.values()]); // Protects location 4-5 (adds more head)
const FULLHELMET_HIT_LOCATIONS = new FrozenSet([3, ...HELMET_HIT_LOCATIONS.values()]); // Protects location 3-5 (adds rest of head)

const SHORTVEST_HIT_LOCATIONS = new FrozenSet([12, 13]); // Protects location 12-13 (stomach + vitals)
const STANDARDVEST_HIT_LOCATIONS = new FrozenSet([11, ...SHORTVEST_HIT_LOCATIONS.values()]); // Protects location 11-13 (adds part of chest)
const LONGVEST_HIT_LOCATIONS = new FrozenSet([10, ...STANDARDVEST_HIT_LOCATIONS.values()]); // Protects location 10-13 (add rest of chest)
const JACKET_HIT_LOCATIONS = new FrozenSet([9, ...LONGVEST_HIT_LOCATIONS.values()]); // Protects location 9-13 (adds shoulders)
const LONGJACKET_HIT_LOCATIONS = new FrozenSet([...JACKET_HIT_LOCATIONS.values(), 14]); // Protects location 9-14 (adds thighs)
const LONGJACKETWITHSLEEVES_HIT_LOCATIONS = new FrozenSet([7, 8, ...LONGJACKET_HIT_LOCATIONS.values()]); // Protects location 7-14 (adds arms)

const SHOES_HIT_LOCATIONS = new FrozenSet([17, 18]); // Protects location 17-18
const HIGHBOOTS_HIT_LOCATIONS = new FrozenSet([16, ...SHOES_HIT_LOCATIONS.values()]); // Protects location 16-18 (adds part of legs)

const GAUNTLETS_HIT_LOCATIONS = new FrozenSet([6]); // Protects location 6

const SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET = Object.freeze({
    SHORTVEST: SHORTVEST_HIT_LOCATIONS,
    STANDARDVEST: STANDARDVEST_HIT_LOCATIONS,
    LONGVEST: LONGVEST_HIT_LOCATIONS,
    JACKET: new FrozenSet([...HELMET_HIT_LOCATIONS.values(), ...JACKET_HIT_LOCATIONS.values()]),
    LONGJACKET: new FrozenSet([...FULLHELMET_HIT_LOCATIONS.values(), ...JACKET_HIT_LOCATIONS.values()]),
    LONGJACKETSLEEVES: new FrozenSet([
        ...FULLHELMET_HIT_LOCATIONS.values(),
        ...LONGJACKETWITHSLEEVES_HIT_LOCATIONS.values(),
        ...HIGHBOOTS_HIT_LOCATIONS.values(),
    ]),
    FULLCOVERAGE: new FrozenSet([
        ...FULLHELMET_HIT_LOCATIONS.values(),
        ...GAUNTLETS_HIT_LOCATIONS.values(),
        ...LONGJACKETWITHSLEEVES_HIT_LOCATIONS.values(),
        ...HIGHBOOTS_HIT_LOCATIONS.values(),
    ]), // NOTE: that there is a bug in HD description
});

/**
 * Generate a probability for the provided set of hit locations
 *
 * @param {Set} sectionalDefenseLocationsSet
 *
 * @returns  {Number}
 */
function summedHitProbability(sectionalDefenseLocationsSet) {
    let hitLocationCumulativeProbability = 0;

    for (const hitLocation of sectionalDefenseLocationsSet.values()) {
        hitLocationCumulativeProbability += HIT_LOCATION_PROBABILITY[hitLocation];
    }

    return hitLocationCumulativeProbability;
}

const SECTIONAL_DEFENSES_OPTIONID_TO_PROBABILITY = Object.freeze({
    SHORTVEST: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.SHORTVEST),
    STANDARDVEST: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.STANDARDVEST),
    LONGVEST: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.LONGVEST),
    JACKET: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.JACKET),
    LONGJACKET: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.LONGJACKET),
    LONGJACKETSLEEVES: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.LONGJACKETSLEEVES),
    FULLCOVERAGE: summedHitProbability(SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET.FULLCOVERAGE), // NOTE: that there is a bug in HD description
});

const BACKGROUND_SKILL_XMLID_TO_KEY = Object.freeze({
    KNOWLEDGE_SKILL: "KS",
    PROFESSIONAL_SKILL: "PS",
    SCIENCE_SKILL: "SS",
});

const RSR_ROLL_TYPE = Object.freeze({
    ACTIVATION_ROLL: "activation roll",
    ATTACK_ROLL: "attack roll",
    CHARACTERISTIC_ROLL: "characteristic roll",
    LUCK_ROLL: "luck roll",
    ITEM_ROLL: "item roll", // Skill, background skill, power
    SECTIONAL_DEFENSES_ROLL: "sectional defense roll",
});

const RSR_ROLL_CATEGORY = Object.freeze({
    ATTACK: "attack category",
    BACKGROUNDSKILL: "background category",
    CHAR: "characteristic category",
    PER: "perception category",
    SKILL: "skill category",
});

const TYPE_TO_ROLL_TYPE = Object.freeze({
    0: RSR_ROLL_CATEGORY.SKILL,
    1: RSR_ROLL_CATEGORY.BACKGROUNDSKILL,
    2: RSR_ROLL_CATEGORY.CHAR,
    3: RSR_ROLL_CATEGORY.PER,
});

function filterOutNonSkillRollItems(item) {
    if (!item.isRollable()) {
        return false;
    }

    return (
        item.baseInfo?.type?.includes("skill") && // is a skill
        !item.baseInfo?.type?.includes("enhancer") && // is not an enhancer (scholar, scientist, etc.)
        item.system.XMLID !== "SKILL_LEVELS" && // is not a bonus to skills
        item.system.XMLID !== "COMBAT_LEVELS" // is not a bonus to combat
    );
}

/**
 * Narrow down an array of skills to the one chosen skill.
 * If there is just one skill in the array (a non variable RSR) then it's simple and you shouldn't call this function.
 * If there are more than one skill, then prompt the user and have them decide.
 *
 * @param {Array<Object>} skillArray
 *
 * @returns {Object | null} - returns the info about the item that is selected or null if the user has chosen to cancel the operation at this point by closing the dialog.
 */
async function userSelectsASkill(skillArray) {
    const radios = skillArray
        .map(
            (skillObject, i) => `
                <label style="display:flex; align-items:center; gap:0.5em; margin-bottom:4px;">
                <input type="radio" name="skill" value="${i}" ${i === 0 ? "checked" : ""}>
                ${skillObject.name}${skillObject.activeItems.length === 0 ? ` (has no active items)` : ""}
                </label>
            `,
        )
        .join("");

    const arrayIndex = await foundry.applications.api.DialogV2.wait({
        window: { title: "Choose Your Variable Skill" },
        content: `<fieldset><legend>Skills</legend>${radios}</fieldset>`,
        buttons: [
            {
                action: "choose",
                label: "Confirm",
                default: true,
                callback: (event, button) => button.form.elements.skill.value,
            },
        ],
        rejectClose: false, // returns null instead of throwing if the user closes the dialog
    });

    // null is returned if the user is closing the dialog.
    return arrayIndex == null ? null : skillArray[arrayIndex];
}

/**
 * Test Only version of userSelectsASkill: Narrow down an array of skills to the one chosen skill.
 * If there is just one skill in the array (a non variable RSR) then it's simple.
 * If there are more than one skill, then prompt the user and have them decide.
 *
 * @param {Array<Object>} skillArray
 * @param {Number | null} selectedIndex
 *
 * @returns {Object | null} - returns the info about the item that is selected or null if the user has chosen to cancel the operation at this point by closing the dialog.
 */
async function testOnlyUserSelectsASkill(skillArray, arrayIndex) {
    // null is returned if the user is closing the dialog.
    return arrayIndex == null ? null : skillArray[arrayIndex];
}

/**
 * Extract skill items from the actor for a given roll alias. There can be multiple skills in the case of 5e variable skills but typically will be only 1.
 *
 * @param {HeroSystem6eActor} actor
 * @param {String} rollAlias
 * @param {Boolean} wantBackgroundSkill
 *
 * @returns {Array<Object>} - Array of skill objects
 */
function extractSkills(actor, rollAlias, wantBackgroundSkill) {
    // Hero Designer permits leaving the skill unnamed
    if (!rollAlias?.trim()) {
        return [
            {
                name: "",
                wantBackgroundSkill: wantBackgroundSkill,
                activeItems: [],
                items: [],
            },
        ];
    }

    // Matches any non-empty string (the guard above handles empty), splitting on an optional " or "
    const variableSkillsAliasMatch = rollAlias.match(/^([\S\s]+?)((?:\s+or\s+)([\S\s]+))?$/i);
    const requiredSkillNames = [variableSkillsAliasMatch[1]];

    // Is this a variable roll alias with 2 skills separated by " or ".
    if (variableSkillsAliasMatch[3] != null) {
        requiredSkillNames.push(variableSkillsAliasMatch[3]);
    }

    return requiredSkillNames.map((requiredSkillName) => {
        const skillItems = findSkills(actor, requiredSkillName);

        return {
            name: requiredSkillName,
            wantBackgroundSkill: wantBackgroundSkill,
            activeItems: skillItems.filter((skill) => skill.isActive),
            items: skillItems,
        };
    });
}

function findSkills(actor, skillName) {
    const skillsToMatchAgainst = (actor?.items ?? []).filter(filterOutNonSkillRollItems);

    // Case insensitive comparison
    return skillsToMatchAgainst.filter(
        (potentialMatchingSkillItem) => potentialMatchingSkillItem.name.toLowerCase() === skillName.toLowerCase(),
    );
}

/**
 * What is the penalty divisor? -1 per X AP.
 *
 * NOTE: Do not call unless it is appropriate for the type of roll (i.e. don't call for activation roll)
 *
 * @param {HeroModifierModel } rar
 *
 * @returns {number}
 */
function findRollDivisor(rar) {
    // modifiers are different based on 5e or 6e
    if (rar.parent.is5e) {
        const divisorOption = rar.adders.find((adder) => {
            return adder.XMLID === "MINUS1PER20" || adder.XMLID === "MINUS1PER5" || adder.XMLID === "NOAPPENALTY";
        });

        if (divisorOption?.XMLID === "MINUS1PER20") {
            return 20;
        } else if (divisorOption?.XMLID === "MINUS1PER5") {
            return 5;
        } else if (divisorOption?.XMLID === "NOAPPENALTY") {
            return 0;
        }

        // No AP penalty option means -1 per 10 AP
        return 10;
    } else {
        // item.activePoints is a number
        if (rar.OPTIONID.includes("1PER5")) {
            return 5;
        } else if (rar.OPTIONID.includes("1PER20")) {
            return 20;
        }

        // activation rolls have no minuses due to active points
        if (!isNaN(parseInt(rar.OPTIONID, 10))) {
            return 0;
        }

        // No AP penalty option means -1 per 10 AP
        return 10;
    }
}

function calculateRollApPenalty(item, rar) {
    const divisor = findRollDivisor(rar);
    if (divisor === 0) {
        return 0;
    }

    return roundFavorPlayerTowardsZero(item.activePoints / divisor);
}

function normalize5eTypeAndRollTarget(type, skillOrCharacteristic) {
    return {
        type: TYPE_TO_ROLL_TYPE[type] ?? `type ${type} not translated properly`,
        target: skillOrCharacteristic.trim(),
    };
}

/**
 * Given a rar, extract out all the bits and pieces required to make 1 or more activation rolls. This transforms
 * 5e ACTIVATIONROLL and REQUIRESASKILLROLL XMLIDs and 6e REQUIRESASKILLROLL into an intermediate format that
 * avoids HDC's completely different approach to expressing the modifier between 5e and 6e.
 *
 * @param {HeroSystem6eItem} item
 * @param {HeroModifierModel} rar
 *
 * @returns {Object[]} - rolls required to fulfill the RAR in an intermediate format
 */
function getRollsForRar(item, rar) {
    const rollsToGenerate = [];

    if (item.is5e) {
        // 5e normal ACTIVATIONROLL, an ACTIVATIONROLL incorrectly defined as a SECTIONAL_DEFENSES, or a SECTIONAL_DEFENSES?
        if (rar.XMLID === "ACTIVATIONROLL" || rar.XMLID === "SECTIONAL_DEFENSES") {
            return [buildActivationOrSectionalDefenseInternalRepresentation(item, rar)];
        }

        // 5e Luck roll?
        else if (rar.OPTIONID === "ONELUCK" || rar.OPTIONID === "TWOLUCK" || rar.OPTIONID === "THREELUCK") {
            const numSuccessesRequired = rar.OPTIONID === "ONELUCK" ? 1 : rar.OPTIONID === "TWOLUCK" ? 2 : 3;
            const luckItems = (item.actor?.items ?? []).filter((item) => item.system.XMLID === "LUCK");
            return [
                {
                    type: RSR_ROLL_TYPE.LUCK_ROLL,
                    successesRequired: numSuccessesRequired,
                    activeItems: luckItems.filter((item) => item.isActive),
                    items: luckItems,
                },
            ];
        }

        // 5e 2 rolls
        else if (rar.OPTIONID === "TWOROLLS") {
            // This can be a variable roll where the user gets to decide between 2 provided rolls - potentially for each of the rolls.
            // If this is the case, it will have rar.adder[].XMLID === "VARIABLERSR" somewhere. All options, however, are jammed into the rar.
            rollsToGenerate.push(normalize5eTypeAndRollTarget(rar.TYPE, rar.ROLLALIAS || rar.CHARACTERISTIC));
            rollsToGenerate.push(normalize5eTypeAndRollTarget(rar.TYPE2, rar.ROLLALIAS2 || rar.CHARACTERISTIC2));
        }

        // 5e 1 roll
        else if (rar.OPTIONID === "BASICRSR") {
            // This can be a variable roll where the user gets to decide between 2 provided rolls.
            // If this is the case, it will have rar.adder[].XMLID === "VARIABLERSR" somewhere. All options, however, are jammed into the rar.
            rollsToGenerate.push(normalize5eTypeAndRollTarget(rar.TYPE, rar.ROLLALIAS || rar.CHARACTERISTIC));
        }

        // FIXME: OPTIONID= attack roll doesn't seem to exist in HDC but does in the 5e rules (although it's not well defined). It does exist in 6e
        // 5e Unknown OPTIONID
        else {
            console.error(`Unknown 5e RSR ${rar.OPTIONID}`);
        }
    }

    // 6e
    else {
        // 6e activation roll
        const isOnlyDigits = /^\d+$/.test(rar.OPTIONID);
        if (isOnlyDigits) {
            return [buildActivationOrSectionalDefenseInternalRepresentation(item, rar)];
        }

        // 6e Skills and background skills
        else if (rar.OPTIONID === "SKILL" || rar.OPTIONID === "SKILL1PER5" || rar.OPTIONID === "SKILL1PER20") {
            rollsToGenerate.push({ type: RSR_ROLL_CATEGORY.SKILL, target: rar.COMMENTS });
        } else if (
            rar.OPTIONID === "KS" ||
            rar.OPTIONID === "KS1PER5" ||
            rar.OPTIONID === "KS1PER20" ||
            rar.OPTIONID === "PS" ||
            rar.OPTIONID === "PS1PER5" ||
            rar.OPTIONID === "PS1PER20" ||
            rar.OPTIONID === "SS" ||
            rar.OPTIONID === "SS1PER5" ||
            rar.OPTIONID === "SS1PER20"
        ) {
            rollsToGenerate.push({
                type: RSR_ROLL_CATEGORY.BACKGROUNDSKILL,
                target: rar.COMMENTS,
            });
        }

        // 6e Characteristics
        else if (rar.OPTIONID === "CHAR") {
            rollsToGenerate.push({ type: RSR_ROLL_CATEGORY.CHAR, target: rar.COMMENTS });
        }

        // 6e perception
        else if (rar.OPTIONID === "PER" || rar.OPTIONID === "PER1PER5" || rar.OPTIONID === "PER1PER20") {
            rollsToGenerate.push({ type: RSR_ROLL_CATEGORY.PER, target: null });
        }

        // 6e attack roll
        else if (rar.OPTIONID === "ATTACK" || rar.OPTIONID === "ATTACK1PER5" || rar.OPTIONID === "ATTACK1PER20") {
            rollsToGenerate.push({ type: RSR_ROLL_CATEGORY.ATTACK, target: null });
        }

        // 6e unknown OPTIONID
        else {
            console.error(`Unknown 6e RSR ${rar.OPTIONID}`);
        }
    }

    return rollsToGenerate.map((rollToGenerate) => {
        switch (rollToGenerate.type) {
            case RSR_ROLL_CATEGORY.ATTACK: {
                // PH: FIXME: Nothing required?
                return {
                    type: RSR_ROLL_TYPE.ATTACK_ROLL,
                };
            }

            case RSR_ROLL_CATEGORY.BACKGROUNDSKILL:
            case RSR_ROLL_CATEGORY.SKILL: {
                const requiredSkills = extractSkills(
                    item.actor,
                    rollToGenerate.target,
                    rollToGenerate.type === RSR_ROLL_CATEGORY.BACKGROUNDSKILL,
                );

                return {
                    type: RSR_ROLL_TYPE.ITEM_ROLL,
                    requiredSkills: requiredSkills,
                };
            }

            case RSR_ROLL_CATEGORY.CHAR:
                return {
                    type: RSR_ROLL_TYPE.CHARACTERISTIC_ROLL,
                    characteristicKey: rollToGenerate.target,
                };

            case RSR_ROLL_CATEGORY.PER: {
                const perceptionItems = (item.actor?.items ?? []).filter((item) => item.system.XMLID === "PERCEPTION");
                return {
                    type: RSR_ROLL_TYPE.ITEM_ROLL,
                    requiredSkills: [
                        {
                            name: "PERCEPTION",
                            wantBackgroundSkill: false,
                            activeItems: perceptionItems.filter((item) => item.isActive),
                            items: perceptionItems,
                        },
                    ],
                };
            }

            default: {
                const error = `${item.detailedName()} has unhandled RSR for OPTIONID ${rar.OPTIONID} -> ${rollToGenerate.type}`;
                console.error(error);
                return {
                    type: RSR_ROLL_TYPE.ITEM_ROLL,
                    requiredSkills: [
                        {
                            name: error,
                            wantBackgroundSkill: false,
                            activeItems: [],
                            items: [],
                        },
                    ],
                };
            }
        }
    });
}

const VALIDATE_SECTION_DEFENSE_ERROR_REASON = Object.freeze({
    NO_COMMENT: "no comment",
    NOT_DECLARATION: "not sectional defense declaration",
    INVALID_RANGE: "sectional defense declaration range invalid",
});

/**
 *
 * @param {HeroSystem6eItem} item
 * @param {string} potentialSectionalComment
 *
 * @returns {{ valid: boolean, reason?: string, sectionalDefenseLocationsSet?: Set }} - returns validation result with location Set on success or error reason on failure
 */
function validateSectionalComments(item, modifier) {
    const potentialSectionalComment = modifier.COMMENTS;

    // Is this a sectional defenses with default values?
    if (modifier.XMLID === "SECTIONAL_DEFENSES" && !potentialSectionalComment) {
        return {
            valid: true,
            sectionalDefenseLocationsSet: SECTIONAL_DEFENSES_OPTIONID_TO_HIT_LOCATIONS_SET[modifier.OPTIONID],
        };
    }

    // Are there comments that could be sectional instructions?
    if (!potentialSectionalComment) {
        return { valid: false, reason: VALIDATE_SECTION_DEFENSE_ERROR_REASON.NO_COMMENT };
    }

    // Are there sectional instructions that we understand? The form should be something like "protects locations" or
    // at its simplest just "location".
    const sectionalRangeComment = potentialSectionalComment.trim().match(/^(?:.*\s)?locations? (.*)$/i);
    if (!sectionalRangeComment) {
        return { valid: false, reason: VALIDATE_SECTION_DEFENSE_ERROR_REASON.NOT_DECLARATION };
    }

    // Are the locations provided reasonable (i.e. is it composed of digits, commas, dashes, and whitespace)?
    const sectionalLocationString = sectionalRangeComment[1].replaceAll("and", "");
    if (sectionalLocationString.search(/[^0-9,\-\s]/) !== -1) {
        return { valid: false, reason: VALIDATE_SECTION_DEFENSE_ERROR_REASON.INVALID_RANGE };
    }

    // Do the ranges appear to be within the 3-18 hit location range?
    const sectionalDefenseLocationsSet = new Set();
    const splitSectionalRanges = sectionalLocationString.split(",");
    for (const rangeChunk of splitSectionalRanges) {
        // rangeChunk can be a single value or a range separated by "-". If a single value, then startEndRange will be length 1.
        const startEndRange = rangeChunk.trim().split("-");
        const first = startEndRange[0] ? parseInt(startEndRange[0]) : null;
        const second = startEndRange[1] ? parseInt(startEndRange[1]) : null;

        if (startEndRange.length === 1) {
            // Is it a valid range declaration chunk
            if (first >= 3 && first <= 18) {
                sectionalDefenseLocationsSet.add(first);
                continue;
            }
        } else if (startEndRange.length === 2) {
            // First index of range doesn't have to be start.
            const start = first < second ? first : second;
            const end = first < second ? second : first;

            // Is it a valid range declaration chunk
            if (start >= 3 && end <= 18) {
                for (let i = start; i <= end; ++i) {
                    sectionalDefenseLocationsSet.add(i);
                }
                continue;
            }
        }

        return { valid: false, reason: VALIDATE_SECTION_DEFENSE_ERROR_REASON.INVALID_RANGE };
    }

    return { valid: true, sectionalDefenseLocationsSet };
}

/**
 * An HDC can represent sectional defenses in one of two way:
 *   - a SECTIONAL_DEFENSES XMLID, which makes it nice an clear.
 *   - an ACTIVATIONROLL or REQUIRESASKILLROLL XMLID which then requires a COMMENT explaining that it "protects locations"
 *
 * To further complicate matters, the SECTIONAL_DEFENSES XMLID doesn't have a great way to provide non standard
 * hit locations. This is due to a HD deficiency/bug.
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} rar
 *
 * @returns {Object}
 */
function buildActivationOrSectionalDefenseInternalRepresentation(item, rar) {
    // What to do when the defense type is sectional but hit locations not enabled. Ignore the case when hit location is not passed in.

    // Checking for sectional Defense takes precedence over a standard activation roll.
    const sectionalDefenseActivationRollModifier =
        item.modifiers.find(
            (modifier) => modifier.XMLID === "ACTIVATIONROLL" || modifier.XMLID === "SECTIONAL_DEFENSES",
        ) ?? item.findModsByXmlid("EVERYPHASE")?.parent;
    if (sectionalDefenseActivationRollModifier) {
        // mod.COMMENTS take precedence for finding a sectional defense declaration, but for SECTIONAL_DEFENSES modifiers it is
        // possible one of the location presets were used.

        // PH: FIXME: Support overrides or custom values.

        const { valid: validSectionalComment, sectionalDefenseLocationsSet } = validateSectionalComments(
            item,
            sectionalDefenseActivationRollModifier,
        );

        // Do we have valid ranges defined and are sectional defenses turned on?
        if (
            validSectionalComment &&
            game.settings.get(HEROSYS.module, "hit locations") === "hitLocationsWithSectional"
        ) {
            return {
                type: RSR_ROLL_TYPE.SECTIONAL_DEFENSES_ROLL,
                sectionalDefenseLocationsSet: sectionalDefenseLocationsSet,
            };
        }
    }

    // Guess it seems to be an activation roll
    return {
        type: RSR_ROLL_TYPE.ACTIVATION_ROLL,
        rollValue: parseInt(rar.OPTIONID), // PH: FIXME: Wrong for sectional defenses that are being used without hit locations
    };
}

/**
 *
 * @param {Set} sectionalDefenseLocationsSet - A set of all hit locations which provide a defense
 * @param {number} hitLocationNum
 *
 * @returns {boolean} - boolean value indicating the hitLocationNum is within the sectionalDefenseRanges
 */
function doSectionalDefensesApply(sectionalDefenseLocationsSet, hitLocationNum) {
    // PH: FIXME: Low shots (special hit location) can generate a hit location of 19. This is supposed to be treated as
    // a hit of foot. However, we don't have a dialog that allows this translation so it's possible we'll
    // have a hit location of 19 carried through to here. Translate it to 18 (feet).
    const locationNum = hitLocationNum === 19 ? 18 : hitLocationNum;

    if (sectionalDefenseLocationsSet.has(locationNum)) {
        return true;
    }

    return false;
}

/**
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} options
 * @param {HeroSystem6eToken} [options.token]
 * @param {Object} [options.test]
 * @param {Number} [options.hitLocationNum]
 *
 * @returns {Boolean} - success
 */
export async function isActivatedForThisUse(item, options) {
    return isActivatedForThisUseInternal(item, HeroRoll, options);
}

export async function isActivatedForThisUse_TestingOnly(item, rollClass, options) {
    return isActivatedForThisUseInternal(item, rollClass, options);
}

async function isActivatedForThisUseInternal(item, rollClass, options) {
    const rar = item.modifiers.find(
        (item) =>
            item.XMLID === "REQUIRESASKILLROLL" ||
            item.XMLID === "ACTIVATIONROLL" ||
            item.XMLID === "SECTIONAL_DEFENSES",
    );
    if (!rar) {
        return true;
    }

    const actor = item.actor;
    const token = options.token ?? tokenEducatedGuess({ actor });
    const speaker = ChatMessage.getSpeaker({ actor, token });

    // An item with an activation roll/requires a skill roll/requires a roll can take up to 2 consecutive rolls. Figure
    // out what we're actually rolling for.
    const activationRolls = getRollsForRar(item, rar);

    // Make sure all skill items require for the activation roll(s) exist on this character and are active before attempting
    // any rolls.
    for (const activationRoll of activationRolls) {
        // If this is a variable skill roll (i.e. user choosing between two skills depending on the situation), have the user select the chosen skill before the resources are paid.
        if (activationRoll.type === RSR_ROLL_TYPE.ITEM_ROLL && activationRoll.requiredSkills.length > 1) {
            const requiredSkill =
                options?.test?.variableSelectIndex === undefined
                    ? await userSelectsASkill(activationRoll.requiredSkills)
                    : await testOnlyUserSelectsASkill(activationRoll.requiredSkills, options.test.variableSelectIndex);

            // Has the user cancelled the action at this point?
            if (requiredSkill == null) {
                ui.notifications.info(`${item.name} roll aborted during variable skill selection.`);
                return false;
            }

            activationRoll.requiredSkills = [requiredSkill];
        }

        // PH: FIXME: ATTACK_ROLL needs to be considered

        // LUCK_ROLL and ITEM_ROLL must have at least 1 active skill
        if (
            (activationRoll.type === RSR_ROLL_TYPE.LUCK_ROLL && activationRoll.activeItems.length === 0) ||
            (activationRoll.type === RSR_ROLL_TYPE.ITEM_ROLL &&
                activationRoll.requiredSkills[0].activeItems.length === 0)
        ) {
            const flavor = `${item.name} activation ${emphasizeSuccessFailureFlavour(false, `failed as there is no matching active item for the ${activationRoll.type}.`)}`;
            await generateSuccessChatCard(actor, speaker, flavor, null, null);

            return false;
        } else if (
            activationRoll.type === RSR_ROLL_TYPE.CHARACTERISTIC_ROLL &&
            !item.actor.hasCharacteristic(activationRoll.characteristicKey)
        ) {
            const flavor = `${item.name} activation ${emphasizeSuccessFailureFlavour(false, `failed as ${actor.name} does not have the ${activationRoll.characteristicKey} characteristic.`)}`;
            await generateSuccessChatCard(actor, speaker, flavor, null, null);

            return false;
        } else if (activationRoll.type === RSR_ROLL_TYPE.ACTIVATION_ROLL) {
            // PH: FIXME: Should probably sanity check here for sectional defenses
        } else if (activationRoll.type === RSR_ROLL_TYPE.SECTIONAL_DEFENSES_ROLL) {
            // PH: FIXME: Should probably sanity check here for sectional defenses
        }
    }

    // PH: FIXME: Need to pay the activation resource cost of the RAR skills/char/etc

    // Perform the rolls. Because a roll might consume resources we must perform all rolls (i.e. invoke all skills etc)
    // and then evaluate if there was success.
    const rollPromises = activationRolls.map(async (activationRoll) => {
        const roller = new HeroRoller({}, rollClass);
        let succeeded = false;
        let flavor;

        if (activationRoll.type === RSR_ROLL_TYPE.SECTIONAL_DEFENSES_ROLL) {
            // PH: FIXME: Kludge to support turning on/activating sectional defense items via UI (as hitLocationNum clearly isn't set
            //            but it's assumed that this item is invoked in the defensive path on every hit).
            if (!options.hitLocationNum) {
                console.warn(
                    `Kludge: Need to deconflate the active concept. No hit location provided implies UI action.`,
                );
                return true;
            }

            const sectionalDefenseApply = doSectionalDefensesApply(
                activationRoll.sectionalDefenseLocationsSet,
                options.hitLocationNum,
            );

            const flavor = `The sectional defense from ${item.name} ${emphasizeSuccessFailureFlavour(sectionalDefenseApply, `${sectionalDefenseApply ? "applied" : "does not apply"} to hit location ${options.hitLocationNum}.`)}`;
            await generateSuccessChatCard(actor, speaker, flavor, null, null);

            return sectionalDefenseApply;
        } else if (activationRoll.type === RSR_ROLL_TYPE.ACTIVATION_ROLL) {
            // Regular plain activation roll
            roller.makeSuccessRoll(true, activationRoll.rollValue).addDice(3);

            const { succeeded: succeed, flavor: updatedFlavor } = await doSuccessRoll(
                actor,
                roller,
                `${item.name} activation`,
            );
            succeeded = succeed;
            flavor = updatedFlavor;
        } else if (activationRoll.type === RSR_ROLL_TYPE.LUCK_ROLL) {
            const luckPower = activationRoll.activeItems[0]; // PH: FIXME: Kludge. How do we best handle multiple luck powers?
            const { diceParts } = calculateDicePartsForItem(luckPower, {});

            roller.makeLuckRoll().addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0);

            await roller.roll();

            const luckTotal = roller.getLuckTotal();
            const luckOption = rar.OPTIONID;
            let requiredLuck;
            if (luckOption === "ONELUCK") {
                requiredLuck = 1;
            } else if (luckOption === "TWOLUCK") {
                requiredLuck = 2;
            } else if (luckOption === "THREELUCK") {
                requiredLuck = 3;
            } else {
                requiredLuck = 100;
                console.error(`${item.detailedName()} has unknown luck option ${luckOption}`);
            }

            succeeded = luckTotal >= requiredLuck;

            flavor = `${item.name} activation <span class="${succeeded ? "announce-success" : "announce-failure"}">${succeeded ? "succeeded" : "failed"} by ${Math.abs(luckTotal - requiredLuck)} levels of luck.</span>`;
        } else if (activationRoll.type === RSR_ROLL_TYPE.CHARACTERISTIC_ROLL) {
            const charKey = activationRoll.characteristicKey.toLowerCase();
            const characteristic = actor.system.characteristics[charKey];
            const baseRequiredRoll = characteristic.roll;
            const apPenalty = calculateRollApPenalty(item, rar);
            const divisor = findRollDivisor(rar);

            // PH: FIXME: what about additional skill levels used to influence the activation roll?
            // PH: FIXME: not including penalties in an obvious way ... should also include the tags for them
            roller
                .makeSuccessRoll(true, baseRequiredRoll, `Base ${charKey} roll`)
                .addDice(3)
                .addNumber(
                    apPenalty,
                    `AP penalty`,
                    `${item.activePoints} AP / ${divisor} -> ${apPenalty.signedString()}`,
                );

            const { succeeded: succeed, flavor: updatedFlavor } = await doSuccessRoll(
                actor,
                roller,
                `${item.name} activation`,
            );
            succeeded = succeed;
            flavor = updatedFlavor;
        } else if (activationRoll.type === RSR_ROLL_TYPE.ITEM_ROLL) {
            // At this point there should be only 1 requiredSkills entry
            const skill = activationRoll.requiredSkills[0].activeItems[0]; // PH: FIXME: Kludge. How do we best handle multiple powers of the same type?
            const baseRequiredRoll = parseInt(skill.system.roll);
            const apPenalty = calculateRollApPenalty(item, rar);
            const divisor = findRollDivisor(rar);

            // PH: FIXME: what about additional skill levels used to influence the activation roll? Can they apply to this?
            roller
                .makeSuccessRoll(true, baseRequiredRoll, `Base ${skill.name} roll`)
                .addDice(3)
                .addNumber(
                    apPenalty,
                    `AP Penalty`,
                    `${item.activePoints} AP / ${divisor} -> ${apPenalty.signedString()}`,
                );

            const { succeeded: succeed, flavor: updatedFlavor } = await doSuccessRoll(
                actor,
                roller,
                `${item.name} activation`,
            );
            succeeded = succeed;
            flavor = updatedFlavor;
        } else {
            console.error(`${item.detailedName()} has unknown type ${activationRoll.type} for requires roll modifier`);
        }

        // PH: FIXME: resource usage string should be built in here as this is what's consuming. Create functions so it can be done in a fixed way.
        await generateSuccessChatCard(actor, speaker, flavor, roller, `Spent ${options.resourcesUsedDescription}`);

        return succeeded;
    });

    const results = await Promise.all(rollPromises);

    // One failure is an overall failure
    return results.reduce((accum, result) => {
        return accum && result;
    });
}

export function sectionalDefenseHeroValidation(modifier, item) {
    const validations = [];

    // There are two possibilities for sectional defense comments. There are presets that appear
    // in OPTIONID that have no good way to override. Assume that overrides appear in the COMMENTS.
    const sectionalDefenseRanges = validateSectionalComments(item, modifier);
    if (!sectionalDefenseRanges.valid) {
        if (sectionalDefenseRanges.reason === VALIDATE_SECTION_DEFENSE_ERROR_REASON.INVALID_RANGE) {
            validations.push({
                property: "COMMENTS",
                message: sectionalDefenseRanges.reason,
                example: "protects locations 4-6, 8, and 10-12",
                severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
                modifierID: modifier.ID,
            });
        } else if (sectionalDefenseRanges.reason !== VALIDATE_SECTION_DEFENSE_ERROR_REASON.NOT_DECLARATION) {
            console.error(`Unknown invalid sectional defense reason: ${sectionalDefenseRanges.reason}.`);
        }
    } else {
        // A sectional defense only makes sense for a defense
        if (!item.baseInfo?.behaviors.includes("defense")) {
            validations.push({
                property: undefined,
                message: `${item.detailedName()} should not have a sectional defense declaration as it is not a defensive power`,
                example: "Armor could be a sectional defense with locations 4-6, 8, and 10-12",
                severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
                modifierID: modifier.ID,
            });
        }

        // Check that the sectional defense description's limitation value roughly matches the limitation value taken
        const activationRollCumulativeProbability =
            modifier.XMLID === "SECTIONAL_DEFENSES"
                ? SECTIONAL_DEFENSES_OPTIONID_TO_PROBABILITY[modifier.OPTIONID]
                : DICE_CUMULATIVE_PROBABILITY[modifier.OPTIONID];
        const activationRollLimitationValueFromCumulativeProbability = limitationValueFromItemAndCumulativeProbability(
            item,
            activationRollCumulativeProbability,
        );

        const hitLocationsCumulativeProbability = summedHitProbability(
            sectionalDefenseRanges.sectionalDefenseLocationsSet,
        );
        const hitLocationLimitationValueFromCumulativeProbability = limitationValueFromItemAndCumulativeProbability(
            item,
            hitLocationsCumulativeProbability,
        );

        // Is this "cheating" and the limitation should cost more?
        if (
            hitLocationLimitationValueFromCumulativeProbability.limitationValue >
            activationRollLimitationValueFromCumulativeProbability.limitationValue
        ) {
            validations.push({
                property: undefined,
                message: `${item.detailedName()}'s sectional defense declaration cumulative probability is ${hitLocationsCumulativeProbability.toFixed(1)}%. This limitation should most likely be bought to ${hitLocationLimitationValueFromCumulativeProbability.shouldBeLessThanValue}- (${hitLocationLimitationValueFromCumulativeProbability.limitationValue})`,
                example: "A 14- activation roll should reflect a section defense declaration like: 3-5, 7-14, 16-18",
                severity: CONFIG.HERO.VALIDATION_SEVERITY.WARNING,
                modifierID: modifier.ID,
            });
        }
    }

    return validations;
}

// There are no validations we can perform for a correctly formed activation roll.
// However, 5e and 6e activation rolls can masquerade as sectional defenses so we need to
// check that possibility.
export function activationRollHeroValidation(modifier, item) {
    return sectionalDefenseHeroValidation(modifier, item);
}

function activationAttackRollHeroValidation(modifier, item) {
    const validations = [];

    // Should check if this actor type is capable of attack
    const actor = item.actor;
    if (actor?.type === "base2") {
        validations.push({
            message: `Bases do not make attack rolls.`,
            severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
            modifierID: modifier.ID,
        });
    }

    return validations;
}

function activationCharacteristicRollHeroValidation(activationRoll, modifier, item) {
    const validations = [];

    if (item.actor && !item.actor.hasCharacteristic(activationRoll.characteristicKey)) {
        validations.push({
            message: `Actor does not have the characteristic ${activationRoll.characteristicKey} to make the activation roll.`,
            severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
            modifierID: modifier.ID,
        });
    }

    return validations;
}

function activationLuckRollHeroValidation(activationRoll, modifier, item) {
    const validations = [];

    if (item.actor && activationRoll.items.length === 0) {
        validations.push({
            message: `Actor does not have a luck power to make the activation roll.`,
            severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
            modifierID: modifier.ID,
        });
    }

    // Should not have AP penalty on RSR against Luck (warn: just doesn't make sense and behaviour would be GM fiat)
    const luckRollHasApPenalty = findRollDivisor(modifier) !== 0;
    if (activationRoll.items.length > 0 && luckRollHasApPenalty) {
        validations.push({
            message: `RSR that are based on luck should not have a penalty based on Active Points.`,
            severity: CONFIG.HERO.VALIDATION_SEVERITY.WARNING,
            modifierID: modifier.ID,
        });
    }

    return validations;
}

function activationItemRollHeroValidation(activationRoll, modifier, item) {
    const validations = [];

    // Do we have items that match?
    activationRoll.requiredSkills.forEach((requiredSkill) => {
        if (requiredSkill.items.length === 0) {
            if (!requiredSkill.name?.trim()) {
                validations.push({
                    message: `The requires a skill roll limitation does not name a skill. Name one in Hero Designer so the roll can be automated.`,
                    severity: CONFIG.HERO.VALIDATION_SEVERITY.WARNING,
                    modifierID: modifier.ID,
                });
                return;
            }
            // "Does the actor have it" is unanswerable for unowned (compendium/world) items
            if (!item.actor) {
                return;
            }
            validations.push({
                message: `Actor does not have the ${requiredSkill.name} skill to make the activation roll.`,
                severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
                modifierID: modifier.ID,
            });
        } else {
            // Do we have a cost mismatch between how the power was built and how it should have been built?
            // PH: FIXME: has the same logic as evaluation that we only look at the first activeItem
            const activeItemXmlid = requiredSkill.activeItems[0].system.XMLID;
            const isActiveItemBackgroundSkill = !!BACKGROUND_SKILL_XMLID_TO_KEY[activeItemXmlid];
            if (requiredSkill.wantBackgroundSkill !== isActiveItemBackgroundSkill) {
                if (!requiredSkill.wantBackgroundSkill) {
                    validations.push({
                        message: `The requires a skill roll limitation was not bought using the background skill adder but ${requiredSkill.name} is a background skill and you have overpaid for ${activationRoll.name}.`,
                        severity: CONFIG.HERO.VALIDATION_SEVERITY.INFO,
                        modifierID: modifier.ID,
                    });
                } else {
                    validations.push({
                        message: `The requires a skill roll limtiation was bought using the background skill adder but the ${requiredSkill.name} is not a background skill and you have underpaid for ${activationRoll.name}.`,
                        severity: CONFIG.HERO.VALIDATION_SEVERITY.WARNING,
                        modifierID: modifier.ID,
                    });
                }
            }
        }
    });

    return validations;
}

export function requiresRollHeroValidation(modifier, item) {
    const validations = [];
    const activationRolls = getRollsForRar(item, modifier);

    // 5e 2 rolls requires GM permission
    if (activationRolls.length >= 2) {
        validations.push({
            message: `2 required skill rolls requires GM permission.`,
            severity: CONFIG.HERO.VALIDATION_SEVERITY.INFO,
            modifierID: modifier.ID,
        });
    }

    // Does the actor have the required powers/skills for the roll?
    for (const activationRoll of activationRolls) {
        // Only naked success rolls can be without a skill
        if (activationRoll.type === RSR_ROLL_TYPE.ITEM_ROLL) {
            validations.push(...activationItemRollHeroValidation(activationRoll, modifier, item));
        } else if (activationRoll.type === RSR_ROLL_TYPE.LUCK_ROLL) {
            validations.push(...activationLuckRollHeroValidation(activationRoll, modifier, item));
        } else if (activationRoll.type === RSR_ROLL_TYPE.CHARACTERISTIC_ROLL) {
            validations.push(...activationCharacteristicRollHeroValidation(activationRoll, modifier, item));
        } else if (activationRoll.type === RSR_ROLL_TYPE.ATTACK_ROLL) {
            validations.push(...activationAttackRollHeroValidation(activationRoll, modifier, item));
        } else if (activationRoll.type === RSR_ROLL_TYPE.ACTIVATION_ROLL) {
            validations.push(...activationRollHeroValidation(modifier, item));
        } else if (activationRoll.type === RSR_ROLL_TYPE.SECTIONAL_DEFENSES_ROLL) {
            validations.push(...sectionalDefenseHeroValidation(modifier, item));
        } else {
            console.error(`Unknown activation roll type ${activationRoll.type} for heroValidation.`);
        }
    }

    return validations;
}
