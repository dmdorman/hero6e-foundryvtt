import { HEROSYS } from "../herosystem6e.mjs";

export const extendTokenConfig = async function (tokenConfig, html, data) {
    // Ignore if bar3 not set
    if (!game.settings.get(game.system.id, "bar3")) {
        return html;
    }

    const resourceTab = html.find("div[data-tab='resources']");
    HEROSYS.log(false, resourceTab);

    // Add form group for bar 3
    let bar3 = getBarExtendedAttribute.bind(tokenConfig.token)("bar3");
    let barAttributes = data.barAttributes["Attribute Bars"];
    let singleValues = data.barAttributes["Single Values"];
    let bar3FormGroup = await renderTemplate(`systems/${HEROSYS.module}/module/bar3/resource-form-group.hbs`, {
        bar3,
        barAttributes,
        singleValues,
    });
    resourceTab.append(bar3FormGroup);

    // Add event for bar3
    let el = resourceTab.find(`select[name="bar3.attribute"]`);
    el.change(_onBarChange.bind(tokenConfig));

    // Add event for Update Token (save)
    html.submit(_onSubmit.bind(tokenConfig));

    // Copied from foundry.TokenConfig as couldn't figure out how to extend it
    async function _onBarChange(event) {
        const form = event.target.form;
        const attr = this.token.getBarAttribute("", {
            alternative: event.target.value,
        });
        const bar = event.target.name.split(".").shift();
        form.querySelector(`input.${bar}-value`).value = attr !== null ? attr.value : "";
        form.querySelector(`input.${bar}-max`).value = attr !== null && attr.type === "bar" ? attr.max : "";
    }

    async function _onSubmit() {
        const bar3 = $(`select[name="bar3.attribute"]`).val();

        HEROSYS.log(false, "_onSubmit", bar3);
        await this.token.update({ bar3: { attribute: bar3 } });
    }

    // Resize resource tab
    if (resourceTab.hasClass("active")) adjustConfigHeight(tokenConfig.element);

    return html;
};

export function getBarExtendedAttribute(barName, alternative) {
    const attr = alternative || this[barName]?.attribute || this.flags[game.system.id]?.[barName]?.attribute;
    if (!attr || !this.actor) return null;
    let data = foundry.utils.getProperty(this.actor.system, attr);
    if (data === null || data === undefined) return null;
    const model = game.model.Actor[this.actor.type];

    // Single values
    if (Number.isNumeric(data)) {
        return {
            type: "value",
            attribute: attr,
            value: Number(data),
            editable: foundry.utils.hasProperty(model, attr),
        };
    }

    // Attribute objects
    else if ("value" in data && "max" in data) {
        return {
            type: "bar",
            attribute: attr,
            value: parseInt(data.value || 0),
            max: parseInt(data.max || 0),
            editable: foundry.utils.hasProperty(model, `${attr}.value`),
            label: attr.split(".").pop(),
        };
    }

    // Otherwise null
    return null;
}

function adjustConfigHeight(html) {
    if (html[0].tagName === "FORM") html = html.parent().parent(); // Fix parent when force render is false.
    const height = parseInt(html.css("height"), 10);
    html.css("height", Math.max(height, 350) + "px");
}
