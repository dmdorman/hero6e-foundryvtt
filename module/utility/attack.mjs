export class Attack {
    static getReasonCannotAttack(item, targetsArray, autofireAttackInfo) {
        let reason = item.actor.getTheReasonCannotAct();
        if (reason) {
            return reason;
        }
        const actingToken = item.actor.getActiveTokens()[0];

        if (targetsArray.length > 1 && !Attack.itemUsesMultipleTargets(item)) {
            return `${actingToken.name} has ${targetsArray.length} targets selected and ${item.name} supports only one.`;
        }
        const autofire = autofireAttackInfo?.autofire;
        const isAutofire = !!autofire;

        let charges = null;
        if (item.findModsByXmlid("CHARGES")) {
            charges = item.system.charges;
            if (charges) {
                if (charges.value === 0) {
                    return `${item.name} has no charges left.`;
                }
                if (charges.value < targetsArray.length) {
                    return `${actingToken.name} has ${targetsArray.length} targets selected and only ${charges.value} charges left.`;
                }
                if (isAutofire) {
                    if (charges.value < autofire.totalShotsFired) {
                        return `${actingToken.name} is going to use ${autofire.totalShotsFired} charges and only ${charges.value} charges left.`;
                    }
                }
            }
        }
        if (isAutofire) {
            if (autofire.autoFireShots < autofire.totalShotsFired) {
                return `${actingToken.name} is going to fire ${autofire.totalShotsFired} shots and can only fire ${autofire.autoFireShots} shots.`;
            }
        }

        const selfOnly = !!item.findModsByXmlid("SELFONLY");
        const onlySelf = !!item.findModsByXmlid("ONLYSELF");
        const usableOnOthers = !!item.findModsByXmlid("UOO");
        // supposedly item.system.range  has factored all of this in...
        const rangeSelf = item.system.range === "self";

        if (rangeSelf || selfOnly || onlySelf) {
            if (usableOnOthers) {
                console.log(
                    `${item.name} is a self-only ability that is usable on others!!??`,
                );
            } else {
                console.log(`${item.name} is a self-only ability`);
            }
            // TODO: Should not be able to use this on anyone else. Should add a check.
            if (targetsArray.length > 1) {
                return `There are ${targetsArray.length} targets selected and ${item.name} is a self-only ability.`;
            }
            if (targetsArray.length > 0) {
                // check if the target is me
                if (item.actor._id !== targetsArray[0].actor._id) {
                    return `${targetsArray[0].name} is targeted and ${item.name} is a self-only ability.`;
                }
            }
        }

        const noRange = item.system.range === "no range";
        if (noRange) {
            for (let i = 0; i < targetsArray.length; i++) {
                let target = targetsArray[i];
                let distance = canvas.grid.measureDistance(
                    actingToken,
                    target,
                    { gridSpaces: true },
                );
                // what are the units of distance? 2M is standard reach
                // if the actor has a greater reach count that...
                if (distance > 2) {
                    // TODO: get reach (STRETCHING/GROWTH/SHRINK)
                    return `${item.name} is a no range ability, and ${targetsArray[i].name} is at a distance of ${distance}`;
                }
            }
        }
        return null;
    }

    static itemUsesMultipleTargets(item) {
        // is there a system to indicate this?
        const autofire = !!item.findModsByXmlid("AUTOFIRE");
        const multipleAttack = item.system.XMLID === "MULTIPLEATTACK";
        const moveby = item.system.XMLID === "MOVEBY";
        return autofire || multipleAttack || moveby;
    }

    static getRangeModifier(item, range) {
        const actor = item.actor;

        if (item.system.range === "self") {
            // TODO: Should not be able to use this on anyone else. Should add a check.
            console.log("item.system.range === self && range:", range);
            return 0;
        }

        // TODO: Should consider if the target's range exceeds the power's range or not and display some kind of warning
        //       in case the system has calculated it incorrectly.

        const noRangeModifiers = !!item.findModsByXmlid("NORANGEMODIFIER");
        const normalRange = !!item.findModsByXmlid("NORMALRANGE");

        // There are no range penalties if this is a line of sight power or it has been bought with
        // no range modifiers.
        if (!(item.system.range === "los" || noRangeModifiers || normalRange)) {
            const factor = actor.system.is5e ? 4 : 8;

            let rangePenalty = -Math.ceil(Math.log2(range / factor)) * 2;
            rangePenalty = rangePenalty > 0 ? 0 : rangePenalty;

            // Brace (+2 OCV only to offset the Range Modifier)
            const braceManeuver = item.actor.items.find(
                (item) =>
                    item.type == "maneuver" &&
                    item.name === "Brace" &&
                    item.system.active,
            );
            if (braceManeuver) {
                //TODO: ???
            }
            return Math.floor(rangePenalty);
        }
        return 0;
    }

    static getAutofireAttackTargets(autofireAttackInfo, assignedShots) {
        const autofire = autofireAttackInfo.autofire;
        const targetedTokens = autofireAttackInfo.basic.targetedTokens;
        const basic = autofireAttackInfo.basic;
        const autofireSkills = autofire.autofireSkills;
        const targets = [];
        let totalSkippedMeters = 0;
        autofire.singleTarget = targetedTokens.length === 1;

        for (let i = 0; i < targetedTokens.length; i++) {
            let shotsOnTarget = autofire.singleTarget
                ? autofire.autoFireShots
                : 1;
            const shots_on_target_id = `shots_on_target_${targetedTokens[i].id}`;

            if (assignedShots[shots_on_target_id]) {
                shotsOnTarget = assignedShots[shots_on_target_id];
            }
            // these are the targeting data used for the attack(s)
            const targetingData = {
                basic,
                autofire,
                target: targetedTokens[i],
                shotsOnTarget,
                results: [],
                shots_on_target_id: `shots_on_target_${targetedTokens[i].id}`,
            };
            if (i !== 0) {
                const prevTarget = targetedTokens[i - 1];
                const target = targetedTokens[i];
                const skippedMeters = canvas.grid.measureDistance(
                    prevTarget,
                    target,
                    { gridSpaces: true },
                );
                totalSkippedMeters += skippedMeters;
                console.log(
                    `skip ${skippedMeters} meters between ${prevTarget.name} and ${target.name}`,
                );
                targetingData.skippedMeters = skippedMeters;
                targetingData.skippedShots = autofireSkills.SKIPOVER
                    ? 0
                    : Math.floor(skippedMeters / 2 - 1); //todo: check zero
            } else {
                targetingData.skippedMeters = 0;
                targetingData.skippedShots = 0;
            }
            targetingData.range = canvas.grid.measureDistance(
                basic.attacker,
                targetedTokens[i],
                { gridSpaces: true },
            );
            targetingData.ocv = Attack.getRangeModifier(
                basic.item,
                targetingData.range,
            );
            targets.push(targetingData);
            autofire.totalShotsFired += targetingData.shotsOnTarget;
            autofire.totalShotsFired += autofireSkills.SKIPOVER
                ? 0
                : targetingData.skippedShots;
            autofire.totalShotsSkipped += targetingData.skippedShots;
        }
        autofire.autofireOCV = 0;
        if (!autofire.singleTarget) {
            if (autofireSkills.ACCURATE) {
                autofire.autofireOCV -= 1;
            } else {
                autofire.autofireOCV -= totalSkippedMeters / 2;
            }
            if (autofireSkills.CONCENTRATED) {
                autofire.autofireOCV -= 1;
            }
            if (autofireSkills.SKIPOVER) {
                autofire.autofireOCV -= 1;
            }
        }
        return targets;
    }

    // make it getAttackInfo and that way we can use this for multiattack, and haymaker too
    static getAutofireAttackInfo(
        item,
        targetedTokens,
        formData,
        attackToHitOptions,
    ) {
        const autofireMod = item.findModsByXmlid("AUTOFIRE");
        if (!autofireMod || targetedTokens.length === 0) {
            return null;
        }
        const attacker =
            item.actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!attacker) return; // todo: message?

        const autoFireShots =
            parseInt(autofireMod.OPTION_ALIAS.match(/\d+/)) ?? 0;

        const autofireSkills = {};
        item.actor.items
            .filter((skill) => "AUTOFIRE_SKILLS" === skill.system.XMLID)
            .map((skill) => skill.system.OPTION)
            .forEach((skillOption) => (autofireSkills[skillOption] = true));

        const basic = {
            item,
            attacker,
            targetedTokens,
        }; // basic attack info

        const autofire = {
            autofireMod,
            autofireSkills,
            autoFireShots,
            totalShotsFired: 0,
            totalShotsSkipped: 0,
            autofireOCV: 0,
        }; // autofire attack info

        const autofireAttackInfo = {
            basic,
            autofire,
            charges: item.system.charges,
        };

        // use the form values for number of shots _unless_ they are switching to/from one target
        const assignedShots = attackToHitOptions
            ? { ...attackToHitOptions }
            : {};
        if (formData) {
            targetedTokens.map((target) => {
                const shots_on_target_id = `shots_on_target_${target.id}`;
                const shotsOnTargetInput = formData[shots_on_target_id];
                if (shotsOnTargetInput) {
                    const shotValue = parseInt(shotsOnTargetInput.match(/\d+/));
                    if (!isNaN(shotValue)) {
                        assignedShots[shots_on_target_id] = shotValue;
                    }
                }
            });
        }
        // this.data.autofireAttackInfo.targets.map((target) => {
        //     const shotValue = parseInt(
        //         formData[target.shots_on_target_id].match(/\d+/),
        //     );
        //     if (!isNaN(shotValue)) {
        //         target.shotsOnTarget = shotValue;
        //     }
        // });

        // if (oldAutofireAttackInfo && (oldAutofireAttackInfo.targets.length > 1 === targetedTokens.length > 1)) {
        //     oldAutofireAttackInfo.targets.forEach((target) => {
        //         assignedShots[target.target.id] = target.shotsOnTarget;
        //     });
        // }
        autofireAttackInfo.targets = Attack.getAutofireAttackTargets(
            autofireAttackInfo,
            assignedShots,
        );
        autofireAttackInfo.targetIds = {};
        autofireAttackInfo.targets.forEach((target)=>{
            autofireAttackInfo.targetIds[target.target.id] = target;
        });
        return autofireAttackInfo;
    }
}
