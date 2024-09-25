import { calculateDistanceBetween } from "./range.mjs";

export class Attack {
    static async makeActionActiveEffects(action) {
        const cvModifiers = action.current.cvModifiers;
        const item = action.system.item[action.current.itemId];

        const actor = action.system.actor;
        Attack.removeActionActiveEffects(actor);
        cvModifiers.forEach((cvModifier) => {
            Attack.makeActionActiveEffect(action, cvModifier);
        });
    }
    // discontinue any effects for the action
    // action effects have a flag for actions only
    // they also get pulled in the start of turn (nextPhase flag)
    static async removeActionActiveEffects(actor) {
        const prevActiveEffects = actor.effects.filter((o) => o.flags.actionEffect);
        console.log(prevActiveEffects);
        for (const ae of prevActiveEffects) {
            await ae.delete();
        }
    }

    static async makeActionActiveEffect(action, cvModifier) {
        const actor = action.system.actor;

        // Estimate of how many seconds the DCV penalty lasts (until next phase).
        // In combat.js#_onStartTurn we remove this AE for exact timing.
        const seconds = Math.ceil(12 / parseInt(actor.system.characteristics.spd.value));

        const item = action.system.item[cvModifier.id];

        // changes include:
        //{ ocv, dcv, dc, dcvMultiplier, ocvMultiplier }
        let icon = "icons/svg/upgrade.svg";
        let label = `${cvModifier.name}`;
        let comma = false;
        const changes = [];
        if (cvModifier.cvMod.ocv) {
            const ocv = cvModifier.cvMod.ocv;
            if (ocv < 0) {
                icon = "icons/svg/downgrade.svg";
            }
            label += ` ${ocv.signedString()} OCV`;
            comma = true;
            changes.push({
                key: `system.characteristics.ocv.value`,
                value: ocv,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            });
        }
        if (cvModifier.cvMod.dcv) {
            const dcv = cvModifier.cvMod.dcv;
            if (dcv < 0) {
                icon = "icons/svg/downgrade.svg";
            }
            label += `${comma?',':''} ${dcv.signedString()} DCV`;
            comma = true;
            changes.push({
                key: `system.characteristics.dcv.value`,
                value: dcv,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            });
        }

        // if (cvModifier.cvMod.dc) {
        //     const dc = cvModifier.cvMod.dc;
        //     // changes.push({
        //     //     key: `system.characteristics.dcv.value`,
        //     //     value: cvModifier.cvMod.dcv,
        //     //     mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        //     // });
        // }
        
        // todo: this disallows setting the dcv to x0
        if (cvModifier.cvMod.dcvMultiplier && cvModifier.cvMod.dcvMultiplier != 1) {
            const dcvMultiplier = cvModifier.cvMod.dcvMultiplier;
            let multiplierString = `${dcvMultiplier}`;
            if (dcvMultiplier < 1) {
                icon = "icons/svg/downgrade.svg";
            }
            if(dcvMultiplier != 0 && dcvMultiplier < 1){
                multiplierString = `1/${1.0/dcvMultiplier}`;
            }
            label += `${comma?',':''} x${multiplierString} DCV`;
            changes.push({
                key: `system.characteristics.dcv.value`,
                value: cvModifier.cvMod.dcvMultiplier,
                mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
            });
        }
        if(changes.length < 1){
            console.warn("Effect would have no effect:", cvModifier);
            return;
        }
        let activeEffect = {
            label,
            icon,
            changes,
            origin: item.uuid,
            duration: {
                seconds,
            },
            flags: {
                nextPhase: true,
                actionEffect: true,
            },
        };
        await actor.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
    }

