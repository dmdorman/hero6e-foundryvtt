import { CombatSkillLevelsForAttack } from "../utility/damage.mjs";
import {
    _processAttackOptions,
    _processAttackAoeOptions,
} from "../item/item-attack.mjs";
import {
    convertSystemUnitsToMetres,
    getSystemDisplayUnits,
} from "../utility/units.mjs";
import { HEROSYS } from "../herosystem6e.mjs";

const heroAoeTypeToFoundryAoeTypeConversions = {
    any: "rect",
    cone: "cone",
    hex: "circle",
    line: "ray",
    radius: "circle",
    surface: "rect",
};

export class ItemAttackFormApplication extends FormApplication {
    constructor(data) {
        super();
        this.data = data;
        this.options.title = `${this.data?.item?.actor?.name} roll to hit`;

        Hooks.on(
            "updateItem",
            function (item, changes, options, userId) {
                if (!this.rendered) return;

                if (item.id === this.data.item.id) {
                    this.updateItem(item, changes, options, userId);
                }

                const cslSkill = CombatSkillLevelsForAttack(
                    this.data.item,
                ).skill;
                if (cslSkill && item.id === cslSkill.id) {
                    this.updateItem(item, changes, options, userId);
                }
                if (!cslSkill && data.cslSkill) {
                    this.updateItem(item, changes, options, userId);
                }
            }.bind(this),
        );

        Hooks.on(
            "targetToken",
            function (...args) {
                this.updateItem(...args);
            }.bind(this),
        );
    }

    async updateItem() {
        this.render();
    }

    static get defaultOptions() {
        let options = super.defaultOptions;
        options = mergeObject(options, {
            classes: ["form"],
            popOut: true,
            template: `systems/${HEROSYS.module}/templates/attack/item-attack-application.hbs`,
            id: "item-attack-form-application",
            closeOnSubmit: false, // do not close when submitted
            submitOnChange: true, // submit when any input changes
            width: "400",
        });

        return options;
    }

    getData() {
        const data = this.data;
        const item = data.item;
        // move the stuff from item-attack.mjs so the data has one source of truth
        data.targets = Array.from(game.user.targets);
        console.log("RWC AttackOptions(item)", item);
        console.log("RWC data.targets:", data.targets);
        for (const target of data.targets) {
            console.log("RWC Target token name:", target.name);
            console.log(
                `RWC Target location: ${target.transform.worldTransform.tx}/${target.transform.worldTransform.ty}`,
            );
        }
        const autofireAttackInfo =
            ItemAttackFormApplication.getAutofireAttackInfo(
                item,
                data.targets,
                data.autofireAttackInfo,
            );
        data.autofireAttackInfo = autofireAttackInfo;
        const oldReason = data.cannotAttack;
        data.cannotAttack = ItemAttackFormApplication.getReasonCannotAttack(
            item,
            data.targets,
            autofireAttackInfo,
        );
        if (data.cannotAttack && data.cannotAttack !== oldReason) {
            console.log("cannot make attack because ", data.cannotAttack);
            ui.notifications.warn(data.cannotAttack); // we will also add the reason to not attack into the option box
        }

        const aoe = item.getAoeModifier();
        if (aoe) {
            data.aoeText = aoe.OPTION_ALIAS;
            if (!item.system.areaOfEffect) {
                ui.notifications.error(
                    `${
                        item.system.ALIAS || item.name
                    } has invalid AOE definition.`,
                );
            }
            const levels = item.system.areaOfEffect.value; //parseInt(aoe.LEVELS) || parseInt(aoe.levels);
            if (levels) {
                data.aoeText += ` (${levels}${getSystemDisplayUnits(
                    item.actor,
                )})`;
            }

            if (this.getAoeTemplate() || game.user.targets.size > 0) {
                data.noTargets = false;
            } else {
                data.noTargets = true;
            }
        } else {
            data.noTargets = game.user.targets.size === 0;
            data.aoeText = null;
        }

        // Initialize aim to the default option values
        this.data.aim ??= "none";
        this.data.aimSide ??= "none";

        data.ocvMod ??= item.system.ocv;
        data.dcvMod ??= item.system.dcv;
        data.effectiveStr ??= data.str;

        // Boostable Charges
        if (item.system.charges?.value > 1 && item.system.charges?.boostable) {
            data.boostableCharges = item.system.charges.value - 1;
        }

        // Combat Skill Levels
        const csl = CombatSkillLevelsForAttack(item);
        if (csl && csl.skill) {
            data.cslSkill = csl.skill;
            let mental = csl.skill.system.XMLID === "MENTAL_COMBAT_LEVELS";
            let _ocv = mental ? "omcv" : "ocv";
            let _dcv = mental ? "dmcv" : "dcv";
            data.cslChoices = { [_ocv]: _ocv };
            if (csl.skill.system.OPTION != "SINGLE") {
                data.cslChoices[_dcv] = _dcv;
                data.cslChoices.dc = "dc";
            }

            // CSL radioBoxes names
            data.csl = [];
            for (let c = 0; c < parseInt(csl.skill.system.LEVELS || 0); c++) {
                data.csl.push({
                    name: `system.csl.${c}`,
                    value: csl.skill.system.csl
                        ? csl.skill.system.csl[c]
                        : "undefined",
                });
            }
        } else {
            data.cslChoices = null;
            data.csl = null;
            data.cslSkill = null;
        }

        // DEADLYBLOW
        const DEADLYBLOW = item.actor.items.find(
            (o) => o.system.XMLID === "DEADLYBLOW",
        );
        if (DEADLYBLOW) {
            item.system.conditionalAttacks ??= {};
            item.system.conditionalAttacks[DEADLYBLOW.id] ??= {
                ...DEADLYBLOW,
                id: DEADLYBLOW.id,
            };
            item.system.conditionalAttacks[DEADLYBLOW.id].checked ??= true;
        }

        console.log("RWC getData: ", data);
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
    }

