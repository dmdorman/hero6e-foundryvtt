import { HeroSystem6eRegionDocument } from "./heroRegion.mjs";
import { processHapCardUpdate } from "./item/item-attack.mjs";

export class HeroSocketHandler {
    static Initialize() {
        HeroSocketHandler.registerSocketHandlers();
    }

    static registerSocketHandlers() {
        // game.socket.emit(`system.${game.system.id}`, {
        //     operation: ,
        //     userId: game.user.id,
        //     token:
        //     actor:
        //     regionUuid
        // });

        game.socket.on(`system.${game.system.id}`, async (data) => {
            const user = User.get(data.userId);
            console.log(`HeroSocketHandler operation=${data.operation}, user=${user?.name || data.userId}`, data);

            //TODO: Move all the game.user !== game.users.activeGM) checks in the functions, and have every client call the function.

            switch (data.operation) {
                case "nextHeroCombatantSingle":
                    if (game.user !== game.users.activeGM) return;
                    await game.combat.nextHeroCombatantSingle();
                    break;
                case "nextRound":
                case "nextTurn":
                case "previousTurn":
                case "previousRound": {
                    if (game.user !== game.users.activeGM) return;
                    // combatId is sent by the single-combatant stack; legacy emits omit it
                    const combat = game.combats.get(data.combatId) ?? game.combat;
                    await combat?.[data.operation]?.();
                    break;
                }
                case "lrPreempt": {
                    if (game.user !== game.users.activeGM) return;
                    const combat = game.combats.get(data.combatId) ?? game.combat;
                    await combat?.lrPreemptPointer?.(data.combatantId, data.activeId ?? null);
                    break;
                }
                case "updateChatMessage": {
                    if (game.user !== game.users.activeGM) return;

                    const message = ChatMessage.get(data.messageId);
                    if (!message) {
                        console.error(`Message not found: ${data.messageId}`);
                        return;
                    }
                    if (!data.content) {
                        console.error(`Message content not found.`);
                        return;
                    }
                    await message.update({ content: data.content });
                    break;
                }

                case "applyBehaviorTokenAutomaticTargeting": {
                    if (game.user !== game.users.activeGM) return;
                    if (!data.regionUuid) {
                        console.error(`Region UUID not found.`);
                        return;
                    }
                    await HeroSystem6eRegionDocument.applyBehaviorTokenAutomaticTargeting(data.regionUuid);
                    break;
                }

                case "spendHapUpdateCard": {
                    // Ensure only the primary active GM runs the database operation
                    if (game.user.id !== game.users.activeGM?.id) return;

                    await processHapCardUpdate({
                        messageId: data.messageId,
                        targetTokenUuid: data.targetTokenUuid,
                        hapsToSpend: data.hapsToSpend,
                        targetActorName: data.targetActorName,
                    });
                    break;
                }

                default: {
                    throw new Error(`unhandled operation ${data?.operation}`);
                }
            }
        });
    }
}
