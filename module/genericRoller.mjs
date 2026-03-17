import { HEROSYS } from "./herosystem6e.mjs";
import { HeroSystem6eChatMessage } from "./heroChatMessage.mjs";

import { HeroSystem6eActor } from "./actor/actor.mjs";

import { dehydrateAttackItem } from "./item/item-attack.mjs";

import { actionToJSON, Attack } from "./utility/attack.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const FoundryVttFormDataExtended = foundry.applications?.ux?.FormDataExtended || FormDataExtended;

export class GenericRoller {
    static Initialize() {
        // V13
        Hooks.on("renderAbstractSidebarTab", async (_sidebar, html, _context, options) => {
            if (!game.settings.get(HEROSYS.module, "ShowGenericRoller")) return;
            if (options && !options.isFirstRender) return;

            const $chat = $(html).find(".chat-form");
            if ($chat.length === 0) {
                //console.warn(`unable to find dom element`);
                return;
            }
            const content = await foundryVttRenderTemplate(
                `systems/${HEROSYS.module}/templates/system/hero-generic-roller.hbs`,
                {
                    css: `game-version-major-${game.version.split(".")[0]}`,
                },
            );
            const $content = $(content);
            $chat.after($content);

            GenericRoller.activateListeners($content);
        });

        // V12 only
        Hooks.on("renderSidebarTab", async (app, html) => {
            if (app.tabName !== "chat") return;
            if (!game.settings.get(HEROSYS.module, "ShowGenericRoller")) return;

            const $chat = $(html).find("#chat-form");
            if ($chat.length === 0) {
                console.warn(`unable to find dom element`);
                return;
            }
            const content = await foundryVttRenderTemplate(
                `systems/${HEROSYS.module}/templates/system/hero-generic-roller.hbs`,
                {
                    css: `game-version-major-${game.version.split(".")[0]}`,
                },
            );
            const $content = $(content);
            html.append($content);

            GenericRoller.activateListeners($content);
        });
    }

    static activateListeners(html) {
        $(html)
            .find("button")
            .on("click", async (event) => {
                event.preventDefault();
                const button = event.currentTarget;
                const dataset = button.dataset;

                switch (dataset.action) {
                    case "tohit":
                        await GenericRoller.toHit(dataset);
                        break;
                    case "damage":
                        await GenericRoller.damage(dataset);
                        break;
                    default:
                        console.warn(`Unhandled button action`);
                }
            });
    }

    static async toHit() {
        const options = { ocv: canvas.tokens.controlled.at(0)?.actor?.system.characteristics.ocv?.value || 0 };
        const template = await foundryVttRenderTemplate(
            `systems/${HEROSYS.module}/templates/system/heroRoll-toHit.hbs`,
            options,
        );

        const userSelection = await Dialog.prompt({
            title: "Roll ToHit",
            label: "Roll ToHit",
            content: template,
            callback: async function (html) {
                const form = html.find("form")[0];
                return new FoundryVttFormDataExtended(form).object;
            },
        }).catch(() => {
            // Promise is rejected most likely from user choosing close
            return undefined;
        });

        // No user selection? If so, don't roll.
        if (!userSelection) {
            return;
        }

        // Attacker’s OCV + 11 - 3d6 = the DCV the attacker can hit
        const heroRoller = new CONFIG.HERO.heroDice.HeroRoller()
            .addNumber(Math.clamp(parseInt(userSelection.ocv) || 0, -99, 99), "OCV")
            .addNumber(11, "Base to hit")
            .addDice(-3)
            .makeSuccessRoll();

        await heroRoller.roll();

        const cardHtml = await heroRoller.render("Attacker's OCV + 11 - 3d6", true);
        const resultHtml = `Hits a DCV of ${heroRoller.getSuccessTotal()}`;

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.OOC,
            rolls: heroRoller.rawRolls(),
            author: game.user._id,
            content: `${cardHtml}${resultHtml}`,
        };

