import { HEROSYS } from "../herosystem6e.mjs";
import { roundFavorPlayerAwayFromZero } from "../utility/round.mjs";

const { ArrayField, EmbeddedDataField, NumberField, StringField } = foundry.data.fields;

class HeroSystem6eActiveEffectsChanges extends foundry.abstract.DataModel {
    /** @inheritdoc */
    static defineSchema() {
        return {
            // Required base schema fields
            type: new StringField(),
            phase: new StringField(),
            priority: new NumberField({ integer: true, min: 0 }),

            // Hero system additions
            key: new StringField(),
            value: new NumberField(),
        };
    }
}

export class HeroSystem6eActorActiveEffectsSystemData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            changes: new ArrayField(new EmbeddedDataField(HeroSystem6eActiveEffectsChanges)),
            // Make sure active-effect-config.hbs has all these fields so they don't get lost during editing
            XMLID: new StringField(),
        };
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
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.dmcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            bleedingEffect: {
                name: game.i18n.localize("EFFECT.StatusBleeding"),
                id: "bleeding",
                img: "icons/svg/blood.svg",
            },
            unconsciousEffect: {
                name: game.i18n.localize("EFFECT.StatusUnconscious"),
                id: "unconscious",
                img: "icons/svg/unconscious.svg",
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dmcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
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
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.omcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dmcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
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
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                ],
            },
            asleepEffect: {
                name: game.i18n.localize("EFFECT.StatusAsleep"),
                id: "asleep",
                img: "icons/svg/sleep.svg",
                // changes: [
                //     { key: "system.characteristics.ocv.value", value: 0.5, mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY },
                //     { key: "system.characteristics.dcv.value", value: 0.5, mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY }
                // ]
            },
            proneEffect: {
                id: "prone",
                name: game.i18n.localize("EFFECT.StatusProne"),
                img: "icons/svg/falling.svg",
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            entangledEffect: {
                id: "entangled",
                name: game.i18n.localize("EFFECT.StatusEntangled"),
                img: "icons/svg/net.svg",
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            paralyzedEffect: {
                id: "paralysis",
                name: game.i18n.localize("EFFECT.StatusParalyzed"),
                img: "icons/svg/paralysis.svg",
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
            },
            regenerationEffect: {
                id: "regeneration",
                name: game.i18n.localize("EFFECT.StatusRegeneration"),
                img: "icons/svg/regen.svg",
            },
            aidEffect: {
                id: "upgrade",
                name: game.i18n.localize("EFFECT.StatusAdjustmentAid"),
                img: "icons/svg/upgrade.svg",
            },
            drainEffect: {
                id: "downgrade",
                name: game.i18n.localize("EFFECT.StatusAdjustmentDrain"),
                img: "icons/svg/downgrade.svg",
            },
            invisibleEffect: {
                id: "invisible",
                name: game.i18n.localize("EFFECT.StatusInvisible"),
                img: "icons/svg/invisible.svg",
            },
            targetedEffect: {
                id: "target",
                name: game.i18n.localize("EFFECT.StatusTargeted"),
                img: "icons/svg/target.svg",
            },
            holdingAnActionEffect: {
                id: "holding",
                name: game.i18n.localize("EFFECT.HoldingAnAction"),
                img: `icons/svg/clockwork.svg`,
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
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
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
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
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
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
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
            },
            dodgeEffect: {
                id: "dodge",
                name: game.i18n.localize("EFFECT.StatusDodging"),
                img: `systems/${module}/icons/dodge.svg`,
            },
            grabEffect: {
                id: "grab",
                name: "Grabbed",
                img: `systems/${module}/icons/noun-wrestling-1061808.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            haymakerEffect: {
                id: "haymaker",
                name: "Haymaker",
                img: `icons/svg/sword.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: -5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ],
            },
            strikeEffect: {
                id: "strike",
                name: game.i18n.localize("EFFECT.StatusStriking"),
                img: `systems/${module}/icons/fist.svg`,
            },

            // Movement Effects
            flyingEffect: {
                id: "fly",
                name: game.i18n.localize("EFFECT.StatusFlying"),
                img: "icons/svg/wing.svg",
            },
            nonCombatMovementEffect: {
                id: "nonCombatMovement",
                name: "NonCombat Movement",
                img: `systems/${module}/icons/person-running.svg`,
                changes: [
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            tunnelingEffect: {
                id: "tunneling",
                name: game.i18n.localize("EFFECT.StatusTunneling"),
                img: "icons/svg/mole.svg",
            },

            // Sense affecting effects
            dangerSenseDisabledEffect: {
                id: "dangerSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseDangerDisabled"),
                img: `systems/${module}/icons/senses/dangerSenseDisabled.svg`,
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
            },
            mentalSenseDisabledEffect: {
                id: "mentalSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseMentalDisabled"),
                img: `systems/${module}/icons/senses/mentalSenseDisabled.svg`,
            },
            radioSenseDisabledEffect: {
                id: "radioSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseRadioDisabled"),
                img: `systems/${module}/icons/senses/radioSenseDisabled.svg`,
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
                changes: [
                    {
                        key: "system.characteristics.ocv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
            },
            silencedEffect: {
                id: "silence",
                name: game.i18n.localize("EFFECT.StatusSilenced"),
                img: "icons/svg/silenced.svg",
            },
            smellTasteSenseDisabledEffect: {
                id: "smellTasteSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseSmellTasteDisabled"),
                img: `systems/${module}/icons/senses/smellTasteSenseDisabled.svg`,
            },
            sonarSenseDisabledEffect: {
                id: "sonarSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseSonarDisabled"),
                img: `systems/${module}/icons/senses/sonarSenseDisabled.svg`,
            },
            spatialAwarenessSenseDisabledEffect: {
                id: "spatialAwarenessSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseSpatialAwarenessDisabled"),
                img: `systems/${module}/icons/senses/spatialAwarenessSenseDisabled.svg`,
            },
            touchSenseDisabledEffect: {
                id: "touchSenseDisabled",
                name: game.i18n.localize("EFFECT.StatusSenseTouchDisabled"),
                img: `systems/${module}/icons/senses/touchSenseDisabled.svg`,
            },
        });

        // Return an array of status effects sorted by property in alphabetical order
        return Object.values(HeroSystem6eActorActiveEffects.statusEffectsObj).sort((objA, objB) =>
            objA.name.localeCompare(objB.name),
        );
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

        if (this.isOwner) {
            globalThis.setTimeout(() => this.#updateValueBasedOnMax(data, options), 1);
        }
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);
        game[HEROSYS.module].effectPanel.refresh();

        if (this.isOwner && changed) {
            globalThis.setTimeout(() => this.#updateValueBasedOnMax(changed, options), 1);
        }
    }

    async #updateValueBasedOnMax(data, options) {
        // Update characteristic VALUE when MAX is modified

        const actor = this.target;
        if (actor.constructor?.name !== "HeroSystem6eActor") {
            console.warn(`AE target is not an instance of HeroSystem6eActor`, this);
            return;
        }

        // Created a disabled AE, do nothing
        if (options.action === "create" && data.disabled) {
            return;
        }

        if (options.action === "update" && data.changes) {
            console.error("HeroSystem updating of VALUEs based on AE is not supported", data);
            return;
        }

        const actorChanges = {};
        for (const change of this.changes) {
            const key = change.key.match(/([a-z]+)\.max/)?.[1];
            if (key) {
                if (actor?.system?.characteristics?.[key]) {
                    // KLUGE: Set VALUE to MAX for now. We need a better solution.
                    actorChanges[`system.characteristics.${key}.value`] = actor.system.characteristics[key].max;

                    // 5e figured characteristic
                    if (actor.is5e) {
                        await actor.updateFiguredCharacteristicDependencies(key.toUpperCase());
                    }
                }
            }
        }
        await actor.update(actorChanges);
    }

    _onDelete(options, userId) {
        super._onDelete(options, userId);
        game[HEROSYS.module].effectPanel.refresh();

        if (this.isOwner) {
            // Status toggles call this (e.g. prone)
            globalThis.setTimeout(() => this.#updateValueBasedOnMax({}, options), 1);
        }
    }

    _prepareDuration() {
        const d = this.duration;

        // Time-based duration
        if (Number.isNumeric(d.seconds)) {
            const wt = game.time.worldTime;
            const start = d.startTime || wt;
            const elapsed = wt - start;
            const remaining = d.seconds - elapsed;

            let totalSeconds = parseInt(remaining, 10);

            const days = Math.floor(totalSeconds / (3600 * 24)); // 3600 seconds in an hour, 24 hours in a day
            totalSeconds %= 3600 * 24; // Remaining seconds after calculating days

            const hours = Math.floor(totalSeconds / 3600); // 3600 seconds in an hour
            totalSeconds %= 3600; // Remaining seconds after calculating hours

            const minutes = Math.floor(totalSeconds / 60); // 60 seconds in a minute
            totalSeconds %= 60; // Remaining seconds

            const seconds = totalSeconds;

            return {
                type: "seconds",
                duration: d.seconds,
                remaining: remaining,
                label: `${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${minutes ? `${minutes}m ` : ""}${seconds ? `${seconds}s` : ""}`,
                _worldTime: wt,
            };
        }

        return super._prepareDuration();
    }

    get nameExtended() {
        const sourceName = this.flags[game.system.id]?.source;
        const d = this._prepareDuration();
        return `${this.name} [${sourceName ? `${sourceName}, ` : ""}${d.label}]`;
    }
}
