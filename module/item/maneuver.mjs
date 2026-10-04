import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { HeroDialogV2 } from "../applications/api/hero-app-mixin.mjs";
import { activeEffectChanges } from "../utility/active-effects.mjs";
import { roundFavorPlayerTowardsZero } from "../utility/round.mjs";
import { calculateVelocityInSystemUnits } from "../utility/units.mjs";
import { activeSingleTrackerCombatFor, isQuenchTestRunning } from "../utility/util.mjs";
import { dehydrateAttackItem, rehydrateAttackItem } from "./item-attack.mjs";
import { getManeuverEffectCapitalized, maneuverBasisOrElement } from "./maneuver-bases-and-elements.mjs";

// FIXME: DCV should only be effective against HTH attacks unless it's a Dodge
function addDcvChange(maneuverDcvChange) {
    if (maneuverDcvChange !== 0) {
        return {
            key: "system.characteristics.dcv.max",
            value: maneuverDcvChange,
            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
        };
    }
}

function addOcvChange(maneuverOcvChange) {
    if (maneuverOcvChange !== 0) {
        return {
            key: "system.characteristics.ocv.max",
            value: maneuverOcvChange,
            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
        };
    }
}

/**
 * Create flags that will allow us to expire effects on the next phase. If the item is an
 * original item then the item uuid will suffice otherwise the dehydrated item and actor uuid needs to be used
 *
 * @param {*} item
 * @returns
 */
function buildManeuverNextPhaseFlags(item) {
    return buildManeuverFlags(item, "maneuverNextPhaseEffect");
}

/**
 * Create flags that will allow us to expire effects on the next phase. If the item is an
 * original item then the item uuid will suffice otherwise the dehydrated item and actor uuid needs to be used
 *
 * @param {*} item
 * @returns
 */
// function buildManeuverNextSegmentFlags(item) {
//     return buildManeuverFlags(item, "maneuverNextSegementEffect");
// }

/**
 * Create flags that will allow us to expire effects on the next phase. If the item is an
 * original item then the item uuid will suffice otherwise the dehydrated item and actor uuid needs to be used
 *
 * @param {*} item
 * @param {string} type
 * @returns
 */
function buildManeuverFlags(item, type) {
    return {
        [game.system.id]: {
            type: type,
            expiresOn: "turnStart",
            itemUuid: item.uuid,
            toggle: item.isActivatable(),
            dehydratedManeuverItem: dehydrateAttackItem(item),
            dehydratedManeuverActorUuid: item.actor.uuid,
        },
    };
}

/**
 * Expires maneuver effects that last "until the character's next Phase" (Dodge, Block,
 * Brace, …) at the start of that Phase. Toggleable maneuvers are switched off through
 * their item so activation state stays in sync; loose effects are deleted. Effects
 * created at the current world time are kept — they were declared this instant.
 * Mirrors the legacy stack's _onStartTurn cleanup (combat.mjs) for the single stack.
 * @param {Actor} actor
 */
export async function expireManeuverNextPhaseEffects(actor) {
    const maneuverAes = (actor?.temporaryEffects ?? []).filter(
        (ae) =>
            ae.flags?.[game.system.id]?.type === "maneuverNextPhaseEffect" && ae.start?.time !== game.time.worldTime,
    );

    const expiryPromises = maneuverAes.map((ae) => {
        const flags = ae.flags[game.system.id];
        if (flags?.toggle) {
            let maneuver = null;
            try {
                maneuver =
                    fromUuidSync(flags.itemUuid) ||
                    rehydrateAttackItem(flags.dehydratedManeuverItem, fromUuidSync(flags.dehydratedManeuverActorUuid))
                        .item;
            } catch (e) {
                console.warn(`Unable to resolve maneuver item for expiring effect ${ae.name}`, e);
            }
            if (maneuver?.isActive) return maneuver.toggle({ token: actor?.getActiveTokens()[0]?.document });
        }
        return ae.delete();
    });
    await Promise.all(expiryPromises);
}

/**
 * Ends an active Haymaker wind-up wherever its state lives: the status effect
 * may sit on the actor directly (token HUD toggles and some attack paths) or
 * ride on the HAYMAKER maneuver item's phase effect — cover both stores so no
 * -5 DCV lingers and the item's activation state stays in sync.
 * @param {Actor} actor
 * @param {object} [options]
 * @param {TokenDocument} [options.token] - Token for the item toggle; defaults to the actor's first active token
 */
