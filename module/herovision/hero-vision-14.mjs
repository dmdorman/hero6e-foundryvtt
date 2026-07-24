import { calculateDistanceBetween } from "../utility/range.mjs";

// Volatile-free, top-level static tracker to store frame state deduplication
if (!globalThis.HERO_VISION_DEBUG_CACHE) {
    globalThis.HERO_VISION_DEBUG_CACHE = new Map();
}

class BaseHeroDetectionModeV14 extends foundry.canvas.perception.DetectionMode {
    /**
     * Refactored detection evaluation loop. Gracefully exits to default
     * Foundry vision pipelines if an unhandled detection mode triggers.
     * @override
     */
    _canDetect(visionSource, target, level) {
        const basicCheck = super._canDetect(visionSource, target, level);

        // 1. Structural Target context validation
        const targetToken = target instanceof Token ? target : target.object;
        const targetActor = targetToken?.actor;
        if (!targetActor) return basicCheck;

        // 2. Structural Source/Observer context validation
        const sourceToken =
            visionSource.object instanceof Actor
                ? canvas.tokens.contents.find((t) => t.actor?.id === visionSource.object.id)
                : visionSource.object;
        const sourceActor = sourceToken?.actor;
        if (!sourceActor || !sourceToken) return basicCheck;

        // 3. Robust Explicit Mode Identification
        let isTargetingClassRun;
        const activeModeId = this.id || "";

        switch (activeModeId) {
            case "heroTargetingV14":
                isTargetingClassRun = true;
                break;
            case "heroNonTargetingV14":
                isTargetingClassRun = false;
                break;
            default:
                // Graceful Fallback: Log a system warning to the dev console and return false
                // This drops execution back down into Foundry VTT's native baseline vision mechanics
                console.warn(
                    `[${game.system.id.toUpperCase()} WARNING]: Unhandled sensory detection mode identifier encountered: "${activeModeId}". Dropping back to core vision.`,
                );
                return false;
        }

        // 4. Proximity Tracking: Run unified distance calculation engine
        const calculatedDistance = calculateDistanceBetween(sourceToken, targetToken);

        // 5. Extract sensory properties and active target invisibility frameworks
        const activeSenses = this._getObserverSenses(sourceToken, sourceActor);
        const targetInvisibility = this._getTargetInvisibility(targetToken, targetActor);

        // 6. Execute holistic evaluations down the pipeline without early short-circuit paths
        return this._resolveSensoryMatrix(
            activeSenses,
            targetInvisibility,
            calculatedDistance,
            basicCheck,
            sourceToken,
            targetToken,
            isTargetingClassRun,
        );
    }

