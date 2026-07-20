import { gridUnitsToMeters } from "../utility/units.mjs";

class BaseHeroDetectionModeV14 extends foundry.canvas.perception.DetectionMode {
    /**
     * Core V14 loop executor. Scans items dynamically on every single frame tick.
     * Hardened to patch unlinked actor maps before parent engine execution blocks fire.
     */
    _canDetect(visionSource, target, level) {
        const basicCheck = super._canDetect(visionSource, target, level);

        // 1. Validate Target/Source Documents (V14 Standard Validation)
        const targetToken = target.document?.documentName === "Token" ? target : null;
        const targetActor = targetToken?.actor;
        if (!targetActor) return basicCheck;

        const sourceToken = visionSource.object?.document?.documentName === "Token" ? visionSource.object : null;
        const sourceActor = sourceToken?.actor;
        if (!sourceActor) return basicCheck;

        // 2. Gather state parameters using specialized sub-functions
        const activeSenses = this._getObserverSenses(sourceToken, sourceActor);
        const targetInvisibility = this._getTargetInvisibility(targetToken, targetActor);

        // 3. Compute V14 Path Measurements
        const waypoints = [
            { x: sourceToken.center.x, y: sourceToken.center.y },
            { x: targetToken.center.x, y: targetToken.center.y },
        ];

        const pathMeasurement = canvas.grid.measurePath(waypoints);
        const rawGridDistance = pathMeasurement?.distance ?? 0;

        // Extract the specific parent scene context for this token
        const tokenScene = sourceToken.document.parent;

        // SAFE HIGH-FREQUENCY INVOKATION: Passes context to ensure zero interface lag
        const distanceMultiplier = gridUnitsToMeters({
            silent: true,
            scene: tokenScene,
        });

        let distanceInMeters = rawGridDistance * distanceMultiplier;

        // ====================================================================
        // GRID ADJACENCY PROTECTION MATRIX
        // Handles fractional diagonals (2.8m square) and hex vertex adjustments
        // ====================================================================
        if (canvas.grid.type !== foundry.CONST.GRID_TYPES.GRIDLESS) {
            const sourceClust = canvas.grid.getOffset({ x: sourceToken.x, y: sourceToken.y });
            const targetClust = canvas.grid.getOffset({ x: targetToken.x, y: targetToken.y });

            const dx = Math.abs(sourceClust.i - targetClust.i);
            const dy = Math.abs(sourceClust.j - targetClust.j);

            // Check if the tokens occupy immediately touching grid cells
            const isAdjacent = dx <= 1 && dy <= 1;

            // Calculate what 1 single grid space equals in true metric length on this scene
            const metersPerSingleGridSpace = (canvas.scene.grid.distance ?? 1) * distanceMultiplier;

            // If adjacent, force the proximity range check to match exactly 1 single space length
            // This stops 2.8m square diagonals or 2.3m hex offsets from dropping out of the 2m fringe!
            if (
                isAdjacent &&
                distanceInMeters > metersPerSingleGridSpace &&
                distanceInMeters <= metersPerSingleGridSpace * 1.5
            ) {
                distanceInMeters = metersPerSingleGridSpace;
            }
        }

        // 4. Resolve sensory processing matrix
        return this._resolveSensoryMatrix(activeSenses, targetInvisibility, distanceInMeters, basicCheck);
    }

