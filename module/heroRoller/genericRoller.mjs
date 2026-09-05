import { createTemporaryItemAttackActionForApplyingDamage, generateChatMessage } from "./chat-output.mjs";
import { HeroRoller } from "./dice.mjs";

import { HEROSYS } from "../herosystem6e.mjs";

// v13 compatibility
const { renderTemplate } = foundry.applications.handlebars;
const { FormDataExtended } = foundry.applications.ux;

export class GenericRoller {
    static Initialize() {
        Hooks.on("renderAbstractSidebarTab", async (_sidebar, html, _context, options) => {
            if (!game.settings.get(HEROSYS.module, "ShowGenericRoller")) return;
            if (options && !options.isFirstRender) return;

            const $chat = $(html).find(".chat-form");
            if ($chat.length === 0) {
                //console.warn(`unable to find dom element`);
                return;
            }
            const content = await renderTemplate(`systems/${HEROSYS.module}/templates/system/hero-generic-roller.hbs`, {
                css: `game-version-major-${game.version.split(".")[0]}`,
            });
            const $content = $(content);
            $chat.after($content);

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
        const template = await renderTemplate(`systems/${HEROSYS.module}/templates/system/heroRoll-toHit.hbs`, options);

        const userSelection = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Roll ToHit" },
            content: template,
            ok: {
                label: "Roll ToHit",
                callback: (event, button) => new FormDataExtended(button.form).object,
            },
            rejectClose: false,
        });

        // No user selection? If so, don't roll.
        if (!userSelection) {
            return;
        }

        // Attacker’s OCV + 11 - 3d6 = the DCV the attacker can hit
        const heroRoller = new HeroRoller()
            .addNumber(Math.clamp(parseInt(userSelection.ocv) || 0, -99, 99), "OCV", undefined, { showZero: true })
            .addNumber(11, "Base to hit")
            .addDice(-3)
            .makeSuccessRoll();

        await heroRoller.roll();

        const cardHtml = await heroRoller.render("Attacker's OCV + 11 - 3d6");
        const resultHtml = `Hits a DCV of ${heroRoller.getSuccessTotal()}`;

        const chatData = {
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            rolls: heroRoller.rawRolls(),
            author: game.user._id,
            content: `${cardHtml}${resultHtml}`,
        };

        return ChatMessage.create(chatData);
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
                    KILLING_MD: "Killing MD",

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

        const includeHitLocation = game.settings.get(HEROSYS.module, "hit locations") !== "noHitLocations";
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

        const template = await renderTemplate(
            `systems/${HEROSYS.module}/templates/system/heroRoll-damage.hbs`,
            options,
        );
        const userSelection = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Roll Damage" },
            content: template,
            ok: {
                label: "Roll Damage",
                callback: (event, button) => new FormDataExtended(button.form).object,
            },
            rejectClose: false,
        });

        // No user selection? If so, don't roll.
        if (!userSelection) {
            return;
        }

        const damageMatch = userSelection.damageType.match(/(.*?)_?([EMP]D)?$/);
        const damageType = damageMatch[1];
        const defenseType = damageMatch[2];

        const customStunMultiplierSetting = game.settings.get(
            game.system.id,
            "NonStandardStunMultiplierForKillingAttackBackingSetting",
        );

        // Roll as if 5e or 6e?
        const DefaultEdition = game.settings.get(HEROSYS.module, "DefaultEdition");
        const is5eAttack = canvas.tokens.controlled.at(0)?.actor
            ? canvas.tokens.controlled.at(0).actor.is5e
            : DefaultEdition === "five";

        // Only normal and killing attacks support hit locations
        const damageTypeSupportsHitLocation =
            includeHitLocation && (damageType === "NORMAL" || damageType === "KILLING");

        // Luck and unluck don't support partial dice (full dice or nothing)
        const heroRoller = new HeroRoller()
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

        const action = createTemporaryItemAttackActionForApplyingDamage(heroRoller, defenseType);

        return generateChatMessage(heroRoller, defenseType, action);
    }
}