    /**
     * Evaluates sense capabilities against target invisibility profiles and ruleset range increments.
     * Leverages an inline unified lookup processor matching shared dictionary keys.
     * @protected
     */
    _resolveSensoryMatrix(
        activeSenses,
        targetInvisibility,
        calculatedDistance,
        basicCheck,
        sourceToken,
        targetToken,
        isTargetingClassRun,
    ) {
        const distanceMeters = calculatedDistance.distance;
        const gridSpaces = calculatedDistance.gridSpaces;
        const sourceActor = sourceToken.actor;

        const sourceName = sourceToken.name || "Token A";
        const targetName = targetToken.name || "Token B";
        const modeHeader = isTargetingClassRun ? "[TARGETING]" : "[NON-TARGETING]";

        // Establish proximity flags
        const isAdjacentFringe = distanceMeters <= 2 || gridSpaces <= 1;
        const isWithinBrightFringe = targetInvisibility.BRIGHT_FRINGE && distanceMeters <= 8;

        // --- HERO RULES RANGE MODIFIER ENGINE ---
        let rangeModifierPenalty = 0;
        if (distanceMeters > 8) {
            rangeModifierPenalty = -2 * Math.ceil(Math.log2(distanceMeters / 8));
        }

        // Resolve Base PER Score via Intelligence characteristic
        let basePerRoll = 9;
        if (
            sourceActor &&
            typeof sourceActor.hasCharacteristic === "function" &&
            sourceActor.hasCharacteristic("INT")
        ) {
            const intValue = sourceActor.system.characteristics?.INT?.value || 0;
            basePerRoll = 9 + Math.round(intValue / 5);
        }

        // Locate active levels or skill modifications via the active PERCEPTION item
        let skillLevels = 0;
        if (sourceActor) {
            const perSkillItem = sourceActor.items.find((i) => i.system.XMLID === "PERCEPTION" && i.isActive);
            if (perSkillItem) {
                skillLevels = Number(perSkillItem.system.LEVELS || perSkillItem.system.value || 0);
            }
        }

        const finalModifiedPerTarget = basePerRoll + skillLevels + rangeModifierPenalty;
        const isPerceptionPossible = finalModifiedPerTarget > 0;

        let targetDetectedLabels = [];
        let isAnySenseSuccessful = false;

        /**
         * Inline unified sensory helper processor. Matches keys across both
         * activeSenses and targetInvisibility dictionaries simultaneously.
         */
        const evaluateDictionarySense = (senseKey, labelText) => {
            const senseConfig = activeSenses[senseKey];
            if (!senseConfig || !senseConfig.ACTIVE) return;

            // Filter context rules: Strict matching against targeting capabilities
            if (isTargetingClassRun && !senseConfig.TARGETING) return;

            // Clean Lookup: Match invisibility directly using the shared dictionary key.
            // If a specific sub-sense isn't explicitly flagged, fall back to checking the parent group field.
            const parentGroupKey = senseConfig.SENSEGROUP;
            const isInvisible =
                !!targetInvisibility[senseKey] || (!!parentGroupKey && !!targetInvisibility[parentGroupKey]);

            let passed = false;
            let finalLabel = labelText;
            const canProjectRange = senseConfig.RANGED && isPerceptionPossible;

            if (!isInvisible && canProjectRange) {
                passed = true;
            } else if (isAdjacentFringe && !targetInvisibility.NO_FRINGE) {
                finalLabel = `${labelText} FRINGE`;
                passed = true;
            } else if (isWithinBrightFringe && canProjectRange) {
                finalLabel = `${labelText} BRIGHT FRINGE`;
                passed = true;
            }

            if (passed) {
                targetDetectedLabels.push(finalLabel);
                isAnySenseSuccessful = true;
            }
        };

        // --- EVALUATE SPECIFIC TARGET TRACKS FROM DICTIONARY CONFIG ---
        // 1. Sight Group Options
        evaluateDictionarySense("NORMALSIGHT", "NORMAL SIGHT");
        evaluateDictionarySense("INFRAREDPERCEPTION", "INFRARED SIGHT");
        evaluateDictionarySense("ULTRAVIOLETPERCEPTION", "ULTRAVIOLET SIGHT");
        evaluateDictionarySense("NIGHTVISION", "NIGHT VISION");

        // 2. Hearing Group Options
        evaluateDictionarySense("NORMALHEARING", "NORMAL HEARING");
        evaluateDictionarySense("ACTIVESONAR", "ACTIVE SONAR");
        evaluateDictionarySense("ULTRASONICPERCEPTION", "ULTRASONIC SENSE");

        // 3. Flat Parent Group fallbacks & Secondary Tracks
        evaluateDictionarySense("SMELLGROUP", "SMELL/TASTE");
        evaluateDictionarySense("MENTALAWARENESS", "MENTAL AWARENESS");
        evaluateDictionarySense("TOUCHGROUP", "TOUCH DETECTION");

        // 4. Radio Group Options
        evaluateDictionarySense("RADAR", "RADAR DETECT");
        evaluateDictionarySense("HRRP", "HRRP DETECT");
        evaluateDictionarySense("RADIOPERCEIVETRANSMIT", "RADIO PERCEIVE/TRANSMIT");
        evaluateDictionarySense("RADIOPERCEPTION", "RADIO PERCEPTION");

        // 5. Unusual Group Options
        evaluateDictionarySense("SPATIALAWARENESS", "SPATIAL AWARENESS");
        evaluateDictionarySense("DETECT", "DETECT POWER");

        // --- TELEMETRY LOG GENERATION ---
        if (isAnySenseSuccessful) {
            console.debug(
                `${modeHeader}: ${sourceName} detects ${targetName} via ${targetDetectedLabels.join(" / ")} (Dist: ${distanceMeters}m, PER Target: ${finalModifiedPerTarget}-)`,
            );
            return true;
        } else {
            console.debug(
                `${modeHeader}: ${sourceName} CANNOT detect ${targetName} (Sight/Special Blocked or Range Penalty Too High | Dist: ${distanceMeters}m, PER Target: ${finalModifiedPerTarget}-)`,
            );
            return false;
        }
    }