    /**
     * Compiles all active, un-Flashed senses and targeting capabilities for the observer.
     * Accounts for native normal sense baselines.
     * @protected
     */
    _getObserverSenses(sourceToken, sourceActor) {
        // Check if the observer has purchased an item providing a specific sense or targeting capability
        const hasSenseItem = (xmlid, optionId = null) =>
            sourceActor.items.some((item) => {
                if (!item.isActive) return false;
                if (item.system.XMLID !== xmlid) return false;
                if (optionId && item.system.OPTIONID !== optionId) return false;
                return true;
            });

        const hasTargetingSenseItem = (optionIds) =>
            sourceActor.items.some(
                (item) =>
                    item.system.XMLID === "TARGETINGSENSE" && optionIds.includes(item.system.OPTIONID) && item.isActive,
            );

        // Base Flash/Blindness statuses
        const isBlind =
            sourceToken.document.hasStatusEffect("blind") ||
            sourceToken.document.hasStatusEffect("sightSenseDisabledEffect");
        const isDeaf = sourceToken.document.hasStatusEffect("hearingSenseDisabledEffect");

        return {
            // SIGHT GROUP
            SIGHT: {
                NORMAL: !isBlind, // Natively active for all tokens unless blinded/Flashed
                INFRARED: !isBlind && hasSenseItem("ENHANCEDPERCEPTION", "INFRAREDPERCEPTION"),
                ULTRAVIOLET: !isBlind && hasSenseItem("ENHANCEDPERCEPTION", "ULTRAVIOLETSIGHT"),
            },

            // HEARING GROUP
            HEARING: {
                // Normal Hearing is natively targeting in HERO System unless modified
                NORMAL: !isDeaf,
                TARGETING: !isDeaf && (hasTargetingSenseItem(["NORMALHEARING", "HEARINGGROUP"]) || true), // True if normal hearing is default targeting
            },

            // RADIO GROUP
            RADIO: {
                RADAR: !sourceToken.document.hasStatusEffect("radioSenseDisabledEffect") && hasSenseItem("RADAR"),
                TARGETING: !sourceToken.document.hasStatusEffect("radioSenseDisabledEffect") && hasSenseItem("RADAR"),
            },

            // SMELL GROUP
            SMELL: {
                NORMAL: !sourceToken.document.hasStatusEffect("smellSenseDisabledEffect"),
                TARGETING:
                    !sourceToken.document.hasStatusEffect("smellSenseDisabledEffect") &&
                    hasTargetingSenseItem(["NORMALSMELL", "SMELLGROUP"]),
            },

            // TOUCH GROUP
            TOUCH: {
                NORMAL: !sourceToken.document.hasStatusEffect("touchSenseDisabledEffect"),
                TARGETING:
                    !sourceToken.document.hasStatusEffect("touchSenseDisabledEffect") &&
                    hasTargetingSenseItem(["NORMALTOUCH", "TOUCHGROUP"]),
            },

            // MENTAL GROUP
            MENTAL: {
                AWARENESS:
                    !sourceToken.document.hasStatusEffect("mentalSenseDisabled") && hasSenseItem("MENTALAWARENESS"),
                TARGETING:
                    !sourceToken.document.hasStatusEffect("mentalSenseDisabled") &&
                    hasTargetingSenseItem(["MENTALGROUP"]),
            },
        };
    }

    /**
     * Gathers active invisibility properties from the target, splitting them into groups and specific senses.
     * @protected
     */
    _getTargetInvisibility(targetToken, targetActor) {
        const item = targetActor.items.find((i) => i.system.XMLID === "INVISIBILITY" && i.isActive);

        // Baseline native system invisible condition (Defaults to mapping strictly to Normal Sight)
        const hasCoreInvisibleStatus = targetToken.document.hasStatusEffect("invisible");

        // Check if the Invisibility item explicitly covers an adder/modifier exception
        const blocksSense = (modXmlid) => !!item?.findModsByXmlid(modXmlid);

        return {
            // Sight group coverage
            SIGHT: {
                ANY: hasCoreInvisibleStatus || (item && !blocksSense("SIGHTGROUP")),
                NORMAL: hasCoreInvisibleStatus || (item && !blocksSense("SIGHTGROUP")),
                INFRARED: item && !blocksSense("SIGHTGROUP") && blocksSense("INFRAREDPERCEPTION"),
                ULTRAVIOLET: item && !blocksSense("SIGHTGROUP") && blocksSense("ULTRAVIOLETSIGHT"),
            },

            // Other group coverages
            HEARING: !!item && blocksSense("HEARINGGROUP"),
            RADIO: !!item && blocksSense("RADIOGROUP"),
            SMELL: !!item && blocksSense("SMELLGROUP"),
            MENTAL: !!item && blocksSense("MENTALGROUP"),
            TOUCH: !!item && blocksSense("TOUCHGROUP"),

            // Fringe attributes
            NO_FRINGE: !!item && blocksSense("NOFRINGE"),
            BRIGHT_FRINGE: !!item && blocksSense("BRIGHTFRINGE"),
        };
    }

