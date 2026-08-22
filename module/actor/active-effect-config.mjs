const { ActiveEffectConfig } = foundry.applications.sheets;

export class HeroSystemActiveEffectConfig extends ActiveEffectConfig {
    static DEFAULT_OPTIONS = {
        classes: ["herosystem-active-effect-config"],
        position: {
            width: 700,
        },
    };

    addHeroListeners(html, context) {
        const detailsSection = html.find("section[data-tab='details']")?.[0];
        if (detailsSection) {
            const originItem = fromUuidSync(context.source.origin);
            const token = fromUuidSync(context.source.origin?.match(/(.*).Actor/)?.[1]);
            const originText =
                (originItem ? `${token?.name || originItem.actor?.name}: ${originItem.name}` : context.source.origin) ||
                "";

            detailsSection.append(
                $(`
                <fieldset>
                    <div class="form-group">
                        <label>HERO.Origin</label>
                        <div class="form-fields">
                            <input type="text" name="originText" value="${originText}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.XMLID</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.XMLID" value="${context.source.flags[game.system.id]?.XMLID || ""}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.key</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.key" value="${context.source.flags[game.system.id]?.key || ""}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.adjustmentActivePoints</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.adjustmentActivePoints" value="${context.source.flags[game.system.id]?.adjustmentActivePoints || ""}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.source</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.source" value="${context.source.flags[game.system.id]?.source || ""}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.target</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.target" value="${context.source.flags[game.system.id]?.target || ""}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.targetDisplay</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.targetDisplay" value="${context.source.flags[game.system.id]?.targetDisplay || ""}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.type</label>
                        <div class="form-fields">
                            <input type="text" name="flags.${game.system.id}.type" value="${context.source.flags[game.system.id]?.type || ""}" disabled/>
                        </div>
                    </div>
                </fieldset>
                `)[0],
            );
        }

        const durationSection = html.find("section[data-tab='duration']")?.[0];
        if (durationSection) {
            const remaining =
                context.source.duration.startTime + context.source.duration.seconds - game.time.worldTime ||
                "Does not fade";
            const startTimeDisplay = new Date(context.source.duration.startTime * 1000)
                .toUTCString()
                .replace(" GMT", "");

            durationSection.append(
                $(`
                <fieldset>
                    <div class="form-group">
                        <label>HERO.Fade in (seconds)</label>
                        <div class="form-fields">
                            <input type="text" value="${remaining}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.startTime</label>
                        <div class="form-fields">
                            <input type="text" value="${context.source.duration.startTime}" disabled/>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HERO.startTimeDisplay</label>
                        <div class="form-fields">
                            <input type="text" value="${startTimeDisplay}" disabled/>
                        </div>
                    </div>
                </fieldset>
                `)[0],
            );
        }
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.addHeroListeners.call(this, $(this.element), context);
    }
}
