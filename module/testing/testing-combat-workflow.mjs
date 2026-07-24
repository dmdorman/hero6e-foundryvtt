import { waitForElementInChat, waitForTokenDrawn } from "./quench-helper.mjs";
import { getPowerInfo } from "../utility/util.mjs";
import { HeroCompatibility } from "../utility/compatibility.mjs";

export function registerCombatWorkflowTests(quench) {
    quench.registerBatch(
        `${game.system.id}.testing.e2e.combat-workflow`,
        (context) => {
            const { describe, it, before, beforeEach, after, assert } = context;

            // ==========================================
            // ENCAPSULATED UI AUTOMATION HELPERS
            // ==========================================

            /**
             * Resolves token drawing and handles client targeting on the canvas.
             */
            async function targetToken(tokenDoc, fallbackActor) {
                game.user.targets.clear();
                const targetTokenObject = await waitForTokenDrawn(tokenDoc);
                if (targetTokenObject) {
                    game.user.targets.add(targetTokenObject);
                } else {
                    console.warn("Token object not found on active canvas, pushing fallback reference.");
                    game.user.targets.add({ actor: fallbackActor, id: tokenDoc.id });
                }
            }

            /**
             * Renders actor sheet and intercepts the V13/V14 ApplicationV2 lifecycle hooks.
             */
            async function launchAttackForm(actor, item) {
                const sheet = actor.sheet;
                await sheet.render(true);
                const $sheetHtml = $(sheet.element);

                const rowSelector = `[data-document-uuid="Actor.${actor.id}.Item.${item.id}"] .roll-icon, [data-document-uuid="Actor.${actor.id}.Item.${item.id}"] .item-control, [data-document-uuid="Actor.${actor.id}.Item.${item.id}"] .action-button, [data-document-uuid="Actor.${actor.id}.Item.${item.id}"] [data-action="roll"], [data-document-uuid="Actor.${actor.id}.Item.${item.id}"] button[type="submit"][name="roll"]`;
                let $btn = $sheetHtml.find(rowSelector).first();

                if (!$btn.length) {
                    const fallbackSelector = `[data-item-id="${item.id}"] .roll-icon, [data-item-id="${item.id}"] .item-control, [data-item-id="${item.id}"] .action-button, [data-item-id="${item.id}"] [data-action="roll"], [data-item-id="${item.id}"] button[type="submit"][name="roll"]`;
                    $btn = $sheetHtml.find(fallbackSelector).first();
                }

                assert.ok($btn.length, `Attack trigger element located for item: ${item.name}`);

                const appPromise = new Promise((resolve) => {
                    let hookV14Id, hookV13Id;
                    const cleanupAndResolve = (app) => {
                        if (hookV14Id) Hooks.off("renderItemAttackFormApplicationV2", hookV14Id);
                        if (hookV13Id) Hooks.off("renderApplication", hookV13Id);
                        resolve(app);
                    };

                    hookV14Id = Hooks.on("renderItemAttackFormApplicationV2", (app) => cleanupAndResolve(app));
                    hookV13Id = Hooks.on("renderApplication", (app) => {
                        if (app.constructor.name === "ItemAttackFormApplication" || app.id?.includes("attack")) {
                            cleanupAndResolve(app);
                        }
                    });
                });

                $btn.click();
                const appInstance = await appPromise;
                await appInstance.render(true);
                return { appInstance, sheet };
            }

            /**
             * Executes the full automated three-stage click pipeline inside the chat log window.
             */
            async function executeChatCardSequence(attackForm, targetTokenDoc, ocvBonus = 20, querySelector) {
                const $appHtml = $(attackForm.element);
                const $ocvMod = $appHtml.find(`input[name="ocvMod"]`);
                if ($ocvMod.length) {
                    $ocvMod.val(ocvBonus);
                    $ocvMod.blur();
                }

                let rollToHitBtn = $appHtml.find(
                    "button:contains('Roll to Hit'), button[data-action='roll-to-hit'], button.roll-to-hit",
                );
                if (!rollToHitBtn.length) {
                    rollToHitBtn = $appHtml.find("button").filter(function () {
                        return $(this).text().trim().toLowerCase() === "roll to hit";
                    });
                }

                assert.ok(rollToHitBtn.length, "Found the 'Roll to Hit' actionable element inside config window.");
                rollToHitBtn.click();

                const { foundElement: rollDamageButton } = await waitForElementInChat(`button.roll-damage`);
                assert.ok(rollDamageButton, "Roll Damage button found within chat card.");

                const allInOneChatCard = rollDamageButton.closest("div.item-all-in-one-tohit-apply-card");
                assert.ok(
                    allInOneChatCard,
                    `${attackForm.data?.originalItem?.system?.XMLID} is not using all in one chat card`,
                );

                rollDamageButton.click();

                const { foundElement: applyDamageButton } = await waitForElementInChat(
                    `button.apply-damage[data-highlight-token="${targetTokenDoc.uuid}"]`,
                );
                assert.ok(applyDamageButton, "Apply Damage button found within chat card.");
                applyDamageButton.click();

                const { foundElement: finalSummaryDiv } = await waitForElementInChat(querySelector);
                assert.ok(finalSummaryDiv, "Execution summary element container located successfully.");

                return { finalSummaryDiv, rollToHitBtn, allInOneChatCard };
            }

            // Utility helper to wait for any AppV2 sheet/dialog rendering cycle
            // Removed waitForRender function as it will be replaced by Hooks.once and direct await render()
            describe("End-to-End Combat Action Workflow", function () {
                let attackerActor = null;
                let defenderActor = null;
                let attackerTokenDoc = null;
                let defenderTokenDoc = null;
                let activeScene = null;

                before(async function () {
                    activeScene = game.scenes.active ?? game.scenes.contents?.[0];
                    if (!activeScene) {
                        activeScene = await Scene.create({ name: "Test Arena", grid: { distance: 1, units: "m" } });
                    }

                    // Ensure the scene is the one rendered on the canvas so created tokens get drawn,
                    // otherwise their placeables never finish _draw() and targeting them throws.
                    if (canvas.scene?.id !== activeScene.id) {
                        await activeScene.view();
                    }

                    attackerActor = await Actor.create({
                        name: "_Quench_Attacker",
                        type: "pc",
                        flags: {
                            core: {
                                sheetClass: "herosystem6e.HeroSystemActorSheetV2",
                            },
                        },
                        img: "icons/svg/sword.svg",
                    });

                    const itemsToCreate = [];

                    const createItem = (xmlid, system = {}) => {
                        const powerInfo = getPowerInfo({ xmlid, actor: attackerActor });
                        const itemData = HeroSystem6eItem.itemDataFromXml(powerInfo.xml, attackerActor);
                        const powerData = foundry.utils.mergeObject(itemData, {
                            system: system,
                        });
                        return powerData;
                    };

                    // AID
                    itemsToCreate.push(createItem("AID", { NAME: "Aid STR", LEVELS: 4, INPUT: "STR" }));

                    // DRAIN
                    itemsToCreate.push(createItem("DRAIN", { NAME: "Drain STR", LEVELS: 4, INPUT: "STR" }));

                    // ENERGYBLAST
                    itemsToCreate.push(createItem("ENERGYBLAST", { LEVELS: 4, INPUT: "ED" }));

                    // ENTANGLE (it is possible to roll 0 BODY, which results in no effect)
                    itemsToCreate.push(createItem("ENTANGLE", { LEVELS: 4, USESTANDARDEFFECT: true }));

                    // FLASH (it is possible to roll 0 BODY, which results in no effect)
                    itemsToCreate.push(createItem("FLASH", { LEVELS: 4, USESTANDARDEFFECT: true }));

                    // MENTALBLAST aka EGOATTACK
                    itemsToCreate.push(createItem("EGOATTACK", { LEVELS: 4 }));

                    // MINDSCAN (it is possible to roll 0 BODY, which results in no effect)
                    itemsToCreate.push(createItem("MINDSCAN", { LEVELS: 4, USESTANDARDEFFECT: true }));

                    await attackerActor.createEmbeddedDocuments("Item", itemsToCreate);

                    defenderActor = await Actor.create({
                        name: "_Quench_Defender",
                        type: "pc",
                        flags: {
                            core: {
                                sheetClass: "herosystem6e.HeroSystemActorSheetV2",
                            },
                        },
                        img: "icons/svg/shield.svg",
                    });

                    [attackerTokenDoc] = await activeScene.createEmbeddedDocuments("Token", [
                        await attackerActor.getTokenDocument({ x: 100, y: 100, actorLink: false }),
                    ]);

                    // Put over 8m away to we can test range penalties (bonus test)
                    [defenderTokenDoc] = await activeScene.createEmbeddedDocuments("Token", [
                        await defenderActor.getTokenDocument({ x: 900, y: 100, actorLink: false }),
                    ]);
                });

                // Using unlinked actors so we can quickly restore them to actor baseline between tests
                beforeEach(async function () {
                    await attackerTokenDoc.delta.restore();
                    await defenderTokenDoc.delta.restore();
                });

                after(async function () {
                    game.user.targets.clear();
                    if (attackerTokenDoc) await attackerTokenDoc.delete();
                    if (defenderTokenDoc) await defenderTokenDoc.delete();
                    if (attackerActor) await attackerActor.delete();
                    if (defenderActor) await defenderActor.delete();
                });

                it("STRIKE", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackStrike = attackerActor.items.find((item) => item.system?.XMLID === "STRIKE");
                    assert.ok(attackStrike, `Pre-seeded ${attackStrike?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);
                    const baselineStun = defenderActor.system.characteristics?.stun?.value;

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackStrike);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: damageSpan } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `.apply-damage-amount span`,
                    );
                    assert.ok(damageSpan, "Element found in chat card.");

                    const { foundElement: applyDamageCard } = await waitForElementInChat(`.apply-damage-card`);
                    assert.ok(applyDamageCard, "Apply damage card rendered in chat.");

                    // The card's Effect section states the STUN actually applied after defenses.
                    // Assert the database change matches the card rather than re-deriving the
                    // defense math here (the .apply-damage-amount span is pre-defense damage).
                    const effectSection = Array.from(applyDamageCard.querySelectorAll(".card-section")).find((s) =>
                        s.querySelector(".description-tiny")?.textContent.trim().startsWith("Effect"),
                    );
                    assert.ok(effectSection, "Effect section found within the apply damage card.");

                    const effectiveStunMatch = effectSection
                        .querySelector(".description-medium")
                        ?.textContent.match(/(\d+)\s*STUN/);
                    assert.ok(effectiveStunMatch, "Effective STUN parsed from the apply damage card.");
                    const expectedStunDamage = parseInt(effectiveStunMatch[1]);

                    // Unlinked token: damage lands on the token's synthetic actor
                    const updatedDefender = defenderTokenDoc.actor;
                    const finalStun = updatedDefender.system.characteristics?.stun?.value;
                    const stunDamageApplied = baselineStun - finalStun;

                    const defenseText =
                        Array.from(applyDamageCard.querySelectorAll(".card-section .description-tiny"))
                            .map((el) => el.textContent.trim())
                            .find((t) => t.startsWith("Defense")) ?? "Defense: unknown";

                    assert.strictEqual(
                        stunDamageApplied,
                        expectedStunDamage,
                        `Defender's STUN should be reduced by the card's effective STUN (${expectedStunDamage}). Baseline: ${baselineStun}, Final: ${finalStun}, ${defenseText}.`,
                    );

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it("AID", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackAid = attackerActor.items.find((item) => item.system?.XMLID === "AID");
                    assert.ok(attackAid, `Pre-seeded ${attackAid?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);
                    const baselineStr = defenderActor.system.characteristics?.str?.value;

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackAid);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: adjustmentSummaryDiv } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `div.adjustment-summary, div.damage-summary`,
                    );
                    assert.ok(adjustmentSummaryDiv, "Adjustment summary wrapper confirmed.");

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;
                    const finalStr = updatedDefender.system.characteristics?.str?.value;

                    const strAidAmount = Number(adjustmentSummaryDiv.innerHTML.match(/(\d+) STR/)[1]);
                    const expectedStrAfterAid = baselineStr + strAidAmount;

                    assert.strictEqual(
                        finalStr,
                        expectedStrAfterAid,
                        `Defender's STR.value should be ${expectedStrAfterAid} (Baseline: ${baselineStr} + Aid: ${strAidAmount} = Final: ${finalStr}).`,
                    );

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it("DRAIN", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackItem = attackerActor.items.find((item) => item.system?.XMLID === "DRAIN");
                    assert.ok(attackItem, `Pre-seeded ${attackItem?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);
                    const baselineStr = defenderActor.system.characteristics?.str?.value;

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackItem);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: adjustmentSummaryDiv } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `div.adjustment-summary, div.damage-summary`,
                    );
                    assert.ok(adjustmentSummaryDiv, "Adjustment summary wrapper confirmed.");

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;
                    const finalStr = updatedDefender.system.characteristics?.str?.value;

                    const strDrainAmount = Number(adjustmentSummaryDiv.innerHTML.match(/(\d+) STR/)[1]);
                    const expectedStrAfterDrain = baselineStr - strDrainAmount;

                    assert.strictEqual(
                        finalStr,
                        expectedStrAfterDrain,
                        `Defender's STR.value should be ${expectedStrAfterDrain} (Baseline: ${baselineStr} + Drain: ${strDrainAmount} = Final: ${finalStr}).`,
                    );

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it("ENERGYBLAST", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackItem = attackerActor.items.find((item) => item.system?.XMLID === "ENERGYBLAST");
                    assert.ok(attackItem, `Pre-seeded ${attackItem?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);
                    const baselineStun = defenderActor.system.characteristics?.stun?.value;

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackItem);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: damageSpan, allInOneChatCard } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `.apply-damage-amount span`,
                    );
                    assert.ok(damageSpan, "Element found in chat card.");

                    // Check diceRoller details (OCV and RANGE)
                    const toHitDetailsDiv = allInOneChatCard.querySelector("details.hero6e-to-hit-details");
                    assert.ok(toHitDetailsDiv, "toHitDetailsDiv");

                    const tags = toHitDetailsDiv.querySelector("div.tags");
                    assert.ok(tags, "tags");
                    assert.ok(tags.textContent.includes("Base to hit 11"), "Base to hit 11");
                    assert.ok(tags.textContent.includes("ocv 3"), "ocv 3");
                    assert.ok(tags.textContent.includes("OCV modifier 20"), "OCV modifier 20");
                    assert.ok(tags.textContent.includes("Range penalty (16m) -2"), "+20 OCV");

                    const diceResultDiv = toHitDetailsDiv.querySelector("div.dice-result");
                    assert.ok(
                        diceResultDiv.textContent.includes("11 + 3 + 20 - 2 - 3d6"),
                        "TOHIT: 11 + 3 + 20 - 2 - 3d6",
                    );

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;
                    const finalStun = updatedDefender.system.characteristics?.stun?.value;

                    // Verification: Confirm state change matches automation calculations
                    const stunRawDamage = damageSpan.innerHTML.match(/(\d+) STUN/)[1];
                    const expectedStunDamage = Math.max(
                        0,
                        stunRawDamage - updatedDefender.system.characteristics.ed.value,
                    );
                    const stunDamageApplied = baselineStun - finalStun;
                    assert.strictEqual(
                        stunDamageApplied,
                        expectedStunDamage,
                        `Defender's STUN should be reduced by ${expectedStunDamage} (Baseline: ${baselineStun}, Final: ${finalStun}).`,
                    );

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it("ENTANGLE", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackItem = attackerActor.items.find((item) => item.system?.XMLID === "ENTANGLE");
                    assert.ok(attackItem, `Pre-seeded ${attackItem?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackItem);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: damageSpan } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `.apply-damage-amount span`,
                    );
                    assert.ok(damageSpan, "Element found in chat card.");

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;

                    // Verification: Confirm state change matches automation calculations
                    const bodyRawDamage = Number(damageSpan.innerHTML.match(/(\d+) BODY/)[1]);
                    assert.strictEqual(bodyRawDamage, 4, `${attackItem.name} exptected to have BODY of 4`);

                    const effectElement = damageSpan.closest("div.message-content").querySelector("div.effects");
                    const expectedEffect = `is entangled. The entangle has 4 BODY 4 rPD/4 rED.`;

                    assert.ok(
                        effectElement.textContent.includes(expectedEffect),
                        `${attackItem.name} has unexpected ENTANGLE effect`,
                    );

                    assert.ok(
                        updatedDefender.statuses.has("entangled"),
                        `${attackItem.name} expected to have entangled status/condition.`,
                    );

                    const ae = updatedDefender.appliedEffects?.[0];
                    if (HeroCompatibility.isV14) {
                        assert.ok(ae?.showIcon, `${attackItem.name} expected ActiveEffect status to showIcon=true`);
                    }

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it("FLASH", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackItem = attackerActor.items.find((item) => item.system?.XMLID === "FLASH");
                    assert.ok(attackItem, `Pre-seeded ${attackItem?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackItem);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: damageSpan } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `.apply-damage-amount span`,
                    );
                    assert.ok(damageSpan, "Element found in chat card.");

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;

                    // Verification: Confirm state change matches automation calculations
                    const bodyRawDamage = Number(damageSpan.innerHTML.match(/(\d+) Segments/)[1]);
                    assert.strictEqual(bodyRawDamage, 4, `${attackItem.name} exptected to have BODY of 4`);

                    const effectElement = damageSpan.closest("div.message-content").querySelector("div.effects");
                    const expectedEffect = `SIGHTGROUP for 4 segments.`;

                    assert.ok(
                        effectElement.textContent.includes(expectedEffect),
                        `${attackItem.name} has unexpected effect`,
                    );

                    const ae = updatedDefender.appliedEffects?.[0];
                    assert.ok(ae?.img.includes("blind"), `${attackItem.name} expected ActiveEffect to have blind img`);

                    if (HeroCompatibility.isV14) {
                        assert.ok(ae?.showIcon, `${attackItem.name} expected ActiveEffect to showIcon=true`);
                    }

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it.skip("HTH", async function () {});

                it.skip("HEALING", async function () {});

                it.skip("HKA", async function () {});

                it("MENTALBLAST aka EGOATTACK", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackItem = attackerActor.items.find((item) => item.system?.XMLID === "EGOATTACK");
                    assert.ok(attackItem, `Pre-seeded ${attackItem?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);
                    const baselineStun = defenderActor.system.characteristics?.stun?.value;

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackItem);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: damageSpan } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `.apply-damage-amount span`,
                    );
                    assert.ok(damageSpan, "Element found in chat card.");

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;
                    const finalStun = updatedDefender.system.characteristics?.stun?.value;

                    // Verification: Confirm state change matches automation calculations
                    const stunRawDamage = damageSpan.innerHTML.match(/(\d+) STUN/)[1];
                    const expectedStunDamage = Math.max(0, stunRawDamage - 0); // Assume zero mental defense
                    const stunDamageApplied = baselineStun - finalStun;
                    assert.strictEqual(
                        stunDamageApplied,
                        expectedStunDamage,
                        `Defender's STUN should be reduced by ${expectedStunDamage} (Baseline: ${baselineStun}, Final: ${finalStun}).`,
                    );

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });

                it.skip("MINDSCAN", async function () {
                    assert.ok(attackerActor, "Attacker database record exists.");
                    assert.ok(defenderActor, "Defender database record exists.");

                    const attackItem = attackerActor.items.find((item) => item.system?.XMLID === "MINDSCAN");
                    assert.ok(attackItem, `Pre-seeded ${attackItem?.name} was successfully located on the actor.`);

                    // 1. Establish canvas target layer
                    await targetToken(defenderTokenDoc, defenderActor);

                    // 2. Open Attacker Sheet and capture form context
                    const { appInstance, sheet } = await launchAttackForm(attackerActor, attackItem);

                    // 3. Complete chat interaction sequences via encapsulated pipeline
                    const { finalSummaryDiv: damageSpan } = await executeChatCardSequence(
                        appInstance,
                        defenderTokenDoc,
                        20,
                        `.apply-damage-amount span`,
                    );
                    assert.ok(damageSpan, "Element found in chat card.");

                    // 4. Verification calculations against live document database state
                    const updatedDefender = defenderTokenDoc.actor;

                    // Verification: Confirm state change matches automation calculations
                    const bodyRawDamage = Number(damageSpan.innerHTML.match(/(\d+) Segments/)[1]);
                    assert.strictEqual(bodyRawDamage, 4, `${attackItem.name} exptected to have BODY of 4`);

                    const effectElement = damageSpan.closest("div.message-content").querySelector("div.effects");
                    const expectedEffect = `SIGHTGROUP for 4 segments.`;

                    assert.ok(
                        effectElement.textContent.includes(expectedEffect),
                        `${attackItem.name} has unexpected effect`,
                    );

                    const ae = updatedDefender.appliedEffects?.[0];
                    assert.ok(ae?.img.includes("blind"), `${attackItem.name} expected ActiveEffect to have blind img`);
                    assert.ok(ae?.showIcon, `${attackItem.name} expected ActiveEffect to showIcon=true`);

                    // 5. Explicit structural window cleanup
                    await appInstance.close();
                    await sheet.close();
                });
            });
        },
        { displayName: "End-to-End Combat Execution" },
    );
}
