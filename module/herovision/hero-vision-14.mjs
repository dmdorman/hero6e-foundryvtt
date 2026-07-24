import { gridUnitsToMeters } from "../utility/units.mjs";

// Volatile-free, top-level static tracker to store frame state deduplication
if (!globalThis.HERO_VISION_DEBUG_CACHE) {
    globalThis.HERO_VISION_DEBUG_CACHE = new Map();
}

class BaseHeroDetectionModeV14 extends foundry.canvas.perception.DetectionMode {
    /**
     * Calculates metric scale distance between two token bounding vectors.
     * @protected
     */
    _getDistanceInMeters(sourceToken, targetToken) {
        if (!sourceToken || !targetToken) return Infinity;

        // Use a clean local variable for grid math safety
        const ray = new foundry.canvas.geometry.Ray(sourceToken.center, targetToken.center);
        const pixels = ray.distance;

        // Convert pixels to canvas grid units
        const gridUnits = (pixels / canvas.dimensions.size) * canvas.dimensions.distance;

        // Factor ruleset matrix bounds (Convert 5e inches/hexes to 6e meters if system.is5e is flagged)
        const actor = sourceToken.actor;
        const is5e = actor?.system?.is5e === true;

        return is5e ? gridUnits * 2.0 : gridUnits;
    }

