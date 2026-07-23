/**
 * System compatibility and database translation layer for Hero System 6e.
 * Adapts modern V14 paradigms to V13 environments safely.
 */
export class HeroCompatibility {
    /**
     * True if the host environment is running Foundry VTT V14 or later.
     * @type {boolean}
     */
    static get isV14() {
        // Falls back gracefully if game.release isn't ready during ultra-early initialization
        const generation = game.release?.generation ?? 13;
        if (generation > 14) {
            console.error(`Hero System 6e Compatibility Layer: Unrecognized Foundry generation ${generation}.`);
        }
        return generation === 14;
    }

    /**
     * Translates unlinked combatant initialization overrides to match generation-specific schemas.
     * Prevents database property sanitization rejections across V13 and V14 environments.
     *
     * @param {string} actorId - Root database actor record document target ID string
     * @param {number} dex - True rules priority characteristic integer score configuration
     * @param {number} spd - True speed chart phase capacity footprint integer value configuration
     * @returns {object} The version-compliant combatant initialization dictionary payload
     */
    static getCombatantCreationPayload(actorId, dex, spd) {
        const basePayload = {
            actorId: actorId,
            tokenId: null,
            hidden: false,
        };

        if (this.isV14) {
            // ✅ V14 CANONICAL SCHEMA: Maps under system configurations map paths natively
            basePayload["actorData.system.characteristics.dex.value"] = dex;
            basePayload["actorData.system.characteristics.dex.max"] = dex;
            basePayload["actorData.system.characteristics.spd.value"] = spd;
            basePayload["actorData.system.characteristics.spd.max"] = spd;

            basePayload.actorData = {
                system: {
                    characteristics: {
                        dex: { value: dex, max: dex },
                        spd: { value: spd, max: spd },
                    },
                },
            };
        } else {
            // ✅ V13 LEGACY SCHEMATICS DEEP CORRECTION:
            // Maps characteristics values directly under the old legacy '.data' directory maps structure path segments,
            // completely flat-assigning them to safeguard properties from database sanitization rejections.
            basePayload["actorData.data.characteristics.dex.value"] = dex;
            basePayload["actorData.data.characteristics.dex.max"] = dex;
            basePayload["actorData.data.characteristics.spd.value"] = spd;
            basePayload["actorData.data.characteristics.spd.max"] = spd;

            // Duplicate flattened string paths under the old system structures to satisfy strict underlying data model validations
            basePayload["actorData.data.characteristics.dex"] = { value: dex, max: dex };
            basePayload["actorData.data.characteristics.spd"] = { value: spd, max: spd };

            basePayload.actorData = {
                data: {
                    characteristics: {
                        dex: { value: dex, max: dex },
                        spd: { value: spd, max: spd },
                    },
                },
            };
        }

        return basePayload;
    }

    /**
     * Safely updates an array of embedded documents inside a parent document.
     * Enforces V14 array assignment, falling back to flattened path keys in V13.
     *
     * @param {Document} parentDoc - The parent document (e.g., a Combat or Actor instance).
     * @param {string} embeddedKey - The key of the embedded collection (e.g., "combatants", "effects").
     * @param {Array<object>} embeddedUpdates - Array of update objects, each containing a mandatory `_id`.
     * @param {object} [topLevelUpdates={}] - Additional top-level document adjustments (e.g., flag updates).
     * @returns {Promise<Document>} The updated parent document.
     */
    static async updateEmbedded(parentDoc, embeddedKey, embeddedUpdates, topLevelUpdates = {}, options = {}) {
        if (!parentDoc || typeof parentDoc.update !== "function") {
            throw new Error(`Invalid parent document provided for embedded mutation.`);
        }

        if (this.isV14) {
            // Rule: Strict adherence to V14 canonical collection array format
            const mergedV14Payload = {
                ...topLevelUpdates,
                [embeddedKey]: embeddedUpdates,
            };
            return parentDoc.update(mergedV14Payload, options);
        }

        // V13 fallback: object-keyed embedded paths inside a parent update are silently
        // DROPPED during field casting (ArrayField._cast discards non-integer keys), so
        // the embedded collection and the parent document update separately. The parent
        // update carries the turn-flow options.
        const documentName = { combatants: "Combatant", effects: "ActiveEffect" }[embeddedKey] ?? embeddedKey;
        if (Array.isArray(embeddedUpdates) && embeddedUpdates.length > 0) {
            await parentDoc.updateEmbeddedDocuments(documentName, embeddedUpdates);
        }
        if (Object.keys(topLevelUpdates).length > 0) {
            return parentDoc.update(topLevelUpdates, options);
        }
        return parentDoc;
    }

    /**
     * Version-agnostic wrapper for refreshing active effect expiry lifecycles.
     * Avoids fake custom timers or hallucinated core hooks.
     *
     * @param {ActiveEffect} effect - Target ActiveEffect instance.
     */
    static refreshActiveEffect(effect) {
        if (!effect) return;

        if (this.isV14) {
            // Native V14 core architecture handler
            if (ActiveEffect.expiry?.refresh) {
                ActiveEffect.expiry.refresh();
            }
        } else {
            // V13 Fallback evaluation: Explicitly delete expired documents
            const remaining = effect.duration?.remaining;
            if (remaining === 0) {
                // Scoped standard CRUD execution
                effect.delete();
            }
        }
    }

    /**
     * Builds a document update payload that forces a full replacement of the given fields
     * instead of Foundry's default recursive merge.
     *
     * V14 removed the "==field" prefix syntax in favor of foundry.data.operators.ForcedReplacement,
     * while V13 and earlier only understand the "==field" prefix.
     *
     * @param {object} forcedFields - Map of field name (unprefixed) to value to force-replace.
     * @param {object} [otherFields={}] - Additional fields merged with normal recursive-merge behavior.
     * @returns {object} A version-appropriate update payload.
     */
    static forceReplace(forcedFields, otherFields = {}) {
        const payload = { ...otherFields };

        if (this.isV14) {
            for (const [key, value] of Object.entries(forcedFields)) {
                payload[key] = foundry.data.operators.ForcedReplacement.create(value);
            }
        } else {
            for (const [key, value] of Object.entries(forcedFields)) {
                payload[`==${key}`] = value;
            }
        }

        return payload;
    }

    /**
     * Builds a document update payload that forces the deletion of the given fields,
     * resetting each back to undefined.
     *
     * V14 removed the "-=field" prefix syntax in favor of foundry.data.operators.ForcedDeletion,
     * while V13 and earlier only understand the "-=field" prefix.
     *
     * @param {string[]} forcedKeys - Field names (unprefixed) to delete.
     * @param {object} [otherFields={}] - Additional fields merged with normal recursive-merge behavior.
     * @returns {object} A version-appropriate update payload.
     */
    static forceDelete(forcedKeys, otherFields = {}) {
        const payload = { ...otherFields };

        if (this.isV14) {
            for (const key of forcedKeys) {
                payload[key] = foundry.data.operators.ForcedDeletion.create();
            }
        } else {
            for (const key of forcedKeys) {
                payload[`-=${key}`] = null;
            }
        }

        return payload;
    }

    /**
     * FoundryVTT overloads Math to add the clamped or clamp method depending on the version.
     * Just provide a straight implementation.
     *
     * If max < min then min = max
     *
     * @param {number} num - The number to clamp
     * @param {number} min - The lower bound to clamp num to
     * @param {number} max - The upper bound to clamp num to
     *
     * @returns number
     */
    static clamp(num, min, max) {
        if (max < min) {
            max = min;
        }

        return Math.min(Math.max(num, min), max);
    }
}
