import { HEROSYS } from "../herosystem6e.mjs";
import { CreateHeroCompendiums } from "../heroCompendiums.mjs";
//import { CampaignRulesSettingsConfig } from "./campaign-rules-settings.mjs";

export let overrideCanAct = false;

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Shared shell for AppV2 settings submenus: a form window that persists every change and stays open.
class HeroSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        classes: ["herosystem6e"],
        position: {
            height: "auto",
        },
        window: {
            contentClasses: ["standard-form"],
        },
        form: {
            submitOnChange: true,
            closeOnSubmit: false,
        },
    };
}

class StunMultiplierMenu extends HeroSettingsMenu {
    static {
        Hooks.once("init", () => {
            StunMultiplierMenu.PARTS = {
                body: {
                    template: `systems/${game.system.id}/templates/configuration/custom-stun-multiplier.hbs`,
                },
            };
        });
    }

    static DEFAULT_OPTIONS = {
        id: "stun-multiplier-form-application",
        position: {
            width: 640,
        },
        window: {
            title: "Custom STUN Multiplier Settings",
        },
        form: {
            handler: StunMultiplierMenu.#onSubmit,
        },
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const customStunMultiplier = game.settings.get(
            game.system.id,
            "NonStandardStunMultiplierForKillingAttackBackingSetting",
        );

        return foundry.utils.mergeObject(context, customStunMultiplier);
    }

    static async #onSubmit(event, form, formData) {
        const data = foundry.utils.expandObject(formData.object);

        for (const key of ["d6Count", "halfDieCount", "d6Less1DieCount", "constant"]) {
            if (typeof data[key] !== "number") {
                data[key] = 0;
            }
        }

        await game.settings.set(game.system.id, "NonStandardStunMultiplierForKillingAttackBackingSetting", data);
        this.render();
    }
}

class AutomationMenu extends HeroSettingsMenu {
    static {
        Hooks.once("init", () => {
            AutomationMenu.PARTS = {
                body: {
                    template: `systems/${game.system.id}/templates/configuration/automation-menu.hbs`,
                },
            };
        });
    }

    static DEFAULT_OPTIONS = {
        id: "automation-form-application",
        position: {
            width: 450,
        },
        window: {
            title: "Automation Settings",
        },
        form: {
            handler: AutomationMenu.#onSubmit,
        },
    };

    static async #onSubmit(event, form, formData) {
        const data = foundry.utils.expandObject(formData.object);
        await game.settings.set(game.system.id, "automation", data.automation);
        this.render();
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
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

        return foundry.utils.mergeObject(context, {
            settings,

            choices: {
                none: game.i18n.localize("Settings.AutomationPreview.Choices.None"),
                npcOnly: game.i18n.localize("Settings.AutomationPreview.Choices.NpcOnly"),
                pcEndOnly: game.i18n.localize("Settings.AutomationPreview.Choices.PcEndOnly"),
                all: game.i18n.localize("Settings.AutomationPreview.Choices.All"),
            },

            automation,
        });
    }
}

