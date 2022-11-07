import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.js";
import { HeroSystem6eActorSheet } from "../actor/actor-sheet.js";
import { HeroSystem6eCard } from "./card.js";

export class HeroSystem6eHitLocCard extends HeroSystem6eCard {
    /**
   * Handle execution of a chat card action via a click event on one of the card buttons
   * @param {Event} event       The originating click event
   * @returns {Promise}         A promise which resolves once the handler workflow is complete
   * @private
   */
  
    static async _renderInternal() {
        let hitLocMap = {};
        for (const [key, value] of Object.entries(CONFIG.HERO.hitLocations)) {
            hitLocMap[key] = {
                stunx: "x"+value[0],
                nstunx: "x"+value[1],
                bodyx: "x"+value[2],
                tohit: value[3],
            };
        }

        const templateData = {
            hitLoc: hitLocMap
        }

        console.log(templateData)

        var path = "systems/hero6e-foundryvtt-experimental/templates/chat/item-hitLoc-card.html";

        return await renderTemplate(path, templateData);
    }

    async render() {
        return await HeroSystem6eHitLocCard._renderInternal();
    }

    async init(card) {
        super.init(card);
        this.target = await HeroSystem6eHitLocCard._getChatCardTarget(card);
    }

    static async createFromAttackCard() {
        let cardHtml = await HeroSystem6eHitLocCard._renderInternal();
        
        const chatData = {
            content: cardHtml
        }

        return ChatMessage.create(chatData);
    }
}