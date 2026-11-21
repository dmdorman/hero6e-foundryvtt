import { HeroApplication } from "../applications/api/application.mjs";

//import { getCharacteristicInfoArrayForActor } from "../utility/util.mjs";

export class CampaignRulesSettingsConfig extends HeroApplication {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", async function () {
            CampaignRulesSettingsConfig.initializeTemplate();
        });
    }

    static DEFAULT_OPTIONS = {
        id: "campaign-rules-setting-config",
        window: {
            title: "Settings.CampaignRules.SettingsConfig.Label",
        },
    };

    static initializeTemplate() {
        // HEROSYS.module isn't defined yet so using game.system.id
        const systemId = game.system.id;

        CampaignRulesSettingsConfig.PARTS = {
            tabs: {
                // Foundry-provided generic template
                template: `templates/generic/tab-navigation.hbs`,
                // classes: ['sysclass'], // Optionally add extra classes to the part for extra customization
            },
            pointLimits: {
                template: `systems/${systemId}/templates/configuration/campaign-rules/campaign-rules-point-limits.hbs`,
                scrollable: [""],
            },
            characteristicMaxima: {
                template: `systems/${systemId}/templates/configuration/campaign-rules/campaign-rules-characteristic-maxima.hbs`,
                scrollable: [""],
            },
            rules: {
                template: `systems/${systemId}/templates/configuration/campaign-rules/campaign-rules-rules.hbs`,
                scrollable: [""],
            },
            settings: {
                template: `systems/${systemId}/templates/configuration/campaign-rules/campaign-rules-settings.hbs`,
                scrollable: [""],
            },
        };
    }

    static TABS = {
        primary: {
            tabs: [{ id: "pointLimits" }, { id: "characteristicMaxima" }, { id: "rules" }, { id: "settings" }],
            labelPrefix: "Settings.CampaignRules.Tabs", // Optional. Prepended to the id to generate a localization key
            initial: "characteristicMaxima", // Set the initial tab
        },
    };

    async _preparePartContext(partId, context) {
        context = await super._preparePartContext(partId, context);
        context.tab = context.tabs[partId];
        context.gameSystemId ??= game.system.id;

        switch (partId) {
            case "characteristicMaxima":
                {
                    const DefaultEdition = game.settings.get(game.system.id, "DefaultEdition");
                    const powerList = DefaultEdition === "five" ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
                    context.fields = [];

                    for (const baseInfo of powerList.filter((baseInfo) => baseInfo.type.includes("characteristic"))) {
                        context.fields.push({ label: baseInfo.key });
                    }
                }
                break;
        }
        return context;
    }
}
