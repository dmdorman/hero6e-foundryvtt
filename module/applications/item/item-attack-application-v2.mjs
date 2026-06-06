// REF: https://foundryvtt.wiki/en/development/api/applicationv2
import { HEROSYS } from "../../herosystem6e.mjs";
import { filterIgnoreCompoundAndFrameworkItems } from "../../config.mjs";
import { calculateRequiredResourcesToUse, dehydrateAttackItem, processActionToHit } from "../../item/item-attack.mjs";
import { buildEffectiveObject } from "../../item/item.mjs";
import { Attack } from "../../utility/attack.mjs";
import {
    calculateReduceOrPushRealCost,
    combatSkillLevelsForAttack,
    isManeuverThatDoesNormalDamage,
    isRangedCombatManeuver,
} from "../../utility/damage.mjs";
import { convertSystemUnitsToMetres, getSystemDisplayUnits, gridUnitsToMeters } from "../../utility/units.mjs";
import { HeroSystem6eRegionDocument } from "../../heroRegion.mjs";

/**
 * 5e HEX type and NORMAL are converted to RADIUS
 */
const heroAoeTypeToFoundryAoeTypeConversions = Object.freeze({
    any: "rect",
    cone: "cone",
    line: "line",
    radius: "circle",
    surface: "rect",
});

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ItemAttackFormApplicationV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", async function () {
            ItemAttackFormApplicationV2.initializeTemplate();
        });

        // Hooks.on("updateRegion", (document, changed, options, userId) => {
        //     //console.log(changed);
        //     // Only run if the position (x, y) or the actual shapes were updated
        //     // if (!changed.shapes && !changed.x && !changed.y) return;
        //     // // Only the user who moved the region should update their targets
        //     // if (userId !== game.user.id) return;
        //     // const region = document.object;
        //     // if (!region) return;
        //     // // 1. Get tokens currently inside the region's geometry
        //     // const tokensInside = region.tokens; // Returns a Set of Token objects
        //     // // 2. Clear current targets and add the new ones
        //     // game.user.targets.clear();
        //     // tokensInside.forEach((token) => {
        //     //     // setTarget(targeted, {user, releaseOthers})
        //     //     token.setTarget(true, { releaseOthers: false });
        //     // });
        //     // // 3. Broadcast the targeting reticule to other players
        //     // game.user.broadcastActivity({ targets: game.user.targets.ids });
        // });
    }

    data;

    constructor(data) {
        super();
        this.data = data;

        Hooks.on("targetToken", ItemAttackFormApplicationV2.#targetTokenHandler.bind(this));
        Hooks.on("controlToken", ItemAttackFormApplicationV2.#controlTokenHandler.bind(this));

        // If  CSLs change on the Actor we need to know
        Hooks.on("updateItem", ItemAttackFormApplicationV2.#updateItemHandler.bind(this));
    }

    static async #targetTokenHandler() {
        window.setTimeout(() => this.refresh(), 1);
    }

    static async #controlTokenHandler() {
        window.setTimeout(() => this.refresh(), 1);
    }

    static async #updateItemHandler(item) {
        if (this.data.actor?.id === item.actor?.id && item.baseInfo?.refreshAttackDialogWhenChanged) {
            this.refresh();
        }
    }

    refresh() {
        foundry.utils.debounce(this.render(), 100);
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        classes: ["herosystem6e", "item-attack-application-v2"],
        id: "item-attack-form-application-v2",
        position: {
            width: "400",
            height: "auto",
        },
        form: {
            handler: ItemAttackFormApplicationV2.#onSubmit,
            closeOnSubmit: false,
        },
        window: {
            icon: "fas fa-swords",
        },
    };

    get title() {
        return `ATTACK: ${this.data.token?.name || this.data.actor?.name}`;
    }

    static initializeTemplate() {
        // HEROSYS.module isn't defined yet so using game.system.id
        const systemId = game.system.id;

        ItemAttackFormApplicationV2.PARTS = {
            body: {
                template: `systems/${systemId}/templates/attack/item-attack-application-v2.hbs`,
                scrollable: [""],
            },
        };
    }

    async _prepareContext(options) {
        try {
            this.data.targets = Array.from(game.user.targets);

            if (
                this.data.targets.length === 0 &&
                this.data.originalItem.system.XMLID === "MINDSCAN" &&
                game.user.isGM
            ) {
                this.data.targets = foundry.utils
                    .deepClone(canvas.tokens.controlled)
                    .filter((t) => t.actor?.id !== this.data.originalItem.actor?.id);
            }

            // Initialize aim to the default option values
            this.data.aim ??= "none";
            this.data.aimSide ??= "none";

            // We are using the numberInput handlebar helper which requires NUMBERS, thus the parseInt
            // Set the initial values on the form
            this.data.ocvMod ??= parseInt(this.data.originalItem.system.ocv);
            this.data.dcvMod ??= parseInt(this.data.originalItem.system.dcv);
            this.data.omcvMod ??= parseInt(this.data.originalItem.system.ocv); //TODO: May need to make a distinction between OCV/OMCV
            this.data.dmcvMod ??= parseInt(this.data.originalItem.system.dcv);

            // PH: FIXME: Need to separate STR usage from TK usage. See collectActionDataBeforeToHitOptions.
            this.data.effectiveStr ??= parseInt(this.data.str);
            this.data.effectiveStr = Math.max(0, this.data.effectiveStr);

            // PH: FIXME: Is this right? What should we be showing for something like stike with weapon or fist?
            this.data.effectiveRealCost ??= this.data.originalItem._realCost;
            this.data.pushedRealPoints ??= 0;

            // Penalty Skill Levels
            this.data.psls = this.item?.pslRangePenaltyOffsetItems;

            // Is there an ENTANGLE on any of the targets
            // If so assume we are targeting the entangle
            const entangles = [];
            for (const target of this.data.targets) {
                const ae = target.actor?.temporaryEffects.find((o) => o.flags[game.system.id]?.XMLID === "ENTANGLE");
                if (ae) {
                    entangles.push(ae);
                }
            }
            this.data.entangleExists = entangles.length > 0 ? true : false;

            // Entangle
            if (this.data.targetEntangle === undefined) {
                this.data.targetEntangle = this.data.entangleExists;

                const entangle = entangles?.[0];

                if (entangle) {
                    // Mental attacks typically bypass entangles
                    if (
                        this.data.originalItem.attackDefenseVs === "MD" &&
                        entangle.flags[game.system.id]?.entangleDefense.rMD === 0
                    ) {
                        this.data.targetEntangle = false;
                    }

                    // TAKESNODAMAGE
                    if (fromUuidSync(entangle.origin)?.findModsByXmlid("TAKESNODAMAGE")) {
                        this.data.targetEntangle = false;
                    }
                }
            }

            // But an ENTANGLE attack doesn't target an ENTANGLE, adjustment attacks, etc - anything that doesn't have hit locations
            if (this.data.originalItem.effectiveAttackItem.system.noHitLocations) {
                this.data.entangleExists = false;
                this.data.targetEntangle = false;
            }

            // Boostable Charges - a maximum of 4 can be spent
            this.data.boostableChargesAvailable =
                this.data.originalItem.system.chargeModifier?.BOOSTABLE && this.data.originalItem.system.numCharges > 1
                    ? Math.min(4, this.data.originalItem.system.numCharges - 1)
                    : 0;
            this.data.boostableChargesToUse ??= 0;

            // Autofire
            const autofire = this.data.originalItem.effectiveAttackItem.findModsByXmlid("AUTOFIRE");
            this.data.autofireShotsAvailable = autofire
                ? this.data.originalItem.effectiveAttackItem.calcMaxAutofireShots(autofire)
                : 1;
            this.data.autofireShotsToUse ??= this.data.autofireShotsAvailable;

            // MINDSCAN
            if (this.data.originalItem.system.XMLID === "MINDSCAN") {
                this.data.mindScanChoices = CONFIG.HERO.mindScanChoices;

                this.data.mindScanFamiliarOptions = [];
                this.data.mindScanFamiliarOptions.push({
                    label: `+0`,
                    key: 0,
                });
                for (let i = 1; i <= 5; i++) {
                    this.data.mindScanFamiliarOptions.push({
                        label: `+${i} Familiar mind`,
                        key: i,
                    });
                }
                for (let i = 1; i <= 5; i++) {
                    this.data.mindScanFamiliarOptions.push({
                        label: `${-i} Unfamiliar mind`,
                        key: -i,
                    });
                }
            }

            // Combat Skill Levels
            const csls = combatSkillLevelsForAttack(this.data.originalItem).details;
            this.data.csls = undefined;
            for (const csl of csls) {
                if (csl && csl.item) {
                    const entry = {
                        cslSkill: csl.item,
                        cslChoices: csl.item.cslChoices,
                        csl: [],
                    };

                    // Filter physical or mental choices based on the CSL type
                    // PH: FIXME: Don't we need to do this on updates as well as the attack could have changed type based on weapon?
                    const isRangedAttack = this.data.originalItem.isRanged;
                    const isMentalAttack = this.data.originalItem.usesOmcv;
                    if (isMentalAttack) {
                        delete entry.cslChoices.ocv;
                        delete entry.cslChoices.dcvRanged;
                        delete entry.cslChoices.dcvHth;
                    } else {
                        delete entry.cslChoices.omcv;
                        delete entry.cslChoices.dmcv;

                        // Filter DCV options based on the attack type. CSLs only permit defense against the type of attack that was used.
                        if (isRangedAttack) {
                            delete entry.cslChoices.dcvHth;
                        } else {
                            delete entry.cslChoices.dcvRanged;
                        }
                    }

                    // If there are now no choices left, skip this CSL. If there are only defensive options left, skip this CSL as well.
                    const numFilteredChoices = Object.keys(entry.cslChoices).length;
                    if (
                        Object.keys(entry.cslChoices).length === 0 ||
                        (numFilteredChoices === 1 &&
                            (entry.cslChoices.dcvHth || entry.cslChoices.dcvRanged || entry.cslChoices.dmcv))
                    ) {
                        continue;
                    }

                    // CSL radioBoxes names. If we have filtered out the active option, then attempt to pick a reasonable substitute.
                    for (let c = 0; c < csl.item.system.csl.length; c++) {
                        let value = csl.item.system.csl[c];
                        if (!Object.hasOwn(entry.cslChoices, value)) {
                            if (value === "ocv" && isMentalAttack) {
                                value = "omcv";
                            } else if (value === "omcv" && !isMentalAttack) {
                                value = "ocv";
                            } else if ((value === "dcvHth" || value === "dcvRanged") && isMentalAttack) {
                                value = "dmcv";
                            } else if (value === "dmcv" && !isMentalAttack) {
                                if (isRangedAttack) {
                                    value = "dcvRanged";
                                } else {
                                    value = "dcvHth";
                                }
                            } else {
                                // We seem to be missing an intelligent default. Just pick the first one.
                                value = Object.keys(entry.cslChoices)[0];
                            }
                        }

                        entry.csl.push({
                            name: `${csl.item.id}.system.csl.${c}`,
                            value: value,
                        });
                    }

                    this.data.csls ??= [];
                    this.data.csls.push(entry);
                }
            }

            // DEADLYBLOW
            const DEADLYBLOW = this.data.originalItem.actor.items.find((o) => o.system.XMLID === "DEADLYBLOW");
            if (DEADLYBLOW) {
                this.data.originalItem.system.conditionalAttacks ??= {};
                this.data.originalItem.system.conditionalAttacks[DEADLYBLOW.id] = DEADLYBLOW;
                this.data.originalItem.system.conditionalAttacks[DEADLYBLOW.id].system.checked ??= true;
            }

            // Hand-to-hand attacks only apply to things that are strength damage based
            if (isManeuverThatDoesNormalDamage(this.data.originalItem)) {
                const hthAttacks = this.data.originalItem.actor.items.filter(
                    (item) => item.system.XMLID === "HANDTOHANDATTACK" && !(item.system.CARRIED && !item.system.active),
                );
                this.data.hthAttackItems ??= hthAttacks.reduce((attacksObj, hthAttack) => {
                    // If already exists we're updating so no need to recreate.
                    if (attacksObj[hthAttack.id]) {
                        return attacksObj;
                    }

                    attacksObj[hthAttack.id] = {
                        _canUseForAttack: false,
                        reasonForCantUse: "",
                        description: hthAttack.system.description,
                        name: hthAttack.name,
                        uuid: hthAttack.uuid,
                    };
                    return attacksObj;
                }, {});
            } else {
                this.data.hthAttackItems = {};
            }

            // Weapons can be used with HTH or ranged martial maneuvers. The user needs to have Weapon Element.
            // Weapons can also be used with ranged combat maneuvers.
            // TODO: confirm the found Weapon Elements matches against the possible weapons. HDC doesn't support this.
            this.data.maSelectedWeaponId ??= null;
            this.data.maPossibleWeapons = [];
            if (
                (this.data.originalItem.isMartialManeuver &&
                    this.data.originalItem.actor.items.some((item) => item.system.XMLID === "WEAPON_ELEMENT")) ||
                isRangedCombatManeuver(this.data.originalItem)
            ) {
                this.data.maPossibleWeapons = [
                    {
                        id: null,
                        label: "No Weapon",
                        description: "Use no weapon",
                    },
                    ...this.data.originalItem.actor.items
                        .filter(filterIgnoreCompoundAndFrameworkItems)
                        .filter((item) => {
                            // If a ranged maneuver, list all ranged weapons. Otherwise, it's a martial art
                            // and list all HTH or ranged weapons depending on the martial maneuver type
                            return (
                                item.baseInfo.type.includes("attack") && // Is attack?
                                (this.data.originalItem.isRanged // Has the same kind of range?
                                    ? item.isRanged
                                    : item.isHth) &&
                                !item.isMartialManeuver && // No martial maneuvers as weapons
                                !item.isCombatManeuver && // No combat maneuvers as weapons
                                !item.system.XMLID.startsWith("__") // No internal placeholder powers/items
                            );
                        })
                        .map((item) => {
                            return {
                                id: item.id,
                                label: item.name,
                                description: item.system.description,
                            };
                        }),
                ];
            }

            // PH: FIXME: Need to only get the Naked Advantages that apply to this item.
            // PH: FIXME: need to distinguish between single power and group power
            const nakedAdvantagesItems = this.data.originalItem.actor.items.filter(
                (item) => item.system.XMLID === "NAKEDMODIFIER",
            );
            this.data.nakedAdvantagesItems ??= nakedAdvantagesItems.reduce((naObj, naItem) => {
                // If already exists we're updating so no need to recreate.
                if (naObj[naItem.uuid]) {
                    return naObj;
                }

                naObj[naItem.id] = {
                    _canUseForAttack: false,
                    reasonForCantUse: "",
                    description: naItem.system.description,
                    name: naItem.name,
                    item: naItem,
                    uuid: naItem.uuid,
                };
                return naObj;
            }, {});

            this.data.effectiveItem = await this.#buildEffectiveObjectFromOriginalAndData();
            this.data.effectiveItemResourceUsage = calculateRequiredResourcesToUse(
                [
                    this.data.effectiveItem,
                    ...(this.data.effectiveItem.system._active.linkedEnd || []).map(
                        (linkedEndInfo) => linkedEndInfo.item,
                    ),
                    ...(this.data.effectiveItem.system._active.linkedAssociated || []).map(
                        (linkedAssociatedInfo) => linkedAssociatedInfo.item,
                    ),

                    // PH: FIXME: This should probably be recursive as these linked items could have linked endurance
                    // only items or linked items of their own (presumably).
                    ...(this.data.effectiveItem.system._active.linked || []).map((linkedInfo) => linkedInfo.item),
                ],
                this.data.formData || this.data,
            );

            this.#setAoeAndHitLocationDataForEffectiveItem();

            this.data.action = Attack.buildActionInfo(
                this.data.effectiveItem,
                this.data.targets,
                { ...this.data.formData, token: this.data.token }, // use formData to include player options from the form
            );

            // the title seems to be fixed when the form is initialized,
            // and doesn't change afterwards even if we come through here again
            // todo: figure out how to adjust the title when we want it to
            // if (this.data.action.maneuver.isMultipleAttack) {
            //     this.options.title = `${(this.data.token || this.data.actor).name} multiple attack`;
            // } else if (this.data.action.maneuver.isSweep) {
            //     this.options.title = `${(this.data.token || this.data.actor).name} sweep attack`;
            // } else if (this.data.action.maneuver.isRapidFire) {
            //     this.options.title = `${(this.data.token || this.data.actor).name} rapid fire attack`;
            // } else {
            //     this.options.title = `${(this.data.token || this.data.actor).name} attack`;
            // }
        } catch (error) {
            console.error(error);
        }

        const context = await super._prepareContext(options);

        // context.buttons = [{
        //     type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" }];

        return foundry.utils.mergeObject(context, this.data);
    }

    /**
     * If there are no hit locations for the power or this is an AoE then the user cannot place a shot.
     * If they can't place a shot the only options should be "none"
     */
    #setAoeAndHitLocationDataForEffectiveItem() {
        const aoe = this.data.effectiveItem.effectiveAttackItem.aoeAttackParameters;
        this.data.hitLocationsEnabled = game.settings.get(HEROSYS.module, "hit locations");
        this.data.hitLocationSideEnabled =
            this.data.hitLocationsEnabled && game.settings.get(HEROSYS.module, "hitLocTracking") === "all";
        this.data.hitLocationsEnabled = game.settings.get(HEROSYS.module, "hit locations");

        // If there are no hit locations for the power or this is an AoE then the user cannot
        // place a shot. If they can't place a shot the only options should be "none"
        if (this.data.hitLocationsEnabled) {
            this.data.hitLoc = [];
            this.data.hitLocSide = [];

            if (!this.data.effectiveItem.effectiveAttackItem.system.noHitLocations && !aoe) {
                for (const [key, obj] of Object.entries(CONFIG.HERO.hitLocations)) {
                    this.data.hitLoc.push({ key: key, label: `${obj.label} (${obj.ocvMod})` });
                }

                if (this.data.hitLocationSideEnabled) {
                    for (const key of Object.keys(CONFIG.HERO.hitLocationSide)) {
                        this.data.hitLocSide.push({ key: key, label: key });
                    }
                }
            }

            const noneReason = this.data.effectiveItem.effectiveAttackItem.system.noHitLocations
                ? `does not allow hit locations`
                : aoe
                  ? `has an area of effect`
                  : undefined;

            const noneLabel = `None${noneReason ? ` - ${noneReason}` : ""}`;
            this.data.hitLoc = [{ key: "none", label: `${noneLabel}` }, ...this.data.hitLoc];
            this.data.hitLocSide = [{ key: "none", label: `${noneLabel}` }, ...this.data.hitLocSide];
        }

        if (aoe) {
            this.data.aoeText = aoe.type;
            const levels = aoe.value;
            if (levels) {
                this.data.aoeText += ` (${levels}${getSystemDisplayUnits(this.data.effectiveItem.actor.is5e)})`;
            }

            // if (this.getAoeTemplate() || game.user.targets.size > 0) {
            //     this.data.noTargets = false;
            // } else {
            //     this.data.noTargets = true;
            // }
        } else {
            this.data.noTargets = game.user.targets.size === 0;
            this.data.aoeText = null;
        }
    }

    static async #onSubmit(event, form, formData) {
        // Do things with the returned FormData
        //this.data.effectiveItem, formData, { token: this.data.token, allInOne: true }

        const extendedFormData = foundry.utils.expandObject(formData.object);

        switch (event.submitter?.name) {
            case "roll": {
                const aoe = this.data.effectiveItem.effectiveAttackItem.aoeAttackParameters;

                if (aoe && !this.getAoeTemplate()) {
                    return ui.notifications.error(
                        `No area of effect template found for this attack. Please place the template before rolling the attack.`,
                    );
                }
                await this.close();
                return processActionToHit(this.data.effectiveItem, extendedFormData, { token: this.data.token });
            }

            case "continueMultiattack":
                this.data.formData.continueMultiattack = true;
                break;

            case "executeMultiattack":
                {
                    const begin = this.data.action.current.execute === undefined;
                    // we pressed the button to execute multiple attacks
                    // the first time does not get a roll, but sets up the first attack
                    if (begin) {
                        this.data.formData.execute = 0;
                    } else {
                        // the subsequent presses will roll the attack and set up the next attack
                        // TODO: if any roll misses, the multiattack ends, and the end cost for the remainding attacks are forfeit

                        // this is the roll:
                        await processActionToHit(this.data.effectiveItem, this.data.formData);

                        this.data.formData.execute = this.data.action.current.execute + 1;
                    }

                    // Is this is the last step?
                    const end = this.data.formData.execute >= this.data.action.maneuver.attackKeys.length;
                    if (end) {
                        canvas.tokens.activate();
                        await this.close();
                    } else {
                        return await new ItemAttackFormApplicationV2(this.data).render(true);
                    }
                }

                break;

            case "missedMultiattack":
                // TODO: charge user the end cost for the remaining attacks
                canvas.tokens.activate();
                await this.close();
                return;

            case "cancelMultiattack":
                this.data.formData.continueMultiattack = false;

                // PH: FIXME: Do we have to do anything to action to clear it out? Should we just "delete" it?

                canvas.tokens.activate();
                await this.close();

                return;

            case "aoe":
                return this._spawnAreaOfEffect();

            default:
                console.log(`${event.submitter?.name} was submitted, but no handler is set up for that yet.`);
        }

        console.warn(`Fall thru on ${event.submitter?.name}`);
    }

    /**
     *
     * 5e is a hex based system with defined AOE templates. The first hex is the target hex (even though it's only a 0.5" radius).
     * 6e is a gridless system with distances and AOE templates defined by the grid/gridless system being used for this scene.
     *
     */
    async _spawnAreaOfEffect() {
        const item = this.data.effectiveItem;

        const areaOfEffect = item.effectiveAttackItem.aoeAttackParameters;
        if (!areaOfEffect) return;

        const aoeType = areaOfEffect.type;
        //const aoeValue = areaOfEffect.value;

        const actor = item.actor;
        const token = actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
        if (!token) {
            return ui.notifications.error(`${actor.name} has no token in this scene.  Unable to place AOE template.`);
        }

        // Close all windows except us
        for (let id of Object.keys(ui.windows)) {
            if (id != this.appId) {
                ui.windows[id].close();
            }
        }

        function metersToPixels(meters) {
            const sizeConversionToMeters = convertSystemUnitsToMetres(1, actor.is5e);
            const distanceInMeters = meters * sizeConversionToMeters;
            const distanceInGridUnits = distanceInMeters / gridUnitsToMeters();
            return distanceInGridUnits * canvas.grid.size;
        }

        const templateType = heroAoeTypeToFoundryAoeTypeConversions[aoeType];

        //const sizeConversionToMeters = convertSystemUnitsToMetres(1, actor.is5e);

        //const hexTemplates = game.settings.get(HEROSYS.module, "HexTemplates");
        //const hexGrid = currentSceneUsesHexGrid();

        // NOTE: If we're using hex templates (i.e. 5e), the target hex is in should count as a distance of 1". This means that to convert to what FoundryVTT expects
        //       for distance we need to subtract 0.5"/1m from the radius.
        // NOTE: MeasuredTemplates assume that the distance is in grid units.
        //const distanceInMeters = aoeValue * sizeConversionToMeters - (hexTemplates && hexGrid ? 1 : 0);
        //const distanceInGridUnits = distanceInMeters / gridUnitsToMeters();

        const effectiveAttackItemOriginalItemId = item.effectiveAttackItem.getEffectiveItemOriginalItemId;
        const regionData = {
            name: `${item.name}-${item.system.XMLID}-${token.name}`,
            color: game.user.color,
            shapes: [
                {
                    type: templateType,
                    x: token.center.x,
                    y: token.center.y,
                    rotation: -token.document?.rotation || 0 + 90,
                },
            ],
            displayMeasurements: true,
            highlightMode: "coverage",
            visibility: CONST.REGION_VISIBILITY.ALWAYS,
            label: `${item.name}\n(Stun Gas Area)`,
            flags: {
                [game.system.id]: {
                    purpose: "AoE",
                    itemId: effectiveAttackItemOriginalItemId,
                    actorUuid: actor.uuid,
                    effectiveItemJson: dehydrateAttackItem(item),
                    userId: game.user.id,
                },
            },

            levels:
                canvas.scene.levels.find((level) => {
                    const elevation = token.document.elevation ?? 0;
                    return elevation >= level.bottom && elevation <= level.top;
                })?.id ?? "defaultLevel0000",
            "restriction.enabled": true,
            "restriction.type": "sight",
            "restriction.priority": 0,
        };

        switch (templateType) {
            case "circle":
                {
                    regionData.shapes[0].radius = metersToPixels(areaOfEffect.value) / 2;
                }
                break;

            case "cone":
                {
                    if ((areaOfEffect.ADDER || []).find((adder) => adder.XMLID === "THINCONE")) {
                        regionData.shapes[0].angle = 30;
                    } else {
                        regionData.shapes[0].angle = 60;
                    }
                }

                break;

            case "line":
                {
                    // width & length are in pixels
                    // AARON: Not sure why we are dividing by 2 here.
                    regionData.shapes[0].width = metersToPixels(areaOfEffect.width) / 2;
                    regionData.shapes[0].length = metersToPixels(areaOfEffect.value) / 2;
                }
                break;

            // case "rect": {
            //     // if (areaOfEffect.type === "surface" && item.findModsByXmlid("CONTINUOUS")) {
            //     //     // This is likely a damage shield
            //     // }

            //     // rectangle templates are defined as a distance/hypotenuse and an angle
            //     regionData.direction = areaOfEffect.direction;
            //     regionData.distance = sizeConversionToMeters * areaOfEffect.distance;
            //     break;
            // }

            default:
                console.error(`unsupported template type ${templateType}`);
                break;
        }

        const existingTemplate = this.getAoeTemplate();
        if (existingTemplate) {
            // delete exiting region,
            await existingTemplate.delete();
        }

        // Create the region
        const newRegion = await this.placeRegionWithHiddenUI(regionData); //await canvas.regions.placeRegion(regionData);
        if (newRegion?.documentName !== "Region") {
            throw new Error("Failed to create region for area of effect");
        }

        // Remove all targets
        for (const target of game.user.targets) {
            target.setTarget(false, { releaseOthers: false });
        }

        // Apply the TokenAutomaticTargeting behavior to the region
        // so that it will target tokens that enter it and remove targets that leave it.
        // GM permissions are required to add behaviors, so if the user isn't a GM
        // we need to send a socket message to the GM to have them add the behavior for us.
        if (game.user.isGM) {
            await HeroSystem6eRegionDocument.applyBehaviorTokenAutomaticTargeting(newRegion.uuid);
        } else {
            // Check if GM is online
            const isGmOnline = game.users.some((u) => u.isGM && u.active);
            if (isGmOnline) {
                game.socket.emit(`system.${game.system.id}`, {
                    operation: "applyBehaviorTokenAutomaticTargeting",
                    userId: game.user.id,
                    regionUuid: newRegion.uuid,
                });
            } else {
                ui.notifications.warn(
                    "A GM must be online to create the AoE automatic targeting behavior to the region.",
                );
            }
        }

        // DELAYED TRIGGER: Target tokens that are inside the region.
        // We listen to every update until we find OUR region's update, then unregister.
        const hookId = Hooks.on("updateRegion", (document) => {
            // Check if the region being updated matches our newly created region
            if (document.id === newRegion.id) {
                // Immediately turn off this listener so it doesn't loop
                Hooks.off("updateRegion", hookId);

                // Safely grab the tokens from the updated document cache
                const tokensInRegion = document.tokens ?? [];

                // Target all the tokens that are inside the region
                for (const tokenDoc of tokensInRegion) {
                    if (tokenDoc.object) {
                        tokenDoc.object.setTarget(true, { releaseOthers: false });
                    }
                }
            }
        });
    }

    async placeRegionWithHiddenUI(regionData) {
        let newRegion;
        const hiddenElementsData = [];

        // Identify all V1 open Application Windows (actor sheets, journals, items, etc.)
        const openWindowsV1 = Object.values(ui.windows);

        // Hide all open windows by altering their visibility
        openWindowsV1.forEach((app) => {
            // Safe check to ensure the application window is rendered
            if (app._element && app._element.length) {
                hiddenElementsData.push({ element: app._element[0], visibility: app._element[0].style.visibility });
                app._element[0].style.visibility = "hidden";
            }
        });

        // Identify all V2 open Application Windows (actor sheets, journals, items, etc.)
        const openWindowsV2 = foundry.applications.instances.values();
        // Hide all open windows by altering their visibility
        openWindowsV2.forEach((app) => {
            // Safe check to ensure the application window is rendered, visible, etc
            if (app.element && app.window.content && app.element.style.visibility !== "hidden") {
                hiddenElementsData.push({ element: app.element, visibility: app.element.style.visibility });
                app.element.style.visibility = "hidden";
            }
        });

        try {
            ui.notifications.info(
                `Placing <b>${regionData.name}</b>. SHIFT/CTRL+MouseWheel to rotate. Left click to place. Right click to cancel.`,
            );
            newRegion = await canvas.regions.placeRegion(regionData);
        } catch (e) {
            console.error(e);
        }

        // Restore visibility to all hiddenElements when finished
        hiddenElementsData.forEach((hiddenElementData) => {
            hiddenElementData.element.style.visibility = hiddenElementData.visibility;
        });

        return newRegion;
    }

    /**
     * Find the first matching template for the effective attack item.
     *
     * @returns
     */
    getAoeTemplate() {
        const effectiveAttackItemOriginalItemId = this.data.effectiveItem.getEffectiveItemOriginalItemId;

        return Array.from(canvas.regions.viewedDocuments()).find(
            (template) =>
                template.color?.css === game.user.color.css &&
                template.flags[game.system.id]?.purpose === "AoE" &&
                template.flags[game.system.id]?.itemId === effectiveAttackItemOriginalItemId,
        );
    }

    // Create a new effectiveItem
    async #buildEffectiveObjectFromOriginalAndData() {
        const effectiveObjectParameters = {
            originalItem: this.data.originalItem,
            effectiveRealCost: this.data.effectiveRealCost,
            pushedRealPoints: this.data.pushedRealPoints,
            effectiveStr: this.data.effectiveStr,
            effectiveStrPushedRealPoints: this.data.effectiveStrPushedRealPoints,

            maWeaponId: this.data.maSelectedWeaponId,
            hthAttackItems: this.data.hthAttackItems,
            nakedAdvantagesItems: this.data.nakedAdvantagesItems,

            autofire: {
                shots: this.data.autofireShotsToUse,
                maxShots: this.data.autofireShotsAvailable,
            },
        };

        return buildEffectiveObject(effectiveObjectParameters);
    }

    // PH: FIXME: Effective item is not STR for maneuvers with empty fist or the weapon for weapon maneuvers
    /**
     * Can only push and reduce so much. Make sure we're not exceeding basic boundaries for strength or the item.
     *  PH: FIXME: Should not be able to push if the power is bought to 0 END, doesn't cost END, or use charges.
     *  PH: FIXME: Pushing for heroic has different rules than superheroic (which is what is implemented here)
     *  PH: FIXME: Allow pushing beyond 10 CP with override?
     *  PH: FIXME: How should pushing play with HTH Attack and Naked Advantages? I assume that they don't interact.
     * @param {Object} formData
     */
    #processReduceOrPush(formData) {
        // Limit the item's reduce or push
        const desiredEffectiveItemRealCost = formData.effectiveRealCost || 0;

        ({ effectiveRealCost: this.data.effectiveRealCost, pushedRealPoints: this.data.pushedRealPoints } =
            calculateReduceOrPushRealCost(this.data.originalItem._realCost, desiredEffectiveItemRealCost));

        if (this.data.effectiveRealCost < desiredEffectiveItemRealCost) {
            ui.notifications.warn(
                "Pushing a power is limited to the lesser of 10 character points or the original total character points",
            );
        } else if (this.data.effectiveRealCost > desiredEffectiveItemRealCost) {
            ui.notifications.warn("The minimum power cost is 1 character point");
        }

        // Limit strength's push
        // PH: FIXME: Should be working with limited strength and not desired strength
        const desiredStrengthRealCost = formData.effectiveStr || 0;
        if (this.data.effectiveStr > 0) {
            ({ effectiveRealCost: this.data.effectiveStr, pushedRealPoints: this.data.effectiveStrPushedRealPoints } =
                calculateReduceOrPushRealCost(this.data.str, desiredStrengthRealCost));

            if (this.data.effectiveStr < desiredStrengthRealCost) {
                ui.notifications.warn(
                    "Pushing strength is limited to the lesser of 10 character points or the original total character points",
                );
            }
        } else {
            this.data.effectiveStrPushedRealPoints = 0;
        }
    }

    /**
     * Determine what Hand-to-Hand and Naked Advantages should be enabled.
     *
     * @param {Object} formData
     */
    #processFormDataForHthAndNa(formData) {
        // Restructure HTH Attacks
        // Object.entries(formData.hthAttackItems).forEach(([key, value]) => {
        //     this.data.hthAttackItems[key] = value;
        // });

        // Restructure Naked Advantages
        Object.entries(formData).forEach(([key, value]) => {
            const match = key.match(/^nakedAdvantagesItems.(.*)._canUseForAttack$/);
            if (!match) {
                return;
            }

            this.data.nakedAdvantagesItems[match[1]]._canUseForAttack = value;
        });
    }

    async _onChange(event, formData) {
        const extendedFormData = foundry.utils.expandObject(formData.object);

        // PH: FIXME: There has to be a better way than this?
        delete extendedFormData.effectiveRealCost;

        // CSL & PSL format is non-standard, need to deal with those
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
        if (updates.length > 0) {
            await this.data.actor.updateEmbeddedDocuments("Item", updates);
        }

        // Take all the data we updated in the form and apply it.
        this.data = foundry.utils.mergeObject(this.data, extendedFormData);

        this.#processReduceOrPush(extendedFormData);

        this.#processFormDataForHthAndNa(extendedFormData);

        // PH: FIXME: Build the item to use. Is there a way to only have this code once in getData?
        this.data.effectiveItem = await this.#buildEffectiveObjectFromOriginalAndData();
        this.data.effectiveItemResourceUsage = calculateRequiredResourcesToUse(
            [
                this.data.effectiveItem,
                ...(this.data.effectiveItem.system._active.linkedEnd || []).map((linkedEndInfo) => linkedEndInfo.item),

                // PH: FIXME: This should probably be recursive as these linked items could have linked endurance
                // only items or linked items of their own (presumably).
                ...(this.data.effectiveItem.system._active.linked || []).map((linkedInfo) => linkedInfo.item),
            ],
            formData,
        );

        this.#setAoeAndHitLocationDataForEffectiveItem();

        // if (event.submitter?.name === "roll") {

        //     await this.close();

        //     return processActionToHit(this.data.effectiveItem, extendedFormData, { token: this.data.token });
        // }

        this.data.formData ??= {};

        // if (event.submitter?.name === "continueMultiattack") {
        //     this.data.formData.continueMultiattack = true;
        // } else if (event.submitter?.name === "executeMultiattack") {
        //     const begin = this.data.action.current.execute === undefined;
        //     // we pressed the button to execute multiple attacks
        //     // the first time does not get a roll, but sets up the first attack
        //     if (begin) {
        //         this.data.formData.execute = 0;
        //     } else {
        //         // the subsequent presses will roll the attack and set up the next attack
        //         // TODO: if any roll misses, the multiattack ends, and the end cost for the remainding attacks are forfeit

        //         // this is the roll:
        //         await processActionToHit(this.data.effectiveItem, this.data.formData);

        //         this.data.formData.execute = this.data.action.current.execute + 1;
        //     }

        //     // Is this is the last step?
        //     const end = this.data.formData.execute >= this.data.action.maneuver.attackKeys.length;
        //     if (end) {
        //         canvas.tokens.activate();
        //         await this.close();
        //     } else {
        //         return await new ItemAttackFormApplicationV2(this.data).render(true);
        //     }
        // } else if (event.submitter?.name === "missedMultiattack") {
        //     // TODO: charge user the end cost for the remaining attacks
        //     canvas.tokens.activate();
        //     await this.close();
        //     return;
        // } else if (event.submitter?.name === "cancelMultiattack") {
        //     this.data.formData.continueMultiattack = false;

        //     // PH: FIXME: Do we have to do anything to action to clear it out? Should we just "delete" it?

        //     canvas.tokens.activate();
        //     await this.close();

        //     return;
        // } else if (event.submitter?.name === "aoe") {
        //     return this._spawnAreaOfEffect();
        // }

        // A max of 4 boostable charges may be used and a min of 0.
        if (formData.boostableChargesToUse) {
            this.data.boostableChargesToUse = extendedFormData.boostableChargesToUse = Math.max(
                0,
                Math.min(formData.boostableChargesToUse, 4),
            );
        }

        // A minimum of 1 shot and a maximum of max autofire charges can be used.
        this.data.autofireShotsToUse = extendedFormData.autofireShotsToUse = Math.max(
            1,
            Math.min(extendedFormData.autofireShotsToUse, this.data.autofireShotsAvailable),
        );

        // Can only push so much
        if (extendedFormData.effectiveActivePoints) {
            const desiredEffectiveActivePoints = extendedFormData.effectiveActivePoints;
            // PH: FIXME: Is this right? What should we be showing for something like stike with weapon or fist?
            this.data.effectiveActivePoints = Math.min(
                desiredEffectiveActivePoints,
                this.data.originalItem.activePoints + Math.min(10, this.data.originalItem.activePoints),
            );

            if (this.data.effectiveActivePoints < desiredEffectiveActivePoints) {
                ui.notifications.warn(
                    `Pushing is limited to the lesser of 10 active points or the original total active points`,
                );
            }
        }

        // collect the changed data; all of these changes can go into get data
        this.data.formData = { ...this.data.formData, ...extendedFormData };

        // Save conditionalAttack check
        // PH: FIXME: Is originalItem use here correct?
        const expandedData = foundry.utils.expandObject(extendedFormData);
        for (const ca in expandedData?.system?.conditionalAttacks) {
            await this.data.originalItem.system.conditionalAttacks[ca].update({
                [`system.checked`]: expandedData.system.conditionalAttacks[ca].system.checked,
            });
        }

        // Show any changes
        this.render();
    }

    _onRender(context, options) {
        super._onRender(context, options);

        // onChange
        this.element.querySelectorAll("input, select").forEach((el) => {
            el.addEventListener("change", (ev) => {
                ev.preventDefault();
                ev.stopImmediatePropagation();
                return this._onChange.call(this, ev, new FormDataExtended(this.element));
            });
        });
    }
}
