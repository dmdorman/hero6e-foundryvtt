import { HEROSYS } from "./herosystem6e.mjs";
import { getRoundedDownDistanceInSystemUnits, getSystemDisplayUnits } from "./utility/units.mjs";

import { isGameV12OrLater } from "./utility/compatibility.mjs";

export class HeroRuler extends Ruler {
    constructor(...args) {
        super(...args);
        this.initialize();
    }

    initialize() {
        function movementRadioSelectRender() {
            const tokenControlButton = $(
                ".scene-control[data-control='token']",
            );

            const relevantToken = canvas.tokens.controlled[0];

            if (!relevantToken) return;
            if (!relevantToken.actor) return;

            const movementPowers = relevantToken.actor.system.is5e
                ? CONFIG.HERO.movementPowers5e
                : CONFIG.HERO.movementPowers;

            let movementItems = [];
            for (const key of Object.keys(
                relevantToken.actor.system.characteristics,
            ).filter((o) => movementPowers[o])) {
                const char = relevantToken.actor.system.characteristics[key];
                if ((parseInt(char.value) || 0) > 0) {
                    char._id = key;
                    char.name = movementPowers[key];
                    movementItems.push(char);
                }
            }

            const renderRadioOptions = () => {
                const activeMovement =
                    movementItems.length === 0
                        ? "none"
                        : movementItems.find(
                              (o) =>
                                  o._id ==
                                  relevantToken.actor.flags.activeMovement,
                          )?._id || movementItems[0]._id;

                const radioOptions = movementItems
                    .map(
                        (item, index) => `
                    <div class="radio" data-tool="${item._id}">
                        <input id="radio-${index}" name="radio" type="radio" ${
                            activeMovement === item._id ? "checked" : ""
                        }>
                        <label for="radio-${index}" class="radio-label">${
                            item.name
                        } (${item.value}${getSystemDisplayUnits(
                            relevantToken.actor.is5e,
                        )})</label>
                    </div>
                `,
                    )
                    .join("");

                const radioSelect = $(
                    `<div class="radio-container">${radioOptions}</div>`,
                );

                radioSelect.find("[data-tool]").click(async function () {
                    const tool = $(this).attr("data-tool");

                    await relevantToken.actor.update({
                        "flags.activeMovement": tool,
                    });

                    renderRadioOptions();
                });

                if (tokenControlButton.find(".radio-container").length > 0) {
                    tokenControlButton.find(".radio-container").remove();
                }

                tokenControlButton.append(radioSelect);
            };

            renderRadioOptions();
        }

        Hooks.on("controlToken", function () {
            const sceneControls = ui.controls;
            if (sceneControls.activeControl !== "token") {
                return;
            }

            const tokensControlled = canvas.tokens.controlled.length;

            if (tokensControlled !== 1) {
                // remove movement radio buttons
                $(".scene-control[data-control='token']")
                    .find(".radio-container")
                    .remove();
                return;
            }

            movementRadioSelectRender();
        });

        this._handleDragRuler();

        Hooks.on("renderSceneControls", function (sceneControls) {
            if (sceneControls.activeControl !== "token") {
                return;
            }

            const tokensControlled = canvas.tokens.controlled.length;

            if (tokensControlled !== 1) {
                return;
            }

            movementRadioSelectRender();

            return;
        });

        Hooks.on("updateActor", function (actor, args) {
            const sceneControls = ui.controls;
            if (sceneControls.activeControl !== "token") {
                return;
            }

            if (
                !args?.system?.characteristics &&
                !args?.flags?.activeMovement
            ) {
                return;
            }

            // Kluge to update actor right away so the render has proper data.
            // There is likely a better way to deal with this, possibly in the refreshToken hook.
            if (args?.flags?.activeMovement) {
                actor.flags.activeMovement = args?.flags?.activeMovement;
            }

            movementRadioSelectRender();
        });

        Hooks.on("hdcUpload", function () {
            const sceneControls = ui.controls;
            if (sceneControls.activeControl !== "token") {
                return;
            }

            movementRadioSelectRender();
        });
    }

