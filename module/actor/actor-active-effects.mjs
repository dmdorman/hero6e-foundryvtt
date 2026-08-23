import { HEROSYS } from "../herosystem6e.mjs";
import { roundFavorPlayerAwayFromZero } from "../utility/round.mjs";
import { HeroCompatibility } from "../utility/compatibility.mjs";

// Compatibility V14
const _ActiveEffectTypeDataModel = foundry.data?.ActiveEffectTypeDataModel ?? foundry.abstract.TypeDataModel;

export class HeroSystem6eActorActiveEffectsSystemData extends _ActiveEffectTypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        // Compatibility V14
        const _schema = foundry.data?.ActiveEffectTypeDataModel == undefined ? {} : super.defineSchema();
        return {
            ..._schema,
            XMLID: new fields.StringField(),
        };
    }

    // V14 core suppresses an AE once its duration lapses (ActiveEffect#isSuppressed falls back to
    // duration.expired, persisted by the ActiveEffectRegistry). The system expires effects itself
    // (expireEffects), and adjustments fade on the actor's Phase — later than core's world-time
    // lapse. In that gap a suppressed drain stops contributing to max while the drained value
    // remains, e.g. BODY 7/7 briefly shows 7/10 [SUPPRESSED] (#4524). Core prefers this getter
    // over duration.expired, so opt out of suppression entirely (matching V13 behavior).
    // TODO: When we refactor active effects for V14 properly, evaluate this.
    get isSuppressed() {
        return false;
    }
}

export class HeroSystem6eActorActiveEffects extends ActiveEffect {
    // static defineSchema() {
    //     const schema2 = this.schema; // foundry.deepClone(super.defineSchema());
    //     schema2.changes = new foundry.data.fields.ArrayField(
    //         new foundry.data.fields.SchemaField({
    //             key: new foundry.data.fields.StringField({ required: true, label: "EFFECT.ChangeKey" }),
    //             value: new foundry.data.fields.StringField({ required: true, label: "EFFECT.ChangeValue" }),
    //             mode: new foundry.data.fields.NumberField({
    //                 integer: true,
    //                 initial: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
    //                 label: "EFFECT.ChangeMode",
    //             }),
    //             priority: new foundry.data.fields.NumberField(),
    //             seconds: new foundry.data.fields.NumberField({ integer: true, label: "EFFECT.Seconds" }),
    //         }),
    //     );
    //     return schema2;
    // }
    //ActiveEffect.schema.fields.changes.element.fields

    // All status effects
    static statusEffectsObj;

