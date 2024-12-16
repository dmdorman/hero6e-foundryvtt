import { CombatSkillLevelsForAttack, PenaltySkillLevelsForAttack } from "../utility/damage.mjs";
import { processAttackOptions } from "../item/item-attack.mjs";
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

        const _targetToken = async function () {
            // Necessary for situations where it is not possible
            // to properly wait for promises to resolve before refreshing the UI.
            window.setTimeout(() => this.refresh(), 1);
        };
        Hooks.on("targetToken", _targetToken.bind(this));

        const _controlToken = async function () {
            // Necessary for situations where it is not possible
            // to properly wait for promises to resolve before refreshing the UI.
            window.setTimeout(() => this.refresh(), 1);
        };
        Hooks.on("controlToken", _controlToken.bind(this));

        // If  CSLs change on the Actor we need to know
        const _updateItem = async function (item) {
            //, changes, options, userId) {
            if (this.data.actor.id === item.actor.id && item.baseInfo?.refreshAttackDialogWhenChanged) {
                this.refresh();
            }
        };
        Hooks.on("updateItem", _updateItem.bind(this));
    }

    refresh() {
        foundry.utils.debounce(this.render(), 100);
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

    async getData() {
        const data = this.data;
        const item = data.item;

        try {
            //data.targets = game.user.targets;
            data.targets = Array.from(game.user.targets);

            if (data.targets.length === 0 && item.system.XMLID === "MINDSCAN" && game.user.isGM) {
                data.targets = foundry.utils
                    .deepClone(canvas.tokens.controlled)
                    .filter((t) => t.actor?.id != item.actor?.id);
            }

            // Initialize aim to the default option values
            this.data.aim ??= "none";
            this.data.aimSide ??= "none";

            // We are using the numberInput handlebar helper which requires NUMBERS, thus the parseInt
            // Set the initial values on the form
            data.ocvMod ??= parseInt(item.system.ocv);
            data.dcvMod ??= parseInt(item.system.dcv);
            data.omcvMod ??= parseInt(item.system.ocv); //TODO: May need to make a distinction between OCV/OMCV
            data.dmcvMod ??= parseInt(item.system.dcv);
            data.effectiveStr ??= parseInt(data.str);
            data.effectiveStr = Math.max(0, data.effectiveStr);
            data.effectiveLevels ??= parseInt(data.item.system.LEVELS);

            // Penalty Skill Levels
            // Currently only supports range PSL
            data.psls = PenaltySkillLevelsForAttack(item).filter((o) => o.system.penalty === "range");

            // Check all PSLs
            // for (const psl of data.psls) {
            //     if (psl.system.checked !== false) {
            //         await psl.update({ "system.checked": true });
            //     }
            // }

            // Is there an ENTANGLE on any of the targets
            // If so assume we are targeting the entangle
            const entangles = [];
            for (const target of data.targets) {
                const ae = target.actor?.temporaryEffects.find((o) => o.flags.XMLID === "ENTANGLE");
                if (ae) {
                    entangles.push(ae);
                }
            }
            data.entangleExists = entangles.length > 0 ? true : false;

            // Entangle
            if (data.targetEntangle === undefined) {
                data.targetEntangle = data.entangleExists;

                const entangle = entangles?.[0];

                if (entangle) {
                    // Mental attacks typically bypass entangles
                    if (item.attackDefenseVs === "MD" && entangle.flags.entangleDefense.rMD === 0) {
                        data.targetEntangle = false;
                    }

                    // TAKESNODAMAGE
                    if (fromUuidSync(entangle.origin)?.findModsByXmlid("TAKESNODAMAGE")) {
                        data.targetEntangle = false;
                    }
                }
            }

            // But an ENTANGLE attack doesn't target an ENTANGLE
            if (data.item.system.XMLID === "ENTANGLE") {
                data.entangleExists = false;
                data.targetEntangle = false;
            }

            data.hitLoc = [];
            data.useHitLoc = false;
            const aoe = item.AoeAttackParameters({ levels: data.effectiveLevels });
            if (game.settings.get(HEROSYS.module, "hit locations") && !item.system.noHitLocations && !aoe) {
                for (const key of Object.keys(CONFIG.HERO.hitLocations)) {
                    data.hitLoc.push({ key: key, label: key });
                }
                data.useHitLoc = true;
            }

            // Allow targeting of ENTANGLES & FOCI
            // if (data.targets.length === 1) {
            //     for (const entry of data.targets[0].actor?.targetableItems) {
            //         data.hitLoc.push({ key: entry.uuid, label: entry.name }); //disabled: true
            //         data.useHitLoc = true;
            //     }
            // }
            if (data.useHitLoc) {
                data.hitLoc = [{ key: "none", label: "None" }, ...data.hitLoc];
            }

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

            // Boostable Charges - a maximum of 4 can be spent
            data.boostableChargesAvailable =
                item.system.charges?.boostable && item.system.charges?.value > 1
                    ? Math.min(4, item.system.charges.value - 1)
                    : 0;
            data.boostableChargesToUse ??= 0;

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
                item.system.conditionalAttacks[DEADLYBLOW.id] = DEADLYBLOW;
                item.system.conditionalAttacks[DEADLYBLOW.id].system.checked ??= true;
            }

            data.action = Attack.getActionInfo(
                data.item,
                data.targets,
                data.formData, // use formData to include player options from the form
            );
            // the title seems to be fixed when the form is initialized,
            // and doesn't change afterwards even if we come through here again
            // todo: figure out how to adjust the title when we want it to
            if (data.action.maneuver.isMultipleAttack) {
                this.options.title = `${this.data?.item?.actor?.name} multiple attack`;
            } else if (data.action.maneuver.isHaymakerAttack) {
                this.options.title = `${this.data?.item?.actor?.name} haymaker attack`;
            } else {
                this.options.title = `${this.data?.item?.actor?.name} select attack options and roll to hit`;
            }
        } catch (error) {
            console.error(error);
        }
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        // add to multiattack
        html.find(".add-multiattack").click(this._onAddAttackToMultipleAttackManeuver.bind(this));
        html.find(".remove-multiattack").click(this._onRemoveAttackFromMultipleAttackManeuver.bind(this));
    }

    async _onAddAttackToMultipleAttackManeuver() {
        if (Attack.addMultipleAttack(this.data)) {
            this.render();
        }
    }

    async _onRemoveAttackFromMultipleAttackManeuver(event) {
        const multipleAttackKey = event.target.dataset.multiattack;
        if (Attack.removeMultipleAttack(this.data, multipleAttackKey)) {
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
        // CSL & PSL format is non-standard, need to deal with those
        const extendedFormData = foundry.utils.expandObject(formData);
        const updates = [];
        for (const key of Object.keys(extendedFormData)) {
            if (key.length === 16) {
                const extendedItem = this.data.actor.items.find((o) => o.id === key);
                if (extendedItem) {
                    updates.push({ _id: key, ...extendedFormData[key] });
                    delete extendedFormData[key];
                }
            }
        }
        if (updates) {
            await this.data.actor.updateEmbeddedDocuments("Item", updates);
        }

        // Take all the data we updated in the form and apply it.
        this.data = foundry.utils.mergeObject(this.data, extendedFormData);

        if (event.submitter?.name === "roll") {
            canvas.tokens.activate();
            await this.close();

            return processAttackOptions(this.data.item, formData);
        }

        this.data.formData ??= {};

        if (event.submitter?.name === "continueMultiattack") {
            this.data.formData.continueMultiattack = true;
        } else if (event.submitter?.name === "executeMultiattack") {
            // todo: cancel a missed and continue anyway

            const begin = this.data.action.current.execute === undefined;
            // we pressed the button to execute multiple attacks
            // the first time does not get a roll, but sets up the first attack
            if (begin) {
                this.data.formData.execute = 0;
            } else {
                // the subsequent presses will roll the attack and set up the next attack
                // TODO: if any roll misses, the multiattack ends, and the end cost for the remainding attacks are forfeit

                // this is the roll:
                await processAttackOptions(this.data.item, this.data.formData);
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
        } else if (event.submitter?.name === "missedMultiattack") {
            // TODO: charge user the end cost for the remaining attacks
            canvas.tokens.activate();
            await this.close();
            return;
        } else if (event.submitter?.name === "cancelMultiattack") {
            // TODO: saves the end cost for the remaining attacks
            canvas.tokens.activate();
            await this.close();
            return;
        } else if (event.submitter?.name === "aoe") {
            return this._spawnAreaOfEffect(this.data);
        }

        // A max of 4 boostable charges may be used and a min of 0.
        if (formData.boostableChargesToUse) {
            this.data.boostableChargesToUse = formData.boostableChargesToUse = Math.max(
                0,
                Math.min(formData.boostableChargesToUse, 4),
            );
        }

        // collect the changed data; all of these changes can go into get data
        this.data.formData = { ...this.data.formData, ...formData };

        // Save conditionalAttack check
        const expandedData = foundry.utils.expandObject(formData);
        for (const ca in expandedData?.system?.conditionalAttacks) {
            // this.data.item.system.conditionalAttacks[ca].system.checked =
            //     expandedData.system.conditionalAttacks[ca].system.checked;
            await this.data.item.system.conditionalAttacks[ca].update({
                [`system.checked`]: expandedData.system.conditionalAttacks[ca].system.checked,
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
            author: game.user.id,
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
            (o) => o.author.id === game.user.id && o.flags.itemId === this.data.item.id,
        );
    }
}

window.ItemAttackFormApplication = ItemAttackFormApplication;
