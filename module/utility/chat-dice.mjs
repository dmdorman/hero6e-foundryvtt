import { HeroRoller } from "./dice.mjs";
import { HEROSYS } from "../herosystem6e.mjs";

const heroRollRegExp = new RegExp(
    "^(?<cmd>\\/heroroll)(?:[\\s]+)(?<nonCmd>(?<numDice>[\\d\\.]+)d(?<diceSize>[\\d]+)?(?<numTerm>(?<numTermSign>[-+]?)[\\d]+)?(?<flavourTerm>\\[(?<flavourTermContent>(?<heroSystemVersion>[56]?)(?<hitLoc>h)?(?<flavour>.*))\\])?)$",
    "i",
);

Hooks.on("chatMessage", function (_this, message /*, _chatData*/) {
    const chatMessageCmd = message.match(heroRollRegExp);
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

async function doRollAndGenerateChatMessage(chatMessageCmd) {
    const useHitLocations = !!chatMessageCmd.groups.hitLoc;
    const useHitLocationsSide = game.settings.get(HEROSYS.module, "hitLocTracking") === "all";

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

    const roller = new HeroRoller()
        .modifyTo5e(chatMessageCmd.groups.heroSystemVersion === "5")
        .addToHitLocation(useHitLocations, "none", useHitLocationsSide, "none");

    let flavour;
    switch (chatMessageCmd.groups.flavour?.toLowerCase()) {
        case "k":
            flavour = HeroRoller.ROLL_TYPE.KILLING;
            roller.makeKillingRoll();
            break;

        case "n":
            flavour = HeroRoller.ROLL_TYPE.NORMAL;
            roller.makeNormalRoll();
            break;

        case "a":
            flavour = HeroRoller.ROLL_TYPE.ADJUSTMENT;
            roller.makeAdjustmentRoll();
            break;

        case "e":
            flavour = HeroRoller.ROLL_TYPE.ENTANGLE;
            roller.makeEntangleRoll();
            break;

        case "s":
            flavour = HeroRoller.ROLL_TYPE.SUCCESS;
            roller.makeSuccessRoll();
            break;

        case "f":
            flavour = HeroRoller.ROLL_TYPE.FLASH;
            roller.makeFlashRoll();
            break;

        default:
            flavour = HeroRoller.ROLL_TYPE.BASIC;
            roller.makeBasicRoll();
            break;
    }

    // Capitalize the first letter
    flavour = `${flavour.charAt(0).toUpperCase() + flavour.slice(1)} attack`;

    roller
        .addDice(Math.trunc(numDice))
        .addDiceMinus1(negativeTermWithDice ? 1 : 0)
        .addHalfDice(numDice % 1 ? 1 : 0)
        .addNumber(Math.trunc(numericTerm));

    await roller.roll();

    if (useHitLocations) {
        flavour += ` to ${roller.getHitLocation().fullName}`;
    }
    const cardHtml = await roller.render(flavour);

    const speaker = ChatMessage.getSpeaker();
    const chatData = {
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: roller.rawRolls(),
        user: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
}
