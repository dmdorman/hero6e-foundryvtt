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
import { Attack } from "../utility/attack.mjs";

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
            return Math.floor(rangePenalty);
        }
        return 0;
    }

    async updateItem() {
        this.render();
    }

    getData() {
        const data = this.data;
        const item = data.item;
        const targets = Array.from(game.user.targets);

        // move the stuff from item-attack.mjs so the data has one source of truth
        data.targets = targets;
        this.data.action = Attack.getAttackActionInfo(
            item,
            targets,
            data.formData,
        );

        const autofireAttackInfo = Attack.getAutofireAttackInfoNew(
            item,
            data.targets,
            data.formData,
        );
        data.autofireAttackInfo = autofireAttackInfo;
        const oldReason = data.cannotAttack;
        data.cannotAttack = Attack.getReasonCannotAttack(
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
        // add to multiattack
        html.find(".add-multiattack").click(this._onAddMultiAttack.bind(this));
        html.find(".trash-multiattack").click(
            this._onTrashMultiAttack.bind(this),
        );
    }

    async _onAddMultiAttack() {
        if (Attack.addMultipleAttack(this.data)) {
            this.render();
        }
    }

    async _onTrashMultiAttack(event) {
        const multipleAttackKey = event.target.dataset.multiattack;
        if (Attack.trashMultipleAttack(this.data, multipleAttackKey)) {
            this.render();
        }
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
            // this will close the window when we press "Roll to Hit"
            await this.close();
            return _processAttackOptions(this.data.item, formData);
        }
        this.data.formData ??= {};
        if (event.submitter?.name === "executeMultiattack") {
            const begin = this.data.action.current.execute === undefined;
            // we pressed the button to execute multiple attacks
            // the first time does not get a roll, but sets up the first attack
            if (begin) {
                this.data.formData.execute = 0;
            } else {
                // the subsequent presses will roll the attack and set up the next attack
                // this is the roll:
                await _processAttackOptions(this.data.item, this.data.formData);
                this.data.formData.execute =
                    this.data.action.current.execute + 1;
            }
            const end =
                this.data.formData.execute >=
                this.data.action.maneuver.attackKeys.length;
            // this is the last step
            if (end) {
                canvas.tokens.activate();
                await this.close();
            } else {
                return await new ItemAttackFormApplication(this.data).render(
                    true,
                );
            }
        }

        if (event.submitter?.name === "cancelMultiattack") {
            canvas.tokens.activate();
            await this.close();
            return;
        }

        if (event.submitter?.name === "aoe") {
            return this._spawnAreaOfEffect(this.data);
        }
        // collect the changed data; all of these changes can go into get data
        this.data.formData = { ...formData };

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

    // todo: maybe I can make this more generic? getAttack Info? use a similar targets structure for other attacks
    //  oldAutofireAttackInfo, attackToHitOptions contain the same information that I want
    // collect the data from options into a structure for passing around so it can be the same
    // put all the relevant infor into each target info so they are independent

    getAoeTemplate() {
        return Array.from(canvas.templates.getDocuments()).find(
            (o) =>
                o.user.id === game.user.id &&
                o.flags.itemId === this.data.item.id,
        );
    }
}

window.ItemAttackFormApplication = ItemAttackFormApplication;