    static parseCvModifiers(OCV, DCV, DC) {
        let ocv = 0;
        let dcv = 0;
        let dc = 0;
        let dcvMultiplier = 1;
        let ocvMultiplier = 1;
        const ocvMod = Attack._parseCvModifier(OCV);
        const dcvMod = Attack._parseCvModifier(DCV);
        const dcMod = Attack._parseCvModifier(DC);

        if (ocvMod.isMultiplier) {
            ocvMultiplier = ocvMod.modifier;
        } else {
            ocv = ocvMod.modifier;
        }
        if (dcvMod.isMultiplier) {
            dcvMultiplier = dcvMod.modifier;
        } else {
            dcv = dcvMod.modifier;
        }
        dc = dcMod.modifier;

        return { ocv, dcv, dc, dcvMultiplier, ocvMultiplier };
    }

    static _parseCvModifier(modifierString) {
        const cvModifier = {
            modifier: 0,
            isMultiplier: false,
        };
        if (modifierString && (typeof modifierString === "string" || modifierString instanceof String)) {
            const divisorIndex = modifierString.indexOf("/");
            const isMultiplier = divisorIndex !== -1 && Number.isInteger(divisorIndex);
            cvModifier.modifier = parseInt(modifierString);
            if (!Number.isInteger(cvModifier.modifier)) {
                cvModifier.modifier = 0;
            } else if (isMultiplier && modifierString.length > divisorIndex + 1) {
                const divisor = parseInt(modifierString.slice(divisorIndex + 1));
                if (Number.isInteger(divisor) && divisor !== 0) {
                    cvModifier.modifier = cvModifier.modifier / divisor;
                    cvModifier.isMultiplier = true;
                }
            }
            if (!cvModifier.modifier) {
                cvModifier.modifier = 0;
                cvModifier.isMultiplier = false; // are there any times we modify to *0?
            }
        } else {
            if (Number.isInteger(modifierString)) {
                cvModifier.modifier = modifierString;
            }
        }
        return cvModifier;
    }

    static makeCvModifierFromItem(item, system, ocv, dcv, dc, dcvMultiplier) {
        if (!item) {
            console.log("no item");
        }
        // todo: refactor into an 'add to system'
        system.item[item.id] = item;
        if (item.system.cvModifiers === undefined) {
            item.system.cvModifiers = Attack.parseCvModifiers(item.system.OCV, item.system.DCV, item.system.DC);
        }

        // arguments passed in override the item default
        const cvMod = {
            ocv: ocv ?? item.system.cvModifiers.ocv,
            dcv: dcv ?? item.system.cvModifiers.dcv,
            dc: dc ?? item.system.cvModifiers.dc,
            dcvMultiplier: dcvMultiplier ?? item.system.cvModifiers.dcvMultiplier,
        };

        return Attack.makeCvModifier(cvMod, item.system.XMLID, item.name, item.id);
    }

    static makeCvModifier(cvMod, XMLID, name, id) {
        return { cvMod, XMLID, name, id };
    }

    static findStrikeKey(item) {
        // todo: if there is some character that doesn't have a STRIKE maneuver, then this find will fail.
        // if the character has been loaded from an HDC then they will have the default maneuvers
        // if they have not been loaded from and HDC they won't have multiple attack and shouldn't get here.
        let strike = item.actor.items.find((item) => "STRIKE" === item.system.XMLID);
        return strike?.id;
    }

    static addMultipleAttack(data) {
        if (!data.action?.maneuver?.attackKeys?.length) {
            return false;
        }
        const index = data.action.maneuver.attackKeys.length;
        const attackKey = `attack-${index}`;
        const itemKey = Attack.findStrikeKey(data.item);
        const targetKey = data.action.targetedTokens?.length ? data.action.targetedTokens[0].id : "NONE";
        const multipleAttackKeys = { itemKey, attackKey, targetKey };
        data.action.maneuver[attackKey] = multipleAttackKeys;
        data.action.maneuver.attackKeys.push(multipleAttackKeys);
        data.formData ??= {};
        data.action.maneuver.attackKeys.forEach((attackKeys) => {
            data.formData[`${attackKeys.attackKey}-target`] = attackKeys.targetKey;
            data.formData[attackKeys.attackKey] = attackKeys.itemKey;
        });
        return true;
    }

