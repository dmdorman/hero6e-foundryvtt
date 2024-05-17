import { registerUtilTests } from "./testing-util.mjs";
import { registerDamageFunctionTests } from "./testing-damage-functions.mjs";
import { registerAttackFunctionTests } from "./testing-attack-functions.mjs";
import { registerTagTests } from "./testing-tag.mjs";
import { registerUploadTests } from "./testing-upload.mjs";
import { registerDefenseTests } from "./testing-defense.mjs";
import { registerFullTests } from "./testing-full.mjs";
import { registerDiceTests } from "./testing-dice.mjs";
import { registerEverythingLadLass } from "./testing-everything-lad-lass.mjs";

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

Hooks.on("quenchReady", (quench) => {
    registerAttackFunctionTests(quench);
    registerUtilTests(quench);
    registerDamageFunctionTests(quench);
    registerTagTests(quench);
    registerDefenseTests(quench);
    registerUploadTests(quench);
    registerFullTests(quench);
    registerEverythingLadLass(quench);
    registerDiceTests(quench);
    registerMainTests(quench);
});

// Helper function to run all tests from browser console.
//
// For browsers that support top level await (e.g. Chrome) you can just:
// console.log(`Test suite result: ${await window.herosystem6eRunTests(100)}`);
//
// For other browsers you can just:
// window.herosystem6eRunTests(100).catch((err) => console.error(`Error with test runs: ${err.message}`)).then((result) => console.log(`Finished test runs`))
//
window.herosystem6eRunTests = async (numLoops = 1) => {
    if (!game.modules.get("quench")?.active) {
        ui.notifications.warn(game.i18n.localize("Warning.Quench.Active"));
        throw new Error("Quench not active. Cannot run tests.");
    }

    for (let i = 0; i < numLoops; ++i) {
        try {
            console.log(`Start test run ${i + 1} of ${numLoops}`);
            await runTestSuiteOnce();
        } catch (err) {
            console.error(`Test run failed: ${err}`);
            return err;
        }
    }

    console.log(`Completed ${numLoops} test runs`);

    return true;
};

async function runTestSuiteOnce() {
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
        }, 20 * 1000 /* 20 seconds */);

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
