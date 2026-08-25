import { createTemporaryItemAttackActionForApplyingDamage, generateChatMessage } from "./chat-output.mjs";
import { HeroRoller } from "./dice.mjs";

import { HEROSYS } from "../herosystem6e.mjs";

const heroRollRegExpString =
    "(?<cmd>\\/heroroll)(?:[\\s]+)(?<nonCmd>(?<numDice>[\\d\\.]+)d(?<diceSize>[\\d]+)?(?<numTerm>(?<numTermSign>[-+]?)[\\d]+)?(?<flavourTerm>\\[(?<flavourTermContent>(?<heroSystemVersion>[56]?)(?<hitLoc>h)?(?<flavour>.*?))\\])?)(?<flavourDefenseTerm>\\[(?<flavourDefenseType>[emp])\\])?";
const chatHeroRollRegExpString = `^${heroRollRegExpString}$`;
const inlineHeroRollRegExpStr = `\\[\\[${heroRollRegExpString}\\]\\]`;

const chatHeroRollRegExp = new RegExp(chatHeroRollRegExpString, "i");
const inlineHeroRollRegExp = new RegExp(inlineHeroRollRegExpStr, "gi");

async function onInlineHeroRollClick(event) {
    const a = event.target.closest("a.inline-hero-roll");
    if (!a) {
        return;
    }
    event.preventDefault();

    // Recover the data stashed in data-* attributes
    const match = JSON.parse(a.dataset.match);
    match.groups = JSON.parse(a.dataset.groups);
    match.input = a.dataset.input;

    const { heroRoller, defenseType } = buildDamageInformation(match);
    await rollAndGenerateChatMessage(heroRoller, defenseType);
}

/**
 * Text Editor Enricher (Of type TextEditorEnricher) to provide inline support for /heroroll
 *
 * @param {RegExpMatchArray} match
 * @param {EnrichmentOptions} [options]
 *
 * @returns [Promise<HTMLElement | null>]
 */
async function heroRollTextEditorEnricher(match /*, options*/) {
    if (match && match[0]) {
        // Build a clickable anchor element
        const a = document.createElement("a");
        a.classList.add("inline-hero-roll", "roll");
        a.dataset.match = JSON.stringify(match);
        a.dataset.groups = JSON.stringify(match.groups);
        a.dataset.input = JSON.stringify(match.input);

        const { heroRoller, defenseType } = buildDamageInformation(match);

        // Add a link that looks similar to Foundry's inline roll link
        const linkActionDescription = `${match[2].replace(/\[.*\]/, "")} ${defenseType} ${heroRoller.getType()} roll ${heroRoller.hitLocationValid() ? " with hit location" : ""}`;
        a.innerHTML = `<i class="fas fa-dice-d6"></i> ${linkActionDescription}`;

        return a;
    }

    return null;
}

/**
 * Register an inline hero roller text editor enricher.
 */
Hooks.on("init", function () {
    CONFIG.TextEditor.enrichers.push({
        enricher: heroRollTextEditorEnricher,
        pattern: inlineHeroRollRegExp,
    });
});

/**
 *
 * @param {HTMLElement} html
 */
function addInlineHeroRollerListeners(html) {
    html.querySelectorAll("a.inline-hero-roll").forEach((a) =>
        a.addEventListener("click", onInlineHeroRollClick, { capture: true }),
    );
}

/**
 * When chat messages and journal pages are rendered, see if there are any inline /heroroll rolls. If so, register a click handler for it.
 */
Hooks.on("renderChatMessageHTML", (_message, html) => addInlineHeroRollerListeners(html));
Hooks.on("renderJournalEntrySheet", (_sheet, html) => addInlineHeroRollerListeners(html));
Hooks.on("renderHeroSystemActorSheetV2", (_sheet, html) => addInlineHeroRollerListeners(html));

/**
 * When a chat message is generated, check if this is a /heroroll command.
 */
