import { _startIfIsAContinuingCharge, HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo } from "../utility/util.mjs";

const { Actor } = foundry.documents;

/**
 * Registers tests for item-owned ActiveEffect lifecycle plumbing: effect
 * changes and durations must land in the document schema (`system.changes`,
 * `duration.units/value`, `start.time`) for updates to take effect.
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
            });
        },
        { displayName: "HERO: Item ActiveEffect Sync" },
    );
}
