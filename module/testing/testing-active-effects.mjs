import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo } from "../utility/util.mjs";

const { Actor } = foundry.documents;

/**
 * Registers tests for item-owned ActiveEffect lifecycle plumbing: the
 * setActiveEffects update branch must write V14 `system.changes` (a bare
 * `changes` key is pruned by schema cleaning on update, silently stranding the
 * effect at its old value).
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
            });
        },
        { displayName: "HERO: Item ActiveEffect Sync" },
    );
}