Hooks.on("chatMessage", function (_this, message /*, _chatData*/) {
    // V14's ProseMirror chat input serializes the message as HTML (e.g. "<p>/heroroll 3d6</p>"),
    // whereas V13's plain input does not. Match against the extracted plain text so both work.
    const plainMessage = new DOMParser().parseFromString(message, "text/html").body.textContent.trim();
    const chatMessageCmd = plainMessage.match(chatHeroRollRegExp);
    if (chatMessageCmd?.groups?.cmd.toLowerCase() === "/heroroll") {
        // Minimal error handling: Confirm "d6" or it's just a straight numerical term
        if (
            chatMessageCmd.groups.diceSize !== "6" ||
            (!chatMessageCmd.groups.diceSize && !chatMessageCmd.groups.numTerm)
        ) {
            // Can't handle it.
            return true;
        }

        // The hook mechanism doesn't allow async calls. Pass back success on the command
        // and process it separately.
        setTimeout(doRollAndGenerateChatMessage.bind(null, chatMessageCmd), 0);

        // We have processed this hook. It doesn't need to be passed along to other hooks.
        return false;
    }

    return true;
});

/**
 * Generate a HeroRoller object from the /heroroll command
 *
 * @param {RegExpMatch} chatMessageCmd
 *
 * @returns {HeroRoller}
 */
function buildDamageInformation(chatMessageCmd) {
    let numericTerm = parseFloat(chatMessageCmd.groups.numTerm || 0);
    const negativeTermWithDice = chatMessageCmd.groups.numDice && numericTerm < 0; // e.g. 1d6-1
    if (negativeTermWithDice) {
        numericTerm = 0;
    }

    const numDice = parseFloat(
        chatMessageCmd.groups.numDice
            ? negativeTermWithDice
                ? chatMessageCmd.groups.numDice - 1
                : chatMessageCmd.groups.numDice
            : 0,
    );

    const heroRoller = new HeroRoller().modifyTo5e(chatMessageCmd.groups.heroSystemVersion === "5");

    switch (chatMessageCmd.groups.flavour?.toLowerCase()) {
        case "k":
            {
                const customStunMultiplierSetting = game.settings.get(
                    game.system.id,
                    "NonStandardStunMultiplierForKillingAttackBackingSetting",
                );

                heroRoller.makeKillingRoll(
                    true,
                    customStunMultiplierSetting.d6Count ||
                        customStunMultiplierSetting.d6Less1DieCount ||
                        customStunMultiplierSetting.halfDieCount ||
                        customStunMultiplierSetting.constant
                        ? customStunMultiplierSetting
                        : undefined,
                );
            }
            break;

        case "n":
            heroRoller.makeNormalRoll();
            break;

        case "a":
            heroRoller.makeAdjustmentRoll();
            break;

        case "e":
            heroRoller.makeEntangleRoll();
            break;

        case "s":
            heroRoller.makeSuccessRoll();
            break;

        case "f":
            heroRoller.makeFlashRoll();
            break;

        case "l":
            heroRoller.makeLuckRoll();
            break;

        case "u":
            heroRoller.makeUnluckRoll();
            break;

        default:
            // Unknown or not provided
            heroRoller.makeBasicRoll();
            break;
    }

    heroRoller
        .addDice(Math.trunc(numDice))
        .addDiceMinus1(negativeTermWithDice ? 1 : 0)
        .addHalfDice(numDice % 1 ? 1 : 0)
        .addNumber(Math.trunc(numericTerm));

    const useHitLocations = !!chatMessageCmd.groups.hitLoc;
    const useHitLocationsSide = game.settings.get(HEROSYS.module, "hitLocTracking") === "all";
    heroRoller.addToHitLocation(useHitLocations, "none", useHitLocationsSide, "none");

    let defenseType = "PD";
    switch (chatMessageCmd.groups.flavourDefenseType?.toLowerCase()) {
        case "e":
            defenseType = "ED";
            break;

        case "m":
            defenseType = "MD";
            break;

        case "p":
            defenseType = "PD";
            break;

        default:
            // Unknown or not provided
            break;
    }

    return { heroRoller, defenseType };
}

/**
 * Evaluate the hero roller and generate a chat card for it.
 *
 * @param {HeroRoller} heroRoller
 */
async function rollAndGenerateChatMessage(heroRoller, defenseType) {
    await heroRoller.roll();

    const action = createTemporaryItemAttackActionForApplyingDamage(heroRoller, defenseType);

    return generateChatMessage(heroRoller, defenseType, action);
}

/**
 * Parse the /heroroll command and evaluate it generating a chat card with the result.
 *
 * @param {RegExpMatch} chatMessageCmd
 *
 * @returns
 */
async function doRollAndGenerateChatMessage(chatMessageCmd) {
    const { heroRoller, defenseType } = buildDamageInformation(chatMessageCmd);
    return rollAndGenerateChatMessage(heroRoller, defenseType);
}
