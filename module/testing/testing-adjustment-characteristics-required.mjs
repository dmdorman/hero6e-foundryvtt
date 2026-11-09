/**
 * The adjustment power cases the suite still needs, written as skipped stubs.
 */

import { freezeDeep } from "../utility/freeze-helpers.mjs";

/** The one group in this file. */
const GROUP = "Adjustment powers: figured and calculated names";

/**
 * The actors these cases wait for. None of them needs a Hero Designer sheet.
 *
 * `testing-5e-calculated-active-effect.mjs` creates a bare `_Quench` actor with `system: { is5e: true }`
 * and drives every adjustment through effect items. The 6e twins pass `system: { is5e: false }` to the
 * same helper, so no XML, upload, or power list is involved.
 *
 * `blocks` names what must settle first. `blocks: null` means the fixture is ready to build.
 */
export const REQUIRED_FIXTURES = freezeDeep({
    probeActor5e: {
        title: "5e probe built in code",
        actorType: "pc",
        edition: "5e",
        unique:
            "A bare pc with `system: { is5e: true }`, the shape the 5e calculated suite already makes. The " +
            "test writes DEX 18, STR 15, and CON 8 with `updateMultipleCharacteristicsOnActor`, so DEX 18 carries an SPD fraction. " +
            "Adjustments arrive as effect items with `system.characteristics.<name>.max` ADD changes.",
        blocks: null,
    },
    probeActor6e: {
        title: "6e probe built in code",
        actorType: "pc",
        edition: "6e",
        unique:
            "The same helper with `system: { is5e: false }` and the same numbers. 6e figures PD and ED from " +
            "CON and BODY, and REC, END, and STUN from CON, so the same adjustments meet different formulas.",
        blocks: null,
    },
    vehicle5eProbe: {
        title: "5e vehicle built in code",
        actorType: "vehicle",
        edition: "5e",
        unique:
            "A bare vehicle with `system: { is5e: true }`. It holds DEF and no PD or ED, so it shows a " +
            "drained defence counting as nothing.",
        blocks: null,
    },
});

/**
 * Add the cases that separate figured from calculated, per 5ER p. 105.
 *
 * Calculated names (OCV, DCV, OMCV, DMCV) read a primary's value, so an adjustment moves them. Figured
 * names (PD, ED, SPD, REC, END, STUN, LEAPING) read base plus levels, so an adjustment must not.
 *
 * @param {Function} add Case builder that takes the group, the fixture key, and the claim.
 */
function adjustmentCases(add) {
    // Claims the 5e suite makes and no 6e test makes.
    for (const claim of [
        "an AID on DEX raises OCV and DCV",
        "an AID on DEX leaves SPD alone",
        "an AID on STR leaves PD alone",
        "an AID on STR moves LEAPING and leaves RUNNING and SWIMMING alone",
        "an AID on CON leaves REC alone",
        "an AID on CON leaves END alone",
        "an AID on CON leaves STUN alone",
        "an AID on EGO raises OMCV and DMCV",
        "the base column excludes the adjustment and the max column shows it",
    ]) {
        add(GROUP, "probeActor6e", claim);
    }

    add(GROUP, "probeActor5e", "DEX 18 keeps the SPD fraction and floors only the total");
    add(GROUP, "probeActor5e", "a characteristic item that grants DEX raises the SPD base");

    // A defence driven below zero keeps its sign and plays as zero. No sheet can buy a defence below 0.
    add(GROUP, "probeActor6e", "a drain drives PD below zero and the node keeps the sign");
    add(GROUP, "probeActor6e", "a drained PD below zero counts as 0 when an attack names PD");
    add(GROUP, "probeActor6e", "a drained ED below zero counts as 0 when an attack names ED");
    add(GROUP, "vehicle5eProbe", "a drained DEF below zero counts as 0 for both PD and ED");
}

/**
 * Build every case in this file.
 *
 * @returns {Array<{group: string, title: string}>} One entry per pending case.
 */
export function buildRequiredCases() {
    const cases = [];

    /**
     * Append one case.
     *
     * @param {string} group Group title.
     *
     * @param {string} fixtureKey Key into `REQUIRED_FIXTURES`.
     *
     * @param {string} claim The one thing the case checks.
     */
    const add = (group, fixtureKey, claim) => {
        const fixture = REQUIRED_FIXTURES[fixtureKey];

        cases.push({ group, title: `${fixture.title}: ${claim}` });
    };

    adjustmentCases(add);

    return cases;
}

/**
 * Register every case as a skipped stub.
 *
 * @param {object} quench The Quench instance.
 */
export function registerAdjustmentCharacteristicsRequiredTests(quench) {
    quench.registerBatch(
        `${game.system.id}.actor.adjustment.characteristics.required`,
        (context) => {
            const { describe, it } = context;

            const casesByGroup = new Map();

            for (const oneCase of buildRequiredCases()) {
                const bucket = casesByGroup.get(oneCase.group) ?? [];

                bucket.push(oneCase.title);
                casesByGroup.set(oneCase.group, bucket);
            }

            describe.skip("Required adjustment power coverage", function () {
                for (const title of casesByGroup.get(GROUP) ?? []) {
                    it.skip(title, function () {});
                }
            });
        },
        { displayName: "HERO: Characteristics Required (adjustment powers)" },
    );
}
