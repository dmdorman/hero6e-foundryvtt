/** Large portions have been inspired by https://gitlab.com/woodentavern/foundryvtt-bar-brawl */
import { HEROSYS } from "../herosystem6e.mjs";
import { getBarExtendedAttribute } from "./extendTokenConfig.mjs";

// TokenHUD does not appear to be extendable, so hook on renderTokenHUD

/**
 * Modifies the given HTML to render additional resource input fields.
 * @param {TokenHUD} tokenHud The HUD object.
 * @param {jQuery} html The jQuery element of the token HUD.
 * @param {Object} data The data of the token HUD.
 */
export const HeroSystem6eTokenHud = async function (tokenHud, html, data) {
    // Ignore if bar3 not set
    if (!game.settings.get(game.system.id, "bar3")) {
        return html;
    }

    // TokenHud includes most of the clickable controls/inputs
    // it does not include the bar's themselves.

    // there is a "col left", "col middle", and "col right"

    // remove the default attributes from the middle column
    const middleColumn = html.find(".col.middle");
    middleColumn.find("div.attribute").remove();
    //html.find(".col.middle .bar1").remove()

    let actor = tokenHud.actor || tokenHud.object.document.actor || tokenHud.object.document.getActor();
    data.actor = actor;

    // Define bar3data
    const bar3 = getBarExtendedAttribute.bind(data)("bar3"); //tokenHud.object.document.getBarAttribute("bar3")
    data.bar3Data = bar3;
    data.displayBar3 = bar3 && bar3.type !== "none";

    // Add top bar3
    let bars = [];
    bars.push(data.bar3Data || {});
    bars[0].name = "bar3";
    bars[0].maxcolor = "blue";
    for (let i = 0; i < bars.length; i++) {
        bars[i].title = (bars[i].attribute || "").replace("characteristics.", "");
    }
    middleColumn.append(await renderBarInput(bars));

    // Add bottom bar1 & bar2
    bars = [];
    bars.push(data.bar1Data || {});
    bars[0].name = "bar1";
    bars[0].maxcolor = "#CC5500";
    bars.push(data.bar2Data || {});
    bars[1].name = "bar2";
    bars[1].maxcolor = "green";
    for (let i = 0; i < bars.length; i++) {
        bars[i].title = (bars[i].attribute || "").replace("characteristics.", "");
    }
    middleColumn.append(await renderBarInput(bars));

    // Add input events (__onAttributeUpdate is broken for bar3)
    html.find(".attribute.hero-attribute input")
        .click(tokenHud._onAttributeClick)
        .keydown(tokenHud._onAttributeKeydown.bind(tokenHud))
        .focusout(_onAttributeUpdate.bind(tokenHud));

    async function _onAttributeUpdate(event) {
        event.preventDefault();
        if (!this.object) return;

        // Acquire string input
        const input = event.currentTarget;
        let strVal = input.value.trim();
        let isDelta = strVal.startsWith("+") || strVal.startsWith("-");
        if (strVal.startsWith("=")) strVal = strVal.slice(1);
        let value = Number(strVal);

        // For attribute bar values, update the associated Actor
        const bar = input.dataset.bar;
        const actor = this.object?.actor;
        if (bar && actor) {
            const attr = getBarExtendedAttribute.bind(this.object.document)(bar); //this.object.document.getBarAttribute(bar);
            if (isDelta || attr.attribute !== value) {
                actor.modifyTokenAttribute(attr.attribute, value, isDelta, attr.type === "bar");
            }
        }

        // Otherwise update the Token directly
        else {
            const current = foundry.utils.getProperty(this.object.document, input.name);
            this.object.document.update({
                [input.name]: isDelta ? current + value : value,
            });
        }

        // Clear the HUD
        //if ( !this.#hoverControlIcon ) this.clear();
        this.clear();
    }
};

/**
 * Renders the input template for the given bars.
 * @param {Object[]} bars The bars to render inputs for.
 * @param {string} css The CSS classes of the input container.
 * @returns {Promise.<string>} A promise representing the rendered inputs as HTML string.
 */
function renderBarInput(bars) {
    const css = bars.length > 1 ? "compact" : "";
    return renderTemplate(`systems/${HEROSYS.module}/module/bar3/resource-hud.hbs`, { bars, css });
}
