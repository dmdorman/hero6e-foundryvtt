import { HeroSystem6eItem } from "../item/item.mjs";
import { HeroSystem6eItemPower } from "../item/HeroSystem6eTypeDataModels.mjs";
import { createQuenchActor, deleteQuenchActor, waitUntil } from "./quench-helper.mjs";

/**
 * Item sheet tests: the cells the sheet renders, which of them a player may edit, and whether an edit
 * reaches the document.
 *
 * One field is covered today, LEVELS. The file is not named for it, because the sheet holds dozens of
 * cells and every one of them answers the same three questions. Add a `describe` block per cell.
 *
 * Fixtures are Hero Designer markup, copied verbatim below, never assembled attributes. A hand-built
 * element tests the importer against attributes no export produces, and it hides which attribute
 * carries the rule under test. Provenance names the export each element came from.
 *
 * Each case drives the real sheet rather than a rendered template string. The sheet owns three things a
 * string cannot show: the context it hands its partials, the delegated change listener that persists
 * every input, and the writer that listener selects. A markup-only test misses two of those.
 *
 * Assert `disabled` before you dispatch anything. A disabled input takes no typing and raises no change
 * event of its own, so a scripted write succeeds through a locked cell. Skip that assertion and the
 * suite goes green on a field no player can reach.
 *
 * The rule under test: the LEVELS cell is a purchase the player owns, except on a power that records
 * that defense in level fields of its own — PDLEVELS, EDLEVELS, MDLEVELS, FDLEVELS and POWDLEVELS, five
 * on Damage Reduction and fewer on the rest. There LEVELS is the total, and it is the only number
 * `cost()` reads, so `HeroSystem6eItemPower.levelsTotalPurchasedDefenses` reports the case and the sheet locks
 * the cell and says why. The check is presence, not value: an unpurchased defense exports as 0, so a
 * truth test would unlock the one cell cost ignores.
 *
 */

// The sheet's change listener writes through `item.update`, which settles asynchronously.
const WRITE_SETTLE_MS = 2000;

const BLAST_6E_XML = `<POWER XMLID="ENERGYBLAST" ID="1709333792635" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                          <NOTES />
                        </POWER>`;

const MENTAL_DEFENSE_6E_XML = `<POWER XMLID="MENTALDEFENSE" ID="1709333957464" BASECOST="0.0" LEVELS="1" ALIAS="Mental Defense" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                          <NOTES />
                        </POWER>`;

const RESISTANT_PROTECTION_6E_XML = `<POWER XMLID="FORCEFIELD" ID="1709334003070" BASECOST="0.0" LEVELS="0" ALIAS="Resistant Protection" POSITION="71" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0">
                          <NOTES />
                        </POWER>`;

const BARRIER_6E_XML = `<POWER XMLID="FORCEWALL" ID="1711932416775" BASECOST="3.0" LEVELS="0" ALIAS="Barrier" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0" LENGTHLEVELS="0" HEIGHTLEVELS="0" BODYLEVELS="0" WIDTHLEVELS="0.0">
                          <NOTES />
                        </POWER>`;

const ARMOR_5E_XML = `<POWER XMLID="ARMOR" ID="1709342537943" BASECOST="0.0" LEVELS="0" ALIAS="Armor" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0">
                          <NOTES />
                        </POWER>`;

const INVISIBILITY_5E_XML = `<POWER XMLID="INVISIBILITY" ID="1709342653112" BASECOST="10.0" LEVELS="0" ALIAS="Invisibility" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                          <NOTES />
                        </POWER>`;

const FORCE_FIELD_5E_XML = `<POWER XMLID="FORCEFIELD" ID="1702155860391" BASECOST="0.0" LEVELS="21" ALIAS="Force Field" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="10" EDLEVELS="11" MDLEVELS="0" POWDLEVELS="0">
                          <NOTES/>
                        </POWER>`;

const DAMAGE_RESISTANCE_5E_XML = `<POWER XMLID="DAMAGERESISTANCE" ID="1709342567780" BASECOST="0.0" LEVELS="0" ALIAS="Damage Resistance" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" FDLEVELS="0" POWDLEVELS="0">
                          <NOTES />
                        </POWER>`;

