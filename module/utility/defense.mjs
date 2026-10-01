import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { roundFavorPlayerAwayFromZero } from "./round.mjs";
import { HeroDialogV2 } from "../applications/api/hero-app-mixin.mjs";

const { renderTemplate } = foundry.applications.handlebars;

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
        const characteristicCurrentValue = value;
        const newOptions = foundry.utils.deepClone(options);
        let temporaryChangesSum = 0;
        let nonTemporaryChangesSum = 0;

        // back out any Active Effects
        for (const ae of targetActor.appliedEffects) {
            for (const change of ae.changes.filter(
                (o) => o.key === `system.characteristics.${attackDefenseVs.toLowerCase()}.max`,
            )) {
                const changeValue = parseInt(change.value) || 0;
                value -= changeValue;
                if (ae.isTemporary) {
                    temporaryChangesSum += changeValue;
                } else {
                    nonTemporaryChangesSum += changeValue;
                }

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
        // back out 5e DAMAGERESISTANCE. It converts existing normal defense into resistant
        // (5ER p. 146), so it can only remove what remains here, and its own tag (see
        // defenseTagVsAttack) can only convert what the characteristic currently holds.
        let damageResistanceConverted = 0;
        for (const damageResistance of targetActor.items.filter(
            (o) => o.system.XMLID === "DAMAGERESISTANCE" && o.isActive,
        )) {
            let drLevels = 0;
            switch (attackDefenseVs.toUpperCase()) {
                case "PD":
                    drLevels = parseInt(damageResistance.system.PDLEVELS) || 0;
                    break;
                case "ED":
                    drLevels = parseInt(damageResistance.system.EDLEVELS) || 0;
                    break;
                default:
                    console.error(`Unsupported DAMAGERESISTANCE`, attackDefenseVs);
            }
            value -= Math.min(drLevels, Math.max(0, value));
            damageResistanceConverted += Math.min(
                drLevels,
                Math.max(0, characteristicCurrentValue - damageResistanceConverted),
            );
        }

        // 5ER p. 39 / 6E1 p. 135: a characteristic reduced below 0 functions as 0 — it never
        // subtracts from other defenses. The tags pushed so far (natural + temporary
        // adjustments + item-granted levels re-added by their own defense tags) must sum to the
        // current characteristic value less what Damage Resistance converted; when drains
        // exceed the pool, push a correcting tag so the shortfall never leaks into the total.
        value = Math.max(0, value);
        const characteristicGroupTarget = Math.max(0, characteristicCurrentValue) - damageResistanceConverted;
        const characteristicGroupSum = value + temporaryChangesSum + nonTemporaryChangesSum;
        if (characteristicGroupSum < characteristicGroupTarget) {
            actorDefenses.defenseTags = [
                ...actorDefenses.defenseTags,
                ...createDefenseProfile(undefined, attackItem, characteristicGroupTarget - characteristicGroupSum, {
                    ...newOptions,
                    title: `${attackDefenseVs.toUpperCase()} cannot be reduced below 0`,
                    shortDesc: `Minimum 0`,
                }),
            ];
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

    const ignoreDefenseIds = options?.ignoreDefenseIds || [];
    const isNotIgnored = (item) => !ignoreDefenseIds.includes(item.id) && !ignoreDefenseIds.includes(item.system.XMLID);

    // Items that provide defense and are active
    let activeDefenses = targetActor.items.filter(
        (o) =>
            (o.baseInfo?.type?.includes("defense") || o.baseInfo?.behaviors?.includes("defense")) &&
            o.isActive &&
            o.system.XMLID &&
            isNotIgnored(o),
    );

    // Life Support isn't a defense power but can be the named defense of an AVAD (6e) or NND (5e)
    if (attackItem.findModsByXmlid("AVAD") || attackItem.findModsByXmlid("NND")) {
        activeDefenses.push(
            ...targetActor.items.filter(
                (item) => item.isActive && item.system.XMLID === "LIFESUPPORT" && isNotIgnored(item),
            ),
        );
    }

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
                    tag.value2 = roundFavorPlayerAwayFromZero(tag.value / 2);
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
    // Defenses never go negative (5ER p. 39, 6E1 p. 135): whatever the tags sum to, a shortfall
    // must not become a damage bonus for the attacker.
    actorDefenses.defenseValue = Math.max(0, actorDefenses.defenseValue);
    actorDefenses.resistantValue = Math.max(0, actorDefenses.resistantValue);
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
            o.isActive &&
            o.baseInfo?.type?.includes("defense") &&
            o.modifiers.find((p) =>
                ["ONLYAGAINSTLIMITEDTYPE", "CONDITIONALPOWER", "LIMITEDPOWER", "ONLYAGAINSTLIMITEDTYPE"].includes(
                    p.XMLID,
                ),
            ),
    );

    // Remove conditional defenses that provide no defense
    if (!game.settings.get(HEROSYS.module, "ShowAllConditionalDefenses")) {
        conditionalDefenses = conditionalDefenses.filter((defense) => defense.getDefense(token.actor, item));
    }

    // VULNERABILITY
    const vulnerabilities = token.actor.items.filter((o) => o.system.XMLID === "VULNERABILITY");
    conditionalDefenses.push(...vulnerabilities);

    // PH: FIXME: avad is either AVAD or NND. This should done correctly and not kludged as the avad parameter presently is.
    const nndLikeDefense = avad?.INPUT ?? avad?.COMMENTS ?? "";
    const nndLikeDefenseKey = nndLikeDefense.trim().toUpperCase();

    // AVAD Life Support
    if (avad) {
        const avadItems = token.actor.items.filter(
            (o) => o.isActive && ["LIFESUPPORT", "MENTALDEFENSE"].includes(o.system.XMLID),
        );
        conditionalDefenses.push(...avadItems);
    }

    // AVAD characteristic defenses (PD/ED)
    if (avad) {
        const char = token.actor.system[nndLikeDefenseKey];
        if (!char) {
            console.warn(`possible unhandled AVAD defense vs "${nndLikeDefenseKey}"`);
        } else {
            if (!char.baseInfo) {
                console.error(`missing baseInfo for "${nndLikeDefenseKey}", skipping conditional defense check`);
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
                    if (nndLikeDefenseKey === "PD" && defense.system.INPUT === "Physical") option.checked = true;
                    if (nndLikeDefenseKey === "ED" && defense.system?.INPUT === "Energy") option.checked = true;
                    if (
                        nndLikeDefenseKey.replace("Mental Defense", "MD").toUpperCase() === "MD" &&
                        defense.system?.INPUT === "Mental"
                    )
                        option.checked = true;

                    // Damage Negation
                    if (nndLikeDefenseKey === "PD" && defense.findModsByXmlid("PHYSICAL")) option.checked = true;
                    if (nndLikeDefenseKey === "ED" && defense?.findModsByXmlid("ENERGY")) option.checked = true;
                    if (
                        nndLikeDefenseKey.replace("Mental Defense", "MD").toUpperCase() === "MD" &&
                        defense.findModsByXmlid("MENTAL")
                    )
                        option.checked = true;

                    // Flash Defense
                    if (nndLikeDefenseKey.match(/flash/i) && defense.system.XMLID === "FLASHDEFENSE")
                        option.checked = true;

                    // Power Defense
                    if (nndLikeDefenseKey.match(/power/i) && defense.system.XMLID === "POWERDEFENSE")
                        option.checked = true;

                    // Life Support
                    if (nndLikeDefenseKey.match(/life/i) && defense.system.XMLID === "LIFESUPPORT")
                        option.checked = true;

                    // Resistant Damage Reduction
                    if (
                        nndLikeDefenseKey === "Resistant PD" &&
                        defense.system.INPUT === "Physical" &&
                        defense.system.OPTION.match(/RESISTANT/i)
                    )
                        option.checked = true;
                    if (
                        nndLikeDefenseKey === "Resistant ED" &&
                        defense.system.INPUT === "Energy" &&
                        defense.system.OPTION.match(/RESISTANT/i)
                    )
                        option.checked = true;
                    if (
                        nndLikeDefenseKey === "Resistant MD" &&
                        defense.system.INPUT === "Mental" &&
                        defense.system.OPTION.match(/RESISTANT/i)
                    )
                        option.checked = true;

                    // FORCEFIELD, RESISTANT PROTECTION
                    if (nndLikeDefenseKey === "PD" && parseInt(defense.system.PDLEVELS || 0) > 0) option.checked = true;
                    if (nndLikeDefenseKey === "ED" && parseInt(defense.system.EDLEVELS || 0) > 0) option.checked = true;
                    if (
                        nndLikeDefenseKey.replace("Mental Defense", "MD").toUpperCase() === "MD" &&
                        parseInt(defense.system.MDLEVELS || 0) > 0
                    )
                        option.checked = true;
                    if (nndLikeDefenseKey.match(/power/i) && parseInt(defense.system.POWDLEVELS || 0) > 0)
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
        const html = await renderTemplate(conditionalDefenseCardTemplate, data);

        const inputs = await HeroDialogV2.wait({
            position: { width: 400 },
            window: { title: token.name + " conditional defenses" },
            content: html,
            buttons: [
                {
                    action: "normal",
                    label: "Apply Damage",
                    default: true,
                    callback: (event, button) => Array.from(button.form.querySelectorAll("input")),
                },
            ],
        });

        // Was the dialog closed without providing input? If so, assume no defenses are desired.
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
