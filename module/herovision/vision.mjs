import { HeroCompatibility } from "../utility/compatibility.mjs";
import { calculateDistanceBetween } from "../utility/range.mjs";
import { HeroVisionModeInfraredPerception } from "./vision-modes/infrared-perception2.mjs";

const { VisionMode, DetectionMode } = foundry.canvas.perception;

export class HeroPointVisionSource extends foundry.canvas.sources.PointVisionSource {
    get isBlinded() {
        try {
            // Only override Hero Vision
            if (this.visionMode.id !== "heroVision") {
                return super.isBlinded;
            }

            const start = Date.now();

            const defaultBlind =
                (this.data.radius === 0 && (this.data.lightRadius === 0 || !this.visionMode?.perceivesLight)) ||
                Object.values(this.blinded).includes(true);
            if (!defaultBlind) {
                const duration = Date.now() - start;
                if (duration > 1) {
                    console.debug(Date.now() - start, this);
                }
                return defaultBlind;
            }

            // Do we have an enhanced vision with DETECT & SENSE & RANGE?
            // Some visions have SENSE/RANGE (built in)
            // SightGroup/ToughGroup/HearingGroup/RadioGroup/SmellGroup have SENSE builtIn
            // Assuming only SIGHT/TOUCH/SMELL or TARGETING can actually SEE (you can see, touch, smell a wall)
            let blindVisionItem = this.token?.actor?.items.find(
                (i) =>
                    i.isActive &&
                    i.isSense &&
                    i.isRangedSense &&
                    (i.isTargeting || ["TOUCHGROUP", "SMELLGROUP"].includes(i.system.GROUP)) &&
                    (!this.token?.actor?.statuses.has("blind") || i.system.GROUP !== "SIGHTGROUP") &&
                    !this.token.actor.statuses.has(i.system.GROUP.replace("GROUP", "").toLowerCase() + "SenseDisabled"),
            );

            if (blindVisionItem) {
                //console.log("blindVisionItem", blindVisionItem);
                const duration = Date.now() - start;
                if (duration > 1) {
                    console.debug(Date.now() - start, this);
                }
                return false;
            }
            const duration = Date.now() - start;
            if (duration > 1) {
                console.debug(Date.now() - start, this);
            }
            return defaultBlind;
        } catch (e) {
            console.error(e);
        }
        return false;
    }

    get token() {
        if (!this.sourceId.match("Token.")) return null;
        const _tokenId = this.sourceId.match(/\.([a-z0-9]{16})/i)?.[1];
        return canvas.tokens.placeables.find((t) => t.id === _tokenId);
    }
}

