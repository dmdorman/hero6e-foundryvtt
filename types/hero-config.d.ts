// Ambient declaration for the CONFIG.HERO tree.
//
// `module/config.mjs` builds HERO from 45 assigned keys. One more is added at start-up, inside
// `Hooks.once("init")` in `module/herosystem6e.mjs`. That file installs HERO with
// `CONFIG.HERO = { ...CONFIG.HERO, ...HERO }`. The Foundry types know nothing about it, so every
// read failed as an unknown property: 536 findings over `module/`.
//
// The list is flat and has no index signature on purpose, so a wrong top-level key fails. Depth
// is deferred: object values are `Record<string, any>`. Replace those with real typedefs as
// findings demand, one key at a time.
//
// Add a key here when you add a `HERO.<key> =` assignment in `module/config.mjs`. Forgetting is
// visible: the reads fail.
//
// Measured negative result, do not undo it: declaring `HERO: typeof HERO` with `HERO` imported
// from `module/config.mjs` clears the same 536 findings and catches nothing. A probe read of
// `CONFIG.HERO.DEFINITELY_NOT_A_KEY` passed with that form, and fails with this one.

interface HeroSystemConfig {
    ACTIVE_EFFECT_MODES: Record<string, any>;
    ACTIVE_EFFECT_PRIORITY: Record<string, any>;
    // Assigned in `Hooks.once("init")`, not at module load, and holds a `CONST.CHAT_MESSAGE_STYLES`
    // flag. Reads that run before the init hook see `undefined`.
    CHAT_MESSAGE_DEFAULT_STYLE: number;
    CSL_5E_CV_LEVELS_TYPES: Record<string, any>;
    CSL_WEAPON_MASTER_WEAPON_TYPES: Record<string, any>;
    DEFENSE_ABBREVIATIONS: Record<string, any>;
    DURATION_TYPES: Record<string, any>;
    PENALTY_SKILL_LEVELS_TYPES: Record<string, any>;
    RANGE_TYPES: Record<string, any>;
    SFX: Record<string, any>;
    VALIDATION_SEVERITY: Record<string, any>;
    ValidPowerOptions: Record<string, any>;
    areaOfEffect: Record<string, any>;
    attackClasses: Record<string, any>;
    attacksWith: Record<string, any>;
    characteristicHasTypes5e: Record<string, any>;
    characteristicHasTypes6e: Record<string, any>;
    characteristicPowers5e: Record<string, any>;
    characteristicPowers6e: Record<string, any>;
    creatableActorTypes: Record<string, any>;
    csl: Record<string, any>;
    customCharacteristicLabels: Record<string, any>;
    defendsWith: Record<string, any>;
    defenseTypes: Record<string, any>;
    defenseTypes5e: Record<string, any>;
    folderColors: Record<string, any>;
    heroDice: typeof import("../module/heroRoller/dice.mjs");
    heroEncounter: typeof import("../module/utility/encounter/encounter.mjs");
    hitLocationRanges: Record<string, any>;
    hitLocationSide: Record<string, any>;
    hitLocations: Record<string, any>;
    hitLocationsToHit: Record<string, any>;
    isSpecialHitLocation: (location: string) => boolean;
    martialArtsDamageTypeChoices: Record<string, any>;
    mcsl: Record<string, any>;
    mindScanChoices: Record<string, any>;
    movementPowers5e: Record<string, any>;
    movementPowers6e: Record<string, any>;
    powers5e: Record<string, any>;
    powers5eDict: Record<string, any>;
    powers6e: Record<string, any>;
    powers6eDict: Record<string, any>;
    sidedLocations: { has(value: string): boolean };
    skillCharacteristics: Record<string, any>;
    skillCharacteristics5e: Record<string, any>;
    skillTraining: Record<string, any>;
    statusColors: Record<string, any>;
    stunBodyDamages: Record<string, any>;

    // Read with `?.` plus a fallback, and never assigned anywhere in `module/`. The callers treat
    // absence as valid, so the keys are optional rather than absent.
    activeEffectExpiryEvents?: Record<string, any>;
    speedChart?: Record<number, number[]>;
}

interface CONFIG {
    HERO: HeroSystemConfig;
}

// Keep this list in step with the source. Derive it with a pattern that allows indentation:
//
//   grep -rhoE '(^|[^.A-Za-z0-9_])HERO\.[A-Za-z0-9_]+ *=[^=]' module --include='*.mjs'
//
// An anchored `^HERO\.` pattern misses `HERO.CHAT_MESSAGE_DEFAULT_STYLE`, which sits inside the
// init hook, and reported it as a read of a key nothing assigns. That claim was wrong.
