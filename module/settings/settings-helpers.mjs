import { HEROSYS } from "../herosystem6e.mjs";
import { CreateHeroCompendiums } from "../heroCompendiums.mjs";
//import { CampaignRulesSettingsConfig } from "./campaign-rules-settings.mjs";

export let overrideCanAct = false;

class StunMultiplierMenu extends FormApplication {
    static get defaultOptions() {
        const defaultOptions = super.defaultOptions;
        const options = foundry.utils.mergeObject(defaultOptions, {
            classes: ["form"],
            popOut: true,
            template: `systems/${HEROSYS.module}/templates/configuration/custom-stun-multiplier.hbs`,
            id: "stun-multiplier-form-application",
            closeOnSubmit: false, // do not close when submitted
            submitOnChange: true, // submit when any input changes
            title: "Custom STUN Multiplier Settings",
            width: "640",
        });

        return options;
    }

    async getData() {
        const customStunMultiplier = game.settings.get(
            game.system.id,
            "NonStandardStunMultiplierForKillingAttackBackingSetting",
        );

        return customStunMultiplier;
    }

    async _updateObject(_event, formData) {
        const data = foundry.utils.expandObject(formData);

        if (typeof data.d6Count !== "number") {
            data.d6Count = 0;
        }
        if (typeof data.halfDieCount !== "number") {
            data.halfDieCount = 0;
        }
        if (typeof data.d6Less1DieCount !== "number") {
            data.d6Less1DieCount = 0;
        }
        if (typeof data.constant !== "number") {
            data.constant = 0;
        }

        await game.settings.set(game.system.id, "NonStandardStunMultiplierForKillingAttackBackingSetting", data);
        await this.render();
    }
}

class AutomationMenu extends FormApplication {
    static get defaultOptions() {
        let options = super.defaultOptions;
        options = foundry.utils.mergeObject(options, {
            classes: ["form"],
            popOut: true,
            template: `systems/${HEROSYS.module}/templates/configuration/automation-menu.hbs`,
            id: "automation-form-application",
            closeOnSubmit: false, // do not close when submitted
            submitOnChange: true, // submit when any input changes
            title: "Automation Settings",
        });

        return options;
    }

    async getData() {
        const automation = game.settings.get(game.system.id, "automation");
        const settings = [
            { name: "Body", enabled: false },
            { name: "Stun", enabled: false },
            { name: "Endurance", enabled: false },
            { name: "Movement", enabled: false },
        ];
        switch (automation) {
            case "none":
                settings[0] = {
                    ...settings[0],
                    tokenType: "none",
                    gm: false,
                    owner: false,
                };
                settings[1] = {
                    ...settings[1],
                    tokenType: "none",
                    gm: false,
                    owner: false,
                };
                settings[2] = {
                    ...settings[2],
                    tokenType: "none",
                    gm: false,
                    owner: false,
                };
                break;
            case "npcOnly":
                settings[0] = {
                    ...settings[0],
                    tokenType: "npc",
                    gm: true,
                    owner: false,
                };
                settings[1] = {
                    ...settings[1],
                    tokenType: "npc",
                    gm: true,
                    owner: false,
                };
                settings[2] = {
                    ...settings[2],
                    tokenType: "npc",
                    gm: true,
                    owner: false,
                };
                break;
            case "pcEndOnly": //pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
                settings[0] = {
                    ...settings[0],
                    tokenType: "npc",
                    gm: true,
                    owner: false,
                };
                settings[1] = {
                    ...settings[1],
                    tokenType: "npc",
                    gm: true,
                    owner: false,
                };
                settings[2] = {
                    ...settings[2],
                    tokenType: "all",
                    gm: true,
                    owner: false,
                };
                break;
            default:
                settings[0] = {
                    ...settings[0],
                    tokenType: "all",
                    gm: true,
                    owner: true,
                };
                settings[1] = {
                    ...settings[1],
                    tokenType: "all",
                    gm: true,
                    owner: true,
                };
                settings[2] = {
                    ...settings[2],
                    tokenType: "all",
                    gm: true,
                    owner: true,
                };
                break;
        }

        return {
            settings,

            choices: {
                none: game.i18n.localize("Settings.AutomationPreview.Choices.None"),
                npcOnly: game.i18n.localize("Settings.AutomationPreview.Choices.NpcOnly"),
                pcEndOnly: game.i18n.localize("Settings.AutomationPreview.Choices.PcEndOnly"),
                all: game.i18n.localize("Settings.AutomationPreview.Choices.All"),
            },

            automation,
        };
    }

