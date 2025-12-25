import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { RoundFavorPlayerUp } from "./round.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;

export function createDefenseProfile(actorItemDefense, attackItem, value, options = {}) {
    let itemNameExpanded =
        options.shortDesc ||
        `${actorItemDefense?.name}${
            actorItemDefense.name
                .replace(/ /g, "")
                .match(new RegExp(actorItemDefense?.system.XMLID.replace(/_/g, ""), "i"))
                ? ""
                : ` [${actorItemDefense?.system.XMLID}]`
        }`;
    if (itemNameExpanded.replace(/ /g, "").toUpperCase() === options.attackDefenseVs.toUpperCase()) {
        itemNameExpanded = `${options.attackDefenseVs} ${actorItemDefense.type}`;
    }

    // Some defense (like INCREASEDENSITY) provide more than 1 type of defense (PD/ED + KB), but should pass in "KB" for attackDefenseVs, so perhaps an array is not necessary.
    const defenseProfileArray = [];

    if (value) {
        defenseProfileArray.push({
            name:
                options.name ||
                `${options.resistant ? `r` : ""}${options.attackDefenseVs}${
                    options.hardened ? `h${options.hardened}` : ""
                }${options.impenetrable ? `i${options.impenetrable}` : ""}`,
            value: value,
            valueText: options.operation === "pct" ? `${value}%` : null,
            title:
                options.title ||
                `${itemNameExpanded}${options.resistant ? `\nResistant: ${options.resistant}` : ""}${
                    options.hardened ? `\nHardened x${options.hardened}` : ""
                }${options.impenetrable ? `\nImpenetrable x${options.impenetrable}` : ""}`,
            shortDesc: itemNameExpanded,
            operation: options.operation || "add",
            options: { ...options, knockback: null },
            defenseItemId: actorItemDefense?.id,
            attackItemId: attackItem?.id,
        });
    }

    return defenseProfileArray;
}

export function getItemDefenseVsAttack(actorItemDefense, attackItem, options = {}) {
    if (!actorItemDefense) {
        console.error("Missing actorItemDefense");
        return {};
    }
    if (!attackItem) {
        console.error("Missing attackItem");
        return {};
    }

    const newOptions = foundry.utils.deepClone(options);

    newOptions.attackDefenseVs = newOptions.attackDefenseVs || attackItem.attackDefenseVs;
    //newOptions.piercing = attackItem.findModsByXmlid("ARMORPIERCING") || 0;
    //newOptions.penetrating = attackItem.findModsByXmlid("PENETRATING") || 0;
    newOptions.impenetrable = parseInt(actorItemDefense.findModsByXmlid("IMPENETRABLE")?.LEVELS) || 0;
    newOptions.hardened = parseInt(actorItemDefense.findModsByXmlid("HARDENED")?.LEVELS) || 0;
    newOptions.resistant = actorItemDefense.findModsByXmlid("RESISTANT") ? true : false;
    newOptions.knockback = 0;

    if (typeof actorItemDefense.baseInfo?.defenseTagVsAttack === "function") {
        return actorItemDefense.baseInfo?.defenseTagVsAttack(actorItemDefense, attackItem, newOptions);
    }

    // Senses are not attacks and thus don't have a valid defenseVsAttack
    if (actorItemDefense.baseInfo?.type.includes("sense")) {
        return null;
    }

    // 5e Missile Deflection functions similar to BLOCK and thus technically no defense
    if (actorItemDefense.system.XMLID === "MISSILEDEFLECTION") {
        return null;
    }

    // Defense vs a Defense
    if (actorItemDefense.baseInfo?.behaviors.includes("defense") || actorItemDefense.system.XMLID) {
        return null;
    }

    console.error(
        `Unable to determine defenseTagVsAttack for ${actorItemDefense.actor.name}::${actorItemDefense.system.XMLID}`,
    );

    return null;
}

/**
 *
 * @param {HeroSystem6eActor} targetActor
 * @param {HeroSystem6eItem} attackItem
 * @param {Object} options
 * @param {String} [options.attackDefenseVs] - optional override to attackItem's attackDefenseVs result
 * @returns
 */
