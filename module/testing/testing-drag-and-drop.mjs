import { createQuenchActor, deleteQuenchActor, setQuenchTimeout, waitUntil } from "./quench-helper.mjs";
import { HeroSystem6eCompendiumDirectory } from "../compendium/compendiumDirectory.mjs";
import { HeroSystemActorSheetV2 } from "../applications/actor/actor-sheet-v2.mjs";

export function registerDropTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.drop-tests`,
        (context) => {
            const { describe, it, before, beforeEach, after, expect } = context;

            // Drop helpers.
            // Every drop test dispatches a real DragEvent at a real node. A stand-in event object runs
            // one method, skips the DragDrop bindings, and hides duplicate drop targets. A real node
            // costs nothing extra: `_onDropItem` reads the target tab and the target row from
            // `event.target.closest(...)`, the same information a stand-in had to fake.

            // One drop writes within 200 ms. 3000 ms absorbs a busy world without hiding a regression
            // behind a long wait.
            const DROP_WAIT_MS = 3000;
            // A folder can hold 101 items, so it needs more room than one item does.
            const FOLDER_DROP_WAIT_MS = 8000;
            // Poll finer than `waitUntil` defaults to. A drop lands in 20-200 ms, and each poll
            // costs a trivial predicate call: 50 ms granularity would spend about 0.7 s of the batch
            // waiting for the next poll instead of waiting for the write.
            const DROP_POLL_MS = 10;

            /**
             * The rendered sheet root element.
             * @param {object} sheet Rendered actor sheet.
             * @returns {HTMLElement} The sheet root.
             */
            function sheetRoot(sheet) {
                const element = sheet?.element;
                expect(element, "sheet must be rendered before a drop test").to.exist;
                return element;
            }

            /**
             * The nav anchor of one tab.
             * @param {object} sheet Rendered actor sheet.
             * @param {string} tab Tab id, i.e. `powers`.
             * @returns {HTMLElement} The anchor.
             */
            function tabAnchor(sheet, tab) {
                const anchor = sheetRoot(sheet).querySelector(`nav a[data-tab="${tab}"]`);
                expect(anchor, `missing nav anchor for tab ${tab}`).to.exist;
                return anchor;
            }

            /**
             * The text inside one tab anchor, i.e. where users release the mouse. Falls back to the
             * anchor when the label carries no element.
             * @param {object} sheet Rendered actor sheet.
             * @param {string} tab Tab id, i.e. `powers`.
             * @returns {HTMLElement} The label node.
             */
            function tabLabel(sheet, tab) {
                const anchor = tabAnchor(sheet, tab);
                return anchor.querySelector("span") ?? anchor;
            }

            /**
             * Dispatch one real drop event at one real node.
             * @param {Element} node Drop target.
             * @param {object} dragData Payload for `text/plain`, i.e. `{ type, uuid }`.
             * @returns {DragEvent} The dispatched event, for `defaultPrevented` checks.
             */
            function dispatchDrop(node, dragData) {
                expect(node, "missing drop target node").to.exist;
                const data = new DataTransfer();
                data.setData("text/plain", JSON.stringify(dragData));
                const event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data });
                node.dispatchEvent(event);
                return event;
            }

            /**
             * Dispatch a real drop, count the handler runs it starts, and abort before any write.
             *
             * `_onDrop` fires `dropActorSheetData` before it resolves a document, and stops when a
             * listener returns false. The hook also runs synchronously, so bubbling cannot finish
             * first: the count is exact without any waiting.
             * @param {Element} node Drop target.
             * @param {object} dragData Payload for `text/plain`.
             * @param {string} label Names the target in failure messages.
             * @returns {{runs: number, event: DragEvent}} Handler runs and the dispatched event.
             */
            function countDropRuns(node, dragData, label) {
                let runs = 0;
                const hook = Hooks.on("dropActorSheetData", () => {
                    runs++;
                    return false;
                });
                try {
                    const event = dispatchDrop(node, dragData);
                    expect(event.defaultPrevented, `no drop handler took a drop on the ${label}`).to.be.true;
                    return { runs, event };
                } finally {
                    Hooks.off("dropActorSheetData", hook);
                }
            }

            /**
             * Describe a drop target in a failure message.
             * @param {Element} node Drop target.
             * @returns {string} Human readable target.
             */
            function dropTargetName(node) {
                if (node?.dataset?.tab) return `the ${node.dataset.tab} tab`;
                if (node?.dataset?.documentUuid) return `the row of ${node.dataset.documentUuid}`;
                return "the sheet";
            }

            /**
             * Dispatch a real drop at a real node and wait for the change it must cause.
             *
             * The sheet's own binding runs, so the test stays end to end. `_onDrop` outlives
             * `dispatchEvent`: it resolves uuids, prepares items, then writes them. Wait on that
             * write, never on a timed window.
             *
             * `waitFor` states what the drop must achieve:
             * - A number: at least that many documents must be created on `actor`. Pass 1 for one
             *   document. The `createItem` hook fires once per document, so the count accumulates.
             * - A function: polled until true. Use it when the contract is a state, i.e. a stacked
             *   quantity or a re-parented item. Same-actor moves and rejected drops create nothing,
             *   so they need a predicate, not a count.
             *
             * One drop triggers about six renders and the sheet replaces its inner DOM. Never hold a
             * node across a drop: re-query `sheet.element` and every target node, per call.
             * @param {Element} node Node to drop on. Re-query it per call.
             * @param {object} dragData Payload for `text/plain`, i.e. `{ type, uuid }`.
             * @param {object} actor Actor that receives the drop.
             * @param {number|(() => boolean)} waitFor Required creations, or a state predicate.
             * @param {object} [options] `timeoutMs`, default `DROP_WAIT_MS`.
             * @returns {Promise<{runs: number, created: number}>} Handler runs and documents created.
             */
            async function dropAndWait(node, dragData, actor, waitFor, { timeoutMs = DROP_WAIT_MS } = {}) {
                const where = dropTargetName(node);
                let runs = 0;
                const created = [];
                const isDone = typeof waitFor === "function" ? waitFor : () => created.length >= waitFor;
                const onRun = Hooks.on("dropActorSheetData", () => {
                    runs++;
                });
                const onCreate = Hooks.on("createItem", (docs) => {
                    const docsIn = Array.isArray(docs) ? docs : [docs];
                    created.push(...docsIn.filter((doc) => doc.parent?.id === actor.id));
                });
                try {
                    const event = dispatchDrop(node, dragData);
                    expect(event.defaultPrevented, `no drop handler took a drop on ${where}`).to.be.true;
                    expect(
                        await waitUntil(isDone, timeoutMs, DROP_POLL_MS),
                        `a drop on ${where} did not reach its expected state within ${timeoutMs} ms`,
                    ).to.be.true;
                    return { runs, created: created.length };
                } finally {
                    Hooks.off("dropActorSheetData", onRun);
                    Hooks.off("createItem", onCreate);
                }
            }

            describe("Drop Tests", function () {
                // Mocha's 2000ms default is too short when several actors are created at the same time.
                setQuenchTimeout(this, 20000);

                describe("HDP Upload & Stacking", function () {
                    // `uploadFromXml` labels the pack it creates from this CHARACTER_NAME, and one flat
                    // namespace holds every world pack, so the name states who owns it: the `_Quench`
                    // prefix that every fixture sweep looks for, then this suite.
                    const HDP_FIXTURE_NAME = "_Quench Test Compendium Upload And Stacking";
                    const hdpContents = `<?xml version="1.0" encoding="UTF-16"?>
                        <PREFAB version="6.0" TEMPLATE="builtIn.Heroic6E.hdt">
                        <CHARACTER_INFO CHARACTER_NAME="${HDP_FIXTURE_NAME}" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                            <BACKGROUND />
                            <PERSONALITY />
                            <QUOTE />
                            <TACTICS />
                            <CAMPAIGN_USE />
                            <APPEARANCE />
                            <NOTES1 />
                            <NOTES2 />
                            <NOTES3 />
                            <NOTES4 />
                            <NOTES5 />
                        </CHARACTER_INFO>
                        <CHARACTERISTICS>
                            <STR XMLID="STR" ID="1785778287885" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <LIST XMLID="GENERIC_OBJECT" ID="1787873035926" BASECOST="0.0" LEVELS="0" ALIAS="List1" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="COMPOUNDPOWER" ID="1787873810737" BASECOST="0.0" LEVELS="0" ALIAS="Compound Power" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1787873035926" NAME="CompoundPower3" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <POWER XMLID="CLINGING" ID="1787873855191" BASECOST="10.0" LEVELS="0" ALIAS="Clinging" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                            </POWER>
                            <VPP XMLID="GENERIC_OBJECT" ID="1787873419350" BASECOST="0.0" LEVELS="99" ALIAS="Variable Power Pool" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="VPP1" QUANTITY="1">
                            <NOTES />
                            <ADDER XMLID="CONTROLCOST" ID="1787873461743" BASECOST="0.0" LEVELS="99" ALIAS="Control Cost" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            </VPP>
                            <POWER XMLID="COMPOUNDPOWER" ID="1787873748619" BASECOST="0.0" LEVELS="0" ALIAS="Compound Power" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1787873419350" NAME="CompoundPower2" QUANTITY="99" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <SWIMMING XMLID="SWIMMING" ID="1787873833383" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
                                <NOTES />
                            </SWIMMING>
                            </POWER>
                            <MULTIPOWER XMLID="GENERIC_OBJECT" ID="1787873173815" BASECOST="99.0" LEVELS="0" ALIAS="Multipower" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1">
                            <NOTES />
                            </MULTIPOWER>
                            <POWER XMLID="COMPOUNDPOWER" ID="1787873271361" BASECOST="0.0" LEVELS="0" ALIAS="Compound Power" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1787873173815" ULTRA_SLOT="Yes" NAME="CompoundPower1" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <POWER XMLID="EGOATTACK" ID="1787873352472" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="MentalBlast1" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                            <POWER XMLID="TUNNELING" ID="1787873394370" BASECOST="2.0" LEVELS="1" ALIAS="Tunneling" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                            </POWER>
                            <POWER XMLID="ENERGYBLAST" ID="1787873261859" BASECOST="0.0" LEVELS="1" ALIAS="Blast M" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1787873173815" ULTRA_SLOT="Yes" NAME="Blast M" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </POWER>
                        </POWERS>
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </PREFAB>`;

                    let quenchActor6e;
                    let quenchActor5e;
                    let testCompendium;
                    let documents;
                    let actorSheet6e;
                    let actorSheet5e;

                    before(async () => {
                        // One pack, built here. A pack under this name already means an earlier run leaked
                        // one. Fail on that rather than overwrite it: overwriting hides the leak, then tests
                        // against a pack this run did not build. Global setup sweeps `_Quench` fixture packs
                        // first, so the upload never reaches its `Overwrite Compendium Entry` confirm.
                        const fixturePackName = `world.${HDP_FIXTURE_NAME.slugify({ strict: true })}`;
                        expect(game.packs.has(fixturePackName), `${fixturePackName} must not already exist`).to.equal(
                            false,
                        );

                        testCompendium = await HeroSystem6eCompendiumDirectory.uploadFromXml(hdpContents);

                        // The sweep finds the pack through this label alone, so a quiet change to how
                        // `uploadFromXml` names a pack would strand it. Check the label here instead.
                        expect(testCompendium, "uploadFromXml returned no pack").to.exist;
                        expect(testCompendium.metadata.label, "pack label must be the fixture name").to.equal(
                            HDP_FIXTURE_NAME,
                        );

                        // Read the pack once. Every test below reads this array, so the suite pays one
                        // pack load instead of one per test.
                        documents = await testCompendium.getDocuments();
                        quenchActor6e = await createQuenchActor({ quench: this, is5e: false, actorType: "pc" });
                        actorSheet6e = quenchActor6e.sheet;
                        await actorSheet6e.render(true);

                        quenchActor5e = await createQuenchActor({ quench: this, is5e: true, actorType: "pc" });
                        actorSheet5e = quenchActor5e.sheet;
                    });

                    beforeEach(async () => {
                        if (quenchActor6e?.items?.size > 0) {
                            const ids = quenchActor6e.items.map((i) => i.id);
                            await quenchActor6e.deleteEmbeddedDocuments("Item", ids);
                        }
                    });

                    after(async () => {
                        // Delete the compendium in a finally, so one failed step above cannot leak it. If
                        // this pack survives, the next run fails in its `before` hook, and that is how a
                        // leak reports itself. Global setup and global teardown sweep `_Quench` fixture
                        // packs too, at the ends of a run.
                        try {
                            if (actorSheet6e?.rendered) {
                                await actorSheet6e.close();
                            }
                        } finally {
                            if (quenchActor6e) {
                                await deleteQuenchActor({ quench: this, actor: quenchActor6e });
                            }
                            if (quenchActor5e) {
                                await deleteQuenchActor({ quench: this, actor: quenchActor5e });
                            }

                            if (testCompendium) {
                                await testCompendium.deleteCompendium();
                            }
                        }
                    });

                    /**
                     * Drop one compendium document on a tab label and require the actor to hold
                     * `total` items that `match` picks out.
                     *
                     * What it does, in order:
                     * 1. Asserts the actor holds exactly `total - 1` matched items now. This is the
                     *    precondition, and it is what makes the running numbers read as a sequence:
                     *    a pair of calls takes the count from 0 to 1, then from 1 to 2.
                     * 2. Dispatches one real drop on the tab label, where users release the mouse, so
                     *    the nav anchor binding runs. `tabLabel` re-queries the node, because one drop
                     *    triggers several renders and each render replaces the inner DOM.
                     * 3. Requires exactly one handler run.
                     * 4. Waits for the matched count to reach `total`, then returns the matched items.
                     *
                     * Why the count is exact, not a minimum: the bug this suite guards duplicates
                     * items, so an "at least" wait would pass while the actor filled with copies.
                     *
                     * Why it cannot run forever: step 4 polls `dropAndWait`, which asserts at
                     * `DROP_WAIT_MS`, 3000 ms. A good drop resolves in about 50 ms. A drop that leaves
                     * any other count fails the assertion at 3000 ms and reports the target and the
                     * limit in the message. Slow, not endless.
                     * @param {string} tab Tab id, i.e. `powers`.
                     * @param {object} doc Compendium document to drop.
                     * @param {(item: object) => boolean} match Picks the items this drop must produce.
                     * @param {number} total Matched items the actor must hold after this one drop.
                     * @returns {Promise<object[]>} The matched items.
                     * @throws {AssertionError} When the precondition, the handler count, or the total fails.
                     */
                    const dropOnceExpectTotal = async (tab, doc, match, total) => {
                        const found = () => quenchActor6e.items.filter(match);
                        expect(
                            found().length,
                            `the actor must hold ${total - 1} matched items before the ${tab} drop of ${doc.name}`,
                        ).to.equal(total - 1);
                        const { runs } = await dropAndWait(
                            tabLabel(actorSheet6e, tab),
                            { type: "Item", uuid: doc.uuid },
                            quenchActor6e,
                            () => found().length === total,
                        );
                        expect(runs, "one drop must run one handler").to.equal(1);
                        return found();
                    };

                    it("Upload and verify 11 documents", async () => {
                        expect(testCompendium).to.exist;
                        expect(documents.length).to.equal(11);
                    });

                    it("Add 'Blast M' to actor powers twice (no stacking)", async () => {
                        const blastMDoc = documents.find((d) => d.name === "Blast M");
                        expect(blastMDoc).to.exist;
                        const dragData = { type: "Item", uuid: blastMDoc.uuid };

                        const first = await dropAndWait(tabLabel(actorSheet6e, "powers"), dragData, quenchActor6e, 1);
                        expect(first.runs, "one drop must run one handler").to.equal(1);
                        let blastMItems = quenchActor6e.items.filter((item) => item.name === blastMDoc.name);
                        expect(blastMItems.length).to.equal(1);

                        const second = await dropAndWait(tabLabel(actorSheet6e, "powers"), dragData, quenchActor6e, 1);
                        expect(second.runs, "one drop must run one handler").to.equal(1);
                        blastMItems = quenchActor6e.items.filter((item) => item.name === blastMDoc.name);
                        expect(blastMItems.length).to.equal(2);
                    });

                    it("Drop 'Blast M' to equipment tab twice (stacking check)", async () => {
                        const blastMDoc = documents.find((d) => d.name === "Blast M");
                        expect(blastMDoc).to.exist;
                        const dragData = { type: "Item", uuid: blastMDoc.uuid };

                        // The first drop into the equipment tab converts the power and creates one item.
                        const first = await dropAndWait(
                            tabLabel(actorSheet6e, "equipment"),
                            dragData,
                            quenchActor6e,
                            1,
                        );
                        expect(first.runs, "one drop must run one handler").to.equal(1);
                        let equipmentItems = quenchActor6e.items.filter((item) => item.name === blastMDoc.name);
                        expect(equipmentItems.length).to.equal(1);
                        expect(equipmentItems[0].system.QUANTITY).to.equal(1);

                        // The second drop stacks onto that entry. It updates the quantity and creates
                        // nothing, so wait on the quantity.
                        const stacked = equipmentItems[0];
                        const second = await dropAndWait(
                            tabLabel(actorSheet6e, "equipment"),
                            dragData,
                            quenchActor6e,
                            () => stacked.system.QUANTITY === 2,
                        );
                        expect(second.runs, "one drop must run one handler").to.equal(1);
                        equipmentItems = quenchActor6e.items.filter((item) => item.name === blastMDoc.name);
                        expect(equipmentItems.length).to.equal(1);
                        expect(equipmentItems[0].system.QUANTITY).to.equal(2);
                    });

                    it("Add 'List1' twice to powers and equipment (stacking check)", async () => {
                        const listDoc = documents.find((d) => d.name === "List1");
                        expect(listDoc).to.exist;
                        const isList = (item) => item.name === listDoc.name;

                        // Test dropping List1 twice to Powers (expect 2 separate list items)
                        await dropOnceExpectTotal("powers", listDoc, isList, 1);
                        const powerListItems = await dropOnceExpectTotal("powers", listDoc, isList, 2);
                        expect(powerListItems.length).to.equal(2);

                        // Clear out items for equipment test
                        await quenchActor6e.deleteEmbeddedDocuments(
                            "Item",
                            quenchActor6e.items.map((i) => i.id),
                        );

                        // Test dropping List1 twice to Equipment (LIST doesn't support quantity, creates 2 items)
                        await dropOnceExpectTotal("equipment", listDoc, isList, 1);
                        const equipmentListItems = await dropOnceExpectTotal("equipment", listDoc, isList, 2);
                        expect(equipmentListItems.length).to.equal(2);
                    });

                    it("Add 'VPP1' twice to powers and equipment (stacking check)", async () => {
                        const vppDoc = documents.find((d) => d.name === "VPP1");
                        expect(vppDoc).to.exist;
                        const isVpp = (item) => item.name === vppDoc.name;

                        // Test dropping VPP1 twice to Powers
                        await dropOnceExpectTotal("powers", vppDoc, isVpp, 1);
                        const powerVppItems = await dropOnceExpectTotal("powers", vppDoc, isVpp, 2);
                        expect(powerVppItems.length).to.equal(2);

                        // Clear out items for equipment test
                        await quenchActor6e.deleteEmbeddedDocuments(
                            "Item",
                            quenchActor6e.items.map((i) => i.id),
                        );

                        // Test dropping VPP1 twice to Equipment (expect 1 item with quantity 2)
                        const [pool] = await dropOnceExpectTotal("equipment", vppDoc, isVpp, 1);
                        expect(pool.system.QUANTITY).to.equal(1);

                        // The second drop stacks: it updates the quantity and creates nothing.
                        const stackDrop = await dropAndWait(
                            tabLabel(actorSheet6e, "equipment"),
                            { type: "Item", uuid: vppDoc.uuid },
                            quenchActor6e,
                            () => pool.system.QUANTITY === 2,
                        );
                        expect(stackDrop.runs, "one drop must run one handler").to.equal(1);
                        const equipmentVppItems = quenchActor6e.items.filter(isVpp);
                        expect(equipmentVppItems.length).to.equal(1);
                        expect(pool.system.QUANTITY).to.equal(2);
                    });

                    it("Drop a framework-nested compound power onto a VPP moves it into the VPP", async () => {
                        const listDoc = documents.find((d) => d.name === "List1");
                        const compoundDoc = documents.find((d) => d.name === "CompoundPower3");
                        const vppDoc = documents.find((d) => d.name === "VPP1");
                        expect(listDoc).to.exist;
                        expect(compoundDoc).to.exist;
                        expect(vppDoc).to.exist;

                        // Drop each document on the powers tab label. A framework drop also carries the
                        // items nested under it, so wait for the item by name, not for a creation count.
                        const dropToPowers = async (doc) => {
                            const { runs } = await dropAndWait(
                                tabLabel(actorSheet6e, "powers"),
                                { type: "Item", uuid: doc.uuid },
                                quenchActor6e,
                                () => quenchActor6e.items.some((item) => item.name === doc.name),
                            );
                            expect(runs, "one drop must run one handler").to.equal(1);
                        };
                        await dropToPowers(listDoc);
                        await dropToPowers(compoundDoc);
                        await dropToPowers(vppDoc);

                        // The compound drop writes the compound and its clinging power in one batch.
                        expect(
                            await waitUntil(
                                () =>
                                    quenchActor6e.items.some((i) => i.system.XMLID === "COMPOUNDPOWER") &&
                                    quenchActor6e.items.some((i) => i.system.XMLID === "CLINGING"),
                                DROP_WAIT_MS,
                                DROP_POLL_MS,
                            ),
                            "a compound drop must create both the compound and its nested power",
                        ).to.be.true;

                        const list = quenchActor6e.items.find((item) => item.system.XMLID === "LIST");
                        const vpp = quenchActor6e.items.find((item) => item.system.XMLID === "VPP");
                        const compound = quenchActor6e.items.find((item) => item.name === "CompoundPower3");
                        const clinging = quenchActor6e.items.find((item) => item.system.XMLID === "CLINGING");
                        expect(clinging.parentItem?.id).to.equal(compound.id);

                        // Nest the compound in the list first so the drop has to re-parent rather than adopt
                        await compound.update({ "system.PARENTID": list.system.ID });
                        expect(compound.parentItem?.id).to.equal(list.id);

                        // Same-actor drop onto the VPP row. The row carries `data-document-uuid`, so the
                        // pipeline re-parents the compound. A same-actor move updates items and creates
                        // none, so wait on the new parent id.
                        const vppRow = sheetRoot(actorSheet6e).querySelector(`[data-document-uuid="${vpp.uuid}"]`);
                        expect(vppRow, "the VPP must render a row before a drop can land on it").to.exist;
                        const ontoRow = await dropAndWait(
                            vppRow,
                            { type: "Item", uuid: compound.uuid },
                            quenchActor6e,
                            () => compound.system.PARENTID === vpp.system.ID,
                        );
                        expect(ontoRow.runs, "one drop must run one handler").to.equal(1);
                        expect(compound.parentItem?.id).to.equal(vpp.id);
                        expect(clinging.parentItem?.id).to.equal(compound.id);
                        expect(compound.isActive).to.equal(false);
                        expect(clinging.isActive).to.equal(false);

                        // Drop on the powers panel. The section names the powers tab and no document, so
                        // the pipeline clears the parent.
                        const panel = sheetRoot(actorSheet6e).querySelector('section[data-tab="powers"]');
                        expect(panel, "the powers panel must render before a drop can land on it").to.exist;
                        const ontoPanel = await dropAndWait(
                            panel,
                            { type: "Item", uuid: compound.uuid },
                            quenchActor6e,
                            () => compound.system.PARENTID === undefined,
                        );
                        expect(ontoPanel.runs, "one drop must run one handler").to.equal(1);
                        expect(compound.parentItem).to.equal(null);
                        expect(compound.isActive).to.equal(true);
                    });

                    it("Add 'Multipower' twice to powers and equipment (stacking check)", async () => {
                        const mpDoc = documents.find((d) => d.system.XMLID === "MULTIPOWER");
                        expect(mpDoc).to.exist;
                        const isMultipower = (item) => item.system.XMLID === "MULTIPOWER";

                        // Test dropping Multipower twice to Powers
                        await dropOnceExpectTotal("powers", mpDoc, isMultipower, 1);
                        const powerMpItems = await dropOnceExpectTotal("powers", mpDoc, isMultipower, 2);
                        expect(powerMpItems.length).to.equal(2);

                        // Clear out items for equipment test
                        await quenchActor6e.deleteEmbeddedDocuments(
                            "Item",
                            quenchActor6e.items.map((i) => i.id),
                        );

                        // Test dropping Multipower twice to Equipment: one entry with quantity 2.
                        const [multipower] = await dropOnceExpectTotal("equipment", mpDoc, isMultipower, 1);
                        const itemCountAfterFirstMultiPower = quenchActor6e.items.size;

                        // The second drop stacks. Wait for the quantity and for the item count, so a
                        // second created entry cannot slip past.
                        const stackDrop = await dropAndWait(
                            tabLabel(actorSheet6e, "equipment"),
                            { type: "Item", uuid: mpDoc.uuid },
                            quenchActor6e,
                            () =>
                                multipower.system.QUANTITY === 2 &&
                                quenchActor6e.items.size === itemCountAfterFirstMultiPower,
                        );
                        expect(stackDrop.runs, "one drop must run one handler").to.equal(1);
                        const equipmentMpItems = quenchActor6e.items.filter(isMultipower);
                        expect(equipmentMpItems.length).to.equal(1);
                        expect(multipower.system.QUANTITY).to.equal(2);
                        expect(quenchActor6e.items.size).to.equal(itemCountAfterFirstMultiPower);
                    });

                    describe("Drop handler wiring", function () {
                        // The sheet carries two drop targets. `a[data-tab]` comes from this system, the
                        // whole sheet element from ActorSheetV2. A drop on a tab label runs the anchor
                        // handler first, then bubbles to the sheet element. Both import the item, so the
                        // anchor handler stops propagation. Every drop test dispatches at a real node,
                        // so a second import shows up here as a doubled count.

                        it("Runs the drop handler once per drop, wherever it lands", async () => {
                            const blast = documents.find((d) => d.name === "Blast M");
                            expect(blast).to.exist;
                            const itemCount = quenchActor6e.items.size;
                            const dragData = { type: blast.documentName, uuid: blast.uuid };

                            const anchor = tabAnchor(actorSheet6e, "powers");
                            const spots = [
                                ["tab label", anchor.querySelector("span") ?? anchor],
                                ["tab anchor", anchor],
                                ["tab bar, off the anchors", anchor.closest("nav")],
                                ["tab panel", sheetRoot(actorSheet6e).querySelector('section[data-tab="powers"]')],
                            ];
                            // An aborted drop writes nothing, so it triggers no render and the four
                            // nodes stay live for the whole loop.
                            for (const [label, node] of spots) {
                                expect(node, `missing node for the ${label}`).to.exist;
                                const { runs } = countDropRuns(node, dragData, label);
                                expect(runs, `a drop on the ${label} ran the handler ${runs} times`).to.equal(1);
                            }
                            expect(quenchActor6e.items.size, "aborted drops must write no documents").to.equal(
                                itemCount,
                            );
                        });

                        it("Creates one power when dropped on the powers tab label", async () => {
                            const blast = documents.find((d) => d.name === "Blast M");
                            expect(blast).to.exist;

                            const { runs, created } = await dropAndWait(
                                tabLabel(actorSheet6e, "powers"),
                                { type: blast.documentName, uuid: blast.uuid },
                                quenchActor6e,
                                1,
                            );
                            expect(runs, "one drop must run one handler").to.equal(1);

                            const matches = quenchActor6e.items.filter((item) => item.name === blast.name);
                            expect(created, "one drop must create one item").to.equal(1);
                            expect(matches.length, "one drop must create one item").to.equal(1);
                            expect(matches[0].type).to.equal("power");
                        });

                        it("Runs the drop handler once for a drop on an item row", async () => {
                            const blast = documents.find((d) => d.name === "Blast M");
                            expect(blast).to.exist;
                            const dragData = { type: blast.documentName, uuid: blast.uuid };

                            // A row only exists once the sheet renders an item.
                            await dropAndWait(tabLabel(actorSheet6e, "powers"), dragData, quenchActor6e, 1);
                            const itemCount = quenchActor6e.items.size;

                            const row = sheetRoot(actorSheet6e).querySelector(
                                'section[data-tab="powers"] [data-document-uuid]',
                            );
                            expect(row, "the dropped power must render a row").to.exist;
                            const { runs } = countDropRuns(row, dragData, "item row");
                            expect(runs, `a drop on the item row ran the handler ${runs} times`).to.equal(1);
                            expect(quenchActor6e.items.size, "aborted drops must write no documents").to.equal(
                                itemCount,
                            );
                        });

                        it("Creates one equipment item when dropped on the equipment tab label", async () => {
                            const blast = documents.find((d) => d.name === "Blast M");
                            expect(blast).to.exist;

                            const { runs, created } = await dropAndWait(
                                tabLabel(actorSheet6e, "equipment"),
                                { type: blast.documentName, uuid: blast.uuid },
                                quenchActor6e,
                                1,
                            );
                            expect(runs, "one drop must run one handler").to.equal(1);

                            // Dropping on a tab renames the item type, so this covers the nav anchor
                            // branch of _resolveDropTargetType too.
                            const matches = quenchActor6e.items.filter((item) => item.name === blast.name);
                            expect(created, "one drop must create one item").to.equal(1);
                            expect(matches.length, "one drop must create one item").to.equal(1);
                            expect(matches[0].type).to.equal("equipment");
                        });
                    });

                    describe("Drop validation", function () {
                        it("Reports an error and writes nothing when the tab cannot take the item", async () => {
                            const blast = documents.find((d) => d.name === "Blast M");
                            expect(blast).to.exist;

                            // `_onDropItem` asks the item to validate the target type and stops on the
                            // first fault. `Blast M` faults for `skill`, so the drop notifies and
                            // writes nothing. The check accepts skills, skill enhancers, lists, and
                            // separators, so it rejects most powers: 101 of the 103 in
                            // world.heroitems-6e. The fault lands after `dropActorSheetData`, so the
                            // abort lane cannot see it: wait on the notification instead. The path
                            // needs well under 1.5 s, so a short timeout keeps a regression cheap.
                            const errors = [];
                            const notify = ui.notifications.error;
                            ui.notifications.error = (message) => {
                                errors.push(String(message));
                            };
                            try {
                                const { runs, created } = await dropAndWait(
                                    tabLabel(actorSheet6e, "skills"),
                                    { type: blast.documentName, uuid: blast.uuid },
                                    quenchActor6e,
                                    () => errors.length > 0,
                                    { timeoutMs: 1500 },
                                );
                                expect(runs, "one drop must run one handler").to.equal(1);
                                expect(created, "a rejected drop must create no documents").to.equal(0);
                            } finally {
                                ui.notifications.error = notify;
                            }
                            expect(errors.length, "one rejection must notify once").to.equal(1);
                            expect(errors[0], "the notification must name the rejected item")
                                .to.include(blast.name)
                                .and.to.include("skill");
                            expect(quenchActor6e.items.size, "a rejected drop must write nothing").to.equal(0);
                        });
                    });

                    // Test dropping all the standard 5e/6e compendium items onto an actor
                    for (const edition of [5, 6]) {
                        describe(`Add all ${edition}e compendium items`, function () {
                            let compendium, actorSheet;
                            const compendiumName = `world.heroitems-${edition}e`;

                            before(async function () {
                                compendium = game.packs.get(compendiumName);
                                expect(compendium, `Unable to locate ${compendiumName}`).to.exist;

                                actorSheet = edition === 5 ? actorSheet5e : actorSheet6e;
                                await actorSheet.render(true);
                            });

                            beforeEach(async function () {
                                const itemIds = actorSheet.actor.items.map((i) => i.id);
                                if (itemIds.length > 0) {
                                    await actorSheet.actor.deleteEmbeddedDocuments("Item", itemIds);
                                }
                            });

                            const targetPack = game.packs.get(compendiumName);
                            // Only target root folders that have no parent folder, sorted alphabetically by name
                            const rootFolders = (targetPack?.folders ?? [])
                                .filter((folder) => !folder.folder)
                                .sort((a, b) => a.name.localeCompare(b.name));

                            rootFolders.forEach((folder) => {
                                it(`${edition}e ${folder.name}`, async function () {
                                    const itemType =
                                        HeroSystemActorSheetV2._TAB_ITEM_TYPES[folder.name.toLowerCase()] ||
                                        folder.name.toLowerCase();

                                    // Helper to recursively collect all nested subfolder IDs
                                    const getDescendantFolderIds = (folder) => {
                                        let ids = [];
                                        for (const child of folder.children) {
                                            const childFolder = child.folder;
                                            ids.push(childFolder.id);
                                            ids.push(...getDescendantFolderIds(childFolder));
                                        }
                                        return ids;
                                    };

                                    const allFolderIds = [folder.id, ...getDescendantFolderIds(folder)];
                                    const expectedEntries = targetPack.index.filter((entry) =>
                                        allFolderIds.includes(entry.folder),
                                    );
                                    const expectedCount = expectedEntries.length;

                                    // Drop on the sheet root, so the ActorSheetV2 whole-sheet binding
                                    // runs. A tab label would force that tab's type on every item and
                                    // change what this test proves. The label position has its own
                                    // coverage in the wiring tests. A duplicated drop target doubles
                                    // every item in this suite.
                                    const actor = actorSheet.actor;
                                    const { runs } = await dropAndWait(
                                        sheetRoot(actorSheet),
                                        { type: folder.documentName, uuid: folder.uuid },
                                        actor,
                                        expectedCount,
                                        { timeoutMs: FOLDER_DROP_WAIT_MS },
                                    );
                                    expect(runs, `the folder drop ran the handler ${runs} times`).to.equal(1);

                                    const matchingItems = actor.items.filter((o) => o.type === itemType);

                                    if (matchingItems.length !== expectedCount) {
                                        const expectedNames = expectedEntries.map((e) => e.name).sort();
                                        const actualNames = matchingItems.map((i) => i.name).sort();

                                        console.warn(
                                            `[Test Mismatch] Folder "${folder.name}" (${edition}e): Expected ${expectedCount}, but found ${matchingItems.length}`,
                                        );
                                        console.warn("Expected items:", expectedNames);
                                        console.warn("Actual items on actor:", actualNames);

                                        // Find missing or extra items for convenience
                                        const missing = expectedNames.filter((name) => !actualNames.includes(name));
                                        const extra = actualNames.filter((name) => !expectedNames.includes(name));
                                        if (missing.length > 0) console.warn("Missing items:", missing);
                                        if (extra.length > 0) console.warn("Unexpected extra items:", extra);
                                    }

                                    expect(matchingItems.length).to.equal(expectedCount);
                                });
                            });
                        });
                    }
                });

                describe("Actor sheet chevron state", function () {
                    let actor;
                    let sheet;

                    before(async () => {
                        actor = await createQuenchActor({ quench: this, is5e: false, actorType: "pc" });
                        sheet = actor.sheet;
                        await sheet.render(true);
                    });

                    after(async () => {
                        if (sheet?.rendered) await sheet.close();
                        if (actor) await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should drop collapsed-state entries for items deleted while the sheet stays open", async function () {
                        await actor.addHeroSystemManeuvers();
                        const item = actor.items.find((i) => i.system?.XMLID === "DODGE");
                        const uuid = item.uuid;
                        sheet.chevronCollapsedStatus[uuid] = true;
                        await item.delete();

                        const errors = [];
                        const originalError = console.error;
                        console.error = (...args) => errors.push(args.join(" "));
                        try {
                            await sheet.setChevronStatus(sheet.element);
                        } finally {
                            console.error = originalError;
                        }

                        expect(sheet.chevronCollapsedStatus, "stale entry pruned").to.not.have.property(uuid);
                        expect(
                            errors.filter((e) => e.includes("unable to find item")),
                            "no stale-item errors",
                        ).to.be.empty;
                    });
                });
            });
        },
        { displayName: "HERO: Drop Tests" },
    );
}