export default class SettingsHelpers {
    // Initialize System Settings after the Init Hook.
    // Registration order matters: the V14 settings window renders entries in
    // registration order (menus always float to the top of the section), so the
    // calls below are arranged in the groups declared in SETTINGS_GROUPS.
    static initLevelSettings() {
        const module = HEROSYS.module;

        game.settings.register(module, "automation", {
            name: game.i18n.localize("Settings.Automation.Name"),
            scope: "world",
            config: false, // UI is part of AutomationMenu
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

        game.settings.registerMenu(module, "AutomationMenu", {
            name: game.i18n.localize("Settings.Automation.Menu.Name"),
            label: game.i18n.localize("Settings.Automation.Menu.Label"),
            icon: "fas fa-bars",
            type: AutomationMenu,
            restricted: true,
        });

        // Stubbed for future work; see campaign-rules-settings.mjs
        // game.settings.registerMenu(module, "CampaignRulesMenu", {
        //     name: game.i18n.localize("Settings.CampaignRules.SettingsConfig.Name"),
        //     label: game.i18n.localize("Settings.CampaignRules.SettingsConfig.Label"),
        //     hint: game.i18n.localize("Settings.CampaignRules.SettingsConfig.Hint"),
        //     icon: "fas fa-bars",
        //     type: CampaignRulesSettingsConfig, // A FormApplication subclass
        //     restricted: false, // Restrict this submenu to game master only?
        // });

        game.settings.register(module, "NonStandardStunMultiplierForKillingAttackBackingSetting", {
            name: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Name"),
            scope: "world",
            config: false, // UI is part of StunMultiplierMenu
            type: Object,
            default: { d6Count: 0, d6Less1DieCount: 0, halfDieCount: 0, constant: 0 },
            requiresReload: false,
        });

        game.settings.registerMenu(module, "NonStandardStunMultiplierForKillingAttack", {
            name: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Name"),
            label: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Label"),
            hint: game.i18n.localize("Settings.NonStandardStunMultiplierForKillingAttack.Hint"),
            icon: "fas fa-bars",
            type: StunMultiplierMenu,
            restricted: true,
        });

        // Same-actor tokens share a tie-break roll and collapse to a ×N row;
        // off = every token rolls and renders independently. UI lives in core's
        // Combat Tracker Settings dialog (injectTrackerConfigFields).
        game.settings.register(module, "combatTrackerGrouping", {
            name: game.i18n.localize("Settings.combatTrackerGrouping.Name"),
            hint: game.i18n.localize("Settings.combatTrackerGrouping.Hint"),
            scope: "world",
            config: false,
            type: Boolean,
            default: true,
            onChange: () => ui.combat?.render(),
        });

        // --- Rules & Campaign (world) ---

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
            hint: game.i18n.localize("Settings.HitLocation.Hint"),
            scope: "world",
            config: true,
            type: String,
            choices: {
                noHitLocations: game.i18n.localize("Settings.HitLocation.Choices.NoHitLocations"),
                hitLocationsWithoutSectional: game.i18n.localize("Settings.HitLocation.Choices.HitWithoutSectional"),
                hitLocationsWithSectional: game.i18n.localize("Settings.HitLocation.Choices.HitWithSectional"),
            },
            default: "noHitLocations",
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

        game.settings.register(module, "HexTemplates", {
            name: game.i18n.localize("Settings.HexTemplates.Name"),
            hint: game.i18n.localize("Settings.HexTemplates.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
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

        game.settings.register(module, "ShowAllConditionalDefenses", {
            name: game.i18n.localize("Settings.ShowAllConditionalDefenses.Name"),
            hint: game.i18n.localize("Settings.ShowAllConditionalDefenses.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            requiresReload: false,
        });

        game.settings.register(module, "ShowCombatCharacteristicChanges", {
            name: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Name"),
            hint: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Hint"),
            scope: "world",
            config: true,
            type: String,
            default: "all",
            choices: {
                all: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Choices.All"),
                pc: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Choices.PcOnly"),
                none: game.i18n.localize("Settings.ShowCombatCharacteristicChanges.Choices.None"),
            },
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

        // --- Combat Tracker (world) ---

        // GM-option tie-break: Fast Draw wins exact-DEX ties
        game.settings.register(module, "fastDrawTieBreak", {
            name: game.i18n.localize("Settings.fastDrawTieBreak.Name"),
            hint: game.i18n.localize("Settings.fastDrawTieBreak.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        });

        // Pacing option: spend a Stunned character's Phase recovering
        // automatically instead of stopping the tracker on them
        game.settings.register(module, "stunnedAutoSkip", {
            name: game.i18n.localize("Settings.stunnedAutoSkip.Name"),
            hint: game.i18n.localize("Settings.stunnedAutoSkip.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
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

        // Per-client density toggle. Also injected into core's Combat Tracker
        // Settings dialog, but that dialog's gear is GM-only — the settings
        // list is the only path players have to it.
        game.settings.register(module, "combatTrackerCompact", {
            name: game.i18n.localize("Settings.combatTrackerCompact.Name"),
            hint: game.i18n.localize("Settings.combatTrackerCompact.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: false,
            onChange: () => ui.combat?.render(),
        });

        // --- Client & Display ---

        game.settings.register(module, "metricUnits", {
            name: game.i18n.localize("Settings.MetricUnits.Name"),
            hint: game.i18n.localize("Settings.MetricUnits.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
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

        game.settings.register(module, "effectsPanel", {
            name: game.i18n.localize("Settings.effectsPanel.Name"),
            hint: game.i18n.localize("Settings.effectsPanel.Hint"),
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
            requiresReload: true,
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

        // Developer/support toggles: client-scoped (each client caches and logs
        // for itself) but hidden from players' settings UI. game.user is not
        // initialized during init, so the role comes from the raw world payload.
        // Still settable per-client from the console for debugging sessions.
        const currentUserIsGM =
            (game.data.users?.find((u) => u._id === game.userId)?.role ?? CONST.USER_ROLES.NONE) >=
            CONST.USER_ROLES.ASSISTANT;

        game.settings.register(module, "ObjectCaching", {
            name: game.i18n.localize("Settings.ObjectCaching.Name"),
            hint: game.i18n.localize("Settings.ObjectCaching.Hint"),
            scope: "client",
            config: currentUserIsGM,
            type: Boolean,
            default: true,
            requiresReload: true,
        });

        game.settings.register(module, "alphaTesting", {
            name: game.i18n.localize("Settings.AlphaTesting.Name"),
            hint: game.i18n.localize("Settings.AlphaTesting.Hint"),
            scope: "client",
            config: currentUserIsGM,
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

// Visual grouping for the settings window. Core's V14 SettingsConfig renders a
// flat list in registration order with no grouping support, so headers are
// injected above the first visible setting of each group. Each group runs from
// its firstKey up to the next group's firstKey in registration order, so a new
// setting files under whichever header its registration position gives it.
// Exported so quench can verify the boundary keys stay registered.
export const SETTINGS_GROUPS = [
    { labelKey: "Settings.Groups.RulesCampaign", firstKey: "DefaultEdition" },
    { labelKey: "Settings.Groups.CombatTracker", firstKey: "fastDrawTieBreak" },
    { labelKey: "Settings.Groups.ClientDisplay", firstKey: "metricUnits" },
];

Hooks.on("renderSettingsConfig", (app, element) => {
    const section = element.querySelector('[data-category="system"]');
    if (!section || section.querySelector(".hero-settings-group-header")) return;

    // game.settings.settings is a Map, so key order IS registration order
    const prefix = `${game.system.id}.`;
    const registeredKeys = [...game.settings.settings.keys()]
        .filter((id) => id.startsWith(prefix))
        .map((id) => id.slice(prefix.length));

    for (const [index, group] of SETTINGS_GROUPS.entries()) {
        const start = registeredKeys.indexOf(group.firstKey);
        if (start === -1) continue;
        const nextFirstKey = SETTINGS_GROUPS[index + 1]?.firstKey;
        const end = nextFirstKey ? registeredKeys.indexOf(nextFirstKey) : registeredKeys.length;

        // Anchor on the group's first setting present in the DOM (world-scope
        // rows are absent entirely for players)
        let anchor = null;
        for (const key of registeredKeys.slice(start, end)) {
            anchor = section.querySelector(`[name="${prefix}${key}"]`)?.closest(".form-group");
            if (anchor) break;
        }
        if (!anchor) continue;

        // A .form-group wrapper with no label rides core's search filter for
        // free: any query hides it, clearing the query restores it
        const header = document.createElement("div");
        header.classList.add("form-group", "hero-settings-group-header");
        header.innerHTML = `<h3>${game.i18n.localize(group.labelKey)}</h3>`;
        anchor.before(header);
    }
});

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

export async function getAndSetGameSettingCore(settingKey, newValue) {
    const presentValue = game.settings.get("core", settingKey);
    await game.settings.set("core", settingKey, newValue);
    return presentValue;
}