export async function endHaymakerManeuver(actor, { token } = {}) {
    if (!actor) return;
    const haymakerEffect = actor.effects.find((e) => e.statuses.has("haymaker"));
    if (haymakerEffect) await haymakerEffect.delete();
    const haymakerItem = actor.items.find((i) => i.system?.XMLID === "HAYMAKER" && i.isActive);
    if (haymakerItem) await haymakerItem.toggle({ token: token ?? actor.getActiveTokens()[0]?.document });
}

/**
 * Toggling an abortable maneuver (Dodge, Martial Dodge, …) outside the actor's
 * own Phase in a live combat IS Aborting — offer to declare it through the
 * combat engine so the Phase cost and lockout are recorded. Confirm
 * first: an out-of-turn toggle may just be pre-staging, and Cancel keeps the
 * maneuver active without an Abort.
 * @param {HeroSystem6eItem} item - The maneuver that was just activated
 */
export async function promptOutOfTurnAbortForManeuver(item) {
    try {
        const actor = item.actor;
        if (!actor || !maneuverAbortElement(item)) return;
        if (isQuenchTestRunning()) return;

        // Live single-tracker combats only, and outside this actor's own turn
        const active = activeSingleTrackerCombatFor(actor);
        if (!active) return;
        const { combat, combatant } = active;
        // The abort flow toggles the defense maneuver as part of declaring —
        // that toggle must not re-prompt. Read the latch off the combat's
        // constructor: importing combat-single here would create a cycle.
        if (combat.constructor?._abortFlowActive) return;
        if (combat.combatant?.actor === actor) return;
        if (!combatant?.isOwner || combatant.abortEffect) return;

        const proceed = await HeroDialogV2.confirm({
            window: { title: `Abort — ${actor.name}` },
            content: `<p>${actor.name} is activating <b>${item.name}</b> outside their Phase. Abort to it?</p>
                <p class="hint">Aborting consumes their next Phase — or their Held Action, if holding. Cancel keeps ${item.name} active without declaring an Abort (e.g. pre-staging).</p>`,
            rejectClose: false,
        });
        if (!proceed) return;

        // The maneuver is already active, so no statusId — the item carries its
        // own CV effects; declareAbort records the cost, card, and ledger entry
        await combat.declareAbort(combatant, { toAction: item.name, statusId: null });
    } catch (e) {
        console.error(`Out-of-turn abort prompt failed`, e);
    }
}

/**
 * Maneuvers whose effect includes the "Abort" element can be aborted to.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverAbortElement(item) {
    return maneuverBasisOrElement(item, "abort");
}

/**
 * Maneuver includes the "You Fall" element. This called "Fall" in the Ultimate Martial Artist
 * should be written as "You Fall" but that's a less descriptive name than it's the attacker falls.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverAttackerFallsElement(item) {
    return maneuverBasisOrElement(item, "attackerFalls");
}

/**
 * Maneuver includes the "Bind" exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverBindBasis(item) {
    return maneuverBasisOrElement(item, "bind");
}

/**
 * Maneuver includes the "Block" exclusive basis. The "Must Follow Block" basis is a
 * prerequisite on a different maneuver, not a Block in its own right, so it is
 * excluded.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverBlockBasis(item) {
    return maneuverBasisOrElement(item, "block");
}

/**
 * Maneuver includes the "Crush" element. It appears to just be a flavour of strike so
 * I'm not sure why they decided to create a new element for it.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverCrushElement(item) {
    return maneuverBasisOrElement(item, "crush");
}

/**
 * Maneuver includes the "Disable" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverDisableElement(item) {
    return maneuverBasisOrElement(item, "disable");
}

/**
 * Maneuver includes the "Disarm" exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverDisarmBasis(item) {
    return maneuverBasisOrElement(item, "disarm");
}

/**
 * Maneuver includes the "Dodge" exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverDodgeBasis(item) {
    return maneuverBasisOrElement(item, "dodge");
}

/**
 * Maneuver includes the "[STRDC]", which is not a strength damage, non-exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverExertBasis(item) {
    return maneuverBasisOrElement(item, "exert");
}

/**
 * Maneuver includes the "[FLASHDC]" exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverFlashBasis(item) {
    return maneuverBasisOrElement(item, "flashDc");
}

/**
 * Maneuver includes the "FMove" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverFMoveElement(item) {
    return maneuverBasisOrElement(item, "fmove");
}

/**
 * Maneuver includes the "Grab" non-exclusive basis — it grabs the OPPONENT. "Grab Weapon"
 * and "Must Follow Grab" are separate elements and do not count.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverGrabBasis(item) {
    return maneuverBasisOrElement(item, "grab");
}

/**
 * Maneuver includes the "Grab Weapon" exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverGrabWeaponBasis(item) {
    return maneuverBasisOrElement(item, "grabWeapon");
}

/**
 * Maneuver includes the "Half Move Required" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverHalfMoveRequiredElement(item) {
    return maneuverBasisOrElement(item, "halfMoveRequired");
}

/**
 * Maneuver includes the "[KILLINGDC]" or "[WEAPONKILLINGDC]" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverKillingDamageElement(item) {
    return maneuverBasisOrElement(item, "killingDc");
}

/**
 * Maneuver includes the "Lasting Restriction" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverLastingRestrictionElement(item) {
    return maneuverBasisOrElement(item, "lastingRestriction");
}

/**
 * Maneuver includes the "Must Follow" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverMustFollowElement(item) {
    return maneuverBasisOrElement(item, "mustFollow");
}

/*
 * Maneuver has no elements. Likely not an active maneuver (e.g. weapon element).
 *
 * @param {HeroSystem6eItem} item
 * @returns {boolean}
 */
