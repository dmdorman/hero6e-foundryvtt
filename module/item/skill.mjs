import { HEROSYS } from "../herosystem6e.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { userInteractiveVerifyOptionallyPromptThenSpendResources } from "./item-attack.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;

export function isAgilitySkill(item) {
    return item.system.CHARACTERISTIC === "DEX";
}

export function isBackgroundSkill(item) {
    switch (item.system.XMLID) {
        case "KNOWLEDGE_SKILL":
        case "LANGUAGES":
        case "PROFESSIONAL_SKILL":
        case "SCIENCE_SKILL":
        case "TRANSPORT_FAMILIARITY":
            return true;
    }

    return false;
}

export function isCombatSkill(item) {
    if (
        item.system.XMLID === "AUTOFIRE_SKILLS" || // Autofire Skills
        item.system.XMLID === "COMBAT_LEVELS" || // CSLs
        item.system.XMLID === "MENTAL_COMBAT_LEVELS" ||
        item.system.XMLID === "DEFENSE_MANEUVER" || // Defense maneuver
        item.system.XMLID === "MANEUVER" || // Martial Arts
        item.system.XMLID === "PENALTY_SKILL_LEVELS" || // PSLs
        item.system.XMLID === "RAPID_ATTACK_HTH" || // Rapid Attack
        item.system.XMLID === "RAPID_ATTACK_RANGED" ||
        item.system.XMLID === "TWO_WEAPON_FIGHTING_HTH" || // Two Weapon Fighting
        item.system.XMLID === "TWO_WEAPON_FIGHTING_RANGED" ||
        item.system.XMLID === "WEAPON_FAMILIARITY" // Weapon Familiarity
    ) {
        return true;
    }

    return false;
}

export function isIntellectSkill(item) {
    return item.system.CHARACTERISTIC === "INT";
}

export function isInteractionSkill(item) {
    return item.system.CHARACTERISTIC === "PRE";
}

async function _renderSkillForm(item, actor, stateData) {
    const token = actor.token;

    // Skill Levels (in most cases it will apply so check it)
    const skillLevels = actor.items.filter((o) => o.system.XMLID === "SKILL_LEVELS");
    for (const skill of skillLevels) {
        skill.system.checked = false;
        skill.system.active = true;

        // OPTION_ALIAS has name of skill
        if (skill.system.OPTION_ALIAS.toUpperCase().indexOf(item.name.toUpperCase()) > -1) {
            skill.system.checked = true;
        }

        // OPTION_ALIAS has XMLID of skill
        if (skill.system.OPTION_ALIAS.toUpperCase().indexOf(item.system.XMLID) > -1) {
            skill.system.checked = true;
        }

        // CHARACTERISTIC match
        if (skill.name.toUpperCase().indexOf(item.system.CHARACTERISTIC) > -1) {
            skill.system.checked = true;
        }

        // INTERACTION match (really PRE match)
        if (skill.name.toUpperCase().indexOf("INTERACTION") > -1 && item.system.CHARACTERISTIC === "PRE") {
            skill.system.checked = true;
        }
    }

    // Certain skills/talents/powers may help or hinder this roll
    const helperItems = [];
    if (isInteractionSkill(item)) {
        // Striking appearance may help
        const strikingAppearance = actor.items.filter((item) => item.system.XMLID === "STRIKING_APPEARANCE");
        const reputations = actor.items.filter((item) => item.system.XMLID === "REPUTATION");
        const interactionModifiers = strikingAppearance.concat(reputations);

        for (const interactionModifier of interactionModifiers) {
            interactionModifier.system.checked = false;
            interactionModifier.system.active = true;
            helperItems.push(interactionModifier);
        }
    }

    const skillMods = [
        ...skillLevels,
        ...helperItems,
        ...(item.system.XMLID === "PERCEPTION"
            ? actor.items.filter((o) => o.system.XMLID === "ENHANCEDPERCEPTION")
            : []),
    ];

    const templateData = {
        actor: actor.system,
        tokenId: token?.uuid || null,
        item: item,
        state: stateData,
        skillLevels,
        skillMods,
    };

    var path = `systems/${HEROSYS.module}/templates/pop-out/item-skill-card.hbs`;

    return await foundryVttRenderTemplate(path, templateData);
}

export async function createSkillPopOutFromItem(item, actor) {
    const content = await _renderSkillForm(item, actor, {});

    // Attack Card as a Pop Out
    let options = {
        width: 500,
    };

    return new Promise((resolve) => {
        const data = {
            title: "Roll Skill",
            content: content,
            buttons: {
                rollSkill: {
                    label: "Roll Skill",
                    callback: (target, event) => resolve(skillRoll(item, actor, target, event)),
                },
            },
            default: "rollSkill",
            close: () => resolve({}),
        };

        new Dialog(data, options).render(true);
    });
}

// PH: FIXME: Create a chat message for resource consumption.

// PH: FIXME: This will need some split apart into a "do I need to do a roll" and "do the skill roll".

