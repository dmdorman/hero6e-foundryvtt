import { HEROSYS } from "./herosystem6e.mjs";
import { getSystemDisplayUnits } from "./utility/units.mjs";
import { calculateRangePenaltyFromDistanceInMetres } from "./utility/range.mjs";
import { whisperUserTargetsForActor } from "./utility/util.mjs";
import { RoundFavorPlayerDown } from "./utility/round.mjs";

// v13 has namespaced this. Remove when support is no longer provided. Also remove from eslint template.
const FoundryVttRuler = foundry.canvas?.interaction?.Ruler || Ruler;

export class HeroRuler extends FoundryVttRuler {
    static _controlToken() {
        const sceneControls = ui.controls;
        // V13
        // SceneControls#activeControl is deprecated in favor of SceneControls#control#name
        // Deprecated since Version 13
        if ((sceneControls.control?.name || sceneControls.activeControl) !== "token") {
            return;
        }
        if (sceneControls.activeTool !== "select") {
            return;
        }

        const tokensControlled = canvas.tokens.controlled.length;

        if (tokensControlled !== 1) {
            // remove movement radio buttons
            $(".scene-control[data-control='token']").find(".radio-container").remove();
            return;
        }

        this._movementRadioSelectRender();
    }

    static async _movementRadioSelectRender() {
        const tokenControlButton = $(".scene-control[data-control='token']");

        const relevantToken = canvas.tokens.controlled[0];

        if (!relevantToken) return;
        if (!relevantToken.actor) return;

        const movementPowers = relevantToken.actor.system.is5e
            ? CONFIG.HERO.movementPowers5e
            : CONFIG.HERO.movementPowers;

        let movementItems = [];
        for (const key of Object.keys(relevantToken.actor.system.characteristics).filter((o) => movementPowers[o])) {
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
                    : movementItems.find((o) => o._id === relevantToken.actor.flags[game.system.id]?.activeMovement)
                          ?._id || movementItems[0]._id;

            const radioOptions = movementItems
                .map(
                    (item, index) => `
                <div class="radio" data-tool="${item._id}">
                    <input id="radio-${index}" name="radio" type="radio" ${
                        activeMovement === item._id ? "checked" : ""
                    }>
                    <label for="radio-${index}" class="radio-label">${item.name} (${item.value}${getSystemDisplayUnits(
                        relevantToken.actor.is5e,
                    )})</label>
                </div>
            `,
                )
                .join("");

            const radioSelect = $(`<div class="radio-container">${radioOptions}</div>`);

            radioSelect.find("[data-tool]").click(async function () {
                const tool = $(this).attr("data-tool");

                await relevantToken.actor.update({
                    [`flags.${game.system.id}.activeMovement`]: tool,
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

    static initialize() {
        const that = this;

        Hooks.once("ready", function () {
            Hooks.on("controlToken", that._controlToken.bind(that));
            window.setTimeout(that._controlToken.bind(that), 1);
            //that._controlToken(); //.bind(that);
        });

        if (!game.modules.get("drag-ruler")?.active) {
            return;
        }

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
                    const key = token.actor.flags[game.system.id]?.activeMovement || "running";
                    const is5e = !!token.actor.system.is5e;
                    const movementValue = parseInt(token.actor.system.characteristics[key]?.value) || 0;

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
                            (automation === "npcOnly" && actor.type === "npc") ||
                            (automation === "pcEndOnly" && actor.type === "pc")
                        ) {
                            // Only consume endurance on token's phase, allowing for Knockback movement (which does not consume END)
                            if (game.combat?.combatant.actorId != actor.id) continue;

                            const combatant = game.combat?.combatants.find((o) => o.actorId === actor.id);
                            if (combatant) {
                                // We store END use in flags.dragRuler, not sure why
                                // TODO: Remove dependency on DragRuler.
                                if (!combatant.flags.dragRuler) continue;

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

                                // Noncombat Movement?
                                // if (Math.floor(currentDistance - 1) > this.getRanges(token)[1].range && token.actor) {
                                //     token.actor.addActiveEffect(
                                //         HeroSystem6eActorActiveEffects.statusEffectsObj.nonCombatMovementEffect,
                                //     );
                                // }

                                // DistancePerEnd default is 10m costs 1 END
                                let DistancePerEnd = 10;

                                // Find associated MOVEMENT type (if any)
                                // and adjust DistancePerEnd as appropriate.
                                // TODO: Only adjust if movement power is used.
                                //  For example a natural 12m run with a 20m running power;
                                //  you only need to adjust when you exceed 12m.
                                const movementPower = actor.items.find(
                                    (o) =>
                                        o.system.XMLID === actor.flags[game.system.id]?.activeMovement?.toUpperCase() &&
                                        o.isActive,
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

                                // Maximum Endurance
                                const MaximumEndurance = Math.max(
                                    1,
                                    RoundFavorPlayerDown(
                                        (movementPower?.activePoints || this.getRanges(token)[1].range) /
                                            DistancePerEnd,
                                    ),
                                );

                                let content = "";
                                const CHARGES = movementPower?.findModsByXmlid("CHARGES");
                                if (CHARGES && movementPower.system.charges && !combatant.flags.dragRuler?.spentEnd) {
                                    if (movementPower.system.charges.value === 0) {
                                        ui.notifications.error(
                                            `${token.name} has no charges left and should not be moving.`,
                                        );
                                        content += `${token.name} has no charges left and should not be moving. `;
                                    } else {
                                        movementPower.system.charges.value = Math.max(
                                            0,
                                            parseInt(movementPower.system.charges.value) - 1,
                                        );
                                        movementPower.updateItemDescription();
                                        await movementPower.update({
                                            "system.charges.value": movementPower.system.charges.value,
                                            "system.description": movementPower.system.description,
                                        });
                                        content += `${token.name} spent one charge of ${movementPower.name} (${movementPower.system.charges.value} charges remain). `;
                                    }
                                }

                                // TODO: This is assuming every 10 costs 1 endurance
                                let totalEnd = Math.ceil(currentDistance / DistancePerEnd);

                                // MaximumEndurance
                                if (totalEnd > MaximumEndurance) {
                                    console.log("MaximumEndurance", MaximumEndurance);
                                    totalEnd = MaximumEndurance;
                                }
                                let costEnd = totalEnd - spentEnd;
                                if (costEnd > 0) {
                                    actor.update({
                                        ["system.characteristics.end.value"]:
                                            parseInt(actor.system.characteristics.end.value) - costEnd,
                                    });

                                    content += `${token.name} spent ${costEnd} END for ${actor.flags[game.system.id]?.activeMovement?.toUpperCase() || "movement"}. Total of ${Math.ceil(currentDistance)}m and ${totalEnd} END. Endurance use is capped at ${MaximumEndurance}.`;
                                    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
                                    speaker.alias = actor.name;
                                    const chatData = {
                                        //author: game.user._id,
                                        content,
                                        speaker: speaker,
                                        whisper: whisperUserTargetsForActor(token.actor), // [...ChatMessage.getWhisperRecipients("GM")],
                                    };

                                    await ChatMessage.create(chatData);
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

        Hooks.on("renderSceneControls", function (sceneControls) {
            if (!game.modules.get("drag-ruler")?.active) {
                return;
            }

            if (sceneControls.activeControl !== "token") {
                return;
            }
            if (sceneControls.activeTool !== "select") {
                return;
            }

            const tokensControlled = canvas.tokens.controlled.length;

            if (tokensControlled !== 1) {
                return;
            }

            that._movementRadioSelectRender();

            return;
        });

        Hooks.on("updateActor", function (actor, args) {
            const sceneControls = ui.controls;
            if (sceneControls.activeControl !== "token") {
                return;
            }
            if (sceneControls.activeTool !== "select") {
                return;
            }

            if (!args?.system?.characteristics && !args?.flags?.activeMovement) {
                return;
            }

            // Kludge to update actor right away so the render has proper data.
            // There is likely a better way to deal with this, possibly in the refreshToken hook.
            if (args?.flags?.[game.system.id]?.activeMovement) {
                actor.flags[game.system.id] = {};
                actor.flags[game.system.id].activeMovement = args.flags[game.system.id]?.activeMovement;
            }

            that._movementRadioSelectRender();
        });

        Hooks.on("hdcUpload", function () {
            const sceneControls = ui.controls;
            if (sceneControls.activeControl !== "token") {
                return;
            }
            if (sceneControls.activeTool !== "select") {
                return;
            }

            that._movementRadioSelectRender();
        });
    }

    /** V12
     * Get the text label for a segment of the measured path
     * @param {RulerMeasurementSegment} segment
     * @returns {string}
     * @protected
     */
    _getSegmentLabel(_segment, _totalDistance) {
        // second argument only provided in v11
        // however total distance is avail in v12
        // both can use this.totalDistance
        const baseLabel = super._getSegmentLabel(_segment, _totalDistance);
        if (_segment.last) {
            const actor = this.token?.actor || canvas.tokens.controlled?.[0]?.actor;
            if (!actor) return baseLabel;
            const movementPowers = actor.system.is5e ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers;
            const movementItems = [];
            for (const key of Object.keys(actor.system.characteristics).filter((o) => movementPowers[o])) {
                const char = actor.system.characteristics[key];
                if ((parseInt(char.value) || 0) > 0) {
                    char._id = key;
                    char.name = movementPowers[key];
                    movementItems.push(char);
                }
            }
            const activeMovement =
                movementItems.length === 0
                    ? "none"
                    : movementItems.find((o) => o._id === actor.flags[game.system.id]?.activeMovement)?._id ||
                      movementItems[0]._id;
            const activeMovementLabel =
                activeMovement === "none" ? "Running" : movementItems.find((e) => e._id === activeMovement)?.name;

            const rangeMod = -calculateRangePenaltyFromDistanceInMetres(this.totalDistance, actor);

            return `${baseLabel}\n${activeMovementLabel}\n${rangeMod} Range Modifier`;
        }
        return baseLabel;
    }

    async moveToken() {
        if (this.token.actor) {
            if (!this.token.actor.canMove(true)) {
                return;
            }
        }
        await super.moveToken();
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
export function calculateVelocityInSystemUnits(actor, token, targetToken) {
    if (foundry.canvas.placeables) {
        console.warn(
            `V13: calculateVelocityInSystemUnits called in heroRuler.mjs.  Plan is to deprecate the heroRuler.mjs file.`,
        );
    }

    let velocity = 0;

    const combatants = game?.combat?.combatants;

    // In combat we can calculate the velocity using the distance moved and acceleration rules (5 units/phase per unit moved).
    // TODO: This does not consider the movement power being purchased with improved acceleration.
    if (combatants && typeof dragRuler != "undefined" && targetToken) {
        const distance = dragRuler.getMovedDistanceFromToken(targetToken);
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

    // Simplistic velocity calc using current movement
    // TODO: This is likely wrong for Teleport and other movements with quirky velocity rules.
    else {
        velocity = parseInt(actor.system.characteristics[actor.activeMovement]?.value || 0);
    }

    // Sanity check
    if (velocity <= 0) {
        console.warn(`Calculated velocity of ${velocity} is invalid, using simplistic calculation`);
        velocity = Math.max(0, parseInt(actor.system.characteristics[actor.activeMovement]?.value || 0));
    }

    return velocity;
}
