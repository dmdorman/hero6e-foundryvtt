import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor-active-effects.mjs";
import { HeroSystem6eItem, cloneToEffectiveAttackItem } from "../item/item.mjs";
import { HeroObjectCacheMixin } from "../utility/cache.mjs";
import {
    getPowerInfo,
    getCharacteristicInfoArrayForActor,
    squelch,
    whisperUserTargetsForActor,
    tokenEducatedGuess,
} from "../utility/util.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";
import { clamp } from "../utility/compatibility.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
import { roundFavorPlayerTowardsZero, roundFavorPlayerAwayFromZero } from "../utility/round.mjs";
import { HeroItemCharacteristic } from "../item/HeroSystem6eTypeDataModels.mjs";
import { tagObjectForPersistence } from "../migration.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { dehydrateAttackItem, userInteractiveVerifyOptionallyPromptThenSpendResources } from "../item/item-attack.mjs";
import { characteristicValueToDiceParts } from "../utility/damage.mjs";
import { Attack, actionToJSON } from "../utility/attack.mjs";
import { PresenceAttackApplication } from "../applications/apps/presence-attack.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const FoundryVttFilePicker = foundry.applications?.apps?.FilePicker?.implementation || FilePicker;

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class HeroSystem6eActor extends HeroObjectCacheMixin(Actor) {
    static Speed2Segments = [
        [0],
        [7],
        [6, 12],
        [4, 8, 12],
        [3, 6, 9, 12],
        [3, 5, 8, 10, 12],
        [2, 4, 6, 8, 10, 12],
        [2, 4, 6, 7, 9, 11, 12],
        [2, 3, 5, 6, 8, 9, 11, 12],
        [2, 3, 4, 6, 7, 8, 10, 11, 12],
        [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ];

    /** @inheritdoc */
    // Pre-process a creation operation for a single Document instance.
    // Pre-operation events only occur for the client which requested the operation.
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        //TODO: Add user configuration for initial prototype settings

        // Only updateSource when is5e is undefined.
        // When is5e is defined then we are likely drag/drop to/drop a
        // compendium and all this data already exists so don't overwrite.
        if (this.system.is5e == undefined) {
            HEROSYS.log(false, "_preCreate");
            let prototypeToken = {
                displayBars: CONST.TOKEN_DISPLAY_MODES.HOVER,
                displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
            };

            if (this.type !== "npc") {
                prototypeToken = {
                    ...prototypeToken,
                    actorLink: true,
                    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
                    displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
                    displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
                };
            }

            const is5e =
                options.is5e != undefined
                    ? options.is5e
                    : game.settings.get(HEROSYS.module, "DefaultEdition") === "five"
                      ? true
                      : false;

            // Set XMLID for characteristics
            // Used with conditional defenses, also for future baseInfo calls
            for (const key of Object.keys(this.system).filter((o) => o.match(/[A-Z]/))) {
                const char = this.system[key];
                if (char instanceof HeroItemCharacteristic && !char.XMLID) {
                    this.updateSource({ [`system.${key}.XMLID`]: key, [`system.${key}.xmlTag`]: key });
                }
            }

            this.updateSource({
                prototypeToken: prototypeToken,
                system: {
                    versionHeroSystem6eCreated: game.system.version,
                    is5e,
                },
                flags: {
                    [`${game.system.id}`]: {
                        file: {
                            lastModifiedDate: Date.now(),
                            uploadedBy: user.name,
                            name: `[FoundryVTT actor]`,
                        },
                    },
                },
            });

            // Characteristic defaults
            for (const charBaseInfo of getCharacteristicInfoArrayForActor(this)) {
                const base = this.system.characteristics[charBaseInfo.key.toLowerCase()]?.base || 0;
                this.updateSource({
                    [`system.characteristics.${charBaseInfo.key.toLowerCase()}.value`]: base,
                    [`system.characteristics.${charBaseInfo.key.toLowerCase()}.max`]: base,
                });
            }

            if (this.type === "pc" || this.type === "npc" || this.type === "automaton") {
                await this.addFreeStuff();
            }

            // REF: https://foundryvtt.wiki/en/development/api/document _preCreate
            // Careful: toObject only returns system props that are part of schema
            // so we merge in the entire system
            // Also need to use force replace ==items for this to work in v13
            const items = this.items.map((i) => ({ ...i.toObject(), system: i.system }));
            this.updateSource({
                [`==items`]: items,
            });
        }

        // For debugging purposes
        window.actor = this;
    }

    // Post-process a creation operation for a single Document instance. Post-operation events occur for all connected clients.
    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
    }

    /**
     * Prepare data for the Document. This method provides an opportunity for Document classes to define special data
     * preparation logic to compute values that don't need to be stored in the database, such as a "bloodied" hp value
     * or the total carrying weight of items. The work done by this method should be idempotent per initialization.
     * There are situations in which prepareData may be called more than once.
     *
     * By default, foundry calls the following methods in order whenever the document is created or updated.
     * 1. {@link reset} (Inherited from DataModel)
     * 2. {@link _initialize} (Inherited from DataModel)
     * 3. {@link prepareData}
     * 4. {@link foundry.abstract.TypeDataModel.prepareBaseData | TypeDataModel#prepareBaseData}
     * 5. {@link prepareBaseData}
     * 6. {@link prepareEmbeddedDocuments}
     * 7. {@link foundry.abstract.TypeDataModel.prepareDerivedData | TypeDataModel#prepareBaseData}
     * 8. {@link prepareDerivedData}
     *
     * Do NOT invoke database operations like {@link update} or {@link setFlag} within data prep, as that can cause an
     * infinite loop by re-triggering the data initialization process.
     *
     * If possible you should extend {@link prepareBaseData} and {@link prepareDerivedData} instead of this function
     * directly, but some systems with more complicated calculations may want to override this function to add extra
     * steps, such as to calculate certain item values after actor data prep.
     */
    prepareData() {
        super.prepareData();
    }

    /**
     * Prepare all embedded Document instances which exist within this primary Document.
     */
    prepareEmbeddedDocuments() {
        super.prepareEmbeddedDocuments();
    }

    /**
     * Apply transformations or derivations to the values of the source data object.
     * Compute data fields whose values are not stored to the database.
     *
     * If possible when modifying the `system` object you should use
     * {@link foundry.abstract.TypeDataModel.prepareDerivedData | TypeDataModel#prepareDerivedData} on your data models
     * instead of this method directly on the document.
     */
    prepareDerivedData() {
        super.prepareDerivedData();

        this._clearCachedObjectData();

        this.composeMemoizableObjectFunction("analyzeEndurance");
        this.composeMemoizableObjectFunction("getActorCharacterAndActivePoints");
    }

    /**
     * Clear all cached object data.
     * @internal
     */
    _clearCachedObjectData() {
        // Clear all the rest
        this._lazy = {};
    }

    /// Override and should probably be used instead of add/remove ActiveEffect
    async toggleStatusEffect(statusId, { active, overlay = false } = {}) {
        const overlayEffects = [
            HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id,
            HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id,
            HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id,
        ];

        // Overlay Effects
        if (overlayEffects.includes(statusId)) {
            overlay = true;
        }

        // If dead don't knockOut or Stun
        if (this.statuses.has("dead") && active) {
            if (
                [
                    HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id,
                    HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id,
                ].includes(statusId)
            ) {
                return;
            }
        }

        // Toggle effect
        try {
            await super.toggleStatusEffect(statusId, { active, overlay });
        } catch (e) {
            console.error(e, statusId);
        }

        // Several status effects also imply prone
        if (
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id) ||
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id) ||
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.unconsciousEffect.id) ||
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.asleepEffect.id)
        ) {
            if (!this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id)) {
                await super.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
                    active: true,
                });
            }
        }

        // When knockedOut, remove stunned
        if (
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id) &&
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id)
        ) {
            await super.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id, {
                active: false,
            });
        }

        // When dead, remove knockedOut
        if (
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id) &&
            this.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id)
        ) {
            await super.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id, {
                active: false,
            });
        }

        // Make overlay effects more obvious by changing the tint on the token img
        if (overlayEffects.includes(statusId)) {
            for (const token of this.getActiveTokens()) {
                if (this.statuses.has("dead")) {
                    await token.document.update({ alpha: 0.3, [`texture.tint`]: `ff0000` });
                    await token.layer._sendToBackOrBringToFront(false); // send to back
                } else if (this.statuses.has("knockedOut")) {
                    if (this.knockedOutOfCombat) {
                        await token.document.update({ alpha: 1, [`texture.tint`]: "ff0000" });
                    } else {
                        await token.document.update({ alpha: 1, [`texture.tint`]: "ffff00" });
                    }
                } else if (this.statuses.has("stunned")) {
                    await token.document.update({ alpha: 1, [`texture.tint`]: "ffff00" });
                } else {
                    await token.document.update({ alpha: 1, [`texture.tint`]: null });
                }
            }
        }
    }

    async removeActiveEffect(activeEffect) {
        console.warn("Consider using 'toggleStatusEffect'", this, activeEffect);
        if (!activeEffect) {
            console.warn("removeActiveEffect is missing a parameter", this);
        }
        const existingEffect = Array.from(this.allApplicableEffects()).find(
            (o) => o.id === activeEffect.id || o.statuses.has(activeEffect.id),
        );
        if (existingEffect) {
            if (activeEffect.id == "knockedOut") {
                // When they wakes up, their END equals their
                // current STUN total.
                let newEnd = Math.min(
                    parseInt(this.system.characteristics.stun.value),
                    parseInt(this.system.characteristics.end.max),
                );
                await this.update({
                    "system.characteristics.end.value": newEnd,
                });
            }

            await existingEffect.delete();
        }

        for (const token of this.getActiveTokens()) {
            if (this.statuses.has("dead")) {
                await token.document.update({ alpha: 0.3, [`texture.tint`]: `ff0000` });
                await token.layer._sendToBackOrBringToFront(false); // send to back
            } else if (this.statuses.has("knockedOut")) {
                await token.document.update({ alpha: 1, [`texture.tint`]: "ffff00" });
            } else if (this.statuses.has("stunned")) {
                await token.document.update({ alpha: 1, [`texture.tint`]: "ffff00" });
            } else {
                await token.document.update({ alpha: 1, [`texture.tint`]: null });
            }
        }
    }

    // Adding ActiveEffects seems complicated.
    // Make sure only one of the same ActiveEffect is added
    // Assumes ActiveEffect is a statusEffects.
    // TODO: Allow for a non-statusEffects ActiveEffect (like from a power)
    async addActiveEffect(activeEffect) {
        console.warn("Consider using 'toggleStatusEffect'", activeEffect);
        const newEffect = foundry.utils.deepClone(activeEffect);

        // Check for standard StatusEffects
        // statuses appears to be necessary to associate with StatusEffects
        if (activeEffect.id) {
            newEffect.statuses = [activeEffect.id];

            // Check if this ActiveEffect already exists
            const existingEffect = this.effects.find(
                (o) => o.statuses.has(activeEffect.id) && !activeEffect.id.includes("DRAIN"),
            );
            if (!existingEffect) {
                await this.createEmbeddedDocuments("ActiveEffect", [newEffect]);
            } else {
                console.warn("There was a pre-existing ActiveEffect, so the new AE was not added.");
            }
        }

        if (activeEffect.id == "knockedOut") {
            // Knocked Out overrides Stunned
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);
        }
    }

    async changeType() {
        const template = `systems/${HEROSYS.module}/templates/chat/actor-change-type-dialog.hbs`;
        const actor = this;
        let cardData = {
            actor,
            groupName: "typeChoice",
            choices: Actor.TYPES.filter((o) => o != "character" && o != "base").reduce(
                (a, v) => ({ ...a, [v]: v.replace("2", "") }),
                {},
            ), // base is internal type and/or keyword. BASE2 is for bases.
            chosen: actor.type,
        };
        const content = await foundryVttRenderTemplate(template, cardData);

        await foundry.applications.api.DialogV2.prompt({
            window: { title: `Change ${this.name} Type` },
            content,
            ok: {
                label: "Apply",
                callback: (event, button) => button.form.elements.actorType.value,
            },
            submit: async (result) => {
                if (result) await this._changeType(result);
                else console.error(`User picked option: ${result}`);
            },
        });
    }

    async _changeType(newType) {
        await this.update(
            {
                type: newType,
                [`==system`]: this.system,
            },
            { recursive: false },
        );
    }

    /* -------------------------------------------- */

    /**
     * Handle how changes to a Token attribute bar are applied to the Actor.
     * This allows for game systems to override this behavior and deploy special logic.
     * @param {string} attribute    The attribute path
     * @param {number} value        The target attribute value
     * @param {boolean} isDelta     Whether the number represents a relative change (true) or an absolute change (false)
     * @param {boolean} isBar       Whether the new value is part of an attribute bar, or just a direct value
     * @returns {Promise<documents.Actor>}  The updated Actor document
     */
    async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
        const current = foundry.utils.getProperty(this.system, attribute);

        // Determine the updates to make to the actor data
        let updates;
        if (isBar) {
            if (isDelta) value = clamp(-99, Number(current.value) + value, current.max); // a negative bar is typically acceptable
            updates = { [`system.${attribute}.value`]: value };
        } else {
            if (isDelta) value = Number(current) + value;
            updates = { [`system.${attribute}`]: value };
        }
        const allowed = Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates);
        return allowed !== false ? this.update(updates) : this;
    }

    async _preUpdate(changed, options, userId) {
        await super._preUpdate(changed, options, userId);

        // Forward changed date to _onUpdate.
        // _preUpdate only seems to run for GM or one user which
        // results in _displayScrollingChange only showing for those users.
        // Where as _onUpdate runs for all users.
        options.displayScrollingChanges = [];

        let content = "";

        const ShowCombatCharacteristicChanges = game.settings.get(game.system.id, "ShowCombatCharacteristicChanges");
        const ShowCombatCharacteristicChangesBool =
            ShowCombatCharacteristicChanges === "all"
                ? true
                : ShowCombatCharacteristicChanges === "pc" && this.type === "pc"
                  ? true
                  : false;

        if (changed?.system?.characteristics?.stun?.value && ShowCombatCharacteristicChangesBool) {
            const valueT = parseInt(this.system.characteristics.stun.value);
            const valueC = parseInt(changed.system.characteristics.stun.value);
            const valueM = parseInt(this.system.characteristics.stun.max);
            if (valueT != valueC) {
                content += `STUN from ${valueT} to ${valueC}`;

                if (valueC === valueM) {
                    content += " (at max)";
                }

                //this._displayScrollingChange(valueC - valueT, { max: valueM, fill: '0x00FF00' });
                options.displayScrollingChanges.push({
                    value: valueC - valueT,
                    options: { max: valueM, fill: "0x00FF00" },
                });
            }
        }

        if (changed?.system?.characteristics?.body?.value && ShowCombatCharacteristicChangesBool) {
            const valueT = parseInt(this.system.characteristics.body.value);
            const valueC = parseInt(changed.system.characteristics.body.value);
            const valueM = parseInt(this.system.characteristics.body.max);
            if (content.length > 0) {
                content += "<br>";
            }
            if (valueT != valueC) {
                content += `BODY from ${valueT} to ${valueC}`;

                if (valueC === valueM) {
                    content += " (at max)";
                }

                options.displayScrollingChanges.push({
                    value: valueC - valueT,
                    options: { max: valueM, fill: "0xFF1111" },
                });
            }
        }

        if (options.hideChatMessage || !options.render) return;

        if (content) {
            const chatData = {
                author: game.user.id,
                whisper: whisperUserTargetsForActor(this), //ChatMessage.getWhisperRecipients("GM"),
                speaker: ChatMessage.getSpeaker({ actor: this }),
                blind: true,
                content: content,
            };
            await ChatMessage.create(chatData);
        }

        // Chat card about entering/leaving heroic identity
        if (
            changed.system?.heroicIdentity !== undefined &&
            this.system.heroicIdentity !== undefined &&
            changed.system.heroicIdentity !== this.system.heroicIdentity
        ) {
            const token = this.getActiveTokens()[0];
            const speaker = ChatMessage.getSpeaker({ actor: this, token });
            const tokenName = token?.name || this.name;
            speaker["alias"] = game.user.name;
            const content = `<b>${tokenName}</b> ${changed.system.heroicIdentity ? "entered" : "left"} their heroic identity.`;
            const chatData = {
                style: CONST.CHAT_MESSAGE_STYLES.IC,
                author: game.user._id,
                content: content,
                speaker: speaker,
            };
            await ChatMessage.create(chatData);
        }
    }

    async _onUpdate(data, options, userId) {
        await super._onUpdate(data, options, userId);

        // Only owners have permission to perform updates
        if (!this.isOwner) {
            return;
        }

        // Mark as undefeated in combat tracker (pc/npc)
        if (
            (data.system?.characteristics?.body?.value ?? this.system.characteristics.body.value) >
                -this.system.characteristics.body.value &&
            this.statuses.has("dead")
        ) {
            await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
                active: false,
            });
        }

        // If stun was changed and running under triggering users context
        if (
            (data.system?.characteristics?.stun !== undefined || data.system?.characteristics?.body !== undefined) &&
            userId === game.user.id &&
            this.hasCharacteristic("STUN")
        ) {
            const newStun = data.system?.characteristics?.stun?.value ?? this.system.characteristics.stun.value;

            if (newStun <= 0) {
                await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id, {
                    overlay: true,
                    active: true,
                });
            }

            // Remove STUN condition, unless this was part of a PostSegment12 recovery
            if (newStun > 0) {
                if (!options.preventRecoverFromStun) {
                    await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id, {
                        active: false,
                    });
                    await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.bleedingEffect.id, {
                        active: false,
                    });
                    await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
                        active: false,
                    });
                }
            }
        }

        // Mark as defeated in combat tracker (automaton)
        // PH: FIXME: This is not correct for 5e (for instance could buy "cannot bleed" AUTOMATON power) _unless_ they have
        //            the STUN1 or STUN2 OPTIONID for the AUTOMATON power.
        //            6e seems to follow the same rules.
        if (data.system?.characteristics?.body?.value <= 0) {
            const AUTOMATON = this.items.find((o) => o.system.XMLID === "AUTOMATON");
            if (AUTOMATON) {
                await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
                    overlay: true,
                    active: true,
                });
            }
        }

        // Mark as defeated in combat tracker (pc/npc)
        if (
            ["pc", "npc"].includes(this.type) &&
            data.system?.characteristics?.body?.value <= -this.system.characteristics.body.max
        ) {
            await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
                overlay: true,
                active: true,
            });
        }

        // Mark as undefeated in combat tracker (automaton)
        if (this.type === "automaton" && data.system?.characteristics?.body?.value > 0) {
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect);
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.bleedingEffect);
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect);
        }

        // If STR was change check encumbrance
        if (data?.system?.characteristics?.str && userId === game.user.id && options.render !== false) {
            await this.applyEncumbrancePenalty();
        }

        // VEHICLE & BASE SIZE
        if (data?.system?.characteristics?.size || data?.system?.characteristics?.basesize) {
            await this.applySizeEffect();
        }

        // Ensure natural healing effect is removed when returned to full BODY
        if (data?.system?.characteristics?.body || data?.system?.characteristics?.rec) {
            await this.setNaturalHealing();
        }

        // Heroic ID
        if (data.system?.heroicIdentity !== undefined) {
            // Toggled on (entering ID)
            if (data.system.heroicIdentity) {
                for (const item of this.items.filter((item) => item.findModsByXmlid("OIHID") && !item.system.active)) {
                    if (item.flags[game.system.id]?.preOIHID) {
                        await item.toggle(); // toggle on
                    }
                }
            } else {
                // Use flags to keep track which items were disabled so we will enable them when we go back into heroic ID
                for (const item of this.items.filter((item) => item.findModsByXmlid("OIHID"))) {
                    await item.update({ [`flags.${game.system.id}.preOIHID`]: item.system.active });
                    if (item.system.active) {
                        await item.toggle(); // toggle off
                    }
                }
            }
        }

        // If LEVELS were changed, update MAX and VALUE
        // TODO: This can mess up adjustment powers as they fade
        if (data.system) {
            for (const charKEY of Object.keys(data.system)) {
                if (data.system[charKEY].LEVELS != null) {
                    const charKey = charKEY.toLowerCase();
                    if (this.system.characteristics[charKey]) {
                        const basePlusLevels = this.system.characteristics[charKey].basePlusLevels;
                        await this.update({
                            [`system.characteristics.${charKey}.max`]: basePlusLevels,
                        });
                        await this.update({
                            [`system.characteristics.${charKey}.value`]: this.system.characteristics[charKey].max,
                        });

                        // Check for any figuredCharacteristic dependencies.
                        await this.updateFiguredCharacteristicDependencies(charKey);
                    } else {
                        console.error(`Unhandled characteristic key ${charKey}`, data);
                    }
                }
            }
        }

        // 5e calculated characteristics
        if (this.is5e && data.system?.characteristics) {
            const characteristicInfoArrayForActor = getCharacteristicInfoArrayForActor(this); // a bit of caching
            const changes = {};
            for (const changeKey of Object.keys(data.system.characteristics)) {
                if (data.system.characteristics[changeKey].value !== undefined) {
                    for (const char of characteristicInfoArrayForActor.filter(
                        (o) => o.behaviors.includes(`calculated${changeKey.toUpperCase()}`) || o.key == changeKey,
                    )) {
                        const key = char.key.toLocaleLowerCase();

                        if (char.calculated5eCharacteristic) {
                            const newValue = char.calculated5eCharacteristic(this);
                            changes[`system.characteristics.${key}.max`] = newValue;
                            changes[`system.characteristics.${key}.value`] = newValue;
                        }
                    }
                }
            }

            if (Object.keys(changes).length > 0) {
                await this.update(changes);
            }
        }

        // Display changes from _preUpdate
        for (let d of options.displayScrollingChanges) {
            this._displayScrollingChange(d.value, d.options);
        }
    }

    sizeDetails(size) {
        let _size = Math.max(0, parseInt(size || this.system.characteristics.size?.value || 0));
        if (this.type === "base2") {
            _size = 6 + Math.max(0, parseInt(size || this.system.characteristics.basesize?.value || 0));
        }

        const values =
            this.type === "base2"
                ? {
                      length: 0,
                      width: 0,
                      height: 0,
                      volume: 0,
                      dcv: -Math.floor((_size * 2) / 3), // 5e has DCV penalty to base/vehicle. 6e has OCV bonus to attacker. Need to distinguish.
                      mass: 0,
                      str: 0, // TODO: bases don't have STR so this really shouldn't be here.
                      kbResistance: 0, // TODO: bases don't have STR so this really shouldn't be here.
                      body: 0,
                  }
                : {
                      length: 0,
                      width: 0,
                      height: 0,
                      volume: 0,
                      dcv: -Math.floor((_size * 2) / 3),
                      mass: 0,
                      str: _size * 5,
                      kbResistance: _size,
                      body: _size,
                  };
        values.description =
            _size > 0
                ? // `L${values.length}, W${values.width}, ` +
                  // `H${values.height}, V${values.volume}, ` +
                  `${values.dcv ? `DCV${values.dcv}, ` : ``}` +
                  // `Mass${values.mass}, ` +
                  `STR+${values.str}, KB-${values.kbResistance}, BODY+${values.body}`
                : "";
        return values;
    }

    // Check for any figuredCharacteristic dependencies of the changedCharKey.
    async updateFiguredCharacteristicDependencies(changedCharKey) {
        const _getCharacteristicInfoArrayForActor = getCharacteristicInfoArrayForActor(this);
        for (const charPowerInfo of _getCharacteristicInfoArrayForActor.filter((o) =>
            o.behaviors.includes(`figured${changedCharKey.toUpperCase()}`),
        )) {
            const key = charPowerInfo.key.toLocaleLowerCase();

            if (charPowerInfo.figured5eCharacteristic) {
                const levels = this.system[charPowerInfo.key].LEVELS;
                if (levels == null) {
                    console.warn(`${this.name} has ${key}.LEVELS that is ${levels}`);
                }

                // Kludge: we only need to floor SPD as everything is prerounded. If we don't round then
                //         committing to the database will kindly round to an integer for us.
                const newValue = Math.floor(charPowerInfo.figured5eCharacteristic(this) + (levels ?? 0));

                // Intentionally making 2 update calls to allow for AEs to kick in for max so we can set value to match
                // TODO: May break adjustment powers
                await this.update({ [`system.characteristics.${key}.max`]: newValue });
                await this.update({
                    [`system.characteristics.${key}.value`]: this.system.characteristics[key].max,
                });
            }
        }
    }

    async TakeRecovery({ asAction, token, preventRecoverFromStun }) {
        if (asAction == undefined) {
            console.error(`TakeRecovery asAction is ${asAction}`, this);
        }

        if (token == undefined) {
            console.warn(`TakeRecovery token is ${token}`, this);
        }

        // RECOVERING
        // Characters use REC to regain lost STUN and expended END.
        // This is known as “Recovering” or “taking a Recovery.”
        // When a character Recovers, add their REC to their current
        // STUN and END totals (to a maximum of their full values, of
        // course). Characters get to Recover in two situations: Post-
        // Segment and when they choose to Recover as a Full Phase
        // Action.

        // RECOVERING AS AN ACTION
        // Recovering is a Full Phase Action and occurs at the end of
        // the Segment (after all other characters who have a Phase that
        // Segment have acted). A character who Recovers during a Phase
        // may do nothing else. They cannot even maintain a Constant Power
        // or perform Actions that cost no END or take no time. However,
        // they may take Zero Phase Actions at the beginning of their Phase
        // to turn off Powers, and Persistent Powers that don’t cost END
        // remain in effect.

        // If not a PC and DEAD then don't recover
        if (this.type !== "pc" && this.statuses.has("dead")) {
            if (asAction) {
                ui.notifications.error(`${this.name} is Defeated/Dead and cannot take a recovery.`);
            }
            return;
        }

        token = token || this.getActiveTokens()[0];
        const speaker = ChatMessage.getSpeaker({ actor: this, token });
        const tokenName = token?.name || this.name;

        if (!asAction && this.statuses.has("knockedOut")) {
            if (this.system.characteristics.stun?.value <= -31) {
                return `${tokenName} is knockedOut for "a long time" and does not get a recovery (untracked).`;
            }
            if (this.system.characteristics.stun?.value <= -30) {
                return `${tokenName} is knockedOut and only gets a recovery once per minute (untracked).`;
            }
            // stun.value <=-20 (Post-Segment 12 only)
            // stun.value <=-10 (Every Phase and Post-Segment 12)
        }

        // Bases don't get/need a recovery
        if (this.type === "base2") {
            console.log(`${token?.name || this.name} has type ${this.type} and does not get/need a recovery.`);
            if (asAction) {
                ui.notifications.warn(
                    `${token?.name || this.name} has type ${this.type} and does not get/need a recovery.`,
                );
            }
            return `${tokenName} is a BASE and does not get a recovery.`;
        }

        // Catchall for no stun or end (shouldn't be needed as base type check above should be sufficient)
        if ((this.system.characteristics.end?.max || 0) === 0 && (this.system.characteristics.stun?.max || 0) === 0) {
            console.log(`${token?.name || this.name} has no STUN or END thus does not get/need a recovery.`);
            if (asAction) {
                ui.notifications.warn(
                    `${token?.name || this.name} has no STUN or END thus does not get/need a recovery.`,
                );
            }
            return `${tokenName} has no STUN or END characteristic and does not get a recovery.`;
        }

        // A character who holds their breath does not get to Recover (even
        // on Post-Segment 12)
        if (this.statuses.has("holdingBreath")) {
            const content = `${tokenName} <i>is holding their breath</i> and does not get a recovery.`;
            if (asAction) {
                const chatData = {
                    author: game.user._id,
                    style: CONST.CHAT_MESSAGE_STYLES.IC,
                    content: content,
                    speaker: speaker,
                };
                await ChatMessage.create(chatData);
            }
            return content;
        }

        const chars = this.system.characteristics;

        // Shouldn't happen, but you never know
        if (chars.stun && isNaN(parseInt(chars.stun.value))) {
            chars.stun.value = 0;
        }
        if (chars.end && isNaN(parseInt(chars.end.value))) {
            chars.end.value = 0;
        }

        // Need to account for negative RECovery
        const rec = Math.max(0, parseInt(chars.rec.value));

        let newStun = parseInt(chars.stun.value) + rec;
        let newEnd = Math.max(0, parseInt(chars.end.value)) + rec;

        // newEnd should not exceed newStun if current stun <=0
        if (chars.stun.value <= 0) {
            newEnd = Math.max(0, Math.min(newStun, newEnd));
        }

        if (newStun > chars.stun.max) {
            newStun = Math.max(chars.stun.max, parseInt(chars.stun.value)); // possible > MAX (which is OKish)
        }
        const deltaStun = newStun - parseInt(chars.stun.value);

        if (newEnd > chars.end.max) {
            newEnd = Math.max(chars.end.max, parseInt(chars.end.value)); // possible > MAX (which is OKish)
        }

        // Ignore negative deltaEnd values.
        // It seems like END should be set to 0 when you are KO'd, but haven't found such a rule.
        const deltaEnd = Math.max(0, newEnd - parseInt(chars.end.value));

        await this.update(
            {
                "system.characteristics.stun.value": newStun,
                "system.characteristics.end.value": newEnd,
            },
            { hideChatMessage: true, preventRecoverFromStun },
        );

        let content = `${tokenName} ${this.system.characteristics.stun?.value <= 0 ? "is knockedOut, " : ""}${asAction ? `<i>Takes a Recovery</i>` : "gets a recovery"}`;
        if (rec <= 0) {
            content += ` [REC=${chars.rec.value}]`;
        }
        if (deltaEnd || deltaStun) {
            if (chars.stun.value <= 0 && newStun > 0) {
                content += `, recovers from knockedOut, gaining ${deltaStun} stun and endurance set to ${newStun}.`;
            } else {
                content += `, gaining ${deltaEnd} endurance and ${deltaStun} stun.`;
            }
        } else {
            content += ".";
        }

        // ENDURANCERESERVE HACK
        if (asAction && !this.inCombat) {
            const ENDURANCERESERVE = this.items.find((item) => item.system.XMLID === "ENDURANCERESERVE");
            if (ENDURANCERESERVE) {
                const ENDURANCERESERVEREC = ENDURANCERESERVE.findModsByXmlid("ENDURANCERESERVEREC");
                const newValue = Math.min(
                    ENDURANCERESERVE.system.LEVELS,
                    ENDURANCERESERVE.system.value + parseInt(ENDURANCERESERVEREC.LEVELS),
                );
                if (newValue > ENDURANCERESERVE.system.value) {
                    const delta = newValue - ENDURANCERESERVE.system.value;
                    await ENDURANCERESERVE.update({
                        "system.value": Math.min(
                            parseInt(ENDURANCERESERVE.system.value) + ENDURANCERESERVEREC.LEVELS,
                            ENDURANCERESERVE.system.LEVELS,
                        ),
                    });
                    content += ` ${ENDURANCERESERVE.name} +${delta} END</li>`;
                }
            }
        }

        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.IC,
            content: content,
            speaker: speaker,
            whisper: [...ChatMessage.getWhisperRecipients(this.name), ...ChatMessage.getWhisperRecipients("GM")],
        };

        if (asAction) {
            await ChatMessage.create(chatData);

            // Remove stunned condition. (Part of ACTOR:_ONUPDATE?)
            // While not technically part of the rules, it is here as a convenience.
            // For example when Combat Tracker isn't being used.
            //await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);
            // await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id, {
            //     active: true,
            // });
        }

        if (asAction && this.inCombat) {
            // While Recovering, a character is at ½ DCV
            const existingEffect = Array.from(this.temporaryEffects).find((o) => o.flags[game.system.id]?.takeRecovery);
            if (!existingEffect) {
                const activeEffect = {
                    name: "TakeRecovery",
                    img: `icons/svg/downgrade.svg`,
                    changes: [
                        {
                            key: "system.characteristics.dcv.max",
                            value: 0.5,
                            mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                        },
                    ],
                    origin: this.uuid,
                    duration: {
                        seconds: 1,
                    },
                    flags: {
                        [game.system.id]: {
                            takeRecovery: true,
                            expiresOn: "segmentStart",
                        },
                    },
                };
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            } else {
                ui.notifications.warn("Taking multiple recoveries is typically not allowed.");
            }
        }

        return content;
    }

    // Only used by _canDragLeftStart to prevent ENTANGLED tokens from moving
    canMove(uiNotice, event) {
        // Let GM move if holding ALT key
        if (event?.altKey && game.user.isGM) return true;

        let result = true;
        let badStatus = [];

        if (this.statuses.has("entangled")) {
            badStatus.push("ENTANGLED");
            result = false;
        }

        if (this.statuses.has("knockedOut")) {
            if (uiNotice) badStatus.push("KNOCKED OUT");
            result = false;
        }

        if (this.statuses.has("stunned")) {
            badStatus.push("STUNNED");
            result = false;
        }

        if (this.statuses.has("aborted")) {
            badStatus.push("ABORTED");
            result = false;
        }

        if (!result && overrideCanAct) {
            const speaker = ChatMessage.getSpeaker({
                actor: this,
            });
            speaker["alias"] = game.user.name;

            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.IC,
                content: `${this.name} is ${badStatus.join(", ")} and cannot move. Override key was used.`,
                whisper: whisperUserTargetsForActor(this),
                speaker,
            };
            ChatMessage.create(chatData);

            result = true;
        }

        if (!result) {
            const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            ui.notifications.error(
                `${this.name} is ${badStatus.join(", ")} and cannot move.  Hold <b>${overrideKeyText}</b> to override. 
                ${overrideKeyText === "ControlLeft" ? `Use SPACEBAR to follow measured movement path.` : ""}`,
            );
        }

        if (result && this.statuses.has("prone")) {
            ui.notifications.warn(`${this.name} is prone`);
        }

        return result;
    }

    // Abort effect - If in combat and not our turn then this must be an abort unless holding an action
    /**
     * Is there combat and is it the actor's turn to act?
     *
     * @returns {boolean}
     */
    needsToAbortToAct() {
        const currentCombatActorId = game.combat?.combatants.find(
            (combatant) => combatant.tokenId === game.combat.current?.tokenId,
        )?.actorId;
        const thisActorsCombatTurn =
            game.combat?.active && currentCombatActorId != undefined && currentCombatActorId === this.id;
        const thisActorHoldingAnAction = this.statuses.has("holding");

        if (game.combat?.active && !thisActorsCombatTurn && !thisActorHoldingAnAction) {
            console.warn(`Is there combat and is it the actor's turn to act?`, this);
            return true;
        }

        return false;
    }

    // When stunned, knockedout, etc you cannot act
    canAct(uiNotice, event) {
        // Bases can always act (used for token attacher)
        if (this.type === "base2") return true;

        let result = true;
        let badStatus = [];

        // Is knocked out?
        if (this.statuses.has("knockedOut")) {
            if (uiNotice) badStatus.push("KNOCKED OUT");
            result = false;
        }

        // Is stunned?
        if (this.statuses.has("stunned")) {
            badStatus.push("STUNNED");
            result = false;
        }

        // Is already aborted?
        if (this.statuses.has("aborted")) {
            badStatus.push("ABORTED");
            result = false;
        }

        // Is not actor's turn to act
        // AaronWasHere 3/30/2025: Was unable to full heal Spctral Daemon LordB
        //  which tries to toggle on FLIGHT.  It was not part of the combat tracker.
        // if (this.needsToAbortToAct()) {
        //     badStatus.push("NOT THE ACTIVE COMBATANT");
        //     result = false;
        // }

        // No speed?
        if (parseInt(this.system.characteristics.spd?.value || 0) < 1) {
            if (uiNotice) badStatus.push("SPD1");
            result = false;
        }

        if (!result && overrideCanAct) {
            const speaker = ChatMessage.getSpeaker({
                actor: this,
            });
            speaker["alias"] = game.user.name;

            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.IC,
                content: `${this.name} is ${badStatus.join(", ")} and cannot act. Override key was used.`,
                whisper: whisperUserTargetsForActor(this),
                speaker,
            };
            ChatMessage.create(chatData);

            result = true;
        }

        if (!result && !event) {
            console.error("event missing");
        }

        if (!result) {
            const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            ui.notifications.error(
                `${this.name} is ${badStatus.join(", ")} and cannot act.  Hold <b>${overrideKeyText}</b> to override.`,
            );
        }

        return result;
    }

    /**
     * Display changes to health as scrolling combat text.
     * Adapt the font size relative to the Actor's HP total to emphasize more significant blows.
     * @param {*} change
     * @param {*} options
     */
    _displayScrollingChange(change, options) {
        if (!change) return;
        const tokens = this.getActiveTokens();
        if (!tokens) return;
        const token = tokens[0];
        if (!token) return;
        options = options || {};

        let fontSize = 50;
        if (options.max) {
            fontSize += Math.floor((Math.abs(change) / options.max) * fontSize);
        }

        canvas.interface.createScrollingText(token.center, change.signedStringHero(), {
            anchor: change < 0 ? CONST.TEXT_ANCHOR_POINTS.BOTTOM : CONST.TEXT_ANCHOR_POINTS.TOP,
            direction: change < 0 ? 1 : 2,
            fontSize: clamp(fontSize, 50, 100),
            fill: options?.fill || "0xFFFFFF",
            stroke: options?.stroke || 0x00000000,
            strokeThickness: 4,
            jitter: 0.25,
        });
    }

    strDetails(str) {
        let strLiftText = "0kg";
        let strRunningThrow = 0;
        const value = str || this.system.characteristics.str?.value;

        if (value >= 105) {
            strLiftText = `${50 + Math.floor((value - 105) / 5) * 25} ktons`;
            strRunningThrow = 168 + Math.floor((value - 105) / 5) * 8;
        } else if (value >= 100) {
            strLiftText = "25 ktons";
            strRunningThrow = 160;
        } else if (value >= 95) {
            strLiftText = "12.5 ktons";
            strRunningThrow = 152;
        } else if (value >= 90) {
            strLiftText = "6.4 ktons";
            strRunningThrow = 144;
        } else if (value >= 85) {
            strLiftText = "3.2 ktons";
            strRunningThrow = 136;
        } else if (value >= 80) {
            strLiftText = "1.6 ktons";
            strRunningThrow = 128;
        } else if (value >= 75) {
            strLiftText = "800 tons";
            strRunningThrow = 120;
        } else if (value >= 70) {
            strLiftText = "400 tons";
            strRunningThrow = 112;
        } else if (value >= 65) {
            strLiftText = "200 tons";
            strRunningThrow = 104;
        } else if (value >= 60) {
            strLiftText = "100 tons";
            strRunningThrow = 96;
        } else if (value >= 55) {
            strLiftText = "50 tons";
            strRunningThrow = 88;
        } else if (value >= 50) {
            strLiftText = "25 tons";
            strRunningThrow = 80;
        } else if (value >= 45) {
            strLiftText = "12.5 tons";
            strRunningThrow = 72;
        } else if (value >= 40) {
            strLiftText = "6,400kg";
            strRunningThrow = 64;
        } else if (value >= 35) {
            strLiftText = "3,200kg";
            strRunningThrow = 56;
        } else if (value >= 30) {
            strLiftText = "1,600kg";
            strRunningThrow = 48;
        } else if (value >= 28) {
            strLiftText = "1,200kg";
            strRunningThrow = 44;
        } else if (value >= 25) {
            strLiftText = "800kg";
            strRunningThrow = 40;
        } else if (value >= 23) {
            strLiftText = "600kg";
            strRunningThrow = 36;
        } else if (value >= 20) {
            strLiftText = "400kg";
            strRunningThrow = 32;
        } else if (value >= 18) {
            strLiftText = "300kg";
            strRunningThrow = 28;
        } else if (value >= 15) {
            strLiftText = "200kg";
            strRunningThrow = 24;
        } else if (value >= 13) {
            strLiftText = "150kg";
            strRunningThrow = 20;
        } else if (value >= 10) {
            strLiftText = "100kg";
            strRunningThrow = 16;
        } else if (value >= 8) {
            strLiftText = "75kg";
            strRunningThrow = 12;
        } else if (value >= 5) {
            strLiftText = "50kg";
            strRunningThrow = 8;
        } else if (value >= 4) {
            strLiftText = "38kg";
            strRunningThrow = 6;
        } else if (value >= 3) {
            strLiftText = "25kg";
            strRunningThrow = 4;
        } else if (value >= 2) {
            strLiftText = "16kg";
            strRunningThrow = 3;
        } else if (value >= 1) {
            strLiftText = "8kg";
            strRunningThrow = 2;
        }

        // 5e allows negative strength
        if (this.system.is5e) {
            if (value < -25) {
                strLiftText = "0kg";
                strRunningThrow = 0;
            } else if (value < -23) {
                strLiftText = "0.8kg";
                strRunningThrow = 1;
            } else if (value < -20) {
                strLiftText = "1kg";
                strRunningThrow = 1;
            } else if (value < -18) {
                strLiftText = "1.6kg";
                strRunningThrow = 1;
            } else if (value < -15) {
                strLiftText = "2kg";
                strRunningThrow = 1;
            } else if (value < -13) {
                strLiftText = "3.2kg";
                strRunningThrow = 1;
            } else if (value < -10) {
                strLiftText = "4kg";
                strRunningThrow = 1;
            } else if (value < -8) {
                strLiftText = "6.4kg";
                strRunningThrow = 1;
            } else if (value < -5) {
                strLiftText = "8kg";
                strRunningThrow = 2;
            } else if (value < -3) {
                strLiftText = "12.5kg";
                strRunningThrow = 2;
            } else if (value < 0) {
                strLiftText = "16kg";
                strRunningThrow = 3;
            } else if (value < 3) {
                strLiftText = "25kg";
                strRunningThrow = 4;
            } else if (value < 5) {
                strLiftText = "37kg";
                strRunningThrow = 6;
            }
            strRunningThrow /= 2;
        }

        // Get numeric strLiftKg
        let m = strLiftText.replace(",", "").match(/(\d+)kg/);
        let strLiftKg = m ? m[1] : 0;

        m = strLiftText.replace(",", "").match(/(\d+) tons/);
        strLiftKg = m ? m[1] * 1000 : strLiftKg;

        m = strLiftText.replace(",", "").match(/(\d+) ktons/);
        strLiftKg = m ? m[1] * 1000 * 1000 : strLiftKg;

        return { strLiftText, strThrow: strRunningThrow, strLiftKg };
    }

    async applySizeEffect() {
        const size = parseInt(
            this.type === "base2"
                ? this.system.characteristics.basesize.value
                : this.system.characteristics.size?.value || 0,
        );
        const _sizeDetails = this.sizeDetails();

        const sizeActiveEffect =
            this.effects.find(
                (effect) => effect.name?.includes("size") && effect.flags[game.system.id]?.size === true,
            ) || {};
        if (_sizeDetails.body) {
            sizeActiveEffect.name = `size${size}`;
            sizeActiveEffect.img ??= "icons/svg/teleport.svg";
            sizeActiveEffect.flags ??= {
                [game.system.id]: {
                    size: true,
                },
            };
            sizeActiveEffect.changes = [];

            // FIXME: This is a DCV penalty to the base/vehicle in 5e and an OCV bonus to the attacker in 6e. Because it's
            // an OCV bonus to the attacker this isn't quite right but we always add it last so that it's not halved if
            // the defenders DCV is halved. Note that we are not affecting the attacker OCV which could be halved: this is not perfect.
            sizeActiveEffect.changes.push({
                key: "system.characteristics.dcv.max",
                value: _sizeDetails.dcv,
                mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                priority: this.is5e
                    ? CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD
                    : CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE, // 6e don't allow this to be halved - see note above
            });

            sizeActiveEffect.changes.push({
                key: "system.characteristics.str.max",
                value: _sizeDetails.str,
                mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
            });
            sizeActiveEffect.changes.push({
                key: "kbResistance",
                value: _sizeDetails.kbResistance,
                mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
            });
            sizeActiveEffect.changes.push({
                key: "system.characteristics.body.max",
                value: _sizeDetails.body,
                mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
            });

            if (sizeActiveEffect.id) {
                await sizeActiveEffect.update({ name: sizeActiveEffect.name, changes: sizeActiveEffect.changes });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [sizeActiveEffect]);
            }
        } else {
            if (sizeActiveEffect.id) {
                await sizeActiveEffect.delete();
            }
        }
    }

    async applyEncumbrancePenalty() {
        // Only 1 GM should do this
        if (!game.users.activeGM?.isSelf) return;

        const { strLiftKg } = this.strDetails();
        const encumbrance = this.encumbrance;

        // Is actor encumbered?
        let dcvDex = 0;
        const maxStrengthPct = roundFavorPlayerTowardsZero((100 * encumbrance) / strLiftKg);
        if (maxStrengthPct >= 90) {
            dcvDex = -5;
        } else if (maxStrengthPct >= 75) {
            dcvDex = -4;
        } else if (maxStrengthPct >= 50) {
            dcvDex = -3;
        } else if (maxStrengthPct >= 25) {
            dcvDex = -2;
        } else if (maxStrengthPct >= 10) {
            dcvDex = -1;
        }

        // Penalty Skill Levels for encumbrance
        for (const pslEncumbrance of this.items.filter(
            (item) => item.pslPenaltyType === CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.encumbrance && item.isActive,
        )) {
            dcvDex = Math.min(0, dcvDex + parseInt(pslEncumbrance.system.LEVELS));
        }

        // Movement
        let move = 0;
        switch (dcvDex) {
            case 0:
            // intentional fallthrough
            case -1:
                move = 0;
                break;
            case -2:
                move = -2;
                break;
            case -3:
                move = -4;
                break;
            case -4:
                move = -8;
                break;
            case -5:
                move = -16;
                break;
            default:
                console.error(`${this.name} has an unexpected dcvDex of ${dcvDex}`);
                break;
        }

        const name = `Encumbered ${maxStrengthPct}%`;
        const prevActiveEffects = this.effects.filter((o) => o.flags?.[game.system.id]?.encumbrance);

        // There should only be 1 encumbered effect, but with async loading we may have more
        // Use the first one, get rid of the rest
        for (let a = 1; a < prevActiveEffects.length; a++) {
            await prevActiveEffects[a].delete();
        }
        const prevActiveEffect = prevActiveEffects?.[0];
        if (dcvDex < 0 && prevActiveEffect?.flags?.[game.system.id]?.dcvDex != dcvDex) {
            const activeEffect = {
                name: name,
                id: "encumbered",
                img: `systems/${HEROSYS.module}/icons/encumbered.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: dcvDex,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.dex.max",
                        value: dcvDex,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.running.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.swimming.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.leaping.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.flight.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.swinging.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.teleportation.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.tunneling.max",
                        value: move,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ],
                origin: this.uuid,
                flags: {
                    [game.system.id]: { dcvDex: dcvDex, encumbrance: true },
                },
            };

            if (prevActiveEffect) {
                //await prevActiveEffect.delete();
                await prevActiveEffect.update({
                    name: name,
                    changes: activeEffect.changes,
                    origin: activeEffect.origin,
                    flags: activeEffect.flags,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }

            // If we have control of this token, re-acquire to update movement types
            const myToken = this.getActiveTokens()?.[0] || {};
            if (canvas.tokens.controlled.find((token) => token.id === myToken.id)) {
                myToken.release();
                myToken.control();
            }

            return;
        }

        if (dcvDex === 0 && prevActiveEffect) {
            await prevActiveEffect.delete();
        } else if (prevActiveEffect && prevActiveEffect.name !== name) {
            await prevActiveEffect.update({ name: name });
        }
        // else if (prevActiveEffect && prevActiveEffect.name != name) {
        //     await prevActiveEffect.update({ name: name });
        // }

        // At STR 0, halve the character’s Running,
        // Leaping, Swimming, Swinging, Tunneling, and
        // Flight based on muscle power (such as most types
        // of wings). The GM may require the character to
        // succeed with STR Rolls just to stand up, walk, and
        // perform similar mundane exertions.
        // At STR 0, halve the character’s DCV.
        // For every 2x mass a character has above the
        // standard human mass of 100 kg, the effects of STR
        // 0 on movement and DCV occur 5 points of STR
        // sooner.
        const massMultiplier = this.items
            .filter((item) => item.system.XMLID === "DENSITYINCREASE" && item.isActive)
            .reduce((accum, currItem) => accum + parseInt(currItem.system.LEVELS), 0);
        const minStr = massMultiplier * 5;

        const prevStr0ActiveEffect = this.effects.find((effect) => effect.flags?.[game.system.id]?.str0);
        if (this.system.characteristics.str?.value <= minStr && !prevStr0ActiveEffect) {
            const str0ActiveEffect = {
                name: "STR0",
                id: "STR0",
                img: `systems/${HEROSYS.module}/icons/encumbered.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.running.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.leaping.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.swimming.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.swinging.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.tunneling.max",
                        value: 0.5,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
                origin: this.uuid,
                flags: {
                    [game.system.id]: {
                        str0: true,
                    },
                },
            };

            await this.createEmbeddedDocuments("ActiveEffect", [str0ActiveEffect]);
            // If we have control of this token, re-acquire to update movement types
            const myToken = this.getActiveTokens()?.[0] || {};
            if (canvas.tokens.controlled.find((token) => token.id === myToken.id)) {
                myToken.release();
                myToken.control();
            }
        } else {
            if (prevStr0ActiveEffect && this.system.characteristics.str.value > minStr) {
                await prevStr0ActiveEffect.delete();
                // If we have control of this token, re-acquire to update movement types
                const myToken = this.getActiveTokens()?.[0] || {};
                if (canvas.tokens.controlled.find((token) => token.id === myToken.id)) {
                    myToken.release();
                    myToken.control();
                }
            }
        }
    }

    async FullHealth() {
        const tDelta = 500;
        let start = Date.now();
        await this.statuses.clear();
        let end = Date.now();
        if (end - start > tDelta) {
            console.warn("FullHealth performance concern: this.statuses.clear", end - start);
        }

        // Reset all items
        for (const item of this.items) {
            start = Date.now();
            await item.resetToOriginal();
            end = Date.now();
            if (end - start > tDelta) {
                console.warn(`FullHealth performance concern: ${item.name} resetToOriginal`, end - start);
            }
        }

        // Remove temporary effects
        start = Date.now();
        for (const ae of this.temporaryEffects) {
            if (
                ae.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id) ||
                ae.statuses.has(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id)
            )
                continue;

            await ae.delete();
        }
        end = Date.now();
        if (end - start > tDelta) {
            console.warn("FullHealth performance concern: Remove temporary effects", end - start);
        }

        // Remove Maneuver/Martial effects
        start = Date.now();
        for (const ae of this.appliedEffects.filter(
            (ae) => ae.flags[game.system.id]?.type === "maneuverNextPhaseEffect",
        )) {
            await ae.delete();
        }
        end = Date.now();
        if (end - start > tDelta) {
            console.warn("FullHealth performance concern: Remove Maneuver/Martial effects", end - start);
        }

        // Set Characteristics MAX to CORE (or 5e calculated value)
        start = Date.now();
        const characteristicChangesMax = {};
        for (const charKey of getCharacteristicInfoArrayForActor(this).map((infoArray) =>
            infoArray.key.toLowerCase(),
        )) {
            const characteristic = this.system.characteristics[charKey];
            const basePlusLevels = parseInt(characteristic.basePlusLevels);
            if (this.system.characteristics[charKey].max !== basePlusLevels) {
                characteristicChangesMax[`system.characteristics.${charKey}.max`] = basePlusLevels;
            }
        }
        if (this._id && Object.keys(characteristicChangesMax).length > 0) {
            await this.update(characteristicChangesMax);
        } else if (!this._id && Object.keys(characteristicChangesMax).length > 0) {
            foundry.utils.mergeObject(this, characteristicChangesMax);
        }
        end = Date.now();
        if (end - start > tDelta) {
            console.warn("FullHealth performance concern: Set Characteristics MAX to CORE", end - start);
        }

        // start = Date.now();
        // this.applyActiveEffects();
        // end = Date.now();
        // if (end - start > tDelta) {
        //     console.warn("FullHealth performance concern: applyActiveEffects", end - start);
        // }

        // Set Characteristics VALUE to MAX
        start = Date.now();
        const characteristicChangesValue = {};
        for (const charKey of Object.keys(this.system.characteristics)) {
            const characteristic = this.system.characteristics[charKey];
            const max = parseInt(this.system.characteristics[charKey].max);
            if (characteristic.value !== max) {
                characteristic.value = max;
                characteristicChangesValue[`system.characteristics.${charKey}.value`] = characteristic.value;
            }
        }
        if (this._id && Object.keys(characteristicChangesValue).length > 0) {
            await this.update(characteristicChangesValue);
        } else if (!this._id && Object.keys(characteristicChangesValue).length > 0) {
            foundry.utils.mergeObject(this, characteristicChangesValue);
        }
        end = Date.now();
        if (end - start > tDelta) {
            console.warn("FullHealth performance concern: Set Characteristics VALUE to MAX", end - start);
        }
    }

    // Raw base is insufficient for 5e characters
    getCharacteristicBase(key) {
        const powerInfo = getPowerInfo({ xmlid: key.toUpperCase(), actor: this, xmlTag: key.toUpperCase() });
        const base = powerInfo?.base(this) || 0;

        if (!this.system.is5e) return base;

        // TODO: Can this be combined with getCharacteristicInfoArrayForActor? See also actor-sheet.mjs changes
        const isAutomatonWithNoStun = !!this.items.find(
            (power) =>
                power.system.XMLID === "AUTOMATON" &&
                (power.system.OPTION === "NOSTUN1" || power.system.OPTION === "NOSTUN2"),
        );

        const _str = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.str.max")?.value || 0),
                0,
            );
        const _con = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.con.max")?.value || 0),
                0,
            );
        const _dex = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.dex.max")?.value || 0),
                0,
            );
        const _body = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.body.max")?.value || 0),
                0,
            );
        const _ego = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.ego.max")?.value || 0),
                0,
            );

        // TODO: FIXME: This is, but should never be, called with this.system[characteristic] being undefined. Need to reorder the loading
        //        mechanism to ensure that we do something more similar to a load, transform, and extract pipeline so that we
        //        not invoked way too many times and way too early.
        const charBase = function (characteristicUpperCase) {
            const base =
                this.system[characteristicUpperCase]?.LEVELS +
                getPowerInfo({
                    xmlid: characteristicUpperCase,
                    actor: this,
                    xmlTag: characteristicUpperCase,
                })?.base(this);
            return base;
        };

        switch (key.toLowerCase()) {
            // Physical Defense (PD) STR/5, STR/5 and an extra /3 if the right type of automaton
            case "pd":
                return roundFavorPlayerAwayFromZero(
                    base + Math.round((charBase("STR") + _str) / 5) / (isAutomatonWithNoStun ? 3 : 1),
                );

            // Energy Defense (ED) CON/5, CON/5 and /3 if the right type of automaton
            case "ed":
                return roundFavorPlayerAwayFromZero(
                    base + Math.round((charBase("CON") + _con) / 5) / (isAutomatonWithNoStun ? 3 : 1),
                );

            // Speed (SPD) 1 + (DEX/10)   can be fractional
            case "spd":
                return base + 1 + parseFloat(parseFloat((charBase("DEX") + _dex) / 10).toFixed(1));

            // Recovery (REC) (STR/5) + (CON/5)
            case "rec":
                return base + Math.round((charBase("STR") + _str) / 5) + Math.round((charBase("CON") + _con) / 5);

            // Endurance (END) 2 x CON
            case "end":
                return base + Math.round((charBase("CON") + _con) * 2);

            // Stun (STUN) BODY+(STR/2)+(CON/2)
            case "stun":
                return (
                    base +
                    Math.round(charBase("BODY") + _body) +
                    Math.round((charBase("STR") + _str) / 2) +
                    Math.round((charBase("CON") + _con) / 2)
                );

            // Base OCV & DCV = Attacker’s DEX/3
            case "ocv":
            case "dcv":
                return Math.round((charBase("DEX") + _dex) / 3);

            //Base Ego Combat Value = EGO/3
            case "omcv":
            case "dmcv":
                return Math.round((charBase("EGO") + _ego) / 3);

            case "leaping": {
                const str = parseInt(charBase("STR") + _str);
                let value = 0;

                if (str >= 3) value = 0.5;
                if (str >= 5) value = 1;
                if (str >= 8) value = 1.5;
                if (str >= 10) value = 2;
                if (str >= 13) value = 2.5;
                if (str >= 15) value = 3;
                if (str >= 18) value = 3.5;
                if (str >= 20) value = 4;
                if (str >= 23) value = 4.5;
                if (str >= 25) value = 5;
                if (str >= 28) value = 5.5;
                if (str >= 30) value = 6;
                if (str >= 35) value = 7;
                if (str >= 40) value = 8;
                if (str >= 45) value = 9;
                if (str >= 50) value = 10;
                if (str >= 55) value = 11;
                if (str >= 60) value = 12;
                if (str >= 65) value = 13;
                if (str >= 70) value = 14;
                if (str >= 75) value = 15;
                if (str >= 80) value = 16;
                if (str >= 85) value = 17;
                if (str >= 90) value = 18;
                if (str >= 95) value = 19;
                if (str >= 100) value = 20 + Math.floor((str - 100) / 5);

                return value;
            }
        }

        return base;
    }

    hasCharacteristic(characteristic) {
        // If the actor has the baseInfo and it shouldn't be ignored for this actor type, we have the characteristic
        // otherwise we don't
        const doesNotHaveCharacteristic = this.system[characteristic]?.baseInfo?.ignoreForActor(this) ?? true;
        return !doesNotHaveCharacteristic;
    }

    getActiveConstantItems() {
        const results = [];
        for (const item of this.items.filter((item) => item.isActive)) {
            if (item.system.duration === CONFIG.HERO.DURATION_TYPES.CONSTANT) {
                results.push(item);
            } else {
                const NONPERSISTENT = item.modifiers.find((o) => o.XMLID === "NONPERSISTENT");
                if (NONPERSISTENT) {
                    results.push(item);
                }
            }
        }
        return results;
    }

    getConstantEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.duration === CONFIG.HERO.DURATION_TYPES.CONSTANT)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getPersistentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getInherentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.duration === CONFIG.HERO.DURATION_TYPES.INHERENT)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getMiscEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && !ae.parent.duration)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    itemDataDefaults(itemData) {
        // Hack in some basic information with names.
        // TODO: This should be turned into some kind of short version of the description
        //       and it should probably be done when building the description
        switch (itemData.system.XMLID) {
            case "FOLLOWER":
                itemData.name = "Followers";
                break;
            case "ABSORPTION":
            case "AID":
            case "DISPEL":
            case "DRAIN":
            case "HEALING":
            case "TRANSFER":
            case "SUCCOR":
            case "SUPPRESS":
                if (!itemData.system.NAME) {
                    itemData.name = itemData.system?.ALIAS + " " + itemData.system?.INPUT;
                }
                break;
        }

        // Most items default to active unless they have charges or use END
        itemData.system.active = true;
        if (itemData.system.MODIFIER?.find((m) => m.XMLID === "CHARGES")) {
            itemData.system.active = false;
        }

        // Kluge for TK as we are trying to avoid getInfo overhead
        if (["TELEKINESIS", "NAKEDMODIFIER"].includes(itemData.system.XMLID)) {
            itemData.system.active = false;
        }
    }

    async actorDescriptionToChat({ token }) {
        token ??= tokenEducatedGuess({ actor: this, token });
        let content = `${this.system.CHARACTER?.CHARACTER_INFO?.APPEARANCE || ""}`;
        const perceivable = [];
        for (let item of this.items.filter((item) => item.isActive || item.isActivatable() === false)) {
            const p = item.isPerceivable(false); // inobivous is not included
            if (p) {
                perceivable.push(
                    `<b${p === "maybe" ? ` style="color:blue" title="Inobvious requires PERCEPTION roll"` : ""}>${item.parentItem ? `${item.parentItem.name}: ` : ""}${item.name}</b> ${item.system.description}`,
                );
            }
        }
        if (perceivable.length > 0) {
            perceivable.sort();
            content += "<ul>";
            for (let p of perceivable) {
                content += `<li>${p}</li>`;
            }
            content += "</ul>";
        }

        const speaker = ChatMessage.getSpeaker({ actor: this, token });
        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: content,
            speaker: speaker,
        };
        return ChatMessage.create(chatData);
    }

    async presenceAttack({ token }) {
        return new PresenceAttackApplication({ actor: this, token }).render({ force: true });
    }

    async onCharacteristicSuccessRoll({ label, token }) {
        const heroRoller = new HeroRoller().makeSuccessRoll().addDice(3);
        await heroRoller.roll();

        const charRoll = this.system.characteristics[label.toLowerCase()].roll;
        const margin = charRoll - heroRoller.getSuccessTotal();
        const autoSuccess = heroRoller.getAutoSuccess();
        const useAutoSuccess = autoSuccess !== undefined;
        const success = useAutoSuccess ? autoSuccess : margin >= 0;

        const flavor = `${label.toUpperCase()} (${charRoll}-) characteristic roll ${
            success ? "succeeded" : "failed"
        } ${useAutoSuccess ? `due to automatic ${autoSuccess ? "success" : "failure"}` : `by ${Math.abs(margin)}`}`;

        const cardHtml = await heroRoller.render(flavor);

        const speaker = ChatMessage.getSpeaker({ actor: this, token });

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC,
            rolls: heroRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async onCharacteristicFullRoll({ label, token }) {
        const characteristicValue = this.system.characteristics[label.toLocaleLowerCase()].value;
        const flavor = `Full ${label.toUpperCase()} Roll (${characteristicValue} ${label.toUpperCase()})`;
        await this.onCharacteristicRoll({ label, token, targetValue: characteristicValue, flavor });
    }

    async onCharacteristicCasualRoll({ label, token }) {
        const characteristicValue = this.system.characteristics[label.toLocaleLowerCase()].value;
        const halfCharacteristicValue = roundFavorPlayerAwayFromZero(
            +(Math.round(characteristicValue / 2 + "e+2") + "e-2"),
        ); //REF: https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
        const flavor = `Casual ${label.toUpperCase()} Roll (${halfCharacteristicValue} ${label.toUpperCase()})`;
        await this.onCharacteristicRoll({ label, token, targetValue: halfCharacteristicValue, flavor });
    }

    async onCharacteristicRoll({ label, token, targetValue, flavor }) {
        const isStrengthRoll = label.toUpperCase() === "STR";
        // Strength use consumes resources. No other characteristic roll does.
        if (isStrengthRoll) {
            await this.onStrengthCharacteristicRoll({ label, token, targetValue, flavor });
        } else {
            await this._onPrimaryNonStrengthCharacteristicRoll({ label, token, targetValue, flavor });
        }
    }

    async onStrengthCharacteristicRoll({ token, targetValue, flavor }) {
        // STR should have an item for potential damage,
        // just like a strike and should consume resources
        const originalStrikeItem = this.items.find((o) => o.system.XMLID === "STRIKE");
        if (!originalStrikeItem) {
            return ui.notifications.error(`Unable to find STRIKE item for ${this.actor.name}. Cannot perform attack`);
        }

        // Create a temporary strike attack linked to a strength item.
        const { effectiveItem: effectiveAttackItem } = cloneToEffectiveAttackItem({
            originalItem: originalStrikeItem,
            effectiveRealCost: originalStrikeItem._realCost,
            pushedRealPoints: originalStrikeItem._realCost,
            effectiveStr: targetValue,
            effectiveStrPushedRealPoints: 0,
        });

        // Strength use consumes resources. No other characteristic roll does.
        const {
            error: resourceError,
            warning: resourceWarning,
            resourcesUsedDescription,
            resourcesUsedDescriptionRenderedRoll,
        } = await userInteractiveVerifyOptionallyPromptThenSpendResources(effectiveAttackItem, {});
        if (resourceError) {
            return ui.notifications.error(`${effectiveAttackItem.name} ${resourceError}`);
        } else if (resourceWarning) {
            return ui.notifications.warn(`${effectiveAttackItem.name} ${resourceWarning}`);
        }

        // NOTE: Characteristic rolls can't have +1 to their roll.
        const diceParts = characteristicValueToDiceParts(targetValue);
        const characteristicRoller = new HeroRoller()
            .makeNormalRoll()
            .addDice(diceParts.d6Count)
            .addHalfDice(diceParts.halfDieCount ? 1 : 0);

        await characteristicRoller.roll();
        const damageRenderedResult = await characteristicRoller.render();

        const action = Attack.getActionInfo(effectiveAttackItem, [], { token });

        const cardData = {
            flavor,
            item: effectiveAttackItem,
            targetEntangle: "true",

            resourcesUsedDescription: resourcesUsedDescription
                ? `Spent ${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`
                : "",

            actor: this,

            renderedDamageRoll: damageRenderedResult,

            bodyDamage: characteristicRoller.getBodyTotal(),
            stunDamage: characteristicRoller.getStunTotal(),

            rollerJSON: characteristicRoller.toJSON(),

            itemJsonStr: dehydrateAttackItem(effectiveAttackItem),
            actionDataJSON: actionToJSON(action),

            user: game.user,
        };

        // render card
        const template = `systems/${HEROSYS.module}/templates/chat/item-damage-card.hbs`;
        const cardHtml = await foundryVttRenderTemplate(template, cardData);
        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC,
            rolls: characteristicRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async _onPrimaryNonStrengthCharacteristicRoll({ token, targetValue, flavor }) {
        // NOTE: Characteristic rolls can't have +1 to their roll.
        const diceParts = characteristicValueToDiceParts(targetValue);
        const characteristicRoller = new HeroRoller()
            .makeBasicRoll()
            .addDice(diceParts.d6Count)
            .addHalfDice(diceParts.halfDieCount ? 1 : 0);

        await characteristicRoller.roll();

        const cardHtml = await characteristicRoller.render(flavor);

        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC,
            rolls: characteristicRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async uploadFromXml(xml, options) {
        // Is this a linked actor?  If so upload into parent.
        // if (this.uuid.includes("Scene")) {
        //     console.warn(`Tried to upload a linked actor, redirecting to parent actor`);
        //     await game.actors.get(this.id).uploadFromXml(xml, options);
        //     return;
        // }

        try {
            // Convert xml string to xml document (if necessary)
            if (typeof xml === "string") {
                const parser = new DOMParser();
                xml = parser.parseFromString(xml.trim(), "text/xml");
            }

            // Check for parser error
            if (xml.getElementsByTagName("parsererror")?.[0]) {
                console.error(xml.getElementsByTagName("parsererror")[0].innerText);
                ui.notifications.error(`Parser Error. Verify file is a valid HDC file`);
                return;
            }

            // Keep track of damage & charge uses, which we will apply at end of the upload
            const retainValuesOnUpload = {
                body:
                    parseInt(this.system.characteristics?.body?.max) -
                    parseInt(this.system.characteristics?.body?.value),
                stun:
                    parseInt(this.system.characteristics?.stun?.max) -
                    parseInt(this.system.characteristics?.stun?.value),
                end:
                    parseInt(this.system.characteristics?.end?.max) - parseInt(this.system.characteristics?.end?.value),
                hap: this.system.hap?.value,
                heroicIdentity: this.system.heroicIdentity ?? true,
                resources: this.items
                    .filter(
                        (item) =>
                            (item.system.chargeItemModifier &&
                                (item.system._charges !== item.system.chargesMax ||
                                    item.system._clips !== item.system.clipsMax)) ||
                            item.system.ablative > 0 ||
                            (item.system.XMLID === "ENDURANCERESERVE" && item.system.LEVELS !== item.system.value),
                    )
                    .map((o) => ({
                        id: o.id,
                        _charges: o.system._charges,
                        _clips: o.system._clips,
                        ablative: o.system.ablative,
                        value: o.system.value,
                    })),

                was5e: this.is5e,
            };

            const uploadPerformance = {
                startTime: new Date(),
                _d: new Date(),
            };

            // Convert XML into JSON
            const heroJson = {};
            HeroSystem6eActor._xmlToJsonNode(heroJson, xml.children);

            // Need count of maneuvers for progress bar (might be switching betwen 5/6e so an estimate)
            const powerListTentative = this.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
            const freeStuffFilter = (power) =>
                (!(power.behaviors.includes("adder") || power.behaviors.includes("modifier")) &&
                    power.type.includes("maneuver")) ||
                power.key === "PERCEPTION" || // Perception
                power.key === "__STRENGTHDAMAGE"; // Weapon placeholder (this is a dirty hack to count it so we can filter on it later)
            const freeStuffCount = powerListTentative.filter(freeStuffFilter).length;

            const xmlItemsToProcess =
                1 + // we process heroJson.CHARACTER.CHARACTERISTICS all at once so just track as 1 item.
                (heroJson.CHARACTER.DISADVANTAGES?.length || 0) +
                (heroJson.CHARACTER.EQUIPMENT?.length || 0) +
                (heroJson.CHARACTER.MARTIALARTS?.length || 0) +
                (heroJson.CHARACTER.PERKS?.length || 0) +
                (heroJson.CHARACTER.POWERS?.length || 0) +
                (heroJson.CHARACTER.SKILLS?.length || 0) +
                (heroJson.CHARACTER.TALENTS?.length || 0) +
                (this.type === "pc" || this.type === "npc" || this.type === "automaton" ? freeStuffCount : 0) + // Free stuff
                1 + // Validating adjustment and powers
                1 + // FullHealth
                1 + // VPP
                1 + // Images
                1 + // Final save
                1 + // Restore retained damage
                1 + // CSL assignment
                1 + // PSL assignment
                1 + // debugModelProps
                1; // Not really sure why we need an extra +1

            const uploadProgressBar = new HeroProgressBar(`${this.name}: Processing HDC file`, xmlItemsToProcess);
            uploadPerformance.itemsToCreateEstimate = xmlItemsToProcess - 6;

            // Let GM know actor is being uploaded (unless it is a quench test; missing ID)
            if (this.id) {
                await ChatMessage.create({
                    style: CONST.CHAT_MESSAGE_STYLES.IC,
                    author: game.user._id,
                    speaker: ChatMessage.getSpeaker({ actor: this }),
                    whisper: whisperUserTargetsForActor(this),
                    content: `<b>${game.user.name}</b> is uploading <b>${this.name}</b>`,
                });
            }

            // Character name is what's in the sheet or, if missing, what is already in the actor sheet.
            const characterName =
                heroJson.CHARACTER.CHARACTER_INFO.CHARACTER_NAME ||
                options?.file?.name?.replace(/\.hdc$/i, "") ||
                this.name;
            uploadPerformance.removeEffects = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();
            this.name = characterName;
            if (this._id) {
                uploadProgressBar.advance(`${characterName}: Name, fileInfo`, 0);
                await this.update({ ["name"]: characterName });

                // Flags
                await this.setFlag(game.system.id, "uploading", true);
                await this.setFlag(game.system.id, "file", {
                    lastModifiedDate: options?.file?.lastModified,
                    name: options?.file?.name,
                    size: options?.file?.size,
                    type: options?.file?.type,
                    webkitRelativePath: options?.file?.webkitRelativePath,
                    uploadedBy: game.user.name,
                });
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            /// NOW LOAD THE HDC STUFF

            let promiseArray = [];
            let changes = {};

            // Need to get the base64 image before we delete IMAGE, deepClone doesn't work as expected.
            uploadProgressBar.advance(`${this.name}: Preprocess image`, 0);
            const filename = heroJson.CHARACTER.IMAGE?.FileName;
            const extension = filename?.split(".").pop();
            const base64 = "data:image/" + extension + ";base64," + xml.getElementsByTagName("IMAGE")?.[0]?.textContent;

            // Keep raw XML data without IMAGE
            const xmlNoImage = foundry.utils.deepClone(xml);
            const image = xmlNoImage.getElementsByTagName("IMAGE")[0];
            image?.parentNode?.removeChild(image);
            this.system._hdcXml = new XMLSerializer().serializeToString(xmlNoImage);
            changes["system._hdcXml"] = this.system._hdcXml;

            // Heroic Action Points (always keep the value)
            changes["system.hap.value"] = retainValuesOnUpload.hap;

            // Heroic Identity
            changes["system.heroicIdentity"] = retainValuesOnUpload.heroicIdentity;

            // game system version
            this.system.versionHeroSystem6eUpload = game.system.version;
            changes["system.versionHeroSystem6eUpload"] = game.system.version;

            // is5e
            // keep track independently of item.system.is5e as targetType can reload it
            // Assume true for those super old HDC files
            uploadProgressBar.advance(`${this.name}: is5e`, 0);

            // let _is5e = true;

            // const template =
            //     heroJson.CHARACTER?.TEMPLATE?.extends ||
            //     heroJson.CHARACTER?.TEMPLATE ||
            //     heroJson.CHARACTER?.BASIC_CONFIGURATION?.TEMPLATE;

            // if (typeof template === "string") {
            //     if (template.includes("builtIn.") && !template.includes("6E.")) {
            //         // 5E
            //         _is5e = this.system.is5e = true;
            //     } else if (template.includes("builtIn.") && template.includes("6E.")) {
            //         // 6E
            //         _is5e = this.system.is5e = false;
            //     } else {
            //         console.error(`Unrecognized template ${template}`);
            //     }
            // }

            // // Update actor type
            // const targetType = template
            //     ?.match(/\.(ai|automaton|base|computer|heroic|normal|superheroic|vehicle|standardsuper)[56.]/i)?.[1]
            //     .toLowerCase()
            //     .replace("base", "base2")
            //     .replace("normal", "pc")
            //     .replace("superheroic", "pc")
            //     .replace("heroic", "pc")
            //     .replace("standardsuper", "pc"); // super old HDC

            if (this.id) {
                // We can't delay this with the changes array because any items based on this actor needs this value.
                // Specifically compound power is a problem if we don't set is5e properly for a 5e actor.
                await this.update({
                    ...changes,
                    //"system.is5e": _is5e,
                    "system.CHARACTER.BASIC_CONFIGURATION": heroJson.CHARACTER.BASIC_CONFIGURATION,
                    "system.CHARACTER.CHARACTER_INFO": heroJson.CHARACTER.CHARACTER_INFO,
                    "system.CHARACTER.TEMPLATE": heroJson.CHARACTER.TEMPLATE,
                    "system.CHARACTER.version": heroJson.CHARACTER.version,
                });
                changes = {};

                if (this.is5e !== this.system.is5e) {
                    if (this.name.startsWith("_Quench")) {
                        console.error(`${this.name} is5e mismatch`);
                    }
                    await this.update({ "system.is5e": this.is5e });
                }

                const targetType = this._templateType
                    ?.match(/(ai|automaton|base|computer|heroic|normal|superheroic|vehicle|standardsuper)/i)?.[1]
                    .toLowerCase()
                    .replace("base", "base2")
                    .replace("normal", "pc")
                    .replace("superheroic", "pc")
                    .replace("heroic", "pc")
                    .replace("standardsuper", "pc"); // super old HDC

                if (targetType && this.type.replace("npc", "pc") !== targetType) {
                    await this.update({ type: targetType, [`==system`]: this.system });
                }

                // Delete maneuvers (or any other item) when changing is5e
                const itemsToDeleteIs5e = this.items.filter((i) => i.system.is5e !== this.is5e).map((m) => m.id);
                if (itemsToDeleteIs5e.length > 0) {
                    console.warn(`Deleting ${itemsToDeleteIs5e.length} is5e mismatches`);
                    await this.deleteEmbeddedDocuments("Item", itemsToDeleteIs5e);
                }
            }

            // CHARACTERISTICS
            if (heroJson.CHARACTER?.CHARACTERISTICS) {
                const changesNormal = {};
                const changesFiguredOrCalculated = {};
                uploadProgressBar.advance(`${this.name}: CHARACTERISTICS`, 0);

                // Legacy (well current)
                for (const [key, value] of Object.entries(heroJson.CHARACTER.CHARACTERISTICS)) {
                    const _baseInfo = getPowerInfo({ XMLID: key, actor: this, xmlTag: key });

                    this.system[key] = new HeroItemCharacteristic(value, { parent: this });

                    if (_baseInfo?.behaviors.includes("calculated") || _baseInfo?.behaviors.includes("figured")) {
                        changesFiguredOrCalculated[`system.${key}`] = this.system[key];
                    } else {
                        changesNormal[`system.${key}`] = this.system[key];
                    }
                }
                delete heroJson.CHARACTER.CHARACTERISTICS;

                if (this.id) {
                    // Update normal values first
                    await this.update(changesNormal);

                    // Then any figured or calculated characteristis
                    await this.update(changesFiguredOrCalculated);
                }
            }

            // NOTE don't put this into the promiseArray because we create things in here that are absolutely required by later items (e.g. strength placeholder).
            // if (this.type === "pc" || this.type === "npc" || this.type === "automaton") {
            uploadProgressBar.advance(`${this.name}: Evaluating non HDC items for PCs, NPCs, and Automatons`, 0);

            await this.addFreeStuff();

            uploadProgressBar.advance(`${this.name}: Evaluated non HDC items for PCs, NPCs, and Automatons`, 0);
            //}

            uploadPerformance.progressBarFreeStuff - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // ITEMS
            uploadProgressBar.advance(`${this.name}: Evaluating items`, 0);

            let itemsToCreate = [];
            let sortBase = 0;
            for (const itemTag of HeroSystem6eItem.ItemXmlTags) {
                sortBase += 1000;
                if (heroJson.CHARACTER[itemTag]) {
                    for (const system of heroJson.CHARACTER[itemTag]) {
                        try {
                            system.is5e = this.is5e;
                            if (system.XMLID === "COMPOUNDPOWER") {
                                for (const _modifier of system.MODIFIER || []) {
                                    console.warn(
                                        `${this.name}/${system.ALIAS}/${system.XMLID}/${_modifier.XMLID}/${_modifier.ID} was excluded from upload because MODIFIERs are not supported on a COMPOUNDPOWER. It is likely on the parentItem and thus should flow down to the children.`,
                                    );
                                }
                                delete system.MODIFIER;

                                for (const _adder of system.ADDER || []) {
                                    ui.notifications.warn(
                                        `${this.name}/${system.ALIAS}/${system.XMLID}/${_adder.XMLID}/${_adder.ID} was excluded from upload because MODIFIERs are not supported on a COMPOUNDPOWER. It is likely on the parentItem and thus should flow down to the children.`,
                                    );
                                }
                                delete system.ADDER;
                            }

                            const itemData = {
                                name: system.NAME || system?.ALIAS || system?.XMLID || itemTag,
                                type: itemTag.toLowerCase().replace(/s$/, ""),
                                system,
                                sort: sortBase + parseInt(system.POSITION || 0),
                            };

                            // Guess for some default values to reduce need for DB updates later
                            this.itemDataDefaults(itemData);

                            // Duplicate ID? (ID may be a string)
                            // Increment ID until we no longer have a duplciate ID
                            // Possibility of duplicate ID on PARENT, which may not be handled properly
                            let dupItem = itemsToCreate.find((item) => item.system.ID == itemData.system.ID);
                            for (let loop = 1; loop < 99; loop++) {
                                if (!dupItem) {
                                    break;
                                }
                                console.warn(`Duplicate ID ${itemData.system.ID}`, itemData);
                                itemData.system.errors ??= [];
                                itemData.system.errors.push(`Duplicate ID ${itemData.system.ID}`);
                                itemData.system.ID = parseInt(itemData.system.ID) + 1;
                                dupItem = itemsToCreate.find((item) => item.system.ID == itemData.system.ID);
                            }

                            // Note that we create COMPOUNDPOWER subitems before creating the parent
                            // so that we can remove the subitems from the parent COMPOUNDPOWER attributes

                            // COMPOUNDPOWER is similar to a MULTIPOWER.
                            // MULTIPOWER uses PARENTID references.
                            // COMPOUNDPOWER is structured as children.  Which we add PARENTID to, so it looks like a MULTIPOWER.
                            if (system.XMLID === "COMPOUNDPOWER") {
                                const compoundItems = [];
                                for (const [key, value] of Object.entries(system)) {
                                    // We only care about arrays and objects (array of 1)
                                    // These are expected to be POWERS, SKILLS, etc that make up the COMPOUNDPOWER
                                    // Instead of COMPOUNDPOWER attributes, they should be separate items, with PARENT/CHILD
                                    if (value && typeof value === "object") {
                                        if (value.constructor !== Array && value.constructor !== Object) {
                                            console.error(
                                                `${this.name}/${system.name}/${key} is not an Array or Object`,
                                                value,
                                            );
                                            continue;
                                        }
                                        const values = value.length ? value : [value];
                                        for (const system2 of values) {
                                            if (system2.XMLID) {
                                                const power = getPowerInfo({
                                                    xmlid: system2.XMLID,
                                                    actor: this,
                                                    xmlTag: key,
                                                });
                                                if (!power) {
                                                    await ui.notifications.error(
                                                        `${this.name}/${itemData.name}/${system2.XMLID} failed to parse. It will not be available to this actor.  Please report.`,
                                                        {
                                                            console: true,
                                                            permanent: true,
                                                        },
                                                    );
                                                    continue;
                                                }
                                                compoundItems.push(system2);
                                            }
                                        }
                                        // Remove attribute/property since we just created items for it
                                        // Now that we do item.update in some cases, we need to specifically keep an emptyr array for POWER[]
                                        system[key] = [];
                                    }
                                }
                                compoundItems.sort((a, b) => parseInt(a.POSITION) - parseInt(b.POSITION));
                                for (const system2 of compoundItems) {
                                    const power = getPowerInfo({
                                        xmlid: system2.XMLID,
                                        actor: this,
                                        xmlTag: system2.xmlTag,
                                    });
                                    const itemData2 = {
                                        name: system2.NAME || system2.ALIAS || system2.XMLID,
                                        type: power.type.includes("skill") ? "skill" : "power",
                                        sort: itemData.sort + 100 + parseInt(system2.POSITION),
                                        system: {
                                            ...system2,
                                            PARENTID: system.ID,
                                            POSITION: parseInt(system2.POSITION),
                                            errors: [
                                                ...(system2.errors || []),
                                                "Added PARENTID for COMPOUNDPOWER child",
                                            ],
                                            is5e: this.is5e,
                                        },
                                    };

                                    // Guess for some default values to reduce need for DB updates later
                                    this.itemDataDefaults(itemData2);

                                    // Duplicate ID? (ID may be a string)
                                    // Increment ID until we no longer have a duplciate ID
                                    // Possibility of duplicate ID on PARENT, which may not be handled properly
                                    let dupItem = itemsToCreate.find((item) => item.system.ID == itemData2.system.ID);
                                    for (let loop = 1; loop < 99; loop++) {
                                        if (!dupItem) {
                                            break;
                                        }
                                        console.warn(`Duplicate ID ${itemData2.system.ID}`, itemData2);
                                        itemData2.system.errors ??= [];
                                        itemData2.system.errors.push(`Duplicate ID ${itemData2.system.ID}`);
                                        itemData2.system.ID = parseInt(itemData2.system.ID) + 1;
                                        dupItem = itemsToCreate.find((item) => item.system.ID == itemData2.system.ID);
                                    }

                                    if (this.id) {
                                        itemsToCreate.push(itemData2);
                                    } else {
                                        const item = new HeroSystem6eItem(itemData2, {
                                            parent: this,
                                        });
                                        this.items.set(item.system.XMLID + item.system.POSITION, item);
                                    }
                                }
                            }

                            if (this.id) {
                                itemsToCreate.push(itemData);
                            } else {
                                const item = new HeroSystem6eItem(itemData, {
                                    parent: this,
                                });
                                this.items.set(item.system.XMLID + item.system.POSITION, item);
                            }

                            uploadPerformance.items ??= [];
                            uploadPerformance.items.push({ name: itemData.name, d: Date.now() - uploadPerformance._d });
                            uploadPerformance._d = new Date().getTime();
                        } catch (e) {
                            console.error(e);
                            ui.notifications.error(`${this.name} failed to upload ${system.ALIAS}/${system.XMLID}`);
                        }
                    }
                    delete heroJson.CHARACTER[itemTag];
                }
            }

            uploadProgressBar.advance(`${this.name}: Evaluated Items`, 0);

            uploadProgressBar.advance(`${this.name}: Updating Items`, 0);

            // Working on a merge to update previously existing items.
            // Add existing item.id (if it exists), which we will use for the pending update.
            // There may be an item that was converted to equipment/power
            // Also note that system.ID is natively a string from HDC, which we coerce into INT so use == instead of ===
            itemsToCreate = itemsToCreate.map((m) =>
                foundry.utils.mergeObject(m, {
                    _id: this.items.find((i) => i.system.ID == m.system.ID)?.id,
                }),
            );
            const itemsToUpdate = itemsToCreate.filter((o) => o._id);
            itemsToCreate = itemsToCreate.filter((o) => !o._id);

            // Make sure itemsToUpdate have ADDER/MODIFIER/POWER array
            // Which allows a new HDC to remove ADDER during update, without it will never clear
            for (const itemToUpdate of itemsToUpdate) {
                itemToUpdate.system.ADDER ??= [];
                itemToUpdate.system.MODIFIER ??= [];
                itemToUpdate.system.POWER ??= [];
            }

            // If item.type is different then:
            // The type of a Document can be changed only if the system field
            // is force-replaced (==) or updated with {recursive: false}
            for (const item of itemsToUpdate) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting?.type !== item.type) {
                    await ui.notifications.warn(
                        `${item.name} changed from type=${itemExisting.type} to type=${item.type}`,
                    );

                    // item2[`==system`] = item2.system;
                    // delete item2.system;

                    await itemExisting.update({ type: item.type, "==system": item.system });
                }
            }

            // If a skill was previously marked as EVERYMAN, but now isn't we
            // need to remove the EVERYMAN value as for some reason HDC doesn't
            // specifically include EVERYMAN="No".  Seems like a HD bug.
            for (const item of itemsToUpdate.filter((item) => !item.system.EVERYMAN)) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting.system.EVERYMAN) {
                    // HDC didn't reference EVERYMAN
                    // so we will specify it as null (false)
                    // so the update below will set the expected value
                    console.warn(`Adding EVERYMAN to ${item.name} skill`);
                    item.system.EVERYMAN = null;
                }
            }

            // If a TEXT was previously defined, but now isn't we
            // need to remove it as for some reason HDC doesn't
            // specifically include it.
            for (const item of itemsToUpdate.filter((item) => !item.system.TEXT)) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting.system.TEXT) {
                    console.warn(`Adding TEXT to ${item.name}/${item.system.XMLID}`);
                    item.system.TEXT = "";
                }
            }

            // update existing document, overwriting any MODIFIERS, etc
            await this.updateEmbeddedDocuments("Item", itemsToUpdate);

            uploadProgressBar.advance(`${this.name}: Updated Items`, itemsToUpdate.length);

            uploadProgressBar.advance(`${this.name}: Creating Items`, 0);

            uploadPerformance.itemsToCreateActual = itemsToCreate.length;

            uploadPerformance.preItems = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();
            await this.createEmbeddedDocuments("Item", itemsToCreate, { render: false, renderSheet: false });

            uploadPerformance.createItems = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();
            uploadProgressBar.advance(`${this.name}: Created Items`, itemsToCreate.length);

            uploadProgressBar.advance(`${this.name}: Processing non characteristics`, 0);
            const doLastXmlids = ["COMBAT_LEVELS", "MENTAL_COMBAT_LEVELS", "MENTALDEFENSE"];

            uploadProgressBar.advance(`${this.name}: applyActiveEffects`, 0);
            for (const item of this.items) {
                await item.setActiveEffects({ render: false });
            }

            uploadProgressBar.advance(`${this.name}: applySizeEffect`, 0);
            await this.applySizeEffect();

            uploadProgressBar.advance(`${this.name}: Processing ${doLastXmlids.length} doLastXmlids`, 0);
            await Promise.all(
                this.items.filter(
                    (item) =>
                        doLastXmlids.includes(item.system.XMLID) && !item.baseInfo?.type.includes("characteristic"),
                ),
            );

            // VPP Slots
            uploadProgressBar.advance(`${this.name}: VPP Slots auto selection`, 0);
            for (const vppItem of this.items.filter((i) => i.system.XMLID === "VPP")) {
                // If no vppSlots then pick defaults (currently always defaults)
                if (!vppItem.childItems.find((i) => i.system.CARRIED)) {
                    let vppSlottedCost = 0;
                    const vppChanges = [];
                    for (const slotItem of vppItem.childItems) {
                        if (vppSlottedCost + slotItem.realCost <= vppItem.vppPoolPoints) {
                            vppChanges.push({ _id: slotItem.id, "system.CARRIED": true });
                            vppSlottedCost += slotItem.realCost;
                        } else {
                            vppChanges.push({ _id: slotItem.id, "system.CARRIED": false });
                        }
                    }
                    await this.updateEmbeddedDocuments("Item", vppChanges);
                }
            }
            uploadProgressBar.advance(`${this.name}: VPP Slots auto selection complete`, 1);

            // Make sure any powers with characteristic properties
            // reflect in current VALUE
            uploadProgressBar.advance(`${this.name}: FullHealth`, 0);
            await this.FullHealth();
            // Kluge to ensure characteristic values match max
            try {
                if (this.id) {
                    const changes = {};
                    for (const key of Object.keys(this.system.characteristics)) {
                        changes[`system.characteristics.${key}.value`] = this.system.characteristics[key].max;
                    }
                    await this.update(changes);
                }
            } catch (e) {
                console.error(e);
            }
            uploadProgressBar.advance(`${this.name}: FullHealth complete`, 1);

            // retainValuesOnUpload Charges
            uploadProgressBar.advance(`${this.name}: retainValuesOnUpload charges and ablative`, 0);
            for (const resourceData of retainValuesOnUpload.resources) {
                // Careful: the HDC ID is intially a string, but coerced to Number in dataModel thus ==
                const item = this.items.find((i) => i.id === resourceData.id);
                if (item) {
                    // Notice if charges or clips is lower than before we take the min #3302
                    await item.update({
                        "system._charges": Math.min(item.system.chargesMax, resourceData._charges),
                        "system._clips": Math.min(item.system.clipsMax, resourceData._clips),
                        "system.ablative": Math.max(item.system.ablative, resourceData.ablative),
                    });
                    if (item.system.XMLID === "ENDURANCERESERVE") {
                        await item.update({ "system.value": Math.min(item.system.value, resourceData.value) });
                    }
                } else {
                    console.warn(
                        `Unable to locate ${resourceData.NAME}/${resourceData.ALIAS} to consume charges after upload.`,
                    );
                }
            }
            uploadPerformance.postUpload = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Validating powers`);

            // Validate everything that's been imported
            this.items.forEach(async (item) => {
                const power = item.baseInfo;

                // Power needs to exist
                if (!power) {
                    await ui.notifications.error(
                        `${this.name}/${item.detailedName()} has unknown power XMLID. Please report.`,
                        { console: true, permanent: true },
                    );
                } else if (!power.behaviors) {
                    await ui.notifications.error(
                        `${this.name}/${item.detailedName()} does not have behaviors defined. Please report.`,
                        { console: true, permanent: true },
                    );
                }
            });

            uploadPerformance.validate = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Processed non characteristics`, 0);
            uploadProgressBar.advance(`${this.name}: Processed all items`, 0);

            uploadPerformance.invalidTargets = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Uploading image`, 0);

            // Images
            if (this.img.startsWith("tokenizer/") && game.modules.get("vtta-tokenizer")?.active) {
                await ui.notifications.warn(
                    `Skipping image upload, because this token (${this.name}) appears to be using tokenizer.`,
                );
            } else if (heroJson.CHARACTER.IMAGE) {
                //const filename = heroJson.CHARACTER.IMAGE?.FileName;
                const path = "worlds/" + game.world.id + "/tokens";
                let relativePathName = path + "/" + filename;

                // Create a directory if it doesn't already exist
                try {
                    await FoundryVttFilePicker.createDirectory("user", path);
                } catch (error) {
                    console.debug("create directory error", error);
                }

                // Set the image, uploading if not already in the file system
                try {
                    const imageFileExists = (await FoundryVttFilePicker.browse("user", path)).files.includes(
                        encodeURI(relativePathName),
                    );
                    if (!imageFileExists) {
                        //const extension = filename.split(".").pop();
                        //const base64 =
                        //"data:image/" + extension + ";base64," + xml.getElementsByTagName("IMAGE")[0].textContent;

                        await ImageHelper.uploadBase64(base64, filename, path);

                        // FORGE stuff (because users add things into their own directories)
                        if (typeof ForgeAPI !== "undefined") {
                            const forgeUser = (await ForgeAPI.status()).user;
                            relativePathName = `https://assets.forge-vtt.com/${forgeUser}/${relativePathName}`;
                        }
                    }

                    changes["img"] = relativePathName;

                    // Update any tokens images that might exist
                    for (const token of this.getActiveTokens()) {
                        await token.document.update({
                            "texture.src": relativePathName,
                        });
                    }
                } catch (e) {
                    console.error(e);
                    ui.notifications.warn(
                        `${this.name} failed to upload ${filename}. Make sure user has [Use File Browser] and [Upload New Files] permissions. Also make sure the folder isn't in [Privacy Mode] indicated with a purple background within FoundryVTT.`,
                    );
                }

                delete heroJson.CHARACTER.IMAGE;
            } else {
                // No image provided. Make sure we're using the default token.
                // Note we are overwriting any image that may have been there previously.
                // If they really want the image to stay, they should put it in the HDC file.
                // Prompt before overwriting token image #2831

                if (this.img !== CONST.DEFAULT_TOKEN) {
                    new foundry.applications.api.DialogV2({
                        window: { title: "Choose token image" },
                        content: `
                    <p>This HDC file does not include an image.</p>
                    <p>Do you want to keep the existing token image or clear the image (${CONST.DEFAULT_TOKEN})?</p>`,
                        buttons: [
                            {
                                action: "keepImage",
                                label: "Keep Existing Image",
                                default: true,
                            },
                            {
                                action: "defaultImage",
                                label: "Clear",
                                callback: async () => {
                                    await this.update({ ["img"]: CONST.DEFAULT_TOKEN });
                                    // Update any tokens images that might exist
                                    for (const token of this.getActiveTokens()) {
                                        await token.document.update({
                                            "texture.src": CONST.DEFAULT_TOKEN,
                                        });
                                    }
                                },
                            },
                        ],
                        submit: (result) => {
                            console.log(`User picked option: ${result}`);
                        },
                    }).render({ force: true });
                }
            }

            uploadPerformance.image = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Uploaded image`);
            uploadProgressBar.advance(`${this.name}: Saving core changes`, 0);

            // Non ITEMS stuff in CHARACTER
            changes = {
                ...changes,
                "system.CHARACTER": heroJson.CHARACTER,
                "system.versionHeroSystem6eUpload": game.system.version,
            };

            if (this.prototypeToken) {
                changes[`prototypeToken.name`] = this.name;
                changes[`prototypeToken.img`] = changes.img;
            }

            // Save all our changes (unless temporary actor/quench)
            if (this.id) {
                promiseArray.push(this.update(changes));
            }

            await Promise.all(promiseArray);

            uploadPerformance.nonItems = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // Ghosts fly (or anything with RUNNING=0 and FLIGHT)
            if (this.system.characteristics?.running?.value === 0 && this.system.characteristics?.running?.base === 0) {
                for (const flight of this.items.filter((i) => i.system.XMLID === "FLIGHT")) {
                    await flight.toggle();
                }
            }

            // // Set newly created items to be non-active when uses END/CHARGES/MP
            // for (const item of this.items) {
            //     if (
            //         item.system.end > 0 ||
            //         (item.system.numCharges.max > 0 && !item.parentItem?.system.XMLID === "MULTIPOWER")
            //     ) {
            //         item.system.active = false;
            //         if (this.id) {
            //             await item.update({ [`system.active`]: item.system.active });
            //         }
            //     }
            // }

            uploadPerformance.actorPostUpload = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // Kluge to ensure everything has a SPD.
            // For example a BASE has an implied SPD of three
            this.system.characteristics.spd ??= {
                core: 3,
            };

            uploadPerformance.postUpload2 = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Saved core changes`);
            uploadProgressBar.advance(`${this.name}: Restoring retained damage`, 0);

            // Apply retained damage
            if (this.id) {
                for (const key of ["body", "stun", "end"]) {
                    if (!this.hasCharacteristic(key.toUpperCase())) continue;
                    if (retainValuesOnUpload[key] == undefined) continue;
                    if (this.system.characteristics[key] == undefined) continue;

                    this.system.characteristics[key].value -= retainValuesOnUpload[key];
                    await this.update(
                        {
                            [`system.characteristics.${key}.value`]: this.system.characteristics[key].value,
                        },
                        { render: false },
                    );
                }
            }
            uploadProgressBar.advance(`${this.name}: Restored retained damage`, 0);

            uploadProgressBar.advance(`${this.name}: Linking Combat Skill Levels`, 0);
            const cslInitializationUpdates = [];
            for (const csl of this.allCslSkills) {
                const cslChangesToLink = csl.linkBasedOnCustomAdders(csl.system._source.ADDER, this.cslItems);
                if (csl._id != null) {
                    cslChangesToLink._id = csl._id;
                    cslInitializationUpdates.push(cslChangesToLink);
                } else {
                    foundry.utils.mergeObject(csl, cslChangesToLink);
                }
            }
            if (cslInitializationUpdates.length > 0) {
                await Item.implementation.updateDocuments(cslInitializationUpdates, { parent: this });
            }
            uploadProgressBar.advance(`${this.name}: Linked Combat Skill Levels`, 1);

            uploadProgressBar.advance(`${this.name}: Linking Penalty Skill Levels`, 0);
            const pslInitializationUpdates = [];
            for (const psl of this.allPslSkills) {
                const pslChangesToLink = psl.linkBasedOnCustomAdders(psl.system._source.ADDER, this.pslItems);
                if (psl._id != null) {
                    pslChangesToLink._id = psl._id;
                    pslInitializationUpdates.push(pslChangesToLink);
                } else {
                    foundry.utils.mergeObject(psl, pslChangesToLink);
                }
            }
            if (pslInitializationUpdates.length > 0) {
                await Item.implementation.updateDocuments(pslInitializationUpdates, { parent: this });
            }
            uploadProgressBar.advance(`${this.name}: Linked Penalty Skill Levels`, 1);

            if (this.id) {
                await this.setFlag(game.system.id, "uploading", false);
                await this.setFlag(game.system.id, "uploadingError", null);
            }
            uploadPerformance.retainedDamage = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // If we have control of this token, reacquire to update movement types
            const myToken = this.getActiveTokens()?.[0];
            if (canvas.tokens.controlled.find((t) => t.id == myToken?.id)) {
                myToken.release();
                myToken.control();
            }
            uploadPerformance.tokenControl = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.close(`Uploaded ${this.name}`);

            // report performance concerns
            const performanceConcerns = uploadProgressBar._performance
                .filter((o) => o.delta > 500)
                .sort((a, b) => b.delta - a.delta);
            for (const concern of performanceConcerns) {
                console.warn(`uploadFromXml performance concern: ${concern.message} ${concern.delta}s`, concern);
            }

            uploadPerformance.totalTime = new Date().getTime() - uploadPerformance.startTime;

            //console.log("Upload Performance", uploadPerformance);

            // Let GM know actor was uploaded (unless it is a quench test; missing ID)
            if (this.id) {
                ChatMessage.create({
                    style: CONST.CHAT_MESSAGE_STYLES.IC,
                    author: game.user._id,
                    speaker: ChatMessage.getSpeaker({ actor: this }),
                    whisper: whisperUserTargetsForActor(this),
                    content: `Took ${Math.ceil(uploadPerformance.totalTime / 1000)} seconds for <b>${game.user.name}</b> to upload <b>${this.name}</b>.`,
                });
            }

            // Delete any old items that weren't updated, added or part of freeStuff
            if (this.id) {
                // Careful: the HDC ID is intially a string, but coerced to Number in dataModel thus ==
                const itemsToDelete = this.items.filter(
                    (item) =>
                        !itemsToUpdate.find((o) => item.id === o._id) &&
                        !itemsToCreate.find((p) => item.system.ID == p.system.ID) &&
                        !item.isCombatManeuver &&
                        item.system.XMLID !== "PERCEPTION",
                );
                if (itemsToDelete.length > 0) {
                    const unorderedList =
                        `<div style="max-height:200px;overflow-y:scroll"><ul>` +
                        itemsToDelete
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((m) => `<li title='${m.system.description}'>${m.type.toUpperCase()}: ${m.name}</li>`)
                            .join("") +
                        `</ul></div>`;
                    const content = `The following items were not included in the HDC file. Do you want to delete them? ${unorderedList}`;
                    const confirmDeleteExtraItems = await Dialog.confirm({
                        title: `${this.name}: Delete extra items?`,
                        content: content,
                    });

                    if (confirmDeleteExtraItems) {
                        console.log(
                            `Deleting ${itemsToDelete.length} items because they were not present in the HDC file.`,
                        );
                        // Toggle them off first as sometimes deleteing items with AE's don'e run the cleanup code.
                        // FoundryVTT 13 bug?
                        const turnOffPromises = [];
                        for (const item of itemsToDelete) {
                            turnOffPromises.push(item.turnOff({ silent: true }));
                        }
                        await Promise.all(turnOffPromises);
                        await this.deleteEmbeddedDocuments(
                            "Item",
                            itemsToDelete.map((o) => o.id),
                        );
                    } else {
                        // Fire and forget (no await on this ChatMessage)
                        ChatMessage.create({
                            style: CONST.CHAT_MESSAGE_STYLES.IC,
                            author: game.user._id,
                            speaker: ChatMessage.getSpeaker({ actor: this }),
                            content: `<b>${this.name}</b> kept a few items that were not in the HDC upload: ${unorderedList}`,
                            whisper: whisperUserTargetsForActor(this),
                        });
                    }
                }
            }

            // DataModel check
            uploadProgressBar.advance(`${this.name}: Processing debugModelProps`, 0);
            let dataModelErrorCount = 0;
            for (const item of this.items) {
                const e = item.system.debugModelProps();
                if (e) {
                    if (dataModelErrorCount++ === 0) {
                        ui.notifications.error(`${this.name}. ${e}<br>Please report`, { permanent: true });
                    } else {
                        // the console.error inside debugModelProps will log the rest
                    }
                }
            }
            uploadProgressBar.advance(`${this.name}: Processed debugModelProps`, 1);
        } catch (e) {
            console.error(e);
            ui.notifications.error(`${this.name} had errors during upload.`);
            //uploadProgressBar.close(`Upload Failed ${this.name}`);
            if (this.id) {
                await this.setFlag(
                    game.system.id,
                    "uploadingError",
                    e.stack.replace(/http(s)?:[/[a-z0-9_.-:()]+\//gi, ""),
                );

                // Make sure we show the error we just posted to DB.
                // Needed for when the delete extra items has an error.
                await this.setFlag(game.system.id, "uploading", true);
            }
        }
    }

    /**
     * Characters get a few things for free that are not in the HDC.
     *
     * @returns
     */
    async addFreeStuff() {
        // If we have no INT then delete PERCEPTION
        const itemToDelete = [];
        const hasINT = this.hasCharacteristic("INT");
        if (!hasINT && this.items.find((item) => item.system.XMLID === "PERCEPTION")) {
            itemToDelete.push(...this.items.filter((item) => item.system.XMLID === "PERCEPTION"));
            console.warn(`Deleting PERCEPTION because ${this.name} has no INT`);
        }

        // If we have no STR then delete COMBAT MANEUVERS
        const hasSTR = this.hasCharacteristic("STR");
        if (!hasSTR & this.items.find((item) => item.isCombatManeuver)) {
            console.warn(`Deleting COMBAT MANEUVERS because ${this.name} has no STR`);
            itemToDelete.push(...this.items.filter((item) => item.isCombatManeuver));
        }

        if (itemToDelete.length > 0) {
            await this.deleteEmbeddedDocuments(
                "Item",
                itemToDelete.map((m) => m.id),
            );
        }

        // Remove any is5e FreeStuff mis-matches (happens when you upload 5e over 6e actor, or vice versa)
        const mismatchItems = this.items.filter(
            (item) =>
                (item.system.XMLID === "PERCEPTION" || item.isCombatManeuver) &&
                (item.system.is5e !== this.system.is5e || !item.baseInfo),
        );

        if (mismatchItems.length > 0) {
            console.warn(`Deleting ${mismatchItems.length} item because is5e doesn't match actor`, mismatchItems);
            await this.deleteEmbeddedDocuments(
                "Item",
                mismatchItems.map((m) => m.id),
            );
        }

        if (hasINT) {
            await this.addPerception();
        }

        if (hasSTR) {
            await this.addHeroSystemManeuvers();
        }
    }

    async addPerception() {
        const perceptionItems = this.items.filter(
            (item) => item.system.XMLID === "PERCEPTION" && item.type === "skill" && !item.system.ID,
        );

        if (perceptionItems.length > 0) {
            console.debug(`PERCEPTION already exists`);

            // Make sure we only have one
            const itemsToDelete = perceptionItems.splice(1);

            if (itemsToDelete.length > 0) {
                console.error(`Deleted ${itemsToDelete.length} PERCEPTION items`);
                await this.deleteEmbeddedDocuments(
                    "Item",
                    itemsToDelete.map((o) => o.id),
                );
            }

            return;
        }

        // Perception Skill
        const itemDataPerception = {
            name: "Perception",
            type: "skill",
            system: {
                XMLID: "PERCEPTION",
                ALIAS: "Perception",
                CHARACTERISTIC: "INT",
                state: "trained",
                LEVELS: "0",
                is5e: this.is5e,
                xmlTag: "SKILL",
                active: true,
            },
        };
        const perceptionItem = this.id
            ? await HeroSystem6eItem.create(itemDataPerception, {
                  parent: this,
              })
            : new HeroSystem6eItem(itemDataPerception, {
                  parent: this,
              });

        if (!this.id) {
            this.items.set(perceptionItem.system.XMLID, perceptionItem);
        }
    }

    async addManeuver(maneuver) {
        const name = maneuver.name;
        const XMLID = maneuver.key;

        const maneuverDetails = maneuver.maneuverDesc;
        const PHASE = maneuverDetails.phase;
        const OCV = maneuverDetails.ocv;
        const DCV = maneuverDetails.dcv;
        const EFFECT = maneuverDetails.effects;
        const DC = maneuverDetails.dc;
        const ADDSTR = maneuverDetails.addStr;
        const USEWEAPON = maneuverDetails.useWeapon; // "No" if unarmed or not offensive maneuver
        const WEAPONEFFECT = maneuverDetails.weaponEffect; // Not be present if not offensive maneuver

        const maneuverItems = this.items.filter(
            (item) => item.system.XMLID === XMLID && item.isCombatManeuver && !item.system.ID,
        );
        if (maneuverItems.length > 0) {
            //console.debug(`${XMLID} already exists`);

            // Make sure we only have one
            const itemsToDelete = maneuverItems.splice(1);

            if (itemsToDelete.length > 0) {
                console.error(`Deleted ${itemsToDelete.length} ${XMLID} items`);
                await this.deleteEmbeddedDocuments(
                    "Item",
                    itemsToDelete.map((o) => o.id),
                );
            }

            return;
        }

        const itemData = {
            name,
            type: "maneuver",
            system: {
                PHASE,
                OCV,
                DCV,
                DC,
                EFFECT,
                active: false, // TODO: This is probably not always true. It should, however, be generated in other means.
                description: EFFECT,
                XMLID,
                // MARTIALARTS consists of a list of MANEUVERS, the MARTIALARTS MANEUVERS have more props than our basic ones.
                // Adding in some of those props as we may enhance/rework the basic maneuvers in the future.
                //  <MANEUVER XMLID="MANEUVER" ID="1705867725258" BASECOST="4.0" LEVELS="0" ALIAS="Block" POSITION="1"
                //  MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes"
                //  INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Block" OCV="+2"
                //  DCV="+2" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0"
                //  MAXSTR="0" STRMULT="1" USEWEAPON="Yes" WEAPONEFFECT="Block, Abort">
                DISPLAY: name, // Not sure we should allow editing of basic maneuvers
                ADDSTR,
                USEWEAPON,
                WEAPONEFFECT,
                is5e: this.is5e,
            },
        };

        if (!itemData.name) {
            console.error("Missing name", itemData);
            return;
        }

        const item = this.id
            ? await HeroSystem6eItem.create(itemData, {
                  parent: this,
              })
            : new HeroSystem6eItem(itemData, {
                  parent: this,
              });

        // Work around if temporary actor
        if (!this.id) {
            this.items.set(item.system.XMLID, item);
        }
    }

    async addHeroSystemManeuvers() {
        const powerList = this.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        const maneuverPromises = powerList
            .filter((power) => power.type?.includes("maneuver"))
            .map(async (maneuver) => this.addManeuver(maneuver));

        return Promise.all(maneuverPromises);
    }

    static _xmlToJsonNode(json, children) {
        if (children.length === 0) return;

        for (const child of children) {
            const tagName = child.tagName;

            let jsonChild = {};
            if (child.childElementCount == 0 && child.attributes.length == 0) {
                jsonChild = child.textContent;
            }
            if (HeroSystem6eItem.ItemXmlTags.includes(child.tagName)) {
                jsonChild = [];
            } else {
                for (const attribute of child.attributes) {
                    switch (attribute.value) {
                        case "Yes":
                        case "YES":
                            jsonChild[attribute.name] = true;
                            break;
                        case "No":
                        case "NO":
                            jsonChild[attribute.name] = false;
                            break;
                        case "GENERIC_OBJECT":
                            jsonChild[attribute.name] = child.tagName.toUpperCase(); // e.g. MULTIPOWER
                            jsonChild["xmlid"] = attribute.value.trim(); // Sept 1 2025: Consider keeping the original XMLID for eventual write
                            break;
                        default:
                            jsonChild[attribute.name] = attribute.value.trim();
                    }
                }

                // There can be confusion if the item is a MODIFIER or ADDER (EXPLOSION 5e/6e and others).
                // So keep track of the tagName, which we use in getPowerInfo to help filter when there are duplicate XMLID keys.
                if (child.attributes.length > 0) {
                    try {
                        jsonChild.xmlTag = tagName;
                        jsonChild._hdcXml = new XMLSerializer().serializeToString(child); //new XMLSerializer().serializeToString(child.cloneNode());
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            if (child.children.length > 0) {
                this._xmlToJsonNode(jsonChild, child.children);
            }

            // Some super old items use RANGED, but is now called RANGE
            if (jsonChild.XMLID === "RANGED" && jsonChild.xmlTag === "ADDER") {
                jsonChild.XMLID = "RANGE";
                jsonChild.errors ??= [];
                jsonChild.errors.push("RANGE ranamed to RANGED");
            }

            // Items should have an XMLID
            // Some super old items are missing XMLID, which we will try to fix
            // A bit more generic
            if (
                !jsonChild.XMLID &&
                ["CHARACTERISTICS", ...HeroSystem6eItem.ItemXmlTags].includes(child.parentNode.tagName)
            ) {
                const powerInfo = getPowerInfo({
                    xmlid: jsonChild.xmlTag,
                    xmlTag: jsonChild.xmlTag,
                    is5e: true,
                });
                if (powerInfo) {
                    if (powerInfo.key != jsonChild.xmlTag) {
                        console.error(`powerInfo.key != xmlTag`, jsonChild);
                    }
                    jsonChild.XMLID = powerInfo.key;
                    jsonChild.errors ??= [];
                    jsonChild.errors.push("Missing XMLID, using xmlTag reference");
                }
            }

            // Super old HDC missing XMLID for power frameworks & lists (newer has XMLID=GENERIC_OBJECT)
            if (!jsonChild.XMLID && ["LIST", "VPP", "MULTIPOWER"].includes(jsonChild.xmlTag)) {
                jsonChild.XMLID = jsonChild.xmlTag;
            }

            // Some super old items are missing OPTIONID, which we will try to fix
            if (jsonChild.OPTION && !jsonChild.OPTIONID) {
                const powerInfo = getPowerInfo({ xmlid: jsonChild.XMLID, xmlTag: jsonChild.xmlTag, is5e: true });
                jsonChild.OPTIONID = powerInfo?.optionIDFix?.(jsonChild) || jsonChild.OPTION.toUpperCase();
                jsonChild.errors ??= [];
                jsonChild.errors.push("Missing OPTIONID, using OPTION reference");
            }

            // Some super old items are missing and ID (like SCIENTIST skill enhancer)
            if (jsonChild.XMLID && !jsonChild.ID) {
                const powerInfo = getPowerInfo({ xmlid: jsonChild.XMLID, xmlTag: jsonChild.xmlTag, is5e: true });

                const PARENTID = child.nextElementSibling?.attributes?.PARENTID?.value;
                if (PARENTID) {
                    jsonChild.ID = PARENTID;
                    jsonChild.errors ??= [];
                    jsonChild.errors.push("Missing ID, using PARENTID from nextElementSibling");
                }

                if (!jsonChild.BASECOST) {
                    // We are going to rebase this item as we have no BASECOST or likely any other properties
                    if (!powerInfo.xml) {
                        console.warn(`Unable to rebase ${jsonChild.XMLID} because powerInfo.xml is not available.`);
                    } else {
                        try {
                            jsonChild.errors ??= [];
                            const parser = new DOMParser();
                            const rebase = parser.parseFromString(powerInfo.xml.trim(), "text/xml");
                            for (const attribute of rebase.children[0].attributes) {
                                if (!jsonChild[attribute.name]) {
                                    jsonChild[attribute.name] ??= attribute.value;
                                    jsonChild.errors.push(`${attribute.name} from config.mjs:xml`);
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }

            // An attempt to track hierarchy of ADDERS/MODS (not needed with new DataModel)
            // if (
            //     !jsonChild.PARENTID &&
            //     jsonChild.ID &&
            //     child.parentNode?.getAttribute &&
            //     child.parentNode?.getAttribute("ID")
            // ) {
            //     jsonChild.PARENTID = child.parentNode.getAttribute("ID");
            // }

            if (
                HeroSystem6eItem.ItemXmlChildTagsUpload.includes(child.tagName) &&
                !HeroSystem6eItem.ItemXmlTags.includes(child.parentElement?.tagName)
            ) {
                json[tagName] ??= [];
                json[tagName].push(jsonChild);
            } else if (Array.isArray(json)) {
                json.push(jsonChild);
            } else {
                json[tagName] = jsonChild;
            }
        }
    }

    async _resetCharacteristicsFromHdc() {
        const changes = {};
        for (const [key, char] of Object.entries(this.system.characteristics)) {
            const KEY = key.toUpperCase();
            if (!this.system[KEY] || !char.baseInfo) {
                continue;
            }

            const value = (this.system[KEY].LEVELS || 0) + (char.baseInfo.base?.(this) || 0);
            changes[`system.characteristics.${key.toLowerCase()}.max`] = value;
            changes[`system.characteristics.${key.toLowerCase()}.value`] = value;
        }
        await this.update(changes);
    }

    updateRollable(key) {
        console.error("Depricated updateRollable");
        const characteristic = this.system.characteristics[key];
        const charPowerEntry = getPowerInfo({
            xmlid: key.toUpperCase(),
            actor: this,
            xmlTag: key.toUpperCase(),
        });

        if (characteristic && charPowerEntry?.behaviors.includes("success")) {
            const newRoll = Math.round(9 + characteristic.value * 0.2);
            if (!this.system.is5e && characteristic.value < 0) {
                characteristic.roll = 9;
            }
            if (this.system.characteristics[key].roll !== newRoll) {
                return {
                    [`system.characteristics.${key}.roll`]: newRoll,
                };
            }
        }

        return undefined;
    }

    getActorCharacterAndActivePoints() {
        // Calculate realCost & Active Points for bought as characteristics
        let characterPointCost = 0;
        let activePoints = 0;

        let pointsDetail = {};
        let activePointsDetail = {};

        const powers = getCharacteristicInfoArrayForActor(this);
        for (const powerInfo of powers) {
            characterPointCost += parseFloat(this.system.characteristics[powerInfo.key.toLowerCase()]?.realCost || 0);
            activePoints += parseFloat(this.system.characteristics[powerInfo.key.toLowerCase()]?.activePoints || 0);
        }
        pointsDetail.characteristics = characterPointCost;
        activePointsDetail.characteristics = characterPointCost;

        // ActivePoints are the same a RealCosts for base CHARACTERISTICS
        activePoints = characterPointCost;

        // Add in costs for items
        for (const item of this.items.filter(
            (o) =>
                o.type !== "attack" &&
                o.type !== "defense" &&
                o.type !== "movement" &&
                !o.system.XMLID?.startsWith("__"), // Exclude placeholder powers
        )) {
            let _characterPointCost =
                parseFloat(item.system?.characterPointCost || item.system?.characterPointCost) || 0;
            const _activePoints = parseFloat(item.system?.activePoints) || 0;

            if (_characterPointCost !== 0) {
                // Equipment is typically purchased with money, not character points
                if ((item.parentItem?.type || item.type) !== "equipment" && item.type !== "disadvantage") {
                    characterPointCost += _characterPointCost;
                }

                if (item.type !== "disadvantage") {
                    activePoints += _activePoints;
                }

                pointsDetail[item.parentItem?.type || item.type] ??= 0;
                activePointsDetail[item.parentItem?.type || item.type] ??= 0;

                pointsDetail[item.parentItem?.type || item.type] += _characterPointCost;
                activePointsDetail[item.parentItem?.type || item.type] += _activePoints;
            }
        }

        // DISAD_POINTS: realCost
        const DISAD_POINTS = parseFloat(this.system.CHARACTER?.BASIC_CONFIGURATION?.DISAD_POINTS || 0);
        const _disadPoints = Math.min(DISAD_POINTS, pointsDetail?.disadvantage || 0);
        if (_disadPoints !== 0) {
            pointsDetail.MatchingDisads = _disadPoints;
            activePointsDetail.MatchingDisads = _disadPoints;
        }

        let realCost = characterPointCost;

        return {
            activePoints,
            characterPointCost,
            pointsDetail,
            activePointsDetail,
            realCost,
        };
    }

    get activePoints() {
        return this.getActorCharacterAndActivePoints().activePoints;
    }

    get characterPointCost() {
        return this.getActorCharacterAndActivePoints().characterPointCost;
    }

    get pointsDetail() {
        return this.getActorCharacterAndActivePoints().pointsDetail;
    }

    get activePointsDetail() {
        return this.getActorCharacterAndActivePoints().activePointsDetail;
    }

    get realCost() {
        return this.getActorCharacterAndActivePoints().realCost;
    }

    pslPenaltyItems(penaltyType) {
        return this.items.filter((item) => item.pslPenaltyType === penaltyType);
    }

    pslPenaltyValue(penaltyType) {
        const psls = this.pslPenaltyItems(penaltyType);
        const valueSum = psls.reduce(
            (accumulator, currentValue) => accumulator + parseInt(currentValue.system.LEVELS) || 0,
            0,
        );
        return valueSum;
    }

    get is5e() {
        const _template = this.system.CHARACTER?.TEMPLATE?.name;
        let _is5e;

        // if (!_template) {
        //     if (this.id) {
        //         console.warn(`${this.name} has no TEMPLATE`);
        //     }
        // }

        if (_template?.includes("6")) {
            _is5e = false;
        }

        // 5e templates don't have the number 6
        if (_template?.includes("hdt") && !_template?.includes("6")) {
            _is5e = true;
        }

        if (_is5e !== undefined && this.system.is5e !== _is5e) {
            if (!squelch(this.id)) {
                console.error(`${this.name} is5e mismatch.  Template=${_template}`);
            }
            return _is5e;
        }

        if (this.system.is5e == null) {
            return game.settings.get(HEROSYS.module, "DefaultEdition") === "five" ? true : false;
        }

        return this.system.is5e;
    }

    get _characterPoints() {
        return this.characterPointCost;
    }

    get _characterPointsForDisplay() {
        return roundFavorPlayerTowardsZero(this._characterPoints);
    }

    get _activePoints() {
        return this.activePoints;
    }

    get _activePointsForDisplay() {
        return roundFavorPlayerTowardsZero(this._activePoints);
    }

    /**
     * Return an array of the actor's attack items that could be a match for this PSL.
     * They will either be single items or framework that contains potentially multiple items.
     *
     * @returns {HeroSystem6eItem[]}
     */
    get pslItems() {
        return this.sortedAttackItemsForCslPsl;
    }

    /**
     * Return an array of the actor's attack items that could be a match for this CSL.
     * They will either be single items or framework that contains potentially multiple items.
     *
     * @returns {HeroSystem6eItem[]}
     */
    get cslItems() {
        return this.sortedAttackItemsForCslPsl;
    }

    /**
     * Return an array of the actor's attack items that could be a match CSLs and PSLs.
     * They will either be single items or framework that contains potentially multiple items.
     *
     * @returns {HeroSystem6eItem[]}
     */
    get sortedAttackItemsForCslPsl() {
        try {
            const priorityCsl = function (item) {
                switch (item.type) {
                    case "power":
                        return 1;
                    case "equipment":
                        return 1;
                    case "martialart":
                        return 2;
                    case "maneuver":
                        return 9;
                    default:
                        return 99;
                }
            };

            const _sortCslItems = function (a, b) {
                const priorityA = priorityCsl(a);
                const priorityB = priorityCsl(b);
                return priorityA - priorityB;
            };
            return this.items
                .filter(
                    (item) =>
                        (item.rollsToHit() &&
                            (!item.baseInfo.behaviors.includes("optional-maneuver") ||
                                game.settings.get(HEROSYS.module, "optionalManeuvers")) &&
                            !item.system.XMLID.startsWith("__")) ||
                        item.system.XMLID === "HANDTOHANDATTACK" || // PH: FIXME: Not sure why we're using rollsToHit as it misses this. Might be only exception.
                        (item.baseInfo.type.includes("framework") && // CSL custom adders can specify a framework to indicate all of the framework's children are included.
                            !item.isSeparator && // Ignore separators
                            !(
                                item.system.XMLID === "LIST" &&
                                ["skill", "talent", "perk", "disadvantage"].includes(item.type)
                            )), // Ignore LISTs in the skills, talents, perks, and disads section as they can't have attacks
                )
                .sort(_sortCslItems);
        } catch (e) {
            // If baseinfo is missing the baseinfo.type causes errors. Known to occur with old manually built attacks with no XMLID.
            // Plan is to delete these invalid attacks.  For now they show in invalid actor sheet tab for reference only.
            console.error(`${this.name} has unhandled error in cslItems`);
            throw new Error(e);
        }
    }

    /**
     * Try to determine the template type
     */
    get _templateType() {
        let templateType = "";
        // isHeroic
        // Need to be a careful as there are custom templates ('Nekhbet Vulture Child Goddess')
        // that we are unlikely able to decode heroic status.
        // NOTE: Older HD used "Main" as the template type - not sure what it means
        // Stringify the TEMPLATE for our best chance.
        try {
            const template = this.system.CHARACTER?.TEMPLATE.name;
            if (!template) return templateType;

            const stringifiedTemplate = JSON.stringify(template);

            if (stringifiedTemplate?.match(/\.Heroic/i)) {
                // Have seen "Heroic" and "Heroic6E"
                templateType = "Heroic";
            } else if (stringifiedTemplate?.match(/\.Superheroic/i)) {
                // Have seen "Superheroic" and "Superheroic6E"
                templateType = "Superheroic";
            } else if (stringifiedTemplate?.match(/\.Vehicle/i)) {
                // Have seen "Vehicle" and "Vehicle6E"
                templateType = "Vehicle";
            } else if (stringifiedTemplate?.match(/\.Base/i)) {
                // Have seen "Base" and "Base6E"
                templateType = "Base";
            } else if (stringifiedTemplate?.match(/\.Automaton/i)) {
                // Have seen "Automaton" and "Automaton6E"
                templateType = "Automaton";
            } else if (stringifiedTemplate?.match(/\.AI/i)) {
                // Have seen "AI" and "AI6E"
                templateType = "AI";
            } else if (stringifiedTemplate?.match(/\.Computer/i)) {
                // Have seen "Computer" and "Computer6E"
                templateType = "Computer";
            } else if (stringifiedTemplate?.match(/Normal/i)) {
                // Have seen "Normal" and "CompetentNormal" - no 6e template
                templateType = "Normal";
            } else if (stringifiedTemplate?.match(/Super/i)) {
                // 'builtIn.StandardSuper.hdt'
                templateType = "Superheroic";
            } else if (this.system.CHARACTER?.TEMPLATE.name) {
                templateType = this.system.CHARACTER.TEMPLATE.name;
            }

            if (templateType === "" && this.type !== "base2") {
                // && this.flags[game.system.id]?.uploading !== true
                // Custom Templates
                // Automations
                // Barrier
                if (this.id && this.system.CHARACTER && !window[game.system.id]?.squelch?.templateType) {
                    console.warn(
                        `Unknown template type for ${this.name}.`,
                        this.system.CHARACTER?.TEMPLATE?.name,
                        this.system.BASIC_CONFIGURATION?.TEMPLATE,
                    );
                    window[game.system.id] ??= {
                        squelch: [],
                    };
                    window[game.system.id].squelch.templateType = true;
                }
            }
        } catch (e) {
            console.error(e);
        }

        return templateType;
    }

    get _templateTypeAbreviation() {
        const templateType = this._templateType;

        // There are 2 types that start with A (AI, and Automaton) so distinguish between them
        if (templateType === "AI") {
            return "ai";
        }

        return templateType?.charAt(0).toLowerCase() || "?";
    }

    get encumbrance() {
        // encumbrancePercentage
        const equipmentWeightPercentage =
            parseInt(game.settings.get(game.system.id, "equipmentWeightPercentage")) / 100.0;

        // Hero Designer appears to store WEIGHT as LBS instead of KG.
        const equipment = this.items.filter(
            (o) => o.type === "equipment" && (o.parentItem ? o.parentItem.isActive : o.isActive),
        );
        const weightLbs = equipment.reduce((a, b) => a + parseFloat(b.system?.WEIGHT || 0), 0);
        const weightKg = (weightLbs / 2.2046226218) * equipmentWeightPercentage;

        return weightKg.toFixed(1);
    }

    get netWorth() {
        const equipment = this.items.filter((o) => o.type === "equipment" && o.isActive);
        const price = equipment.reduce((a, b) => a + parseFloat(b.system.PRICE), 0);
        return price.toFixed(2);
    }

    get activeMovement() {
        const movementPowers = this.system.is5e ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers;

        let movementItems = [];
        for (const key of Object.keys(this.system.characteristics).filter((o) => movementPowers[o])) {
            const char = this.system.characteristics[key];
            if ((parseInt(char.value) || 0) > 0) {
                char._id = key;
                char.name = movementPowers[key];
                movementItems.push(char);
            }
        }
        const _activeMovement =
            movementItems.length === 0
                ? "none"
                : movementItems.find((o) => o._id === this.flags[game.system.id]?.activeMovement)?._id ||
                  movementItems[0]._id;
        return _activeMovement;
    }

    get stunThreshold() {
        return this.type === "pc" ? -30 : -10;
    }

    get knockedOutOfCombat() {
        if (!this.statuses.has("knockedOut")) return false;
        if (this.system.characteristics.stun?.value >= this.stunThreshold) return false;
        return true;
    }

    /**
     * Apply any transformations to the Actor data which are caused by ActiveEffects.
     *
     * HeroSystem is unique in that we only apply only one multiplier (whichever one reduces the most).
     */
    applyActiveEffects() {
        const overrides = {};
        this.statuses.clear();

        // Organize non-disabled effects by their application priority
        let changes = [];
        for (const effect of this.allApplicableEffects()) {
            if (!effect.active) continue;
            changes.push(
                ...effect.changes.map((change) => {
                    const c = foundry.utils.deepClone(change);
                    c.effect = effect;
                    c.priority = c.priority ?? c.mode * 10;
                    return c;
                }),
            );
            for (const statusId of effect.statuses) this.statuses.add(statusId);
        }

        // Filter out redundant multiplies, keeping lowest value
        const mults = changes.filter((c) => c.mode === CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY);
        if (mults.length > 1) {
            const uniqueKeys = new Set();
            mults.forEach((obj) => {
                uniqueKeys.add(obj.key);
            });

            for (const key of uniqueKeys) {
                const multsUniqueKey = mults.filter((c) => c.key === key);
                if (multsUniqueKey.length > 1) {
                    const minValue = Math.min(...multsUniqueKey.map((c) => parseFloat(c.value)));
                    const keepMult = multsUniqueKey.find((c) => parseFloat(c.value) === minValue);
                    // remove all multsUniqueKey and add back in the keepMult
                    changes = changes.filter(
                        (c) => c.key !== key || c.mode !== CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                    );
                    changes.push(keepMult);
                }
            }
        }

        changes.sort((a, b) => a.priority - b.priority);

        // Apply all changes
        for (const change of changes) {
            if (!change.key) continue;
            const changes = change.effect.apply(this, change);
            Object.assign(overrides, changes);
        }

        // Expand the set of final overrides
        this.overrides = foundry.utils.expandObject(overrides);
    }

    /**
     * Create a new Token document, not yet saved to the database, which represents the Actor.
     * @param {object} [data={}]            Additional data, such as x, y, rotation, etc. for the created token data
     * @param {object} [options={}]         The options passed to the TokenDocument constructor
     * @returns {Promise<TokenDocument>}    The created TokenDocument instance
     */
    // async getTokenDocument(data = {}, options = {}) {
    //     const tokenData = this.prototypeToken.toObject();
    //     tokenData.actorId = this.id;

    //     if (tokenData.randomImg && !data.texture?.src) {
    //         let images = await this.getTokenImages();
    //         if (images.length > 1 && this._lastWildcard) {
    //             images = images.filter((i) => i !== this._lastWildcard);
    //         }
    //         const image = images[Math.floor(Math.random() * images.length)];
    //         tokenData.texture.src = this._lastWildcard = image;
    //     }

    //     if (!tokenData.actorLink) {
    //         if (tokenData.appendNumber) {
    //             // Count how many tokens are already linked to this actor
    //             const tokens = canvas.scene.tokens.filter((t) => t.actorId === this.id);
    //             // let n = tokens.length + 1;
    //             // tokenData.name = `${tokenData.name} (${n})`;

    //             // And make sure we don't already have this token name in this scene
    //             for (let n = tokens.length + 1; n < 100; n++) {
    //                 const sisterToken = canvas.scene.tokens.find(
    //                     (t) => t.actorId === this.id && t.name === `${tokenData.name} (${n})`,
    //                 );
    //                 if (!sisterToken) {
    //                     tokenData.name = `${tokenData.name} (${n})`;
    //                     break;
    //                 }
    //             }
    //         }

    //         if (tokenData.prependAdjective) {
    //             const adjectives = Object.values(
    //                 foundry.utils.getProperty(game.i18n.translations, CONFIG.Token.adjectivesPrefix) ||
    //                     foundry.utils.getProperty(game.i18n._fallback, CONFIG.Token.adjectivesPrefix) ||
    //                     {},
    //             );
    //             const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    //             tokenData.name = `${adjective} ${tokenData.name}`;
    //         }
    //     }

    //     foundry.utils.mergeObject(tokenData, data);
    //     const cls = getDocumentClass("Token");
    //     return new cls(tokenData, options);
    // }

    hasPhase(segmentNumber) {
        let index = Math.min(Math.max(this.system.characteristics.spd.value, 1), 12); // Security bounds
        let phases = HeroSystem6eActor.Speed2Segments[index];
        //console.log("index", segmentNumber, index, phases, phases.includes(segmentNumber), HeroSystem6eActor.__speed2Segments);
        return phases.includes(segmentNumber);
    }

    getBaseInit() {
        const characteristic = this.system?.initiativeCharacteristic || "dex";
        const initValue = this.system.characteristics[characteristic]?.value || 0;
        return parseInt(initValue);

        // if (segmentNumber != this.segmentNumber) {
        //     const characteristic = this.system?.initiativeCharacteristic || "dex";
        //     const initValue = this.system.characteristics[characteristic]?.value || 0;
        //     const r = Math.floor(Math.random(6)) + 1;
        //     this.currentInit = parseInt(initValue) + Number((r / 10).toFixed(2));
        //     this.segmentNumber = segmentNumber;
        // }
        // return this.currentInit;
    }

    get invalidItems() {
        return Array.from(this.items.invalidDocumentIds).map((id) => this.items.getInvalid(id));
    }

    // Analyze the actor and generate various statistics about it
    get analysis() {
        try {
            return { endurance: this.analyzeEndurance };
        } catch (e) {
            console.error(e);
        }
        return {};
    }

    get analyzeEndurance() {
        const activatablePowersUsingEnd = this.items.filter(
            (i) => i.isActive && i.type === "power" && i.baseInfo?.behaviors.includes("activatable") && i.end > 0,
        );
        const activatablePowerEndSum = Math.max(
            0,
            activatablePowersUsingEnd.reduce((a, c) => a + c.end, 0),
        );

        // Hacky for now, should  get estimated end for attack
        const endForAttack = Math.max(
            1,
            Math.ceil(
                this.system.characteristics.str.value /
                    (game.settings.get(HEROSYS.module, "StrEnd") === "five" ? 5 : 10),
            ),
        );

        const perPhase = 1 + activatablePowerEndSum + endForAttack;
        const perTurn = perPhase * this.system.characteristics.spd.value || 1;
        const perTurnWithRecovery = Math.max(0, perTurn - this.system.characteristics.rec.value) || 0;
        const phasesUntil0End =
            perTurnWithRecovery > 0
                ? Math.trunc(this.system.characteristics.end.value / perTurnWithRecovery, 1)
                : "infinity";
        return { perPhase, perTurn, phasesUntil0End };
    }

    async setNaturalHealing() {
        const naturalBodyHealing = this.temporaryEffects.find(
            (o) => o.flags[game.system.id]?.XMLID === "naturalBodyHealing",
        );
        if (
            this.type === "pc" &&
            parseInt(this.system.characteristics.body.value) < parseInt(this.system.characteristics.body.max)
        ) {
            const bodyPerMonth = Math.max(1, parseInt(this.system.characteristics.rec.value));
            const secondsPerBody = Math.floor(2.628e6 / bodyPerMonth);
            const daysForOneBody = roundFavorPlayerAwayFromZero(30 / bodyPerMonth);
            const activeEffect = {
                name: `Natural Body Healing (${bodyPerMonth}/month; ${daysForOneBody} days to get 1 body)`,
                id: "naturalBodyHealing",
                img: `systems/${HEROSYS.module}/icons/heartbeat.svg`,
                duration: {
                    seconds: secondsPerBody,
                },
                flags: {
                    [`${game.system.id}`]: {
                        XMLID: "naturalBodyHealing",
                        expiresOn: "segmentStart",
                    },
                },
            };
            if (naturalBodyHealing) {
                await naturalBodyHealing.update({
                    name: activeEffect.name,
                    "duration.seconds": activeEffect.duration.seconds,
                });
            } else {
                await this.addActiveEffect(activeEffect);
                //await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        // Get rid of naturalHealing
        if (
            naturalBodyHealing &&
            this.system?.characteristics?.body?.value &&
            this?.system?.characteristics?.body?.value >= parseInt(this.system.characteristics.body.max)
        ) {
            await naturalBodyHealing.delete();
        }
    }

    get allCslSkills() {
        return this.items.filter((item) => item.isCsl);
    }

    get activeCslSkills() {
        return this.allCslSkills.filter((item) => item.isActive);
    }

    get preferredAttacksForCsls() {
        let results = [];

        // Martial Arts
        results = [...results, ...this.items.filter((item) => item.isMartialManeuver)];

        // Equipment
        results = [
            ...results,
            ...this.items.filter((item) => item.type === "equipment" && item.baseInfo?.behaviors.includes("to-hit")),
        ];

        // Powers
        results = [
            ...results,
            ...this.items.filter((item) => item.type === "power" && item.baseInfo?.behaviors.includes("to-hit")),
        ];

        // Strike
        results = [...results, ...this.items.filter((item) => item.isCombatManeuver && item.system.XMLID === "STRIKE")];

        return results;
    }

    get allPslSkills() {
        return this.items.filter((item) => item.isPsl);
    }

    get activePslSkills() {
        return this.allPslSkills.filter((item) => item.isActive);
    }

    static migrateData(source) {
        // Many of these items should have been done during specific version migrations.
        // If migration is interrupted it may have been skipped.
        // SEE: migration.mjs:commitActorAndItemMigrateDataChangesByActor

        this.migrateData_4_0_26(source);
        this.migrateData_4_1_13(source);

        return super.migrateData(source);
    }

    static migrateData_4_0_26(source) {
        // Delete strength placeholder as we need many of them so will be creating them on the fly.
        const _removeStrengthPlaceholderAndCreateActiveProperty = source?.items?.find(
            (item) => item.system.ALIAS === "__InternalStrengthPlaceholder",
        );
        if (_removeStrengthPlaceholderAndCreateActiveProperty) {
            source.items = source.items.filter((item) => item.system.ALIAS !== "__InternalStrengthPlaceholder");
            tagObjectForPersistence(source);
        }
    }

    static migrateData_4_1_13(source) {
        // We no longer need __InternalManeuverPlaceholderWeapon as we now have effective attack items. Delete
        // it from all actors.
        const _removePlaceholderWeaponItem = source?.items?.find(
            (item) => item.name === "__InternalManeuverPlaceholderWeapon",
        );
        if (_removePlaceholderWeaponItem) {
            source.items = source.items.filter((item) => item.name !== "__InternalManeuverPlaceholderWeapon");
            tagObjectForPersistence(source);
        }
    }
}
