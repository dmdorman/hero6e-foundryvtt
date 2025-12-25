import { registerAutomatonTests } from "./testing-automaton.mjs";
import { registerBaseTests } from "./testing-base.mjs";
import { registerCslTests } from "./testing-csl.mjs";
import { registerDamageFunctionTests } from "./testing-damage-functions.mjs";
import { registerDefenseTests } from "./testing-defense.mjs";
import { registerDiceTests } from "./testing-dice.mjs";
import { registerEverythingLadLass } from "./testing-everything-lad-lass.mjs";
import { registerFullTests } from "./testing-full.mjs";
import { registerUploadTests } from "./testing-upload.mjs";
import { registerVehicleTests } from "./testing-vehicles.mjs";
import { registerGlobalSetup, registerGlobalTeardown } from "./quench-helper.mjs";

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
    registerGlobalSetup(quench);

    registerAutomatonTests(quench);
    registerBaseTests(quench);
    registerCslTests(quench);
    registerDamageFunctionTests(quench);
    registerDefenseTests(quench);
    registerDiceTests(quench);
    registerEverythingLadLass(quench);
    registerFullTests(quench);
    registerMainTests(quench);
    registerUploadTests(quench);
    registerVehicleTests(quench);

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
    const mochaRunner = await quench.runBatches("hero6efoundryvttv2.**", {
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
        "hero6efoundryvttv2.main",
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