export function maneuverHasNoElements(item) {
    return !getManeuverEffectCapitalized(item);
}

/**
 * Maneuver includes the "[NORMALDC]" or "[WEAPONDC]" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverNormalDamageElement(item) {
    return maneuverBasisOrElement(item, "normalDc");
}

/**
 * Maneuver includes the "[NNDDC]" (No Normal Defense) element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverNoNormalDefenseDamageElement(item) {
    return maneuverBasisOrElement(item, "nndDc");
}

/**
 * Maneuver includes the "Requires Both Hands" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverRequiresBothHandsElement(item) {
    return maneuverBasisOrElement(item, "requiresBothHands");
}

/**
 * Maneuver includes the "Prone" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverRequiresProneTargetElement(item) {
    return maneuverBasisOrElement(item, "prone");
}

/**
 * Maneuver includes the "Can Only Be Used After X" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverResponseElement(item) {
    return maneuverBasisOrElement(item, "response");
}

/**
 * Maneuver includes the "To Resist Shove" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverRootElement(item) {
    return maneuverBasisOrElement(item, "root");
}

/**
 * Maneuver includes the "Shove" element. "To Resist Shove" is the Root element,
 * not a Shove of its own, so the registry excludes it here.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverShoveElement(item) {
    return maneuverBasisOrElement(item, "shove");
}

/**
 * Maneuver includes the "Strike" basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverStrikeBasis(item) {
    return maneuverBasisOrElement(item, "strike");
}

/**
 * Maneuver includes the "Take Full DMG" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverTakeFullDmgElement(item) {
    return maneuverBasisOrElement(item, "takeFullDmg");
}

/**
 * Maneuver includes the "Take Half DMG" element.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverTakeHalfDmgElement(item) {
    return maneuverBasisOrElement(item, "takeHalfDmg");
}

/**
 * Maneuver includes the "throw" (e.g. "Target Falls", "He Falls", "Opponent Falls") non-exclusive basis.
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverThrowBasis(item) {
    return maneuverBasisOrElement(item, "throw");
}

/**
 * Maneuver includes a velocity-scaled effect ("+v/5" and friends).
 *
 * @param {HeroSystem6eItem} item
 * @returns {string|undefined}
 */
export function maneuverVelocityElement(item) {
    return maneuverBasisOrElement(item, "velocity");
}

// Maneuvers we recognize but have not implemented status effects for yet
const UNSUPPORTED_MANEUVER_EFFECT_XMLIDS = ["COVER", "HIPSHOT", "HURRY", "SET", "SETANDBRACE", "PULLINGAPUNCH"];