    async _updateObject(_event, formData) {
        const data = foundry.utils.expandObject(formData);
        await game.settings.set(game.system.id, "automation", data.automation);
        await this.render();
    }
}

export default class SettingsHelpers {
    // Initialize System Settings after the Init Hook
    static initLevelSettings() {
        const module = HEROSYS.module;

        game.settings.register(module, "stunned", {
            name: game.i18n.localize("Settings.UseStunned.Name"),
            hint: game.i18n.localize("Settings.UseStunned.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,

            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "use endurance", {
            name: game.i18n.localize("Settings.UseEndurance.Name"),
            hint: game.i18n.localize("Settings.UseEndurance.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "knockback", {
            name: game.i18n.localize("Settings.UseKnockback.Name"),
            hint: game.i18n.localize("Settings.UseKnockback.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "hit locations", {
            name: game.i18n.localize("Settings.HitLocation.Name"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "hitLocTracking", {
            name: game.i18n.localize("Settings.HitLocation.Tracking.Name"),
            hint: game.i18n.localize("Settings.HitLocation.Tracking.Hint"),
            scope: "world",
            config: true,
            type: String,
            choices: {
                none: game.i18n.localize("Settings.HitLocation.Tracking.Choices.DoNotTrack"),
                all: game.i18n.localize("Settings.HitLocation.Tracking.Choices.TrackForAll"),
            },
            default: "none",
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "optionalManeuvers", {
            name: game.i18n.localize("Settings.OptionalManeuvers.Name"),
            hint: game.i18n.localize("Settings.OptionalManeuvers.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "HAP", {
            name: game.i18n.localize("Settings.HAP.Name"),
            hint: game.i18n.localize("Settings.HAP.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: () => {
                // Loop through all active ApplicationV2 windows globally
                for (const app of foundry.applications.instances.values()) {
                    // Check if the application is an ActorSheet instance or a custom subclass of it
                    if (app instanceof foundry.applications.sheets.ActorSheetV2) {
                        // ApplicationV2 uses a render options configuration object rather than a boolean
                        app.render({ force: true });
                    }
                }
            },
        });

        game.settings.register(module, "equipmentWeightPercentage", {
            name: game.i18n.localize("Settings.Equipment.WeightPercentage.Name"),
            hint: game.i18n.localize("Settings.Equipment.WeightPercentage.Hint"),
            scope: "world",
            config: true,
            type: Number,
            range: {
                min: 0,
                max: 200,
                step: 10,
            },
            default: 100,
            onChange: async () => {
                for (let actor of game.actors.contents) {
                    await actor.applyEncumbrancePenalty();
                }
                for (const scene of game.scenes.contents) {
                    for (const token of scene.tokens) {
                        if (!token.actorLink && token.actor) {
                            await token.actor.applyEncumbrancePenalty();
                        }
                    }
                }
            },
        });

        game.settings.register(module, "automation", {
            name: game.i18n.localize("Settings.Automation.Name"),
            scope: "world",
            config: false, // UI is now part of AutomationMenu.  Intend to allow improved granularity.
            type: String,
            choices: {
                none: game.i18n.localize("Settings.Automation.Choices.None"),
                npcOnly: game.i18n.localize("Settings.Automation.Choices.NpcOnly"),
                pcEndOnly: game.i18n.localize("Settings.Automation.Choices.PcEndOnly"),
                all: game.i18n.localize("Settings.Automation.Choices.All"),
            },
            default: "all",
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.register(module, "automation2", {
            name: game.i18n.localize("Settings.AutomationPreview.Name"),
            scope: "world",
            config: false, // UI is now part of AutomationMenu.  Intend to allow improved granularity.
            type: Object,
            default: {},
            onChange: (value) => HEROSYS.log(false, value),
        });

        game.settings.registerMenu(module, "AutomationMenu", {
            name: game.i18n.localize("Settings.Automation.Menu.Name"),
            label: game.i18n.localize("Settings.Automation.Menu.Label"), // The text label used in the button
            icon: "fas fa-bars", // A Font Awesome icon used in the submenu button
            type: AutomationMenu, // A FormApplication subclass
            restricted: true, // Restrict this submenu to game master only?
        });

        // game.settings.registerMenu(module, "CampaignRulesMenu", {
        //     name: game.i18n.localize("Settings.CampaignRules.SettingsConfig.Name"),
        //     label: game.i18n.localize("Settings.CampaignRules.SettingsConfig.Label"),
        //     hint: game.i18n.localize("Settings.CampaignRules.SettingsConfig.Hint"),
        //     icon: "fas fa-bars",
        //     type: CampaignRulesSettingsConfig, // A FormApplication subclass
        //     restricted: false, // Restrict this submenu to game master only?
        // });

        game.settings.register(module, "HexTemplates", {
            name: game.i18n.localize("Settings.HexTemplates.Name"),
            hint: game.i18n.localize("Settings.HexTemplates.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            requiresReload: false,
        });

        game.settings.register(module, "DefaultEdition", {
            name: game.i18n.localize("Settings.DefaultEdition.Name"),
            hint: game.i18n.localize("Settings.DefaultEdition.Hint"),
            scope: "world",
            config: true,
            type: String,
            choices: {
                six: game.i18n.localize("Settings.DefaultEdition.Choices.six"),
                five: game.i18n.localize("Settings.DefaultEdition.Choices.five"),
            },
            default: "six",
            onChange: () => CreateHeroCompendiums(),
            requiresReload: false,
        });

        game.settings.register(module, "StrEnd", {
            name: game.i18n.localize("Settings.StrEnd.Name"),
            hint: game.i18n.localize("Settings.StrEnd.Hint"),
            scope: "world",
            config: true,
            type: String,
            choices: {
                five: game.i18n.localize("Settings.StrEnd.Choices.five"),
                ten: game.i18n.localize("Settings.StrEnd.Choices.ten"),
            },
            default: "ten",
            requiresReload: false,
        });

        game.settings.register(module, "DoubleDamageLimit", {
            name: game.i18n.localize("Settings.DoubleDamageLimit.Name"),
            hint: game.i18n.localize("Settings.DoubleDamageLimit.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: false,
        });

        game.settings.register(module, "DiceSkinning", {
            name: game.i18n.localize("Settings.DiceSkinning.Name"),
            hint: game.i18n.localize("Settings.DiceSkinning.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: false,
            onChange: (value) => HEROSYS.log(false, value),
            requiresReload: false,
        });

        // TODO(post-alpha): remove this setting in favour of FoundryVTT's core
        // combatTrackerConfig.turnMarker.disposition setting
        game.settings.register(module, "combatTrackerDispositionHighlighting", {
            name: game.i18n.localize("Settings.combatTrackerDispositionHighlighting.Name"),
            hint: game.i18n.localize("Settings.combatTrackerDispositionHighlighting.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.combat.render(),
            requiresReload: false,
        });

        game.settings.register(module, "lrAutoElevate", {
            name: game.i18n.localize("Settings.lrAutoElevate.Name"),
            hint: game.i18n.localize("Settings.lrAutoElevate.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: false,
        });

        game.settings.register(module, "CombatMovementOnlyOnActorsPhase", {
            name: game.i18n.localize("Settings.CombatMovementOnlyOnActorsPhase.Name"),
            hint: game.i18n.localize("Settings.CombatMovementOnlyOnActorsPhase.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.combat.render(),
            requiresReload: false,
        });

        game.settings.register(module, "ShowAllConditionalDefenses", {
            name: game.i18n.localize("Settings.ShowAllConditionalDefenses.Name"),
            hint: game.i18n.localize("Settings.ShowAllConditionalDefenses.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: false,
        });

        game.settings.register(module, "effectsPanel", {
            name: game.i18n.localize("Settings.effectsPanel.Name"),
            hint: game.i18n.localize("Settings.effectsPanel.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
            requiresReload: true,
        });

        game.settings.register(module, "ShowOnlyVisibleCombatants", {
            name: game.i18n.localize("Settings.ShowOnlyVisibleCombatants.Name"),
            hint: game.i18n.localize("Settings.ShowOnlyVisibleCombatants.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: false,
        });

        function determineKillingAttackDefaultDiceParts() {
            return { d6Count: 0, d6Less1DieCount: 0, halfDieCount: 0, constant: 0 };
        }

        game.settings.register(module, "NonStandardStunMultiplierForKillingAttackBackingSetting", {
            name: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Name"),
            label: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Label"),
            scope: "world",
            config: false,
            type: Object,
            default: determineKillingAttackDefaultDiceParts(),
            requiresReload: false,
        });

        game.settings.registerMenu(module, "NonStandardStunMultiplierForKillingAttack", {
            name: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Name"),
            label: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Label"),
            icon: "fas fa-bars", // A Font Awesome icon used in the submenu button
            type: StunMultiplierMenu,
            restricted: true, // Restrict this submenu to game master only
        });

        game.settings.register(module, "ShowGenericRoller", {
            name: game.i18n.localize("Settings.ShowGenericRoller.Name"),
            hint: game.i18n.localize("Settings.ShowGenericRoller.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
            requiresReload: true,
        });

        game.settings.register(module, "ShowCombatCharacteristicChanges", {
            name: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Name"),
            hint: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Hint"),
            scope: "world",
            config: true,
            type: String,
            default: "all",
            choices: {
                all: "All",
                pc: "PC only",
                none: "None",
            },
            requiresReload: false,
        });

        game.settings.register(module, "defaultDexInitiative", {
            name: game.i18n.localize("Settings.defaultDexInitiative.Name"),
            hint: game.i18n.localize("Settings.defaultDexInitiative.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: false,
        });

        game.settings.register(module, "ObjectCaching", {
            name: game.i18n.localize("Settings.ObjectCaching.Name"),
            hint: game.i18n.localize("Settings.ObjectCaching.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
            requiresReload: true,
        });

        game.settings.register(module, "metricUnits", {
            name: game.i18n.localize("Settings.MetricUnits.Name"),
            hint: game.i18n.localize("Settings.MetricUnits.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
            requiresReload: false,
        });

        game.settings.register(module, "alphaTesting", {
            name: game.i18n.localize("Settings.AlphaTesting.Name"),
            hint: game.i18n.localize("Settings.AlphaTesting.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: true,
        });

        // Keep track of last migration version
        game.settings.register(module, "lastMigration", {
            name: game.i18n.localize("Settings.AlphaTesting.LastMigration.Name"),
            scope: "world",
            config: game.settings.get(game.system.id, "alphaTesting"),
            type: String,
            default: "1.0.0",
            requiresReload: true,
        });

        // Keybinding for Override
        game.keybindings.register(module, "OverrideCanAct", {
            name: game.i18n.localize("keybindings.OverrideCanAct.Name"),
            hint: game.i18n.localize("keybindings.OverrideCanAct.Hint"),
            onDown: handleOverrideCanAct,
            onUp: handleOverrideCanAct,
            editable: [
                {
                    key: "ControlLeft",
                },
            ],
            precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
        });

        // Use new combat tracker
        game.settings.register(module, "singleCombatantTracker", {
            name: game.i18n.localize("Settings.AlphaTesting.singleCombatantTracker.Name"),
            hint: game.i18n.localize("Settings.AlphaTesting.singleCombatantTracker.Hint"),
            scope: "world",
            config: game.settings.get(game.system.id, "alphaTesting"),
            type: Boolean,
            default: false,
            requiresReload: true,
        });

        // All-In-One: combined ToHit/Damage/ApplyDamage into a single chatcard
        // game.settings.register(module, "allInOneToHitDamageApply", {
        //     name: "All In One",
        //     hint: `Combine to-hit, damage roll, and apply damage into a single chat card.`,
        //     scope: "world",
        //     config: game.settings.get(game.system.id, "alphaTesting"),
        //     type: Boolean,
        //     default: false,
        //     requiresReload: true,
        // });
    }
}

function handleOverrideCanAct(event) {
    // If keybindings are active when a focus in event happens, say if we have LCTRL for this modifier and we click on a toggle button,
    // FoundryVTT will generated an emulated keybinding event. Since this wasn't generated by the system we will ignore this.
    if (!event.event.isTrusted) {
        // But hold on.  What about toggling SET while we are ABORTED (really shouldn't happen, but we should allow it)
        console.log("!Trusted", event.up, event.down);
        return false;
    }

    if (event.up) {
        overrideCanAct = false;
    } else {
        overrideCanAct = event.key;
    }

    return false;
}

/**
 *
 * @param {string} settingKey
 * @param {any} newValue
 * @returns {any} - the settingKey's value before applying newValue
 */
export async function getAndSetGameSetting(settingKey, newValue) {
    const presentValue = game.settings.get(game.system.id, settingKey);
    await game.settings.set(game.system.id, settingKey, newValue);
    return presentValue;
}