/**
 * Create the empty actor that owns one case's fixture item.
 *
 * The cell needs an owned item and the edition that item belongs to. Uploading a whole Lad or Lass
 * export would add characteristics and dozens of items that no assertion here reads.
 *
 * @param {object} test Mocha test context. The fixture helper names the actor from it.
 * @param {boolean} is5e Edition the fixture item belongs to.
 * @returns {Promise<HeroSystem6eActor>} The created actor.
 */
function createFixtureActor(test, is5e) {
    return createQuenchActor({ quench: test, is5e, actorType: "pc" });
}

/**
 * Create one item on an actor from one Hero Designer element.
 *
 * @param {HeroSystem6eActor} actor Fixture actor that owns the item.
 * @param {string} xml One Hero Designer element, verbatim from an export.
 * @returns {Promise<HeroSystem6eItem>} The created item.
 * @throws {Error} When Foundry creates no item.
 */
async function createFixtureItem(actor, xml) {
    const item = await HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(xml, actor), { parent: actor });

    if (!item) {
        throw new Error(`Fixture created no item from ${xml.slice(0, 80)}`);
    }

    return item;
}

/**
 * Names of the purchased-defense level fields the item's data carries.
 *
 * Presence, not value: an export writes `PDLEVELS="0"` for a defense nobody bought. Listed here rather
 * than read from the getter so a case can fail when the getter and the rule part company. FDLEVELS and
 * the barrier geometry fields are absent on purpose, for the reasons in the getter's comment.
 *
 * @param {HeroSystem6eItem} item Item to inspect.
 * @returns {string[]} Field names present in the stored data.
 */
function defenseLevelFields(item) {
    const data = item.system.toObject(false);
    return ["PDLEVELS", "EDLEVELS", "MDLEVELS", "FDLEVELS", "POWDLEVELS"].filter((key) => data[key] !== undefined);
}

/**
 * Edit one cell of an item sheet and report both halves of the contract.
 *
 * @param {HeroSystem6eItem} item Item whose sheet renders.
 * @param {object} options Cell options.
 * @param {string} options.name The cell's `name` attribute, for example `system.LEVELS`.
 * @param {number|string} options.value Value to commit.
 * @param {(item: HeroSystem6eItem) => unknown} options.read Reads the field the cell writes.
 * @returns {Promise<{disabled: boolean, title: string, drawnValue: string, stored: unknown}>} What the
 *     cell drew, what it says about itself, and what the item holds once the write settles.
 * @throws {Error} When the sheet renders no such cell.
 */
async function editItemSheetCell(item, { name, value, read }) {
    const sheet = item.sheet;
    await sheet.render({ force: true });

    try {
        const input = findCell(sheet, name, item);

        const { disabled, title } = input;
        const { value: drawnValue } = input;

        input.value = String(value);
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await waitUntil(() => read(item) === value, WRITE_SETTLE_MS);

        return { disabled, title, drawnValue, stored: read(item) };
    } finally {
        await sheet.close();
    }
}

/**
 * Find one cell of a rendered sheet.
 *
 * @param {object} sheet Rendered item sheet.
 * @param {string} name `name` attribute the cell carries.
 * @param {HeroSystem6eItem} item Item the sheet belongs to, for the error text.
 * @returns {HTMLInputElement} The cell.
 * @throws {Error} When the sheet renders no such cell.
 */
function findCell(sheet, name, item) {
    const input = sheet.element.querySelector(`input[name="${name}"]`);

    if (!input) {
        throw new Error(`No cell named "${name}" rendered for ${item.name} (${item.type}/${item.system.XMLID})`);
    }

    return input;
}

/**
 * Type into cells in order, wait for each write to land, then report what one further cell drew.
 *
 * An edited cell answers whether its write happened. The read cell answers whether the document kept a
 * derived field in step, which is the half a player actually reads. Order matters where a case builds a
 * shape the export does not carry: length first, defense second, then the total.
 *
 * @param {HeroSystem6eItem} item Item whose sheet renders.
 * @param {object} options Cell options.
 * @param {Array<object>} options.edits Cells to edit in order.
 * @param {string} options.edits[].name `name` attribute of the cell to edit.
 * @param {number|string} options.edits[].text Text to commit.
 * @param {(item: HeroSystem6eItem) => boolean} options.edits[].landed Reports whether that write reached
 *     the document.
 * @param {(item: HeroSystem6eItem) => unknown} [options.readDerived] Reads the field the document derives,
 *     so a case can see it after every edit rather than only after the last one.
 * @param {string} options.thenRead `name` attribute of the cell to read once every write has settled.
 * @returns {Promise<{edits: Array<{name: string, written: boolean, disabled: boolean, derived: unknown}>,
 *     drawn: {value: string, disabled: boolean, title: string}}>} What each edit did, the derived value
 *     after it, and the text the read cell drew at the end.
 */
