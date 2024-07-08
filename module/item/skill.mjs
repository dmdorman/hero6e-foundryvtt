import { HEROSYS } from "../herosystem6e.mjs";
import { HeroRoller } from "../utility/dice.mjs";

async function _renderSkillForm(item, actor, stateData) {
    const token = actor.token;

    // Skill Levels (in most cases it will apply so check it)
    let skillLevels = Array.from(actor.items.filter((o) => o.system.XMLID === "SKILL_LEVELS"));
    for (let s of skillLevels) {
        s.system.checked = false;

        // OPTION_ALIAS has name of skill
        if (s.system.OPTION_ALIAS.toUpperCase().indexOf(item.name.toUpperCase()) > -1) {
            s.system.checked = true;
        }

        // OPTION_ALIAS has XMLID of skill
        if (s.system.OPTION_ALIAS.toUpperCase().indexOf(item.system.XMLID) > -1) {
            s.system.checked = true;
        }

        // CHARACTERISTIC match
        if (s.name.toUpperCase().indexOf(item.system.CHARACTERISTIC) > -1) {
            s.system.checked = true;
        }

        // INTERACTION match (really PRE match)
        if (s.name.toUpperCase().indexOf("INTERACTION") > -1 && item.system.CHARACTERISTIC === "PRE") {
            s.system.checked = true;
        }
    }

    const templateData = {
        actor: actor.system,
        tokenId: token?.uuid || null,
        item: item,
        state: stateData,
        skillLevels,
    };

    var path = `systems/${HEROSYS.module}/templates/pop-out/item-skill-card.hbs`;

    return await renderTemplate(path, templateData);
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
                    callback: (html) => resolve(skillRoll(item, actor, html)),
                },
            },
            default: "rollSkill",
            close: () => resolve({}),
        };

        new Dialog(data, options).render(true);
    });
}

async function skillRoll(item, actor, html) {
    const token = actor.token;
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    speaker.alias = actor.name;

    // Charges?
    const charges = item.findModsByXmlid("CHARGES");
    if (charges) {
        if (!item.system.charges?.value || parseInt(item.system.charges?.value) <= 0) {
            const chatData = {
                user: game.user._id,
                content: `${item.name} has no charges remaining.`,
                speaker: speaker,
            };

            await ChatMessage.create(chatData);
            return;
        }
    }

    // Cost END?
    const endUse = parseInt(item.system.end);
    const costEnd = item.findModsByXmlid("COSTSEND");
    if (costEnd && endUse && item.actor) {
        const newEnd = parseInt(item.actor.system.characteristics.end.value) - endUse;

        if (newEnd >= 0) {
            await item.actor.update({
                "system.characteristics.end.value": newEnd,
            });
        } else {
            const chatData = {
                user: game.user._id,
                content: `Insufficient END to use ${item.name}.`,
                speaker: speaker,
            };

            await ChatMessage.create(chatData);
            return;
        }
    }

    const form = html[0].querySelector("form");
    const skillRoller = new HeroRoller().addDice(3);

    const tags = foundry.utils.deepClone(item.system.tags);

    // Build success requirement from the base tags
    let successValue = 0;
    for (const tag of tags) {
        successValue = successValue + tag.value;
    }

    // Skill Levels
    const skillLevelInputs = form.querySelectorAll("INPUT:checked");
    for (const skillLevelInput of skillLevelInputs) {
        const skillLevel = actor.items.get(skillLevelInput.id);
        const level = parseInt(skillLevel.system.LEVELS || 0);
        if (level > 0) {
            tags.push({
                value: level,
                name: skillLevel.name,
                title: skillLevel.system.description,
            });
            successValue = successValue + level;
        }
    }

    // Roll Modifier, from form, which can be negative or positive.
    const modValue = parseInt(form.mod.value || 0);
    if (modValue !== 0) {
        tags.push({ value: modValue, name: "Roll Mod" });
        successValue = successValue + modValue;
    }

    await skillRoller.makeSuccessRoll(true, successValue).roll();
    let succeeded = skillRoller.getSuccess();
    const autoSuccess = skillRoller.getAutoSuccess();
    const total = skillRoller.getSuccessTotal();
    const margin = successValue - total;

    const flavor = `${item.name.toUpperCase()} (${successValue}-) roll ${succeeded ? "succeeded" : "failed"} by ${
        autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`
    }`;
    let rollHtml = await skillRoller.render(flavor);

    // Charges
    if (charges) {
        await item.update({
            "system.charges.value": parseInt(item.system.charges.value) - 1,
        });
        await item._postUpload();
        rollHtml += `<p>Spent 1 charge.</p>`;
    }

    // END
    if (costEnd && endUse && item.actor) {
        rollHtml += `<p>Spent ${endUse} END.</p>`;
    }

    // render card
    const cardData = {
        tags: tags.map((tag) => {
            return { ...tag, value: tag.value.signedString() };
        }),
        rolls: skillRoller.rawRolls(),
        renderedRoll: rollHtml,
        user: game.user._id,
        speaker: speaker,
    };
    const template = `systems/${HEROSYS.module}/templates/chat/skill-success-roll-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);

    const chatData = {
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: skillRoller.rawRolls(),
        user: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
}
