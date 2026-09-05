import { HeroSystem6eActor } from "../actor/actor.mjs";
import { performAdjustment } from "../actor/actor-adjustment.mjs";
import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
//import { HeroSystem6eActor } from "../actor/actor.mjs";
import { renderAdjustmentChatCards } from "./adjustment.mjs";

const { Item } = foundry.documents;

export function getPowerInfo(options) {
    const xmlid =
        options.xmlid ||
        options.XMLID ||
        options.item?.XMLID ||
        options.item?.system?.XMLID ||
        options.item?.system?.xmlid ||
        options.item?.system?.id ||
        options.xmlTag;

    const actor = options?.actor || options?.item?.actor;

    // Excellent we have a positive source for xmlTag!
    if (!options.xmlTag && options?.item?.system?.xmlTag) {
        options.xmlTag = options.item.system.xmlTag;
    }

    // "non-hd" items don't have xmlTag (which is the XmlTag used in the HDC file)
    // Decided not to create xmlTags for these as we aren't going to write them to an HDC file (when we get that working)
    if (!options.xmlTag && !options.item?.type === "maneuver") {
        if (!squelch(options.item || xmlid)) {
            console.warn(`${options.item?.actor?.name}/${options.item?.name}/${xmlid} is missing xmlTag`, options.item);
        }
    }

    // Legacy init of an item (we now include xmlTag during upload process)
    try {
        if (!options?.xmlTag && !options?.xmlid) {
            if (options?.item?.xmlTag) {
                // Excellent we have a positive source for xmlTag!
                options.xmlTag = options.item.xmlTag;
            } else if (options?.item?.system?.XMLID === "FOCUS") {
                options.xmlTag = "MODIFIER";
            } else if (["power", "equipment"].includes(options?.item?.type)) {
                options.xmlTag = "POWER";
            } else if (options?.item?.type === "skill") {
                options.xmlTag = "SKILL";
            } else if (options?.item?.type === "talent") {
                options.xmlTag = "TALENT";
            } else if (options?.item?.type === "complication" || options?.item?.type === "disadvantage") {
                options.xmlTag = "DISAD";
            } else if (options?.item?.type === "perk") {
                if (options.item.system.XMLID === "WELL_CONNECTED") {
                    options.xmlTag = "WELL_CONNECTED"; // PERK ENHANCER
                } else {
                    options.xmlTag = "PERK";
                }
            } else if (options?.item?.system?.XMLID === "HANDTOHANDATTACK" && options.item.type === "attack") {
                options.xmlTag = "POWER";
            }
        }
    } catch (e) {
        console.error(e);
    }

    // Determine is5e
    let is5e = actor?.is5e;
    if (is5e === undefined) {
        is5e = options.item?.system?.is5e;
    }
    if (is5e === undefined) {
        is5e = options.is5e;
    }
    if (is5e == undefined) {
        console.warn(
            `DefaultEdition was used to determine is5e for ${actor?.name || options.item?.pack || (Item.get(options.item?.id) ? "Item" : undefined)}:${options.item?.name || xmlid}`,
        );
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        const DefaultEdition = game.settings.get(HEROSYS.module, "DefaultEdition");
        if (DefaultEdition === "five") {
            is5e = true;
        } else {
            is5e = false;
        }
    }

    const powerDict = is5e ? CONFIG.HERO.powers5eDict : CONFIG.HERO.powers6eDict;

    // ENHANCEDPERCEPTION is a POWER and an ADDER, we can pass in xmlTag to get the right one.
    // If looking for a POWER, a characteristic, perk, talent, or skill is the preferred result.
    const fullPowerInfoList = powerDict.get(xmlid) || [];
    const powerInfoList = fullPowerInfoList.filter(
        (power) =>
            !options?.xmlTag ||
            !power.xmlTag ||
            power.xmlTag === options?.xmlTag ||
            (options.xmlTag === "POWER" &&
                (power.type.includes("characteristic") ||
                    power.type.includes("perk") ||
                    power.type.includes("talent") ||
                    power.type.includes("skill"))),
    );

    if (powerInfoList.length > 1) {
        if (!squelch(xmlid)) {
            console.warn(
                `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Multiple powerInfo results. Costs may be incorrect, but shouldn't break core functionality. Uploading the HDC file again may resolve this issue.`,
                powerInfoList,
                options,
            );
        }
    }

    let powerInfo = powerInfoList[0];
    if (!powerInfo) {
        powerInfo = fullPowerInfoList[0];
        if (powerInfo) {
            if (fullPowerInfoList.length > 1) {
                console.warn(
                    `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Was looking for xmlTag=${options.xmlTag} but got multiple results. Costs and some functionality may be incorrect.`,
                    powerInfo,
                    options,
                );
            } else {
                if (
                    ["ADDER", "MODIFIER"].includes(powerInfo.xmlTag) ||
                    ["ADDER", "MODIFIER"].includes(options?.xmlTag)
                ) {
                    if (powerInfo.xmlTag !== options?.xmlTag) {
                        console.error(
                            `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Was looking for xmlTag=${options.xmlTag} but got ${powerInfo.xmlTag}. Costs may be incorrect, but shouldn't break core functionality. Uploading the HDC file again may resolve this issue.`,
                            powerInfo,
                            options,
                        );
                    }
                }
            }
        } else {
            // This XMLIDs not yet in config.mjs. We should have most of them so this is significant enough to fix.
            if (!squelch(xmlid)) {
                const msg = `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Unable to find ${is5e ? "5e" : "6e"} power entry.`;
                if (xmlid === "DEF") {
                    // Quench test "Test 6e Base" specifically looks for a missing DEF characteristic
                    console.warn(msg);
                } else {
                    console.error(msg);
                }
            }
        }
    }

    return powerInfo;
}

