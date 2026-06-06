import { HeroSystem6eRegionDocument } from "./heroRegion.mjs";

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
                    if (game.user !== game.users.activeGM) return;
                    await game.combat.nextRound();
                    break;
                case "nextTurn":
                    if (game.user !== game.users.activeGM) return;
                    await game.combat.nextTurn();
                    break;
                case "previousTurn":
                    if (game.user !== game.users.activeGM) return;
                    await game.combat.previousTurn();
                    break;
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

                default: {
                    throw new Error(`unhandled operation ${data?.operation}`);
                }
            }
        });
    }
}