export function getActorDefensesVsAttack(targetActor, attackItem, options = {}) {
    const actorDefenses = {
        defenseTotalValue: 0,
        defenseValue: 0,
        resistantValue: 0,
        impenetrableValue: 0,
        damageReductionValue: 0,
        damageNegationValue: 0,
        knockbackResistanceValue: 0,
        defenseTags: [],
        targetActor,
        attackItem,
        options,
    };

    if (!targetActor) {
        console.error("Missing targetActor");
        return actorDefenses;
    }
    if (!attackItem) {
        console.error("Missing attackItem");
        return actorDefenses;
    }

    const attackDefenseVs = options.attackDefenseVs || attackItem.attackDefenseVs;
    options = { ...options, attackDefenseVs };

    const penetrating = parseInt(attackItem.findModsByXmlid("PENETRATING")?.LEVELS) || 0;
    const armorPiercing = parseInt(attackItem.findModsByXmlid("ARMORPIERCING")?.LEVELS) || 0;

    // Basic characteristics (PD & ED)
    if (
        (targetActor.system.characteristics[attackDefenseVs.toLowerCase()]?.value || 0) > 0 &&
        !(options?.ignoreDefenseIds || []).includes(attackDefenseVs.toUpperCase())
    ) {
        let value = targetActor.system.characteristics[attackDefenseVs.toLowerCase()].value;
        const newOptions = foundry.utils.deepClone(options);

        // back out any Active Effects
        for (const ae of targetActor.appliedEffects) {
            for (const change of ae.changes.filter(
                (o) => o.key === `system.characteristics.${attackDefenseVs.toLowerCase()}.max`,
            )) {
                value -= parseInt(change.value) || 0;

                if (value < 0) {
                    console.warn(
                        `${targetActor.name}: The ${ae.name} effect has reduced ${attackDefenseVs.toUpperCase()} below 0.`,
                        targetActor,
                        attackItem,
                        options,
                        ae,
                    );
                }

                // Remove RESISTANT ADVANTAGE value
                if (options.resistantAdvantage) {
                    actorDefenses.defenseTags = [
                        ...actorDefenses.defenseTags,
                        ...createDefenseProfile(ae, attackItem, parseInt(-change.value), {
                            ...newOptions,
                            title: ae.flags?.[game.system.id]?.XMLID,
                            shortDesc: `${ae.flags?.[game.system.id]?.XMLID}: ${ae.name}`,
                        }),
                    ];
                }

                // Add back in temporary effects (such as AID) as a separate tag
                if (ae.isTemporary) {
                    actorDefenses.defenseTags = [
                        ...actorDefenses.defenseTags,
                        ...createDefenseProfile(ae, attackItem, parseInt(change.value), {
                            ...newOptions,
                            title: ae.flags?.[game.system.id]?.XMLID,
                            shortDesc: `${ae.flags?.[game.system.id]?.XMLID}: ${ae.name}`,
                        }),
                    ];
                }
            }
        }
        // back out 5e DAMAGERESISTANCE
        for (const damageResistance of targetActor.items.filter(
            (o) => o.system.XMLID === "DAMAGERESISTANCE" && o.isActive,
        )) {
            switch (attackDefenseVs.toUpperCase()) {
                case "PD":
                    value -= parseInt(damageResistance.system.PDLEVELS) || 0;
                    break;
                case "ED":
                    value -= parseInt(damageResistance.system.EDLEVELS) || 0;
                    break;
                default:
                    console.error(`Unsupported DAMAGERESISTANCE`, attackDefenseVs);
            }
        }

        // Check for ADD MODIFIERS TO BASE CHARACTERISTIC (RESISTANT)
        const resistantBase = targetActor?.items.find(
            (o) =>
                o.system.XMLID === attackDefenseVs && o.findModsByXmlid("RESISTANT") && o.system.ADD_MODIFIERS_TO_BASE,
        );
        if (resistantBase) {
            newOptions.resistant = true;
            newOptions.resistantAdvantage = true;
        }

        // Bases & Vehicles have resistant PD & ED
        if (["base2", "vehicle"].includes(targetActor?.type) && ["PD", "ED"].includes(attackDefenseVs)) {
            newOptions.resistant = true;
        }

        actorDefenses.defenseTags = [
            ...actorDefenses.defenseTags,
            ...createDefenseProfile(resistantBase, attackItem, value, {
                ...newOptions,
                //name: attackDefenseVs,
                title: resistantBase ? undefined : `Natural`,
                shortDesc: resistantBase ? undefined : `Natural`,
            }),
        ];
    }

    // Items that provide defense and are active
    const activeDefenses = targetActor.items.filter(
        (o) =>
            (o.baseInfo?.type?.includes("defense") || o.baseInfo?.behaviors?.includes("defense")) &&
            o.isActive &&
            o.system.XMLID &&
            !(options?.ignoreDefenseIds || []).includes(o.id) &&
            !(options?.ignoreDefenseIds || []).includes(o.system.XMLID),
    );
    for (const defenseItem of activeDefenses) {
        const defenseProfile = getItemDefenseVsAttack(defenseItem, attackItem, options);

        if (defenseProfile) {
            actorDefenses.defenseTags = [...actorDefenses.defenseTags, ...defenseProfile];
        }
    }

    // Sort tags by value, shortDesc.
    actorDefenses.defenseTags = actorDefenses.defenseTags.sort(
        (a, b) => b.value - a.value || a.shortDesc.localeCompare(b.shortDesc),
    );

    // Totals
    for (const tag of actorDefenses.defenseTags) {
        // KNOCKBACK doesn't add to any defense totals
        if (tag.options?.knockback) {
            continue;
        }

        // HARDENED
        if (armorPiercing) {
            if (tag.options?.hardened >= armorPiercing) {
                //actorDefenses.impenetrableValue += tag?.value || 0;
            } else {
                const tagDefenseItem = activeDefenses.find((itm) => itm.id === tag.defenseItemId);
                // Damage Reduction isn't halved.
                if (tagDefenseItem?.baseInfo?.afterDefenses) {
                    tag.options.afterDefenses = true;
                } else {
                    tag.options.strikethrough = true;
                    tag.name2 = tag.name.replace(/i\d+/, "");
                    //tag.valueText2 = tag.valueText;
                    tag.value2 = RoundFavorPlayerUp(tag.value / 2);
                }
            }
        }

        if (tag.operation === "add") {
            if (tag.options?.resistant) {
                actorDefenses.resistantValue += tag?.value2 || tag?.value || 0;
            } else {
                actorDefenses.defenseValue += tag?.value2 || tag?.value || 0;
            }
        }

        // Damage Resistance
        if (tag.operation === "pct") {
            actorDefenses.damageReductionValue += tag?.value || 0;
        }

        // Damage Negation
        if (tag.operation === "subtract") {
            actorDefenses.damageNegationValue += tag?.value || 0;
        }

        // KNOCKBACK
        if (tag.options?.knockback) {
            actorDefenses.knockbackResistanceValue += tag.options.knockback;
        }

        // IMPENETRABLE
        if (penetrating && tag.options?.impenetrable) {
            if (tag.options?.impenetrable >= penetrating) {
                actorDefenses.impenetrableValue += tag?.value || 0;
            } else {
                tag.options.strikethrough = true;
                tag.name2 = tag.name.replace(/i\d+/, "");
                tag.valueText2 = tag.valueText;
                tag.value2 = tag.value;
            }
        }
        // In 5e HARDENED protects vs PENETRATING. There is no IMPENETRABLE in 5e.
        else if (targetActor.is5e && penetrating && tag.options?.hardened) {
            if (tag.options?.hardened >= penetrating) {
                actorDefenses.impenetrableValue += tag?.value || 0;
            } else {
                tag.options.strikethrough = true;
                tag.name2 = tag.name.replace(/h\d+/, "");
                tag.valueText2 = tag.valueText;
                tag.value2 = tag.value;
            }
        }
    }
    actorDefenses.defenseTotalValue = actorDefenses.defenseValue + actorDefenses.resistantValue;

    return actorDefenses;
}