    async _render(...args) {
        await super._render(...args);

        // CSL can cause differences in form size.
        if (this.position && this.rendered) {
            this.setPosition({ height: "auto" });
        }
    }

    async _updateObject(event, formData) {
        // changes to the form pass through here
        if (event.submitter?.name === "roll") {
            canvas.tokens.activate();
            await this.close();

            const aoe = this.data.item.getAoeModifier();
            if (aoe) {
                return _processAttackAoeOptions(this.data.item, formData);
            }

            return _processAttackOptions(this.data.item, formData);
        }

        if (event.submitter?.name === "aoe") {
            return this._spawnAreaOfEffect(this.data);
        }
        // collect the changed shots on target
        if (this.data.autofireAttackInfo) {
            this.data.autofireAttackInfo.targets.map((target) => {
                const shotValue = parseInt(
                    formData[target.shots_on_target_id].match(/\d+/),
                );
                if (!isNaN(shotValue)) {
                    target.shotsOnTarget = shotValue;
                }
            });
        }

        this._updateCsl(event, formData);

        this.data.aim = formData.aim;
        this.data.aimSide = formData.aimSide;

        this.data.ocvMod = formData.ocvMod;
        this.data.dcvMod = formData.dcvMod;

        this.data.effectiveStr = formData.effectiveStr;
        if (this.data.boostableCharges) {
            this.data.boostableCharges = Math.max(
                0,
                Math.min(
                    parseInt(formData.boostableCharges),
                    this.data.item.charges?.value - 1,
                ),
            );
        }

        this.data.velocity = parseInt(formData.velocity || 0);

        // Save conditionalAttack check
        const expandedData = foundry.utils.expandObject(formData);
        for (const ca in expandedData?.system?.conditionalAttacks) {
            console.log(ca);
            this.data.item.system.conditionalAttacks[ca].checked =
                expandedData.system.conditionalAttacks[ca].checked;
            await this.data.item.update({
                [`system.conditionalAttacks`]:
                    this.data.item.system.conditionalAttacks,
            });
        }

        // Show any changes
        //this.render();
    }

    async _updateCsl(event, formData) {
        const item = this.data.item;
        // Combat Skill Levels (update SKILL if changed)
        const csl = CombatSkillLevelsForAttack(item);
        for (const key of Object.keys(formData).filter((o) =>
            o.match(/\.(\w+)\.(\d+)/),
        )) {
            const value = formData[key];
            const idx = parseInt(key.match(/\d+$/));
            if (csl.skill.system.csl[idx] != value) {
                csl.skill.system.csl[idx] = value;
                await csl.skill.update({ "system.csl": csl.skill.system.csl });
            }
        }
    }

