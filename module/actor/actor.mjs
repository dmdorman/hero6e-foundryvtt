import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor-active-effects.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo, getCharacteristicInfoArrayForActor, whisperUserTargetsForActor } from "../utility/util.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";
import { clamp } from "../utility/compatibility.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";

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
                author: game.user.id,
                whisper: ChatMessage.getWhisperRecipients("GM"),
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
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content: content,
                speaker: speaker,
            };
            await ChatMessage.create(chatData);
        }
    }

    async _onUpdate(data, options, userId) {
        super._onUpdate(data, options, userId);

        // Only owners have permission to  perform updates
        if (!this.isOwner) {
            //console.log(`Skipping _onUpdate because this client is not an owner of ${this.name}`);
            return;
        }

        // If stun was changed and running under triggering users context
        if (data?.system?.characteristics?.stun && userId === game.user.id) {
            if (data.system.characteristics.stun.value <= 0) {
                this.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect);
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
                this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.knockedOutEffect);
            }
        }

        // If STR was change check encumbrance
        if (data?.system?.characteristics?.str && userId === game.user.id && options.render !== false) {
            await this.applyEncumbrancePenalty();
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
                    if (item.flags.preOIHID) {
                        await item.toggle(); // toggle on
                    }
                }
            } else {
                // Use flags to keep track which items were disabled so we will enable them when we go back into heroic ID
                for (const item of this.items.filter((item) => item.findModsByXmlid("OIHID"))) {
                    await item.update({ "flags.preOIHID": item.system.active });
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

        token = token || this.getActiveTokens()[0];
        const speaker = ChatMessage.getSpeaker({ actor: this, token });
        const tokenName = token?.name || this.name;
        speaker["alias"] = game.user.name; //game.token?.name || this.name;

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
                    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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
        let newEnd = parseInt(chars.end.value) + rec;

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
            content += `, gaining ${deltaEnd} endurance and ${deltaStun} stun.`;
        } else {
            content += ".";
        }

        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: content,
            speaker: speaker,
            whisper: [...ChatMessage.getWhisperRecipients(this.name), ...ChatMessage.getWhisperRecipients("GM")],
        };

        if (asAction) {
            await ChatMessage.create(chatData);

            // Remove stunned condition.
            // While not technically part of the rules, it is here as a convenience.
            // For example when Combat Tracker isn't being used.
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);
        }

        if (asAction && this.inCombat) {
            // While Recovering, a character is at ½ DCV
            const existingEffect = Array.from(this.temporaryEffects).find((o) => o.flags.takeRecovery);
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
                    flags: { takeRecovery: true },
                    duration: {
                        seconds: 1,
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
    canMove(uiNotice) {
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
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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

    // When stunned, knockedout, etc you cannot act
    canAct(uiNotice, event) {
        // Bases can always act (used for token attacher)
        if (this.type === "base2") return true;

        let result = true;
        let badStatus = [];

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
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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
        const prevActiveEffects = this.effects.filter((o) => o.flags?.encumbrance);

        // There should only be 1 encumbered effect, but with async loading we may have more
        // Use the first one, get rid of the rest
        for (let a = 1; a < prevActiveEffects.length; a++) {
            await prevActiveEffects[a].delete();
        }
        const prevActiveEffect = prevActiveEffects?.[0];
        if (dcvDex < 0 && prevActiveEffect?.flags?.dcvDex != dcvDex) {
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
                    dcvDex: dcvDex,
                    encumbrance: true,
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

        const prevStr0ActiveEffect = this.effects.find((effect) => effect.flags?.str0);
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
                    str0: true,
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
            await ae.delete();
        }

        // Remove temporary effects
        const tempEffects = Array.from(this.effects).filter((effect) => parseInt(effect.duration?.seconds || 0) > 0);
        for (const ae of tempEffects) {
            await ae.delete();
        }

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

        // We just cleared encumbrance, check if it applies again
        this.applyEncumbrancePenalty();
    }

    // Raw base is insufficient for 5e characters
    getCharacteristicBase(key) {
        const powerInfo = getPowerInfo({ xmlid: key.toUpperCase(), actor: this });
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
            .filter(
                (ae) =>
                    !ae.duration.duration &&
                    ae.statuses.size === 0 &&
                    (!ae.flags?.XMLID ||
                        getPowerInfo({
                            xmlid: ae.flags?.XMLID,
                            actor: this,
                        })?.duration !== "persistent"),
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getPersistentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter(
                (ae) =>
                    !ae.duration.duration &&
                    ae.statuses.size === 0 &&
                    ae.flags?.XMLID &&
                    getPowerInfo({ xmlid: ae.flags?.XMLID, actor: this })?.duration === "persistent",
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
        if (
            retainValuesOnUpload.body ||
            retainValuesOnUpload.stun ||
            retainValuesOnUpload.end ||
            retainValuesOnUpload.charges.length > 0
        ) {
            let content = `${this.name} has:<ul>`;
            if (retainValuesOnUpload.body) content += `<li>${retainValuesOnUpload.body} BODY damage</li>`;
            if (retainValuesOnUpload.stun) content += `<li>${retainValuesOnUpload.stun} STUN damage</li>`;
            if (retainValuesOnUpload.end) content += `<li>${retainValuesOnUpload.end} END used</li>`;
            for (const c of retainValuesOnUpload.charges) {
                content += `<li>Charges: ${c.NAME || c.ALIAS}</li>`;
            }
            content += `</ul><p>Do you want to apply resource usage after the upload?</p>`;
            const confirmed = await Dialog.confirm({
                title: "Retain resource usage after upload?",
                content: content,
            });
            if (confirmed === null) {
                return ui.notifications.warn(`${this.name} upload canceled.`);
            } else if (!confirmed) {
                retainValuesOnUpload.body = 0;
                retainValuesOnUpload.stun = 0;
                retainValuesOnUpload.end = 0;
                retainValuesOnUpload.charges = [];
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
        changes["flags"] = {
            uploading: true,
        };

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /// Reset system properties to defaults
        const _actor = new HeroSystem6eActor(
            {
                name: "Test Actor",
                type: this.type,
            },
            {},
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
                this.system.is5e !== true
            ) {
                this.system.is5e = false;
            }
        }
        if (this.system.COM && !this.system.is5e) {
            this.system.is5e = true;
        }

        if (this.id) {
            // We can't delay this with the changes array because any items based on this actor needs this value.
            // Specifically compound power is a problem if we don't set is5e properly for a 5e actor.
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
            (this.type === "pc" || this.type === "npc" ? 1 : 0) + // Free stuff
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
        let sortBase = 0;
        for (const itemTag of HeroSystem6eItem.ItemXmlTags) {
            sortBase += 1000;
            if (heroJson.CHARACTER[itemTag]) {
                for (const system of heroJson.CHARACTER[itemTag]) {
                    const itemData = {
                        name: system.NAME || system?.ALIAS || system?.XMLID || itemTag,
                        type: itemTag.toLowerCase().replace(/s$/, ""),
                        system: system,
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
                                        sort: itemData.sort + 100 + parseInt(system2.POSITION),
                                    },
                                };
                                itemsToCreate.push(itemData2);
                            }
                        }
                    } else {
                        const item = new HeroSystem6eItem(itemData, {
                            parent: this,
                        });
                        this.items.set(item.system.XMLID + item.system.POSITION, item);
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
                                const item = new HeroSystem6eItem(itemData2, {
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
        await this.createEmbeddedDocuments("Item", itemsToCreate, { render: false, renderSheet: false });
        uploadPerformance.createItems = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        await Promise.all(itemPromiseArray);
        uploadPerformance.itemPromiseArray = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // Do CSLs last so we can property select the attacks
        // TODO: infinite loop of _postUpload until no changes?
        // Do CHARACTERISTICS first (mostly for applyEncumbrance)

        await Promise.all(
            this.items
                .filter((o) => o.baseInfo?.type.includes("characteristic"))
                .map((i) => i._postUpload({ render: false, uploadProgressBar })),
        );
        await this._postUpload({ render: false });
        const doLastXmlids = ["COMBAT_LEVELS", "MENTAL_COMBAT_LEVELS", "MENTALDEFENSE"];
        await Promise.all(
            this.items
                .filter((o) => !doLastXmlids.includes(o.system.XMLID) && !o.baseInfo?.type.includes("characteristic"))
                .map((i) => i._postUpload({ render: false, uploadProgressBar, applyEncumbrance: false })),
        );
        // // Separate out equipment to avoid multiple encumbrance AE's
        // for (const equipment of this.items.filter((o) => o.type === "equipment")) {
        //     await equipment._postUpload({ render: false, applyEncumbrance: false });
        // }
        await Promise.all(
            this.items
                .filter((o) => doLastXmlids.includes(o.system.XMLID) && !o.baseInfo?.type.includes("characteristic"))
                .map((i) => i._postUpload({ render: false, uploadProgressBar })),
        );

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
                await ui.notifications.warn(`Unable to locate ${item.ALIAS} to consume charges after upload.`);
            }
        }
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

        // For some unknown reason SPD with AE not working during upload.
        // This kludge is a quick fix
        // https://github.com/dmdorman/hero6e-foundryvtt/issues/1439
        if (this.id) {
            await this.update({ "system.characteristics.spd.max": this.system.characteristics.spd.core });
            await this.update({ "system.characteristics.spd.value": this.system.characteristics.spd.max });
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

        if (this.id) {
            await this.update({ "flags.-=uploading": null });
        }
        uploadPerformance.retainedDamage = new Date() - uploadPerformance._d;
        uploadPerformance._d = new Date();

        // If we have control of this token, reacquire to update movement types
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
            await perceptionItem._postUpload({ applyEncumbrance: false });

            // MANEUVERS
            const powerList = this.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

            powerList
                .filter((power) => power.type?.includes("maneuver"))
                .forEach(async (maneuver) => {
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

                    if (maneuverDetails.attack) {
                        console.warn(`${item.name}/${item.system.XMLID} is being turned into an attack`);
                        await item.makeAttack();
                    }

                    // Work around if temporary actor
                    if (!this.id) {
                        this.items.set(item.system.XMLID, item);
                    }
                    await item._postUpload();
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
            if (isHeroic !== this.system.isHeroic) {
                changes["system.isHeroic"] = isHeroic;
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
            //if (key.toLowerCase() === "spd") debugger;

            let newValue = parseInt(this.system?.[key.toUpperCase()]?.LEVELS || 0); // uppercase?  LEVELS?  This probably hasn't worked in a long time!
            newValue += this.getCharacteristicBase(key) || 0; // 5e will have empty base for ocv/dcv and other figured characteristics
            if (this.system.is5e && key === "spd") {
                // SPD is always an integer, but in 5e due to figured characteristics, the base can be fractional.
                newValue = Math.floor(newValue);
            }

            if (this.system.characteristics[key].max !== newValue) {
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
                this.system.characteristics[key].value !== this.system.characteristics[key.toLowerCase()].max &&
                this.system.characteristics[key.toLowerCase()].max !== null &&
                overrideValues
            ) {
                if (this.id) {
                    await this.update(
                        {
                            [`system.characteristics.${key.toLowerCase()}.value`]:
                                this.system.characteristics[key.toLowerCase()].max,
                        },
                        { hideChatMessage: true },
                    );
                } else {
                    this.system.characteristics[key.toLowerCase()].value =
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
            let _realCost = parseInt(item.system?.realCost) || 0;
            const _activePoints = parseInt(item.system?.activePoints) || 0;

            if ((item.parentItem?.type || item.type) != "equipment") {
                if (item.system.XMLID === "COMPOUNDPOWER") {
                    // This compound power may be within a framework, so use that cost
                    _realCost = parseInt(item.compoundCost);
                }

                // Don't include costs from COMPOUNDPOWER children as we added them above
                if (item.parentItem?.system.XMLID === "COMPOUNDPOWER") {
                    _realCost = 0;
                }
            }

            if (_realCost != 0) {
                // Equipment is typically purchased with money, not character points
                if ((item.parentItem?.type || item.type) !== "equipment") {
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

    /**
     * Apply any transformations to the Actor data which are caused by ActiveEffects.
     */
    // *override
    applyActiveEffects(...args) {
        return super.applyActiveEffects(...args);
    }
}