    static removeMultipleAttack(data, attackKey) {
        if (!data.action?.maneuver?.attackKeys?.length || !attackKey) {
            return false;
        }
        const indexToRemove = data.action.maneuver.attackKeys.findIndex((multipleAttackKeys) => {
            return multipleAttackKeys.attackKey === attackKey;
        });
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
            data.formData[`${attackKeys.attackKey}-target`] = attackKeys.targetKey;
            data.formData[attackKeys.attackKey] = attackKeys.itemKey;
        });
        return true;
    }

    static getAttackerToken(item) {
        const attackerToken = item.actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!attackerToken) {
            console.error("There is no actor token!");
        }
        return attackerToken;
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
                (item) => item.type == "maneuver" && item.name === "Brace" && item.system.active,
            );
            if (braceManeuver) {
                //TODO: ???
            }
            return Math.floor(rangePenalty);
        }
        return 0;
    }

    static getTargetInfo(item, targetedToken, options, system) {
        // these are the targeting data used for the attack(s)
        const target = {
            targetId: targetedToken.id,
            cvModifiers: [],
            results: [], // todo: for attacks that roll one effect and apply to multiple targets do something different here
        };

        target.range = calculateDistanceBetween(system.attackerToken, targetedToken);
        if (item) {
            target.cvModifiers.push(
                Attack.makeCvModifier(Attack.getRangeModifier(item, target.range), "RANGE", "Range Mod"),
            );
        }
        return target;
    }

    static getAttackInfo(item, targetedTokens, options, system) {
        const targets = [];
        for (let i = 0; i < targetedTokens.length; i++) {
            const target = Attack.getTargetInfo(item, targetedTokens[i], options, system);
            targets.push(target);
        }
        const attack = {
            itemId: item?.id,
            targets,
            cvModifiers: [],
        };
        return attack;
    }

    static getHaymakerAttackInfo(item, targetedTokens, options, system) {
        const attack = Attack.getAttackInfo(item, targetedTokens, options, system);
        return attack;
    }

    static getMultipleAttackManeuverInfo(item, targetedTokens, options, system) {
        // TODO: need to adjust DCV
        const maneuver = {
            attackerTokenId: system.attackerToken?.id ?? null,
            isMultipleAttack: true,
            itemId: item.id,
            cvModifiers: [],
        };
        if (options) {
            const keys = [];
            let count = 0;
            while (options[`attack-${count}`]) {
                const targetKey = options[`attack-${count}-target`];
                const attackKey = `attack-${count}`; // attackKey is 'attack-1' etc
                const itemKey = options[attackKey];
                const attackKeys = { itemKey, attackKey, targetKey };
                maneuver[attackKey] = attackKeys;
                keys.push(attackKeys);
                maneuver.attackKeys = keys;
                count++;
            }
        }
        // Initialize multiple attack to the default option values
        const itemKey = Attack.findStrikeKey(item);

        maneuver.attackKeys ??= targetedTokens.map((target, index) => {
            return {
                itemKey,
                attackKey: `attack-${index}`,
                targetKey: target.id,
            };
        });
        maneuver.attacks = [];
        const actor = item.actor;
        for (let i = 0; i < maneuver.attackKeys.length; i++) {
            const attackKeys = maneuver.attackKeys[i];
            maneuver[`attack-${i}`] = attackKeys;
            const multiAttackItem = actor.items.get(attackKeys.itemKey);
            let multiAttackTarget = system.targetedTokens.find((target) => attackKeys.targetKey === target.id);
            multiAttackTarget ??= system.targetedTokens[0];
            maneuver.attacks.push(Attack.getAttackInfo(multiAttackItem, [multiAttackTarget], options, system));
        }
        // per rules every attack after the first is a cumulative -2 OCV on all attacks
        maneuver.cvMod = Attack.makeCvModifierFromItem(item, system, Math.max(maneuver.attacks.length - 1, 0) * -2);

        return maneuver;
    }

    static getHaymakerManeuverInfo(item, targetedTokens, options, system) {
        const attacks = [Attack.getHaymakerAttackInfo(item, targetedTokens, options, system)];
        return {
            attackerTokenId: system.attackerToken?.id ?? null,
            isHaymakerAttack: true,
            attacks,
            itemId: item.id,
            cvModifiers: [],
        };
    }

    static getManeuverInfo(item, targetedTokens, options, system) {
        const isMultipleAttack = item.system.XMLID === "MULTIPLEATTACK";
        const isHaymakerAttack = item.system.XMLID === "HAYMAKER";
        // todo: Combined Attack
        // todo: martial maneuver plus a weapon
        // todo: Compound Power
        // answer: probably a specialized use case of multiple attack

        if (isMultipleAttack) {
            return Attack.getMultipleAttackManeuverInfo(item, targetedTokens, options, system);
        }
        if (isHaymakerAttack) {
            return Attack.getHaymakerManeuverInfo(item, targetedTokens, options, system);
        }
        return {
            attackerTokenId: system.attackerToken?.id ?? null,
            attacks: [Attack.getAttackInfo(item, targetedTokens, options, system)],
            itemId: item.id,
            cvModifiers: [],
        };
    }

    static getCurrentManeuverInfo(maneuver, options, system) {
        if (options?.execute !== undefined && maneuver.isMultipleAttack) {
            let lastAttackHit = true;
            options?.rolledResult?.forEach((roll) => {
                if (roll.result.hit === "Miss") {
                    lastAttackHit = false;
                }
            });
            let execute = options.execute;
            if (lastAttackHit === false) {
                const attackKey = `attack-${execute - 1}`;
                const attackKeys = maneuver[attackKey];
                const maneuverItem = system.attackerToken.actor.items.get(attackKeys.itemKey);
                const maneuverTarget = system.targetedTokens.find((token) => token.id === attackKeys.targetKey);
                maneuver.missed = {
                    execute,
                    targetName: maneuverTarget.name,
                    itemName: maneuverItem.name,
                };
                return maneuver;
            }
            const attackKey = `attack-${execute}`;
            const attackKeys = maneuver[attackKey];
            const maneuverItem = system.attackerToken.actor.items.get(attackKeys.itemKey);
            const maneuverTarget = system.targetedTokens.find((token) => token.id === attackKeys.targetKey);
            const current = this.getManeuverInfo(maneuverItem, [maneuverTarget], options, system);
            current.execute = execute;
            current.step = attackKey;

            // avoid saving forge objects, except in system
            system.item[maneuverItem.id] = maneuverItem;
            system.currentItem = maneuverItem;
            system.currentTargets = [maneuverTarget];

            const multipleAttackItem = system.item[maneuver.itemId];
            const xmlid = multipleAttackItem.system.XMLID;
            // keep range mods to ourselves until we can agree on a single solution
            // current.attacks.forEach((attack)=>{ attack.targets.forEach((target)=>{
            //     current.ocvModifiers = [].concat(current.ocvModifiers, target.ocvModifiers );
            // }); });
            current.cvModifiers.push(maneuver.cvMod);
            return current;
        }
        return maneuver;
    }

    static getActionInfo(item, targetedTokens, options) {
        // do I need to safety things here?
        if (!item) {
            console.error("There is no attack item!");
            return null;
        }
        const attackerToken = Attack.getAttackerToken(item);
        const system = {
            actor: item.actor,
            attackerToken,
            currentItem: item,
            currentTargets: targetedTokens,
            targetedTokens,
            item: {},
            token: {},
        };
        system.item[item.id] = item;
        system.token[attackerToken.id] = attackerToken;
        for (let i = 0; i < targetedTokens.length; i++) {
            system.token[targetedTokens[i].id] = targetedTokens[i];
        }

        const maneuver = Attack.getManeuverInfo(item, targetedTokens, options, system); // this.getManeuverInfo(item, targetedTokens, formData);
        const current = Attack.getCurrentManeuverInfo(maneuver, options, system); // get current attack as a 'maneuver' with just the currently executing attack options
        const action = {
            maneuver,
            current,
            system,
        };
        return action;
    }
}
