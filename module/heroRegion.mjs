export class HeroSystem6eRegionDocument extends RegionDocument {
    static async applyBehaviorTokenAutomaticTargeting(regionUuid) {
        const region = await fromUuid(regionUuid);
        if (!region) {
            console.error(`Region not found: ${regionUuid}`);
            return;
        }

        // Keep any existing behaviors other than Token Automatic Targeting, which we will replace if it already exists.
        let behaviors = region.behaviors.toObject().filter((b) => b.name !== "Token Automatic Targeting");
        behaviors.push({
            name: "Token Automatic Targeting",
            type: "executeScript",
            system: {
                events: ["tokenEnter", "tokenExit"],
                source: `const token = event.data.token;
                    if (!token) {
                    console.error(\`Token Automatic Targeting: No token found, which should not happen.\`, event);
                    return;
                    }
                    if (game.user.id !== region.flags[game.system.id].userId) {
                    console.debug(
                        \`Token Automatic Targeting: setTarget skipped because game.user.id = \${game.user.id} is not the creator (\${region.flags[game.system.id].userId}) of the region.\`,
                        event,
                    );
                    return;
                    }
                    token.object.setTarget(!!region.tokens.find((t) => t.id === token.id), {
                    releaseOthers: false,
                    });
                `,
            },
        });

        // Update the region with the new behaviors array.
        // Careful as Foundry has issues with updating arrays.
        await region.update({
            behaviors: behaviors,
        });
    }

    /** @override */
    static async __createDocuments(data = [], context = {}) {
        const processedData = data.map((regionData) => {
            // 1. Intercept if this is an AoE purpose template
            const isAoE = foundry.utils.getProperty(regionData, `flags.${game.system.id}.purpose`) === "AoE";
            if (!isAoE) return regionData;

            // 2. Clone to safely mutate the initial creation payload
            const updates = foundry.utils.deepClone(regionData);

            // 3. Dynamically trace the level of the token that generated it
            const actorUuid = foundry.utils.getProperty(updates, `flags.${game.system.id}.actorUuid`);
            const castingToken = canvas.tokens.placeables.find((t) => t.actor?.uuid === actorUuid);

            if (castingToken && canvas.scene.levels) {
                const elevation = castingToken.document.elevation ?? 0;
                updates.levels =
                    canvas.scene.levels.find((l) => elevation >= l.bottom && elevation <= l.top)?.id ??
                    "defaultLevel0000";
            }

            // 4. Force inject the dot-notation wall restrictions cleanly on creation
            updates["restriction.enabled"] = true;
            updates["restriction.type"] = "sight";
            updates["restriction.priority"] = 0;

            return updates;
        });

        return super.createDocuments(processedData, context);
    }

    /** @override */
    async __onCreate(data, options, userId) {
        await super._onCreate(data, options, userId);
        if (game.user.id !== userId) return;

        // Only configure labels/behaviors for Hero 6e AoE templates
        if (this.getFlag(game.system.id, "purpose") !== "AoE") return;

        // 1. Add the Automatic Targeting script behavior
        await this.createEmbeddedDocuments("RegionBehavior", [
            {
                name: "Token Automatic Targeting",
                type: "executeScript",
                system: {
                    events: ["tokenEnter", "tokenExit"],
                    source: `
          const token = event.data.token;
          if (!token?.object) return;
          const creatorId = region.getFlag("${game.system.id}", "userId");
          if (game.user.id !== creatorId) return;

          token.object.setTarget(!!region.tokens.find(t => t.id === token.id), { releaseOthers: false });
        `,
                },
            },
        ]);

        // 2. Create the companion Canvas Text Label Drawing node
        const primaryShape = this.shapes?.[0];
        if (primaryShape) {
            // Ensure this.name.split("-") extracts a pure string, not an array object
            const cleanItemNameText = this.name.split("-")[0] || this.name;

            const labelTextData = {
                // 1. SHAPE DATA IN V14: Drawings use lowercase "rectangle" or "ellipse"
                shape: {
                    type: "rectangle",
                    width: 250, // Bounding container box width
                    height: 60, // Bounding container box height
                },

                // Directly centers the 250x60 transparent border box over your region epicenter
                x: primaryShape.x - 125,
                y: primaryShape.y - 30,

                // 2. THE ABSOLUTE V14 SCHEMA FIX: All text properties are nested inside a root text object!
                text: {
                    string: cleanItemNameText, // The actual text string goes here
                    fontFamily: "Signika",
                    fontSize: 24,
                    fill: game.user.color || "#ffffff", // Standard string hex identifier
                    stroke: "#000000",
                    strokeThickness: 3,
                    alpha: 1.0, // FORCES the Joint Validator to recognize visible font pixels!
                },

                // 3. BACKGROUND TRANSPARENCY: Keeps the bounding container 100% invisible
                fillType: 0, // 0 maps directly to CONST.DRAWING_FILL_TYPES.NONE
                fillAlpha: 0.0,

                strokeWidth: 0, // Turns off the outer bounding lines entirely
                strokeAlpha: 0.0,

                interface: true,
                locked: true,
                hidden: false,
            };

            const [labelNote] = await canvas.scene.createEmbeddedDocuments("Drawing", [labelTextData]);

            // Update our document flags to remember the drawing ID
            await this.update({ [`flags.${game.system.id}.linkedLabelId`]: labelNote.id });
        }
    }

    /** @override */
    async __onUpdate(changed, options, userId) {
        await super._onUpdate(changed, options, userId);

        // Smoothly synchronize the drawing note text position if the region moves
        if (changed.shapes) {
            const linkedLabelId = this.getFlag(game.system.id, "linkedLabelId");
            const primaryShape = this.shapes?.[0];

            if (linkedLabelId && primaryShape) {
                const textDrawingDoc = canvas.scene.getEmbeddedDocument("Drawing", linkedLabelId);
                if (textDrawingDoc) {
                    await textDrawingDoc.update({
                        x: primaryShape.x - 100,
                        y: primaryShape.y - 12,
                    });
                }
            }
        }
    }

    /** @override */
    async __onDelete(options, userId) {
        // Wipe the text drawing cleanly off the map when the template goes away
        const linkedLabelId = this.getFlag(game.system.id, "linkedLabelId");
        if (linkedLabelId && game.user.id === userId) {
            const existingLabel = canvas.scene.getEmbeddedDocument("Drawing", linkedLabelId);
            if (existingLabel) {
                await canvas.scene.deleteEmbeddedDocuments("Drawing", [linkedLabelId]);
            }
        }
        await super._onDelete(options, userId);
    }
}
