import { HEROSYS } from "../herosystem6e.mjs";
import { getPowerInfo } from "../utility/util.mjs";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class HeroSystem6eItem2Sheet extends ItemSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["herosystem6e", "sheet", "item"],
            width: 520,
            height: 660,
            //tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
            scrollY: [".sheet-body"],
        });
    }

    /** @override */
    get template() {
        const path = `systems/${HEROSYS.module}/templates/item`;
        // Return a single sheet for all item types.
        return `${path}/item-sheet.hbs`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const data = super.getData();

        data.config = CONFIG.HERO;
        data.alphaTesting = game.settings.get(game.system.id, "alphaTesting");

        // Easy reference to ActiveEffects with an origin of this item
        // if (this.actor) {
        //     data.effects = this.actor.effects.filter(o => o.origin === item.uuid)
        // } else {
        //     data.effects = this.document.effects
        // }

        const item = data.item;
        data.system = item.system;
        const configPowerInfo = getPowerInfo({
            xmlid: item.system.XMLID,
            actor: item?.actor,
        });
        data.sheet = { ...(configPowerInfo?.sheet || {}) };
        data.totalingOptions = configPowerInfo ? configPowerInfo.type.includes("characteristic") : null;

        // OPTIONID
        if (item.system.OPTIONID && !data.sheet.OPTIONID?.label) {
            data.sheet.OPTIONID = {
                label: "OPTIONID",
            };
        }

        // INPUT
        if (item.system.INPUT && !data.sheet.INPUT?.label) {
            data.sheet.INPUT = {
                label: "INPUT",
            };
        }

        // SFX
        data.sheet.SFX = {
            //dataList: sfx
            label: "SFX",
            selectOptions: CONFIG.HERO.SFX.reduce((current, item) => {
                current[item] = item;
                return current;
            }, {}),
        };

        // LEVELS
        data.sheet.LEVELS = {
            label: "LEVELS",
        };

        return data;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
    }

    async _updateObject(event, formData) {
        console.log("_updateObject");
        event.preventDefault();

        // Standard UpdateObject
        await super._updateObject(event, formData);

        await this.item._postUpload();
    }
}
