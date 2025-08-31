import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor-active-effects.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo, getCharacteristicInfoArrayForActor, whisperUserTargetsForActor } from "../utility/util.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";
import { clamp } from "../utility/compatibility.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const FoundryVttFilePicker = foundry.applications?.apps?.FilePicker?.implementation || FilePicker;

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class HeroSystem6eActor extends Actor {
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

        HEROSYS.log(false, "_preCreate");
        let prototypeToken = {
            displayBars: CONST.TOKEN_DISPLAY_MODES.HOVER,
            displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
        };

        if (this.type != "npc") {
            prototypeToken = {
                ...prototypeToken,
                actorLink: true,
                disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
                displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
                displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
            };
        }

        const is5e = game.settings.get(HEROSYS.module, "DefaultEdition") === "five" ? true : false;

        this.updateSource({
            prototypeToken: prototypeToken,
            system: {
                versionHeroSystem6eCreated: game.system.version,
                is5e,
            },
        });

        if (this.type === "pc" || this.type === "npc" || this.type === "automaton") {
            await this.addFreeStuff();
        }

        for (const item of this.items) {
            await item._postUpload();
        }
        // REF: https://foundryvtt.wiki/en/development/api/document _preCreate
        // Careful: toObject only returns system props that are part of schema
        // so we merge in the entire system
        // Also need to use force replace ==items for this to work in v13
        const items = this.items.map((i) => ({ ...i.toObject(), system: i.system }));
        this.updateSource({
            [`==items`]: items,
        });

        // For debugging purposes
        window.actor = this;
    }

    // Post-process a creation operation for a single Document instance. Post-operation events occur for all connected clients.
    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
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
        const html = await foundryVttRenderTemplate(template, cardData);
        return new Promise((resolve) => {
            const data = {
                title: `Change ${this.name} Type`,
                content: html,
                buttons: {
                    normal: {
                        label: "Apply",
                        callback: (html) => resolve(_processChangeType(html)),
                    },
                },
                default: "normal",
                close: () => resolve({ cancelled: true }),
            };
            new Dialog(data, null).render(true);

            async function _processChangeType(html) {
                await actor.update(
                    {
                        type: html.find("input:checked")[0].value,
                        [`==system`]: actor.system,
                    },
                    { recursive: false },
                );
            }
        });
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
        super._onUpdate(data, options, userId);

        // Only owners have permission to perform updates
        if (!this.isOwner) {
            return;
        }
        //const hasSTUN = getCharacteristicInfoArrayForActor(this).find((o) => o.key === "STUN");

        // Mark as undefeated in combat tracker (pc/npc)
        if (
            this.statuses.has("dead") &&
            (data.system?.characteristics?.body?.value ?? this.system.characteristics.body.value) >
                -this.system.characteristics.body.value
        ) {
            await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
                active: false,
            });
        }

        // If stun was changed and running under triggering users context
        if (
            (data.system?.characteristics?.stun !== undefined || data.system?.characteristics?.body !== undefined) &&
            userId === game.user.id
        ) {
            const newStun = data.system?.characteristics?.stun?.value ?? this.system.characteristics.stun.value;

            if (newStun <= 0) {
                await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect.id, {
                    overlay: true,
                    active: true,
                });
            }

            // Mark as defeated in combat tracker
            // Once an NPC is Knocked Out below the -10 STUN level,
            // he should normally remain unconscious until the fight ends.
            // No longer marking KO < stunThreshold as dead
            // if (data.system.characteristics.stun.value < stunThreshold) {
            //     await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
            //         overlay: true,
            //         active: true,
            //     });
            // }

            // Mark as undefeated in combat tracker
            // if (data.system.characteristics.stun.value >0) {
            //     //this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect);
            //     await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.deadEffect.id, {
            //         active: false,
            //     });
            // }

            if (newStun > 0) {
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

        // Mark as defeated in combat tracker (automaton)
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
        if (
            data?.system?.characteristics?.body?.value &&
            data?.system?.characteristics?.body?.value >= parseInt(this.system.characteristics.body.max)
        ) {
            const naturalHealingTempEffect = this.temporaryEffects.find(
                (o) => o.flags[game.system.id]?.XMLID === "naturalBodyHealing",
            );

            // Fire and forget
            if (naturalHealingTempEffect) {
                naturalHealingTempEffect.delete();
            }
        }

        if (data?.system?.characteristics) {
            const changes = {};

            for (const charName of Object.keys(data.system.characteristics)) {
                const charChanges = this.updateRollable(charName);

                foundry.utils.mergeObject(changes, charChanges);
            }

            await this.update(changes);
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

        // 5e calculated characteristics
        if (this.is5e && data.system?.characteristics?.dex?.value) {
            const dex = parseInt(data.system.characteristics.dex.value);
            if (dex) {
                const cv = Math.round(dex / 3);
                await this.update({
                    "system.characteristics.ocv.max": cv,
                    "system.characteristics.ocv.value": cv,
                    "system.characteristics.dcv.max": cv,
                    "system.characteristics.dcv.value": cv,
                });
            }
        }
        if (this.is5e && data.system?.characteristics?.ego?.value) {
            const ego = parseInt(data.system.characteristics.ego.value);
            if (ego) {
                const cv = Math.round(ego / 3);
                await this.update({
                    "system.characteristics.omcv.max": cv,
                    "system.characteristics.omcv.value": cv,
                    "system.characteristics.dmcv.max": cv,
                    "system.characteristics.dmcv.value": cv,
                });
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

    async TakeRecovery(asAction, token) {
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

        // Bases don't get/need a recovery
        if (this.type === "base2") {
            console.log(`${token?.name || this.name} has type ${this.type} and does not get/need a recovery.`);
            if (asAction) {
                ui.notifications.warn(
                    `${token?.name || this.name} has type ${this.type} and does not get/need a recovery.`,
                );
            }
            return `${tokenName} does not get a recovery.`;
        }

        // Catchall for no stun or end (shouldn't be needed as base type check above should be sufficient)
        if ((this.system.characteristics.end?.max || 0) === 0 && (this.system.characteristics.stun?.max || 0) === 0) {
            console.log(`${token?.name || this.name} has no STUN or END thus does not get/need a recovery.`);
            if (asAction) {
                ui.notifications.warn(
                    `${token?.name || this.name} has no STUN or END thus does not get/need a recovery.`,
                );
            }
            return `${tokenName} does not get a recovery.`;
        }

        // A character who holds their breath does not get to Recover (even
        // on Post-Segment 12)
        if (this.statuses.has("holdingBreath")) {
            const content = `${tokenName} <i>is holding their breath</i>.`;
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
        let deltaStun = newStun - parseInt(chars.stun.value);

        if (newEnd > chars.end.max) {
            newEnd = Math.max(chars.end.max, parseInt(chars.end.value)); // possible > MAX (which is OKish)
        }
        let deltaEnd = newEnd - parseInt(chars.end.value);

        await this.update(
            {
                "system.characteristics.stun.value": newStun,
                "system.characteristics.end.value": newEnd,
            },
            { hideChatMessage: true },
        );

        let content = `${tokenName} <i>Takes a Recovery</i>`;
        if (rec <= 0) {
            content += ` [REC=${chars.rec.value}]`;
        }
        if (deltaEnd || deltaStun) {
            if (chars.stun.value <= 0 && newStun > 0) {
                content += `, gaining ${deltaStun} stun and endurance set to ${newStun}.`;
            } else {
                content += `, gaining ${deltaEnd} endurance and ${deltaStun} stun.`;
            }
        } else {
            content += ".";
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
                            key: "system.characteristics.dcv.value",
                            value: 0.5,
                            mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
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

            // TODO: This is a DCV penalty to the base/vehicle in 5e and an OCV bonus to the attacker in 6e
            sizeActiveEffect.changes.push({
                key: "system.characteristics.dcv.value",
                value: _sizeDetails.dcv,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            });

            sizeActiveEffect.changes.push({
                key: "system.characteristics.str.value",
                value: _sizeDetails.str,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            });
            sizeActiveEffect.changes.push({
                key: "kbResistance",
                value: _sizeDetails.kbResistance,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            });
            sizeActiveEffect.changes.push({
                key: "system.characteristics.body.value",
                value: _sizeDetails.body,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
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
        const maxStrengthPct = RoundFavorPlayerDown((100 * encumbrance) / strLiftKg);
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
            (item) =>
                item.system.XMLID === "PENALTY_SKILL_LEVELS" &&
                item.system.penalty === "encumbrance" &&
                (item.type === "skill" || item.isActive),
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
                        key: "system.characteristics.dcv.value",
                        value: dcvDex,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.dex.value",
                        value: dcvDex,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.running.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.swimming.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.leaping.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.flight.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.swinging.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.teleportation.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                    {
                        key: "system.characteristics.tunneling.value",
                        value: move,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
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
                        key: "system.characteristics.dcv.value",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.running.value",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.leaping.value",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.swimming.value",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.swinging.value",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.tunneling.value",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
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
        // Remove all status effects
        for (const status of this.statuses) {
            const ae = Array.from(this.effects).find((effect) => effect.statuses.has(status));
            for (const status of ae.statuses) {
                await this.toggleStatusEffect(status, { active: false });
            }
        }

        // Remove temporary effects
        for (const ae of this.temporaryEffects) {
            await ae.delete();
        }

        // Remove all active effects with ACTOR as the parent
        // Shouldn't need this and sometimes causes duplicate delete
        // for (const ae of this.effects) {
        //     if (ae.parent instanceof HeroSystem6eActor) {
        //         await ae.delete();
        //     }
        // }

        // Set Characteristics MAX to CORE
        const characteristicChangesMax = {};
        for (const char of Object.keys(this.system.characteristics)) {
            const core = parseInt(this.system.characteristics[char].core);
            const max = parseInt(this.system.characteristics[char].max);
            if (core !== max) {
                characteristicChangesMax[`system.characteristics.${char}.max`] = core;
            }
        }
        if (Object.keys(characteristicChangesMax).length > 0) {
            await this.update(characteristicChangesMax);
        }

        // Set Characteristics VALUE to MAX
        const characteristicChangesValue = {};
        for (const char of Object.keys(this.system.characteristics)) {
            const max = parseInt(this.system.characteristics[char].max);
            const value = parseInt(this.system.characteristics[char].value);
            if (value !== max) {
                characteristicChangesValue[`system.characteristics.${char}.value`] = max;
            }
        }

        if (Object.keys(characteristicChangesValue).length > 0) {
            await this.update(characteristicChangesValue);
        }

        // Reset all items
        for (const item of this.items) {
            await item.resetToOriginal();
        }

        // Ghosts fly (or anything with RUNNING=0 and FLIGHT)
        if (this.system.characteristics?.running?.value === 0 && this.system.characteristics?.running?.core === 0) {
            for (const flight of this.items.filter((i) => i.system.XMLID === "FLIGHT")) {
                flight.system.active = false;
                await flight.toggle();
            }
        }

        // We just cleared encumbrance, check if it applies again
        await this.applyEncumbrancePenalty();

        // Mini-Migration
        for (const item of this.items) {
            await item._postUpload();
        }
        await this._postUpload();
    }

    // Raw base is insufficient for 5e characters
    getCharacteristicBase(key) {
        const powerInfo = getPowerInfo({ xmlid: key.toUpperCase(), actor: this, xmlTag: key.toUpperCase() });
        const base = parseInt(powerInfo?.base) || 0;

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
        const charBase = (characteristicUpperCase) => {
            return (
                parseInt(this.system[characteristicUpperCase]?.LEVELS || 0) +
                parseInt(
                    getPowerInfo({
                        xmlid: characteristicUpperCase,
                        actor: this,
                        xmlTag: characteristicUpperCase,
                    })?.base || 0,
                )
            );
        };

        switch (key.toLowerCase()) {
            // Physical Defense (PD) STR/5, STR/5 and an extra /3 if the right type of automaton
            case "pd":
                return RoundFavorPlayerUp(
                    base + Math.round((charBase("STR") + _str) / 5) / (isAutomatonWithNoStun ? 3 : 1),
                );

            // Energy Defense (ED) CON/5, CON/5 and /3 if the right type of automaton
            case "ed":
                return RoundFavorPlayerUp(
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

    async calcCharacteristicsCost() {
        const powers = getCharacteristicInfoArrayForActor(this);

        const changes = {};
        for (const powerInfo of powers) {
            const key = powerInfo.key.toLowerCase();
            const characteristic = this.system.characteristics[key];
            const core = parseInt(characteristic?.core) || 0;

            const base = this.getCharacteristicBase(key);
            const levels = core - base;
            let cost = Math.round(levels * (powerInfo.costPerLevel(this) || 0));

            // CHARACTERISTIC MAXIMA
            if (this.system.CHARACTER?.RULES) {
                if (!this.is5e) {
                    const characteristicMax = parseInt(this.system.CHARACTER.RULES[key.toUpperCase() + "_MAX"] || 0);
                    if (characteristicMax && core > characteristicMax) {
                        // Pay double for characteristics over CHARACTERISTIC MAXIMA
                        cost += Math.ceil((core - characteristicMax) * (powerInfo.costPerLevel(this) || 1));
                    }

                    if (this.system.characteristics[key].characteristicMax !== characteristicMax) {
                        changes[`system.characteristics.${key}.characteristicMax`] = characteristicMax;
                    }
                } else {
                    // 5e doesn't use characteristicMaximums
                    if (this.system.characteristics[key].characteristicMax) {
                        changes[`system.characteristics.${key}.-=characteristicMax`] = null;
                    }
                }
            }

            // 5e hack for fractional speed
            if (key === "spd" && cost < 0) {
                cost = Math.ceil(cost / 10);
            }

            if (characteristic.realCost !== cost) {
                changes[`system.characteristics.${key}.realCost`] = cost;
                this.system.characteristics[key].realCost = cost;
            }
            if (characteristic.core !== core) {
                changes[`system.characteristics.${key}.core`] = core;
                this.system.characteristics[key].core = core;
            }
        }
        if (Object.keys(changes).length > 0 && this.id) {
            await this.update(changes);
        }
        return;
    }

    getActiveConstantItems() {
        let results = [];
        for (let item of this.items.filter((item) => item.isActive)) {
            let duration = getPowerInfo({
                xmlid: item.system.XMLID,
                actor: this,
            })?.duration;
            if (duration === "constant") {
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
            .filter((ae) => !ae.isTemporary && ae.parent.duration === "constant")
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getPersistentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.duration === "persistent")
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getInherentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.duration === "inherent")
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getMiscEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && !ae.parent.duration)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async uploadFromXml(xml, options) {
        // Is this a linked actor?  If so upload into parent.
        // if (this.uuid.includes("Scene")) {
        //     console.warn(`Tried to upload a linked actor, redirecting to parent actor`);
        //     await game.actors.get(this.id).uploadFromXml(xml, options);
        //     return;
        // }

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
            body: parseInt(this.system.characteristics?.body?.max) - parseInt(this.system.characteristics?.body?.value),
            stun: parseInt(this.system.characteristics?.stun?.max) - parseInt(this.system.characteristics?.stun?.value),
            end: parseInt(this.system.characteristics?.end?.max) - parseInt(this.system.characteristics?.end?.value),
            hap: this.system.hap?.value,
            heroicIdentity: this.system.heroicIdentity ?? true,
            charges: this.items
                .filter(
                    (item) =>
                        item.system.charges &&
                        (item.system.charges.max != item.system.charges.value ||
                            item.system.charges.max != item.system.charges.value),
                )
                .map((o) => o.system),
        };

        const uploadPerformance = {
            startTime: new Date(),
            _d: new Date(),
        };

        // Let GM know actor is being uploaded (unless it is a quench test; missing ID)
        if (this.id) {
            ChatMessage.create({
                style: CONST.CHAT_MESSAGE_STYLES.IC,
                author: game.user._id,
                speaker: ChatMessage.getSpeaker({ actor: this }),
                whisper: whisperUserTargetsForActor(this),
                content: `<b>${game.user.name}</b> is uploading <b>${this.name}</b>`,
            });
        }

        // Remove all existing effects
        let promiseArray = [];
        promiseArray.push(
            this.deleteEmbeddedDocuments(
                "ActiveEffect",
                this.effects.map((o) => o.id),
            ),
        );

        // Remove all items from
        // Working on a merge instead of delete all and create all
        //promiseArray.push(this.deleteEmbeddedDocuments("Item", Array.from(this.items.keys())));

        let changes = {};

        // Convert XML into JSON
        const heroJson = {};
        HeroSystem6eActor._xmlToJsonNode(heroJson, xml.children);

        // Character name is what's in the sheet or, if missing, what is already in the actor sheet.
        const characterName = heroJson.CHARACTER.CHARACTER_INFO.CHARACTER_NAME || this.name;
        uploadPerformance.removeEffects = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();
        this.name = characterName;
        changes["name"] = this.name;
        changes[`flags.${game.system.id}`] = {
            uploading: true,
            file: {
                lastModifiedDate: options?.file?.lastModifiedDate,
                name: options?.file?.name,
                size: options?.file?.size,
                type: options?.file?.type,
                webkitRelativePath: options?.file?.webkitRelativePath,
                uploadedBy: game.user.name,
            },
        };

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /// Reset system properties to defaults
        const _actor = new HeroSystem6eActor(
            {
                name: "Test Actor",
                type: this.type,
                system: {
                    is5e: this.is5e,
                },
            },
            {},
        );
        const _system = _actor.system;

        // remove any system properties that are not part of system.json
        const schemaKeys = Object.keys(_system);
        for (const key of Object.keys(this.system)) {
            if (!schemaKeys.includes(key)) {
                changes[`system.-=${key}`] = null;
            }
        }
        for (const key of Object.keys(this.system.characteristics)) {
            if (!Object.keys(_system.characteristics).includes(key)) {
                changes[`system.characteristics.-=${key}`] = null;
            }
        }
        if (this.id) {
            // TODO: This shouldn't be required as we have migration handling this.
            for (const prop of Object.keys(this.flags).filter((f) => f !== game.system.id)) {
                changes[`flags.-=${prop}`] = null;
            }
            for (const prop of Object.keys(this.flags[game.system.id]).filter(
                (f) => !["uploading", "file"].includes(f),
            )) {
                changes[`flags.${game.system.id}-=${prop}`] = null;
            }

            promiseArray.push(this.update(changes));
        }

        // Wait for promiseArray to finish
        await Promise.all(promiseArray);
        uploadPerformance.resetToDefault = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();
        promiseArray = [];
        changes = {};

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /// WE ARE DONE RESETTING TOKEN PROPS
        /// NOW LOAD THE HDC STUFF

        // Keep raw XML data without IMAGE
        const xmlNoImage = foundry.utils.deepClone(xml);
        const image = xmlNoImage.getElementsByTagName("IMAGE")[0];
        image?.parentNode?.removeChild(image);
        this.system._hdc = new XMLSerializer().serializeToString(xmlNoImage);
        changes["system._hdc"] = this.system._hdc;

        // Heroic Action Points (always keep the value)
        changes["system.hap.value"] = retainValuesOnUpload.hap;

        // Heroic Identity
        changes["system.heroicIdentity"] = retainValuesOnUpload.heroicIdentity;

        // A few critical items.
        this.system.CHARACTER = heroJson.CHARACTER;
        this.system.versionHeroSystem6eUpload = game.system.version;
        changes["system.versionHeroSystem6eUpload"] = game.system.version;

        // CHARACTERISTICS
        if (heroJson.CHARACTER?.CHARACTERISTICS) {
            for (const [key, value] of Object.entries(heroJson.CHARACTER.CHARACTERISTICS)) {
                changes[`system.${key}`] = value;
                this.system[key] = value;
            }
            delete heroJson.CHARACTER.CHARACTERISTICS;
        }

        // is5e
        if (typeof this.system.CHARACTER?.TEMPLATE == "string") {
            this.system.template = this.system.CHARACTER.TEMPLATE;

            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                !this.system.CHARACTER.TEMPLATE.includes("6E.")
            ) {
                // 5E
                this.system.is5e = true;
            } else if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                this.system.CHARACTER.TEMPLATE.includes("6E.")
            ) {
                // 6E
                this.system.is5e = false;
            } else {
                console.error(`Unrecognized template ${this.system.template}`);
            }

            // Update actor type
            const targetType = this.system.CHARACTER.TEMPLATE.match(
                /\.(ai|automaton|base|computer|heroic|normal|superheroic|vehicle)[56.]/i,
            )?.[1]
                .toLowerCase()
                .replace("base", "base2")
                .replace("normal", "pc")
                .replace("superheroic", "pc")
                .replace("heroic", "pc");
            if (targetType && this.type.replace("npc", "pc") !== targetType) {
                await this.update({ type: targetType, [`==system`]: this.system });
            }
        }
        if (this.system.COM && !this.system.is5e) {
            this.system.is5e = true;
        }

        if (this.id) {
            // We can't delay this with the changes array because any items based on this actor needs this value.
            // Specifically compound power is a problem if we don't set is5e properly for a 5e actor.
            // Caution: Any this.system.* variables are lost if they are not updated here.
            await this.update({
                ...changes,
                "system.is5e": this.system.is5e,
                "system.CHARACTER.BASIC_CONFIGURATION": this.system.CHARACTER.BASIC_CONFIGURATION,
                "system.CHARACTER.CHARACTER_INFO": this.system.CHARACTER.CHARACTER_INFO,
                "system.CHARACTER.TEMPLATE": this.system.CHARACTER.TEMPLATE,
                "system.CHARACTER.version": this.system.CHARACTER.version,
            });
            changes = {};
        }

        // Quench test may need CHARACTERISTICS, which are set in postUpload
        await this._postUpload({ render: false });

        // Need count of maneuvers for progress bar
        const powerList = this.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        const freeStuffFilter = (power) =>
            (!(power.behaviors.includes("adder") || power.behaviors.includes("modifier")) &&
                power.type.includes("maneuver")) ||
            power.key === "PERCEPTION" || // Perception
            power.key === "__STRENGTHDAMAGE"; // Weapon placeholder (this is a dirty hack to count it so we can filter on it later)
        const freeStuffCount = powerList.filter(freeStuffFilter).length;

        const xmlItemsToProcess =
            1 + // we process heroJson.CHARACTER.CHARACTERISTICS all at once so just track as 1 item.
            heroJson.CHARACTER.DISADVANTAGES.length +
            heroJson.CHARACTER.EQUIPMENT.length +
            heroJson.CHARACTER.MARTIALARTS.length +
            heroJson.CHARACTER.PERKS.length +
            heroJson.CHARACTER.POWERS.length +
            heroJson.CHARACTER.SKILLS.length +
            heroJson.CHARACTER.TALENTS.length +
            (this.type === "pc" || this.type === "npc" || this.type === "automaton" ? freeStuffCount : 0) + // Free stuff
            1 + // Validating adjustment and powers
            1 + // Images
            1 + // Final save
            1 + // Restore retained damage
            1; // Not really sure why we need an extra +1
        const uploadProgressBar = new HeroProgressBar(`${this.name}: Processing HDC file`, xmlItemsToProcess);
        uploadPerformance.itemsToCreateEstimate = xmlItemsToProcess - 6;

        // NOTE don't put this into the promiseArray because we create things in here that are absolutely required by later items (e.g. strength placeholder).
        if (this.type === "pc" || this.type === "npc" || this.type === "automaton") {
            uploadProgressBar.advance(`${this.name}: Evaluating non HDC items for PCs, NPCs, and Automatons`, 0);

            await this.addFreeStuff();

            uploadProgressBar.advance(`${this.name}: Evaluated non HDC items for PCs, NPCs, and Automatons`, 0);
        }

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
                        system: { ...system, is5e: this.is5e },
                        sort: sortBase + parseInt(system.POSITION || 0),
                    };

                    // Hack in some basic information with names.
                    // TODO: This should be turned into some kind of short version of the description
                    //       and it should probably be done when building the description
                    switch (system.XMLID) {
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
                            if (!system.NAME) {
                                itemData.name = system?.ALIAS + " " + system?.INPUT;
                            }
                            break;
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
                            if (typeof value === "object") {
                                const values = value.length ? value : [value];
                                for (const system2 of values) {
                                    if (system2.XMLID) {
                                        const power = getPowerInfo({
                                            xmlid: system2.XMLID,
                                            actor: this,
                                            xmlTag: key,
                                        });
                                        if (!power || ["MODIFIER", "ADDER"].includes(power.xmlTag)) {
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
                                delete system[key];
                            }
                        }
                        compoundItems.sort((a, b) => parseInt(a.POSITION) - parseInt(b.POSITION));
                        for (const system2 of compoundItems) {
                            const power = getPowerInfo({
                                xmlid: system2.XMLID,
                                actor: this,
                                xmlTag: system2.xmlTag,
                            });
                            let itemData2 = {
                                name: system2.NAME || system2.ALIAS || system2.XMLID,
                                type: power.type.includes("skill") ? "skill" : "power",
                                system: {
                                    ...system2,
                                    PARENTID: system.ID,
                                    POSITION: parseInt(system2.POSITION),
                                    sort: itemData.sort + 100 + parseInt(system2.POSITION),
                                    errors: [...(system2.errors || []), "Added PARENTID for COMPOUNDPOWER child"],
                                    is5e: this.is5e,
                                },
                            };

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
                }
                delete heroJson.CHARACTER[itemTag];
            }
        }

        uploadProgressBar.advance(`${this.name}: Evaluated Items`, 0);

        uploadProgressBar.advance(`${this.name}: Updating Items`, 0);

        // Working on a merge to update previously existing items.
        // Add existing item.id (if it exists), which we will use for the pending update.
        // There may be an item that was converted to equipment/power
        itemsToCreate = itemsToCreate.map((m) =>
            foundry.utils.mergeObject(m, {
                _id: this.items.find((i) => i.system.ID === m.system.ID)?.id,
            }),
        );
        const itemsToUpdate = itemsToCreate.filter((o) => o._id);
        itemsToCreate = itemsToCreate.filter((o) => !o._id);

        // Sanity check for item.type
        for (const item of itemsToUpdate) {
            if (this.items.find((o) => o.id === item._id).type !== item.type) {
                await ui.notifications.warn(`${item.name} changed to type=${item.type}`);
            }
        }

        await this.updateEmbeddedDocuments("Item", itemsToUpdate);

        uploadProgressBar.advance(`${this.name}: Updated Items`, 0);

        uploadProgressBar.advance(`${this.name}: Creating Items`, 0);

        uploadPerformance.itemsToCreateActual = itemsToCreate.length;

        uploadPerformance.preItems = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();
        await this.createEmbeddedDocuments("Item", itemsToCreate, { render: false, renderSheet: false });
        uploadPerformance.createItems = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();

        uploadProgressBar.advance(`${this.name}: Created Items`, 0);
        uploadProgressBar.advance(`${this.name}: Processing characteristics`, 0);

        // Do CSLs last so we can property select the attacks
        // TODO: infinite loop of _postUpload until no changes?
        // Do CHARACTERISTICS first (mostly for applyEncumbrance)

        const characteristicItems = this.items.filter((item) => item.baseInfo?.type.includes("characteristic"));
        await Promise.all(characteristicItems.map((item) => item._postUpload({ render: false, uploadProgressBar })));
        await this._postUpload({ render: false });

        uploadProgressBar.advance(`${this.name}: Processed characteristics`, 0);
        uploadProgressBar.advance(`${this.name}: Processing non characteristics`, 0);

        const doLastXmlids = ["COMBAT_LEVELS", "MENTAL_COMBAT_LEVELS", "MENTALDEFENSE"];
        const nonCharacteristicItemsThatAreNotFreeItems = this.items.filter(
            (item) => !doLastXmlids.includes(item.system.XMLID) && !item.baseInfo?.type.includes("characteristic"),
        );
        await Promise.all(
            nonCharacteristicItemsThatAreNotFreeItems.map((item) =>
                item._postUpload({ render: false, uploadProgressBar, applyEncumbrance: false }),
            ),
        );
        await this.applySizeEffect();

        await Promise.all(
            this.items
                .filter(
                    (item) =>
                        doLastXmlids.includes(item.system.XMLID) && !item.baseInfo?.type.includes("characteristic"),
                )
                .map((item) => item._postUpload({ render: false, uploadProgressBar })),
        );

        // Make sure any powers with characteristic properties
        // reflect in current VALUE
        await this.FullHealth();

        // retainValuesOnUpload Charges
        for (const chargeData of retainValuesOnUpload.charges) {
            const item = this.items.find((i) => i.system.ID === chargeData.ID);
            if (item) {
                const chargesUsed = Math.max(0, chargeData.charges.max - chargeData.charges.value);
                if (chargesUsed) {
                    await item.update({ "system.charges.value": Math.max(0, item.system.charges.max - chargesUsed) });
                }
                const clipsUsed = Math.max(0, chargeData.clips - chargeData.clipsMax);
                if (clipsUsed) {
                    await item.update({ "system.clips.value": Math.max(0, item.system.clipsMax - clipsUsed) });
                }
                item.updateItemDescription();
                await item.update({ "system.description": item.system.description });
            } else {
                await ui.notifications.warn(
                    `Unable to locate ${chargeData.NAME}/${chargeData.ALIAS} to consume charges after upload.`,
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
                    `${this.name}/${item.detailedName()} has unknown power XMLID}. Please report.`,
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

        // Warn about invalid adjustment targets
        for (const item of this.items.filter((item) => item.baseInfo?.type?.includes("adjustment"))) {
            const result = item.splitAdjustmentSourceAndTarget();
            if (!result.valid) {
                await ui.notifications.warn(
                    `${this.name} has an unsupported adjustment target "${item.system.INPUT}" for "${
                        item.name
                    }". Use characteristic abbreviations or power names separated by commas for automation support.${
                        item.system.XMLID === "TRANSFER"
                            ? ' Source and target lists should be separated by " -> ".'
                            : ""
                    }`,
                    { console: true, permanent: true },
                );
            } else {
                const maxAllowedEffects = item.numberOfSimultaneousAdjustmentEffects();
                if (
                    result.reducesArray.length > maxAllowedEffects.maxReduces ||
                    result.enhancesArray.length > maxAllowedEffects.maxEnhances
                ) {
                    await ui.notifications.warn(
                        `${this.name} has too many adjustment targets defined for ${item.name}.`,
                    );
                }
            }
        }

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
            const filename = heroJson.CHARACTER.IMAGE?.FileName;
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
                    const extension = filename.split(".").pop();
                    const base64 =
                        "data:image/" + extension + ";base64," + xml.getElementsByTagName("IMAGE")[0].textContent;

                    await ImageHelper.uploadBase64(base64, filename, path);

                    // FORGE stuff (because users add things into their own directories)
                    if (typeof ForgeAPI !== "undefined") {
                        const forgeUser = (await ForgeAPI.status()).user;
                        relativePathName = `https://assets.forge-vtt.com/${forgeUser}/${relativePathName}`;
                    }

                    // Update any tokens images that might exist
                    for (const token of this.getActiveTokens()) {
                        await token.document.update({
                            "texture.src": relativePathName,
                        });
                    }
                }

                changes["img"] = relativePathName;
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
            changes["img"] = CONST.DEFAULT_TOKEN;
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

        // Set base values to HDC LEVELs and calculate costs of things.
        await this._postUpload({ render: false });

        // Ghosts fly (or anything with RUNNING=0 and FLIGHT)
        if (this.system.characteristics?.running?.value === 0 && this.system.characteristics?.running?.core === 0) {
            for (const flight of this.items.filter((i) => i.system.XMLID === "FLIGHT")) {
                await flight.toggle();
            }
        }

        uploadPerformance.actorPostUpload = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();

        // Kluge to ensure everything has a SPD.
        // For example a BASE has an implied SPD of three
        this.system.characteristics.spd ??= {
            core: 3,
        };

        // For some unknown reason SPD with AE not working during upload.
        // This kludge is a quick fix
        // https://github.com/dmdorman/hero6e-foundryvtt/issues/1439
        // All characteristics?
        // https://github.com/dmdorman/hero6e-foundryvtt/issues/1746
        if (this.id) {
            for (const char of Object.keys(this.system.characteristics)) {
                await this.update({ [`system.characteristics.${char}.max`]: this.system.characteristics[char].core });
                await this.update({ [`system.characteristics.${char}.value`]: this.system.characteristics[char].max });
            }
        }

        // duplicate ID can be a problem
        for (const item of this.items) {
            if (item.system.ID) {
                const dups = this.items.filter((i) => i.system.ID === item.system.ID);
                if (dups.length > 1) {
                    // Try to give duplicate items a new ID
                    for (const dupItem of dups.splice(1)) {
                        if (dupItem.childItems.length === 0) {
                            await dupItem.update({
                                [`system.idDuplicate`]: dupItem.system.ID,
                                [`system.ID`]: new Date().getTime().toString(),
                                [`system.error`]: [...(dupItem.system.error || []), "Duplicate ID, created new one"],
                            });
                            ui.notifications.warn(
                                `Created new internal ID reference for <b>${item.name}</b>. Recommend deleting item from HDC file and re-creating it.`,
                            );
                        } else {
                            ui.notifications.warn(
                                `Duplicate ID reference for <b>${item.name}</b> may cause problems. Recommend deleting item from HDC file and re-creating it.`,
                                { permanent: true },
                            );
                        }
                    }
                }
            }
        }

        // Re-run _postUpload for CSL's or items that showAttacks so we can guess associated attacks (now that all attacks are loaded)
        this.items
            .filter((item) => item.system.csl || item.baseInfo?.editOptions?.showAttacks)
            .forEach(async (item) => {
                await item._postUpload({ render: false, applyEncumbrance: false });
            });

        // Re-run _postUpload for SKILLS
        this.items
            .filter((item) => item.type === "skill")
            .forEach(async (item) => {
                await item._postUpload({ render: false, applyEncumbrance: false });
            });
        uploadPerformance.postUpload2 = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();

        uploadProgressBar.advance(`${this.name}: Saved core changes`);
        uploadProgressBar.advance(`${this.name}: Restoring retained damage`, 0);

        // Apply retained damage
        if (this.id && (retainValuesOnUpload.body || retainValuesOnUpload.stun || retainValuesOnUpload.end)) {
            this.system.characteristics.body.value -= retainValuesOnUpload.body;
            this.system.characteristics.stun.value -= retainValuesOnUpload.stun;
            this.system.characteristics.end.value -= retainValuesOnUpload.end;
            if (this.id) {
                await this.update(
                    {
                        "system.characteristics.body.value": this.system.characteristics.body.value,
                        "system.characteristics.stun.value": this.system.characteristics.stun.value,
                        "system.characteristics.end.value": this.system.characteristics.end.value,
                    },
                    { render: false },
                );
            }
        }

        if (this.id) {
            await this.update({ [`flags.${game.system.id}.-=uploading`]: null });
        }
        uploadPerformance.retainedDamage = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();

        uploadProgressBar.advance(`${this.name}: Restored retained damage`);

        // If we have control of this token, reacquire to update movement types
        const myToken = this.getActiveTokens()?.[0];
        if (canvas.tokens.controlled.find((t) => t.id == myToken?.id)) {
            myToken.release();
            myToken.control();
        }
        uploadPerformance.tokenControl = new Date().getTime() - uploadPerformance._d;
        uploadPerformance._d = new Date().getTime();

        uploadProgressBar.close(`Uploaded ${this.name}`);

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

        // Delete any old items that weren't updated or added
        if (this.id) {
            const itemsToDelete = this.items.filter(
                (item) =>
                    item.system.ID &&
                    !itemsToUpdate.find((o) => item.id === o._id) &&
                    !itemsToCreate.find((p) => item.system.ID === p.system.ID),
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
                    await this.deleteEmbeddedDocuments(
                        "Item",
                        itemsToDelete.map((o) => o.id),
                    );
                    await this._postUpload(); // Needed for actor CP/AP
                } else {
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
    }

    /**
     * Characters get a few things for free that are not in the HDC.
     * NOTE: None of these methods should call _postUpload as that is done separately during actor creation.
     *
     * @returns
     */
    async addFreeStuff() {
        // Remove any is5e FreeStuff mis-matches (happens when you upload 5e over 6e actor, or vice versa)
        const mismatchItems = this.items.filter(
            (item) => (item.system.XMLID === "PERCEPTION" || item.type === "maneuver") && item.is5e !== this.is5e,
        );

        if (mismatchItems.length > 0) {
            console.warn(`Deleting ${mismatchItems.length} item because is5e doesn't match actor`, mismatchItems);
            await this.deleteEmbeddedDocuments(
                "Item",
                mismatchItems.map((m) => m.id),
            );
        }

        await this.addPerception();
        await this.addHeroSystemManeuvers();
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
            (item) => item.system.XMLID === XMLID && item.type === "maneuver" && !item.system.ID,
        );
        if (maneuverItems.length > 0) {
            console.debug(`${XMLID} already exists`);

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
        const powerList = this.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
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
            if (!jsonChild.XMLID) {
                const powerInfo = getPowerInfo({
                    xmlid: jsonChild.xmlTag,
                    xmlTag: child.parentNode.tagName === "CHARACTERISTICS" ? jsonChild.xmlTag : null,
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

            // An attempt to track hierarchy of ADDERS/MODS
            if (
                !jsonChild.PARENTID &&
                jsonChild.ID &&
                child.parentNode?.getAttribute &&
                child.parentNode?.getAttribute("ID")
            ) {
                jsonChild.PARENTID = child.parentNode.getAttribute("ID");
            }

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
            let powerInfo = getPowerInfo({
                xmlid: key.toUpperCase(),
                actor: this,
            });
            let value = parseInt(char.LEVELS || 0) + parseInt(powerInfo?.base || 0);
            changes[`system.characteristics.${key.toLowerCase()}.core`] = value;

            changes[`system.characteristics.${key.toLowerCase()}.max`] = value;
            changes[`system.characteristics.${key.toLowerCase()}.value`] = value;
        }
        await this.update(changes);
    }

    async _postUpload(overrideValues) {
        const changes = {};
        let changed = false;

        // is5e
        if (typeof this.system.CHARACTER?.TEMPLATE === "string") {
            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                !this.system.CHARACTER.TEMPLATE.includes("6E.") &&
                !this.system.is5e
            ) {
                changes["system.is5e"] = true;
                this.system.is5e = true;
            }
            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                this.system.CHARACTER.TEMPLATE.includes("6E.") &&
                this.system.is5e === undefined
            ) {
                changes["system.is5e"] = false;
                this.system.is5e = false;
            }
        }
        if (this.system.COM && !this.system.is5e) {
            changes["system.is5e"] = true;
            this.system.is5e = true;
        }

        if (this.system.is5e && this.id) {
            await this.update({ [`system.is5e`]: this.system.is5e });
        }

        // ONLY IN ALTERNATE IDENTITY (OIAID)
        // Assume we are in our super/heroic identity
        if (this.system.heroicIdentity === undefined) {
            //this.system.heroicIdentity = true;
            changes[`system.heroicIdentity`] = true;
        }

        // Characteristics
        for (const key of Object.keys(this.system.characteristics)) {
            // Only update characteristics if there are no active effects modifying the characteristic
            //const charHasEffect = this.appliedEffects.find((e) => e.changes.find((c) => c.key.includes(key)));
            let newValue = parseInt(this.system?.[key.toUpperCase()]?.LEVELS || 0); // uppercase?  LEVELS?  This probably hasn't worked in a long time!
            newValue += this.getCharacteristicBase(key) || 0; // 5e will have empty base for ocv/dcv and other figured characteristics

            newValue = Math.floor(newValue); // For 5e SPD

            if (this.system.characteristics[key].max !== newValue) {
                this.system.characteristics[key.toLowerCase()].max = Math.floor(newValue);
                if (this.id) {
                    changes[`system.characteristics.${key.toLowerCase()}.max`] = Math.floor(newValue);
                }
                changed = true;
            }
            if (
                this.system.characteristics[key].value !== this.system.characteristics[key.toLowerCase()].max &&
                this.system.characteristics[key.toLowerCase()].max !== null &&
                overrideValues
            ) {
                this.system.characteristics[key.toLowerCase()].value =
                    this.system.characteristics[key.toLowerCase()].max;
                if (this.id) {
                    changes[`system.characteristics.${key.toLowerCase()}.value`] =
                        this.system.characteristics[key.toLowerCase()].max;
                }
                changed = true;
            }
            if (this.system.characteristics[key].core !== newValue && overrideValues) {
                changes[`system.characteristics.${key.toLowerCase()}.core`] = newValue;
                this.system.characteristics[key.toLowerCase()].core = newValue;
                changed = true;
            }

            // Rollable Characteristics
            const rollableChanges = this.updateRollable(key.toLowerCase());
            if (rollableChanges) {
                changed = true;
                foundry.utils.mergeObject(changes, rollableChanges);
            }
        }

        // Save changes
        if (changed && this.id) {
            await this.update(changes);
        }

        // Initiative Characteristic
        if (this.system.initiativeCharacteristic === undefined) {
            // Careful: Not all actors have ego/dex/omcv, such as a base/vehicle.
            if (
                this.system.characteristics.ego?.value > this.system.characteristics.dex?.value &&
                this.system.characteristics.omcv?.value >= this.system.characteristics.ocv?.value
            ) {
                if (!game.settings.get(game.system.id, "defaultDexInitiative")) {
                    if (this.id) {
                        await this.update({
                            "system.initiativeCharacteristic": "ego",
                        });
                    } else {
                        this.system.initiativeCharacteristic = "ego";
                    }
                }
            }
        }

        // Combat Skill Levels - Enumerate attacks that use OCV
        for (let cslItem of this.items.filter((o) =>
            ["MENTAL_COMBAT_LEVELS", "COMBAT_LEVELS"].includes(o.system.XMLID),
        )) {
            let _ocv = "ocv";
            if (cslItem.system.XMLID === "MENTAL_COMBAT_LEVELS") {
                _ocv = "omcv";
            }

            let attacks = {};
            let checkedCount = 0;

            for (const attack of this._cslItems.filter((o) => o.system.uses === _ocv)) {
                let checked = false;

                // Attempt to determine if attack should be checked
                if (cslItem.system.OPTION_ALIAS.toLowerCase().indexOf(attack.name.toLowerCase()) > -1) {
                    checked = true;
                }

                if (
                    cslItem.system.OPTION === "HTH" &&
                    (attack.system.XMLID === "HTH" ||
                        attack.system.XMLID === "HANDTOHANDATTACK" ||
                        attack.system.XMLID === "HKA" ||
                        attack.system.XMLID === "MANEUVER" ||
                        (attack.type === "maneuver" && !attack.system.EFFECT?.match(/throw/i)))
                ) {
                    checked = true;
                }

                if (
                    cslItem.system.OPTION === "RANGED" &&
                    (attack.system.XMLID === "BLAST" || attack.system.XMLID === "RKA")
                ) {
                    checked = true;
                }

                if (cslItem.system.OPTION === "ALL") {
                    checked = true;
                }

                if (cslItem.system.OPTION === "TIGHT") {
                    // up to three
                    if (cslItem.system.XMLID === "COMBAT_LEVELS" && attack.type != "maneuver" && checkedCount < 3) {
                        checked = true;
                    }

                    // up to three
                    if (cslItem.system.XMLID === "MENTAL_COMBAT_LEVELS" && checkedCount < 3) {
                        checked = true;
                    }
                }

                if (cslItem.system.OPTION === "BROAD") {
                    // A large group is more than 3 but less than ALL (whatever that means).
                    // For now just assume all (non maneuvers).
                    if (cslItem.system.XMLID === "COMBAT_LEVELS" && attack.type != "maneuver") {
                        checked = true;
                    }

                    // For mental BROAD is actually equal to ALL
                    if (cslItem.system.XMLID === "MENTAL_COMBAT_LEVELS") {
                        checked = true;
                    }
                }

                attacks[attack.id] = checked;

                if (checked) checkedCount++;
            }

            if (cslItem._id) {
                await cslItem.update({ "system.attacks": attacks }, { hideChatMessage: true });
            }
        }

        await this.calcCharacteristicsCost();
        await this.CalcActorRealAndActivePoints();

        this.render();

        // Update actor sidebar (needed when name is changed)
        ui.actors.render();

        return changed;
    }

    updateRollable(key) {
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

    async CalcActorRealAndActivePoints() {
        // Calculate realCost & Active Points for bought as characteristics
        let characterPointCost = 0;
        let activePoints = 0;

        this.system.pointsDetail = {};
        this.system.activePointsDetail = {};

        const powers = getCharacteristicInfoArrayForActor(this);
        for (const powerInfo of powers) {
            characterPointCost += parseFloat(this.system.characteristics[powerInfo.key.toLowerCase()]?.realCost || 0);
            activePoints += parseFloat(this.system.characteristics[powerInfo.key.toLowerCase()]?.activePoints || 0);
        }
        this.system.pointsDetail.characteristics = characterPointCost;
        this.system.activePointsDetail.characteristics = characterPointCost;

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
            let _characterPointCost = parseFloat(item.system?.characterPointCost || item.system?.realCost) || 0;
            const _activePoints = parseFloat(item.system?.activePoints) || 0;

            if (_characterPointCost !== 0) {
                // Equipment is typically purchased with money, not character points
                if ((item.parentItem?.type || item.type) !== "equipment" && item.type !== "disadvantage") {
                    characterPointCost += _characterPointCost;
                }

                if (item.type !== "disadvantage") {
                    activePoints += _activePoints;
                }

                this.system.pointsDetail[item.parentItem?.type || item.type] ??= 0;
                this.system.activePointsDetail[item.parentItem?.type || item.type] ??= 0;

                this.system.pointsDetail[item.parentItem?.type || item.type] += _characterPointCost;
                this.system.activePointsDetail[item.parentItem?.type || item.type] += _activePoints;
            }
        }

        // DISAD_POINTS: realCost
        const DISAD_POINTS = parseFloat(this.system.CHARACTER?.BASIC_CONFIGURATION?.DISAD_POINTS || 0);
        const _disadPoints = Math.min(DISAD_POINTS, this.system.pointsDetail?.disadvantage || 0);
        if (_disadPoints !== 0) {
            this.system.pointsDetail.MatchingDisads = _disadPoints;
            this.system.activePointsDetail.MatchingDisads = _disadPoints;
            // characterPointCost -= _disadPoints;
            // activePoints -= _disadPoints;
        }

        this.system.realCost = characterPointCost;
        this.system.activePoints = activePoints;
        if (this.id) {
            await this.update(
                {
                    "system.points": characterPointCost,
                    "system.activePoints": activePoints,
                    "system.pointsDetail": this.system.pointsDetail,
                    "system.activePointsDetail": this.system.activePointsDetail,
                },
                //{ render: false },
                { hideChatMessage: true },
            );
        } else {
            this.system.points = characterPointCost;
            this.system.activePoints = activePoints;
        }
    }

    pslPentaltyItems(penaltyType) {
        return this.items.filter((item) => item.pslPenaltyType === penaltyType);
    }

    pslPentaltyValue(penaltyType) {
        const psls = this.pslPentaltyItems(penaltyType);
        const valueSum = psls.reduce(
            (accumulator, currentValue) => accumulator + parseInt(currentValue.system.LEVELS) || 0,
            0,
        );
        return valueSum;
    }

    get is5e() {
        if (this.system.template) {
            if (this.system.is5e && this.system.template.includes("6")) {
                console.error(
                    `${this.name} has is5e=${this.system.is5e} does not match template ${this.system.template}`,
                );
            }

            if (!this.system.is5e && this.system.template.includes("5")) {
                console.error(
                    `${this.name} has is5e=${this.system.is5e} does not match template ${this.system.template}`,
                );
            }
        }
        return this.system.is5e;
    }

    get _characterPoints() {
        return this.system.points;
    }

    get _characterPointsForDisplay() {
        return RoundFavorPlayerDown(this._characterPoints);
    }

    get _activePoints() {
        return this.system.activePoints;
    }

    get _activePointsForDisplay() {
        return RoundFavorPlayerDown(this._activePoints);
    }

    get _cslItems() {
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
                (o) =>
                    o.rollsToHit() &&
                    (!o.baseInfo.behaviors.includes("optional-maneuver") ||
                        game.settings.get(HEROSYS.module, "optionalManeuvers")) &&
                    !o.system.XMLID.startsWith("__"),
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .sort(_sortCslItems);
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
            const template = this.system.CHARACTER?.TEMPLATE || this.system.CHARACTER?.BASIC_CONFIGURATION?.TEMPLATE;
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
            }

            if (templateType === "" && this.type !== "base2" && this.flags[game.system.id]?.uploading !== true) {
                // Custom Templates
                // Automations
                // Barrier
                if (this.id && this.system.CHARACTER) {
                    console.warn(
                        `Unknown template type for ${this.name}.`,
                        this.system.CHARACTER?.TEMPLATE,
                        this.system.BASIC_CONFIGURATION?.TEMPLATE,
                    );
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

    // HeroSystem is unique in that we only
    // apply only one multiplier (whichever one reduces the most).
    /**
     * Apply any transformations to the Actor data which are caused by ActiveEffects.
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
        const mults = changes.filter((c) => c.mode === CONST.ACTIVE_EFFECT_MODES.MULTIPLY);
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
                    // remove all multsUnieuqKey and add back in the keepMult
                    changes = changes.filter((c) => c.key !== key || c.mode !== CONST.ACTIVE_EFFECT_MODES.MULTIPLY);
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
}
