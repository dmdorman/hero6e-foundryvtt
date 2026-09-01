import { HeroSystem6eItem } from "../item/item.mjs";
import { roundFavorPlayerAwayFromZero } from "../utility/round.mjs";
import { performAdjustment } from "../actor/actor-adjustment.mjs";

const { Actor } = foundry.documents;

/**
 * Registers 5e Calculated Active Effect Automation Tests with Quench.
 * Validates baseline ratios and dynamic buffs while enforcing 5e non-cascading rules.
 * @param {object} quench - The Quench test runner instance injected by the system loader.
 */
export function register5eCalculatedActiveEffectAutomationTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.5eCalculatedActiveEffects`,
        (context) => {
            const { after, describe, it, assert } = context;
            const waitForHook = (hookName) =>
                new Promise((resolve) => Hooks.once(hookName, (...args) => resolve(args)));

            const actorTypes = Actor.TYPES.filter((t) => t !== "base");
            const createdActorIds = [];
            const create5eActor = async (name) => {
                const createHook = waitForHook("createActor");
                const initialActor = await Actor.create({
                    name,
                    type: "pc",
                    system: { is5e: true },
                });
                await createHook;
                createdActorIds.push(initialActor.id);

                const actor = game.actors.get(initialActor.id);
                assert.ok(!!actor, `[${name}] Failed to fetch instantiated actor record.`);
                return actor;
            };

            const createAdjustmentEffect = async (actor, { adjustmentActivePoints = 0, flags = {}, ...effectData }) => {
                const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
                    {
                        ...effectData,
                        flags: {
                            ...flags,
                            [game.system.id]: {
                                ...(flags[game.system.id] ?? {}),
                                type: "adjustment",
                                adjustmentActivePoints,
                            },
                        },
                    },
                ]);
                return effect;
            };
            const addAdjustmentEffect = async (actor, effectData) => {
                await createAdjustmentEffect(actor, effectData);
                return actor.system.characteristics;
            };

            // Real adjustment items driven through performAdjustment (the production attack/fade flow),
            // as opposed to the bare ActiveEffects above which only exercise the derived-data layer.
            const createAdjustmentItem = async (actor, { xmlid, input, levels }) => {
                const xml = `
                    <POWER XMLID="${xmlid}" ID="17661${Math.floor(Math.random() * 100000000)}" BASECOST="0.0" LEVELS="${levels}" ALIAS="${xmlid}" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="${xmlid} ${input}" INPUT="${input}" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    </POWER>
                `;
                return HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(xml, actor), { parent: actor });
            };
            const applyAdjustment = (attackItem, characteristic, activePoints, targetActor) =>
                performAdjustment(attackItem, characteristic, activePoints, "", "", false, targetActor, null);
            // Mirrors expireEffects: AID fades -5 AP per turn, DRAIN returns +5.
            const fadeAdjustment = (attackItem, characteristic, effect) => {
                const fade = effect.flags[game.system.id].adjustmentActivePoints >= 0 ? -5 : 5;
                return performAdjustment(
                    attackItem,
                    characteristic,
                    fade,
                    "None - Effect Fade",
                    "",
                    true,
                    effect.parent,
                    null,
                    effect,
                );
            };
            const findAdjustmentEffect = (actor) =>
                actor.effects.find((e) => e.flags[game.system.id]?.type === "adjustment");

            // 5ER p. 9-10: CV = DEX/3; 5ER p. 37: CV is 0 at DEX 1 or less.
            const expectedOcvFromDex = (dex) => roundFavorPlayerAwayFromZero(Math.max(0, dex) / 3);
            describe("Hero System 5e Calculated and Figured Characteristics State Machine", function () {
                // Multi-client database sweep block to guarantee multi-client parity
                after(async function () {
                    for (const actorId of createdActorIds) {
                        const actor = game.actors.get(actorId);
                        if (actor) {
                            const deleteHook = waitForHook("deleteActor");
                            await actor.delete();
                            await deleteHook;
                        }
                    }
                });

                for (const targetType of actorTypes) {
                    describe(`Actor Type Matrix: [${targetType}]`, function () {
                        it(`Validates Baseline and Buffs for ${targetType}`, async function () {
                            // 1. Structural Validation via Exhaustive Switch Catch-All
                            switch (targetType) {
                                case "pc":
                                case "npc":
                                case "vehicle":
                                case "automaton":
                                    break;
                                case "base2":
                                case "computer":
                                case "ai":
                                    break;
                                default:
                                    assert.fail(`Undocumented actor type detected: ${targetType}`);
                            }

                            // 2. Database Record Instantiation
                            const createHook = waitForHook("createActor");
                            const initialActor = await Actor.create({
                                name: `_Quench_5e_${targetType}_Tester`,
                                type: targetType,
                                system: { is5e: true },
                            });
                            await createHook;
                            createdActorIds.push(initialActor.id);

                            const qActor = game.actors.get(initialActor.id);
                            assert.ok(!!qActor, `[${targetType}] Failed to fetch instantiated actor record.`);

                            // 3. Absence vs Boundary Node Inspection (Safety check for intangibles)
                            if (!qActor.hasCharacteristic("ocv")) {
                                assert.isFalse(
                                    targetType === "pc" || targetType === "npc",
                                    `[${targetType}] Missing OCV characteristic node.`,
                                );
                                return;
                            }

                            const isIntangibleType = ["computer", "ai"].includes(targetType);

                            // Step 1: Verify Initial 5e Baseline Starting Values
                            for (const key of ["ocv", "spd", "rec", "stun"]) {
                                if (qActor.hasCharacteristic(key)) {
                                    const liveNode = qActor.system.characteristics[key];
                                    const isPurePhysicalTrait = ["rec", "stun"].includes(key);

                                    if (isIntangibleType && isPurePhysicalTrait) {
                                        assert.equal(
                                            liveNode.max,
                                            0,
                                            `[${targetType}] Intangible should override physical ${key.toUpperCase()} max to 0.`,
                                        );
                                    } else {
                                        const finalMax =
                                            liveNode.max === 0 && liveNode.base > 0 ? liveNode.base : liveNode.max;
                                        assert.equal(
                                            finalMax,
                                            liveNode.base,
                                            `[${targetType}] Baseline ${key.toUpperCase()} should match schema configuration.`,
                                        );
                                    }
                                }
                            }

                            if (isIntangibleType) return;

                            // Step 2: Add Positive ActiveEffect and Validate Upward Recalculations
                            await qActor.createEmbeddedDocuments("ActiveEffect", [
                                {
                                    name: "Buff Primaries",
                                    changes: [
                                        {
                                            key: "system.characteristics.str.max",
                                            value: "10",
                                            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                        },
                                        {
                                            key: "system.characteristics.dex.max",
                                            value: "10",
                                            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                        },
                                    ],
                                },
                            ]);

                            // createEmbeddedDocuments already reset and re-prepared the actor. Do NOT
                            // call prepareData() here: without a reset() it re-applies active effects
                            // on top of already-applied data (dex.max 10 -> 20 -> 30).
                            const buffedChars = qActor.system.characteristics;

                            assert.isAbove(
                                buffedChars.dex.max,
                                buffedChars.dex.base,
                                `[${targetType}] Active effect failed to modify DEX max proxy.`,
                            );

                            const effectiveSourceValue = (key) =>
                                Math.max(Number(buffedChars[key]?.value ?? 0), Number(buffedChars[key]?.max ?? 0));
                            const dexSourceValue = effectiveSourceValue("dex");
                            const strSourceValue = effectiveSourceValue("str");

                            const expectedOcv = roundFavorPlayerAwayFromZero(Math.max(0, dexSourceValue) / 3);
                            const expectedPd =
                                roundFavorPlayerAwayFromZero(strSourceValue / 5) +
                                qActor.getCharacteristic("str").baseSumFiguredCharacteristicsFromItems(5) +
                                (qActor.system.PD?.LEVELS ?? 0);

                            assert.equal(
                                buffedChars.ocv.max,
                                expectedOcv,
                                `[${targetType}] Calculated OCV calculation ratio mismatch.`,
                            );
                            assert.equal(
                                buffedChars.pd.max,
                                expectedPd,
                                `[${targetType}] Figured PD calculation ratio mismatch.`,
                            );
                            if (qActor.hasCharacteristic("spd")) {
                                const expectedSpd = Math.floor(
                                    1 +
                                        Number((dexSourceValue / 10).toFixed(1)) +
                                        Number(
                                            qActor
                                                .getCharacteristic("dex")
                                                .baseSumFiguredCharacteristicsNoRoundingFromItems(10)
                                                .toFixed(1),
                                        ) +
                                        (qActor.system.SPD?.LEVELS ?? 0),
                                );
                                assert.equal(
                                    buffedChars.spd.max,
                                    expectedSpd,
                                    `[${targetType}] Figured SPD calculation ratio mismatch.`,
                                );
                            }
                            if (qActor.hasCharacteristic("rec")) {
                                const conSourceValue = effectiveSourceValue("con");
                                const expectedRec =
                                    roundFavorPlayerAwayFromZero(strSourceValue / 5) +
                                    qActor.getCharacteristic("str").baseSumFiguredCharacteristicsFromItems(5) +
                                    roundFavorPlayerAwayFromZero(conSourceValue / 5) +
                                    qActor.getCharacteristic("con").baseSumFiguredCharacteristicsFromItems(5) +
                                    (qActor.system.REC?.LEVELS ?? 0);
                                assert.equal(
                                    buffedChars.rec.max,
                                    expectedRec,
                                    `[${targetType}] Figured REC calculation ratio mismatch.`,
                                );
                            }

                            const buffEffect = qActor.effects.find((e) => e.name === "Buff Primaries");
                            if (buffEffect) {
                                await buffEffect.delete();
                            }

                            // Step 3: Add Negative ActiveEffect and Validate Raw Tracking Sink (Allowing Negative States)
                            await qActor.createEmbeddedDocuments("ActiveEffect", [
                                {
                                    name: "Massive Characteristic Drain",
                                    changes: [
                                        {
                                            key: "system.characteristics.str.max",
                                            value: "-40",
                                            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                        },
                                        {
                                            key: "system.characteristics.dex.max",
                                            value: "-30",
                                            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                        },
                                    ],
                                },
                            ]);

                            // See above: no manual prepareData() — the embedded create already re-prepared.
                            const drainedChars = qActor.system.characteristics;

                            // 1. Primary Characteristics Verification
                            // Primary stats (like DEX) MUST drop below zero cleanly to map adjustment decay fading values.
                            assert.isBelow(
                                drainedChars.dex.max,
                                0,
                                `[${targetType}] Primary metric DEX should drop below zero cleanly to map adjustment decay.`,
                            );

                            // 2. Dependent Verification. This is a generic (non-adjustment) effect,
                            // so it behaves like the characteristic actually being lower (a
                            // transformation, 5ER p. 139-40) and cascades to dependents:
                            // - CV follows the lowered DEX; at DEX 1 or less CV is 0 (5ER p. 37).
                            // - Figured characteristics recompute, but a negative primary adds zero
                            //   rather than subtracting (5ER p. 33), so PD floors at 0 + purchases.
                            assert.equal(
                                drainedChars.ocv.max,
                                0,
                                `[${targetType}] Calculated OCV should follow DEX lowered below 1 down to the 0 floor.`,
                            );
                            if (qActor.hasCharacteristic("pd")) {
                                const expectedFlooredPd =
                                    qActor.getCharacteristic("str").baseSumFiguredCharacteristicsFromItems(5) +
                                    (qActor.system.PD?.LEVELS ?? 0);
                                assert.equal(
                                    drainedChars.pd.max,
                                    expectedFlooredPd,
                                    `[${targetType}] Figured PD should treat the negative STR as adding zero.`,
                                );
                            }
                        });
                    });
                }

                describe("Focused 5e ActiveEffect dependency boundaries", function () {
                    it("AID DEX raises calculated CV but never figured SPD", async function () {
                        const sourceActor = await create5eActor("_Quench_5e_AID_DEX_Source");
                        const targetActor = await create5eActor("_Quench_5e_AID_DEX_Target");
                        const baselineSpd = targetActor.system.characteristics.spd.max;

                        const chars = await addAdjustmentEffect(targetActor, {
                            name: "AID DEX",
                            origin: sourceActor.uuid,
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        // 5ER p. 105: adjustments to a primary affect abilities calculated from it
                        // (CV = DEX/3) but have no effect on Figured Characteristics (SPD).
                        const dexSource = 20;
                        assert.equal(chars.dex.max, dexSource, "AID DEX should raise the primary max.");
                        assert.equal(chars.ocv.max, expectedOcvFromDex(dexSource), "AID DEX should raise OCV.");
                        assert.equal(chars.dcv.max, expectedOcvFromDex(dexSource), "AID DEX should raise DCV.");
                        assert.equal(chars.spd.max, baselineSpd, "AID DEX should not raise figured SPD.");
                    });

                    it("combined primary and dependent ActiveEffects both apply in one pass", async function () {
                        const actor = await create5eActor("_Quench_5e_Combined_Primary_Dependent_Target");
                        const baselineSpd = actor.system.characteristics.spd.max;

                        const chars = await addAdjustmentEffect(actor, {
                            name: "Combined DEX and DCV adjustment",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                                {
                                    key: "system.characteristics.dcv.max",
                                    value: "-8",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        const dexSource = 20;
                        assert.equal(chars.dex.max, dexSource, "Combined effect should raise DEX.");
                        assert.equal(chars.ocv.max, expectedOcvFromDex(dexSource), "Combined effect should raise OCV.");
                        assert.equal(
                            chars.spd.max,
                            baselineSpd,
                            "Adjustment to DEX should not touch figured SPD (5ER p. 105).",
                        );
                        assert.equal(
                            chars.dcv.max,
                            expectedOcvFromDex(dexSource) - 8,
                            "Combined effect should apply direct DCV after DEX-derived DCV.",
                        );
                    });

                    it("AID STR does not cascade into STR figured dependents", async function () {
                        const actor = await create5eActor("_Quench_5e_AID_STR_Target");
                        const baseline = {
                            pd: actor.system.characteristics.pd.max,
                            rec: actor.system.characteristics.rec.max,
                            stun: actor.system.characteristics.stun.max,
                        };

                        const chars = await addAdjustmentEffect(actor, {
                            name: "AID STR",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "20",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        // Per 5e adjustment rules, AID to a primary does not change its figured
                        // characteristics; only actual purchases (LEVELS) or non-adjustment effects do.
                        assert.equal(chars.str.max, 30, "AID STR should raise the primary max.");
                        assert.equal(chars.pd.max, baseline.pd, "AID STR should not raise PD.");
                        assert.equal(chars.rec.max, baseline.rec, "AID STR should not raise REC.");
                        assert.equal(chars.stun.max, baseline.stun, "AID STR should not raise STUN.");
                    });

                    it("deleting an adjustment clamps the raised current value back to max", async function () {
                        const actor = await create5eActor("_Quench_5e_AID_Delete_Clamp_Target");

                        const effect = await createAdjustmentEffect(actor, {
                            name: "AID STR to delete",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "20",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        // The attack flow raises the current value along with the AID'd max.
                        await actor.update({ "system.characteristics.str.value": 30 });
                        assert.equal(actor.system.characteristics.str.value, 30, "AID STR raised the current value.");

                        // The clamp commits in a follow-up actor update after the deletion.
                        const valueClampHook = waitForHook("updateActor");
                        await effect.delete();
                        await valueClampHook;

                        assert.equal(actor.system.characteristics.str.max, 10, "Deleted AID should restore STR max.");
                        assert.equal(
                            actor.system.characteristics.str.value,
                            10,
                            "Deleted AID should clamp the current value back to max.",
                        );
                    });

                    it("actor-owned adjustment updates and deletes recompute derived values", async function () {
                        const actor = await create5eActor("_Quench_5e_Adjustment_Update_Target");
                        const baselineSpd = actor.system.characteristics.spd.max;

                        const effect = await createAdjustmentEffect(actor, {
                            name: "Scaling AID DEX",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        assert.equal(actor.system.characteristics.dex.max, 20, "Initial AID should raise DEX.");
                        assert.equal(
                            actor.system.characteristics.ocv.max,
                            expectedOcvFromDex(20),
                            "Initial AID should raise OCV.",
                        );
                        assert.equal(
                            actor.system.characteristics.spd.max,
                            baselineSpd,
                            "Adjustment to DEX should not touch figured SPD (5ER p. 105).",
                        );

                        // A bare `changes` update silently no-ops on V14: document changes
                        // live in system.changes with string types.
                        await effect.update({
                            "system.changes": [{ key: "system.characteristics.dex.max", value: "5", type: "add" }],
                            flags: {
                                [game.system.id]: {
                                    ...effect.flags[game.system.id],
                                    adjustmentActivePoints: 15,
                                },
                            },
                        });

                        assert.equal(actor.system.characteristics.dex.max, 15, "Updated AID should reduce DEX bonus.");
                        assert.equal(
                            actor.system.characteristics.ocv.max,
                            expectedOcvFromDex(15),
                            "Updated AID should recompute OCV.",
                        );
                        assert.equal(
                            actor.system.characteristics.spd.max,
                            baselineSpd,
                            "Updated adjustment should still not touch figured SPD.",
                        );

                        await effect.delete();

                        assert.equal(actor.system.characteristics.dex.max, 10, "Deleted AID should restore DEX max.");
                        assert.equal(
                            actor.system.characteristics.ocv.max,
                            expectedOcvFromDex(10),
                            "Deleted AID should restore OCV.",
                        );
                        assert.equal(
                            actor.system.characteristics.spd.max,
                            baselineSpd,
                            "Deleted adjustment should leave figured SPD at baseline.",
                        );
                    });

                    it("DRAIN DEX and STR lowers calculated CV but never figured dependents", async function () {
                        const actor = await create5eActor("_Quench_5e_DRAIN_Primaries_Target");
                        const baseline = {
                            spd: actor.system.characteristics.spd.max,
                            pd: actor.system.characteristics.pd.max,
                        };

                        const chars = await addAdjustmentEffect(actor, {
                            name: "DRAIN STR DEX",
                            adjustmentActivePoints: -60,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "-40",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "-30",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        assert.isBelow(chars.dex.max, 0, "DRAIN DEX should track primary max below zero.");
                        assert.isBelow(chars.str.max, 0, "DRAIN STR should track primary max below zero.");
                        // 5ER p. 105: CV is calculated from the (adjusted) DEX, in both directions;
                        // 5ER p. 37: at DEX 1 or less, CV is 0.
                        assert.equal(chars.ocv.max, 0, "DRAIN DEX below 1 should floor OCV at 0.");
                        assert.equal(chars.dcv.max, 0, "DRAIN DEX below 1 should floor DCV at 0.");
                        // Figured characteristics are never touched by adjustments to their primaries.
                        assert.equal(chars.spd.max, baseline.spd, "DRAIN DEX should not reduce figured SPD.");
                        assert.equal(chars.pd.max, baseline.pd, "DRAIN STR should not reduce figured PD.");
                    });

                    it("TRANSFER-style opposing actor effects aid one actor without cascading the drained actor", async function () {
                        const drainedActor = await create5eActor("_Quench_5e_TRANSFER_Drained");
                        const aidedActor = await create5eActor("_Quench_5e_TRANSFER_Aided");
                        const drainedBaseline = {
                            ocv: drainedActor.system.characteristics.ocv.max,
                            pd: drainedActor.system.characteristics.pd.max,
                        };
                        const aidedBaselinePd = aidedActor.system.characteristics.pd.max;
                        const aidedBaselineSpd = aidedActor.system.characteristics.spd.max;

                        const drainedChars = await addAdjustmentEffect(drainedActor, {
                            name: "TRANSFER drain side",
                            origin: aidedActor.uuid,
                            adjustmentActivePoints: -40,
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "-30",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                                {
                                    key: "system.characteristics.str.max",
                                    value: "-40",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });
                        const aidedChars = await addAdjustmentEffect(aidedActor, {
                            name: "TRANSFER aid side",
                            origin: drainedActor.uuid,
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                                {
                                    key: "system.characteristics.str.max",
                                    value: "20",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        // 5ER p. 105: CV follows the adjusted DEX both directions (0 floor per p. 37);
                        // figured characteristics (SPD/PD) are never touched by primary adjustments.
                        assert.equal(drainedChars.ocv.max, 0, "TRANSFER drain side DEX loss should floor OCV at 0.");
                        assert.equal(
                            drainedChars.pd.max,
                            drainedBaseline.pd,
                            "TRANSFER drain side should not reduce figured PD.",
                        );
                        assert.equal(aidedChars.ocv.max, expectedOcvFromDex(20), "TRANSFER aid side should raise OCV.");
                        assert.equal(
                            aidedChars.spd.max,
                            aidedBaselineSpd,
                            "TRANSFER aid side DEX should not raise figured SPD.",
                        );
                        assert.equal(
                            aidedChars.pd.max,
                            aidedBaselinePd,
                            "TRANSFER aid side STR should not raise figured PD.",
                        );
                    });

                    it("item-origin actor effects still drive 5e dependents", async function () {
                        const sourceActor = await create5eActor("_Quench_5e_Item_Origin_Source");
                        const targetActor = await create5eActor("_Quench_5e_Item_Origin_Target");
                        const baselineSpd = targetActor.system.characteristics.spd.max;
                        const dexContents = `
                            <DEX XMLID="DEX" ID="1766170024718" BASECOST="0.0" LEVELS="10" ALIAS="DEX" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Source DEX Aid" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
                            <NOTES />
                            </DEX>
                        `;
                        const sourceItem = await HeroSystem6eItem.create(
                            HeroSystem6eItem.itemDataFromXml(dexContents, sourceActor),
                            {
                                parent: sourceActor,
                            },
                        );

                        const chars = await addAdjustmentEffect(targetActor, {
                            name: "Item-origin AID DEX",
                            origin: sourceItem.uuid,
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.dex.max",
                                    value: "10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        assert.equal(chars.dex.max, 20, "Item-origin actor effect should raise DEX.");
                        assert.equal(
                            chars.ocv.max,
                            expectedOcvFromDex(20),
                            "Item-origin actor effect should raise OCV.",
                        );
                        assert.equal(
                            chars.spd.max,
                            baselineSpd,
                            "Item-origin adjustment to DEX should not raise figured SPD.",
                        );
                    });

                    it("disabled primary ActiveEffects do not drive dependent formulas", async function () {
                        const actor = await create5eActor("_Quench_5e_Disabled_Primary_AE_Target");
                        const baseline = {
                            str: actor.system.characteristics.str.max,
                            pd: actor.system.characteristics.pd.max,
                            rec: actor.system.characteristics.rec.max,
                            stun: actor.system.characteristics.stun.max,
                        };

                        const chars = await addAdjustmentEffect(actor, {
                            name: "Disabled AID STR",
                            disabled: true,
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "20",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        assert.equal(chars.str.max, baseline.str, "Disabled STR effect should not raise STR.");
                        assert.equal(chars.pd.max, baseline.pd, "Disabled STR effect should not raise PD.");
                        assert.equal(chars.rec.max, baseline.rec, "Disabled STR effect should not raise REC.");
                        assert.equal(chars.stun.max, baseline.stun, "Disabled STR effect should not raise STUN.");
                    });

                    it("active characteristic items do not enter the actor-owned AE formula source path", async function () {
                        const actor = await create5eActor("_Quench_5e_Item_DEX_Target");
                        const dexContents = `
                            <DEX XMLID="DEX" ID="1766170024717" BASECOST="0.0" LEVELS="10" ALIAS="DEX" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
                            <NOTES />
                            </DEX>
                        `;

                        const dexItem = await HeroSystem6eItem.create(
                            HeroSystem6eItem.itemDataFromXml(dexContents, actor),
                            {
                                parent: actor,
                            },
                        );
                        await dexItem.turnOn();
                        await actor.fullHealth();
                        // No manual prepareData(): without a reset() it re-applies active effects on
                        // top of already-applied data; fullHealth's update already re-prepared.

                        assert.equal(actor.system.characteristics.dex.value, 20, "Active DEX item should raise DEX.");
                        assert.equal(
                            actor.system.characteristics.ocv.base,
                            7,
                            "Active DEX item should raise OCV through the item path.",
                        );
                        assert.equal(
                            actor.system.characteristics.spd.value,
                            3,
                            "Active DEX item should not double-propagate into SPD.",
                        );
                    });

                    it("direct dependent max ActiveEffects survive formula recomputation", async function () {
                        const actor = await create5eActor("_Quench_5e_Dependent_AE_Target");

                        const chars = await addAdjustmentEffect(actor, {
                            name: "Direct dependent adjustments",
                            adjustmentActivePoints: 15,
                            changes: [
                                {
                                    key: "system.characteristics.pd.max",
                                    value: "5",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                                {
                                    key: "system.characteristics.ed.max",
                                    value: "5",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                                {
                                    key: "system.characteristics.dcv.max",
                                    value: "-8",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });

                        assert.equal(chars.pd.max, 7, "Direct PD max AE should survive formula recomputation.");
                        assert.equal(chars.ed.max, 7, "Direct ED max AE should survive formula recomputation.");
                        assert.equal(chars.dcv.max, -5, "Direct DCV max AE should survive formula recomputation.");
                    });

                    it("halved conditions do not stack and cap the current value", async function () {
                        const actor = await create5eActor("_Quench_5e_Halving_Target");
                        const baselineDcv = actor.system.characteristics.dcv.max; // DEX 10/3 -> 3

                        // Prone and Stunned each halve DCV; a character who is both is at 1/2 DCV,
                        // not 1/4. Rounding favors the character (1.5 -> 2).
                        await actor.createEmbeddedDocuments("ActiveEffect", [
                            {
                                name: "Prone (halved DCV)",
                                statuses: ["prone"],
                                changes: [
                                    {
                                        key: "system.characteristics.dcv.max",
                                        value: 0.5,
                                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                                    },
                                ],
                            },
                            {
                                name: "Stunned (halved DCV)",
                                statuses: ["stunned"],
                                changes: [
                                    {
                                        key: "system.characteristics.dcv.max",
                                        value: 0.5,
                                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                                    },
                                ],
                            },
                        ]);

                        const halvedDcv = roundFavorPlayerAwayFromZero(baselineDcv / 2);
                        assert.equal(
                            actor.system.characteristics.dcv.max,
                            halvedDcv,
                            "Two halved conditions should apply a single halving.",
                        );
                        assert.equal(
                            actor.system.characteristics.dcv.value,
                            halvedDcv,
                            "The lowered max should cap the current value.",
                        );
                    });

                    it("negative primaries add zero to figured characteristics (5ER p. 33)", async function () {
                        const actor = await create5eActor("_Quench_5e_Negative_Floor_Target");

                        await actor.createEmbeddedDocuments("ActiveEffect", [
                            {
                                name: "Massive transformation",
                                changes: [
                                    {
                                        key: "system.characteristics.str.max",
                                        value: "-40",
                                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                    },
                                    {
                                        key: "system.characteristics.con.max",
                                        value: "-40",
                                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                    },
                                    {
                                        key: "system.characteristics.dex.max",
                                        value: "-30",
                                        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                    },
                                ],
                            },
                        ]);

                        const chars = actor.system.characteristics;
                        assert.equal(chars.pd.max, 0, "PD floors at 0 (negative STR adds zero).");
                        assert.equal(chars.ed.max, 0, "ED floors at 0 (negative CON adds zero).");
                        assert.equal(chars.rec.max, 0, "REC floors at 0.");
                        assert.equal(chars.end.max, 0, "END floors at 0.");
                        assert.equal(chars.stun.max, 10, "STUN keeps the BODY contribution only.");
                        assert.equal(chars.spd.max, 1, "SPD never drops below 1 (1 + max(0, DEX)/10).");
                        assert.equal(chars.ocv.max, 0, "CV is 0 at DEX 1 or less (5ER p. 37).");
                    });

                    it("EGO adjustments move OMCV/DMCV in both directions", async function () {
                        const aidedActor = await create5eActor("_Quench_5e_AID_EGO_Target");
                        const drainedActor = await create5eActor("_Quench_5e_DRAIN_EGO_Target");
                        const baselineOmcv = aidedActor.system.characteristics.omcv.max; // EGO 10/3 -> 3

                        const aidedChars = await addAdjustmentEffect(aidedActor, {
                            name: "AID EGO",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.ego.max",
                                    value: "10",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });
                        assert.equal(aidedChars.ego.max, 20, "AID EGO raises the primary max.");
                        assert.equal(aidedChars.omcv.max, expectedOcvFromDex(20), "AID EGO raises OMCV (ECV=EGO/3).");
                        assert.equal(aidedChars.dmcv.max, expectedOcvFromDex(20), "AID EGO raises DMCV.");

                        const drainedChars = await addAdjustmentEffect(drainedActor, {
                            name: "DRAIN EGO",
                            adjustmentActivePoints: -30,
                            changes: [
                                {
                                    key: "system.characteristics.ego.max",
                                    value: "-30",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });
                        assert.isBelow(drainedChars.ego.max, 0, "DRAIN EGO tracks the primary below zero.");
                        assert.isAbove(baselineOmcv, 0, "Baseline ECV starts above the drained floor.");
                        assert.equal(drainedChars.omcv.max, 0, "DRAIN EGO floors OMCV at 0.");
                        assert.equal(drainedChars.dmcv.max, 0, "DRAIN EGO floors DMCV at 0.");
                    });

                    it("STR adjustments move Leaping both directions but never Running/Swimming", async function () {
                        const aidedActor = await create5eActor("_Quench_5e_AID_STR_Leaping_Target");
                        const drainedActor = await create5eActor("_Quench_5e_DRAIN_STR_Leaping_Target");
                        const baseline = {
                            leaping: aidedActor.system.characteristics.leaping.max, // floor(10/2.5)/2 = 2
                            running: aidedActor.system.characteristics.running.max,
                            swimming: aidedActor.system.characteristics.swimming.max,
                            pd: aidedActor.system.characteristics.pd.max,
                        };

                        // Leaping is a Strength Table ability, not a Figured Characteristic (the 5ER
                        // p. 33 table is PD/ED/SPD/REC/END/STUN), so adjustments to STR move it
                        // (5ER p. 105) — and the current value moves with the max: a bigger STR means
                        // a longer leap now, not just a higher ceiling.
                        const aidedChars = await addAdjustmentEffect(aidedActor, {
                            name: "AID STR",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "8",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });
                        // STR 18: floor(18/2.5)/2 = 3.5, player-favorable rounding -> 4.
                        assert.equal(aidedChars.leaping.max, 4, "AID STR should raise Leaping max.");
                        assert.equal(aidedChars.leaping.value, 4, "AID STR should raise the current Leaping too.");
                        assert.equal(aidedChars.running.max, baseline.running, "AID STR should not touch Running.");
                        assert.equal(aidedChars.swimming.max, baseline.swimming, "AID STR should not touch Swimming.");
                        assert.equal(aidedChars.pd.max, baseline.pd, "Figured PD stays insulated from AID STR.");

                        // 5ER p. 35: "Negative STR prevents a character from Leaping."
                        const drainedChars = await addAdjustmentEffect(drainedActor, {
                            name: "DRAIN STR",
                            adjustmentActivePoints: -40,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "-40",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });
                        assert.equal(drainedChars.leaping.max, 0, "DRAIN STR below zero should remove Leaping.");
                        assert.equal(drainedChars.leaping.value, 0, "Current Leaping follows the drain down.");
                        assert.equal(drainedChars.pd.max, baseline.pd, "Figured PD stays insulated from DRAIN STR.");
                    });

                    it("purchased Leaping inches stack with the STR-derived amount", async function () {
                        const actor = await create5eActor("_Quench_5e_Leaping_Levels_Target");

                        // Buy +6" of Leaping: floor(10/2.5)/2 = 2 base + 6 = 8/8.
                        await actor.update({ system: { LEAPING: { LEVELS: 6 } } });
                        assert.equal(actor.system.characteristics.leaping.max, 8, "Bought Leaping raises the max.");
                        assert.equal(actor.system.characteristics.leaping.value, 8, "Bought Leaping raises the value.");

                        // +8 STR: 3.5 STR-derived + 6 bought = 9.5, player-favorable rounding -> 10 —
                        // and the current value follows (regression: max previously rose while the
                        // current stayed behind, 8/8 -> 8/10).
                        const chars = await addAdjustmentEffect(actor, {
                            name: "AID STR",
                            adjustmentActivePoints: 30,
                            changes: [
                                {
                                    key: "system.characteristics.str.max",
                                    value: "8",
                                    type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                },
                            ],
                        });
                        assert.equal(chars.leaping.max, 10, "STR-derived and purchased Leaping stack in the max.");
                        assert.equal(chars.leaping.value, 10, "Current Leaping follows the raised max.");
                    });
                });

                describe("Adjustment power lifecycle (performAdjustment apply/fade/delete)", function () {
                    it("AID PD applies halved, fades 5 AP per turn, and ends at baseline", async function () {
                        const attacker = await create5eActor("_Quench_5e_Lifecycle_AID_PD_Attacker");
                        const target = await create5eActor("_Quench_5e_Lifecycle_AID_PD_Target");
                        const aidItem = await createAdjustmentItem(attacker, {
                            xmlid: "AID",
                            input: "PD",
                            levels: 3,
                        });

                        const baselinePd = target.system.characteristics.pd.max; // STR 10/5 = 2

                        // 5ER p. 110: adjustment of a defense is halved: 12 AP -> 6 points of PD.
                        await applyAdjustment(aidItem, "PD", 12, target);
                        assert.equal(
                            target.system.characteristics.pd.max,
                            baselinePd + 6,
                            "AID PD should add half AP.",
                        );
                        assert.equal(
                            target.system.characteristics.pd.value,
                            baselinePd + 6,
                            "AID PD should raise the current value with the max.",
                        );

                        // 5ER p. 110 sidebar: the fade removes 5 CP worth of the adjusted ability per
                        // turn from the halved ledger (+6 -> +1).
                        let effect = findAdjustmentEffect(target);
                        assert.ok(effect, "AID PD adjustment effect exists.");
                        await fadeAdjustment(aidItem, "PD", effect);
                        assert.equal(target.system.characteristics.pd.max, baselinePd + 1, "First fade leaves +1 PD.");
                        assert.equal(
                            target.system.characteristics.pd.value,
                            baselinePd + 1,
                            "Current value follows the fading max down.",
                        );

                        // Final fade exhausts the ledger, deletes the effect, and restores baseline.
                        effect = findAdjustmentEffect(target);
                        await fadeAdjustment(aidItem, "PD", effect);
                        assert.notOk(findAdjustmentEffect(target), "Fully faded adjustment effect is deleted.");
                        assert.equal(target.system.characteristics.pd.max, baselinePd, "Faded AID restores PD max.");
                        assert.equal(
                            target.system.characteristics.pd.value,
                            baselinePd,
                            "Faded AID restores PD current value.",
                        );
                    });

                    it("knocking out an actor preserves an AID'd primary's current value", async function () {
                        const attacker = await create5eActor("_Quench_5e_KO_AID_DEX_Attacker");
                        const target = await create5eActor("_Quench_5e_KO_AID_DEX_Target");
                        const aidItem = await createAdjustmentItem(attacker, {
                            xmlid: "AID",
                            input: "DEX",
                            levels: 3,
                        });

                        // DEX costs 3 CP per point in 5e: 12 AP -> +4 DEX (14/14, value raised by the flow).
                        await applyAdjustment(aidItem, "DEX", 12, target);
                        assert.equal(target.system.characteristics.dex.max, 14, "AID DEX raises max.");
                        assert.equal(target.system.characteristics.dex.value, 14, "AID DEX raises the current value.");

                        // Drop STUN below zero: rule B toggles knockedOut + prone. The KO status
                        // overrides the CV maxima but must not disturb the AID'd primary.
                        await target.update({ system: { characteristics: { stun: { value: -1 } } } });
                        assert.ok(target.statuses.has("knockedOut"), "Actor is knocked out.");

                        assert.equal(target.system.characteristics.dex.max, 14, "KO keeps the AID'd DEX max.");
                        assert.equal(
                            target.system.characteristics.dex.value,
                            14,
                            "KO must not reset the AID'd DEX current value to base.",
                        );
                        assert.equal(
                            target._source.system.characteristics.dex.value,
                            14,
                            "The stored DEX current value survives the knockout.",
                        );
                    });

                    it("consumption from an AIDed expendable comes out of the boost first (Gigawatt, 5ER p. 105-06)", async function () {
                        const attacker = await create5eActor("_Quench_5e_Lifecycle_AID_STUN_Attacker");
                        const target = await create5eActor("_Quench_5e_Lifecycle_AID_STUN_Target");
                        const aidItem = await createAdjustmentItem(attacker, {
                            xmlid: "AID",
                            input: "STUN",
                            levels: 3,
                        });

                        const baselineStun = target.system.characteristics.stun.max; // BODY 10 + STR/2 + CON/2 = 20

                        await applyAdjustment(aidItem, "STUN", 18, target);
                        assert.equal(target.system.characteristics.stun.max, baselineStun + 18, "AID STUN adds 18.");
                        assert.equal(
                            target.system.characteristics.stun.value,
                            baselineStun + 18,
                            "AID STUN raises the current value.",
                        );

                        // Take 14 STUN of damage while boosted.
                        await target.update({
                            "system.characteristics.stun.value": target.system.characteristics.stun.value - 14,
                        });

                        // First fade tick: the max drops but the (damaged) current value is untouched —
                        // subtracting the fade delta as well would charge the damage twice.
                        await fadeAdjustment(aidItem, "STUN", findAdjustmentEffect(target));
                        assert.equal(target.system.characteristics.stun.max, baselineStun + 13, "Fade tick 1 max.");
                        assert.equal(
                            target.system.characteristics.stun.value,
                            baselineStun + 4,
                            "Damaged current value is preserved through the fade tick.",
                        );

                        // Fade to completion: 14 damage < 18 boost, so it all came out of the boost and
                        // the character ends at his normal, undamaged STUN.
                        for (let i = 0; i < 3; i++) {
                            const effect = findAdjustmentEffect(target);
                            assert.ok(effect, `Adjustment effect still present before fade tick ${i + 2}.`);
                            await fadeAdjustment(aidItem, "STUN", effect);
                        }
                        assert.notOk(findAdjustmentEffect(target), "Fully faded adjustment effect is deleted.");
                        assert.equal(
                            target.system.characteristics.stun.max,
                            baselineStun,
                            "Faded AID restores STUN max.",
                        );
                        assert.equal(
                            target.system.characteristics.stun.value,
                            baselineStun,
                            "Damage taken while boosted came out of the boost, not the character's own STUN.",
                        );
                    });

                    it("deleting a DRAIN restores its removed points to the current value", async function () {
                        const attacker = await create5eActor("_Quench_5e_Lifecycle_DRAIN_STR_Attacker");
                        const target = await create5eActor("_Quench_5e_Lifecycle_DRAIN_STR_Target");
                        const drainItem = await createAdjustmentItem(attacker, {
                            xmlid: "DRAIN",
                            input: "STR",
                            levels: 2,
                        });

                        const baselineStr = target.system.characteristics.str.max; // 10

                        await applyAdjustment(drainItem, "STR", -12, target);
                        assert.equal(target.system.characteristics.str.max, baselineStr - 12, "DRAIN lowers STR max.");
                        assert.equal(
                            target.system.characteristics.str.value,
                            baselineStr - 12,
                            "DRAIN lowers the current value with the max.",
                        );

                        // GM deletes the drain outright: the removed points come back (the clamp update
                        // commits in a follow-up actor update after the deletion).
                        const effect = findAdjustmentEffect(target);
                        const valueRestoreHook = waitForHook("updateActor");
                        await effect.delete();
                        await valueRestoreHook;

                        assert.equal(target.system.characteristics.str.max, baselineStr, "Deleted DRAIN restores max.");
                        assert.equal(
                            target.system.characteristics.str.value,
                            baselineStr,
                            "Deleted DRAIN restores the current value.",
                        );
                    });

                    it("multiple casters share the largest single AID maximum (5ER p. 106)", async function () {
                        const attackerA = await create5eActor("_Quench_5e_MultiAID_Attacker_A");
                        const attackerB = await create5eActor("_Quench_5e_MultiAID_Attacker_B");
                        const target = await create5eActor("_Quench_5e_MultiAID_Target");
                        const aidA = await createAdjustmentItem(attackerA, { xmlid: "AID", input: "STR", levels: 1 });
                        const aidB = await createAdjustmentItem(attackerB, { xmlid: "AID", input: "STR", levels: 1 });

                        const baselineStr = target.system.characteristics.str.max; // 10

                        // Each AID 1d6 has a maximum effect of 6 AP. Two casters cannot stack past the
                        // largest single maximum: the second AID adds nothing.
                        await applyAdjustment(aidA, "STR", 6, target);
                        assert.equal(target.system.characteristics.str.max, baselineStr + 6, "First AID adds 6 STR.");

                        await applyAdjustment(aidB, "STR", 6, target);
                        assert.equal(
                            target.system.characteristics.str.max,
                            baselineStr + 6,
                            "Second caster's AID cannot exceed the shared largest maximum.",
                        );
                        assert.equal(
                            target.effects.filter((e) => e.flags[game.system.id]?.type === "adjustment").length,
                            1,
                            "A fully capped AID does not create a second adjustment effect.",
                        );
                    });
                });
            });
        },
        { displayName: "HERO: 5e Calculated Combat & Figured Values" },
    );
}
