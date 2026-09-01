import { _startIfIsAContinuingCharge, HeroSystem6eItem } from "../item/item.mjs";
import { activeEffectChanges } from "../utility/active-effects.mjs";
import { getPowerInfo } from "../utility/util.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

const { Actor } = foundry.documents;

/**
 * Value an effect contributes to a characteristic's max.
 * @param {ActiveEffect} effect
 * @param {string} characteristic - lower case characteristic key, e.g. "str"
 * @returns {*} The change's value, or undefined when the effect does not touch it.
 */
function effectChangeValue(effect, characteristic) {
    return activeEffectChanges(effect).find((change) => change.key === `system.characteristics.${characteristic}.max`)
        ?.value;
}

/**
 * Effects an item owns, keyed by the identity setActiveEffects uses to decide
 * between updating an existing effect and creating a new one.
 * @param {Item} item
 * @returns {Map<string, ActiveEffect[]>}
 */
function effectsByIdentity(item) {
    const byIdentity = new Map();
    for (const effect of item.effects) {
        const identity = `${effect.origin ?? item.uuid}/${effect.system?.XMLID ?? effect.name}`;
        byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), effect]);
    }
    return byIdentity;
}

/**
 * Human readable list of every effect identity an item carries more than once.
 * @param {Actor} actor
 * @returns {string[]}
 */
function duplicateEffectIdentities(actor) {
    const duplicates = [];
    for (const item of actor.items) {
        for (const [identity, effects] of effectsByIdentity(item)) {
            if (effects.length > 1) {
                duplicates.push(`${item.name}: ${effects.length} x ${identity}`);
            }
        }
    }
    return duplicates;
}

/**
 * Registers tests for item-owned ActiveEffect lifecycle plumbing: effect
 * changes and durations must land in the document schema (`system.changes`,
 * `duration.units/value`, `start.time`) for updates to take effect, and the
 * find-then-create passes that maintain them must never race into duplicates.
 *
 * @param {Object} quench - The external Quench module testing framework instance.
 */
