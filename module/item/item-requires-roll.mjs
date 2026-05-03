import { HEROSYS } from "../herosystem6e.mjs";

import { overrideCanAct } from "../settings/settings-helpers.mjs";

import { calculateDicePartsForItem } from "../utility/damage.mjs";
import { HeroRoll, HeroRoller } from "../utility/dice.mjs";
import { tokenEducatedGuess, whisperUserTargetsForActor } from "../utility/util.mjs";

const backgroundSkillKeys = Object.freeze({
    // matches RaR OPTION to XMLID
    KS: "KNOWLEDGE_SKILL",
    SS: "SCIENCE_SKILL",
    PS: "PROFESSIONAL_SKILL",
});

function filterSkillRollItems(item) {
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

function findRollValue(rar) {
    const value = parseInt(rar.OPTION, 10);
    return value;
}

function matchRequiredSkillRoll(o, rar, rarOptionIsBackground) {
    const rarAliasDisplay = rar.ALIAS?.toUpperCase() || ""; // From the "Display" field. ex: "Requires A Magic Roll"
    // OPTION_ALIAS is different in 5e: it is entered in the Type field
    const rarOptionsAlias = rar.OPTION_ALIAS?.toUpperCase() || ""; // From the "Options" field. ex: "Magic Roll, -1 per 5 Active Points modifier"
    const rarComments = rar.COMMENTS?.toUpperCase() || ""; // From Comments, begins blank, common use would be to enter just the skill name
    const rarRollAlias = rar.ROLLALIAS?.toUpperCase() || ""; // From the 5e "Roll" field. ex: "STR", "Acrobatics"

    const rar_AliasDisplay = rarAliasDisplay.replaceAll(" ", "_");
    const rar_OptionsAlias = rarOptionsAlias.replaceAll(" ", "_");
    const rar_Comments = rarComments.replaceAll(" ", "_");
    const rar_RollAlias = rarRollAlias.replaceAll(" ", "_");

    // TODO
    // it might be worthwhile to also try with underscores in the XMLID '_' replaced with spaces ' ' to match better
    // or vice versa, put underscores in the stable RaR strings and search with underscores present
    // this is IN ADDITION to what's here now; dont replace this
    const xmlIdMatch =
        rarAliasDisplay.includes(o.system.XMLID) ||
        rarOptionsAlias.includes(o.system.XMLID) ||
        rarRollAlias.includes(o.system.XMLID) ||
        rarComments.includes(o.system.XMLID);
    if (xmlIdMatch) {
        return true;
    }

    const nameUpper = o.name?.toUpperCase() ?? "";
    const nameMatch =
        nameUpper &&
        rarOptionIsBackground !== nameUpper &&
        (rarAliasDisplay.includes(nameUpper) ||
            rarOptionsAlias.includes(nameUpper) ||
            rarRollAlias.includes(nameUpper) ||
            rarComments.includes(nameUpper));
    if (nameMatch) {
        return true;
    }

    const aliasUpper = o.system.ALIAS?.toUpperCase() ?? "";
    const aliasMatch =
        aliasUpper &&
        rarOptionIsBackground !== aliasUpper &&
        (rarAliasDisplay.includes(aliasUpper) ||
            rarOptionsAlias.includes(aliasUpper) ||
            rarRollAlias.includes(aliasUpper) ||
            rarComments.includes(aliasUpper));
    if (aliasMatch) {
        return true;
    }

    // Some skills have an underscore in them; the user might not have the name matched exactly
    // so if there is an underscore (as in SLEIGHT_OF_HAND), we check for that here
    const xml_Id_Match =
        /_/.test(o.system.XMLID) &&
        (rar_AliasDisplay.includes(o.system.XMLID) ||
            rar_OptionsAlias.includes(o.system.XMLID) ||
            rar_RollAlias.includes(o.system.XMLID) ||
            rar_Comments.includes(o.system.XMLID));
    if (xml_Id_Match) {
        return true;
    }

    // TODO check 'Text'?
    // TODO check 'Type'?
    return false;
}

function isBackgroundSkillType(rar, rarOptionIsBackground) {
    return rar.OPTIONID === "BASICRSR" || Object.keys(backgroundSkillKeys).includes(rarOptionIsBackground);
}

function matchBackgroundSkillType(o, rar, rarOptionIsBackground) {
    return rar.OPTIONID === "BASICRSR" || backgroundSkillKeys[rarOptionIsBackground] === o.system.XMLID;
}

function matchBackgroundSkillRoll(o, rar, item, rarOptionIsBackground) {
    if (!matchBackgroundSkillType(o, rar, rarOptionIsBackground)) {
        return false;
    }

    const rarAliasDisplay = rar.ALIAS?.toUpperCase() || "";
    const rarOptionsAlias = rar.OPTION_ALIAS?.toUpperCase() || "";
    const rarComments = rar.COMMENTS?.toUpperCase() || "";
    const inputUpper = o.system.INPUT?.toUpperCase() ?? "";
    const inputMatch =
        inputUpper &&
        rarOptionIsBackground !== inputUpper &&
        (rarAliasDisplay.includes(inputUpper) ||
            rarOptionsAlias.includes(inputUpper) ||
            rarComments.includes(inputUpper));
    if (inputMatch) {
        return true;
    }

    return matchRequiredSkillRoll(o, rar, rarOptionIsBackground);
}

function findSkillRoll(rar, item, rarOptionIsBackground) {
    if (rar.OPTIONID === "PER" || rar.ROLLALIAS === "PER") {
        return item.actor.items.find((o) => o.system.XMLID === "PERCEPTION");
    } else if (rar.OPTIONID.includes("LUCK")) {
        return item.actor.items.find((o) => o.system.XMLID === "LUCK");
    } else if (isBackgroundSkillType(rar, rarOptionIsBackground)) {
        return item.actor.items.find(
            (o) => filterSkillRollItems(o) && matchBackgroundSkillRoll(o, rar, item, rarOptionIsBackground),
        );
    }

    return item.actor.items.find(
        (o) => filterSkillRollItems(o) && matchRequiredSkillRoll(o, rar, rarOptionIsBackground),
    );
}

function findRollDivisor(rar) {
    // item.activePoints is a number
    if (rar.OPTIONID.includes("1PER5")) {
        return 5;
    } else if (rar.OPTIONID.includes("1PER20")) {
        return 20;
    }

    const divisorOption = rar.ADDER.find((o) => {
        return o.XMLID === "MINUS1PER20" || o.XMLID === "MINUS1PER5";
    });

    if (divisorOption?.XMLID === "MINUS1PER20") {
        return 20;
    } else if (divisorOption?.XMLID === "MINUS1PER5") {
        return 5;
    }
    // activation rolls have no minuses due to active points
    else if (!isNaN(parseInt(rar.OPTION, 10))) {
        return NaN;
    }

    return 10;
}

function findRollMinus(rar, item) {
    const divisor = findRollDivisor(rar);
    if (isNaN(divisor)) {
        return 0;
    }

    return Math.floor(parseInt(item.activePoints) / divisor);
}

function getRequiredCharacteristicKey(rar, item) {
    // PH: FIXME: k is a terrible parameter name
    const characteristicKeys = Object.keys(item.actor.system.characteristics).filter(
        (k) => item.actor.system.characteristics[k].roll != null,
    );
    const rarDisplayMaybeHasCharKey = rar.ALIAS?.toLowerCase() || "";
    const rarOptionMaybeHasCharKey = rar.OPTION_ALIAS?.toLowerCase() || "";
    const rarCommentMaybeHasCharKey = rar.COMMENTS?.toLowerCase() || ""; // pre or presence, STR or Strength
    const rarRollAliasMaybeHasCharKey = rar.ROLLALIAS?.toLowerCase() || "";
    // The \b ensures the match is at the start of a word
    const characteristicKeyRegex = characteristicKeys.reduce((accumulator, currentKey) => {
        // For each key, create the RegExp object
        const regex = new RegExp(`\\b${currentKey}`, "i");
        accumulator[currentKey] = regex;
        return accumulator;
    }, {});

    // exact match in comments
    if (characteristicKeys.includes(rarCommentMaybeHasCharKey)) {
        // finds pre, not presence
        return rarCommentMaybeHasCharKey;
    }

    // comment would be Strength, Intelligence, Presence etc.
    const matchedKeyInComment = characteristicKeys.find((key) =>
        characteristicKeyRegex[key].test(rarCommentMaybeHasCharKey),
    );
    if (matchedKeyInComment) {
        return matchedKeyInComment;
    }

    const matchedKeyInName = characteristicKeys.find((key) =>
        characteristicKeyRegex[key].test(rarDisplayMaybeHasCharKey),
    );
    if (matchedKeyInName) {
        return matchedKeyInName;
    }

    const matchedKeyInRollAlias = characteristicKeys.find((key) =>
        characteristicKeyRegex[key].test(rarRollAliasMaybeHasCharKey),
    );
    if (matchedKeyInRollAlias) {
        return matchedKeyInRollAlias;
    }

    const matchedKeyInOption = characteristicKeys.find((key) =>
        characteristicKeyRegex[key].test(rarOptionMaybeHasCharKey),
    );
    return matchedKeyInOption ?? "";
}

export const VALIDATE_SECTION_DEFENSE_ERROR_REASON = Object.freeze({
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
export function validateSectionalComments(item, potentialSectionalComment) {
    // Are there comments that could be sectional instructions?
    if (!potentialSectionalComment) {
        return { valid: false, reason: VALIDATE_SECTION_DEFENSE_ERROR_REASON.NO_COMMENT };
    }

    // Are there sectional instructions that we understand?
    const sectionalRangeComment = potentialSectionalComment.trim().match(/^locations? (.*)$/i);
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
 *
 * @param {Set} sectionalDefenseLocationsSet - A set of all hit locations which provide a defense
 * @param {number} hitLocationNum
 *
 * @returns {boolean} - boolean value indicating the hitLocationNum is within the sectionalDefenseRanges
 */
function doSectionalDefensesApply(sectionalDefenseLocationsSet, hitLocationNum) {
    // Low shots (special hit location) can generate a hit location of 19. This is supposed to be treated as
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
 * @returns {Boolean} - success
 *
 * The RaR is the Requires A Roll including Activation roll from 5e.
 * If the Activation roll is a simple throw then it is quite easily done.
 * If it is connected to a Skill or Characteristic then the correct roll must be discovered.
 * There are several places a player might put information to tie the RaR to an existing skill/characteristic.
 *
 * 1) ALIAS/Display: RaR has a Display in HD which is ALIAS here: an editable field which users are likely to change to indicate their selected roll, as it shows naturally on the sheet.
 * 2) OPTION/Options: the Options field in RaR that can also be edited.
 * 2--a ) OPTIONID/Options: the same drop-down gives and uneditable flag that indicates things like
 *    - Activation roll
 *    - Skill roll
 *    - Characteristic roll
 *    - PER roll
 *    - KS, PS, SS roll (Background skills)
 *    - and the difficulty -1/10 (default), -1/5 (hard), -1/20 (easy)
 * 3) COMMENTS/Comments: is an editable field that users might use to indicate the roll required.
 * 4) ROLLALIAS: is a 5e only editable field that users might use to indicate the roll required.
 *
 * the Skills to be matched will be generally be referenced as 'o' as they are considered in anonymous find functions.
 * ex: filterSkillRollItems which filters out skill items from skill enhancers and skill level bonuses.
 * Skills that are to be matched will be 'rollable' skills.
 * Most skills are only taken once, the user is warned if they purchase multiple copies of the same skill.
 * One exception is the POWERSKILL which is expected to be customized per power and purchased multiple times.
 * Likewise with the Background skills (KS, PS, SS) are a special case as they can be purchased multiple times with different INPUTs.
 * The Background skills are only matched when the RaR is looking for one of those specifically.
 * The RaR will have an OPTIONID of KS, PS, or SS which must match the skill's XMLID.
 *
 * 1) o.name/Name
 * 2) o.system.ALIAS/Display
 * 3) o.system.XMLID/XMLID
 * 4) o.system.INPUT/(Science/Knowledge/ (Background skills only)
 *
 *
 */
export async function isActivatedForThisUse(item, options) {
    // PH: FIXME: options to be removed.
    return isActivatedForThisUseInternal(item, HeroRoll, options);
}

export async function isActivatedForThisUse_TestingOnly(item, rollClass, options) {
    return isActivatedForThisUseInternal(item, rollClass, options);
}

async function isActivatedForThisUseInternal(item, rollClass, options = {}) {
    // if(!item.isActive) {
    //     return false;
    // }

    const rar = item.modifiers.find((o) => o.XMLID === "REQUIRESASKILLROLL" || o.XMLID === "ACTIVATIONROLL");
    if (!rar) {
        return true;
    }

    const actor = item.actor;
    const token = options.token ?? tokenEducatedGuess({ actor });
    const speaker = ChatMessage.getSpeaker({ actor, token });

    // Sectional Defense overrides a standard activation roll.
    const activationRoll =
        item.modifiers.find((o) => o.XMLID === "ACTIVATIONROLL") ?? item.findModsByXmlid("EVERYPHASE")?.parent;
    if (options.hitLocationNum && activationRoll) {
        const { valid: validSectionalComment, sectionalDefenseLocationsSet } = validateSectionalComments(
            item,
            activationRoll.COMMENTS,
        );

        // Do we have valid ranges defined and are hit locations turned on? If not, then sectional defense don't make sense to consider.
        if (validSectionalComment && game.settings.get(HEROSYS.module, "hit locations")) {
            const sectionalDefenseApply = doSectionalDefensesApply(
                sectionalDefenseLocationsSet,
                options.hitLocationNum,
            );

            // PH: FIXME: The chat message should not be burried down in here.
            // Success or failure message
            const chatData = {
                style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                author: game.user._id,
                content: `The sectional defense from <b>${item.name}</b> ${sectionalDefenseApply ? "successfully applied" : "failed to apply"}`,
                speaker: speaker,
                whisper: whisperUserTargetsForActor(actor),
            };
            await ChatMessage.create(chatData);

            return sectionalDefenseApply;
        }
    }

    // FIXME: This doesn't support 2 RAR. See https://github.com/dmdorman/hero6e-foundryvtt/issues/3873

    // todo why OPTION and not OPTIONID to look for background skills (OPTIONID can't be altered by user)
    // PH: FIXME: This doesn't look right as it can and should be modified in the HDC. Also variable name indicates boolean and it's not
    const rarOptionIsBackground = rar.OPTION.substring(0, 2).toUpperCase();

    const charKey = getRequiredCharacteristicKey(rar, item);

    // if the RaR is an Activation roll, then we have the value we need
    let value = findRollValue(rar);
    let skill = undefined;
    let char = undefined;
    if (isNaN(value)) {
        if (rar.OPTIONID !== "CHAR") {
            skill = findSkillRoll(rar, item, rarOptionIsBackground);
        }
        if (!skill) {
            char = item.actor.system.characteristics[charKey];
            if (char) {
                // if we weren't supposed to look for a char but we had to find one the rar is not constructed right
                // 5e BASICRSR is Skills and Characteristics
                if (rar.OPTIONID !== "CHAR" && rar.OPTIONID !== "BASICRSR") {
                    ui.notifications.warn(
                        `${item.actor.name} has a power ${item.name}, which is incorrectly built.  Skill Roll for ${charKey.toUpperCase()} should be a Characteristic Roll.`,
                    );
                }
            } else {
                // could not find a skill or characteristic to match
                const typeOfRollRequired = rar.OPTIONID !== "CHAR" ? "known skill" : "characteristic";
                ui.notifications.warn(
                    `${item.actor.name} has a power ${item.name}. Expecting '${rar.OPTION} roll', where ${rar.OPTION} is the name of a ${typeOfRollRequired} that can be rolled.
                    <br>Put the name of the ${typeOfRollRequired} into the Options or Comments of the Requires A Roll modifier for the best results.`,
                );
                if (!overrideCanAct) {
                    const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;

                    const chatData = {
                        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                        author: game.user._id,
                        content:
                            `<div class="dice-roll"><div class="dice-flavor">${item.name} (${item.system.OPTION_ALIAS || item.system.COMMENTS}) activation failed because the appropriate skill is not owned.</div></div>` +
                            `\nPress <b>${overrideKeyText}</b> to override.`,
                        speaker: speaker,
                    };

                    await ChatMessage.create(chatData);

                    return false;
                }
            }
        }
    }
    // TODO: for refactor the above should return: skill, char, value, rollModifier so that the output can be constructed.

    let succeeded = false;
    let flavor;
    let roller;
    const usefulAlias = rarOptionIsBackground !== skill?.system.ALIAS ? skill?.system.ALIAS : "";
    const skillName = skill?.system.INPUT || usefulAlias || skill?.name;
    const charName = charKey?.toUpperCase();
    const activationFrom = skill ? `${skillName}:` : char ? `${charName}:` : "";
    if (skill?.system.XMLID === "LUCK") {
        const { diceParts } = calculateDicePartsForItem(skill, {});

        roller = new HeroRoller({}, rollClass)
            .modifyTo5e(skill.actor.system.is5e)
            .makeLuckRoll()
            .addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0);

        await roller.roll();

        const luckTotal = roller.getLuckTotal();
        if (rar.OPTIONID === "ONELUCK") {
            succeeded = luckTotal >= 1;
        } else if (rar.OPTIONID === "TWOLUCK") {
            succeeded = luckTotal >= 2;
        } else if (rar.OPTIONID === "THREELUCK") {
            succeeded = luckTotal >= 3;
        }

        flavor = `${item.name} (${activationFrom} rolled ${luckTotal} points) activation ${succeeded ? "succeeded" : "failed"} `;
    } else {
        if (skill) {
            // skill.system.roll is a string
            value = parseInt(skill.system.roll);
            if (isNaN(value)) {
                // sumthing wrong with the skill?
                value = 11;
            }
        } else if (char) {
            // a char.roll is an int
            value = char.roll;
        } else if (!value) {
            ui.notifications.warn(`${item.actor.name} has a power ${item.name}. ${rar.OPTION_ALIAS} is not supported.`);
            // Try to continue
            value = 11;
        }
        const minus = findRollMinus(rar, item);
        value -= minus;
        const successValue = parseInt(value);

        //TODO what about additional skill levels used to influence the activation roll?
        roller = new HeroRoller({}, rollClass).makeSuccessRoll(true, successValue).addDice(3);

        await roller.roll();

        succeeded = roller.getSuccess();
        const autoSuccess = roller.getAutoSuccess();
        const total = roller.getSuccessTotal();
        const margin = successValue - total;

        const targetRoll = skill ? skill.system.roll : char ? char.roll : `${rar.OPTION_ALIAS}:${value}-`;
        const divisor = findRollDivisor(rar);
        const penalty = isNaN(divisor) ? "" : `, -1 per ${divisor} active points`;

        const penaltyString = penalty ? `${penalty}: -${minus}` : "";

        flavor = `${item.name} (${activationFrom}${targetRoll}${penaltyString}) activation ${
            succeeded ? "succeeded" : "failed"
        } by ${autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`}`;
    }

    let cardHtml = await roller.render(flavor);

    // FORCE success
    if (!succeeded && overrideCanAct) {
        const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
        ui.notifications.info(`${item.actor.name} succeeded roll because override key.`);
        succeeded = true;
        cardHtml += `<p>Succeeded roll because ${game.user.name} used <b>${overrideKeyText}</b> key to override.</p>`;
    }

    if (!succeeded && options.resourcesUsedDescription) {
        cardHtml += `Spent ${options.resourcesUsedDescription}.`;
    }

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: roller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);

    if (!succeeded && options.showUi) {
        ui.notifications.warn(cardHtml);
    }

    return succeeded;
}
