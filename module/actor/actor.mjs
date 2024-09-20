import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor-active-effects.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo, getCharacteristicInfoArrayForActor } from "../utility/util.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";
import { clamp } from "../utility/compatibility.mjs";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class HeroSystem6eActor extends Actor {
    /** @inheritdoc */
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        //TODO: Add user configuration for initial prototype settings

        HEROSYS.log(false, "_preCreate");
        let prototypeToken = {
            // Leaving sight disabled.
            // TODO: Implement various Enhanced Visions
            // sight: { enabled: true },
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

        this.updateSource({
            prototypeToken: prototypeToken,
            system: {
                versionHeroSystem6eCreated: game.system.version,
                is5e: false,
            },
        });
    }

    async removeActiveEffect(activeEffect) {
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
    }

    // Adding ActiveEffects seems complicated.
    // Make sure only one of the same ActiveEffect is added
    // Assumes ActiveEffect is a statusEffects.
    // TODO: Allow for a non-statusEffects ActiveEffect (like from a power)
    async addActiveEffect(activeEffect) {
        const newEffect = foundry.utils.deepClone(activeEffect);

        // Check for standard StatusEffects
        // statuses appears to be necessary to associate with StatusEffects
        if (activeEffect.id) {
            newEffect.statuses = [activeEffect.id];

            // Check if this ActiveEffect already exists
            const existingEffect = this.effects.find((o) => o.statuses.has(activeEffect.id));
            if (!existingEffect) {
                await this.createEmbeddedDocuments("ActiveEffect", [newEffect]);
            }
        }

        if (activeEffect.id == "knockedOut") {
            // Knocked Out overrides Stunned
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.stunEffect);
        }
    }

    async ChangeType() {
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
        const html = await renderTemplate(template, cardData);
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
                await actor.update({
                    type: html.find("input:checked")[0].value,
                });
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

        if (changed?.system?.characteristics?.stun?.value) {
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

        if (changed?.system?.characteristics?.body?.value) {
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
                user: game.user.id,
                whisper: ChatMessage.getWhisperRecipients("GM"),
                speaker: ChatMessage.getSpeaker({ actor: this }),
                blind: true,
                content: content,
            };
            await ChatMessage.create(chatData);
        }
    }

    async _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);

        // If stun was changed and running under triggering users context
        if (data?.system?.characteristics?.stun && userId === game.user.id) {
            if (data.system.characteristics.stun.value <= 0) {
                this.addActiveEffect(HeroSystem6eActorActiveEffects.knockedOutEffect);
            }

            // Mark as defeated in combat tracker
            if (data.type != "pc" && data.system.characteristics.stun.value < -10) {
                const combatant = game.combat?.combatants.find((o) => o.actorId === data._id);
                if (combatant && !combatant.defeated) {
                    combatant.update({ defeated: true });
                }
            }

            // Mark as undefeated in combat tracker
            if (data.type != "pc" && data.system.characteristics.stun.value > -10) {
                let combatant = game.combat?.combatants?.find((o) => o.actorId === data._id);
                if (combatant && combatant.defeated) {
                    combatant.update({ defeated: false });
                }
            }

            if (data.system.characteristics.stun.value > 0) {
                this.removeActiveEffect(HeroSystem6eActorActiveEffects.knockedOutEffect);
            }
        }

        // If STR was change check encumbrance
        if (data?.system?.characteristics?.str && userId === game.user.id) {
            this.applyEncumbrancePenalty();
        }

        // Ensure natural healing effect is removed when returned to full BODY
        if (
            data?.system?.characteristics?.body?.value &&
            data?.system?.characteristics?.body?.value >= parseInt(this.system.characteristics.body.max)
        ) {
            const naturalHealingTempEffect = this.temporaryEffects.find((o) => o.flags.XMLID === "naturalBodyHealing");

            // Fire and forget
            if (naturalHealingTempEffect) {
                naturalHealingTempEffect.delete();
            }
        }

        // Display changes from _preUpdate
        for (let d of options.displayScrollingChanges) {
            this._displayScrollingChange(d.value, d.options);
        }
    }

    async TakeRecovery(asAction) {
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

        let token = this.token;
        let speaker = ChatMessage.getSpeaker({ actor: this, token });
        speaker["alias"] = this.name;

        // A character who holds their breath does not get to Recover (even
        // on Post-Segment 12)
        if (this.statuses.has("holdingBreath")) {
            const content = this.name + " <i>is holding their breath</i>.";
            if (asAction) {
                const chatData = {
                    user: game.user._id,
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
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

        let newStun = parseInt(chars.stun.value) + parseInt(chars.rec.value);
        let newEnd = parseInt(chars.end.value) + parseInt(chars.rec.value);

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

        let content = this.name + ` <i>Takes a Recovery</i>`;
        if (deltaEnd || deltaStun) {
            content += `, gaining ${deltaEnd} endurance and ${deltaStun} stun.`;
        } else {
            content += ".";
        }

        const chatData = {
            user: game.user._id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: content,
            speaker: speaker,
        };

        if (asAction) {
            await ChatMessage.create(chatData);

            // Remove stunned condition.
            // While not technically part of the rules, it is here as a convenience.
            // For example when Combat Tracker isn't being used.
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.stunEffect);
        }

        return content;
    }

    // When stunned, knockedout, etc you cannot act
    canAct(uiNotice) {
        if (this.statuses.has("knockedOut")) {
            if (uiNotice) ui.notifications.error(`${this.name} is KNOCKED OUT and cannot act.`);
            return false;
        }

        if (this.statuses.has("stunned")) {
            if (uiNotice) ui.notifications.error(`${this.name} is STUNNED and cannot act.`);
            return false;
        }

        if (this.statuses.has("aborted")) {
            if (uiNotice) ui.notifications.error(`${this.name} has ABORTED and cannot act.`);
            return false;
        }

        // A character
        // who is Stunned or recovering from being
        // Stunned can take no Actions, take no Recoveries
        // (except their free Post-Segment 12 Recovery), cannot
        // move, and cannot be affected by Presence Attacks.

        // Recovering from being Stunned requires a Full
        // Phase, and is the only thing the character can do
        // during that Phase.

        if (this.statuses.has("stunned")) {
            if (uiNotice) ui.notifications.error(`${this.name} is STUNNED and cannot act.`);
            return false;
        }
        return true;
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

        canvas.interface.createScrollingText(token.center, change.signedString(), {
            anchor: change < 0 ? CONST.TEXT_ANCHOR_POINTS.BOTTOM : CONST.TEXT_ANCHOR_POINTS.TOP,
            direction: change < 0 ? 1 : 2,
            fontSize: clamp(fontSize, 50, 100),
            fill: options?.fill || "0xFFFFFF",
            stroke: options?.stroke || 0x00000000,
            strokeThickness: 4,
            jitter: 0.25,
        });
    }

    strDetails() {
        let strLiftText = "0";
        let strRunningThrow = 0;
        let value = this.system.characteristics.str?.value;
        if (value >= 1) {
            strLiftText = "8kg";
            strRunningThrow = 2;
        }
        if (value >= 2) {
            strLiftText = "16kg";
            strRunningThrow = 3;
        }
        if (value >= 3) {
            strLiftText = "25kg";
            strRunningThrow = 4;
        }
        if (value >= 4) {
            strLiftText = "38kg";
            strRunningThrow = 6;
        }
        if (value >= 5) {
            strLiftText = "50kg";
            strRunningThrow = 8;
        }
        if (value >= 8) {
            strLiftText = "75kg";
            strRunningThrow = 12;
        }
        if (value >= 10) {
            strLiftText = "100kg";
            strRunningThrow = 16;
        }
        if (value >= 13) {
            strLiftText = "150kg";
            strRunningThrow = 20;
        }
        if (value >= 15) {
            strLiftText = "200kg";
            strRunningThrow = 24;
        }
        if (value >= 18) {
            strLiftText = "300kg";
            strRunningThrow = 28;
        }
        if (value >= 20) {
            strLiftText = "400kg";
            strRunningThrow = 32;
        }
        if (value >= 23) {
            strLiftText = "600kg";
            strRunningThrow = 36;
        }
        if (value >= 25) {
            strLiftText = "800kg";
            strRunningThrow = 40;
        }
        if (value >= 28) {
            strLiftText = "1,200kg";
            strRunningThrow = 44;
        }
        if (value >= 30) {
            strLiftText = "1,600kg";
            strRunningThrow = 48;
        }
        if (value >= 35) {
            strLiftText = "3,200kg";
            strRunningThrow = 56;
        }
        if (value >= 40) {
            strLiftText = "6,400kg";
            strRunningThrow = 64;
        }
        if (value >= 45) {
            strLiftText = "12.5 tons";
            strRunningThrow = 72;
        }
        if (value >= 50) {
            strLiftText = "25 tons";
            strRunningThrow = 80;
        }
        if (value >= 55) {
            strLiftText = "50 tons";
            strRunningThrow = 88;
        }
        if (value >= 60) {
            strLiftText = "100 tons";
            strRunningThrow = 96;
        }
        if (value >= 65) {
            strLiftText = "200 tons";
            strRunningThrow = 104;
        }
        if (value >= 70) {
            strLiftText = "400 tons";
            strRunningThrow = 112;
        }
        if (value >= 75) {
            strLiftText = "800 tons";
            strRunningThrow = 120;
        }
        if (value >= 80) {
            strLiftText = "1.6 ktons";
            strRunningThrow = 128;
        }
        if (value >= 85) {
            strLiftText = "3.2 ktons";
            strRunningThrow = 136;
        }
        if (value >= 90) {
            strLiftText = "6.4 ktons";
            strRunningThrow = 144;
        }
        if (value >= 95) {
            strLiftText = "12.5 ktons";
            strRunningThrow = 152;
        }
        if (value >= 100) {
            strLiftText = "25 ktons";
            strRunningThrow = 160;
        }
        if (value >= 105) {
            strLiftText = `${50 + Math.floor((value - 105) / 5) * 25} ktons`;
            strRunningThrow = 168 + Math.floor((value - 105) / 5) * 8;
        }

        if (this.system.is5e) {
            if (value < -25) {
                strLiftText = "0";
                strRunningThrow = 0;
            }
            if (value >= -25 && value < -23) {
                strLiftText = "0.8kg";
                strRunningThrow = 1;
            }
            if (value >= -23 && value < -20) {
                strLiftText = "1kg";
                strRunningThrow = 1;
            }
            if (value >= -20 && value < -18) {
                strLiftText = "1.6kg";
                strRunningThrow = 1;
            }
            if (value >= -18 && value < -15) {
                strLiftText = "2kg";
                strRunningThrow = 1;
            }
            if (value >= -15 && value < -13) {
                strLiftText = "3.2kg";
                strRunningThrow = 1;
            }
            if (value >= -13 && value < -10) {
                strLiftText = "4kg";
                strRunningThrow = 1;
            }
            if (value >= -10 && value < -8) {
                strLiftText = "6.4kg";
                strRunningThrow = 1;
            }
            if (value >= -8 && value < -5) {
                strLiftText = "8kg";
                strRunningThrow = 2;
            }
            if (value >= -5 && value < -3) {
                strLiftText = "12.5kg";
                strRunningThrow = 2;
            }
            if (value >= -3 && value < 0) {
                strLiftText = "16kg";
                strRunningThrow = 3;
            }
            if (value >= 0 && value < 3) {
                strLiftText = "25kg";
                strRunningThrow = 4;
            }
            if (value >= 3 && value < 5) {
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

    async applyEncumbrancePenalty() {
        // Encumbrance (requires permissions to mess with ActiveEffects)
        if (game.user.isGM) {
            const { strLiftKg } = this.strDetails();
            let encumbrance = 0;
            const itemsWithWeight = this.items.filter((o) => o.system.WEIGHT && o.system.active);
            for (const item of itemsWithWeight) {
                encumbrance += parseFloat(item.system.WEIGHT);
            }

            // encumbrancePercentage
            const equipmentWeightPercentage =
                parseInt(game.settings.get(game.system.id, "equipmentWeightPercentage")) / 100.0;
            encumbrance *= equipmentWeightPercentage;

            // Is actor encumbered?
            let dcvDex = 0;
            let move = 0;
            if (encumbrance / strLiftKg >= 0.1) {
                dcvDex = -1;
            }
            if (encumbrance / strLiftKg >= 0.25) {
                dcvDex = -2;
                move = -2;
            }
            if (encumbrance / strLiftKg >= 0.5) {
                dcvDex = -3;
                move = -4;
            }
            if (encumbrance / strLiftKg >= 0.75) {
                dcvDex = -4;
                move = -8;
            }
            if (encumbrance / strLiftKg >= 0.9) {
                dcvDex = -5;
                move = -16;
            }

            const name = `Encumbered ${Math.floor((encumbrance / strLiftKg) * 100)}%`;
            let prevActiveEffect = this.effects.find((o) => o.flags?.encumbrance);
            if (dcvDex < 0 && prevActiveEffect?.flags?.dcvDex != dcvDex) {
                let activeEffect = {
                    name: name,
                    id: "encumbered",
                    icon: `systems/${HEROSYS.module}/icons/encumbered.svg`,
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
                    duration: {
                        seconds: 3.154e7 * 100, // 100 years should be close to infinity
                    },
                    flags: {
                        dcvDex: dcvDex,
                        // temporary: true,
                        encumbrance: true,
                    },
                };

                if (prevActiveEffect) {
                    await prevActiveEffect.delete();
                    prevActiveEffect = null;
                }

                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }

            if (dcvDex === 0 && prevActiveEffect) {
                await prevActiveEffect.delete();
            } else if (prevActiveEffect && prevActiveEffect.name != name) {
                await prevActiveEffect.update({ name: name });
            }
        }
    }

    async FullHealth() {
        // Remove all status effects
        for (let status of this.statuses) {
            let ae = Array.from(this.effects).find((effect) => effect.statuses.has(status));
            await ae.delete();
        }

        // Remove temporary effects
        const tempEffects = Array.from(this.effects).filter((effect) => parseInt(effect.duration?.seconds || 0) > 0);
        for (const ae of tempEffects) {
            await ae.delete();
        }

        // Set Characteristics VALUE to MAX
        const characteristicChanges = {};
        for (const char of Object.keys(this.system.characteristics)) {
            const value = parseInt(this.system.characteristics[char].value);
            const max = parseInt(this.system.characteristics[char].max);
            if (value != max) {
                characteristicChanges[`system.characteristics.${char}.value`] = max;
            }
        }
        if (Object.keys(characteristicChanges).length > 0) {
            await this.update(characteristicChanges);
        }

        // Reset all items
        for (const item of this.items) {
            await item.resetToOriginal();
        }

        // We just cleared encumbrance, check if it applies again
        this.applyEncumbrancePenalty();
    }

    // Raw base is insufficient for 5e characters
    getCharacteristicBase(key) {
        let powerInfo = getPowerInfo({ xmlid: key.toUpperCase(), actor: this });

        let base = parseInt(powerInfo?.base) || 0;

        if (!this.system.is5e) return base;

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
                parseInt(this.system[characteristicUpperCase]?.LEVELS) +
                (parseInt(
                    getPowerInfo({
                        xmlid: characteristicUpperCase,
                        actor: this,
                    })?.base,
                ) || 0)
            );
        };

        switch (key.toLowerCase()) {
            // Physical Defense (PD) STR/5
            case "pd":
                return base + Math.round((charBase("STR") + _str) / 5);

            // Energy Defense (ED) CON/5
            case "ed":
                return base + Math.round((charBase("CON") + _con) / 5);

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
            let cost = Math.round(levels * (powerInfo.costPerLevel || 0));

            // 5e hack for fractional speed
            if (key === "spd" && cost < 0) {
                cost = Math.ceil(cost / 10);
            }

            if (characteristic.realCost != cost) {
                changes[`system.characteristics.${key}.realCost`] = cost;
                this.system.characteristics[key].realCost = cost;
            }
            if (characteristic.core != core) {
                changes[`system.characteristics.${key}.core`] = core;
                this.system.characteristics[key].core = core;
            }
            // changes[`system.characteristics.${key}.basePointsPlusAdders`] = cost
            // changes[`system.characteristics.${key}.realCost`] = cost
            // changes[`system.characteristics.${key}.activePoints`] = cost
        }
        if (Object.keys(changes).length > 0 && this.id) {
            await this.update(changes);
        }
        return;
    }

    getActiveConstantItems() {
        let results = [];
        for (let item of this.items.filter((o) => o.system.active)) {
            let duration = getPowerInfo({
                xmlid: item.system.XMLID,
                actor: this,
            })?.duration;
            if (duration === "constant") {
                results.push(item);
            } else {
                const NONPERSISTENT = (item.system.modifiers || []).find((o) => o.XMLID === "NONPERSISTENT");
                if (NONPERSISTENT) {
                    results.push(item);
                }
            }
        }
        return results;
    }

    getConstantEffects() {
        return Array.from(this.allApplicableEffects())
            .filter(
                (o) =>
                    !o.duration.duration &&
                    o.statuses.size === 0 &&
                    (!o.flags?.XMLID ||
                        getPowerInfo({
                            xmlid: o.flags?.XMLID,
                            actor: this,
                        })?.duration != "persistent"),
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getPersistentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter(
                (o) =>
                    !o.duration.duration &&
                    o.statuses.size === 0 &&
                    o.flags?.XMLID &&
                    getPowerInfo({ xmlid: o.flags?.XMLID, actor: this })?.duration === "persistent",
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async uploadFromXml(xml) {
        const uploadPerformance = {
            startTime: new Date(),
            _d: new Date(),
        };

        // Convert xml string to xml document (if necessary)
        if (typeof xml === "string") {
            const parser = new DOMParser();
            xml = parser.parseFromString(xml.trim(), "text/xml");
        }

        // Ask if certain values should be retained across the upload
        const retainValuesOnUpload = {
            body: parseInt(this.system.characteristics?.body?.max) - parseInt(this.system.characteristics?.body?.value),
            stun: parseInt(this.system.characteristics?.stun?.max) - parseInt(this.system.characteristics?.stun?.value),
            end: parseInt(this.system.characteristics?.end?.max) - parseInt(this.system.characteristics?.end?.value),
            hap: this.system.hap?.value,
        };
        if (retainValuesOnUpload.body || retainValuesOnUpload.stun || retainValuesOnUpload.end) {
            let content = `${this.name} has:<ul>`;
            if (retainValuesOnUpload.body) content += `<li>${retainValuesOnUpload.body} BODY damage</li>`;
            if (retainValuesOnUpload.stun) content += `<li>${retainValuesOnUpload.stun} STUN damage</li>`;
            if (retainValuesOnUpload.end) content += `<li>${retainValuesOnUpload.end} END used</li>`;
            content += `</ul><p>Do you want to apply this damage after the upload?</p>`;
            const confirmed = await Dialog.confirm({
                title: "Retain damage after upload?",
                content: content,
            });
            if (confirmed === null) {
                return ui.notifications.warn(`${this.name} upload canceled.`);
            } else if (!confirmed) {
                retainValuesOnUpload.body = 0;
                retainValuesOnUpload.stun = 0;
                retainValuesOnUpload.end = 0;
            }
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
        promiseArray.push(this.deleteEmbeddedDocuments("Item", Array.from(this.items.keys())));

        let changes = {};

        // Convert XML into JSON
        const heroJson = {};
        HeroSystem6eActor._xmlToJsonNode(heroJson, xml.children);

        // Character name is what's in the sheet or, if missing, what is already in the actor sheet.
        const characterName = heroJson.CHARACTER.CHARACTER_INFO.CHARACTER_NAME || this.name;
        uploadPerformance.removeEffects = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();
        this.name = characterName;
        changes["name"] = this.name;

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /// Reset system properties to defaults
        const _actor = await HeroSystem6eActor.create(
            {
                name: "Test Actor",
                type: this.type,
            },
            { temporary: true },
        );
        const _system = _actor.system;

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
            for (let prop of Object.keys(this.flags)) {
                changes[`flags.-=${prop}`] = null;
            }

            promiseArray.push(this.update(changes));
        }

        // Wait for promiseArray to finish
        await Promise.all(promiseArray);
        uploadPerformance.resetToDefault = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();
        promiseArray = [];
        changes = {};

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /// WE ARE DONE RESETTING TOKEN PROPS
        /// NOW LOAD THE HDC STUFF

        // Heroic Action Points (always keep the value)
        changes["system.hap.value"] = retainValuesOnUpload.hap;

        // A few critical items.
        this.system.CHARACTER = heroJson.CHARACTER;
        this.system.versionHeroSystem6eUpload = game.system.version;

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
            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                !this.system.CHARACTER.TEMPLATE.includes("6E.") &&
                !this.system.is5e
            ) {
                this.system.is5e = true;
            }
            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                this.system.CHARACTER.TEMPLATE.includes("6E.") &&
                this.system.is5e
            ) {
                this.system.is5e = false;
            }
        }
        if (this.system.COM && !this.system.is5e) {
            this.system.is5e = true;
        }

        if (this.system.is5e && this.id) {
            // We can't delay this with the changes array because any items based on this actor needs this value.
            // Speifically compound power is a problem if we don't set is5e properly for a 5e actor.
            // changes[`system.is5e`] = this.system.is5e;
            await this.update({ "system.is5e": this.system.is5e });
        }

        // Quench test may need CHARACTERISTICS, which are set in postUpload
        await this._postUpload({ render: false });

        const xmlItemsToProcess =
            1 + // we process heroJson.CHARACTER.CHARACTERISTICS all at once so just track as 1 item.
            heroJson.CHARACTER.DISADVANTAGES.length +
            heroJson.CHARACTER.EQUIPMENT.length +
            heroJson.CHARACTER.MARTIALARTS.length +
            heroJson.CHARACTER.PERKS.length +
            heroJson.CHARACTER.POWERS.length +
            heroJson.CHARACTER.SKILLS.length +
            heroJson.CHARACTER.TALENTS.length +
            (this.type === "pc" || this.type === "npc" ? 1 : 0) +
            1 + // Validating adjustment and powers
            1 + // Images
            1 + // Final save
            1; // Restore retained damage
        const uploadProgressBar = new HeroProgressBar(`${this.name}: Processing HDC file`, xmlItemsToProcess, 1);

        promiseArray.push(this.#addFreeStuff(uploadProgressBar));

        uploadPerformance.progressBarFreeStuff = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // ITEMS
        let itemPromiseArray = [];
        const itemsToCreate = [];
        for (const itemTag of HeroSystem6eItem.ItemXmlTags) {
            if (heroJson.CHARACTER[itemTag]) {
                for (const system of heroJson.CHARACTER[itemTag]) {
                    const itemData = {
                        name: system.NAME || system?.ALIAS || system?.XMLID || itemTag,
                        type: itemTag.toLowerCase().replace(/s$/, ""),
                        system: system,
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
                    if (system.XMLID === "MULTIPLEATTACK") {
                        console.log("RWC MULTIPLEATTACK");
                    }
                    // Indicate we're processing this aspect of the HDC. If it crashes it should remain showing this progress note.
                    //uploadProgressBar.advance(`${this.name}: Adding ${itemTag} ${itemData.name}`);

                    if (this.id) {
                        itemsToCreate.push(itemData);

                        // COMPOUNDPOWER is similar to a MULTIPOWER.
                        // MULTIPOWER uses PARENTID references.
                        // COMPOUNDPOWER is structured as children.  Which we add PARENTID to, so it looks like a MULTIPOWER.
                        if (system.XMLID === "COMPOUNDPOWER") {
                            const compoundItems = [];
                            for (const value of Object.values(system)) {
                                // We only care about arrays and objects (array of 1)
                                if (typeof value === "object") {
                                    const values = value.length ? value : [value];
                                    for (const system2 of values) {
                                        if (system2.XMLID) {
                                            const power = getPowerInfo({
                                                xmlid: system2.XMLID,
                                                actor: this,
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
                                }
                            }
                            compoundItems.sort((a, b) => parseInt(a.POSITION) - parseInt(b.POSITION));
                            for (const system2 of compoundItems) {
                                const power = getPowerInfo({
                                    xmlid: system2.XMLID,
                                    actor: this,
                                });
                                let itemData2 = {
                                    name: system2.NAME || system2.ALIAS || system2.XMLID,
                                    type: power.type.includes("skill") ? "skill" : "power",
                                    system: {
                                        ...system2,
                                        PARENTID: system.ID,
                                        POSITION: parseInt(system2.POSITION),
                                    },
                                };
                                //const item2 = await HeroSystem6eItem.create(itemData2, { parent: this });
                                itemsToCreate.push(itemData2);
                                // try {
                                //     //await item2._postUpload();
                                // } catch (e) {
                                //     console.error(e);
                                //     await ui.notifications.error(
                                //         `${this.name}/${itemData.name}/${item2.name}/${item2.system.XMLID} failed to parse. It will not be available to this actor.  Please report.`,
                                //         {
                                //             console: true,
                                //             permanent: true,
                                //         },
                                //     );
                                //     console.error(e);
                                //     //await item2.delete();
                                //     continue;
                                // }
                            }
                        }
                    } else {
                        const item = await HeroSystem6eItem.create(itemData, {
                            temporary: true,
                            parent: this,
                        });
                        this.items.set(item.system.XMLID + item.system.POSITION, item);
                        if (item.system.XMLID === "MULTIPLEATTACK") {
                            console.log("RWC MULTIPLEATTACK");
                        }
                        if (system.XMLID === "COMPOUNDPOWER") {
                            const compoundItems = [];
                            for (const value of Object.values(system)) {
                                // We only care about arrays and objects (array of 1)
                                if (typeof value === "object") {
                                    const values = value.length ? value : [value];
                                    for (const system2 of values) {
                                        if (system2.XMLID) {
                                            const power = getPowerInfo({
                                                xmlid: system2.XMLID,
                                                actor: this,
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
                                }
                            }

                            compoundItems.sort((a, b) => parseInt(a.POSITION) - parseInt(b.POSITION));
                            for (const system2 of compoundItems) {
                                const power = getPowerInfo({
                                    xmlid: system2.XMLID,
                                    actor: this,
                                });
                                const itemData2 = {
                                    name: system2.NAME || system2.ALIAS || system2.XMLID,
                                    type: power.type.includes("skill") ? "skill" : "power",
                                    system: {
                                        ...system2,
                                        PARENTID: system.ID,
                                        POSITION: parseInt(system2.POSITION),
                                    },
                                };
                                const item = await HeroSystem6eItem.create(itemData2, {
                                    temporary: true,
                                    parent: this,
                                });
                                this.items.set(item.system.XMLID + item.system.POSITION, item);
                            }
                        }
                    }

                    uploadPerformance.items ??= [];
                    uploadPerformance.items.push({ name: itemData.name, d: new Date() - uploadPerformance._d });
                    uploadPerformance._d = new Date();
                }
                delete heroJson.CHARACTER[itemTag];
            }
        }
        uploadPerformance.preItems = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();
        await this.createEmbeddedDocuments("Item", itemsToCreate);
        uploadPerformance.createItems = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        await Promise.all(itemPromiseArray);
        uploadPerformance.itemPromiseArray = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // Do CSL's last so we can property select the attacks
        await Promise.all(
            this.items
                .filter((o) => !["COMBAT_LEVELS", "MENTAL_COMBAT_LEVELS"].includes(o.system.XMLID))
                .map((i) => i._postUpload({ render: false, uploadProgressBar })),
        );
        await Promise.all(
            this.items
                .filter((o) => ["COMBAT_LEVELS", "MENTAL_COMBAT_LEVELS"].includes(o.system.XMLID))
                .map((i) => i._postUpload({ render: false, uploadProgressBar })),
        );
        uploadPerformance.postUpload = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        uploadProgressBar.advance(`${this.name}: Validating powers`);

        // Validate everything that's been imported
        this.items.forEach(async (item) => {
            const power = item.baseInfo;

            // Power needs to exist
            if (!power) {
                await ui.notifications.error(
                    `${this.name}/${item.name} has unknown power XMLID: ${item.system.XMLID}. Please report.`,
                    { console: true, permanent: true },
                );
            } else if (!power.behaviors) {
                await ui.notifications.error(
                    `${this.name}/${item.name}/${item.system.XMLID} does not have behaviors defined. Please report.`,
                    { console: true, permanent: true },
                );
            }
        });

        uploadPerformance.validate = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

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

        uploadPerformance.invalidTargets = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        uploadProgressBar.advance(`${this.name}: Uploading image`);

        // Images
        if (this.img.startsWith("tokenizer/") && game.modules.get("vtta-tokenizer")?.active) {
            await ui.notifications.warn(
                `Skipping image upload, because this token (${this.name}) appears to be using tokenizer.`,
            );
        } else if (heroJson.CHARACTER.IMAGE) {
            const filename = heroJson.CHARACTER.IMAGE?.FileName;
            const path = "worlds/" + game.world.id + "/tokens";
            const relativePathName = path + "/" + filename;

            // Create a directory if it doesn't already exist
            try {
                await FilePicker.createDirectory("user", path);
            } catch (error) {
                console.log("create directory error", error);
            }

            // Set the image, uploading if not already in the file system
            try {
                const imageFileExists = (await FilePicker.browse("user", path)).files.includes(
                    encodeURI(relativePathName),
                );
                if (!imageFileExists) {
                    const extension = filename.split(".").pop();
                    const base64 =
                        "data:image/" + extension + ";base64," + xml.getElementsByTagName("IMAGE")[0].textContent;

                    await ImageHelper.uploadBase64(base64, filename, path);

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
                ui.notifications.warn(`${this.name} failed to upload ${filename}.`);
            }

            delete heroJson.CHARACTER.IMAGE;
        } else {
            // No image provided. Make sure we're using the default token.
            // Note we are overwriting any image that may have been there previously.
            // If they really want the image to stay, they should put it in the HDC file.
            changes["img"] = CONST.DEFAULT_TOKEN;
        }
        uploadPerformance.image = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        uploadProgressBar.advance(`${this.name}: Saving core changes`);

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
        uploadPerformance.nonItems = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // Set base values to HDC LEVELs and calculate costs of things.
        await this._postUpload({ render: false });
        uploadPerformance.actorPostUpload = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // Re-run _postUpload for CSL's or items that showAttacks so we can guess associated attacks (now that all attacks are loaded)
        this.items
            .filter((item) => item.system.csl || item.baseInfo?.editOptions?.showAttacks)
            .forEach(async (item) => {
                await item._postUpload({ render: false });
            });

        // Re-run _postUpload for SKILLS
        this.items
            .filter((item) => item.type === "skill")
            .forEach(async (item) => {
                await item._postUpload({ render: false });
            });

        uploadProgressBar.advance(`${this.name}: Restoring retained damage`);
        uploadPerformance.postUpload2 = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // Apply retained damage
        if (retainValuesOnUpload.body || retainValuesOnUpload.stun || retainValuesOnUpload.end) {
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
        uploadPerformance.retainedDamage = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // If we have control of this token, reaquire to update movement types
        const myToken = this.getActiveTokens()?.[0];
        if (canvas.tokens.controlled.find((t) => t.id == myToken?.id)) {
            myToken.release();
            myToken.control();
        }
        uploadPerformance.tokenControl = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        uploadProgressBar.close(`Done uploading ${this.name}`);

        uploadPerformance.totalTime = new Date() - uploadPerformance.startTime;

        console.log("Upload Performance", uploadPerformance);
    }

    async #addFreeStuff(uploadProgressBar) {
        // Characters get a few things for free that are not in the HDC.
        if (this.type === "pc" || this.type === "npc") {
            uploadProgressBar.advance(`${this.name}: Adding non HDC items for PCs and NPCs`, 0);

            // Perception Skill
            const itemDataPerception = {
                name: "Perception",
                type: "skill",
                system: {
                    XMLID: "PERCEPTION",
                    ALIAS: "Perception",
                    CHARACTERISTIC: "INT",
                    state: "trained",
                    levels: "0",
                },
            };
            const perceptionItem = await HeroSystem6eItem.create(itemDataPerception, {
                temporary: this.id ? false : true,
                parent: this,
            });
            if (!this.id) {
                this.items.set(perceptionItem.system.XMLID, perceptionItem);
            }
            await perceptionItem._postUpload();

            // MANEUVERS
            const powerList = this.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

            powerList
                .filter((power) => power.type.includes("maneuver"))
                .forEach(async (maneuver) => {
                    const name = maneuver.name;
                    const XMLID = maneuver.key;

                    const maneuverDetails = maneuver.maneuverDesc;
                    const PHASE = maneuverDetails.phase;
                    const OCV = maneuverDetails.ocv;
                    const DCV = maneuverDetails.dcv;
                    const EFFECT = maneuverDetails.effects;

                    const itemData = {
                        name,
                        type: "maneuver",
                        system: {
                            PHASE,
                            OCV,
                            DCV,
                            EFFECT,
                            active: false, // TODO: This is probably not always true. It should, however, be generated in other means.
                            description: EFFECT,
                            XMLID,
                            // MARTIALARTS consises of a list of MANEUVERS, the MARTIALARTS MANEUVERS have more props than our basic ones.
                            // Adding in some of those props as we may enhance/rework the basic maneuvers in the future.
                            //  <MANEUVER XMLID="MANEUVER" ID="1705867725258" BASECOST="4.0" LEVELS="0" ALIAS="Block" POSITION="1"
                            //  MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes"
                            //  INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Block" OCV="+2"
                            //  DCV="+2" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0"
                            //  MAXSTR="0" STRMULT="1" USEWEAPON="Yes" WEAPONEFFECT="Block, Abort">
                            DISPLAY: name, // Not sure we should allow editing of basic maneuvers
                        },
                    };

                    if (!itemData.name) {
                        console.error("Missing name", itemData);
                        return;
                    }

                    // Skip if temporary actor (Quench)
                    if (this.id) {
                        const item = await HeroSystem6eItem.create(itemData, {
                            parent: this,
                        });
                        if (maneuverDetails.attack) {
                            await item.makeAttack();
                        }
                        await item._postUpload();
                    }
                    if (maneuver.key === "MULTIPLEATTACK") {
                        console.log("RWC MULTIPLEATTACK");
                    }
                });
        }
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
            }

            if (child.children.length > 0) {
                this._xmlToJsonNode(jsonChild, child.children);
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
        if (typeof this.system.CHARACTER?.TEMPLATE == "string") {
            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                !this.system.CHARACTER.TEMPLATE.includes("6E.") &&
                !this.system.is5e
            ) {
                changes[`system.is5e`] = true;
                this.system.is5e = true;
            }
            if (
                this.system.CHARACTER.TEMPLATE.includes("builtIn.") &&
                this.system.CHARACTER.TEMPLATE.includes("6E.") &&
                this.system.is5e === undefined
            ) {
                changes[`system.is5e`] = false;
                this.system.is5e = false;
            }
        }
        if (this.system.COM && !this.system.is5e) {
            changes[`system.is5e`] = true;
            this.system.is5e = true;
        }

        if (this.system.is5e && this.id) {
            await this.update({ [`system.is5e`]: this.system.is5e });
        }

        // isHeroic
        // Need to be a careful as there are custom templates ('Nekhbet Vulture Child Goddess')
        // that we are unlikely able to decode heroic status.
        // Stringify the TEMPLATE for our best chance.
        let isHeroic = undefined;
        try {
            if (JSON.stringify(this.system.CHARACTER?.TEMPLATE)?.match(/\.Heroic/i)) {
                isHeroic = true;
            } else if (JSON.stringify(this.system.CHARACTER?.TEMPLATE)?.match(/\.Superheroic/i)) {
                isHeroic = false;
            }
            if (isHeroic != this.system.isHeroic) {
                changes[`system.isHeroic`] = isHeroic;
            }
            if (typeof isHeroic === "undefined") {
                // Custom Templates
                // Automations
                // Barrier
                if (this.id) {
                    console.warn(`Unable to determine isHeroic for ${this.name}.`, this.system.CHARACTER?.TEMPLATE);
                }
            }
        } catch (e) {
            console.error(e);
        }

        // Characteristics
        for (const key of Object.keys(this.system.characteristics)) {
            let newValue = parseInt(this.system?.[key.toUpperCase()]?.LEVELS || 0);
            newValue += this.getCharacteristicBase(key);
            if (this.system.is5e && key === "spd") {
                // SPD is always an integer, but in 5e due to figured characteristics, the base can be fractional.
                newValue = Math.floor(newValue);
            }

            if (this.system.characteristics[key].max != newValue) {
                if (this.id) {
                    //changes[`system.characteristics.${key.toLowerCase()}.max`] = Math.floor(newValue)
                    await this.update({
                        [`system.characteristics.${key.toLowerCase()}.max`]: Math.floor(newValue),
                    });
                } else {
                    this.system.characteristics[key.toLowerCase()].max = Math.floor(newValue);
                }

                changed = true;
            }
            if (
                this.system.characteristics[key].value != this.system.characteristics[key.toLowerCase()].max &&
                overrideValues
            ) {
                if (this.id) {
                    await this.update({
                        [`system.characteristics.${key.toLowerCase()}.value`]:
                            this.system.characteristics[key.toLowerCase()].max,
                    });
                    //changes[`system.characteristics.${key.toLowerCase()}.value`] = this.system.characteristics[key.toLowerCase()].max
                } else {
                    this.system.characteristics[key.toLowerCase()].value =
                        this.system.characteristics[key.toLowerCase()].max;
                }
                changed = true;
            }
            if (this.system.characteristics[key].core != newValue && overrideValues) {
                changes[`system.characteristics.${key.toLowerCase()}.core`] = newValue;
                this.system.characteristics[key.toLowerCase()].core = newValue;
                changed = true;
            }

            // Rollable Characteristics
            const rollableChanges = this.updateRollable(key.toLowerCase());
            if (rollableChanges) {
                changed = true;

                // TODO: FIXME: Not quite right.
                foundry.utils.mergeObject(changes, rollableChanges);
            }
        }

        // Save changes
        if (changed && this.id) {
            await this.update(changes);
        }

        // Initiative Characteristic
        if (this.system.initiativeCharacteristic === undefined) {
            if (
                this.system.characteristics.ego.value > this.system.characteristics.dex.value &&
                this.system.characteristics.omcv.value >= this.system.characteristics.ocv.value
            ) {
                if (this.id) {
                    await this.update({
                        "system.initiativeCharacteristic": "ego",
                    });
                } else {
                    this.system.initiativeCharacteristic = "ego";
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

            for (const attack of this.items.filter(
                (o) => (o.type === "attack" || o.system.subType === "attack") && o.system.uses === _ocv,
            )) {
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

            // Make sure at least one attacked is checked
            // if (checkedCount === 0 && Object.keys(attacks).length > 0) {
            //     attacks[Object.keys(attacks)[0]] = true;
            // }

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
        });

        if (characteristic && charPowerEntry?.behaviors.includes("success")) {
            characteristic.roll = Math.round(9 + characteristic.value * 0.2);
            if (!this.system.is5e && characteristic.value < 0) {
                characteristic.roll = 9;
            }
            return {
                [`system.characteristics.${key}.roll`]: characteristic.roll,
            };
        }

        return undefined;
    }

    async CalcActorRealAndActivePoints() {
        // Calculate realCost & Active Points for bought as characteristics
        let realCost = 0;
        let activePoints = realCost;

        this.system.pointsDetail = {};
        this.system.activePointsDetail = {};

        const powers = getCharacteristicInfoArrayForActor(this);
        for (const powerInfo of powers) {
            realCost += parseInt(this.system.characteristics[powerInfo.key.toLowerCase()]?.realCost || 0);
            activePoints += parseInt(this.system.characteristics[powerInfo.key.toLowerCase()]?.activePoints || 0);
        }
        this.system.pointsDetail.characteristics = realCost;
        this.system.activePointsDetail.characteristics = realCost;

        // ActivePoints are the same a RealCosts for base CHARACTERISTICS
        activePoints = realCost;

        // Add in costs for items
        for (const item of this.items.filter(
            (o) => o.type != "attack" && o.type != "defense" && o.type != "movement",
        )) {
            const _realCost = parseInt(item.system?.realCost) || 0;
            const _activePoints = parseInt(item.system?.activePoints) || 0;

            if (_realCost != 0) {
                // Equipment is typically purchased with money, not character points
                if ((item.parentItem?.type || item.type) != "equipment") {
                    realCost += _realCost;
                }
                activePoints += _activePoints;
                this.system.pointsDetail[item.parentItem?.type || item.type] ??= 0;
                this.system.activePointsDetail[item.parentItem?.type || item.type] ??= 0;

                this.system.pointsDetail[item.parentItem?.type || item.type] += _realCost;
                this.system.activePointsDetail[item.parentItem?.type || item.type] += _activePoints;
            }
        }

        // DISAD_POINTS: realCost
        const DISAD_POINTS = parseInt(this.system.CHARACTER?.BASIC_CONFIGURATION?.DISAD_POINTS || 0);
        const _disadPoints = Math.min(DISAD_POINTS, this.system.pointsDetail?.disadvantage || 0);
        if (_disadPoints != 0) {
            this.system.pointsDetail.MatchingDisads = -_disadPoints;
            this.system.activePointsDetail.MatchingDisads = -_disadPoints;
            realCost -= _disadPoints;
            activePoints -= _disadPoints;
        }

        this.system.realCost = realCost;
        this.system.activePoints = activePoints;
        if (this.id) {
            await this.update(
                {
                    "system.points": realCost,
                    "system.activePoints": activePoints,
                    "system.pointsDetail": this.system.pointsDetail,
                    "system.activePointsDetail": this.system.activePointsDetail,
                },
                //{ render: false },
                { hideChatMessage: true },
            );
        } else {
            this.system.points = realCost;
            this.system.activePoints = activePoints;
        }
    }

    get is5e() {
        return this?.system.is5e;
    }
}
