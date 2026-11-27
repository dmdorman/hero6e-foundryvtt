import { createQuenchActor, deleteQuenchActor, setQuenchTimeout, waitUntil } from "./quench-helper.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";

/**
 * Owns the contract between a hotbar item drop and the Macro command it writes.
 *
 * The seam is the `hotbarDrop` hook herosystem6e.mjs registers. `handleMacroCreation`, its command
 * template, and `rollItemMacro` all stay module-local, so the hook is the only reachable entry point.
 * Nothing about these tests touches an actor sheet, a folder, or a compendium, so they do not belong
 * beside the drop tests that do.
 */
export function registerHotbarMacroTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.hotbarMacros`,
        (context) => {
            const { after, before, describe, expect, it } = context;

            describe("Hotbar Macros", function () {
                // Mocha's 2000ms default is too short: one drop waits up to 3000ms for its Macro.
                setQuenchTimeout(this, 20000);

                describe("Command written for a dropped item", function () {
                    let actor;
                    const createdMacroIds = [];

                    // One drop writes its Macro well inside 200 ms. 3000 ms absorbs a busy world
                    // without hiding a regression behind a long wait.
                    const MACRO_WAIT_MS = 3000;
                    const MACRO_POLL_MS = 10;
                    // Slot 40 sits past the two bars a GM uses in this world, so a run cannot
                    // overwrite a real hotbar the operator cares about.
                    const HOTBAR_SLOT = 40;
                    // The injection fixture below names this global. A test sets it to 0 first, so a
                    // non-zero read proves the command ran a statement the system did not write.
                    const INJECTION_PROBE = "_quenchHotbarInjectionProbe";

                    // HDC is the supported way to name a power, so the fixture builds a POWER element
                    // and escapes the name into its ALIAS attribute. ENERGYBLAST carries the to-hit
                    // behavior, which is what `isRollable()` reports and what the drop handler needs.
                    const POWER_XML =
                        '<POWER XMLID="ENERGYBLAST" ID="__ID__" BASECOST="0.0" LEVELS="1" ALIAS="__ALIAS__" ' +
                        'POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" ' +
                        'SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" ' +
                        'USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></POWER>';

                    let xmlIdSeed = 1720000000000;

                    /**
                     * Make `value` safe to place inside a double-quoted XML attribute.
                     * @param {string} value Raw name.
                     * @returns {string} Escaped name.
                     */
                    function escapeXmlAttribute(value) {
                        return value.split("&").join("&amp;").split('"').join("&quot;");
                    }

                    /**
                     * Create one rollable power whose display name is exactly `name`.
                     *
                     * The three guards here separate a broken fixture from a real defect, so a red
                     * run points at the command and not at the setup.
                     * @param {string} name Display name the item must carry.
                     * @returns {Promise<object>} The created item.
                     */
                    async function createRollablePowerNamed(name) {
                        const xml = POWER_XML.replace("__ALIAS__", escapeXmlAttribute(name)).replace(
                            "__ID__",
                            String(++xmlIdSeed),
                        );
                        const item = await HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(xml, actor), {
                            parent: actor,
                        });
                        expect(item, `fixture: no power was created for ${name}`).to.exist;
                        expect(item.isRollable(), `fixture: ${name} must be rollable`).to.be.true;
                        expect(item.name, "fixture: HDC must keep the item name").to.equal(name);
                        return item;
                    }

                    /**
                     * Drop `item` on the hotbar and return the Macro that drop creates.
                     *
                     * The handler runs unawaited by the hook, so wait on the Macro document rather
                     * than on a timed window.
                     * @param {object} item Item to drop.
                     * @returns {Promise<object|null>} The created Macro, or null when none appeared.
                     */
                    async function dropOnHotbar(item) {
                        const known = new Set(game.macros.map((m) => m.id));
                        let macro = null;
                        Hooks.call("hotbarDrop", ui.hotbar ?? {}, { type: "Item", uuid: item.uuid }, HOTBAR_SLOT);
                        await waitUntil(
                            () => {
                                macro = game.macros.contents.find((m) => !known.has(m.id));
                                return Boolean(macro);
                            },
                            MACRO_WAIT_MS,
                            MACRO_POLL_MS,
                        );
                        if (macro) createdMacroIds.push(macro.id);
                        return macro;
                    }

                    /**
                     * Run a stored macro command against a recording stand-in.
                     *
                     * The assertion has to be what the command does, not what it looks like. Comparing
                     * the text against a second template proves only that both sides escape alike, so
                     * it would pass a wrong fix. Shadows `game`, so the only Foundry surface the
                     * command can reach is the recorder.
                     * @param {string} command Macro command source.
                     * @returns {{calls: Array<Array>, parseError: Error|null, ranForeignStatement: boolean}}
                     */
                    function runMacroCommand(command) {
                        const calls = [];
                        const gameStub = { herosystem6e: { rollItemMacro: (...args) => calls.push(args) } };
                        globalThis[INJECTION_PROBE] = 0;
                        let parseError = null;
                        try {
                            new Function("game", command)(gameStub);
                        } catch (error) {
                            parseError = error;
                        }
                        const ranForeignStatement = globalThis[INJECTION_PROBE] !== 0;
                        delete globalThis[INJECTION_PROBE];
                        return { calls, parseError, ranForeignStatement };
                    }

                    before(async () => {
                        actor = await createQuenchActor({ quench: this, is5e: false, actorType: "pc" });
                        await actor.fullHealth();
                    });

                    after(async () => {
                        if (createdMacroIds.length > 0) {
                            await foundry.documents.Macro.deleteDocuments(createdMacroIds);
                            createdMacroIds.length = 0;
                        }
                        delete globalThis[INJECTION_PROBE];
                        if (actor) await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should roll the intended item when its name holds a double quote", async () => {
                        const item = await createRollablePowerNamed('Plasma "Cutter" Rifle');

                        const macro = await dropOnHotbar(item);
                        expect(macro, "a name with a double quote must still get a hotbar macro").to.exist;

                        const { calls, parseError } = runMacroCommand(macro.command);
                        expect(parseError, `macro command must parse: ${macro.command}`).to.be.null;
                        expect(calls, "exactly one roll").to.have.lengthOf(1);
                        expect(calls[0][0], "name the command delivers").to.equal(item.name);
                        expect(calls[0][1], "type the command delivers").to.equal(item.type);
                    });

                    it("should roll the intended item when its name holds a backslash", async () => {
                        const item = await createRollablePowerNamed("C:\\tokens\\a.jpg");

                        const macro = await dropOnHotbar(item);
                        expect(macro, "a name with a backslash must still get a hotbar macro").to.exist;

                        const { calls, parseError } = runMacroCommand(macro.command);
                        expect(parseError, `macro command must parse: ${macro.command}`).to.be.null;
                        expect(calls, "exactly one roll").to.have.lengthOf(1);
                        // The escape here is the point. An unescaped name loses `\t` to a real tab, so
                        // the macro rolls nothing and warns about a name no item has.
                        expect(calls[0][0], "name the command delivers").to.equal(item.name);
                    });

                    it("should keep a hostile item name inert inside the macro command", async () => {
                        const hostileName = `x"); globalThis.${INJECTION_PROBE} = 1; ("`;
                        const item = await createRollablePowerNamed(hostileName);

                        const macro = await dropOnHotbar(item);
                        expect(macro, "a hostile name must still get a hotbar macro").to.exist;

                        const { calls, parseError, ranForeignStatement } = runMacroCommand(macro.command);
                        expect(parseError, `macro command must parse: ${macro.command}`).to.be.null;
                        expect(ranForeignStatement, "name must not run as code").to.be.false;
                        expect(calls, "exactly one roll").to.have.lengthOf(1);
                        expect(calls[0][0], "name the command delivers").to.equal(item.name);
                    });

                    it("should reuse one macro for a plain name and keep the command format", async () => {
                        const item = await createRollablePowerNamed("Plain Blade");

                        const first = await dropOnHotbar(item);
                        expect(first, "first drop creates a macro").to.exist;
                        // Pinned wire format, written by hand. handleMacroCreation reuses an existing
                        // macro by this exact text, so a format change orphans macros users already hold.
                        expect(first.command).to.equal('game.herosystem6e.rollItemMacro("Plain Blade", "power");');

                        const second = await dropOnHotbar(item);
                        expect(second, "second drop must reuse the macro, not create another").to.not.exist;
                    });
                });
            });
        },
        { displayName: "HERO: Hotbar Macros" },
    );
}