// Shared field recipes for MANEUVER_EFFECT_SPECS
const nameWithXmlid = (item) => (item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`);
const statusName = (_item, status) => status.name;
const cvChanges = (_item, _status, { dcvChange, ocvChange }) =>
    [addDcvChange(dcvChange), addOcvChange(ocvChange)].filter(Boolean);
const statusChanges = (_item, status) => foundry.utils.deepClone(activeEffectChanges(status));

/**
 * Declarative specs for the status effect each maneuver activation turns on.
 * Evaluated top to bottom — order reproduces the precedence of the old
 * if/else-if chain (element matches before XMLID matches). An entry without a
 * `changes` recipe leaves the effect's changes untouched; an `unsupported`
 * entry warns instead of building an effect.
 */
const MANEUVER_EFFECT_SPECS = [
    {
        // Element match rather than XMLID so custom/martial dodges qualify too
        match: (item) => !!maneuverDodgeBasis(item),
        statusKey: "dodgeEffect",
        name: (item, _status, { dcvChange }) =>
            item.name ? `${item.name} (${item.system.XMLID} +${dcvChange})` : `${item.system.XMLID} +${dcvChange}`,
        changes: cvChanges,
    },
    {
        // Element match rather than XMLID so custom/martial blocks qualify too
        match: (item) => !!maneuverBlockBasis(item),
        statusKey: "blockEffect",
        name: nameWithXmlid,
        changes: cvChanges,
    },
    {
        // NOTE: This effect is special and doesn't come off as the start of the next phase
        match: (item) => item.system.XMLID === "BRACE",
        statusKey: "braceEffect",
        name: nameWithXmlid,
        changes: statusChanges,
    },
    {
        match: (item) => item.system.XMLID === "HAYMAKER",
        statusKey: "haymakerEffect",
        name: statusName,
        changes: statusChanges,
    },
    {
        match: (item) => item.system.XMLID === "CLUBWEAPON",
        statusKey: "clubWeaponEffect",
        name: statusName,
    },
    {
        match: (item) => UNSUPPORTED_MANEUVER_EFFECT_XMLIDS.includes(item.system.XMLID),
        unsupported: true,
    },
    {
        // PH: FIXME: Assume this is a martial maneuver and give it a default effect
        match: () => true,
        statusKey: "strikeEffect",
        name: nameWithXmlid,
        changes: cvChanges,
    },
];

/**
 * Apply a spec's fields, plus the fields every maneuver effect shares, onto
 * the (possibly reused) active effect.
 */
function buildManeuverActiveEffect(activeEffect, item, spec, cvValues) {
    const status = HeroSystem6eActorActiveEffects.statusEffectsObj[spec.statusKey];
    activeEffect.name = spec.name(item, status, cvValues);
    activeEffect.img = status.img;
    activeEffect.flags = buildManeuverNextPhaseFlags(item);
    if (spec.changes) {
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            "system.changes": spec.changes(item, status, cvValues),
        });
    }
    activeEffect.duration ??= {};
    activeEffect.start = ActiveEffect.getEffectStart();
    // The status ID, not the localized name — the condition system only recognizes registered ids
    activeEffect.statuses = [status.id];
    activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    return activeEffect;
}

/**
 * Activate a combat or martial maneuver
 */
export async function activateManeuver(item) {
    const effect = item.system.EFFECT?.toLowerCase();
    if (!effect) {
        return;
    }

    // Every activation path funnels through here (toggle, sheet roll, attack
    // flow), so this is the one reliable spot to offer the out-of-turn Abort.
    // Deliberately not awaited: cards and effect creation must not block on
    // the confirmation dialog.
    promptOutOfTurnAbortForManeuver(item);

    // FIXME: These are supposed to be for HTH or ranged combat only except for dodge.
    const dcvChange = parseInt(item.system.DCV === "--" ? 0 : item.system.DCV || 0);
    let ocvChange = parseInt(item.system.OCV === "--" ? 0 : item.system.OCV || 0);

    // Velocity calc?
    if (isNaN(ocvChange) && item.system.OCV.includes("v/")) {
        const match = item.system.OCV.match(/([-+]*)v\/(\d+)/);
        const v = calculateVelocityInSystemUnits(item.actor);
        const sign = match[1];
        const divisor = parseInt(match[2]);
        ocvChange = roundFavorPlayerTowardsZero(v / divisor) * (sign === "-" ? -1 : 1);
    }

    // Catch All
    if (isNaN(ocvChange)) {
        console.error(`unhandled item.system.OCV`, item.system.OCV);
        ocvChange = 0;
    }

    // Make sure we have original Item
    const originalItem = item.id ? item : fromUuidSync(item.system._active.__originalUuid);

    // Build on a plain copy and write back only through update(): fields set
    // straight onto the live document stay there (array statuses, changes
    // without a phase) through every early return below and any no-op update
    const existingEffect = originalItem.effects.contents[0];
    let activeEffect = existingEffect?.toObject() ?? { flags: [] };

    // Turn on any status effects that we have implemented
    const spec = MANEUVER_EFFECT_SPECS.find((s) => s.match(item));
    if (spec.unsupported) {
        console.error(`Unsupported maneuver ${item.detailedName()}`);
    } else {
        activeEffect = buildManeuverActiveEffect(activeEffect, item, spec, { dcvChange, ocvChange });
    }

    const _changes = activeEffectChanges(activeEffect);

    if (activeEffect.name && _changes.length > 0) {
        // There is no need to keep track of OCV/DCV changes when not in combat
        if (item.actor) {
            if (item.actor.inCombat === false) {
                return ui.notifications.info(
                    `${item.name} effects were not automated because ${item.actor.name} is not in combat.`,
                );
            }
        }

        // TODO: You can only have 1 combat effect applied at any time.
        // If there is already a combat effect then either the player is trying to cheat
        // or the previous combat effect did not properly expire.
        // I don't believe we have a way to tell if there is a current martial or maneuver effect.
        // Should add something to flags/system so we can check.

        // v14 throws error if effect.duration.value is not an integer.
        // Value = Infinity fails SchemaField validation.
        // We can replace Infinity with null and get this to work.
        // Appears to be a FoundryVTT V14 build 363 bug.
        if (activeEffect.duration?.value === Infinity) {
            activeEffect.duration.value = null;
        }
        if (existingEffect) {
            await existingEffect.update({ ...activeEffect, _id: undefined });
        } else if (originalItem.id) {
            await originalItem.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
        } else {
            console.error(`originalItem has no id, something is very wrong here`, originalItem);
        }
    }
}

/**
 * For maneuvers that require a hit, we apply tactical status effects in addition to or instead of damage.
 * Prioritizes absolute database parity and simple execution paths by processing documents sequentially.
 *
 * @param {Item} item - The maneuver item initiating the action.
 * @param {Object} action - The action payload tracking target and execution metadata.
 * @returns {Promise<void>}
 */
export async function doManeuverEffects(item, action, targetToken) {
    const attackerActor = item.actor;

    // Guard Clause: If there is no initiating actor, notify the console/UI and terminate execution immediately
    if (!attackerActor) {
        const errorMsg = `HERO: Cannot process maneuver effects because the item "${item.name}" lacks a valid actor reference.`;
        ui.notifications?.error(errorMsg);
        console.error(errorMsg);
        return;
    }

    const hasAttackerFallsElement = !!maneuverAttackerFallsElement(item);
    const hasGrabBasis = !!maneuverGrabBasis(item);
    const hasThrowBasis = !!maneuverThrowBasis(item);

    const currentTargets = action.system.currentTargets || [];
    if (currentTargets.length === 0 && targetToken) {
        currentTargets.push(targetToken);
    }
    const validTargets = currentTargets.filter((t) => !!t.actor);

    // --- 1. PROCESS ALL TARGETED DEFENDERS SEQUENTIALLY ---
    if (hasThrowBasis || hasGrabBasis) {
        for (const targetedToken of validTargets) {
            const defenderActor = targetedToken.actor;

            if (hasGrabBasis) {
                await defenderActor.createEmbeddedDocuments("ActiveEffect", [
                    {
                        // deepClone: freeze on statusEffectsObj is shallow and document construction takes ownership of system/changes
                        ...foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect),
                        name: `Grabbed by ${attackerActor.name}`,
                        flags: {
                            [game.system.id]: {
                                grabberById: attackerActor.id,
                                grabberByUuid: attackerActor.uuid,
                            },
                        },
                    },
                ]);
            }

            if (hasThrowBasis) {
                await defenderActor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
                    active: true,
                });
                // TODO: Offer actor an ACROBATICS skill roll to negate the prone effect
                // Acrobatics allows -3 to negate prone for target, breakfall at -1 per 2d6 to
                // halve damage but not prevent prone, per UMA p112 and 5ER p400.
                // They can also make a half roll on acrobatics to retain full DCV but remain prone.
            }
        }
    }

    // --- 2. PROCESS THE ATTACKER ---
    if (hasGrabBasis && validTargets.length > 0) {
        await attackerActor.createEmbeddedDocuments("ActiveEffect", [
            {
                ...foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect),
                name: `Grabbing ${validTargets.map((t) => t.name).join(" + ")}`,
                flags: {
                    [game.system.id]: {
                        targetIds: validTargets.map((t) => t.id),
                        targetUuids: validTargets.map((t) => t.actor.uuid),
                    },
                },
            },
        ]);
    }

    if (hasAttackerFallsElement) {
        await attackerActor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
            active: true,
        });
    }
}
