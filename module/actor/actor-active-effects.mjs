import { RoundFavorPlayerUp } from "../utility/round.mjs";

export class HeroSystem6eActorActiveEffects extends ActiveEffect {
    // Rhair3 suggestion:
    // First line is Dead / Unconscious/Asleep/Stunned
    // Second Line: Prone/ Entangled/Paralysed/Flying
    // Third Line: Blind/ Deaf/ Mute/Frightened
    // Forth Line: Burning/Frozen/Shocked/Corroding
    // Fith Line: Bleeding/Diseased/Poisoned/Cursed
    // Sixth Line: Regenerating/Degenerationg/Aid/Drain
    // seventh Line: Invisible/ Targeted/ Marked/ Blessed
    // Last Line: Fire Shield/ Ice Shield/ Magic Shield/ Holy Shield

    static getEffects(module) {
        return Object.keys(HeroSystem6eActorActiveEffects)
            .filter((effectKey) => effectKey.includes("Effect"))
            .sort()
            .map((effectKey) => {
                let heroIcon =
                    HeroSystem6eActorActiveEffects[effectKey].heroIcon;
                if (heroIcon) {
                    HeroSystem6eActorActiveEffects[effectKey].icon =
                        `systems/${module}/${heroIcon}`;
                }
                return HeroSystem6eActorActiveEffects[effectKey];
            });
    }

    // A Stunned character’s DCV and DMCV are instantly halved.
    static stunEffect = {
        name: "EFFECT.StatusStunned",
        id: "stunned",
        icon: "icons/svg/daze.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
            {
                key: "system.characteristics.dmcv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
        ],
    };

    static bleedingEffect = {
        name: "EFFECT.StatusBleeding",
        id: "bleeding",
        icon: "icons/svg/blood.svg",
    };

    // TODO: this appears not to be used; should it be removed?
    static unconsciousEffect = {
        name: "EFFECT.StatusUnconscious",
        id: "unconscious",
        icon: "icons/svg/unconscious.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
            {
                key: "system.characteristics.dmcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
        ],
    };

    static knockedOutEffect = {
        name: "EFFECT.StatusKnockedOut",
        id: "knockedOut",
        icon: "icons/svg/stoned.svg",
        changes: [
            {
                key: "system.characteristics.ocv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
            {
                key: "system.characteristics.omcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
            {
                key: "system.characteristics.dcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
            {
                key: "system.characteristics.dmcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
        ],
    };

    static deadEffect = {
        name: "EFFECT.StatusDead",
        id: "dead",
        icon: "icons/svg/skull.svg",
        changes: [
            {
                key: "system.characteristics.ocv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
            {
                key: "system.characteristics.dcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
            },
        ],
    };

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
    static blindEffect = {
        name: "EFFECT.StatusBlind",
        id: "blind",
        icon: "icons/svg/blind.svg",
        changes: [
            {
                key: "system.characteristics.ocv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
            {
                key: "system.characteristics.dcv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
        ],
    };

    static asleepEffect = {
        name: "EFFECT.StatusAsleep",
        id: "asleep",
        icon: "icons/svg/sleep.svg",
        // changes: [
        //     { key: "system.characteristics.ocv.value", value: 0.5, mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY },
        //     { key: "system.characteristics.dcv.value", value: 0.5, mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY }
        // ]
    };

    static proneEffect = {
        id: "prone",
        name: "EFFECT.StatusProne",
        icon: "icons/svg/falling.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
        ],
    };

    static entangledEffect = {
        id: "entangled",
        name: "Entangled",
        icon: "icons/svg/net.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: 0,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
            {
                key: "system.characteristics.ocv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
        ],
    };

    static paralysisEffect = {
        id: "paralysis",
        name: "EFFECT.StatusParalysis",
        icon: "icons/svg/paralysis.svg",
    };

    static flyingEffect = {
        id: "fly",
        name: "EFFECT.StatusFlying",
        icon: "icons/svg/wing.svg",
    };

    static deafEffect = {
        id: "deaf",
        name: "EFFECT.StatusDeaf",
        icon: "icons/svg/deaf.svg",
    };
    static silencedEffect = {
        id: "silence",
        name: "EFFECT.StatusSilenced",
        icon: "icons/svg/silenced.svg",
    };
    static frightenedEffect = {
        id: "fear",
        name: "EFFECT.StatusFear",
        icon: "icons/svg/terror.svg",
    };

    static regenEffect = {
        id: "regen",
        name: "EFFECT.StatusRegen",
        icon: "icons/svg/regen.svg",
    };

    static aidEffect = {
        id: "upgrade",
        name: "Aid",
        icon: "icons/svg/upgrade.svg",
    };

    static drainEffect = {
        id: "downgrade",
        name: "Drain",
        icon: "icons/svg/downgrade.svg",
    };

    static invisibleEffect = {
        id: "invisible",
        name: "EFFECT.StatusInvisible",
        icon: "icons/svg/invisible.svg",
    };

    static targetedEffect = {
        id: "target",
        name: "EFFECT.StatusTarget",
        icon: "icons/svg/target.svg",
    };

    static shieldFireEffect = {
        id: "fireShield",
        name: "Shield: Fire",
        icon: "icons/svg/fire-shield.svg",
    };
    static shieldIceEffect = {
        id: "coldShield",
        name: "Shield: Ice",
        icon: "icons/svg/ice-shield.svg",
    };
    static shieldMagicEffect = {
        id: "magicShield",
        name: "Shield: Magic",
        icon: "icons/svg/mage-shield.svg",
    };
    static shieldHolyEffect = {
        id: "holyShield",
        name: "Shield: holy",
        icon: "icons/svg/holy-shield.svg",
    };

    static abortEffect = {
        id: "aborted",
        name: "Aborted",
        heroIcon: `icons/aborted.svg`,
    };

    static underwaterEffect = {
        id: "underwater",
        name: "Underwater",
        heroIcon: "icons/underwater.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: -2,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            },
        ],
    };

    static standingInWaterEffect = {
        id: "standingInWater",
        name: "Standing In Water",
        heroIcon: "icons/standingInWater.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: -2,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            },
        ],
    };

    static holdingBreathEffect = {
        id: "holdingBreath",
        name: "Holding Breath",
        heroIcon: "icons/holdingBreath.svg",
    };

    static grabEffect = {
        id: "grab",
        name: "Grabbed",
        heroIcon: "icons/noun-wrestling-1061808.svg",
        changes: [
            {
                key: "system.characteristics.dcv.value",
                value: 0.5,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            },
        ],
    };

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
                update = RoundFavorPlayerUp(current * delta);
                break;
        }
        changes[change.key] = update;
    }
}
