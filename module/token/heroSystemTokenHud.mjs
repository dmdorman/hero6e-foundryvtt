import { convertSystemUnitsToMetres, lightYearInMetres, turnsPerGregorianYear } from "../utility/units.mjs";
import { ftlLevelsToLightYearsPerYear } from "../item/item.mjs";

// PH: FIXME: Need to get extra dimensional appearing. We have icon now.
// PH: FIXME: Megamovement is always non combat.
// PH: FIXME: Encumberance can slow actors down

const { TokenHUD } = foundry.applications.hud;

/**
 * Generate a canSelect function that is appropriate for the characteristic
 * @param {String} characteristic
 */
function generateMovementCanSelectFunction(characteristic) {
    const changeKey = `system.characteristics.${characteristic}.max`;
    return (token) => {
        const actor = token.actor;
        const combatMovementInSystemUnits = actor?.system.characteristics[characteristic]?.value || 0;
        if (combatMovementInSystemUnits > 0) {
            return true;
        }

        // Keep modes the actor owns but that actor-embedded effects (adjustments, encumbrance)
        // pushed to 0 or below; item-parented AEs are the mode's own grant and stay counted.
        const actorLevelChange = (actor?.appliedEffects ?? [])
            .filter((ae) => ae.parent === actor)
            .flatMap((ae) => ae.changes)
            .filter((c) => c.key === changeKey && c.type === CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD)
            .reduce((sum, c) => sum + (parseInt(c.value) || 0), 0);
        const unadjustedMax = (actor?.system.characteristics[characteristic]?.max || 0) - actorLevelChange;
        return unadjustedMax > 0;
    };
}

/**
 * Generate a maxCombatDistanceMeters function that is appropriate for the characteristic
 * @param {String} characteristic
 */
function generateMovementMaxCombatDistanceMeters(characteristic) {
    return (token) => {
        const combatMovementInSystemUnits = Math.max(
            0,
            token.actor?.system.characteristics[characteristic]?.value || 0,
        );
        return convertSystemUnitsToMetres(combatMovementInSystemUnits, token.actor?.is5e);
    };
}

function generateMovementMaxNonCombatDistanceMeters(characteristic) {
    return (token) => {
        const combatMovementInSystemUnits = Math.max(
            0,
            token.actor?.system.characteristics[characteristic]?.value || 0,
        );

        // Assume double movement for nonCombat (x2 multiplier)
        let extraNonCombatMovement = combatMovementInSystemUnits;

        // Look for powers with nonCombatMultipliers
        try {
            const movementEffectsWithImprovedNonCombat =
                token.actor?.appliedEffects.filter(
                    (ae) =>
                        ae.changes.find((c) => c.key === `system.characteristics.${characteristic}.max`) &&
                        ae.parent.findModsByXmlid?.("IMPROVEDNONCOMBAT"), // NOTE: ae.parent can be an Actor or Item. We only care about items.
                ) ?? [];
            for (const ae of movementEffectsWithImprovedNonCombat) {
                const change = ae.changes.find((c) => c.key === `system.characteristics.${characteristic}.max`);
                const distance = parseInt(change.value) || 0;
                const movementPower = ae.parent;
                if (movementPower.system.ADDER) {
                    const IMPROVEDNONCOMBAT = movementPower.findModsByXmlid("IMPROVEDNONCOMBAT");
                    const nonCombatMultiplier = Math.pow(2, IMPROVEDNONCOMBAT.LEVELS + 1);
                    // Subtract out the default x2 multiplier
                    const extraMovement = distance * (nonCombatMultiplier - 2);
                    extraNonCombatMovement += extraMovement;
                } else {
                    console.error(
                        `unable to locate ${characteristic} non-combat movement multiplier details for ${token.name}`,
                    );
                }
            }
        } catch (e) {
            console.error(
                `unable to locate ${characteristic} non-combat movement multiplier details for ${token.name}`,
                e,
            );
        }

        return convertSystemUnitsToMetres(extraNonCombatMovement + combatMovementInSystemUnits, token.actor?.is5e);
    };
}