    _getSegmentLabel(
        segmentDistance,
        totalDistanceInMetres, // NOTE: Assuming totalDistance is in metres. We could try to pull out the grid distance etc to be smarter.
    ) {
        //const relevantToken = canvas.tokens.controlled[0];
        const relevantActor = this.token?.actor; //relevantToken?.actor;

        if (!relevantActor) {
            console.error(
                "HERO | Unable to determine actor for segment label.",
            );
            return;
        }

        const rangeMod = calculateRangePenaltyFromDistanceInMetres(
            totalDistanceInMetres,
            relevantActor,
        );

        if (!relevantActor) {
            console.error(
                "HERO System | Unable to determine actor for segment label.",
            );
            return;
        }

        const movementPowers = relevantActor.system.is5e
            ? CONFIG.HERO.movementPowers5e
            : CONFIG.HERO.movementPowers;

        const movementItems = [];
        for (const key of Object.keys(
            relevantActor.system.characteristics,
        ).filter((o) => movementPowers[o])) {
            const char = relevantActor.system.characteristics[key];
            if ((parseInt(char.value) || 0) > 0) {
                char._id = key;
                char.name = movementPowers[key];
                movementItems.push(char);
            }
        }

        const activeMovement =
            movementItems.length === 0
                ? "none"
                : movementItems.find(
                      (o) => o._id == relevantActor.flags.activeMovement,
                  )?._id || movementItems[0]._id;

        const activeMovementLabel =
            activeMovement === "none"
                ? "Running"
                : movementItems.find((e) => e._id === activeMovement)?.name;

        const label = `[${Math.round(
            getRoundedDownDistanceInSystemUnits(
                segmentDistance.distance,
                relevantActor,
            ),
        )}${getSystemDisplayUnits(relevantActor?.is5e)}]${
            activeMovementLabel ? `\n${activeMovementLabel}` : ""
        }\n${rangeMod > 0 ? "-" : ""}${rangeMod} Range Modifier`;

        return label;
    }

    _handleDragRuler() {
        // Known compatibility issues with DragRuler and FoundryVTT V12
        // Don't even bother recommending it's use at this time.
        if (isGameV12OrLater()) {
            if (
                game.modules.get("drag-ruler")?.active &&
                game.modules.get("drag-ruler").version === "1.13.8"
            ) {
                ui.notifications.error(
                    "You may need to disable the DragRuler module as it may cause issues with FoundryVTT V12.",
                    { console: true, permanent: true },
                );
            }
            return;
        } else {
            // We recommend using Drag Ruler
            if (!game.modules.get("drag-ruler")) {
                ui.notifications.warn(game.i18n.localize("Warning.DragRuler.Install"));
                return;
            }

            // We recommend using Drag Ruler
            if (!game.modules.get("drag-ruler")?.active) {
                ui.notifications.warn(game.i18n.localize("Warning.DragRuler.Active"));
            }

            if (game.modules.get("drag-ruler")?.active) {
                _registerDragRuler();
            }
        }
    }

    _registerDragRuler() {
        Hooks.once("dragRuler.ready", (SpeedProvider) => {
            class HeroSysSpeedProvider extends SpeedProvider {
                get colors() {
                    return [
                        {
                            id: "half",
                            default: 0x00ff00,
                            name: game.i18n.localize("Movement.Half"),
                        },
                        {
                            id: "full",
                            default: 0xffff00,
                            name: game.i18n.localize("Movement.Full"),
                        },
                        {
                            id: "noncombat",
                            default: 0xff8000,
                            name: game.i18n.localize("Movement.Noncombat"),
                        },
                    ];
                }

                getRanges(token) {
                    const baseSpeedInMetres = HeroSysSpeedProvider.getMovementSpeedInMetres(token);

                    // Convert metres into hexes using the standard 1" = 2m conversion with the
                    // assumption that the grid is set to 1 hex = 2m.
                    const ranges = [
                        {
                            range: Math.ceil(baseSpeedInMetres / 2),
                            color: "half",
                        },
                        {
                            range: Math.floor(baseSpeedInMetres / 2) + Math.ceil(baseSpeedInMetres / 2),
                            color: "full",
                        },

                        // TODO: This is assuming that the movement type has no non combat multiples.
                        { range: baseSpeedInMetres * 2, color: "noncombat" },
                    ];

                    return ranges;
                }

                /**
                 *
                 * Return the movement speed of a token in metres per phase.
                 * 5e stores the value as ". 6e stores the value as m.
                 *
                 * @param {Object} token
                 * @returns number
                 */
                static getMovementSpeedInMetres(token) {
                    const key = token.actor.flags.activeMovement || "running";
                    const is5e = !!token.actor.system.is5e;
                    const movementValue = parseInt(token.actor.system.characteristics[key].value) || 0;

                    return is5e ? movementValue * 2 : movementValue;
                }

                async onMovementHistoryUpdate(tokens) {
                    await super.onMovementHistoryUpdate(tokens);

                    const automation = game.settings.get(HEROSYS.module, "automation");

                    for (const tokenObj of tokens) {
                        const token = tokenObj?.document;
                        if (!token) continue; // This should not be needed.  Possible issue with Flight selected, and actor re-uploaded.
                        const actor = token.actor;

                        if (
                            automation === "all" ||
                            (automation === "npcOnly" && actor.type == "npc") ||
                            (automation === "pcEndOnly" && actor.type === "pc")
                        ) {
                            // Only consume endurance on token's phase, allowing for Knockback movement (which does not consume END)
                            if (game.combat?.combatant.actorId != actor.id) continue;

                            const combatant = game.combat?.combatants.find((o) => o.actorId === actor.id);
                            if (combatant) {
                                // If no waypoints then we haven't spent any END in this phase yet.
                                if (!combatant.flags.dragRuler.passedWaypoints) {
                                    combatant.update({
                                        ["flags.dragRuler.spentEnd"]: 0,
                                    });
                                    return;
                                }

                                // Add movement type to last movement waypoint
                                // combatant.flags.dragRuler.passedWaypoints[
                                //     combatant.flags.dragRuler.passedWaypoints
                                //         .length - 1
                                // ].activeMovement = actor.flags?.activeMovement;

                                let spentEnd = parseInt(combatant.flags.dragRuler.spentEnd || 0);

                                // TODO: We are using getMovedDistanceFromToken to get total distance,
                                // however, we really should separate distances by activeMovement so
                                // we can apply END modifications to specific movements.
                                // This is only an issue with split movement types.
                                let currentDistance = dragRuler.getMovedDistanceFromToken(tokenObj);

                                // DistancePerEnd default is 10m costs 1 END
                                let DistancePerEnd = 10;

                                // Find associated MOVEMENT type (if any)
                                // and adjust DistancePerEnd as appropriate.
                                // TODO: Only adjust if movement power is used.
                                //  For example a natural 12m run with a 20m running power;
                                //  you only need to adjust when you exceed 12m.
                                const movementPower = actor.items.find(
                                    (o) =>
                                        o.system.XMLID === actor.flags.activeMovement?.toUpperCase() && o.system.active,
                                );
                                const reducedEnd = movementPower?.findModsByXmlid("REDUCEDEND");
                                if (reducedEnd) {
                                    if (reducedEnd.OPTION === "HALFEND") {
                                        DistancePerEnd = DistancePerEnd * 2;
                                    }
                                    if (reducedEnd.OPTION === "ZERO") {
                                        return;
                                    }
                                }
                                const increasedEnd = movementPower?.findModsByXmlid("INCREASEDEND");
                                if (increasedEnd) {
                                    DistancePerEnd /= parseInt(increasedEnd.OPTION.replace("x", "")) || 1;
                                }

                                // TODO: This is assuming every 10 costs 1 endurance
                                let totalEnd = Math.ceil(currentDistance / DistancePerEnd);
                                let costEnd = totalEnd - spentEnd;
                                if (costEnd > 0) {
                                    actor.update({
                                        ["system.characteristics.end.value"]:
                                            parseInt(actor.system.characteristics.end.value) - costEnd,
                                    });
                                }
                                combatant.update({
                                    ["flags.dragRuler.spentEnd"]: totalEnd,
                                });
                            }
                        }
                    }
                }
            }

            dragRuler.registerSystem(HEROSYS.module, HeroSysSpeedProvider);
        });
    }
}

