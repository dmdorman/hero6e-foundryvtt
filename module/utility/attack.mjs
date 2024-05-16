export class Attack {
    static getReasonCannotAttack(item, targetsArray, autofireAttackInfo) {
        let reason = item.actor.getTheReasonCannotAct();
        if (reason) {
            return reason;
        }
        if (item.system.XMLID === "MULTIPLEATTACK") {
            return null;
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
        const targetedTokens = autofireAttackInfo.system.targetedTokens;
        const system = autofireAttackInfo.system;
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
                system,
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
                system.attacker,
                targetedTokens[i],
                { gridSpaces: true },
            );
            targetingData.ocv = Attack.getRangeModifier(
                system.item,
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
    static getAutofireAttackTargetsNew(autofireAttackInfo, formData) {
        const autofire = autofireAttackInfo.autofire;
        const targetedTokens = autofireAttackInfo.system.targetedTokens;
        const system = autofireAttackInfo.system;
        const autofireSkills = autofire.autofireSkills;
        const targets = [];
        let totalSkippedMeters = 0;
        autofire.singleTarget = targetedTokens.length === 1;

        const assignedShots = {};
        // use the form values for number of shots _unless_ they are switching to/from one target
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
                system,
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
                system.attacker,
                targetedTokens[i],
                { gridSpaces: true },
            );
            targetingData.ocv = Attack.getRangeModifier(
                system.item,
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

    static getAutofireAttackInfoNew(item, targetedTokens, formData) {
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

        const system = {
            item,
            attacker,
            targetedTokens,
        }; // system attack info

        const autofire = {
            autofireMod,
            autofireSkills,
            autoFireShots,
            totalShotsFired: 0,
            totalShotsSkipped: 0,
            autofireOCV: 0,
        }; // autofire attack info

        const autofireAttackInfo = {
            system,
            autofire,
            charges: item.system.charges,
        };

        // use the form values for number of shots _unless_ they are switching to/from one target
        const assignedShots = {};
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
        autofireAttackInfo.targets = Attack.getAutofireAttackTargetsNew(
            autofireAttackInfo,
            formData,
        );
        autofireAttackInfo.targetIds = {};
        autofireAttackInfo.targets.forEach((target) => {
            autofireAttackInfo.targetIds[target.target.id] = target;
        });
        return autofireAttackInfo;
    }

    // eslint-disable-next-line no-unused-vars
    static getAttackActionTargetInfo(item, targetedTokens, formData) {
        const targets = [];
        const attacker =
            item.actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        const system = {
            item,
            attacker,
            targetedTokens,
        }; // system attack info

        for (let i = 0; i < targetedTokens.length; i++) {
            // these are the targeting data used for the attack(s)
            const targetingData = {
                system,
                target: targetedTokens[i],
                results: [],
            };
            targetingData.range = canvas.grid.measureDistance(
                system.attacker,
                targetedTokens[i],
                { gridSpaces: true },
            );
            targetingData.ocv = Attack.getRangeModifier(
                system.item,
                targetingData.range,
            );
            targets.push(targetingData);
        }
        return targets;
    }

    static getAttackActionItemInfo(item, targetedTokens, formData) {
        const autofireAttackInfo = Attack.getAutofireAttackInfoNew(
            item,
            targetedTokens,
            formData,
        );

        const targets = autofireAttackInfo
            ? Attack.getAutofireAttackTargetsNew(autofireAttackInfo, formData)
            : Attack.getAttackActionTargetInfo(item, targetedTokens, formData);

        // TODO: not sure now about saving the item here; maybe just the id?
        // and what are we doing with targets? should there just be one or zero now, unless it's AoE?
        const attackActionItemInfo = {
            item,
            targets,
            autofire: autofireAttackInfo,
        };
        return attackActionItemInfo;
    }

    static addMultipleAttack(data) {
        if (!data.action?.maneuver?.attackKeys?.length) {
            return false;
        }
        const index = data.action.maneuver.attackKeys.length;
        const attackKey = `attack-${index}`;
        const itemKey = data.item.actor.items.find(
            (item) => "STRIKE" === item.system.XMLID,
        ).id;
        const targetKey = data.action.targetedTokens?.length
            ? data.action.targetedTokens[0].id
            : "NONE";
        const multipleAttackKeys = { itemKey, attackKey, targetKey };
        data.action.maneuver[attackKey] = multipleAttackKeys;
        data.action.maneuver.attackKeys.push(multipleAttackKeys);
        data.formData ??= {};
        data.action.maneuver.attackKeys.forEach((attackKeys) => {
            data.formData[`${attackKeys.attackKey}-target`] =
                attackKeys.targetKey;
            data.formData[attackKeys.attackKey] = attackKeys.itemKey;
        });
        return true;
    }

    static trashMultipleAttack(data, attackKey) {
        if (!data.action?.maneuver?.attackKeys?.length || !attackKey) {
            return false;
        }
        console.log(`trash ${attackKey}`);
        console.log(`data:`, data);
        const indexToRemove = data.action.maneuver.attackKeys.findIndex(
            (multipleAttackKeys) => {
                return multipleAttackKeys.attackKey === attackKey;
            },
        );
        data.action.maneuver.attackKeys.splice(indexToRemove, 1);
        // all the info is in the array; reconstruct the properties
        const keyToRemove = `attack-${data.action.maneuver.attackKeys.length}`;
        delete data.action.maneuver[keyToRemove];
        for (let i = 0; i < data.action.maneuver.attackKeys.length; i++) {
            const multipleAttackKeys = data.action.maneuver.attackKeys[i];
            const attackKey = `attack-${i}`;
            multipleAttackKeys.attackKey = attackKey;
            data[attackKey] = multipleAttackKeys;
        }
        data.formData ??= {};
        if (data.formData[keyToRemove]) {
            delete data.formData[keyToRemove];
        }
        if (data.formData[`${keyToRemove}-target`]) {
            delete data.formData[`${keyToRemove}-target`];
        }
        data.action.maneuver.attackKeys.forEach((attackKeys) => {
            data.formData[`${attackKeys.attackKey}-target`] =
                attackKeys.targetKey;
            data.formData[attackKeys.attackKey] = attackKeys.itemKey;
        });
        console.log(`data:`, data);
        return true;
    }

    static getMultipleAttackManeuver(item, targetedTokens, formData) {
        const isMultipleAttack = item.system.XMLID === "MULTIPLEATTACK";
        if (!isMultipleAttack) return null;
        const multipleAttackManeuver = {
            isMultipleAttack,
        };
        if (formData) {
            const keys = [];
            let count = 0;
            while (formData[`attack-${count}`]) {
                const targetKey = formData[`attack-${count}-target`];
                const attackKey = `attack-${count}`; // attackKey is 'attack-1' etc
                const itemKey = formData[attackKey];
                const attackKeys = { itemKey, attackKey, targetKey };
                multipleAttackManeuver[attackKey] = attackKeys;
                keys.push(attackKeys);
                multipleAttackManeuver.attackKeys = keys;
                count++;
            }
        }
        // Initialize multiple attack to the default option values
        multipleAttackManeuver.attackKeys ??= targetedTokens.map(
            (target, index) => {
                return {
                    itemKey: item.actor.items.find(
                        (item) => "STRIKE" === item.system.XMLID,
                    ).id,
                    attackKey: `attack-${index}`,
                    targetKey: target.id,
                };
            },
        );
        multipleAttackManeuver.attacks = [];
        const actor = item.actor;
        for (let i = 0; i < multipleAttackManeuver.attackKeys.length; i++) {
            const attackKeys = multipleAttackManeuver.attackKeys[i];
            multipleAttackManeuver[`attack-${i}`] = attackKeys;
            const multiAttackItem = actor.items.get(attackKeys.itemKey);
            const multiAttackTarget = targetedTokens.find(
                (target) => attackKeys.targetKey === target.id,
            );
            multipleAttackManeuver.attacks.push(
                Attack.getAttackActionItemInfo(
                    multiAttackItem,
                    [multiAttackTarget],
                    formData,
                ),
            );
        }
        return multipleAttackManeuver;
    }

    static getManeuverInfo(item, targetedTokens, formData) {
        let multipleAttackInfo = Attack.getMultipleAttackManeuver(
            item,
            targetedTokens,
            formData,
        );
        if (multipleAttackInfo) {
            return multipleAttackInfo;
        }
        return {
            attacks: [
                Attack.getAttackActionItemInfo(item, targetedTokens, formData),
            ],
        };
    }

    static getAttackActionInfo(item, targetedTokens, formData) {
        const attacker =
            item.actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!attacker) {
            console.error("There is no actor token!");
            return null;
        }
        const attackerId = attacker.id;
        // console.log("getAttackActionInfo form:", formData);
        // const system = {
        //     attacker,
        //     item,
        //     targetedTokens,
        // };
        const maneuver = this.getManeuverInfo(item, targetedTokens, formData);
        const current = {
            maneuver,
            attackerId,
            item,
        };
        const action = {
            maneuver,
            attackerId,
            current,
        };
        // overwrite the maneuver for multiple attacks
        if (
            formData?.execute !== undefined &&
            action.maneuver.isMultipleAttack
        ) {
            const attackKey = `attack-${formData.execute}`;
            const attackKeys = action.maneuver[attackKey];
            const maneuverItem = item.actor.items.get(attackKeys.itemKey);
            const maneuverTarget = targetedTokens.find(
                (token) => token.id === attackKeys.targetKey,
            );
            action.current.maneuver = this.getManeuverInfo(
                maneuverItem,
                [maneuverTarget],
                formData,
            );
            action.current.execute = formData.execute;
            action.current.step = attackKey;
            action.current.item = maneuverItem;
        }

        console.log("RWC AttackActionInfo :", action);
        return action;
    }
}
