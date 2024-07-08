// Possible reference: https://github.com/foundryvtt/foundryvtt/issues/9026
// Possible reference: https://gitlab.com/woodentavern/foundryvtt-bar-brawl

import { getBarExtendedAttribute } from "../bar3/extendTokenConfig.mjs";
import { HEROSYS } from "../herosystem6e.mjs";
import { clamp } from "../utility/compatibility.mjs";

export class HeroSystem6eTokenDocument extends TokenDocument {
    constructor(data, context) {
        super(data, context);
        //data.bars.bar3 = bars.addChild(new PIXI.Graphics());
    }

    getBarAttribute(barName, alternative) {
        //HEROSYS.log(false, "getBarAttribute")
        let data = super.getBarAttribute(barName, alternative);

        if (barName == "bar3") {
            const attr = alternative || this.flags.bar3?.attribute; //this[barName]?.attribute;
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

        // Add label
        let attr = alternative?.alternative || this[barName]?.attribute;
        if (attr && attr.indexOf(".") > -1) attr = attr.split(".").pop();
        if (attr) return { ...data, label: attr };
        return data;
    }

    static defineSchema() {
        //HEROSYS.log(false, "defineSchema")
        let schema = super.defineSchema();
        schema.bar3 = new foundry.data.fields.SchemaField({
            attribute: new foundry.data.fields.StringField({
                required: true,
                nullable: true,
                blank: false,
                initial: () => "characteristics.end",
            }),
        });
        return schema;
    }
}

export class HeroSystem6eToken extends Token {
    constructor(document) {
        super(document);
    }

    getData() {
        let data = super.getData();
        data.bar3 = this.token.flags.bar3;
        return data;
    }

    /**
     * Add or remove the currently controlled Tokens from the active combat encounter
     * @param {Combat} [combat]    A specific combat encounter to which this Token should be added
     * @returns {Promise<Token>} The Token which initiated the toggle
     */
    async toggleCombat(combat) {
        await super.toggleCombat(combat);
    }

    _drawBar(number, bar, data) {
        // Ignore if bar3 not set
        if (!game.settings.get(game.system.id, "bar3")) {
            return super._drawBar(number, bar, data);
        }

        const val = Number(data.value);
        const pct = clamp(val, 0, data.max) / data.max;

        // Determine sizing
        let h = Math.max(canvas.dimensions.size / 12, 8);
        const w = this.w;
        const bs = clamp(h / 8, 1, 2);
        if (this.document.height >= 2) h *= 1.6; // Enlarge the bar for large tokens

        // Determine the color to use
        const blk = 0x000000;
        let color;
        if (number === 0) color = this.HeroColor([1 - pct / 2, pct, 0]);
        else color = this.HeroColor([0.5 * pct, 0.7 * pct, 0.5 + pct / 2]);

        // Override for Hero
        if (number === 0) color = this.HeroColor([1, 0, 0]); // Body
        if (number === 1) color = this.HeroColor([0, 1, 0]); // Stun
        if (number === 2) color = this.HeroColor([0.5, 0.5, 1]); // Endurance

        if (!bar) {
            HEROSYS.log(false, "bar is undefined");
            return;
        }
        // Draw the bar
        bar.clear();
        bar.beginFill(blk, 0.5).lineStyle(bs, blk, 1.0).drawRoundedRect(0, 0, this.w, h, 3);
        bar.beginFill(color, 1.0)
            .lineStyle(bs, blk, 1.0)
            .drawRoundedRect(0, 0, pct * w, h, 2);

        // Enlarge the bar for large tokens
        if (this.document.height >= 2) {
            h *= 1.6;
        }

        // Set position (stack bars from bottom to top)
        let posY = this.h - h * (number + 1);
        bar.position.set(0, posY);

        // Opacity
        bar.alpha = 0.8;

        // Label
        this.drawBarLabel(bar, data, data.value, data.max);
    }

    HeroColor(ary) {
        // v11
        if (PIXI.Color) {
            return new PIXI.Color(ary).toNumber();
        }

        // v10
        return PIXI.utils.rgb2hex(ary);
    }

    drawBarLabel(bar, data, value, max) {
        // remove any existing children (may want save the previous one, not sure yet)
        while (bar.children[0]) {
            bar.removeChild(bar.children[0]);
        }

        bar.resolution = 2;

        let textStyle = "fraction";
        switch (textStyle) {
            case "none":
                if (data.label) this.createBarLabel(bar, data, data.label);
                break;

            case "fraction":
                this.createBarLabel(bar, data, `${data.label ? data.label + "  " : ""}${value} / ${max}`);
                break;

            case "percent":
                {
                    // Label does not match bar percentage because of possible inversion.
                    const percentage = Math.round((clamp(value, 0, max) / max) * 100);
                    this.createBarLabel(bar, data, `${data.label ? data.label + "  " : ""}${percentage}%`);
                }
                break;

            default:
                console.error(`Unknown label style`);
                break;
        }
    }

    createBarLabel(bar, data, text) {
        let font = CONFIG.canvasTextStyle.clone();
        font.fontSize = bar.height;
        //font.fontSize = data.fgImage || data.bgImage ? getBarHeight(token, bar.contentWidth) : bar.contentHeight;

        const barText = new PIXI.Text(text, font);
        barText.name = bar.name + "-text";
        barText.x = bar.width / 2;
        barText.y = bar.height * 0.44; // For some reason 50% is slighly low
        barText.anchor.set(0.5);
        barText.resolution = 2;
        barText.height = bar.height;
        //barText.width = bar.width
        if (data.invertDirection) barText.scale.x *= -1;
        bar.addChild(barText);
    }

    drawBars() {
        //HEROSYS.log(false, "drawBars")

        // Ignore if bar3 not set
        if (!game.settings.get(game.system.id, "bar3")) {
            return super.drawBars();
        }

        if (!this.actor || this.document.displayBars === CONST.TOKEN_DISPLAY_MODES.NONE) {
            return (this.bars.visible = false);
        }

        // Custom bar 3
        this.bars.bar3 = this.bars.addChild(new PIXI.Graphics());

        ["bar1", "bar2", "bar3"].forEach((b, i) => {
            let bar = this.bars[b];
            const attr = getBarExtendedAttribute.bind(this.document)(b); // : this.document.getBarAttribute(b);
            if (!attr || attr.type !== "bar") return (bar.visible = false);
            this._drawBar(i, bar, attr);
            bar.visible = true;
        });

        if (!this._canViewMode) {
            HEROSYS.log(false, "this._canViewMode is undefined");
            return;
        }
        this.bars.visible = this._canViewMode(this.document.displayBars);
    }

    // prepareBaseData() {
    //     super.prepareBaseData();
    //     HEROSYS.log(false, "prepareBaseData")
    // }

    // _onCreate(data)
    // {

    //     HEROSYS.log(false, "_onCreate", data)
    //     alert("_onCreate")
    // }
}