export function defenseConditionalCheckedByDefault(defenseItem, attackingItem) {
    if (defenseItem.system.XMLID === "VULNERABILITY") {
        // Vulnerability:  Fire (Common)
        for (const sfx of attackingItem.system.SFX?.split("/") || []) {
            if (defenseItem.system.INPUT?.match(new RegExp(sfx, "i"))) {
                return true;
            }
        }

        if (attackingItem.system.description.match(new RegExp(defenseItem.system.INPUT, "i"))) {
            return true;
        }

        // Mental
        if (
            attackingItem.baseInfo?.type.includes("mental") &&
            defenseItem.system.INPUT?.match(new RegExp("mental", "i"))
        ) {
            return true;
        }

        return false;
    }

    // Double check to make sure defense is conditional
    const conditionals = (defenseItem.system.MODIFIER || []).filter((p) =>
        ["ONLYAGAINSTLIMITEDTYPE", "CONDITIONALPOWER"].includes(p.XMLID),
    );
    if (conditionals.length === 0) return false;

    // Loop thru all conditionals to find some sort of a match
    for (const condition of conditionals) {
        switch (condition.XMLID) {
            case "ONLYAGAINSTLIMITEDTYPE":
                // Only Works Against Cold
                for (const sfx of attackingItem.system.SFX?.split("/") || []) {
                    if (condition.ALIAS.match(new RegExp(sfx, "i"))) {
                        return true;
                    }
                    if (condition.OPTION_ALIAS.match(new RegExp(sfx, "i"))) {
                        return true;
                    }
                }
                break;
            case "CONDITIONALPOWER":
                // Power does not work in Very Uncommon Circumstances
                for (const sfx of attackingItem.system.SFX?.split("/") || []) {
                    if (condition.ALIAS.match(new RegExp(sfx, "i"))) {
                        return false;
                    }
                }
                return true;

            default:
                console.warn("Unknown conditional", condition);
        }
    }

    return false;
}