export function registerActiveEffectTests(quench) {
    quench.registerBatch(
        `${game.system.id}.activeEffects`,
        (context) => {
            const { describe, it, assert, before, after } = context;

            describe("Item ActiveEffect Sync", function () {
                let testActor = null;

                before(async () => {
                    testActor = await Actor.create({
                        name: "_Quench AE Sync",
                        type: "pc",
                        system: { is5e: false },
                    });
                });

                after(async () => {
                    await testActor?.delete();
                    testActor = null;
                });

                it("Should update a movement power's existing effect through system.changes when LEVELS change", async function () {
                    const powerInfo = getPowerInfo({ xmlid: "FLIGHT", actor: testActor, xmlTag: "POWER" });
                    const itemData = foundry.utils.mergeObject(
                        HeroSystem6eItem.itemDataFromXml(powerInfo.xml, testActor),
                        { system: { LEVELS: 10 } },
                    );
                    const [item] = await testActor.createEmbeddedDocuments("Item", [itemData]);

                    // Idempotent: guarantees the movement effect exists whether or not
                    // the creation hooks already built it
                    await item.setActiveEffects();
                    const flightAe = () =>
                        item.effects.find((ae) => ae.system.XMLID === "FLIGHT") ?? item.effects.contents[0];
                    const flightChange = () =>
                        flightAe()?.system.changes.find((c) => c.key === "system.characteristics.flight.max");

                    assert.ok(flightAe(), "Movement effect created for the FLIGHT power.");
                    assert.strictEqual(
                        parseInt(flightChange()?.value),
                        10,
                        "Effect change carries the initial LEVELS.",
                    );
                    assert.strictEqual(
                        parseInt(testActor.system.characteristics.flight.max),
                        10,
                        "Actor flight max reflects the transferred effect.",
                    );

                    // Re-syncing after a LEVELS change hits the UPDATE branch of
                    // setActiveEffects — the path that must write system.changes
                    await item.update({ "system.LEVELS": 15 });
                    await item.setActiveEffects();

                    assert.strictEqual(
                        parseInt(flightChange()?.value),
                        15,
                        "Existing effect's system.changes updated to the new LEVELS.",
                    );
                    assert.strictEqual(
                        parseInt(testActor.system.characteristics.flight.max),
                        15,
                        "Actor flight max follows the updated effect.",
                    );
                });

                it("Should start a continuing charge by writing V14 duration and start fields", async function () {
                    // 3 Continuing (1 Turn) Charges: CONTINUING is an ADDER inside the
                    // CHARGES modifier, found via findModsByXmlid's recursion
                    const chargeXml = `
                        <POWER XMLID="ENERGYBLAST" ID="1000000000001" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Continuing Blast" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="CHARGES" ID="1000000000002" BASECOST="-1.25" LEVELS="0" ALIAS="Charges" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="THREE" OPTIONID="THREE" OPTION_ALIAS="3" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                                <ADDER XMLID="CONTINUING" ID="1000000000003" BASECOST="0.5" LEVELS="0" ALIAS="Continuing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="1 Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                            </MODIFIER>
                        </POWER>
                    `;
                    const [item] = await testActor.createEmbeddedDocuments("Item", [
                        HeroSystem6eItem.itemDataFromXml(chargeXml, testActor),
                    ]);
                    assert.ok(item.findModsByXmlid("CHARGES"), "Item carries the CHARGES modifier.");
                    assert.strictEqual(
                        item.findModsByXmlid("CONTINUING")?.OPTIONID,
                        "TURN",
                        "CONTINUING adder found through the modifier recursion.",
                    );

                    // The charge tracker uses the item's first effect; give it one the
                    // way activation does when none was built by the power itself
                    const [ae] = await item.createEmbeddedDocuments("ActiveEffect", [
                        { name: "_Quench Continuing Charge", img: "icons/svg/clockwork.svg" },
                    ]);

                    await _startIfIsAContinuingCharge(item);

                    const started = item.effects.get(ae.id);
                    assert.strictEqual(started._source.duration.units, "seconds", "Duration units written.");
                    assert.strictEqual(parseInt(started._source.duration.value), 12, "1 Turn charge lasts 12 seconds.");
                    assert.strictEqual(
                        started._source.start.time,
                        game.time.worldTime,
                        "Effect start anchored to the current world time.",
                    );
                    assert.strictEqual(
                        started.updateDuration().remaining,
                        12,
                        "Charge effect now counts down instead of lasting forever.",
                    );
                });

                it("Should keep a single effect when an effect-bearing power's LEVELS change", async function () {
                    const powerInfo = getPowerInfo({ xmlid: "DENSITYINCREASE", actor: testActor, xmlTag: "POWER" });
                    const itemData = foundry.utils.mergeObject(
                        HeroSystem6eItem.itemDataFromXml(powerInfo.xml, testActor),
                        { system: { LEVELS: 2 } },
                    );
                    const [item] = await testActor.createEmbeddedDocuments("Item", [itemData]);

                    await item.setActiveEffects();
                    assert.strictEqual(item.effects.size, 1, "One effect for the newly created power.");

                    // DENSITYINCREASE adds 5 STR per level
                    const strAdd = () => parseInt(effectChangeValue(item.effects.contents[0], "str"));
                    assert.strictEqual(strAdd(), 10, "Effect change carries the initial LEVELS.");

                    // The update re-enters setActiveEffects from _preUpdate; that pass must
                    // finish before the update commits or it races itself into a second effect
                    await item.update({ "system.LEVELS": 4 });

                    assert.strictEqual(item.effects.size, 1, "Changing LEVELS did not add a second effect.");
                    assert.strictEqual(strAdd(), 20, "The one effect was updated in place.");
                    assert.deepEqual(
                        duplicateEffectIdentities(testActor),
                        [],
                        "No item on the actor carries the same effect twice.",
                    );
                });
            });

            describe("Upload ActiveEffect Duplication", function () {
                // Uploads create and update many items in quick succession
                setQuenchTimeout(this);

                // Covers all three find-then-create branches of setActiveEffects: the
                // generic CONFIG effect (DENSITYINCREASE), movement (FLIGHT) and senses
                // (NIGHTVISION).
                const contents = `
                    <?xml version="1.0" encoding="UTF-16"?>
                    <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic6E.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="TEST 6e AE Duplication" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <STR XMLID="STR" ID="1780000000001" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1780000000002" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1780000000003" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1780000000004" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1780000000005" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1780000000006" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1780000000007" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <PD XMLID="PD" ID="1780000000008" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1780000000009" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1780000000010" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1780000000011" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1780000000012" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1780000000013" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1780000000014" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1780000000015" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1780000000016" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <POWER XMLID="DENSITYINCREASE" ID="1780000000101" BASECOST="0.0" LEVELS="3" ALIAS="Density Increase" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                            <POWER XMLID="FLIGHT" ID="1780000000102" BASECOST="0.0" LEVELS="10" ALIAS="Flight" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                            <POWER XMLID="NIGHTVISION" ID="1780000000103" BASECOST="5.0" LEVELS="0" ALIAS="Nightvision" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="SIGHTGROUP">
                                <NOTES />
                            </POWER>
                        </POWERS>
                        <DISADVANTAGES />
                        <EQUIPMENT />
                    </CHARACTER>
                `;

                let actor;

                before(async function () {
                    actor = await createQuenchActor({ quench: this, contents, is5e: false });

                    // Re-uploading the same file updates existing items instead of creating them —
                    // the path where the per-item sync overlaps the upload's own sweep
                    await actor.uploadFromXml(
                        contents.replace(/CHARACTER_NAME=".*?"/, `CHARACTER_NAME="${actor.name}"`),
                        { quenchUpload: true },
                    );
                });

                after(async function () {
                    await deleteQuenchActor({ quench: this, actor });
                });

                it("should give each effect-bearing power exactly one effect", function () {
                    for (const xmlid of ["DENSITYINCREASE", "FLIGHT", "NIGHTVISION"]) {
                        const item = actor.items.find((i) => i.system.XMLID === xmlid);
                        assert.ok(item, `${xmlid} survived the re-upload.`);
                        assert.strictEqual(item.effects.size, 1, `${xmlid} has a single effect.`);
                    }
                });

                it("should not leave duplicate effects on any item", function () {
                    assert.deepEqual(
                        duplicateEffectIdentities(actor),
                        [],
                        "No item carries the same effect identity twice.",
                    );
                });
            });
        },
        { displayName: "HERO: Item ActiveEffect Sync" },
    );
}