        return HeroSystem6eChatMessage.createWithRollMode(chatData);
    }

    static async damage() {
        const options = {
            dice: 1,
            dicePlus: {
                groupName: "dicePlus",
                choices: { ZERO: "0", PLUSHALFDIE: "+½d6", PLUSONEPIP: "+1", PLUSDIEMINUSONE: "+1d6-1" },
                chosen: "ZERO",
            },
            damageType: {
                groupName: "damageType",
                choices: {
                    NORMAL_PD: "Normal PD",
                    NORMAL_ED: "Normal ED",
                    NORMAL_MD: "Normal MD",
                    KILLING_PD: "Killing PD",
                    KILLING_ED: "Killing ED",

                    // TODO: These probably need default items and a different interface
                    // ADJUSTMENT: "Adjustment",
                    // ENTANGLE: "Entangle",
                    // FLASH: "Flash",
                    // EFFECT: "Effect",
                    LUCK: "Luck",
                    UNLUCK: "Unluck",
                },
                chosen: "NORMAL_PD",
            },
        };

        const includeHitLocation = game.settings.get(HEROSYS.module, "hit locations");
        if (includeHitLocation) {
            options.hitLoc = [
                { key: "noHitLocation", label: `No Hit Location` },
                { key: "none", label: `Random` },
            ];
            for (const [key, obj] of Object.entries(CONFIG.HERO.hitLocations)) {
                options.hitLoc.push({
                    key: key,
                    label: `${obj.label} ${obj.isSpecialHl ? "" : `(stun${obj.stunX} nStun${obj.nStunX} body${obj.bodyX})`}`,
                });
            }
        }

        const template = await foundryVttRenderTemplate(
            `systems/${HEROSYS.module}/templates/system/heroRoll-damage.hbs`,
            options,
        );
        const userSelection = await Dialog.prompt({
            title: "Roll Damage",
            label: "Roll Damage",
            content: template,
            callback: async function (html) {
                const form = html.find("form")[0];
                return new FoundryVttFormDataExtended(form).object;
            },
        }).catch(() => {
            // Promise is rejected most likely from user choosing close
            return undefined;
        });

        // No user selection? If so, don't roll.
        if (!userSelection) {
            return;
        }

        const damageTypeString = userSelection.damageType.replace("_", " ");
        const damageType = userSelection.damageType.replace(/_[EMP]D/, "");

        const customStunMultiplierSetting = game.settings.get(
            game.system.id,
            "NonStandardStunMultiplierForKillingAttackBackingSetting",
        );

        // Canvas selected token? If so, use that as the actor
        const actor = canvas.tokens.controlled.at(0)?.actor;
        // Roll as if 5e or 6e?
        const DefaultEdition = game.settings.get(HEROSYS.module, "DefaultEdition");
        const is5eAttack = actor !== undefined ? canvas.tokens.controlled.at(0).actor.is5e : DefaultEdition === "five";
        const tempActor = new HeroSystem6eActor({
            name: "Generic Actor",
            type: "npc",
        });
        tempActor.system.is5e = is5eAttack;

        // NOTE: No application of damage for anything other than normal and killing attacks

        // Only normal and killing attacks support hit locations
        const damageTypeSupportsHitLocation =
            includeHitLocation && (damageType === "NORMAL" || damageType === "KILLING");

        // Luck and unluck don't support partial dice (full dice or nothing)
        const heroRoller = new CONFIG.HERO.heroDice.HeroRoller()
            .modifyTo5e(is5eAttack)

            .makeNormalRoll(damageType === "NORMAL")
            .makeKillingRoll(
                damageType === "KILLING",
                customStunMultiplierSetting.d6Count ||
                    customStunMultiplierSetting.d6Less1DieCount ||
                    customStunMultiplierSetting.halfDieCount ||
                    customStunMultiplierSetting.constant
                    ? customStunMultiplierSetting
                    : undefined,
            )
            .makeAdjustmentRoll(damageType === "ADJUSTMENT")
            .makeEffectRoll(damageType === "EFFECT")
            .makeEntangleRoll(damageType === "ENTANGLE")
            .makeFlashRoll(damageType === "FLASH")
            .makeLuckRoll(damageType === "LUCK")
            .makeUnluckRoll(damageType === "UNLUCK")

            .addDice(Math.clamp(userSelection.dice, 0, 999), "DICE")
            .addHalfDice(
                userSelection.dicePlus === "PLUSHALFDIE" && !(damageType === "LUCK" || damageType === "UNLUCK") ? 1 : 0,
                "PLUSHALFDIE",
            )
            .addDiceMinus1(
                userSelection.dicePlus === "PLUSDIEMINUSONE" && !(damageType === "LUCK" || damageType === "UNLUCK")
                    ? 1
                    : 0,
                "PLUSDIEMINUSONE",
            )
            .addNumber(
                userSelection.dicePlus === "PLUSONEPIP" && !(damageType === "LUCK" || damageType === "UNLUCK") ? 1 : 0,
                "PLUSONEPIP",
            )

            .addToHitLocation(
                damageTypeSupportsHitLocation && userSelection.aim !== "noHitLocation",
                userSelection.aim,
                includeHitLocation && game.settings.get(HEROSYS.module, "hitLocTracking") === "all",
                userSelection.aim === "none" ? "none" : userSelection.aimSide, // Can't just select a side to hit as that doesn't have a penalty
            );

        await heroRoller.roll();

        const powers = is5eAttack ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

        let xml = "";
        if (userSelection.damageType === "NORMAL_PD") {
            xml = powers.find((power) => power.key === "ENERGYBLAST").xml.replace(/ INPUT="[PE]D"/, ` INPUT="PD"`);
        } else if (userSelection.damageType === "NORMAL_ED") {
            xml = powers.find((power) => power.key === "ENERGYBLAST").xml.replace(/ INPUT="[EP]D"/, ` INPUT="ED"`);
        } else if (userSelection.damageType === "NORMAL_MD") {
            xml = foundry.utils.deepClone(powers.find((power) => power.key === "EGOATTACK").xml);
        } else if (userSelection.damageType === "KILLING_PD") {
            xml = powers.find((power) => power.key === "RKA").xml.replace(/ INPUT="[EP]D"/, ` INPUT="PD"`);
        } else if (userSelection.damageType === "KILLING_ED") {
            xml = powers.find((power) => power.key === "RKA").xml.replace(/ INPUT="[EP]D"/, ` INPUT="ED"`);
        } else if (userSelection.damageType === "LUCK") {
            xml = foundry.utils.deepClone(powers.find((power) => power.key === "LUCK").xml);
        } else if (userSelection.damageType === "UNLUCK") {
            xml = foundry.utils.deepClone(powers.find((power) => power.key === "UNLUCK").xml);
        }

        let item = null;

        if (xml) {
            item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(xml, actor || tempActor), {
                parent: actor || tempActor,
            });

            if (!actor) {
                tempActor.items.set(item.system.XMLID, item);
            }
        }

        // PH: FIXME: Should put this into handlebars
        let cardHtml = await heroRoller.render(`Roll Generic ${damageTypeString} Damage`);

        if (!item) {
            ui.notifications.error(`Generic roller not working for ${damageType}`);
            return;
        }

        const action = Attack.buildActionInfo(item, [], {});

        if (["NORMAL", "KILLING"].includes(damageType)) {
            cardHtml += `
                        <div data-visibility="gm">
                            <button class="generic-roller-apply-damage"
                                title="Apply damage to selected tokens."
                                ${actor ? `data-actor-uuid='${actor.uuid}'` : ""}
                                ${item ? `data-item-json-str='${dehydrateAttackItem(item)}'` : ""}
                                data-action-data='${actionToJSON(action)}'
                                data-roller='${heroRoller.toJSON()}'
                                data-target-tokens='${JSON.stringify([])}'
                            >
                                Apply ${damageTypeString} Damage
                            </button>
                        </div>
                    `;
        }

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.OOC,
            rolls: heroRoller.rawRolls(),
            author: game.user._id,
            content: `${cardHtml}`,
        };

        return HeroSystem6eChatMessage.createWithRollMode(chatData);
    }
}