    /**
     * Sequential sensory matching block evaluating individual senses vs group-wide closures.
     * Standardizes Fringe handling universally across all physical categories.
     * @protected
     */
    _resolveSensoryMatrix(senses, inv, distance, basicCheck) {
        const TYPE_SIGHT = foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT;
        const isTargetingPipeline = this.constructor.TYPE === TYPE_SIGHT;

        // A. Radio Group Checks
        if (senses.RADIO.TARGETING) {
            if (this._evaluateSenseWithFringe(inv.RADIO, inv, distance, 100)) {
                console.log(`${this.name} RADIO.TARGETING`);
                return true;
            }
        }

        // B. Hearing Group Checks
        if (senses.HEARING.TARGETING) {
            if (this._evaluateSenseWithFringe(inv.HEARING, inv, distance, 40)) {
                return isTargetingPipeline;
            }
        } else if (senses.HEARING.NORMAL && !isTargetingPipeline) {
            return true;
        }

        // C. Mental Group Checks
        if (senses.MENTAL.TARGETING) {
            if (this._evaluateSenseWithFringe(inv.MENTAL, inv, distance, 80)) {
                console.log(`${this.name} MENTAL.TARGETING`);
                return true;
            }
        }

        // D. Smell Group Checks
        if (senses.SMELL.TARGETING) {
            if (this._evaluateSenseWithFringe(inv.SMELL, inv, distance, 20)) {
                console.log(`${this.name} SMELL.TARGETING`);
                return true;
            }
        } else if (senses.SMELL.NORMAL && !isTargetingPipeline) {
            return true;
        }

        // E. Touch Group Checks
        if (senses.TOUCH.TARGETING) {
            if (this._evaluateSenseWithFringe(inv.TOUCH, inv, distance, 1)) {
                console.log(`${this.name} TOUCH.TARGETING`);
                return true;
            }
        } else if (senses.TOUCH.NORMAL && !isTargetingPipeline) {
            return true;
        }

        // F. Sight Group Resolution (Maintains unique sub-sense bypass rules like Infrared)
        if (foundry.utils.hasProperty(senses, "SIGHT")) {
            // 1. Enhanced Senses Bypass Check
            if (inv.SIGHT.ANY) {
                if (senses.SIGHT.INFRARED && !inv.SIGHT.INFRARED) {
                    return true;
                }
                if (senses.SIGHT.ULTRAVIOLET && !inv.SIGHT.ULTRAVIOLET) {
                    return true;
                }
            }

            // 2. Normal Sight Baseline with Universal Fringe
            if (senses.SIGHT.NORMAL) {
                if (this._evaluateSenseWithFringe(inv.SIGHT.NORMAL, inv, distance, Infinity)) {
                    // If the target is NOT invisible to normal sight, return Foundry's true geometry check
                    return !inv.SIGHT.NORMAL ? basicCheck : true;
                }
            }
        }

        return false;
    }

    /**
     * Universal framework checking if a target can be perceived based on invisibility,
     * maximum tracking limits, and close-proximity sensory fringe anomalies.
     * @protected
     * @param {boolean} isInvisible Is the target hidden from this specific sense category?
     * @param {object} inv The master target invisibility payload containing fringe adders
     * @param {number} distance Current path measurement length in meters
     * @param {number} maxRange Maximum allowed tracing range for this alternative sensory block
     * @returns {boolean} Can this specific sense track the token?
     */
    _evaluateSenseWithFringe(isInvisible, inv, distance, maxRange) {
        // Scenario 1: Target is not invisible to this sense group
        if (!isInvisible) {
            return distance <= maxRange;
        }

        // Scenario 2: Target IS invisible. Check for No Fringe adder restriction
        if (inv.NO_FRINGE) {
            return false;
        }

        // Scenario 3: Target has a distortion bubble. Check if observer is inside proximity limits
        const maxFringeRange = inv.BRIGHT_FRINGE ? 16 : 2;

        // Clamp the fringe check to whichever is lower: the active fringe bubble or the max operational range of the sense
        const trackingLimit = Math.min(maxFringeRange, maxRange);

        return distance <= trackingLimit;
    }
}

// 2. CHILD CLASS: Targeting Senses (Full Graphics)
class HeroTargetingDetectionModeV14 extends BaseHeroDetectionModeV14 {
    static get TYPE() {
        return foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT;
    }
}

// 3. CHILD CLASS: Non-Targeting Senses (Ambient/Silhouette Tracking)
class HeroNonTargetingDetectionModeV14 extends BaseHeroDetectionModeV14 {
    static get TYPE() {
        return foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SOUND;
    }
    static getDetectionFilter() {
        return (this._detectionFilter ??= OutlineOverlayFilter.create({
            //outlineColor: [1, 1, 1, 1],
            //thickness: 1,
            knockout: false,
            wave: true,
        }));
    }
}

/**
 * 4. Initialization: Registers custom detection modes with V14 engine.
 */
export function initializeHeroVisionV14() {
    const isV14 = game.release?.generation >= 14;
    if (!isV14) return;

    CONFIG.Canvas.detectionModes["heroTargetingV14"] = new HeroTargetingDetectionModeV14({
        id: "heroTargetingV14",
        label: "HERO: Targeting Senses (v14)",
        type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT,
    });

    CONFIG.Canvas.detectionModes["heroNonTargetingV14"] = new HeroNonTargetingDetectionModeV14({
        id: "heroNonTargetingV14",
        label: "HERO: Non-Targeting Senses (v14)",
        type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SOUND,
    });
}