    /**
     * Compiles the observer's active senses into a flat, generic, property-driven map.
     * Universal layout mapping closely to native HERO Designer data fields.
     * @protected
     */
    _getObserverSenses(sourceToken, sourceActor) {
        // 1. Establish baseline layout for every primary sense group key
        const senseProfile = {
            SIGHTGROUP: { ACTIVE: false, RANGED: true, TARGETING: true }, // Sight is targeting/ranged by default
            HEARINGGROUP: { ACTIVE: false, RANGED: true, TARGETING: false }, // Hearing is ranged, non-targeting by default
            SMELLGROUP: { ACTIVE: false, RANGED: false, TARGETING: false }, // Smell is zero-range by default
            MENTALGROUP: { ACTIVE: false, RANGED: true, TARGETING: false }, // Mental is ranged by default rules
            TOUCHGROUP: { ACTIVE: false, RANGED: false, TARGETING: false }, // Touch is zero-range by default
            RADIOGROUP: { ACTIVE: false, RANGED: true, TARGETING: false },
            UNUSUALGROUP: { ACTIVE: false, RANGED: true, TARGETING: false },

            NORMALSIGHT: { ACTIVE: true, RANGED: true, TARGETING: true, SENSEGROUP: "SIGHTGROUP" },
            NORMALHEARING: { ACTIVE: true, RANGED: true, TARGETING: false, SENSEGROUP: "HEARINGGROUP" },
            ACTIVESONAR: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "HEARINGGROUP" },
            DETECT: { ACTIVE: false, RANGED: false, TARGETING: false, SENSEGROUP: "UNUSUALGROUP" },
            HRRP: { ACTIVE: false, RANGED: false, TARGETING: true, SENSEGROUP: "RADIOGROUP" }, // High Range Radio Perception
            INFRAREDPERCEPTION: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "SIGHTGROUP" },
            MENTALAWARENESS: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "MENTALGROUP" },
            NIGHTVISION: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "SIGHTGROUP" },
            RADAR: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "RADIOGROUP" },
            RADIOPERCEIVETRANSMIT: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "RADIOGROUP" },
            RADIOPERCEPTION: { ACTIVE: false, RANGED: true, TARGETING: false, SENSEGROUP: "RADIOGROUP" },
            SPATIALAWARENESS: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "UNUSUALGROUP" },
            ULTRASONICPERCEPTION: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "HEARINGGROUP" },
            ULTRAVIOLETPERCEPTION: { ACTIVE: false, RANGED: true, TARGETING: true, SENSEGROUP: "SIGHTGROUP" },
        };

        if (!sourceActor) return senseProfile;

        // 2. TARGETINGSENSE (targeting senses include range)
        for (const senseItem of sourceActor.items.filter(
            (item) => item.system.XMLID === "TARGETINGSENSE" && item.isActive,
        )) {
            const senseEntry = senseProfile[senseItem.system.OPTIONID];
            if (!senseEntry) {
                console.error(`${senseItem.name} has unhandled OPTIONID`);
            } else {
                senseEntry.ACTIVE = true;
                senseEntry.RANGED = true;
                senseEntry.TARGETING = true;
            }

            for (const senseAdder of senseItem.adders) {
                const senseEntry = senseProfile[senseAdder.XMLID];
                if (!senseEntry) {
                    console.error(`${senseItem.name}/${senseAdder.name} has unhandled XMLID`);
                } else {
                    senseEntry.ACTIVE = true;
                    senseEntry.RANGED = true;
                    senseEntry.TARGETING = true;
                }
            }
        }

        // 3. Generic sense powers
        for (const senseItem of sourceActor.items.filter(
            (item) => item.baseInfo.type.includes("sense") && item.isActive,
        )) {
            // Must have senseBuiltIn or a similar adder
            if (senseItem.baseInfo.behaviors.includes("senseBuiltIn") || senseItem.findModsByXmlid("MAKEASENSE")) {
                const senseEntry = senseProfile[senseItem.system.XMLID];
                const senseGroup = senseProfile[senseItem.system.GROUP];
                if (!senseEntry || !senseGroup) {
                    console.error(`${senseItem.name} has unhandled XMLID or GROUP`);
                } else {
                    senseEntry.ACTIVE = true;
                    senseGroup.ACTIVE = senseEntry.ACTIVE;
                    senseEntry.RANGED =
                        senseItem.baseInfo.behaviors.includes("rangeBuiltIn") || senseItem.findModsByXmlid("RANGE");
                    senseGroup.RANGED = senseEntry.RANGED;
                    senseEntry.TARGETING =
                        senseItem.baseInfo.behaviors.includes("targetingBuiltIn") ||
                        senseItem.findModsByXmlid("TARGETINGSENSE");
                    senseGroup.TARGETING = senseEntry.TARGETING;
                }
            } else {
                //console.warn(`${senseItem.name} is not a sense`);
            }
        }

        // 4. Flash (note that only sense groups have a status, so flashing normal sight not supported)
        const statusMap = {
            SIGHTGROUP: "blind",
            HEARINGGROUP: "hearingSenseDisabled",
            SMELLGROUP: "smellTasteSenseDisabled",
            MENTALGROUP: "mentalSenseDisabled",
            TOUCHGROUP: "touchSenseDisabled",
            RADIOGROUP: "radioSenseDisabled",
        };
        for (const [senseGroup, _status] of Object.entries(statusMap)) {
            if (sourceActor.statuses.has(_status)) {
                for (const senseEntry of Object.entries(senseProfile)
                    .filter(([key, value]) => key === senseGroup || value.SENSEGROUP === senseGroup)
                    .map(([, value]) => value)) {
                    senseEntry.ACTIVE = false;
                }
            }
        }

        // console.debug(
        //     `${sourceToken.name} has TARGETING => ${Object.entries(senseProfile)
        //         .filter(([, value]) => value.ACTIVE && value.TARGETING)
        //         .map(([key]) => key)
        //         .join(",")}`,
        // );

        return senseProfile;
    }

    /**
     * Gathers active invisibility properties from the target, splitting them into groups and specific senses.
     * @protected
     */
    _getTargetInvisibility(targetToken, targetActor) {
        const item = targetActor?.items?.find((i) => i.system.XMLID === "INVISIBILITY" && i.isActive);

        // Baseline native system invisible condition (Defaults to mapping strictly to Normal Sight)
        const hasCoreInvisibleStatus = !!targetToken?.document?.hasStatusEffect("invisible");

        // Standard helper to see if a specific modifier XMLID is attached to the Invisibility power item
        const blocksSense = (modXmlid) => {
            if (!item) return false;
            return !!item.findModsByXmlid?.(modXmlid);
        };

        // Fix: Dynamic structural parsing checking both root item fields and item adders
        const blocksSenseByAdder = (xmlId) => {
            if (!item) return false;
            return item.adders?.some((adder) => adder.XMLID === xmlId) || blocksSense(xmlId);
        };

        // Primary group coverage flags
        const blocksSightGroup =
            hasCoreInvisibleStatus || (!!item && (blocksSense("SIGHTGROUP") || !item.system.MODIFIERS));
        const blocksHearingGroup = !!item && blocksSense("HEARINGGROUP");
        const blocksSmellGroup = !!item && blocksSense("SMELLGROUP");
        const blocksMentalGroup = !!item && blocksSense("MENTALGROUP");
        const blocksTouchGroup = !!item && blocksSense("TOUCHGROUP");
        const blocksRadioGroup = !!item && blocksSense("RADIOGROUP");
        const blocksUnusualGroup = !!item && blocksSense("UNUSUALGROUP");

        return {
            // Parent Groups Matches
            SIGHTGROUP: blocksSightGroup,
            HEARINGGROUP: blocksHearingGroup,
            SMELLGROUP: blocksSmellGroup,
            MENTALGROUP: blocksMentalGroup,
            TOUCHGROUP: blocksTouchGroup,
            RADIOGROUP: blocksRadioGroup,
            UNUSUALGROUP: blocksUnusualGroup,

            // Specific Sight Senses
            NORMALSIGHT: blocksSightGroup,
            INFRAREDPERCEPTION: !!item && (blocksSightGroup || blocksSenseByAdder("INFRAREDPERCEPTION")),
            ULTRAVIOLETPERCEPTION: !!item && (blocksSightGroup || blocksSenseByAdder("ULTRAVIOLETPERCEPTION")),
            NIGHTVISION: blocksSightGroup,

            // Specific Hearing Senses
            NORMALHEARING: blocksHearingGroup,
            ACTIVESONAR: !!item && (blocksHearingGroup || blocksSenseByAdder("ACTIVESONAR")),
            ULTRASONICPERCEPTION: !!item && (blocksHearingGroup || blocksSenseByAdder("ULTRASONICPERCEPTION")),

            // Specific Radio Senses
            RADAR: !!item && (blocksRadioGroup || blocksSenseByAdder("RADAR")),
            HRRP: !!item && (blocksRadioGroup || blocksSenseByAdder("HRRP")),
            RADIOPERCEIVETRANSMIT: !!item && (blocksRadioGroup || blocksSenseByAdder("RADIOPERCEIVETRANSMIT")),
            RADIOPERCEPTION: !!item && (blocksRadioGroup || blocksSenseByAdder("RADIOPERCEPTION")),

            // Specific Mental Senses
            MENTALAWARENESS: blocksMentalGroup,

            // Specific Unusual Senses
            SPATIALAWARENESS: !!item && (blocksUnusualGroup || blocksSenseByAdder("SPATIALAWARENESS")),
            DETECT: !!item && (blocksUnusualGroup || blocksSenseByAdder("DETECT")),

            // Fringe Attributes
            NO_FRINGE: !!item && blocksSense("NOFRINGE"),
            BRIGHT_FRINGE: !!item && blocksSense("BRIGHTFRINGE"),
        };
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

    // CONFIG.Canvas.detectionModes["heroNonTargetingV14"] = new HeroNonTargetingDetectionModeV14({
    //     id: "heroNonTargetingV14",
    //     label: "HERO: Non-Targeting Senses (v14)",
    //     type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SOUND,
    // });
}