    /**
     * Core V14 loop executor. Scans items dynamically on every single frame tick.
     * Hardened to patch unlinked actor maps before parent engine execution blocks fire.
     */
    _canDetect(visionSource, target, level) {
        const basicCheck = super._canDetect(visionSource, target, level);

        // 1. Gather Target Context (Token or Document Match)
        let targetToken = null;
        if (target instanceof Token) targetToken = target;
        else if (target.object instanceof Token) targetToken = target.object;
        else if (target.document instanceof TokenDocument) targetToken = target.document.object;

        const targetActor = targetToken?.actor;
        if (!targetActor) return basicCheck;

        // 2. Clear Actor/Token Swaps for the Source
        let sourceActor;
        let sourceToken;

        // In V14 visionSource.object can occasionally evaluate directly to the Actor instance
        if (visionSource.object instanceof Actor) {
            sourceActor = visionSource.object;
            // Map back to the live canvas proxy token from the native contents Map array
            sourceToken = canvas.tokens.contents.find((t) => t.actor?.id === sourceActor.id) || null;
        } else {
            // Standard vision source fallback assignment
            sourceToken = visionSource.object;
            sourceActor = sourceToken?.actor || null;
        }

        // Strict variable safety gate before executing system math
        if (!sourceActor || !sourceToken) return basicCheck;

        // 3. Grid Adjacency Protection Matrix
        const distanceInMeters = this._getDistanceInMeters(sourceToken, targetToken);
        if (distanceInMeters <= 2) {
            return true;
        }

        // 4. Invoke your method with the exact expected order: (Token, Actor)
        const activeSenses = this._getObserverSenses(sourceToken, sourceActor);
        const targetInvisibility = this._getTargetInvisibility(sourceToken, sourceActor);

        const hasSenseLock = this._resolveSensoryMatrix(
            activeSenses,
            targetInvisibility,
            distanceInMeters,
            basicCheck,
            sourceToken,
            targetToken,
        );

        return hasSenseLock;
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
    _resolveSensoryMatrix(senses, inv, distance, basicCheck, sourceToken, targetToken) {
        const TYPE_SIGHT = foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT;
        const isTargetingPipeline = this.constructor.TYPE === TYPE_SIGHT;

        const sName = sourceToken?.name || "Unknown Observer";
        const tName = targetToken?.name || "Unknown Target";
        const modeLabel = isTargetingPipeline ? "[TARGETING]" : "[NON-TARGETING]";
        const uniqueTraceKey = `${sourceToken?.id}-${targetToken?.id}-${this.constructor.name}`;

        const evaluateSense = (senseGroup, invGroup, dist, maxDist) =>
            this._evaluateSenseWithFringe(senseGroup, invGroup, dist, maxDist);

        // A. Radio Group Checks
        if (isTargetingPipeline && senses.RADIO.TARGETING) {
            if (evaluateSense(inv.RADIO, inv, distance, 100)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via RADAR/RADIO (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        }

        // B. Hearing Group Checks
        if (isTargetingPipeline) {
            if (senses.HEARING.TARGETING && evaluateSense(inv.HEARING, inv, distance, 40)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via TARGETING HEARING (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        } else {
            if (senses.HEARING.NORMAL && evaluateSense(inv.HEARING, inv, distance, 40)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via AMBIENT/NORMAL HEARING (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        }

        // C. Mental Group Checks
        if (isTargetingPipeline && senses.MENTAL.TARGETING) {
            if (evaluateSense(inv.MENTAL, inv, distance, 80)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via MENTAL SENSE (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        }

        // D. Smell Group Checks
        if (isTargetingPipeline) {
            if (senses.SMELL.TARGETING && evaluateSense(inv.SMELL, inv, distance, 20)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via TARGETING SMELL (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        } else {
            if (senses.SMELL.NORMAL && evaluateSense(inv.SMELL, inv, distance, 20)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via AMBIENT/NORMAL SMELL (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        }

        // E. Touch Group Checks
        if (isTargetingPipeline) {
            if (senses.TOUCH.TARGETING && evaluateSense(inv.TOUCH, inv, distance, 1)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via TARGETING TOUCH (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        } else {
            if (senses.TOUCH.NORMAL && evaluateSense(inv.TOUCH, inv, distance, 1)) {
                console.debug(
                    `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via AMBIENT/NORMAL TOUCH (Dist: ${distance.toFixed(1)}m)`,
                );
                globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                return true;
            }
        }

        // F. Sight Group Resolution
        if (isTargetingPipeline && senses.SIGHT?.NORMAL) {
            if (this._evaluateSenseWithFringe(inv.SIGHT.NORMAL, inv, distance, Infinity)) {
                if (!inv.SIGHT.NORMAL ? basicCheck : true) {
                    console.debug(
                        `👀 HERO Vision ${modeLabel}: ${sName} detects ${tName} via NORMAL SIGHT (Dist: ${distance.toFixed(1)}m)`,
                    );
                    globalThis.HERO_VISION_DEBUG_CACHE.delete(uniqueTraceKey);
                    return true;
                }
            }
        }

        // ====================================================================
        // EXHAUSTIVE THROTTLED FALL-THROUGH LOGGING BLOCK
        // Tracks exactly why sense resolution failed without spamming frame ticks
        // ====================================================================
        const lastLoggedState = globalThis.HERO_VISION_DEBUG_CACHE.get(uniqueTraceKey);
        const currentFailStateString = `${senses.SMELL.TARGETING}-${inv.SMELL}-${distance}`;

        if (lastLoggedState !== currentFailStateString) {
            globalThis.HERO_VISION_DEBUG_CACHE.set(uniqueTraceKey, currentFailStateString);

            console.groupCollapsed(
                `❌ HERO Vision FAIL ${modeLabel}: ${sName} CANNOT detect ${tName} (Dist: ${distance.toFixed(1)}m)`,
            );
            console.debug(`Pipeline Target Status:`, { isTargetingPipeline, currentModeClass: this.constructor.name });
            console.debug(`Smell Sense Configuration:`, {
                hasSmellSense: !!senses.SMELL,
                isSmellTargeting: senses.SMELL.TARGETING,
                isSmellNormal: senses.SMELL.NORMAL,
            });
            console.debug(`Target Invisibility Payload:`, {
                isInvisibleToSmell: inv.SMELL,
                hasNoFringeAdder: inv.NO_FRINGE,
                hasBrightFringeAdder: inv.BRIGHT_FRINGE,
            });
            console.debug(`Range Limitations:`, {
                currentDistance: `${distance.toFixed(1)}m`,
                maxAllowedSmellRange: "20m",
                withinRangeBounds: distance <= 20,
            });
            console.groupEnd();
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

    // testVisibility(visionSource, mode, config) {
    //     // Force the execution path directly through our custom sensory calculation block
    //     return this._canDetect(visionSource, config.object, config.level);
    // }
}

// 3. CHILD CLASS: Non-Targeting Senses (Ambient/Silhouette Tracking)
/**
 * Custom Non-Targeting Sense Mode for HERO System 6e V14.
 * @extends {BaseHeroDetectionModeV14}
 */
export class HeroNonTargetingDetectionModeV14 extends BaseHeroDetectionModeV14 {
    constructor(metadata = {}, id = "heroNonTargetingV14") {
        super(metadata, id);
        // Explicit instance cache to protect against multi-client volatile states
        //this._cachedWaveFilter = null;
    }

    /** @override */
    static get TYPE() {
        return foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SOUND;
    }

    /**
     * Instance method to retrieve the wave overlay safely without texture flushes.
     * @override
     */
    // getDetectionFilter(visionSource, target) {
    //     if (typeof OutlineOverlayFilter !== "undefined") {
    //         if (!this._cachedWaveFilter) {
    //             this._cachedWaveFilter = OutlineOverlayFilter.create({
    //                 outlineColor: 0x00ffcc,
    //                 thickness: 2.0,
    //                 waveAnimation: true,
    //             });
    //         }
    //         return this._cachedWaveFilter;
    //     }
    //     return super.getDetectionFilter(visionSource, target);
    // }
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