function isNonIgnoredCharacteristicsAndMovementBaseInfoForActor(actor) {
    // NOTE: CUSTOM characteristics are ignored in config.mjs until supported.
    return (baseInfo) =>
        (baseInfo.type.includes("characteristic") || baseInfo.type.includes("movement")) &&
        !baseInfo.ignoreForActor(actor);
}

export function getCharacteristicInfoArrayForActor(actor) {
    if (!actor) {
        console.error("getCharacteristicInfoArrayForActor missing actor", this);
    }
    if (!actor._lazy) {
        console.warn("missing actor._lazy");
    }

    if (actor._lazy._isNonIgnoredCharacteristicsAndMovementPowerForActor) {
        return actor._lazy._isNonIgnoredCharacteristicsAndMovementPowerForActor;
    }

    const isCharOrMovePowerForActor = isNonIgnoredCharacteristicsAndMovementBaseInfoForActor(actor);
    const powerList = actor?.system?.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const powers = powerList.filter(isCharOrMovePowerForActor);
    actor._lazy._isNonIgnoredCharacteristicsAndMovementPowerForActor = powers;
    return powers;
}

/**
 * Returns a list of user ids associated with ownership of actor.
 *
 * @param {HeroSystem6eActor} actor
 *
 * @returns User[]
 */
export function whisperUserTargetsForActor(actor) {
    if (!actor) {
        return [];
    }

    const ownerIds = [];
    for (const [key, value] of Object.entries(actor?.ownership)) {
        if (value === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            ownerIds.push(key);
        }
    }

    const whisperUserTargets = [];
    for (const user of game.users) {
        if (ownerIds.includes(user.id)) {
            whisperUserTargets.push(user);
        }
    }

    return whisperUserTargets;
}

export async function getTemporaryEffectsOwnedByActorInCombat(actor) {
    let effects = [];
    for (const c of game.combat.combatants) {
        for (const ae of c.actor.temporaryEffects) {
            const origin = await fromUuid(ae.origin);
            const item = origin instanceof HeroSystem6eItem ? origin : null;
            if (item) {
                const aeActor = item?.actor?.id === actor?.id;
                // There are likely multiple combatants with the same actor based on SPD, only add once
                if (aeActor && !effects.find((o) => o.id === ae.id && o.target === ae.target)) {
                    effects.push(ae);
                }
            } else {
                // This is likely a core effect, CSL, stunned, etc
                if (ae.target.id === actor.id) {
                    effects.push(ae);
                }
            }
        }
    }
    return effects;
}