async function editCellsThenReadCell(item, { edits, readDerived, thenRead }) {
    const sheet = item.sheet;

    try {
        const done = [];

        for (const { name, text, landed } of edits) {
            await sheet.render({ force: true });

            const input = findCell(sheet, name, item);
            const { disabled } = input;

            input.value = String(text);
            input.dispatchEvent(new Event("change", { bubbles: true }));
            const written = await waitUntil(() => landed(item), WRITE_SETTLE_MS);

            done.push({ name, written, disabled, derived: readDerived ? readDerived(item) : undefined });
        }

        await sheet.render({ force: true });

        const reader = findCell(sheet, thenRead, item);

        return { edits: done, drawn: { value: reader.value, disabled: reader.disabled, title: reader.title } };
    } finally {
        await sheet.close();
    }
}

/**
 * Register the item sheet suite.
 *
 * @param {object} quench The Quench instance.
 */
export function registerItemSheetTests(quench) {
    quench.registerBatch(
        `${game.system.id}.item.sheet`,
        (context) => {
            const { afterEach, describe, expect, it } = context;

            describe("Item sheet", function () {
                /** Actor holding this case's fixture item. */
                let actor = null;

                afterEach(async function () {
                    if (actor) {
                        await deleteQuenchActor({ quench: this, actor });
                        actor = null;
                    }
                });

                /**
                 * The lock rule itself, read off data rather than through a sheet. One case per field name, not
                 * one case per power: a fixture that carries all four fields at once hides a name dropped from
                 * the rule, because the three that remain still answer true. Drop POWDLEVELS from the getter and
                 * only its own case fails.
                 *
                 * Each case uses the export's own zero, `PDLEVELS="0"`, which is the shape that separates a
                 * presence rule from a truth rule. A sheet case cannot reach it without editing the fixture
                 * after import, which would test the edit rather than the rule.
                 */
                describe("LEVELS lock rule", function () {
                    /**
                     * The five level fields that carry a purchased defense, with the powers whose Hero Designer
                     * template exports each. Armor exports two, Damage Reduction five, and Force Field and
                     * Barrier four apiece. One case per field, holding it at the zero its own field type stores:
                     * FDLEVELS is a StringField where the others are numbers, so its zero is the string "0".
                     * A name dropped from the rule, or read as a number, fails that field's case alone.
                     */
                    const DEFENSE_LEVEL_FIELDS = [
                        { field: "PDLEVELS", zero: 0, powers: "ARMOR, DAMAGERESISTANCE, FORCEFIELD, FORCEWALL" },
                        { field: "EDLEVELS", zero: 0, powers: "ARMOR, DAMAGERESISTANCE, FORCEFIELD, FORCEWALL" },
                        { field: "MDLEVELS", zero: 0, powers: "DAMAGERESISTANCE, FORCEFIELD, FORCEWALL" },
                        { field: "FDLEVELS", zero: "0", powers: "DAMAGERESISTANCE only" },
                        { field: "POWDLEVELS", zero: 0, powers: "DAMAGERESISTANCE, FORCEFIELD, FORCEWALL" },
                    ];

                    const DATA_CASES = DEFENSE_LEVEL_FIELDS.map(({ field, zero, powers }) => ({
                        label: `carries ${field} alone at its stored zero: LEVELS totals the defense (${powers})`,
                        data: { [field]: zero },
                        total: true,
                    }));

                    for (const dataCase of DATA_CASES) {
                        it(dataCase.label, function () {
                            const model = new HeroSystem6eItemPower(dataCase.data, { label: "power" });

                            expect(
                                !!model.levelsTotalPurchasedDefenses,
                                `${dataCase.label}: the rule answered ${!!model.levelsTotalPurchasedDefenses}`,
                            ).to.equal(dataCase.total);
                        });
                    }
                });

                describe("LEVELS cell", function () {
                    /**
                     * One shape of item the LEVELS cell must serve. `xml` is Hero Designer's own element, so
                     * the drawn LEVELS and the level fields are whatever that export carries. `newLevels` is
                     * the edit a player would commit. `edits` states the rule for that shape: true where
                     * LEVELS is a purchase, false where LEVELS totals the defense-type levels.
                     */
                    const SHAPES = [
                        {
                            label: "plain power (6e Blast): LEVELS is the damage purchased",
                            is5e: false,
                            xml: BLAST_6E_XML,
                            newLevels: 8,
                            edits: true,
                        },
                        {
                            label: "defense power sized by LEVELS (6e Mental Defense): LEVELS is the MD purchased",
                            is5e: false,
                            xml: MENTAL_DEFENSE_6E_XML,
                            newLevels: 10,
                            edits: true,
                        },
                        {
                            label: "resistant protection (6e): LEVELS totals PD, ED, MD and POWD",
                            is5e: false,
                            xml: RESISTANT_PROTECTION_6E_XML,
                            newLevels: 10,
                            edits: false,
                        },
                        {
                            label: "barrier (6e): LEVELS totals PD, ED, MD and POWD",
                            is5e: false,
                            xml: BARRIER_6E_XML,
                            newLevels: 8,
                            edits: false,
                        },
                        {
                            label: "armor (5e): LEVELS totals PD and ED",
                            is5e: true,
                            xml: ARMOR_5E_XML,
                            newLevels: 12,
                            edits: false,
                        },
                        {
                            // The power's size lives in its two modifiers and its LEVELS costs nothing, so the
                            // cell holds dead data. Whether it should render at all is a display question; the
                            // rule here only says LEVELS is not a defense total, so it is not locked.
                            label: "sense power sized elsewhere (5e Invisibility): LEVELS is no defense total",
                            is5e: true,
                            xml: INVISIBILITY_5E_XML,
                            newLevels: 3,
                            edits: true,
                        },
                        {
                            label: "damage resistance (5e): LEVELS totals PD, ED, MD, FD and POWD",
                            is5e: true,
                            xml: DAMAGE_RESISTANCE_5E_XML,
                            newLevels: 6,
                            edits: false,
                        },
                    ];

                    for (const shape of SHAPES) {
                        it(`${shape.label}`, async function () {
                            actor = await createFixtureActor(this, shape.is5e);
                            const item = await createFixtureItem(actor, shape.xml);

                            const { disabled, title, drawnValue, stored } = await editItemSheetCell(item, {
                                name: "system.LEVELS",
                                value: shape.newLevels,
                                read: (levelsItem) => levelsItem.system.LEVELS,
                            });

                            if (shape.edits) {
                                expect(
                                    disabled,
                                    `${shape.label}: the sheet draws the LEVELS cell disabled, so no player ` +
                                        `edit can reach it (drawn value ${drawnValue})`,
                                ).to.equal(false);

                                expect(stored, `${shape.label}: committed edit did not reach system.LEVELS`).to.equal(
                                    shape.newLevels,
                                );
                                return;
                            }

                            // A locked cell must say what to edit instead, or a player reads a broken field.
                            expect(
                                disabled,
                                `${shape.label}: LEVELS totals the defense-type levels here, so the cell ` +
                                    `should be locked (drawn value ${drawnValue})`,
                            ).to.equal(true);

                            expect(title, `${shape.label}: locked cell gives no reason to the player`).to.contain(
                                "totals",
                            );

                            expect(
                                defenseLevelFields(item),
                                `${shape.label}: fixture holds no defense-type level field, so it does not ` +
                                    `test the rule it claims`,
                            ).to.not.be.empty;
                        });
                    }
                });

                /**
                 * A locked LEVELS cell is only honest while the document keeps the total in step. These cases
                 * edit one defense field through the sheet and read the total back from the document and from
                 * the cell, so a derivation that never ran, or ran over the wrong field list, fails here.
                 *
                 * Each expected value is a literal, added by hand from the levels the fixture carries, and the
                 * cost expectation comes from the power's own rate in `config.mjs`. Neither is computed with
                 * the code under test.
                 */
                describe("LEVELS total after a defense-level edit", function () {
                    it("PDLEVELS 10 to 13 on top of rED 11 totals 24 and costs 24", async function () {
                        actor = await createFixtureActor(this, true);
                        const item = await createFixtureItem(actor, FORCE_FIELD_5E_XML);

                        const { edits, drawn } = await editCellsThenReadCell(item, {
                            edits: [
                                {
                                    name: "system.PDLEVELS",
                                    text: 13,
                                    landed: (editedItem) => editedItem.system.PDLEVELS === 13,
                                },
                            ],
                            readDerived: (editedItem) => editedItem.system.LEVELS,
                            thenRead: "system.LEVELS",
                        });

                        expect(
                            edits[0].written,
                            "the rPD edit never reached the document, so nothing could total it",
                        ).to.equal(true);
                        expect(edits[0].disabled, "a locked rPD cell takes no player edit").to.equal(false);

                        expect(edits[0].derived, "13 rPD plus 11 rED plus 0 MD plus 0 POWD is 24").to.equal(24);
                        expect(drawn.value, "the LEVELS cell still drew the imported total").to.equal("24");
                        expect(drawn.disabled, "the total is not a cell a player types into").to.equal(true);

                        // 5e Force Field costs 1 CP per level (`config.mjs`, FORCEFIELD 5e variant).
                        expect(
                            item.realCost,
                            "24 levels at 1 CP each costs 24, not the 21 the export carried",
                        ).to.equal(24);
                    });

                    it("flash defense joins the total on Damage Resistance", async function () {
                        actor = await createFixtureActor(this, true);
                        const item = await createFixtureItem(actor, DAMAGE_RESISTANCE_5E_XML);

                        const { edits, drawn } = await editCellsThenReadCell(item, {
                            edits: [
                                {
                                    name: "system.FDLEVELS",
                                    text: 3,
                                    landed: (editedItem) => Number(editedItem.system.FDLEVELS) === 3,
                                },
                            ],
                            readDerived: (editedItem) => editedItem.system.LEVELS,
                            thenRead: "system.LEVELS",
                        });

                        expect(edits[0].written, "the FDLEVELS cell wrote nothing").to.equal(true);
                        expect(
                            edits[0].disabled,
                            "FDLEVELS is a purchase the player owns, so the cell is open",
                        ).to.equal(false);

                        // FDLEVELS is a StringField, so the total has to convert its text before adding it.
                        expect(edits[0].derived, "3 levels of flash defense is a total of 3").to.equal(3);
                        expect(drawn.value, "the LEVELS cell ignored the flash defense level").to.equal("3");
                    });

                    it("barrier length stays out of the total, before and after a defense edit", async function () {
                        actor = await createFixtureActor(this, false);
                        const item = await createFixtureItem(actor, BARRIER_6E_XML);

                        const { edits, drawn } = await editCellsThenReadCell(item, {
                            edits: [
                                {
                                    name: "system.LENGTHLEVELS",
                                    text: 4,
                                    landed: (editedItem) => Number(editedItem.system.LENGTHLEVELS) === 4,
                                },
                                {
                                    name: "system.PDLEVELS",
                                    text: 2,
                                    landed: (editedItem) => editedItem.system.PDLEVELS === 2,
                                },
                            ],
                            readDerived: (editedItem) => editedItem.system.LEVELS,
                            thenRead: "system.LEVELS",
                        });

                        expect(
                            edits.map((edit) => [edit.name, edit.written, edit.disabled]),
                            "neither barrier cell took its edit, so the case tested nothing",
                        ).to.deep.equal([
                            ["system.LENGTHLEVELS", true, false],
                            ["system.PDLEVELS", true, false],
                        ]);

                        // Length alone must not move the total. `FORCEWALL.cost()` adds it on top of LEVELS.
                        expect(edits[0].derived, "4 m of barrier buys size, not defense, so LEVELS stays 0").to.equal(
                            0,
                        );

                        // And once a defense level does move the total, the length the barrier also holds must
                        // stay out of the addition.
                        expect(edits[1].derived, "2 rPD totals 2, not 6 with the 4 m of length added in").to.equal(2);
                        expect(drawn.value, "the LEVELS cell drew something other than the rPD total").to.equal("2");
                    });
                });
            });
        },
        { displayName: "HERO: Item Sheet" },
    );
}
