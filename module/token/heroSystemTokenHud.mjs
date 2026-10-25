import { MOVEMENT_NONE_ACTION } from "../utility/movement.mjs";
import { convertSystemUnitsToMetres, lightYearInMetres, turnsPerGregorianYear } from "../utility/units.mjs";
import { ftlLevelsToLightYearsPerYear } from "../item/item.mjs";

// PH: FIXME: Need to get extra dimensional appearing. We have icon now.
// PH: FIXME: Megamovement is always non combat.
// PH: FIXME: Encumberance can slow actors down

const { TokenHUD } = foundry.applications.hud;

/**
 * Build the palette entry for the registered no-movement action.
 *
 * Core lists an action only when `canSelect` passes or the token already holds it. `MOVEMENT_NONE_ACTION`
 * is never selectable, so a token that holds it needs this entry built by hand.
 *
 * @returns {{id: string, label: string, icon: string, isActive: boolean, cssClass: string}} The entry.
 */
function noMovementChoice() {
    const config = CONFIG.Token.movement.actions[MOVEMENT_NONE_ACTION];

    return {
        id: MOVEMENT_NONE_ACTION,
        label: game.i18n.localize(config.label),
        icon: config.icon,
        isActive: true,
        cssClass: "active",
    };
}

/**
 * Return the distance value, in system units, that the token can move on right now.
 *
 * @param {HeroSystem6eToken|HeroSystem6eTokenDocument} token Token to read. Either form.
 * @param {string} characteristic Movement characteristic key, for example `"flight"`.
 *
 * @returns {number} The characteristic value, floored at zero.
 */
function combatMovementValueInSystemUnits(token, characteristic) {
    return Math.max(0, token.actor?.getMovementCharacteristic(characteristic)?.value || 0);
}

/**
 * Generate the canSelect function for a movement characteristic.
 *
 * A mode selects only when the actor can move on it now. A mode that effects pushed to 0 grants no
 * distance, so picking it would do nothing. This rule matches `ownedMovementKeys`, which stores the mode,
 * and `calculateVelocityInSystemUnits`, which measures it, so the palette, the stored mode, and the
 * distance never disagree. Core still lists the current action when canSelect returns false, so a mode
 * reduced to 0 stays visible while it is selected.
 *
 * @param {string} characteristic Movement characteristic key, for example `"flight"`.
 *
 * @returns {(token: object) => boolean} The predicate core uses to offer the mode.
 */
function generateMovementCanSelectFunction(characteristic) {
    return (token) => combatMovementValueInSystemUnits(token, characteristic) > 0;
}

/**
 * Generate a maxCombatDistanceMeters function that is appropriate for the characteristic
 * @param {String} characteristic
 */
function generateMovementMaxCombatDistanceMeters(characteristic) {
    return (token) => {
        return convertSystemUnitsToMetres(combatMovementValueInSystemUnits(token, characteristic), token.actor?.is5e);
    };
}

function generateMovementMaxNonCombatDistanceMeters(characteristic) {
    return (token) => {
        const combatMovementInSystemUnits = combatMovementValueInSystemUnits(token, characteristic);

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
    const ftlLevels = token.actor?.getMovementCharacteristic("ftl")?.value || -1;
    return ftlLevels > -1;
}

function ftlMaxNonCombatDistanceMeters(token) {
    const ftlLevels = token.actor?.getMovementCharacteristic("ftl")?.value || -1;
    if (ftlLevels <= -1) {
        return 0;
    }

    // FTL is given movement per year - not per phase. Convert to per phase based on speed.
    const lightYearsPerYear = ftlLevelsToLightYearsPerYear(ftlLevels);
    const metresPerTurnPerLightYearPerYear = (lightYearInMetres * lightYearsPerYear) / turnsPerGregorianYear;
    const speed = parseInt(token.actor?.getCharacteristic("spd")?.value || 0);

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
            // The state a token holds when its actor has no way to move. Players cannot pick it. Its two
            // distance reports are 0, so the ruler, the HUD, and any distance report agree the token cannot
            // move, instead of inheriting the running distance that a missing action implies.
            [MOVEMENT_NONE_ACTION]: {
                label: "Movement.None",
                icon: "fa-solid fa-ban",
                order: -1,
                teleport: false,
                canSelect: () => false,
                deriveTerrainDifficulty: () => 1,
                getCostFunction: getMovementCostFunctionForGravityAffectedMovementType,
                maxCombatDistanceMeters: () => 0,
                maxNonCombatDistanceMeters: () => 0,
            },
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

    /**
     * List the movement modes this token can pick.
     *
     * Core prepends a Default entry that writes a null action. HERO has no default mode. The actor holds
     * the mode, and `propagateMovementMode` writes it to every linked token, so a cleared selection would
     * land straight back on an explicit mode. Dropping the entry keeps the palette honest.
     *
     * An actor with no movement power, such as a base2 actor or an actor whose powers an effect drained to
     * zero, gets one entry: `No movement`, shown with a ban icon and selected.
     *
     * `noMovementChoice` builds the fallback entry from the registered action.
     *
     * @returns {object} The movement action choices, keyed by HUD action key.
     */
    _getMovementActionChoices() {
        const choices = super._getMovementActionChoices();

        delete choices[""];

        if (Object.keys(choices).length > 0) {
            return choices;
        }

        return { [MOVEMENT_NONE_ACTION]: noMovementChoice() };
    }

    /**
     * Put the no-movement icon on the movement control when the token has no mode to pick.
     *
     * Core fills two template slots: the palette entries, and the control icon from `movementActionsConfig`.
     * Core takes the control icon from the action the token holds, and infers the default mode when that
     * value is null. A legacy token that cannot move still holds null, so core would show Running for an
     * actor that cannot run. This fills the second slot from the entry `_getMovementActionChoices` built,
     * so the two can never disagree. Once every token holds an action, this override is idle.
     *
     * @param {object} options The render options.
     *
     * @returns {Promise<object>} The render context.
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const noMovement = context.movementActions?.[MOVEMENT_NONE_ACTION];

        if (!noMovement) {
            return context;
        }

        // The control template uses only the icon. It has no entry label to show.
        context.movementActionsConfig = { icon: noMovement.icon };

        return context;
    }
}