async function skillRoll(item, actor, target) {
    const token = actor.token;
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    speaker.alias = actor.name;

    // Make sure there are enough resources and consume them
    const {
        error: resourceError,
        warning: resourceWarning,
        resourcesUsedDescription,
        resourcesUsedDescriptionRenderedRoll,
    } = await userInteractiveVerifyOptionallyPromptThenSpendResources(item, { noResourceUse: overrideCanAct });
    if (resourceError || resourceWarning) {
        const chatData = {
            author: game.user._id,
            content: `${item.name} ${resourceError || resourceWarning}`,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    const formElement = target[0].querySelector("form");
    const formData = new FormDataExtended(formElement)?.object;
    const skillRoller = new HeroRoller().addDice(3);

    // SkillMods
    for (const [modKey, modValue] of Object.entries(formData)) {
        const modShortKey = modKey.split(".")[0];
        if (modShortKey.length === 16) {
            const modItem = actor.items.find((o) => o.id === modShortKey);
            if (modItem) {
                await modItem.update({ "system.checked": modValue });
            }
        }
    }

    //item.updateRoll();

    let tags = foundry.utils.deepClone(item.system.tags);

    // Build success requirement from the base tags
    let successValue = 0;
    for (const tag of tags) {
        successValue = successValue + tag.value;
    }

    // Skill Levels (back out the ones that are unchecked)
    const skillLevelInputsNotChecked = formElement.querySelectorAll("INPUT:not(:checked)");
    for (const skillLevelInput of skillLevelInputsNotChecked) {
        const skillModItem = actor.items.get(skillLevelInput.dataset.itemId);
        if (!skillModItem) {
            continue;
        }

        const tag = tags.find((o) => o.itemId === skillModItem.id);
        if (tag) {
            successValue -= tag.value;
            tags = tags.filter((t) => t.itemId !== tag.itemId);
        } else {
            console.log(`Unable to find tag for ${skillModItem.name}`);
        }
    }

    // Skill Levels (additive)
    const skillLevelInputsChecked = formElement.querySelectorAll("INPUT:checked");
    for (const skillLevelInput of skillLevelInputsChecked) {
        const skillModItem = actor.items.get(skillLevelInput.dataset.itemId);
        if (!skillModItem) {
            continue;
        }

        // ENHANCEDPERCEPTION is already included in item.updateRoll()
        // and we just backed them out above  (skillLevelInputsNotChecked)
        if (skillModItem.system.XMLID === "ENHANCEDPERCEPTION") {
            continue;
        }

        let modifier = parseInt(skillModItem.system.LEVELS || 0);
        if (skillModItem.system.XMLID === "REPUTATION") {
            if (skillModItem.type === "disadvantage") {
                const recognizedOptionId = (skillModItem.system.ADDER || []).find(
                    (adder) => adder.XMLID === "RECOGNIZED",
                )?.OPTIONID;

                if (recognizedOptionId === "SOMETIMES") {
                    modifier = -1;
                } else if (recognizedOptionId === "FREQUENTLY") {
                    modifier = -2;
                } else if (recognizedOptionId === "ALWAYS") {
                    modifier = -3;
                } else {
                    console.error(`Unrecognized REPUTATION (disad) OPTIONID ${recognizedOptionId}`);
                    modifier = 0;
                }
            }
        }
        tags.push({
            value: modifier,
            name: skillModItem.name,
            title: skillModItem.system.description,
        });
        successValue += modifier;
    }

    // Roll Modifier, from form, which can be negative or positive.
    const modValue = parseInt(formElement.mod.value || 0);
    if (modValue !== 0) {
        tags.push({ value: modValue, name: "Roll Modifier", title: `User Entered Roll Modifier ${modValue}` });
        successValue = successValue + modValue;
    }

    await skillRoller.makeSuccessRoll(true, successValue).roll();
    const succeeded = skillRoller.getSuccess();
    const autoSuccess = skillRoller.getAutoSuccess();
    const total = skillRoller.getSuccessTotal();
    const margin = successValue - total;

    let disadFlavor = "";
    switch (item.system.XMLID) {
        case "PSYCHOLOGICALLIMITATION":
            disadFlavor =
                "Success on this roll typically means that the character must follow the psychological complication for at least one phase, after which the character is free to act against this psychological complication. Failure on this roll means that the character must continue to follow this psychological complication.";
            break;
        case "SOCIALLIMITATION":
            disadFlavor =
                "Success on this roll typically means the character is required to react to (or is affected by) the social complication.";
            break;
    }

    const flavor = `${item.name.toUpperCase()} (${successValue}-) roll ${succeeded ? "succeeded" : "failed"} by ${
        autoSuccess === undefined ? `${Math.abs(margin)}. ` : `rolling ${total}. `
    } ${disadFlavor}`;
    const rollHtml = await skillRoller.render(flavor);

    // render card
    const cardData = {
        tags: tags.map((tag) => {
            return { ...tag, value: tag.value.signedStringHero() };
        }),
        rolls: skillRoller.rawRolls(),
        renderedRoll: rollHtml,
        resourcesUsedDescription: resourcesUsedDescription
            ? `Spent ${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`
            : "",
        user: game.user._id,
        speaker: speaker,
    };
    const template = `systems/${HEROSYS.module}/templates/chat/skill-success-roll-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        rolls: skillRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    return ChatMessage.create(chatData);
}