// PH: FIXME: Base FTL is 0 LEVELS. Probably this is not expected elsewhere
function ftlCanSelect(token) {
    const ftlLevels = token.actor?.system.characteristics.ftl?.value || -1;
    return ftlLevels > -1;
}

function ftlMaxNonCombatDistanceMeters(token) {
    const ftlLevels = token.actor?.system.characteristics.ftl?.value || -1;
    if (ftlLevels <= -1) {
        return 0;
    }

    // FTL is given movement per year - not per phase. Convert to per phase based on speed.
    const lightYearsPerYear = ftlLevelsToLightYearsPerYear(ftlLevels);
    const metresPerTurnPerLightYearPerYear = (lightYearInMetres * lightYearsPerYear) / turnsPerGregorianYear;
    const speed = parseInt(token.actor?.system.characteristics.spd?.value || 0);

    return metresPerTurnPerLightYearPerYear / speed;
}

/**
 * Callback to register movement cost. Whatever cost is provided is what is returned as gravity
 * doesn't affect this movement type.
 *
 * @callback TokenMovementActionCostFunction
 * @param {number} baseCost
 * @param {Readonly<GridOffset3D>} from
 * @param {Readonly<GridOffset3D>} to
 * @param {number} distance
 * @param {DeepReadonly<TokenMovementSegmentData>} segment
 * @returns {number}
 */
function nonGravityAffectedMovementCostFunction(baseCost /* from, to, distance, segment */) {
    return baseCost;
}

/**
 * Callback to register if 1m === 1m. Vertical movement is doubled or halved as gravity
 * affects this movement type. Valid for running, swimming, swinging, flight, and gliding.
 *
 * @callback TokenMovementActionCostFunction
 * @param {number} baseCost
 * @param {Readonly<GridOffset3D>} from
 * @param {Readonly<GridOffset3D>} to
 * @param {number} distance
 * @param {DeepReadonly<TokenMovementSegmentData>} segment
 * @returns {number}
 */
function gravityAffectedMovementCostFunction(baseCost, from, to /*, distance, segment */) {
    const vertical = to.k - from.k;

    // This calculation works because you can't, via FoundryVTT's UI, change height and move at the
    // same instant. If changing height, double cost going up and halve cost going down. Otherwise
    // it's just the usual vertical cost.
    return vertical === 0 ? baseCost : vertical > 0 ? baseCost * 2 : baseCost / 2;
}

/**
 * @callback TokenMovementActionCostFunction
 * @property {TokenDocument} token
 * @property {TokenMeasureMovementPathOptions} options
 * @return {TokenMovementActionCostFunction}
 */
function getMovementCostFunctionForNonGravityAffectedMovementType(/*token, options*/) {
    return nonGravityAffectedMovementCostFunction;
}

/**
 * @callback TokenMovementActionCostFunction
 * @property {TokenDocument} token
 * @property {TokenMeasureMovementPathOptions} options
 * @return {TokenMovementActionCostFunction}
 */
function getMovementCostFunctionForGravityAffectedMovementType(/*token, options*/) {
    // PH: FIXME: Check power doesn't have appropriate modifier
    return gravityAffectedMovementCostFunction;
}