/// Check the actor for any effects that should expire, and expire them.
export async function expireEffects(actor, expiresOn) {
    // V14: temporaryEffects does not include suppressed AEs, which we want so we can delete them.
    const temporaryEffects = actor.getTemporaryEffects(); //temporaryEffects;

    if (!expiresOn) {
        console.error(`missing expiresOn, v14 goal to use duration.expiry`);
    }

    const adjustmentChatMessages = [];

    // Deletes are batched (one deleteEmbeddedDocuments per parent) and expiry messages
    // combined into one ChatMessage per actor, to keep time ticks quick.
    const pendingDeletes = new Map();
    const markForDeletion = (ae) => {
        if (!pendingDeletes.has(ae.parent)) pendingDeletes.set(ae.parent, new Set());
        pendingDeletes.get(ae.parent).add(ae.id);
    };
    const isMarkedForDeletion = (ae) => pendingDeletes.get(ae.parent)?.has(ae.id) ?? false;
    const expiredCardHtmls = [];
    const flushPendingWork = async () => {
        for (const [parent, aeIds] of pendingDeletes) {
            // A concurrent pass (rapid time advances) or performAdjustment may have already
            // deleted some of these; deleting a missing id throws and would abort the batch.
            const ids = Array.from(aeIds).filter((id) => parent.effects.has(id));
            try {
                if (ids.length > 0) await parent.deleteEmbeddedDocuments("ActiveEffect", ids);
            } catch (e) {
                console.error(`Failed to bulk delete expired effects on ${parent.uuid}: ${e.message}`);
            }
        }
        if (expiredCardHtmls.length > 0) {
            await ChatMessage.create({
                content: expiredCardHtmls.join("<br>"),
                speaker: ChatMessage.getSpeaker({
                    actor,
                    token: tokenEducatedGuess({ actor }),
                }),
                whisper: whisperUserTargetsForActor(actor),
            });
        }
    };

    // TODO: Move remaining sanity checks to HeroValidation
    for (const ae of temporaryEffects) {
        // We are expecting expiresOn flag
        const aeExpiresOn =
            ae.flags[game.system.id]?.expiresOn ||
            (!ae.duration?.seconds ? "turnStart" : undefined) ||
            (ae.flags[game.system.id]?.XMLID && ae.flags[game.system.id]?.type === "adjustment"
                ? "turnStart"
                : undefined);
        const validExpiresOnValues = ["turnStart", "turnEnd", "segmentStart", "segmentEnd"];
        if (!aeExpiresOn || !validExpiresOnValues.includes(aeExpiresOn)) {
            console.warn(`ActiveEffect ${ae.name} has invalid expiresOn flag ${aeExpiresOn}`, ae);
        }

        if (!expiresOn) {
            console.error(`${actor?.name}/${ae?.name} is missing expiresOn`, ae);
            await flushPendingWork();
            return;
        }

        if (!aeExpiresOn) {
            console.error(`${actor?.name}/${ae?.name} is missing aeExpiresOn`, ae);
        }

        if (expiresOn.includes("segment") && aeExpiresOn?.includes("turn") && actor.inCombat) {
            continue;
        }

        const zero = aeExpiresOn === "segmentEnd" ? -1 : 0;

        // With Simple Calendar you can move time ahead in large steps.
        // Need to loop as multiple fades may be required.
        // The null check is for AE that have no duration.
        // TODO: Aaron dislikes WHILE loops, can this be reworked such that it there is not a possibility of infinite loop?
        while (ae._prepareDuration().remaining <= zero && ae._prepareDuration().remaining !== null) {
            const origin = fromUuidSync(ae.origin);
            const item =
                origin instanceof HeroSystem6eItem ? origin : ae.parent instanceof HeroSystem6eItem ? ae.parent : null;
            const source = ae.flags[game.system.id]?.source ?? "an unknown source";
            // Flag changes to persist together with the start.time re-arm below (one update per interval)
            let pendingFadeFlags;

            // What is this effect related to?
            if (ae.flags[game.system.id]?.type === "adjustment") {
                // Fade by up to 5 Active Points
                let _fade;
                if (ae.flags[game.system.id]?.adjustmentActivePoints >= 0) {
                    _fade = 5;
                } else {
                    _fade = -5;
                }

                if (item) {
                    adjustmentChatMessages.push(
                        await performAdjustment(
                            item,
                            ae.flags[game.system.id]?.target, // nameOfCharOrPower
                            -_fade, // thisAttackRawActivePointsDamage
                            "None - Effect Fade", // defenseDescription
                            "", // effectsDescription
                            true, // isFade
                            ae.target || actor, // token
                            null, // action
                            ae,
                        ),
                    );
                } else {
                    // The item must have been deleted which makes it impossible to properly adjust the
                    // adjustment power. Just delete it and soldier on.
                    ui.notifications.warn(
                        `The originating item ${ae.origin} of adjustment ${ae.name} appears to have been deleted. Deleting adjustment's active effect.`,
                    );
                    markForDeletion(ae);
                    break;
                }

                // TODO: FIXME: Dirty hack. If the amount remaining in the active effect is 0 we know that
                // performAdjustment has deleted the active effect. In this case exit the loop so that
                // we don't keep operating on an old view of a deleted active effect.
                // Healing doesn't fade. The lockout just ends which guarantees a deleted effect.
                if (
                    ae.flags[game.system.id]?.adjustmentActivePoints === 0 ||
                    ae.flags[game.system.id]?.XMLID === "HEALING"
                ) {
                    break;
                }
            } else if (
                ae.flags[game.system.id]?.type === "senseAffectingFade" &&
                ae.flags[game.system.id]?.bodyDamage > 0
            ) {
                // Sense-affecting effect with Delayed Return Rate: one segment returns per interval
                const remainingSegments = parseInt(ae.flags[game.system.id].bodyDamage) - 1;
                if (remainingSegments <= 0) {
                    expiredCardHtmls.push(`${ae.name} from ${source} has expired.`);
                    markForDeletion(ae);
                    break;
                }
                expiredCardHtmls.push(
                    `${ae.name} from ${source} fades: ${remainingSegments} segment${remainingSegments > 1 ? "s" : ""} remaining.`,
                );
                pendingFadeFlags = { [`flags.${game.system.id}.bodyDamage`]: remainingSegments };
            } else if (ae.flags[game.system.id]?.XMLID === "naturalBodyHealing") {
                let bodyValue = parseInt((ae.target || actor).system.characteristics.body.value);
                let bodyMax = parseInt((ae.target || actor).system.characteristics.body.max);
                bodyValue = Math.min(bodyValue + 1, bodyMax);

                await (ae.target || actor).update({
                    "system.characteristics.body.value": bodyValue,
                });

                if (bodyValue === bodyMax) {
                    markForDeletion(ae);
                    break;
                }
            } else {
                // FLASHes expire on segmentEnd.
                // ExpireEffects is called twice, one from worldTimeUpdate and
                // one from turnStart.  Only do the worldTimeUpdate one.
                // This avoids the double chat message & AE errors for deleting already
                // deleted AE.
                if (expiresOn === "turnStart" && aeExpiresOn === "segmentEnd") {
                    break;
                }
                // Catch all to delete the expired AE.
                // May need to revisit and make exception for statuses (like prone/recovery)

                if (ae.parent instanceof HeroSystem6eActor) {
                    // Effects created outside this system may lack our flags; a throw here would
                    // abort combat turn events (skipping PostSegment12) and leave the AE undeletable.
                    expiredCardHtmls.push(
                        `${ae.name.replace(/\d+ segments remaining/, "")} from ${source} has expired.`,
                    );
                    markForDeletion(ae);
                }
                break;
            }

            // Add duration to startTime (if ae wasn't deleted)
            if (ae.parent?.temporaryEffects.find((o) => o.id === ae.id)) {
                // Sanity delete
                if (ae.flags[game.system.id]?.adjustmentActivePoints === 0) {
                    console.error(`Sanity deleting ${ae.name}. Shouldn't need to do this.`);
                    markForDeletion(ae);
                    break;
                }

                // Make sure we don't add duration twice
                if (ae.updateDuration().remaining <= 0) {
                    await ae.update({
                        "start.time": (ae.start?.time ?? game.time.worldTime) + (ae.duration.seconds ?? 0),
                        ...pendingFadeFlags,
                    });
                }
            } else {
                console.log(`${ae.name} expired`);
                break;
            }
        }

        // Effects awaiting bulk deletion still report persisted=true; skip cleanup & validation.
        if (isMarkedForDeletion(ae)) continue;

        // Sanity (or cleanup) delete
        if (ae.persisted && !ae.XMLID && ae.statuses.size === 0 && ae.changes.length === 0) {
            // What can this AE possibly be good for, likely a leftover from an old system rev.
            console.error(
                `Deleted ${ae.parent?.parent?.name}/${ae.parent?.name}/${ae.name} as it has no XMLID, statuses, or changes.`,
            );
            markForDeletion(ae);
            continue;
        }

        // If temporary effect is still active, check heroValidation
        if (ae.persisted) {
            try {
                const heroValidation = ae.heroValidation;
                for (const validationEntry of heroValidation) {
                    const message = `${actor.name}/${ae.flags[game.system.id]?.XMLID}/${ae.nameExtended}: ${validationEntry.message}`;
                    // If current combatant, show in the UI otherwise to log
                    if (!squelch(`expireEffects-herovalidation-${actor.id}`)) {
                        if (actor.inCombat && game.combat?.combatant?.actorId === actor.id) {
                            switch (validationEntry.severity) {
                                case CONFIG.HERO.VALIDATION_SEVERITY.INFO:
                                    ui.notifications.info(message);
                                    break;

                                case CONFIG.HERO.VALIDATION_SEVERITY.WARNING:
                                    ui.notifications.warn(message);
                                    break;

                                case CONFIG.HERO.VALIDATION_SEVERITY.ERROR:
                                    ui.notifications.error(message);
                                    break;

                                default:
                                    console.error("Invalid validation severity", validationEntry.severity);
                                    break;
                            }
                        } else {
                            switch (validationEntry.severity) {
                                case CONFIG.HERO.VALIDATION_SEVERITY.INFO:
                                    console.log(message);
                                    break;

                                case CONFIG.HERO.VALIDATION_SEVERITY.WARNING:
                                    console.warn(message);
                                    break;

                                case CONFIG.HERO.VALIDATION_SEVERITY.ERROR:
                                    console.error(message);
                                    break;

                                default:
                                    console.error("Invalid validation severity", validationEntry.severity);
                                    break;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Error processing hero validation for ${actor.name}/${ae.nameExtended}`, e);
            }
        }
    }

    //delete window.expireEffects[actor.id];

    await flushPendingWork();

    await renderAdjustmentChatCards(adjustmentChatMessages);
}

/**
 * A number of HDC advantages and powers have very similar OPTIONID values.
 *
 * @param {string} optionId
 * @returns {number} Should be >= 0 unless there is an error.
 */
export function hdcTimeOptionIdToSeconds(durationOptionId) {
    let seconds;

    switch (durationOptionId) {
        case "EXTRAPHASE":
            // TODO: This is not correct as it depends on speed and what segment we're on.
            seconds = 2;
            break;

        case "1TURN":
        case "TURN":
            seconds = 12;
            break;

        case "MINUTE":
            seconds = 60;
            break;

        case "FIVEMINUTES":
            seconds = 60 * 5;
            break;

        case "20MINUTES":
        case "TWENTYMINUTES":
            seconds = 60 * 20;
            break;

        case "HOUR":
            seconds = 60 * 60;
            break;

        case "6HOURS":
        case "SIXHOURS":
            seconds = 60 * 60 * 6;
            break;

        case "DAY":
        case "ONEDAY":
            seconds = 60 * 60 * 24;
            break;

        case "WEEK":
        case "ONEWEEK":
            seconds = 60 * 60 * 24 * 7;
            break;

        case "MONTH":
        case "ONEMONTH":
            seconds = 60 * 60 * 24 * 30;
            break;

        case "SEASON":
        case "ONESEASON":
            seconds = 60 * 60 * 24 * 90;
            break;

        case "YEAR":
        case "ONEYEAR":
            seconds = 60 * 60 * 24 * 365;
            break;

        case "FIVEYEARS":
            seconds = 60 * 60 * 24 * 365 * 5;
            break;

        case "TWENTYFIVEYEARS":
            seconds = 60 * 60 * 24 * 365 * 25;
            break;

        case "ONECENTURY":
            seconds = 60 * 60 * 24 * 365 * 100;
            break;

        default:
            console.warn(`Unhandled duration ${durationOptionId}`);
            seconds = -1;
            break;
    }

    return seconds;
}

// Millisecond precision below 5s
export function formatDuration(totalMs) {
    totalMs = Math.round(totalMs);
    if (totalMs < 1000) {
        return `${totalMs}ms`;
    }
    if (totalMs < 5000) {
        return `${Math.floor(totalMs / 1000)}s ${totalMs % 1000}ms`;
    }
    return `${Math.ceil(totalMs / 1000)} seconds`;
}

export function toHHMMSS(secs) {
    var sec_num = parseInt(secs, 10);
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor(sec_num / 60) % 60;
    var seconds = sec_num % 60;

    if (hours === 0 && minutes === 0) {
        return `${seconds}s`;
    }

    return [hours, minutes, seconds]
        .map((v) => (v < 10 ? "0" + v : v))
        .filter((v, i) => v !== "00" || i > 0)
        .join(":");
}

/**
 * TokenDocument uuid for a Token placeable, TokenDocument, or PrototypeToken.
 * Token placeables only expose a uuid via their document; PrototypeTokens have none.
 *
 * @param {HeroSystem6eToken | HeroSystem6eTokenDocument | PrototypeToken | null} token
 * @returns {string | null}
 */
export function getTokenUuid(token) {
    return token?.document?.uuid ?? token?.uuid ?? null;
}

/**
 * Forced-deletion update payload for the given keys: each key maps to a
 * ForcedDeletion operator so a document update removes it outright instead
 * of merging.
 *
 * @param {string[]} keys - Field names (unprefixed) to delete
 * @returns {Record<string, object>}
 */
export function forceDeleteKeys(keys) {
    return Object.fromEntries(keys.map((key) => [key, foundry.data.operators.ForcedDeletion.create()]));
}

/**
 * Update payload that force-replaces each field in forcedFields (skipping the default
 * recursive merge), with otherFields merged normally.
 *
 * @param {object} forcedFields - Map of field name (unprefixed) to replacement value
 * @param {object} [otherFields={}]
 * @returns {object}
 */
export function forceReplaceFields(forcedFields, otherFields = {}) {
    const payload = { ...otherFields };
    for (const [key, value] of Object.entries(forcedFields)) {
        payload[key] = foundry.data.operators.ForcedReplacement.create(value);
    }
    return payload;
}

/**
 * Given information, find the best guess for the token in the scene which we should use.
 *
 * NOTE: Typically we want the token that is making an attack or receiving the attack so that we can
 *       make distance calculations.
 *
 * @param {Object} options
 * @param {action} options.action
 * @param {HeroSystem6eActor | undefined} options.actor
 * @param {Token | TokenDocument | undefined} options.token
 * @param {string | undefined} options.tokenId we should really get rid of this.
 *
 * @returns {Token | TokenDocument}
 */
export function tokenEducatedGuess(options = {}) {
    const isPrototypeToken = options.token instanceof foundry.data.PrototypeToken;
    if (isPrototypeToken) {
        console.error("Ignoring provided PrototypeToken");
        delete options.token;
    }

    // If we passed in a Token or TokenDocument, consider it authoritative
    if (options.token) {
        return options.token;
    }

    // Token id/uuid
    options.tokenId ??= options.action?.current.attackerTokenUuid;
    options.token ??= fromUuidSync(options.tokenId);
    options.token ??= canvas.tokens.get(options.tokenId);
    if (options.token) {
        return options.token;
    }

    if (!squelch(`passActualToken-${options.actor?.id}`)) {
        console.warn("Pass actual token when possible");
    }

    // ActorId
    options.actorId ??= options.item?.actor?.id;

    // Actor in combat should provide a token
    const combatant = game.combat?.combatants?.contents.find((o) => o.actorId === options.actorId);
    if (combatant) {
        return canvas.tokens.get(combatant.tokenId);
    }

    // Actor
    options.actor ??= options.action?.current.actor;
    options.actor ??= fromUuidSync(options.actorId);
    options.actor ??= game.actors.get(options.actorId);

    // Controlled token of provided actor
    options.token ??= options.actor?.getActiveTokens().find((t) => canvas.tokens.controlled.find((c) => c.id === t.id));
    if (options.token) {
        return options.token;
    }

    // Any token on this canvas for Actor
    options.token ??= options.actor?.getActiveTokens()?.[0];
    if (options.token) {
        return options.token;
    }

    if (options.actor?.id) {
        if (!squelch(`unableToFindTokenFor-${options.actor?.id}`)) {
            console.warn(`Unable to find token for ${options.actor?.name}`);
        }
    } else {
        console.log(`${options.actor?.name} has no id, likely a temporary actor. No associated token is expected.`);
    }

    return null;
}

export function gmActive() {
    return !!game.users.filter((u) => u.active && u.isGM).length;
}

/**
 * Whether a Quench test run is in progress. Quench keeps its active mocha
 * runner on the global instance for the duration of a run (cleared when it
 * ends); optional chaining makes this safely false without the module or if a
 * future Quench renames the field. Use it to suppress interactive prompts that
 * would stall unattended test loops.
 * @returns {boolean}
 */
export function isQuenchTestRunning() {
    return !!globalThis.quench?._currentRunner;
}

// btoa only accepts latin1, so route UTF-8 text through its percent-encoded byte string first.
export function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

export function base64ToUtf8(base64) {
    return decodeURIComponent(escape(atob(base64)));
}

export function squelch(id, options = { timeout: 1000 }) {
    const _id = id ? id.toString() : "undefined";
    globalThis[game.system.id] ??= {};
    globalThis[game.system.id].squelch ??= {};
    if (globalThis[game.system.id].squelch[_id]) {
        if (Date.now() - globalThis[game.system.id].squelch[_id] < options.timeout) {
            return true;
        }
    }
    globalThis[game.system.id].squelch[_id] = Date.now();
    return false;
}

export function hdcTextNumberToNumeric(textNumber) {
    switch (textNumber) {
        case "ONE":
            return 1;
        case "TWO":
            return 2;
        case "THREE":
            return 3;
        case "FOUR":
            return 4;
        case "SIX":
            return 6;
        case "EIGHT":
            return 8;
        case "TWELVE":
            return 12;
        case "SIXTEEN":
            return 16;
        case "THIRTYTWO":
            return 32;
        case "SIXTYFOUR":
            return 64;
        case "ONETWENTYFIVE":
            return 125;
        case "TWOFIFTY":
            return 250;
        case "FIVEHUNDRED":
            return 500;
        case "ONETHOUSAND":
            return 1000;
        case "TWOTHOUSAND":
            return 2000;
        case "FOURTHOUSAND":
            return 4000;
        case "EIGHTTHOUSAND":
            return 8000;
        case "SIXTEENTHOUSAND":
            return 16000;
        default:
            console.error(`hdcTextNumberToNumeric: ${textNumber} is unhandled`);
            return 0;
    }
}

/**
 * The started single-tracker combat this actor fights in, with its combatant.
 * Capability-probed on one sentinel method to avoid importing combat-single
 * (util is loaded before the combat classes register).
 * @param {Actor} actor
 * @returns {{combat: Combat, combatant: Combatant}|null}
 */
export function activeSingleTrackerCombatFor(actor) {
    if (!actor) return null;
    for (const combat of game.combats ?? []) {
        if (!combat.started || typeof combat.scheduleDelayedAction !== "function") continue;
        const combatant = combat.combatantForActor?.(actor);
        if (combatant) return { combat, combatant };
    }
    return null;
}
