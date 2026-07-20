Hooks.once("ready", async function () {
    if (!game.modules.get("_dev-mode")?.active) {
        return;
    }

    if (!game.modules.get("quench")) {
        ui.notifications.warn(game.i18n.localize("Warning.Quench.Install"));
    }

    if (!game.modules.get("quench")?.active) {
        ui.notifications.warn(game.i18n.localize("Warning.Quench.Active"));
    }
});

Hooks.on("quenchReady", async (quench) => {
    // Only load the test suites once quench is ready so their code is never
    // parsed or evaluated in worlds without quench installed and active.
    const [
        { registerAutomatonTests },
        { registerBaseTests },
        { registerCslTests },
        { registerDamageFunctionTests },
        { registerDefenseTests },
        { registerDiceTests },
        { registerEverythingLadLass },
        { registerFullTests },
        { registerHeroMathTests },
        { registerManeuverTests },
        { registerRequiresRollCheckTests },
        { registerUploadTests },
        { registerVehicleTests },
        { registerCombatTests },
        { registerGlobalSetup, registerGlobalTeardown },
        { registerCombatWorkflowTests },
        { registerTypeForceReplaceTests },
        { registerStatusEffectTests },
        { register5eCalculatedActiveEffectAutomationTests },
        { registerActorCharacteristicTests },
        { registerAdjustmentFadeTests },
        { registerItemEditionTests },
        { registerWorldTimeTests },
        { registerVisionTests },
    ] = await Promise.all([
        import("./testing-automaton.mjs"),
        import("./testing-base.mjs"),
        import("./testing-csl.mjs"),
        import("./testing-damage-functions.mjs"),
        import("./testing-defense.mjs"),
        import("./testing-dice.mjs"),
        import("./testing-everything-lad-lass.mjs"),
        import("./testing-full.mjs"),
        import("./testing-hero-math.mjs"),
        import("./testing-maneuvers.mjs"),
        import("./testing-requires-roll-check.mjs"),
        import("./testing-upload.mjs"),
        import("./testing-vehicles.mjs"),
        import("./testing-combat-tracker.mjs"),
        import("./quench-helper.mjs"),
        import("./testing-combat-workflow.mjs"),
        import("./testing-type-force-replace.mjs"),
        import("./testing-status-effects.mjs"),
        import("./testing-5e-calculated-active-effect.mjs"),
        import("./testing-default-characteristics.mjs"),
        import("./testing-adjustment-fade.mjs"),
        import("./testing-item-edition.mjs"),
        import("./testing-world-time.mjs"),
        import("./testing-vision.mjs"),
    ]);

    registerGlobalSetup(quench);
    registerAutomatonTests(quench);
    registerBaseTests(quench);
    registerCslTests(quench);
    registerDamageFunctionTests(quench);
    registerDefenseTests(quench);
    registerDiceTests(quench);
    registerEverythingLadLass(quench);
    registerFullTests(quench);
    registerHeroMathTests(quench);
    registerMainTests(quench);
    registerManeuverTests(quench);
    registerRequiresRollCheckTests(quench);
    registerUploadTests(quench);
    registerVehicleTests(quench);
    registerActorCharacteristicTests(quench);
    registerStatusEffectTests(quench);
    registerTypeForceReplaceTests(quench);
    registerCombatWorkflowTests(quench);
    register5eCalculatedActiveEffectAutomationTests(quench);
    registerCombatTests(quench);
    registerAdjustmentFadeTests(quench);
    registerItemEditionTests(quench);
    registerWorldTimeTests(quench);
    registerVisionTests(quench);

    registerGlobalTeardown(quench);
});

// Helper function to run all tests from browser console.
//
// For browsers that support top level await (e.g. Chrome) you can just:
// console.log(`Test suite result: ${await window.herosystem6eRunTests(100, 60*1000)}`);
//
// For other browsers you can just:
// window.herosystem6eRunTests(100, 60*1000).catch((err) => console.error(`Error with test runs: ${err.message}`)).then((result) => console.log(`Finished test runs`))
//
window.herosystem6eRunTests = async (numLoops = 1, timeoutInMs = 120 * 1000) => {
    if (!game.modules.get("quench")?.active) {
        ui.notifications.warn(game.i18n.localize("Warning.Quench.Active"));
        throw new Error("Quench not active. Cannot run tests.");
    }

    for (let i = 0; i < numLoops; ++i) {
        try {
            console.log(`Start test run ${i + 1} of ${numLoops}`);
            await runTestSuiteOnce(timeoutInMs);
        } catch (err) {
            console.error(`Test run failed: ${err}`);
            return err;
        }
    }

    console.log(`Completed ${numLoops} test runs`);

    return true;
};

async function runTestSuiteOnce(timeoutInMs) {
    const mochaRunner = await quench.runBatches(`${game.system.id}.**`, {
        updateSnapshots: false,
        preSelectedOnly: false,
        json: false,
    });

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            mochaRunner.abort();
            mochaRunner.dispose();
            reject("Test suite took too long - aborting runs");
        }, timeoutInMs);

        mochaRunner.on("end", () => {
            // Clean up from the run.
            mochaRunner.dispose();
            clearTimeout(timeoutId);

            resolve(true);
        });
    });
}

function registerMainTests(quench) {
    quench.registerBatch(
        `${game.system.id}.main`,
        (context) => {
            const { describe, expect, it } = context;

            describe("HERO", async function () {
                describe("5e powers", async function () {
                    it("should have no validation errors", function () {
                        expect(CONFIG.HERO.powers5e.validate()).to.equal(0);
                    });
                });

                describe("6e powers", async function () {
                    it("should have no validation errors", function () {
                        expect(CONFIG.HERO.powers6e.validate()).to.equal(0);
                    });
                });
            });
        },
        { displayName: "HERO: Main" },
    );
}
