import { tokenEducatedGuess } from "../../utility/util.mjs";
import { HeroApplication } from "../api/application.mjs";
import { HeroRoller } from "../../utility/dice.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;

export class PresenceAttackApplication extends HeroApplication {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", async function () {
            PresenceAttackApplication.initializeTemplate();
        });
    }

    static DEFAULT_OPTIONS = {
        width: "auto",
        classes: ["presence-attack"],
        window: {
            icon: "fa-solid fa-person-harassing",
        },
    };

    constructor(options = {}) {
        options.id ??= `presence-attack-${options.actor?.uuid}`;
        super(options);
        this.#actor = options.actor;
        this.#token = options.token;
    }

    #actor;
    get actor() {
        return this.#actor;
    }

    #token;
    get token() {
        return this.#token || tokenEducatedGuess({ actor: this.actor });
    }

    get title() {
        return `Presence Attack: ${this.token?.name ?? this.actor?.name}`;
    }

    static initializeTemplate() {
        // HEROSYS.module isn't defined yet so using game.system.id
        const systemId = game.system.id;

        PresenceAttackApplication.PARTS = {
            body: {
                template: `systems/${systemId}/templates/pop-out/presence-attack-card.hbs`,
            },
            footer: {
                template: "templates/generic/form-footer.hbs",
            },
        };
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);

        switch (partId) {
            case "body":
                {
                    // Certain skills/talents/powers may help this roll
                    context.preAttackMods = [];

                    // Striking appearance may help
                    const strikingAppearances = this.actor.items.filter(
                        (item) => item.system.XMLID === "STRIKING_APPEARANCE",
                    );
                    for (const saTalent of strikingAppearances) {
                        saTalent.system.checked = false;
                        saTalent.system.active = true;
                        context.preAttackMods.push(saTalent);
                    }

                    // Positive reputation or negative reputation may help this roll
                    const reputations = this.actor.items.filter((item) => item.system.XMLID === "REPUTATION");
                    for (const reputation of reputations) {
                        reputation.system.checked = false;
                        reputation.system.active = true;
                        context.preAttackMods.push(reputation);
                    }
                }
                break;
            case "footer":
                context.buttons = [
                    {
                        type: "submit",
                        label: "Roll Presence Attack",
                        icon: "fa-solid fa-dice",
                        //disabled: this.advancement.chooseN == null || this.totalChosen !== this.advancement.chooseN,
                    },
                ];
                break;
        }

        return context;
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
    }

    // async _onRender(context, options) {
    //     console.warn(options);
    // }

    async _onSubmitForm(formConfig, event) {
        await super._onSubmitForm(formConfig, event);

        const tags = [];

        const presence = parseInt(this.actor.system.characteristics.pre.value);
        const presenceAttackBasicDice = clampFractionalPortionToZeroOrHalf(presence / 5);
        if (presenceAttackBasicDice !== 0) {
            tags.push({
                value: presenceAttackBasicDice,
                name: "Presence Attack",
                title: `Presence Attack (${presence} PRE)`,
            });
        }

        const form = event.target.querySelector("form");
        if (!form) {
            console.error("unable to locate FORM");
            return;
        }
        const rollModifier = clampFractionalPortionToZeroOrHalf(parseFloat(form.mod.value));
        if (rollModifier !== 0) {
            tags.push({
                value: rollModifier,
                name: "Roll Modifier",
                title: `User Added Roll Modifier ${rollModifier}`,
            });
        }

        // Presence Attack Modifiers (striking appearance & reputation)
        let preAttackMods = 0;
        const preAttackModInputs = form.querySelectorAll("INPUT:checked");
        for (const preAttackInput of preAttackModInputs) {
            const preAttackModItem = this.actor.items.get(preAttackInput.id);

            let numDice;
            if (preAttackModItem.system.XMLID === "STRIKING_APPEARANCE") {
                numDice = parseInt(preAttackModItem.system.LEVELS || 0);
            } else if (preAttackModItem.system.XMLID === "REPUTATION") {
                if (preAttackModItem.type === "disadvantage") {
                    const recognizedOptionId = (preAttackModItem.system.ADDER || []).find(
                        (adder) => adder.XMLID === "RECOGNIZED",
                    )?.OPTIONID;

                    if (recognizedOptionId === "SOMETIMES") {
                        numDice = -1;
                    } else if (recognizedOptionId === "FREQUENTLY") {
                        numDice = -2;
                    } else if (recognizedOptionId === "ALWAYS") {
                        numDice = -3;
                    } else {
                        console.error(`Unrecognized REPUTATION (disad) OPTIONID ${recognizedOptionId}`);
                        numDice = 0;
                    }
                } else {
                    numDice = parseInt(preAttackModItem.system.LEVELS || 0);
                }
            } else {
                console.warn(
                    `Unexpected item ${preAttackModItem.system.XMLID}/${preAttackModItem.type} providing modification for presence attack`,
                );
                numDice = parseInt(preAttackModItem.system.LEVELS || 0);
            }

            if (numDice !== 0) {
                tags.push({
                    value: numDice,
                    name: preAttackModItem.name,
                    title: preAttackModItem.system.description,
                });
            }

            preAttackMods += numDice;
        }

        const presenceAttackDice = presenceAttackBasicDice + preAttackMods + rollModifier;
        const presenceAttackFullDice = Math.trunc(presenceAttackDice);
        const presenceAttackPartialDice =
            Math.sign(presenceAttackDice) * (Math.abs(presenceAttackDice % 1) >= 0.5 ? 1 : 0);

        const preAttackRoller = new HeroRoller()
            .makeBasicRoll()
            .addDice(presenceAttackFullDice, "Presence Attack")
            .addHalfDice(presenceAttackPartialDice, "Presence Attack Half Dice");
        await preAttackRoller.roll();

        const rollHtml = await preAttackRoller.render("Presence Attack");

        // render card
        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token: this.token });

        const cardData = {
            tags: tags.map((tag) => {
                return { ...tag, value: tag.value.signedString() };
            }),
            rolls: preAttackRoller.rawRolls(),
            renderedRoll: rollHtml,
            user: game.user._id,
            speaker: speaker,
        };
        const template = `systems/${game.system.id}/templates/chat/presence-attack-result-card.hbs`;
        const cardHtml = await foundryVttRenderTemplate(template, cardData);

        const chatData = {
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            rolls: preAttackRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }
}

function clampFractionalPortionToZeroOrHalf(value) {
    const fractional = value % 1;
    if (fractional) {
        return Math.trunc(value) + Math.sign(value) * 0.5;
    }

    return value;
}