/**
 * Calculate the velocity in system units (5e is " and 6e in m).
 * NOTE: dragRuler.getRangesFromSpeedProvider ranges are stored in m.
 *
 * @param {Object} actor
 * @param {Object} token
 * @returns
 */
export function calculateVelocityInSystemUnits(actor, token) {
    let velocity = 0;

    const combatants = game?.combat?.combatants;

    // In combat we can calculate the velocity using the distance moved and acceleration rules (5 units/phase per unit moved).
    // TODO: This does not consider the movement power being purchased with improved acceleration.
    if (combatants && typeof dragRuler != "undefined" && token) {
        const distance = dragRuler.getMovedDistanceFromToken(token);
        const ranges = dragRuler.getRangesFromSpeedProvider(token);
        const speed = ranges.length > 1 ? ranges[1].range : 0;
        let delta = distance;
        if (delta > speed / 2) {
            delta = speed - delta;
        }
        velocity = delta * 5;

        if (actor.system.is5e) {
            velocity = velocity / 2;
        }
    }

    // Simplistic velocity calc using dragRuler based on a full phase move.
    else if (velocity === 0 && typeof dragRuler != "undefined" && token) {
        if (dragRuler.getRangesFromSpeedProvider(token).length > 1) {
            velocity = parseInt(dragRuler.getRangesFromSpeedProvider(token)[1].range || 0);

            if (actor.system.is5e) {
                velocity = velocity / 2;
            }
        }
    }

    // Simplistic velocity calc using running & flight
    // TODO: Should we not at least get the presently enabled movement type(s) to make a guess?
    else {
        velocity = parseInt(actor.system.characteristics.running.value || 0);
        velocity = Math.max(velocity, parseInt(actor.system.characteristics.flight.value || 0));
    }

    return velocity;
}

/**
 * Calculate range based on a provided distance in metres. Range penalties are essentially
 * the same in 5e and 6e, but there is a difference in the rounding of the distance.
 *
 * @param {number} distanceInMetres
 * @param {object} actor
 */
export function calculateRangePenaltyFromDistanceInMetres(distanceInMetres, actor) {
    const is5e = actor?.system?.is5e;
    const roundedDistanceInMetres = getRoundedDownDistanceInSystemUnits(distanceInMetres, actor) * (is5e ? 2 : 1);
    const basicRangePenalty = Math.ceil(Math.log2(roundedDistanceInMetres / 8)) * 2;
    const rangePenalty = Math.max(0, basicRangePenalty);

    return rangePenalty;
}
