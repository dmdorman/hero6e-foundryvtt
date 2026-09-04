import { buildUploadErrorContext } from "../actor/actor-upload.mjs";
import { getActorsFromUnlinkedTokensInGame, getSideBarActorsInGame } from "../migration.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { Actor } = foundry.documents;

/**
 * GM tool: re-import every world actor and unlinked token from its stored HDC.
 * Failures and legacy actors without stored HDC data are flagged in the dialog.
 */
export class HdcResetMenu extends HandlebarsApplicationMixin(ApplicationV2) {
    static {
        Hooks.once("init", () => {
            HdcResetMenu.PARTS = {
                body: {
                    template: `systems/${game.system.id}/templates/configuration/hdc-reset-menu.hbs`,
                },
            };
        });
    }

    static DEFAULT_OPTIONS = {
        id: "hdc-reset-application",
        classes: ["herosystem6e"],
        position: {
            width: 520,
            height: "auto",
        },
        window: {
            title: "Reset Actors From HDC",
            contentClasses: ["standard-form"],
        },
        actions: {
            resetAll: HdcResetMenu.#onResetAll,
            copyResults: HdcResetMenu.#onCopyResults,
        },
    };

    #running = false;
    #results = null;

    static #collectTargets() {
        return [
            ...getSideBarActorsInGame().map((actor) => ({ actor, context: "world" })),
            ...getActorsFromUnlinkedTokensInGame().map((actor) => ({
                actor,
                context: `token on ${actor.token?.parent?.name}`,
            })),
        ];
    }

    async _prepareContext() {
        let worldActorCount = 0;
        let unlinkedTokenCount = 0;
        let legacyCount = 0;
        for (const { actor, context } of HdcResetMenu.#collectTargets()) {
            if (context === "world") worldActorCount++;
            else unlinkedTokenCount++;
            if (!actor.system._hdcXml) legacyCount++;
        }
        return {
            worldActorCount,
            unlinkedTokenCount,
            legacyCount,
            running: this.#running,
            results: this.#results,
        };
    }

    static async #onResetAll() {
        if (this.#running) return;
        this.#running = true;
        this.#results = null;
        this.render();

        const targets = HdcResetMenu.#collectTargets();
        const results = { reset: 0, failed: [], legacy: [] };
        const legacyWorldUpdates = [];
        const progressBar = new HeroProgressBar("Resetting actors from HDC", Math.max(1, targets.length));

        // Lock into the sheet's upload-error state until an HDC upload restores it
        const legacyLockChanges = {
            [`flags.${game.system.id}.uploading`]: true,
            [`flags.${game.system.id}.uploadingError`]:
                "No stored HDC data to reset from. Upload this actor's .hdc file to restore it.",
            [`flags.${game.system.id}.uploadingErrorContext`]: buildUploadErrorContext({ legacyNoHdc: true }),
        };

        try {
            for (const { actor, context } of targets) {
                progressBar.advance(`Resetting ${actor.name} (${context})`);

                if (!actor.system._hdcXml) {
                    results.legacy.push({ name: actor.name, context });
                    if (actor.token) {
                        await actor.update(legacyLockChanges);
                    } else {
                        legacyWorldUpdates.push({ _id: actor.id, ...legacyLockChanges });
                    }
                    continue;
                }

                try {
                    await actor.uploadFromXml(actor.system._hdcXml, {
                        keepExistingImage: true,
                        silent: true,
                        allowTokenActor: true,
                        skipExtraItemsPrompt: true,
                    });

                    // The upload traps its own errors; the persisted error flag is the outcome
                    const error = actor.getFlag(game.system.id, "uploadingError");
                    if (error) {
                        results.failed.push({ name: actor.name, context, error: error.split("\n")[0] });
                    } else {
                        results.reset++;
                    }
                } catch (e) {
                    console.error(e);
                    results.failed.push({ name: actor.name, context, error: e.message });
                }
            }

            if (legacyWorldUpdates.length > 0) {
                await Actor.updateDocuments(legacyWorldUpdates);
            }
        } finally {
            progressBar.close(`Reset ${results.reset} actors from HDC`);
            this.#running = false;
            this.#results = results;
            this.render();
        }

        console.log("HDC reset results", results);
    }

    static #onCopyResults() {
        const results = this.#results;
        if (!results) return;

        const lines = [`HDC Reset Results — ${new Date().toLocaleString()}`, `Reset: ${results.reset}`];
        if (results.failed.length > 0) {
            lines.push(``, `Failed (${results.failed.length}):`);
            for (const { name, context, error } of results.failed) {
                lines.push(`- ${name} (${context}): ${error}`);
            }
        }
        if (results.legacy.length > 0) {
            lines.push(``, `No stored HDC — locked until their .hdc file is uploaded (${results.legacy.length}):`);
            for (const { name, context } of results.legacy) {
                lines.push(`- ${name} (${context})`);
            }
        }

        game.clipboard.copyPlainText(lines.join("\n"));
        ui.notifications.info("HDC reset results copied to clipboard.");
    }
}