    static initialize(module) {
        HeroSystem6eActorActiveEffects.statusEffectsObj = Object.freeze({
            // A Stunned character’s DCV and DMCV are instantly halved.
            stunEffect: {
                name: game.i18n.localize("EFFECT.StatusStunned"),
                id: "stunned",
                //img: "icons/svg/daze.svg",
                img: `systems/${module}/icons/foundry/daze.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.dmcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            bleedingEffect: {
                name: game.i18n.localize("EFFECT.StatusBleeding"),
                id: "bleeding",
                img: "icons/svg/blood.svg",
                showIcon: 2, // always
            },
            unconsciousEffect: {
                name: game.i18n.localize("EFFECT.StatusUnconscious"),
                id: "unconscious",
                img: "icons/svg/unconscious.svg",
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dmcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                ],
            },
            knockedOutEffect: {
                name: game.i18n.localize("EFFECT.StatusKnockedOut"),
                id: "knockedOut",
                //img: "icons/svg/stoned.svg",
                img: `systems/${module}/icons/foundry/stoned.svg`,
                changes: [
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.omcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dmcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                ],
            },
            deadEffect: {
                name: game.i18n.localize("EFFECT.StatusDead"),
                id: "dead",
                //img: "icons/svg/skull.svg",
                img: `systems/${module}/icons/foundry/skull.svg`,
                changes: [
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                ],
            },
            asleepEffect: {
                name: game.i18n.localize("EFFECT.StatusAsleep"),
                id: "asleep",
                img: "icons/svg/sleep.svg",
                showIcon: 2, // always
                // changes: [
                //     { key: "system.characteristics.ocv.value", value: 0.5, type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY },
                //     { key: "system.characteristics.dcv.value", value: 0.5, type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY }
                // ]
            },
            proneEffect: {
                id: "prone",
                name: game.i18n.localize("EFFECT.StatusProne"),
                img: "icons/svg/falling.svg",
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            entangledEffect: {
                id: "entangled",
                name: game.i18n.localize("EFFECT.StatusEntangled"),
                img: "icons/svg/net.svg",
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            paralyzedEffect: {
                id: "paralysis",
                name: game.i18n.localize("EFFECT.StatusParalyzed"),
                img: "icons/svg/paralysis.svg",
                showIcon: 2, // always
            },
            mindControlledEffect: {
                id: "mindControl",
                name: game.i18n.localize("EFFECT.MindControlled"),
                img: `systems/${module}/icons/mindControlled.svg`,
            },
            frightenedEffect: {
                id: "fear",
                name: game.i18n.localize("EFFECT.StatusFear"),
                img: "icons/svg/terror.svg",
                showIcon: 2, // always
            },
            regenerationEffect: {
                id: "regeneration",
                name: game.i18n.localize("EFFECT.StatusRegeneration"),
                img: "icons/svg/regen.svg",
                showIcon: 2, // always
            },
            aidEffect: {
                id: "upgrade",
                name: game.i18n.localize("EFFECT.StatusAdjustmentAid"),
                img: "icons/svg/upgrade.svg",
                showIcon: 2, // always
            },
            drainEffect: {
                id: "downgrade",
                name: game.i18n.localize("EFFECT.StatusAdjustmentDrain"),
                img: "icons/svg/downgrade.svg",
                showIcon: 2, // always
            },
            invisibleEffect: {
                id: "invisible",
                name: game.i18n.localize("EFFECT.StatusInvisible"),
                img: "icons/svg/invisible.svg",
                showIcon: 2, // always
            },
            targetedEffect: {
                id: "target",
                name: game.i18n.localize("EFFECT.StatusTargeted"),
                img: "icons/svg/target.svg",
                showIcon: 2, // always
            },
            holdingAnActionEffect: {
                id: "holding",
                name: game.i18n.localize("EFFECT.HoldingAnAction"),
                img: `icons/svg/clockwork.svg`,
                showIcon: 2, // always
            },

            // Water effects
            underwaterEffect: {
                id: "underwater",
                name: game.i18n.localize("EFFECT.Underwater"),
                img: `systems/${module}/icons/underwater.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: -2,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ],
            },
            standingInWaterEffect: {
                id: "standingInWater",
                name: game.i18n.localize("EFFECT.StandingInWater"),
                img: `systems/${module}/icons/standingInWater.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: -2,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ],
            },
            holdingBreathEffect: {
                id: "holdingBreath",
                name: game.i18n.localize("EFFECT.HoldingBreath"),
                img: `systems/${module}/icons/holdingBreath.svg`,
            },

            // Maneuver Effects
            abortEffect: {
                id: "aborted",
                name: game.i18n.localize("EFFECT.Aborted"),
                img: `systems/${module}/icons/aborted.svg`,
            },
            blockEffect: {
                id: "block",
                name: game.i18n.localize("EFFECT.StatusBlocking"),
                img: `systems/${module}/icons/block.svg`,
            },
            braceEffect: {
                id: "brace",
                name: "Braced",
                flags: {
                    [`${game.system.id}.type`]: "maneuver",
                },
                img: "icons/svg/statue.svg",
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            clubWeaponEffect: {
                id: "club-weapon",
                name: "Club Weapon",
                flags: {
                    [`${game.system.id}.type`]: "maneuver",
                },
                img: `systems/${module}/icons/spiked-club.svg`,
            },
            desolidificationEffect: {
                id: "desolidification",
                name: game.i18n.localize("EFFECT.StatusDesolidification"),
                img: `icons/svg/mystery-man.svg`,
                showIcon: 2, // always
            },
            dodgeEffect: {
                id: "dodge",
                name: game.i18n.localize("EFFECT.StatusDodging"),
                img: `systems/${module}/icons/dodge.svg`,
                showIcon: 2, // always
            },
            grabEffect: {
                id: "grab",
                name: "Grabbed",
                img: `systems/${module}/icons/noun-wrestling-1061808.svg`,
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            haymakerEffect: {
                id: "haymaker",
                name: "Haymaker",
                img: `icons/svg/sword.svg`,
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: -5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ],
            },
            strikeEffect: {
                id: "strike",
                name: game.i18n.localize("EFFECT.StatusStriking"),
                img: `systems/${module}/icons/fist.svg`,
                showIcon: 2, // always
            },

            // Movement Effects
            flyingEffect: {
                id: "fly",
                name: game.i18n.localize("EFFECT.StatusFlying"),
                img: "icons/svg/wing.svg",
                showIcon: 2, // always
            },
            nonCombatMovementEffect: {
                id: "nonCombatMovement",
                name: "NonCombat Movement",
                img: `systems/${module}/icons/person-running.svg`,
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            tunnelingEffect: {
                id: "tunneling",
                name: game.i18n.localize("EFFECT.StatusTunneling"),
                img: "icons/svg/mole.svg",
                showIcon: 2, // always
            },

            // Sense affecting effects
            dangerSenseDisabledEffect: {
                id: "dangerSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseDangerDisabled"),
                img: `systems/${module}/icons/senses/dangerSenseDisabled.svg`,
                showIcon: 2, // always
            },
            detectSenseDisabledEffect: {
                id: "detectSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseDetectDisabled"),
                img: `systems/${module}/icons/senses/detectSenseDisabled.svg`,
            },
            hearingSenseDisabledEffect: {
                id: "hearingSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseHearingDisabled"),
                img: "icons/svg/deaf.svg",
                showIcon: 2, // always
            },
            mentalSenseDisabledEffect: {
                id: "mentalSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseMentalDisabled"),
                img: `systems/${module}/icons/senses/mentalSenseDisabled.svg`,
                showIcon: 2, // always
            },
            radioSenseDisabledEffect: {
                id: "radioSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseRadioDisabled"),
                img: `systems/${module}/icons/senses/radioSenseDisabled.svg`,
                showIcon: 2, // always
            },
            // Temporary BLIND status/effect until enhanced senses can be fully implemented.
            // When a character cannot perceive their opponent with any
            // Targeting Sense, they are at ½ DCV. He’s also at ½ OCV in HTH
            // Combat and 0 OCV in Ranged Combat.
            // As a Half Phase Action, a character can attempt a PER Roll
            // to perceive a particular target with a Nontargeting Sense (at -5 if
            // the Nontargeting Sense is Smell). If successful, then the penalties
            // above are reduced (against that target only) to ½ OCV in HTH or
            // Ranged Combat, and -1 DCV in HTH Combat (full DCV at Range).
            // These effects last until the beginning of the character’s next Phase.
            sightSenseDisabledEffect: {
                id: "blind",
                name: game.i18n.localize("EFFECT.StatusSenseSightDisabled"),
                img: "icons/svg/blind.svg",
                showIcon: 2, // always
                changes: [
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            silencedEffect: {
                id: "silence",
                name: game.i18n.localize("EFFECT.StatusSilenced"),
                img: "icons/svg/silenced.svg",
                showIcon: 2, // always
            },
            smellTasteSenseDisabledEffect: {
                id: "smellTasteSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseSmellTasteDisabled"),
                img: `systems/${module}/icons/senses/smellTasteSenseDisabled.svg`,
                showIcon: 2, // always
            },
            sonarSenseDisabledEffect: {
                id: "sonarSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseSonarDisabled"),
                img: `systems/${module}/icons/senses/sonarSenseDisabled.svg`,
                showIcon: 2, // always
            },
            spatialAwarenessSenseDisabledEffect: {
                id: "spatialAwarenessSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseSpatialAwarenessDisabled"),
                img: `systems/${module}/icons/senses/spatialAwarenessSenseDisabled.svg`,
                showIcon: 2, // always
            },
            touchSenseDisabledEffect: {
                id: "touchSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseTouchDisabled"),
                img: `systems/${module}/icons/senses/touchSenseDisabled.svg`,
                showIcon: 2, // always
            },
            // Weight-derived condition (#2319): the AE carrying the actual DCV/
            // movement penalties is managed by the encumbrance recalc; registering
            // the status surfaces it on the token HUD and tracker rows. The
            // equipment weight percentage setting at 0 disables the penalties.
            encumberedEffect: {
                id: "encumbered",
                name: "Encumbered",
                img: `systems/${module}/icons/encumbered.svg`,
                // Weight-derived: the encumbrance recalc owns it, so keep the HUD
                // from offering a manual toggle that would orphan or strip penalties
                hud: false,
            },
        });

        // Return an array of status effects sorted by property in alphabetical order
        return Object.values(HeroSystem6eActorActiveEffects.statusEffectsObj).sort((objA, objB) =>
            objA.name.localeCompare(objB.name),
        );
    }

    // Combat tracker row icons show only combat-relevant effects, most impactful
    // first. Tier 1 = cannot act, 2 = CV/stances, 3 = STUN/END/REC/BODY,
    // 4 = other characteristics/senses/misc. A group key collapses alike effects
    // into a single icon. The effects panel still lists everything.
    static #TRACKER_RANK_BY_STATUS = (() => {
        const senses = [
            "hearingSenseDisabled",
            "mentalSenseDisabled",
            "radioSenseDisabled",
            "smellTasteSenseDisabled",
            "touchSenseDisabled",
            "sonarSenseDisabled",
            "spatialAwarenessSenseDisabled",
            "dangerSenseDisabled",
            "detectSenseDisabled",
        ];
        const tiers = [
            [
                "dead",
                "unconscious",
                "knockedOut",
                "asleep",
                "paralysis",
                "stunned",
                "entangled",
                "blind",
                "mindControl",
                "aborted",
            ],
            [
                "prone",
                "grab",
                "dodge",
                "block",
                "brace",
                "haymaker",
                "strike",
                "nonCombatMovement",
                "encumbered",
                "underwater",
                "standingInWater",
                "desolidification",
                "invisible",
                "target",
                "holding",
            ],
            ["bleeding", "holdingBreath"],
            ["fear", "silence", "regeneration", "fly", "tunneling", "club-weapon", ...senses],
        ];
        const map = {};
        tiers.forEach((ids, tierIndex) =>
            ids.forEach((id, order) => {
                map[id] = Object.freeze({
                    tier: tierIndex + 1,
                    order,
                    ...(senses.includes(id) ? { group: "senses" } : {}),
                });
            }),
        );
        return Object.freeze(map);
    })();

    static #TRACKER_CV_CHARACTERISTICS = new Set(["ocv", "dcv", "omcv", "dmcv"]);
    static #TRACKER_KEY_CHARACTERISTICS = new Set(["stun", "end", "rec", "body"]);

    /**
     * Classify an effect for the combat tracker's row icons.
     * Falls back from known status ids to the characteristics the effect's
     * changes touch; effects with no combat impact return null and are hidden.
     * @param {ActiveEffect} effect
     * @returns {{tier: number, order: number, group?: string}|null}
     */
    static combatTrackerClassification(effect) {
        let best = null;
        for (const status of effect.statuses ?? []) {
            const rank = HeroSystem6eActorActiveEffects.#TRACKER_RANK_BY_STATUS[status];
            if (rank && (!best || rank.tier < best.tier || (rank.tier === best.tier && rank.order < best.order))) {
                best = rank;
            }
        }
        if (best) return best;

        if (effect.XMLID === "naturalBodyHealing") return null;

        const effectChanges = effect.changes?.length ? effect.changes : (effect.system?.changes ?? []);
        const characteristics = effectChanges
            .map((c) => c.key?.match(/^system\.characteristics\.([a-z0-9]+)\./)?.[1])
            .filter(Boolean);
        const touchesKeyCharacteristic = characteristics.some((c) =>
            HeroSystem6eActorActiveEffects.#TRACKER_KEY_CHARACTERISTICS.has(c),
        );

        const flags = effect.flags?.[game.system.id];
        if (flags?.type === "adjustment") {
            const activePoints =
                parseInt(flags.adjustmentActivePoints) ||
                effectChanges.reduce((sum, c) => sum + (parseInt(c.value) || 0), 0);
            return { tier: touchesKeyCharacteristic ? 3 : 4, order: 99, group: activePoints < 0 ? "drain" : "aid" };
        }

        if (characteristics.some((c) => HeroSystem6eActorActiveEffects.#TRACKER_CV_CHARACTERISTICS.has(c))) {
            return { tier: 2, order: 99 };
        }
        if (touchesKeyCharacteristic) return { tier: 3, order: 99 };
        if (characteristics.length) return { tier: 4, order: 99 };
        return null;
    }

    /**
     * Apply an ActiveEffect that uses a MULTIPLY application mode.
     * Changes which MULTIPLY must be numeric to allow for multiplication.
     * @param {Actor} actor                   The Actor to whom this effect should be applied
     * @param {EffectChangeData} change       The change data being applied
     * @param {*} current                     The current value being modified
     * @param {*} delta                       The parsed value of the change object
     * @param {object} changes                An object which accumulates changes to be applied
     * @private
     */
    _applyMultiply(actor, change, current, delta, changes) {
        let update;
        const ct = foundry.utils.getType(current);
        switch (ct) {
            case "boolean":
                update = current && delta;
                break;
            case "number":
                update = roundFavorPlayerAwayFromZero(current * delta);
                break;
        }
        changes[change.key] = update;
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        game[HEROSYS.module].effectPanel.refresh();
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);
        game[HEROSYS.module].effectPanel.refresh();
    }

    _onDelete(options, userId) {
        super._onDelete(options, userId);
        game[HEROSYS.module].effectPanel.refresh();

        // Deleting an adjustment (AID) leaves the stored current value above the restored max; pull it
        // back in line. Fade handles its own value bookkeeping and zeroes its changes before the final
        // delete, so this clamp is a no-op there. Only the initiating client writes.
        if (userId === game.user.id) {
            this._clampCharacteristicValuesAfterAdjustmentRemoval();

            // A maneuver phase effect removed outside its item's toggle (effects
            // panel, scripts) must not leave the item flagged active
            const flags = this.flags?.[game.system.id];
            if (flags?.type === "maneuverNextPhaseEffect" && flags.toggle) {
                const item = this.parent;
                if (item?.documentName === "Item" && item.system?.active) {
                    item.update({ "system.active": false }).catch((e) =>
                        console.error(`Maneuver active-state sync failed`, e),
                    );
                }
            }
        }
    }

    async _clampCharacteristicValuesAfterAdjustmentRemoval() {
        const actor = this.parent;
        if (actor?.documentName !== "Actor") return;
        if (this.flags?.[game.system.id]?.type !== "adjustment") return;

        const updates = {};
        const effectChanges = this.changes?.length ? this.changes : (this.system?.changes ?? []);
        for (const change of effectChanges) {
            const key = change.key?.match(/^system\.characteristics\.([a-z]+)\.max$/)?.[1];
            if (!key) continue;

            const characteristic = actor.getCharacteristic(key);
            if (!characteristic) continue;

            const value = Number(characteristic.value);
            const max = Number(characteristic.max);
            if (!Number.isFinite(value) || !Number.isFinite(max)) continue;

            // Removing an adjustment removes its contribution (5ER p. 107: adjusted points
            // fade/return; deletion is the GM shortcutting that). An AID's boosted points vanish, so
            // clamp the current value down to the restored max — never subtract the change amount,
            // since points consumed while boosted came out of the boost first (5ER p. 105-106) and
            // are already reflected in the stored value. A DRAIN's removed points come back, so add
            // them (value - negativeChange) to the current value, mirroring updateCharacteristicValue's
            // return handling. Both arms clamp to max, which also makes this safe for effects whose
            // value bookkeeping never happened (e.g. a bare GM-created effect): the restoration can
            // never push the current value past the freshly recomputed max.
            const changeValue = parseInt(change.value) || 0;
            const newValue = changeValue < 0 ? Math.min(value - changeValue, max) : Math.min(value, max);
            if (newValue !== value) {
                updates[`system.characteristics.${key}.value`] = newValue;
            }
        }

        if (Object.keys(updates).length > 0) {
            await actor.update(updates);
        }
    }

    _prepareDuration() {
        const duration = super._prepareDuration();

        // V14 is fine, so are non-temporary effects
        if (HeroCompatibility.isV14 || !this.isTemporary) {
            return duration;
        }

        // V13 temporary effects: Making a label similar to V14 (_prepareTimeBasedDuration)
        try {
            const days = Math.floor(duration.remaining / 86400);
            const hours = Math.floor((duration.remaining % 86400) / 3600);
            const minutes = Math.floor((duration.remaining % 3600) / 60);
            const seconds = duration.remaining % 60;
            const label = [
                days ? `${days} day` : null,
                hours ? `${hours} hour` : null,
                minutes ? `${minutes} min` : null,
                seconds ? `${seconds} sec` : null,
            ]
                .filter((c) => !!c)
                .join(", ");
            duration.label = label;
        } catch (e) {
            console.error("Error in _prepareDuration", e);
        }
        return duration;
    }

    get XMLID() {
        // natively created ActiveEffects likely have no system/flag data
        return this.system.XMLID ?? this.flags?.[game.system.id]?.XMLID;
    }

    get nameExtended() {
        try {
            const sourceItem = this.origin?.includes("Item") ? fromUuidSync(this.origin) : null;
            const actorName =
                sourceItem?.actor?.token?.name ??
                this.flags[game.system.id]?.itemTokenName ??
                this.flags[game.system.id]?.source;
            const itemName = sourceItem?.name;
            const d = this._prepareDuration();
            const components = [];
            if (actorName) components.push(actorName);
            if (itemName) components.push(itemName);
            const label = d?.label?.replace("None", ""); // In v14 label is the duration in user readable format
            if (label) components.push(label);
            if (this.isSuppressed) components.push("SUPPRESSED");
            return `${this.name}${components.length > 0 ? ` [${components.filter((c) => !!c).join(", ")}]` : ""}`;
        } catch (e) {
            console.error("Error in nameExtended", e);
            return this.name;
        }
    }

    get validationTooltip() {
        return this.heroValidation.map((m) => m.message).join(", ");
    }

    get heroValidation() {
        const heroValidations = [];

        if (this.isTemporary) {
            const d = this._prepareDuration();

            if (d.remaining > d.seconds) {
                heroValidations.push({
                    message: `${this._prepareDuration().remaining}s remaining but only ${d.seconds}s duration.`,
                    severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
                });
            }

            if (d.remaining < 0) {
                {
                    if (this.disabled || this.isSuppressed) {
                        heroValidations.push({
                            message: `Temporary effects should be deleted, not disabled or suppressed.`,
                            severity: CONFIG.HERO.VALIDATION_SEVERITY.WARNING,
                        });
                    } else {
                        heroValidations.push({
                            message: `${this._prepareDuration().remaining}s is negative.`,
                            severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
                        });
                    }
                }
            }

            // If start is earlier that worldTime
            // AARON: _worldTime seems to equal game.time.worldTime
            // if (d._worldTime < game.time.worldTime) {
            //     {
            //         heroValidations.push({
            //             message: `Effect start time is in the future.`,
            //             severity: CONFIG.HERO.VALIDATION_SEVERITY.WARN,
            //         });
            //     }
            // }

            // If an origin was specified, check if it still exists.
            const sourceItem = this.origin?.includes("Item") ? fromUuidSync(this.origin) : null;
            if (!!this.origin && !sourceItem) {
                heroValidations.push({
                    message: `The actor/item that created this effect no longer exists.`,
                    severity: CONFIG.HERO.VALIDATION_SEVERITY.INFO,
                });
            }
        }

        return heroValidations;
    }

    get validationCss() {
        function getKeyByValue(object, value) {
            return Object.keys(object).find((key) => object[key] === value);
        }
        const severityMax = Math.max(0, ...this.heroValidation.map((m) => m.severity ?? 0));

        if (severityMax > 0) {
            return `validation validation-${getKeyByValue(CONFIG.HERO.VALIDATION_SEVERITY, severityMax).toLocaleLowerCase()}`;
        }

        return "";
    }

    static _removeRedundantHalvingActiveEffects(changes) {
        // Filter out redundant multiplies, keeping lowest value
        const mults = changes.filter((c) => c.type === CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY);
        if (mults.length > 1) {
            const uniqueKeys = new Set();
            mults.forEach((obj) => {
                uniqueKeys.add(obj.key);
            });

            for (const key of uniqueKeys) {
                const multsUniqueKey = mults.filter((c) => c.key === key);
                if (multsUniqueKey.length > 1) {
                    const minValue = Math.min(...multsUniqueKey.map((c) => parseFloat(c.value)));
                    const keepMult = multsUniqueKey.find((c) => parseFloat(c.value) === minValue);
                    // remove all multsUniqueKey and add back in the keepMult
                    let index = changes.findIndex((c) => c.key === key);
                    while (index !== -1) {
                        changes.splice(index, 1);
                        index = changes.findIndex((c) => c.key === key);
                    }
                    //changes = changes.filter((c) => c.key !== key || c.mode !== CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY);
                    changes.push(keepMult);
                }
            }
        }
    }

    // static migrateData(source) {
    //     if (isGameV14OrLater()) {
    //         if (source.duration?.seconds) {
    //             source.duration.startTime ??= source.duration._worldTime;
    //             source.duration.expiryEvent ??= "turnEnd"; // New V14 Event requirement
    //         }
    //     }
    // }
}