    async _spawnAreaOfEffect() {
        const item = this.data.item;
        const aoeModifier = item.getAoeModifier();
        const areaOfEffect = item.system.areaOfEffect;
        if (!aoeModifier || !areaOfEffect) return;

        const aoeType = aoeModifier.OPTION.toLowerCase();
        const aoeValue = areaOfEffect.value;

        const actor = item.actor;
        const token = actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!token) {
            return ui.notifications.error(
                `${actor.name} has no token in this scene.  Unable to place AOE template.`,
            );
        }

        // Close all windows except us
        for (let id of Object.keys(ui.windows)) {
            if (id != this.appId) {
                ui.windows[id].close();
            }
        }

        const templateType = heroAoeTypeToFoundryAoeTypeConversions[aoeType];
        const sizeConversionToMeters = convertSystemUnitsToMetres(1, actor);

        // TODO: We need to have custom templates as shapes should be hex counted (a circle looks like a hexagon plotted on hex grid).
        //       Circle and cone are the most broken. The values we're providing using a gridless geometric circle or cone approximate the
        //       right thing when we're dealing with fewer than 7 hexes and start to fall apart after that.
        // NOTE: the hex that the actor is in should count as a distance of 1"/2m. This means that to convert to what FoundryVTT expects
        //       for distance we need to subtract 2m, and add a very small amount for rounding in attacker's favour, to approximate
        //       correctness. It is not, however, "correct" as that would require hex counting.
        const distance = Math.max(
            1.01,
            aoeValue * sizeConversionToMeters - 1.99,
        );

        const templateData = {
            t: templateType,
            user: game.user.id,
            distance: distance,
            direction: -token.document?.rotation || 0 + 90, // Top down tokens typically face south
            fillColor: game.user.color,
            flags: {
                itemId: item.id,
                item: item,
                actor: item.actor,
                aoeType,
                aoeValue,
                sizeConversionToMeters,
            },
        };

        switch (templateType) {
            case "circle":
                break;

            case "cone":
                {
                    // TODO: Technically, following rules as written, cones should have a flat end. However,
                    //       it doesn't make sense to change cones until we have "flat"/hex counted circles as
                    //       the shapes should be consistent.
                    if (
                        (aoeModifier.adders || []).find(
                            (adder) => adder.XMLID === "THINCONE",
                        )
                    ) {
                        // TODO: The extra 1 degree helps with approximating the correct hex counts when not
                        //       not oriented in one of the prime 6 directions. This is because we're not
                        //       hex counting. The extra degree is more incorrect the larger the cone is.
                        templateData.angle = 31;
                    } else {
                        // TODO: The extra 1 degree helps with approximating the correct hex counts when not
                        //       not oriented in one of the prime 6 directions. This is because we're not
                        //       hex counting. The extra degree is more incorrect the larger the cone is.
                        templateData.angle = 61;
                    }
                }

                break;

            case "ray":
                {
                    templateData.width =
                        sizeConversionToMeters * areaOfEffect.width;
                    templateData.flags.width = areaOfEffect.width;
                    templateData.flags.height = areaOfEffect.height;
                }
                break;

            case "rect": {
                const warningMessage = game.i18n.localize(
                    "Warning.AreaOfEffectUnsupported",
                );

                ui.notifications.warn(warningMessage);

                return;
            }

            default:
                console.error(`unsupported template type ${templateType}`);
                break;
        }

        templateData.x = token.center.x;
        templateData.y = token.center.y;