export async function getConditionalDefenses(token, item, avad) {
    // Some attacks have no defenses
    if (item.baseInfo.hasNoDefense) {
        console.debug(`${item.detailedName()} has no defense`);
        return { ignoreDefenseIds: [], conditionalDefenses: [] };
    }

    let ignoreDefenseIds = [];
    let conditionalDefenses = token.actor.items.filter(
        (o) =>
            (o.baseInfo?.type?.includes("defense") || o.baseInfo?.type?.includes("defense")) &&
            (o.isActive || o.effects.find(() => true)?.disabled === false) &&
            (o.modifiers.find((p) =>
                ["ONLYAGAINSTLIMITEDTYPE", "CONDITIONALPOWER", "ONLYAGAINSTLIMITEDTYPE"].includes(p.XMLID),
            ) ||
                avad),
    );

    // Remove conditional defenses that provide no defense
    if (!game.settings.get(HEROSYS.module, "ShowAllConditionalDefenses")) {
        conditionalDefenses = conditionalDefenses.filter((defense) => defense.getDefense(token.actor, item));
    }

    // VULNERABILITY
    const vulnerabilities = token.actor.items.filter((o) => o.system.XMLID === "VULNERABILITY");
    conditionalDefenses.push(...vulnerabilities);

    // AVAD Life Support
    if (avad) {
        const lifeSupport = token.actor.items.filter((o) => o.system.XMLID === "LIFESUPPORT");
        conditionalDefenses.push(...lifeSupport);
    }

    // AVAD characteristic defenses (PD/ED)
    if (avad) {
        const key = item.system.INPUT.trim().toUpperCase();
        const char = token.actor.system[key];
        if (!char) {
            console.error(`unhandled AVAD defense vs "${key}"`);
        } else {
            if (!char.baseInfo) {
                console.error(`missing baseInfo for "${key}", skipping conditional defense check`);
            } else {
                const value = char.baseInfo.base(item.actor) + char.LEVELS;
                if (value > 0) {
                    conditionalDefenses.push(char);
                }
            }
        }
    }

    if (conditionalDefenses.length > 0) {
        const options = [];
        for (const defense of conditionalDefenses) {
            const option = {
                id: defense.id,
                name: defense.name,
                xmlid: defense.system.XMLID,
                checked: !avad && defenseConditionalCheckedByDefault(defense, item),
                conditions: "",
            };

            // Attempt to check likely defenses

            // PD, ED, MD
            if (avad?.INPUT?.toUpperCase() === defense?.system.XMLID) option.checked = true;

            if (!option.checked) {
                if (defense instanceof HeroSystem6eItem) {
                    // Damage Reduction
                    if (avad?.INPUT?.toUpperCase() == "PD" && defense.system.INPUT === "Physical")
                        option.checked = true;
                    if (avad?.INPUT?.toUpperCase() == "ED" && defense.system?.INPUT === "Energy") option.checked = true;
                    if (
                        avad?.INPUT.replace("Mental Defense", "MD").toUpperCase() == "MD" &&
                        defense.system?.INPUT === "Mental"
                    )
                        option.checked = true;

                    // Damage Negation
                    if (avad?.INPUT?.toUpperCase() == "PD" && defense.findModsByXmlid("PHYSICAL"))
                        option.checked = true;
                    if (avad?.INPUT?.toUpperCase() == "ED" && defense?.findModsByXmlid("ENERGY")) option.checked = true;
                    if (
                        avad?.INPUT?.replace("Mental Defense", "MD").toUpperCase() == "MD" &&
                        defense.findModsByXmlid("MENTAL")
                    )
                        option.checked = true;

                    // Flash Defense
                    if (avad?.INPUT?.match(/flash/i) && defense.system.XMLID === "FLASHDEFENSE") option.checked = true;

                    // Power Defense
                    if (avad?.INPUT?.match(/power/i) && defense.system.XMLID === "POWERDEFENSE") option.checked = true;

                    // Life Support
                    if (avad?.INPUT?.match(/life/i) && defense.system.XMLID === "LIFESUPPORT") option.checked = true;

                    // Resistant Damage Reduction
                    if (
                        avad?.INPUT == "Resistant PD" &&
                        defense.system.INPUT === "Physical" &&
                        defense.system.OPTION.match(/RESISTANT/i)
                    )
                        option.checked = true;
                    if (
                        avad?.INPUT == "Resistant ED" &&
                        defense.system.INPUT === "Energy" &&
                        defense.system.OPTION.match(/RESISTANT/i)
                    )
                        option.checked = true;
                    if (
                        avad?.INPUT == "Resistant MD" &&
                        defense.system.INPUT === "Mental" &&
                        defense.system.OPTION.match(/RESISTANT/i)
                    )
                        option.checked = true;

                    // FORCEFIELD, RESISTANT PROTECTION
                    if (avad?.INPUT?.toUpperCase() == "PD" && parseInt(defense.system.PDLEVELS || 0) > 0)
                        option.checked = true;
                    if (avad?.INPUT?.toUpperCase() == "ED" && parseInt(defense.system.EDLEVELS || 0) > 0)
                        option.checked = true;
                    if (
                        avad?.INPUT?.replace("Mental Defense", "MD").toUpperCase() == "MD" &&
                        parseInt(defense.system.MDLEVELS || 0) > 0
                    )
                        option.checked = true;
                    if (avad?.INPUT?.match(/power/i) && parseInt(defense.system.POWDLEVELS || 0) > 0)
                        option.checked = true;
                } else {
                    console.error(
                        `defense (${defense.name}) against ${item.actor.name}/${item.system.XMLID} is not supported`,
                    );
                }
            }

            // CONDITIONALPOWER (characteristics don't have findModsByXmlid)
            if (option.checked && defense.findModsByXmlid) {
                const conditionalPower = defense.findModsByXmlid("CONDITIONALPOWER");
                if (conditionalPower?.OPTION_ALIAS?.match(/not work/i)) {
                    const re = new RegExp(item.system.sfx, "i");
                    for (const sfx of item.system.SFX?.split("/") || []) {
                        if (sfx?.match(re)) {
                            option.checked = false;
                        }
                    }
                }
            }

            option.description = defense.system.description;
            options.push(option);
        }

        const data = {
            token,
            item,
            conditionalDefenses: options,
        };

        const conditionalDefenseCardTemplate = `systems/${HEROSYS.module}/templates/attack/item-conditional-defense-card.hbs`;
        const html = await foundryVttRenderTemplate(conditionalDefenseCardTemplate, data);

        async function getDialogOutput() {
            return new Promise((resolve) => {
                const dataConditionalDefenses = {
                    title: token.name + " conditional defenses",
                    content: html,
                    buttons: {
                        normal: {
                            label: "Apply Damage",
                            callback: (html) => {
                                resolve(html.find("form input"));
                            },
                        },
                        cancel: {
                            label: "Cancel",
                            callback: () => {
                                resolve(null);
                            },
                        },
                    },
                    default: "normal",
                    close: () => {
                        resolve(null);
                    },
                };
                new Dialog(dataConditionalDefenses).render(true);
            });
        }

        const inputs = await getDialogOutput();
        if (inputs === null) {
            return { ignoreDefenseIds: null, conditionalDefenses: null };
        }

        const defensesIgnored = [];
        for (const input of inputs) {
            if (!input.checked) {
                if (input.dataset.itemId) {
                    ignoreDefenseIds.push(input.dataset.itemId);
                    defensesIgnored.push(
                        token.actor.items.get(input.dataset.itemId) ||
                            conditionalDefenses.find((o) => o.id === input.dataset.itemId),
                    );
                } else {
                    console.warn("no input.dataset.itemId", input.dataset, conditionalDefenses);
                    ignoreDefenseIds.push(input.dataset.itemXmlid);
                    defensesIgnored.push(conditionalDefenses.find((o) => o.system.XMLID === input.dataset.itemXmlid));
                }
            }
        }

        if (defensesIgnored.length > 0) {
            let content = `The following defenses were not applied vs <span title="${item.name.replace(
                /"/g,
                "",
            )}: ${item.system.description.replace(/"/g, "")}">${item.name}</span>:<ul>`;
            for (const def of defensesIgnored) {
                content += `<li title="${def.system.description.replace(/"/g, "")}">${def.conditionalDefenseShortDescription}</li>`;
            }
            content += "</ul>";

            const speaker = ChatMessage.getSpeaker({ actor: token.actor });
            speaker["alias"] = token.actor.name;
            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content,
                whisper: ChatMessage.getWhisperRecipients("GM"),
                speaker,
            };

            await ChatMessage.create(chatData);
        }
    }
    return { ignoreDefenseIds, conditionalDefenses };
}
