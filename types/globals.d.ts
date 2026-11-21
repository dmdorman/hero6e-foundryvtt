// Ambient declarations for the classes this system registers on the global scope at run time.
// Source modules export them, and Foundry code reaches them by name, so the type engine needs
// them declared here. `typeof import(...)` reuses the real class type instead of restating it.
//
// Used only by the opt-in type-aware lint. See `tools/typelint/jsconfig.json`.
// Measured effect: unresolved-name findings over `module/` drop from 166 to 37.

declare const HeroSystem6eItem: typeof import("../module/item/item.mjs").HeroSystem6eItem;
declare const HeroSystem6eActor: typeof import("../module/actor/actor.mjs").HeroSystem6eActor;
declare const HeroSystem6eToken: typeof import("../module/token/actor-token.mjs").HeroSystem6eToken;
declare const HeroSystem6eTokenDocument: typeof import("../module/token/actor-token.mjs").HeroSystem6eTokenDocument;

// Each name is used two ways: as a value (`new HeroSystem6eActor(...)`), and as a JSDoc type
// (`@param {HeroSystem6eActor} actor`). `declare const` covers the value only. Without the alias,
// every JSDoc use fails as TS2749. Measured: 122 such findings, then 0.
declare type HeroSystem6eItem = import("../module/item/item.mjs").HeroSystem6eItem;
declare type HeroSystem6eActor = import("../module/actor/actor.mjs").HeroSystem6eActor;
declare type HeroSystem6eToken = import("../module/token/actor-token.mjs").HeroSystem6eToken;
declare type HeroSystem6eTokenDocument = import("../module/token/actor-token.mjs").HeroSystem6eTokenDocument;

// Left undeclared on purpose. `SimpleCalendar` comes from an optional module with no published
// types, and no shape here beats a wrong one.