        const existingTemplate = this.getAoeTemplate();
        if (existingTemplate) {
            // reuse exiting template, just update position
            await existingTemplate.update({
                x: templateData.x,
                y: templateData.y,
            });
        } else {
            canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [
                templateData,
            ]);
        }

        canvas.templates.activate({ tool: templateType });
        canvas.templates.selectObjects({
            x: templateData.x,
            y: templateData.y,
            releaseOthers: true,
            control: true,
            toggle: false,
        });
    }

    getAoeTemplate() {
        return Array.from(canvas.templates.getDocuments()).find(
            (o) =>
                o.user.id === game.user.id &&
                o.flags.itemId === this.data.item.id,
        );
    }

    static _itemUsesMultipleTargets(item) {
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
            return rangePenalty;
        }
        return 0;
    }

    static getReasonCannotAttack(item, targetsArray) {
        let reason = item.actor.getTheReasonCannotAct();
        if (reason) {
            return reason;
        }
        const actingToken = item.actor.getActiveTokens()[0];

        if (
            targetsArray.length > 1 &&
            !ItemAttackFormApplication._itemUsesMultipleTargets(item)
        ) {
            return `${actingToken.name} has ${targetsArray.length} targets selected and ${item.name} supports only one.`;
        }

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
                const autofire = item.findModsByXmlid("AUTOFIRE");
                const isAutofire = !!autofire;
                if (isAutofire && targetsArray.length > 1) {
                    // TODO autofire + number of shots fired per phase
                    console.log(
                        `RWC autofire  ${autofire} look for shots per phase`,
                    );
                    let totalSkippedMeters = 0;
                    for (let i = 1; i < targetsArray.length; i++) {
                        let prevTarget = targetsArray[i - 1];
                        let target = targetsArray[i];
                        let skippedMeters = canvas.grid.measureDistance(
                            prevTarget,
                            target,
                            { gridSpaces: true },
                        );
                        totalSkippedMeters += skippedMeters;
                        console.log(
                            `skip ${skippedMeters} meters between ${prevTarget.name} and ${target.name}`,
                        );
                    }
                    console.log(
                        `total skipped meters ${totalSkippedMeters} meters`,
                    );
                    console.log(
                        `Uses additional ${totalSkippedMeters / 2} shots`,
                    );
                    // TODO autofire + empty spaces + charges
                }
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

    static getAutofireAttackInfo(item, targetedTokens, oldAutofireAttackInfo) {
        const autofire = item.findModsByXmlid("AUTOFIRE");
        if (!autofire || targetedTokens.length === 0) {
            return null;
        }

        const attacker =
            item.actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!attacker) return; // todo: message?

        // TODO: also need to pull from the form data
        const autoFireShots = autofire
            ? parseInt(autofire.OPTION_ALIAS.match(/\d+/))
            : 0;

        const autofireSkills = item.actor.items
            .filter((skill) => "AUTOFIRE_SKILLS" === skill.system.XMLID)
            .map((skill) => skill.system.OPTION);

        // use the form values for number of shots _unless_ they are switching to/from one target
        const assignedShots = {};
        if (oldAutofireAttackInfo) {
            if (
                oldAutofireAttackInfo.targets.length > 1 ==
                targetedTokens.length > 1
            ) {
                oldAutofireAttackInfo.targets.forEach((target) => {
                    assignedShots[target.target.id] = target.shotsOnTarget;
                });
            }
        }

        const autofireAttackInfo = {
            item,
            autofire,
            targetedTokens,
            charges: item.system.charges,
            shotsFired: autoFireShots,
            autofireSkills,
        };
        const targets = [];
        let totalSkippedMeters = 0;
        // single target
        if (targetedTokens.length === 1) {
            let shotsOnTarget = autoFireShots;
            if (assignedShots[targetedTokens[0].id]) {
                shotsOnTarget = assignedShots[targetedTokens[0].id];
            }
            const range = canvas.grid.measureDistance(
                attacker,
                targetedTokens[0],
                { gridSpaces: true },
            );
            // add our target manager
            targets.push({
                target: targetedTokens[0],
                shotsOnTarget,
                range,
                ocv: ItemAttackFormApplication.getRangeModifier(item, range),
            });
        } else {
            // multiple targets
            for (let i = 0; i < targetedTokens.length; i++) {
                let shotsOnTarget = 1; // for now...
                if (assignedShots[targetedTokens[i].id]) {
                    shotsOnTarget = assignedShots[targetedTokens[i].id];
                }
                // these are the targeting data used for the attack(s)
                const targetingData = {
                    target: targetedTokens[i],
                    shotsOnTarget,
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
                    targetingData.skippedShots = skippedMeters / 2 - 1; //todo: check zero
                } else {
                    targetingData.skippedMeters = 0;
                    targetingData.skippedShots = 0;
                }
                targetingData.range = canvas.grid.measureDistance(
                    attacker,
                    targetedTokens[i],
                    { gridSpaces: true },
                );
                targetingData.ocv = ItemAttackFormApplication.getRangeModifier(
                    item,
                    targetingData.range,
                );
                targets.push(targetingData);
            }
        }
        autofireAttackInfo.targets = targets;
        autofireAttackInfo.autofireOCV = -totalSkippedMeters / 2;

        return autofireAttackInfo;
    }
}
window.ItemAttackFormApplication = ItemAttackFormApplication;
