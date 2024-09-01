import { CombatSkillLevelsForAttack } from "../utility/damage.mjs";
import { _processAttackOptions } from "../item/item-attack.mjs";
import { convertSystemUnitsToMetres, getSystemDisplayUnits } from "../utility/units.mjs";
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
/* *
 * uses ../templates/attack/item-attack-application.hbs
 * */
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

                const cslSkill = CombatSkillLevelsForAttack(this.data.item).skill;
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
            async function (...args) {
                window.setTimeout(() => this.updateItem(...args), 1);
                // await this.updateItem(...args);
            }.bind(this),
        );

        Hooks.on(
            "controlToken",
            async function (...args) {
                window.setTimeout(() => this.updateItem(...args), 1);
                // await this.updateItem(...args);
            }.bind(this),
        );
    }

    async updateItem() {
        await this.render();
    }

    static get defaultOptions() {
        let options = super.defaultOptions;
        options = foundry.utils.mergeObject(options, {
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

        data.targets = game.user.targets;
        data.targets = Array.from(game.user.targets);

        if (data.targets.length === 0 && item.system.XMLID === "MINDSCAN" && game.user.isGM) {
            data.targets = foundry.utils
                .deepClone(canvas.tokens.controlled)
                .filter((t) => t.actor?.id != item.actor?.id);
        }

        // Initialize aim to the default option values
        this.data.aim ??= "none";
        this.data.aimSide ??= "none";

        data.ocvMod ??= item.system.ocv;
        data.dcvMod ??= item.system.dcv;
        data.omcvMod ??= item.system.ocv; //TODO: May need to make a distincsion between OCV/OMCV
        data.dmcvMod ??= item.system.dcv;
        data.effectiveStr ??= data.str;
        data.effectiveLevels ??= data.item.system.LEVELS;

        // let effectiveItem = item;

        // // Create a temporary item based on effectiveLevels
        // if (data.effectiveLevels && parseInt(item.system.LEVELS) > 0) {
        //     data.effectiveLevels = parseInt(data.effectiveLevels) || 0;
        //     if (data.effectiveLevels > 0 && data.effectiveLevels !== parseInt(item.system.LEVELS)) {
        //         const effectiveItemData = item.toObject();
        //         effectiveItemData.system.LEVELS = data.effectiveLevels;
        //         effectiveItem = await HeroSystem6eItem.create(effectiveItemData, { temporary: true });
        //         await effectiveItem._postUpload();
        //     }
        // }

        const aoe = item.AoeAttackParameters({ levels: data.effectiveLevels }); //  getAoeModifier();
        if (aoe) {
            data.aoeText = aoe.OPTION_ALIAS;
            // if (!item.system.areaOfEffect) {
            //     ui.notifications.error(`${item.system.ALIAS || item.name} has invalid AOE definition.`);
            // }
            const levels = aoe.value; //item.system.areaOfEffect.value; //parseInt(aoe.LEVELS) || parseInt(aoe.levels);
            if (levels) {
                data.aoeText += ` (${levels}${getSystemDisplayUnits(item.actor.is5e)})`;
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

        // Boostable Charges
        if (item.system.charges?.value > 1) {
            data.boostableCharges = item.system.charges.value - 1;
        }

        // MINDSCAN
        if (item.system.XMLID === "MINDSCAN") {
            data.mindScanChoices = CONFIG.HERO.mindScanChoices;

            data.mindScanFamiliarOptions = [];
            data.mindScanFamiliarOptions.push({
                label: `+0`,
                key: 0,
            });
            for (let i = 1; i <= 5; i++) {
                data.mindScanFamiliarOptions.push({
                    label: `+${i} Familiar mind`,
                    key: i,
                });
            }
            for (let i = 1; i <= 5; i++) {
                data.mindScanFamiliarOptions.push({
                    label: `${-i} Unfamiliar mind`,
                    key: -i,
                });
            }
        }

        // Combat Skill Levels
        // data.cslChoices = null;
        // data.csl = null;
        // data.cslSkill = null;
        const csls = CombatSkillLevelsForAttack(item);
        data.csls = undefined;
        for (const csl of csls) {
            let entry = {};
            if (csl && csl.skill) {
                entry.cslSkill = csl.skill;
                let mental = csl.skill.system.XMLID === "MENTAL_COMBAT_LEVELS";
                let _ocv = mental ? "omcv" : "ocv";
                let _dcv = mental ? "dmcv" : "dcv";
                entry.cslChoices = { [_ocv]: _ocv };
                if (csl.skill.system.OPTION != "SINGLE") {
                    entry.cslChoices[_dcv] = _dcv;
                    entry.cslChoices.dc = "dc";
                }

                // CSL radioBoxes names
                entry.csl = [];
                for (let c = 0; c < parseInt(csl.skill.system.LEVELS || 0); c++) {
                    entry.csl.push({
                        name: `${csl.skill.id}.system.csl.${c}`,
                        value: csl.skill.system.csl ? csl.skill.system.csl[c] : "undefined",
                    });
                }

                data.csls ??= [];
                data.csls.push(entry);
            }
        }

        // DEADLYBLOW
        const DEADLYBLOW = item.actor.items.find((o) => o.system.XMLID === "DEADLYBLOW");
        if (DEADLYBLOW) {
            item.system.conditionalAttacks ??= {};
            item.system.conditionalAttacks[DEADLYBLOW.id] ??= {
                ...DEADLYBLOW,
                id: DEADLYBLOW.id,
            };
            item.system.conditionalAttacks[DEADLYBLOW.id].checked ??= true;
        }

        data.action = Attack.getActionInfo(
            data.item,
            data.targets,
            data.formData, // use formdata to include player options from the form
        );
        // todo: this doesn't seem to update when the card does, so pick a title and stick with it
        if (data.action.maneuver.isMultipleAttack) {
            this.options.title = `${this.data?.item?.actor?.name} multiple attack.`;
        } else if (data.action.maneuver.isHaymakerAttack) {
            this.options.title = `${this.data?.item?.actor?.name} haymaker attack.`;
        } else {
            this.options.title = `${this.data?.item?.actor?.name} select attack options and roll to hit`;
        }
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        // add to multiattack
        html.find(".add-multiattack").click(this._onAddMultiAttack.bind(this));
        html.find(".trash-multiattack").click(this._onTrashMultiAttack.bind(this));
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
            console.log("RWC roll action:", this.data.action);

            canvas.tokens.activate();
            await this.close();

            return _processAttackOptions(this.data.item, formData);
        }
        this.data.formData ??= {};
        if (event.submitter?.name === "executeMultiattack") {
            console.log("RWC executeMultiattack action:", this.data.action);

            const begin = this.data.action.current.execute === undefined;
            // we pressed the button to execute multiple attacks
            // the first time does not get a roll, but sets up the first attack
            if (begin) {
                this.data.formData.execute = 0;
            } else {
                // the subsequent presses will roll the attack and set up the next attack
                // TODO: if any roll misses, the multiattack ends, and the end cost for the remainding attacks are forfeit

                // this is the roll:
                await _processAttackOptions(this.data.item, this.data.formData);
                this.data.formData.execute = this.data.action.current.execute + 1;
            }
            const end = this.data.formData.execute >= this.data.action.maneuver.attackKeys.length;
            // this is the last step
            if (end) {
                canvas.tokens.activate();
                await this.close();
            } else {
                return await new ItemAttackFormApplication(this.data).render(true);
            }
        }
        if (event.submitter?.name === "missedMultiattack") {
            // TODO: charge user the end cost for the remaining attacks
            canvas.tokens.activate();
            await this.close();
            return;
        }
        if (event.submitter?.name === "cancelMultiattack") {
            // TODO: saves the end cost for the remaining attacks
            canvas.tokens.activate();
            await this.close();
            return;
        }
        if (event.submitter?.name === "aoe") {
            return this._spawnAreaOfEffect(this.data);
        }
        // collect the changed data; all of these changes can go into get data
        this.data.formData = { ...this.data.formData, ...formData };

        this._updateCsl(event, formData);

        this.data.aim = formData.aim;
        this.data.aimSide = formData.aimSide;

        this.data.ocvMod = formData.ocvMod;
        this.data.dcvMod = formData.dcvMod;
        this.data.omcvMod = formData.omcvMod;
        this.data.dmcvMod = formData.dmcvMod;

        this.data.effectiveStr = formData.effectiveStr;
        this.data.effectiveLevels = formData.effectiveLevels;

        this.data.mindScanMinds = formData.mindScanMinds;
        this.data.mindScanFamiliar = formData.mindScanFamiliar;

        this.data.boostableCharges = Math.max(
            0,
            Math.min(parseInt(formData.boostableCharges), this.data.item.charges?.value - 1),
        );

        this.data.velocity = parseInt(formData.velocity || 0);

        // const aoe = this.data.item.AoeAttackParameters({ levels: this.data.effectiveLevels }); //  getAoeModifier();
        // if (aoe) {
        //     this.data.aoeText = aoe.OPTION_ALIAS;
        //     // if (!item.system.areaOfEffect) {
        //     //     ui.notifications.error(`${item.system.ALIAS || item.name} has invalid AOE definition.`);
        //     // }
        //     const levels = aoe.value; //item.system.areaOfEffect.value; //parseInt(aoe.LEVELS) || parseInt(aoe.levels);
        //     if (levels) {
        //         this.data.aoeText += ` (${levels}${getSystemDisplayUnits(this.data.item.actor.is5e)})`;
        //     }

        //     if (this.getAoeTemplate() || game.user.targets.size > 0) {
        //         this.data.noTargets = false;
        //     } else {
        //         this.data.noTargets = true;
        //     }
        // } else {
        //     this.data.noTargets = game.user.targets.size === 0;
        //     this.data.aoeText = null;
        // }

        // Save conditionalAttack check
        const expandedData = foundry.utils.expandObject(formData);
        for (const ca in expandedData?.system?.conditionalAttacks) {
            console.log(ca);
            this.data.item.system.conditionalAttacks[ca].checked = expandedData.system.conditionalAttacks[ca].checked;
            await this.data.item.update({
                [`system.conditionalAttacks`]: this.data.item.system.conditionalAttacks,
            });
        }

        // Show any changes
        this.render();
    }

    async _updateCsl(event, formData) {
        const item = this.data.item;
        // Combat Skill Levels (update SKILL if changed)
        const csls = CombatSkillLevelsForAttack(item);
        for (const key of Object.keys(formData).filter((o) => o.match(/([0-9A-Za-z]+)\.system\.csl\.(\d+)/))) {
            const value = formData[key];
            const itemId = key.match(/([0-9A-Za-z]+)\.system\.csl\.(\d+)/)[1];
            const idx = parseInt(key.match(/([0-9A-Za-z]+)\.system\.csl\.(\d+)/)[2]);
            for (const csl of csls) {
                if (csl.skill.id === itemId && csl.skill.system.csl[idx] != value) {
                    csl.skill.system.csl[idx] = value;
                    await csl.skill.update({
                        "system.csl": csl.skill.system.csl,
                    });
                }
            }
        }
    }

    /**
     *
     * 5e is a hex based system with defined AOE templates. The first hex is the target hex (even though it's only a 0.5" radius).
     * 6e is a gridless system with distances and AOE templates defined by the grid/gridless system being used for this scene.
     *
     */
    async _spawnAreaOfEffect() {
        const item = this.data.item;
        // const aoeModifier = item.getAoeModifier();
        // const areaOfEffect = item.system.areaOfEffect;

        const areaOfEffect = item.AoeAttackParameters({ levels: this.data.effectiveLevels });
        if (!areaOfEffect) return;

        const aoeType = areaOfEffect.OPTION.toLowerCase();
        const aoeValue = areaOfEffect.value;

        const actor = item.actor;
        const token = actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!token) {
            return ui.notifications.error(`${actor.name} has no token in this scene.  Unable to place AOE template.`);
        }
        const is5e = actor.system.is5e;

        // Close all windows except us
        for (let id of Object.keys(ui.windows)) {
            if (id != this.appId) {
                ui.windows[id].close();
            }
        }

        const templateType = heroAoeTypeToFoundryAoeTypeConversions[aoeType];

        const sizeConversionToMeters = convertSystemUnitsToMetres(1, actor);

        // NOTE: The target hex is in should count as a distance of 1". This means that to convert to what FoundryVTT expects
        //       for distance we need to subtract 0.5"/1m.
        const distance = aoeValue * sizeConversionToMeters - (is5e ? 1 : 0);

        const templateData = {
            t: templateType,
            user: game.user.id,
            distance: distance,
            direction: -token.document?.rotation || 0 + 90, // Top down tokens typically face south
            fillColor: game.user.color,
            flags: {
                itemId: item.id,
                item,
                actor,
                aoeType,
                aoeValue,
                sizeConversionToMeters,
                is5e,
            },
        };

        switch (templateType) {
            case "circle":
                break;

            case "cone":
                {
                    if ((areaOfEffect.ADDER || []).find((adder) => adder.XMLID === "THINCONE")) {
                        // TODO: The extra 0.1 degree helps with approximating the correct hex counts when not
                        //       not oriented in one of the prime 6 directions. This is because we're not
                        //       hex counting. The extra degree is more incorrect the larger the cone is.
                        templateData.angle = 30.1;
                    } else {
                        // TODO: The extra 0.1 degree helps with approximating the correct hex counts when not
                        //       not oriented in one of the prime 6 directions. This is because we're not
                        //       hex counting. The extra degree is more incorrect the larger the cone is.
                        templateData.angle = 60.1;
                    }
                }

                break;

            case "ray":
                {
                    templateData.width = sizeConversionToMeters * areaOfEffect.width;
                    templateData.flags.width = areaOfEffect.width;
                    templateData.flags.height = areaOfEffect.height;
                }
                break;

            case "rect": {
                const warningMessage = game.i18n.localize("Warning.AreaOfEffectUnsupported");

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
            canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
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
            (o) => o.user.id === game.user.id && o.flags.itemId === this.data.item.id,
        );
    }
}

window.ItemAttackFormApplication = ItemAttackFormApplication;