export function setPerceptionModes() {
    class HeroVisionMode extends VisionMode {
        constructor() {
            super({
                id: "heroVision",
                label: "Hero Vision",
                // walls: true,
                // angle: false,
                type: DetectionMode.DETECTION_TYPES.SIGHT,
            });
        }
    }

    // v14 has HeroVision issues
    if (!HeroCompatibility.isV14) {
        CONFIG.Canvas.visionModes.heroVision = new HeroVisionMode();
        CONFIG.Canvas.visionModes.infraredPerception = new HeroVisionModeInfraredPerception();
    }

    /**
     * Hero Generic Sense
     */
    class HeroDetectionSightMode extends DetectionMode {
        constructor() {
            super({
                id: "heroDetectSight",
                //label: "PF2E.Actor.Creature.Sense.Type.Thoughts",
                //walls: true,
                //angle: false,
                type: DetectionMode.DETECTION_TYPES.SIGHT,
            });
        }

        static getDetectionFilter() {
            DetectionMode._detectionFilter ??= foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
                wave: true,
                knockout: false,
            });
            const filter2 = DetectionMode._detectionFilter;
            filter2.thickness = 1;

            return filter2;
        }

        _canDetect(visionSource, target) {
            if (this.id !== "heroDetectSight") {
                return super._canDetect(visionSource, target);
            }

            try {
                const start = Date.now();

                if (target?.document?.hidden === true) return false;
                if (super._canDetect(visionSource, target)) return true; // handled by standard vision
                if (!target.document.hidden && !target.document.hasStatusEffect("invisible")) {
                    return true;
                }

                // Invisibility Fringe
                const INVISIBILITY = target?.actor?.items.find((i) => i.system.XMLID === "INVISIBILITY");
                if (INVISIBILITY && !INVISIBILITY.findModsByXmlid("NOFRINGE")) {
                    const distance = calculateDistanceBetween(visionSource.token, target).distance;
                    if (distance < 2.1) {
                        const duration = Date.now() - start;
                        if (duration > 3) {
                            console.debug(`VISION: _canDetect check took ${Date.now() - start} ms`, this);
                        }
                        return true;
                    }
                }
                const duration = Date.now() - start;
                if (duration > 3) {
                    console.debug(`VISION: _canDetect check took ${Date.now() - start} ms`, this);
                }
            } catch (e) {
                console.error(e);
            }
            return false;
        }

        /// Override
        _testLOS(visionSource, mode, target, test) {
            if (this.id !== "heroDetectSight") {
                return super._testLOS(visionSource, mode, target, test);
            }

            const start = Date.now();

            // Kluge to let PARTIALLYPENETRATIVE see thru walls.
            // Although DESOLIDIFICATION make you undetectable via touch group
            // TODO: Make wall materials and check each wall to see if we can see thru it.
            const DESOLIDIFICATION = target?.actor?.items.find(
                (i) => i.isActive && i.system.XMLID === "DESOLIDIFICATION",
            );
            const FLIGHT = target?.actor?.items.find((i) => i.isActive && i.system.XMLID === "FLIGHT");
            const hideFromTouchGroup = DESOLIDIFICATION || FLIGHT;
            const PARTIALLYPENETRATIVE = visionSource.object?.actor?.items.find(
                (i) =>
                    i.isActive &&
                    i.isSense &&
                    i.isRangedSense &&
                    i.adders.find((a) => a.XMLID === "PARTIALLYPENETRATIVE") &&
                    (!hideFromTouchGroup || i.system.GROUP != "TOUCHGROUP"),
            );
            const PENETRATIVE =
                !DESOLIDIFICATION &&
                visionSource.object?.actor?.items.find(
                    (i) =>
                        i.isActive &&
                        i.isSense &&
                        i.isRangedSense &&
                        i.adders.find((a) => a.XMLID === "PENETRATIVE") &&
                        (!hideFromTouchGroup || i.system.GROUP != "TOUCHGROUP"),
                );

            if (!this.walls || PARTIALLYPENETRATIVE || PENETRATIVE)
                return this._testAngle(visionSource, mode, target, test);
            const type = visionSource.constructor.sourceType;
            const isSight = type === "sight";
            if (isSight && visionSource.blinded.darkness) return false;
            if (!this.angle && visionSource.data.angle < 360) {
                // Constrained by walls but not by vision angle

                const duration = Date.now() - start;
                if (duration > 3) {
                    console.debug(`VISION: _testLOS check took ${Date.now() - start} ms`, this);
                }

                return !CONFIG.Canvas.polygonBackends[type].testCollision(
                    { x: visionSource.x, y: visionSource.y },
                    test.point,
                    { type, mode: "any", source: visionSource, useThreshold: true, includeDarkness: isSight },
                );
            }
            // Constrained by walls and vision angle
            let hasLOS = test.los.get(visionSource);
            if (hasLOS === undefined) {
                hasLOS = visionSource.los.contains(test.point.x, test.point.y);
                test.los.set(visionSource, hasLOS);
            }

            const duration = Date.now() - start;
            if (duration > 3) {
                console.debug(`VISION: _testLOS check took ${Date.now() - start} ms`, this);
            }
            return hasLOS;
        }
    }

    // Problems with v14 HeroDetect
    if (!HeroCompatibility.isV14) {
        CONFIG.Canvas.detectionModes.heroDetectSight = new HeroDetectionSightMode(); //new DeCONFIG.Canvas.detectionModes.feelTremor.clone();
        CONFIG.Canvas.detectionModes.heroDetectSight.label = "Hero Detect Sight";
    }
}