export class HeroSystemTokenHud extends TokenHUD {
    /**
     * Return initialize movement actions
     * @param {string} module
     * @return {Object} movementActions
     */
    static initializeMovementActions(module) {
        // PH: FIXME: FoundryVTT makes the assumption that the types of movement are defined by the system rather than by the token.
        // NOTE: maxCombatDistanceMeters and maxNonCombatDistanceMeters properties are custom to hero system
        return {
            RUNNING: {
                label: "Running",
                icon: "fa-solid fa-person-running",
                img: "icons/svg/walk.svg",
                isActive: false,
                order: 0,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("running"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("running"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("running"),
                getCostFunction: getMovementCostFunctionForGravityAffectedMovementType,
            },
            SWIMMING: {
                label: "Swimming",
                icon: "fa-solid fa-person-swimming",
                img: "icons/svg/whale.svg",
                isActive: false,
                order: 1,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("swimming"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("swimming"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("swimming"),
                getCostFunction: getMovementCostFunctionForGravityAffectedMovementType,
            },
            LEAPING: {
                label: "Leaping",
                icon: "fa-solid fa-person-running-fast",
                img: "icons/svg/jump.svg",
                isActive: false,
                order: 2,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("leaping"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("leaping"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("leaping"),
                getCostFunction: getMovementCostFunctionForNonGravityAffectedMovementType,
            },

            EXTRADIMENSIONALMOVEMENT: {
                label: "Dimensional Travel",
                icon: "fa-solid fa-transporter",
                img: `systems/${module}/icons/movement/star-gate.svg`,
                isActive: false,
                order: 3,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("extradimensionalmovement"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("extradimensionalmovement"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("extradimensionalmovement"),
                getCostFunction: getMovementCostFunctionForNonGravityAffectedMovementType,
            },
            FLIGHT: {
                label: "Flight",
                icon: "fa-solid fa-person-fairy",
                img: "icons/svg/wing.svg",
                isActive: false,
                order: 4,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("flight"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("flight"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("flight"),
                getCostFunction: getMovementCostFunctionForGravityAffectedMovementType,
            },
            FTL: {
                label: "Faster Than Light",
                icon: "fa-solid fa-lightbulb",
                img: `systems/${module}/icons/movement/rocket.svg`,
                isActive: false,
                order: 5,
                teleport: false,
                canSelect: ftlCanSelect,
                maxCombatDistanceMeters: () => 0, // FTL does not support combat - only non combat
                maxNonCombatDistanceMeters: ftlMaxNonCombatDistanceMeters,
                getCostFunction: getMovementCostFunctionForNonGravityAffectedMovementType,
            },
            GLIDING: {
                label: "Gliding",
                icon: "fa-solid fa-person-from-portal",
                img: `systems/${module}/icons/movement/hang-glider.svg`,
                isActive: false,
                order: 6,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("gliding"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("gliding"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("gliding"),
                getCostFunction: getMovementCostFunctionForGravityAffectedMovementType,
            },
            SWINGING: {
                label: "Swinging",
                icon: "fa-solid fa-lasso",
                img: `systems/${module}/icons/movement/grapple-hook.svg`,
                isActive: false,
                order: 7,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("swinging"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("swinging"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("swinging"),
                getCostFunction: getMovementCostFunctionForGravityAffectedMovementType,
            },
            TELEPORTATION: {
                label: "Teleportation",
                icon: "fa-solid fa-person-from-portal",
                img: "icons/svg/teleport.svg",
                isActive: false,
                order: 8,
                teleport: true,
                canSelect: generateMovementCanSelectFunction("teleportation"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("teleportation"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("teleportation"),
                getCostFunction: getMovementCostFunctionForNonGravityAffectedMovementType,
            },
            TUNNELING: {
                label: "Tunneling",
                icon: "fa-solid fa-person-digging",
                img: "icons/svg/burrow.svg",
                isActive: false,
                order: 9,
                teleport: false,
                canSelect: generateMovementCanSelectFunction("tunneling"),
                maxCombatDistanceMeters: generateMovementMaxCombatDistanceMeters("tunneling"),
                maxNonCombatDistanceMeters: generateMovementMaxNonCombatDistanceMeters("tunneling"),
                getCostFunction: getMovementCostFunctionForNonGravityAffectedMovementType,
            },

            // Special action that is always required (otherwise v13.350 crashes)
            displace: {
                label: "TOKEN.MOVEMENT.ACTIONS.displace.label",
                icon: "fa-solid fa-transporter-1",
                img: "icons/svg/portal.svg",
                order: 99,
                teleport: true,
                measure: false,
                walls: null,
                visualize: false,
                getAnimationOptions: () => ({ duration: 0 }),
                canSelect: () => false,
                deriveTerrainDifficulty: () => 1,
                getCostFunction: () => () => 0,
                maxCombatDistanceMeters: () => 0,
                maxNonCombatDistanceMeters: () => 0,
            },
        };
    }
}
