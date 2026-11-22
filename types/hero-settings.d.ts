// Setting value types, as the type engine sees them.
//
// `fvtt-types` resolves `game.settings.get()` and `game.settings.set()` through the global
// `SettingConfig` map, keyed `"namespace.key"`. Nothing merged into that map here, so the only
// namespace TypeScript accepted was `"core"`, and every system key failed as `KeyFor<any>`.
//
// List the keys and value types that the `game.settings.register` calls in
// `module/settings/settings-helpers.mjs` declare. Read or register a key that is missing here and
// the checker reports `TS2345` at the registration and at every read, so drift between this map and
// the registrations surfaces in `npm run lint:types:check`.
//
// Settings that register `choices` are literal unions, so a typo in a comparison reports no
// overlap. A value outside a union reports `TS2367` on a read and `TS2322` on a write.
//
// `module/migration.mjs` must stay self-contained, so it calls `game.settings` directly and declares
// its reads as `string`. That is deliberate: worlds older than a setting's current choice list hold
// values that no longer appear in `choices`, and the migration steps compare against those.
//
// The `SystemNameConfig` declaration at the end of this file types `game.system.id` as the namespace
// prefix these keys use, so `game.settings` calls need no cast.

declare global {
    interface SettingConfig {
        // Automation (world, `type: String` with choices).
        "hero6efoundryvttv2.automation": "none" | "npcOnly" | "pcEndOnly" | "all";
        // Backing store for the stun multiplier menu (`type: Object`).
        "hero6efoundryvttv2.NonStandardStunMultiplierForKillingAttackBackingSetting": {
            d6Count: number;
            d6Less1DieCount: number;
            halfDieCount: number;
            constant: number;
        };
        "hero6efoundryvttv2.combatTrackerGrouping": boolean;

        // Rules and campaign (world).
        "hero6efoundryvttv2.DefaultEdition": "six" | "five";
        "hero6efoundryvttv2.StrEnd": "five" | "ten";
        "hero6efoundryvttv2.stunned": boolean;
        "hero6efoundryvttv2.use endurance": boolean;
        "hero6efoundryvttv2.knockback": boolean;
        "hero6efoundryvttv2.hit locations":
            | "noHitLocations"
            | "hitLocationsWithoutSectional"
            | "hitLocationsWithSectional";
        "hero6efoundryvttv2.hitLocTracking": "none" | "all";
        "hero6efoundryvttv2.optionalManeuvers": boolean;
        "hero6efoundryvttv2.HAP": boolean;
        "hero6efoundryvttv2.equipmentWeightPercentage": number;
        "hero6efoundryvttv2.HexTemplates": boolean;
        "hero6efoundryvttv2.DoubleDamageLimit": boolean;
        "hero6efoundryvttv2.ShowAllConditionalDefenses": boolean;
        "hero6efoundryvttv2.ShowCombatCharacteristicChanges": "all" | "pc" | "none";
        "hero6efoundryvttv2.CombatMovementOnlyOnActorsPhase": boolean;
        "hero6efoundryvttv2.fastDrawTieBreak": boolean;
        "hero6efoundryvttv2.stunnedAutoSkip": boolean;
        "hero6efoundryvttv2.lrAutoElevate": boolean;

        // Client scope.
        "hero6efoundryvttv2.combatTrackerCompact": boolean;
        "hero6efoundryvttv2.metricUnits": boolean;
        "hero6efoundryvttv2.DiceSkinning": boolean;
        "hero6efoundryvttv2.effectsPanel": boolean;
        "hero6efoundryvttv2.ShowGenericRoller": boolean;
        "hero6efoundryvttv2.ObjectCaching": boolean;
        "hero6efoundryvttv2.alphaTesting": boolean;

        // World state (world).
        "hero6efoundryvttv2.hdcResetPending": boolean;
        // Version strings, not a choice list.
        "hero6efoundryvttv2.lastMigration": string;
    }
}

export {};

/**
 * The system id, as `fvtt-types` asks for it. This makes `game.system.id` the literal type, which is
 * what `game.settings` and `game.packages` need: `ClientSettings.Namespace` accepts only the ids that
 * `SettingConfig` is keyed under, and `game.system.id` is `string` by default.
 *
 * The declaration constrains no runtime value. Foundry sets the id from `id` in `system.json`, which
 * must match the installed directory name. A checkout whose id differs registers and reads under its
 * own id at runtime, and this file stops type checking `game.system.id` uses.
 *
 * The value here must equal the prefix of every key in `SettingConfig` above.
 */
declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
    interface SystemNameConfig {
        name: "hero6efoundryvttv2";
    }
}

/**
 * Aliases for call sites that take a setting key as a generic parameter.
 *
 * A direct call such as `game.settings.get(game.system.id, "metricUnits")` needs neither of these
 * for its key; the checker resolves the key against `SettingConfig` on its own.
 */
declare global {
    /** Every key this system registers, without the namespace prefix. */
    type HeroSettingKey =
        import("@league-of-foundry-developers/foundry-vtt-types/client/settings/clientSettings.mjs").ClientSettings.KeyFor<"hero6efoundryvttv2">;

    /**
     * The stored value of one setting.
     *
     * `game.settings.get()` resolves to this type only when the call passes `{ document: false }`.
     * Reads in this repo stay bare, so ask for this alias where a value type is needed.
     * @template Key - The setting key.
     */
    type HeroSettingValue<Key extends HeroSettingKey> =
        import("@league-of-foundry-developers/foundry-vtt-types/client/settings/clientSettings.mjs").ClientSettings.SettingInitializedType<
            "hero6efoundryvttv2",
            Key
        >;
}
