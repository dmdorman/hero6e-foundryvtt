// Everything lives inside the `quenchReady` hook. A world without quench therefore
// defines nothing here, and never parses or evaluates the test suites. The hook holds
// the flow; each helper below is called from that flow.
//
// Every test suite this system registers is keyed with the system id first, for example
// `hero6efoundryvttv2.utils.dice`. Callers pass names without that prefix, so a caller
// cannot select another package's test suites.
Hooks.on("quenchReady", async (quench) => {
    // Seconds to wait for an aborted run to wind down before dropping the runner reference. A full
    // suite abort unwinds suite by suite and runs each suite's `after` hooks, so give it room.
    const ABORT_GRACE_MS = 30 * 1000;

    // Time to wait for Mocha to release its run after the runner is released. Mocha clears its own
    // state in a promise callback that runs after the `end` event, so the state can still read
    // "running" for a moment after the run is really over. Without this wait the abort reports a stuck
    // Mocha on a run that just finished cleanly.
    const MOCHA_RELEASE_WAIT_MS = 10 * 1000;

    // True while this console API drives a run. Set before the first await, so two calls in the
    // same tick cannot both start a run.
    let runInProgress = false;

    // True while an abort-and-teardown is in flight. Kept apart from `runInProgress` on purpose.
    // The abort acts on the run that set `runInProgress`. One shared flag would block the abort and
    // leave the fixtures in the world with no way out.
    let teardownInProgress = false;

    // Timeout for one global teardown run. The public abort API and the timeout clean-up path share it.
    const TEARDOWN_TIMEOUT_MS = 60 * 1000;

    // Runners this hook already finished. Stops two abort paths from disposing one runner twice.
    const finishedRunners = new WeakSet();

    // One release promise per runner. Stops two abort paths from arming two grace timers.
    const releasePromises = new WeakMap();

    const RUN_BUSY_MESSAGE =
        "A Quench test run is already in progress. Wait for it, or call " +
        "window.herosystem6eAbortAndRunGlobalTeardown() to stop it and clean the world.";

    const TEARDOWN_BUSY_MESSAGE = "A global teardown is already in progress. Wait for it to finish.";

    const MOCHA_STUCK_MESSAGE =
        "Mocha still holds a run that never wound down. Reload the browser window before you run tests.";

    const { setupSuite, teardownSuite, deleteQuenchFixtures, chatCleanup, testSuiteRegistrars } =
        await importTestSuites();

    registerTestSuites(quench, testSuiteRegistrars);
    exposeConsoleApi({ setupSuite, teardownSuite, deleteQuenchFixtures, chatCleanup });

    /**
     * Import the test modules. Quench readiness gates the import, so a world without Quench never
     * parses or evaluates the test suites.
     *
     * @returns {Promise<object>} The global suite names, the clean-up helper, and the suite
     *                    registration functions in run order.
     */
    async function importTestSuites() {
        const [
            {
                registerGlobalSetup,
                registerGlobalTeardown,
                GLOBAL_SETUP_SUITE,
                GLOBAL_TEARDOWN_SUITE,
                deleteQuenchFixtures,
            },
            chatCleanup,
            { register5eCalculatedCombatAndFiguredValuesTests },
            { registerItemActiveEffectSyncTests },
            { registerAdjustmentPowerFadeMatrixTests },
            { registerAutomatonTests },
            { registerBaseTests },
            { registerSpeedChartCombatValidationTests, registerCombatTrackerFixValidationTests },
            { registerEndToEndCombatExecutionTests },
            { registerConfigTests },
            { registerCombatSkillLevelsTests },
            { registerDamageFunctionsTests },
            { registerDefaultCharacteristicsForEachActorTypeTests },
            { registerDefenseTests },
            { registerDiceTests },
            { registerDropTests },
            { registerEverythingCharacterTests },
            { registerFullCharacterTests },
            { registerMathFunctionalityTests },
            { registerItemEditionAndTypeConversionTests },
            { registerManeuverTests },
            { registerMovementEndTests },
            { registerMovementModeTests },
            { registerRequiresRollCheckTests },
            { registerStatusEffectsLogicTests },
            { registerUpdatesWithTypeForceReplaceTests },
            { registerUploadTests },
            { registerVehicleTests },
            { registerVisionTests },
            { registerWorldTimeRecoveryAndExpiryTests },
        ] = await Promise.all([
            import("./quench-helper.mjs"),
            import("./quench-chat.mjs"),
            import("./testing-5e-calculated-active-effect.mjs"),
            import("./testing-active-effects.mjs"),
            import("./testing-adjustment-fade.mjs"),
            import("./testing-automaton.mjs"),
            import("./testing-base.mjs"),
            import("./testing-combat-tracker.mjs"),
            import("./testing-combat-workflow.mjs"),
            import("./testing-config.mjs"),
            import("./testing-csl.mjs"),
            import("./testing-damage-functions.mjs"),
            import("./testing-default-characteristics.mjs"),
            import("./testing-defense.mjs"),
            import("./testing-dice.mjs"),
            import("./testing-drag-and-drop.mjs"),
            import("./testing-everything-lad-lass.mjs"),
            import("./testing-full.mjs"),
            import("./testing-hero-math.mjs"),
            import("./testing-item-edition.mjs"),
            import("./testing-maneuvers.mjs"),
            import("./testing-movement-end.mjs"),
            import("./testing-movement-mode.mjs"),
            import("./testing-requires-roll-check.mjs"),
            import("./testing-status-effects.mjs"),
            import("./testing-type-force-replace.mjs"),
            import("./testing-upload.mjs"),
            import("./testing-vehicles.mjs"),
            import("./testing-vision.mjs"),
            import("./testing-world-time.mjs"),
        ]);

        return {
            setupSuite: GLOBAL_SETUP_SUITE,
            teardownSuite: GLOBAL_TEARDOWN_SUITE,
            deleteQuenchFixtures,
            chatCleanup,
            // Run order. Global setup goes first, global teardown goes last, and the suites between
            // them are alphabetical by the Quench display name.
            testSuiteRegistrars: [
                registerGlobalSetup,
                register5eCalculatedCombatAndFiguredValuesTests,
                registerAdjustmentPowerFadeMatrixTests,
                registerAutomatonTests,
                registerBaseTests,
                registerCombatSkillLevelsTests,
                registerCombatTrackerFixValidationTests,
                registerConfigTests,
                registerDamageFunctionsTests,
                registerDefaultCharacteristicsForEachActorTypeTests,
                registerDefenseTests,
                registerDiceTests,
                registerDropTests,
                registerEndToEndCombatExecutionTests,
                registerEverythingCharacterTests,
                registerFullCharacterTests,
                registerItemActiveEffectSyncTests,
                registerItemEditionAndTypeConversionTests,
                registerManeuverTests,
                registerMathFunctionalityTests,
                registerMovementEndTests,
                registerMovementModeTests,
                registerRequiresRollCheckTests,
                registerSpeedChartCombatValidationTests,
                registerStatusEffectsLogicTests,
                registerUpdatesWithTypeForceReplaceTests,
                registerUploadTests,
                registerVehicleTests,
                registerVisionTests,
                registerWorldTimeRecoveryAndExpiryTests,
                registerGlobalTeardown,
            ],
        };
    }

    /**
     * Register every suite in array order. Quench runs batches in registration order, so the array
     * keeps global setup first and global teardown last. A non-function entry throws here, so a bad
     * registration fails at start-up instead of going missing.
     *
     * @param {object} quench The Quench instance.
     * @param {Function[]} testSuiteRegistrars One registration function per suite, in run order.
     */
    function registerTestSuites(quench, testSuiteRegistrars) {
        for (const registerTestSuite of testSuiteRegistrars) {
            registerTestSuite(quench);
        }
    }

    /**
     * Publish the console API. These functions close over `quench` and the global suite names.
     * The public defaults live here, at the boundary. Every internal function requires its
     * arguments, so a caller cannot rely on a default it cannot see.
     *
     * @param {object} root The module exports this API needs.
     * @param {string} root.setupSuite Global setup suite name, without the system prefix.
     * @param {string} root.teardownSuite Global teardown suite name, without the system prefix.
     * @param {Function} root.deleteQuenchFixtures Deletes every `_Quench` fixture from the world.
     * @param {object} root.chatCleanup The chat clean-up toggle module.
     * @param {Function} root.chatCleanup.isChatCleanupEnabled Reports whether clean-up runs.
     * @param {Function} root.chatCleanup.setChatCleanupEnabled Turns clean-up on or off.
     * @param {string} root.chatCleanup.TOGGLE_STORAGE_KEY The localStorage key that holds the toggle.
     */
    function exposeConsoleApi({ setupSuite, teardownSuite, deleteQuenchFixtures, chatCleanup }) {
        const hooks = { setupSuite, teardownSuite, deleteQuenchFixtures };

        /**
         * Run test suites and resolve to the report of every run.
         *
         * @param {object} [options] Run options.
         * @param {number} [options.numLoops=1] Times to run the selection.
         * @param {number} [options.timeoutInMs=300000] Timeout for one run, in milliseconds.
         * @param {boolean} [options.jsonReport=false] Upload the report to the server as `Data/quench-report.json`.
         * @param {string|string[]|null} [options.suites=null] Suite names without the system prefix. `"**"` runs all.
         * @param {object|null} [options.tests=null] Suite name mapped to single test case titles.
         *
         * @returns {Promise<Array<object>|Error>} One `{ loop, report }` entry per run, or an Error.
         */
        window.herosystem6eRunTests = (options = {}) =>
            runTests(
                {
                    numLoops: options.numLoops ?? 1,
                    timeoutInMs: options.timeoutInMs ?? 5 * 60 * 1000,
                    jsonReport: options.jsonReport ?? false,
                    suites: options.suites ?? null,
                    tests: options.tests ?? null,
                },
                hooks,
            );

        /**
         * List the suite names this system registered.
         *
         * @returns {string[]} Suite names without the system prefix, sorted.
         */
        window.herosystem6eTestSuites = listSuiteNames;

        /**
         * List the test case titles in the given suites.
         *
         * @param {string|string[]} [suites="**"] Suite names without the system prefix.
         *
         * @returns {Promise<object>} Suite name mapped to its sorted test case titles.
         */
        window.herosystem6eTestNames = (suites = "**") => listTestNames(suites, hooks);

        /**
         * Abort the run in flight and clean the world. Pass a timeout when the teardown needs more
         * than the default one minute.
         *
         * @param {object} [options] Teardown options.
         * @param {number} [options.timeoutInMs=60000] Timeout for the teardown run, in milliseconds.
         *
         * @returns {Promise<object|Error>} `{ via, deleted?, teardownReport?, reloadRequired }`, or an Error.
         */
        window.herosystem6eAbortAndRunGlobalTeardown = (options = {}) =>
            abortAndRunGlobalTeardown({
                teardownSuite,
                deleteFixtures: deleteQuenchFixtures,
                timeoutInMs: options.timeoutInMs ?? TEARDOWN_TIMEOUT_MS,
            });

        /**
         * Turn the end-of-run chat clean-up on or off.
         *
         * A run deletes the chat messages it created, so the chat log stays short and the next run
         * does not pay for the last run's output. Turn this off to time a run with the log left in
         * place. The choice is stored in `localStorage`, so it survives a page reload.
         *
         * @returns {object} The console handle.
         */
        window.herosystem6eChatCleanup = {
            enable: () => chatCleanup.setChatCleanupEnabled(true),
            disable: () => chatCleanup.setChatCleanupEnabled(false),

            /**
             * Report the effective clean-up state.
             *
             * @returns {{enabled: boolean, storageKey: string}} The state and where it is stored.
             */
            status: () => ({
                enabled: chatCleanup.isChatCleanupEnabled(),
                storageKey: chatCleanup.TOGGLE_STORAGE_KEY,
            }),
        };
    }

    /**
     * Render the Quench dialog before every run. Quench's reporter writes a line item into the dialog
     * for every suite, test, and failure, and throws when the target element is missing. A closed
     * dialog makes those handlers fail mid-run, so the run never emits `end` and the runner hangs
     * until the timeout.
     *
     * Always render. Never test `rendered` first. A close in flight flips `rendered` to false within
     * one tick but drops the element from the DOM about 100 ms later, so a check-then-render can still
     * hand the run an element that is about to be destroyed. `Application#render` and
     * `Application#close` share one semaphore, so this call waits for any close to finish and then
     * renders a live element.
     */
    async function ensureQuenchDialog() {
        await quench.app.render(true);
    }

    /**
     * Report whether Mocha still holds a run.
     *
     * A run that never wound down keeps this set even after the runner reference clears, and every
     * later `runBatches` call then throws.
     *
     * @returns {boolean} True when Mocha holds a run.
     */
    function mochaHoldsRun() {
        return quench.mocha?._state === "running";
    }

    /**
     * Wait until Mocha no longer holds a run.
     *
     * @param {number} waitMs How long to wait, in milliseconds.
     *
     * @returns {Promise<boolean>} True when Mocha released. False when the wait ran out and only a
     *                            reload clears it.
     */
    async function waitForMochaRelease(waitMs) {
        const deadline = Date.now() + waitMs;

        while (mochaHoldsRun()) {
            if (Date.now() >= deadline) {
                return false;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return true;
    }

    /**
     * Name the reason a new run cannot start.
     *
     * @returns {string|null} The blocking message, or null when a run can start.
     */
    function runBlocker() {
        if (teardownInProgress) {
            return TEARDOWN_BUSY_MESSAGE;
        }

        if (runInProgress || quench._currentRunner) {
            return RUN_BUSY_MESSAGE;
        }

        if (mochaHoldsRun()) {
            return MOCHA_STUCK_MESSAGE;
        }

        return null;
    }

    /**
     * Run test suites from the browser console and return the Mocha JSON report of every run.
     *
     * @example
     *   // Run every suite once.
     *   const reports = await window.herosystem6eRunTests();
     *
     * @example
     *   // Run two suites, five times, and upload the report to Data/quench-report.json.
     *   const reports = await window.herosystem6eRunTests({
     *       suites: ["main", "utils.dice"],
     *       numLoops: 5,
     *       timeoutInMs: 60 * 1000,
     *       jsonReport: true,
     *   });
     *
     * @example
     *   // Run two single test cases, from two different suites, in one call.
     *   const reports = await window.herosystem6eRunTests({
     *       tests: {
     *           main: ["HERO 5e powers should have no validation errors"],
     *           "utils.dice": ["*critical*"],
     *       },
     *   });
     *
     * `suites` takes names, not keys. Glob patterns pass through to Quench: `*` and `?` stop at
     * a `.` separator, `**` crosses it. So `"utils.*"` selects `utils.dice` and `utils.defense`.
     * The global setup and teardown suites always run, and never run twice.
     *
     * `tests` maps a suite name to the test cases to run inside it. Each test case is the test
     * title with its `describe` titles in front, joined by single spaces, as Quench shows them.
     * In a test case, `*` matches any run of characters and `?` matches one character, so
     * `"HERO 5e powers *"` selects every test under that `describe`. Pass `suites` and `tests`
     * together to run whole suites plus single test cases. When a selection matches no test,
     * `runTests` returns an Error and names the selections that matched nothing.
     *
     * @param {object} options Run options. The public defaults live in `exposeConsoleApi`.
     * @param {number} options.numLoops Times to run the selection.
     * @param {number} options.timeoutInMs Timeout for one run, in milliseconds. Firefox slows these
     *                    runs down as it runs more of them, so leave headroom.
     * @param {boolean} options.jsonReport Upload the report to the server as `Data/quench-report.json`.
     *                    Pass true only when the file must reach the server.
     * @param {string|string[]|null} options.suites Suite names without the system prefix. Null means
     *                    the caller left the option out.
     * @param {object|null} options.tests Suite name mapped to single test case titles.
     * @param {object} hooks Global suite names.
     * @param {string} hooks.setupSuite Global setup suite name, without the system prefix.
     * @param {string} hooks.teardownSuite Global teardown suite name, without the system prefix.
     *
     * @returns {Promise<Array<object>|Error>} One `{ loop, report }` entry per run. `report.stats`
     *                    carries the counts, `report.failures` carries each failed test. Returns an
     *                    Error when validation fails or a run fails.
     */
    async function runTests(options, hooks) {
        const blocker = runBlocker();
        if (blocker) {
            return fail(blocker);
        }

        runInProgress = true;
        try {
            await ensureQuenchDialog();

            return await runSelectedTests(options, hooks);
        } finally {
            runInProgress = false;
        }
    }

    /**
     * Run the resolved selection once per loop and collect the reports.
     *
     * @param {object} root The validated run options.
     * @param {number} root.numLoops Times to run the selection.
     * @param {number} root.timeoutInMs Timeout for one run, in milliseconds.
     * @param {boolean} root.jsonReport Upload the report to the server.
     * @param {string|string[]|null} root.suites Suite names without the system prefix.
     * @param {object|null} root.tests Suite name mapped to single test case titles.
     * @param {object} hooks Global suite names and the direct clean-up helper.
     * @param {string} hooks.setupSuite Global setup suite name, without the system prefix.
     * @param {string} hooks.teardownSuite Global teardown suite name, without the system prefix.
     * @param {Function} hooks.deleteQuenchFixtures Deletes every `_Quench` fixture without Mocha.
     *
     * @returns {Promise<Array<object>|Error>} One `{ loop, report }` entry per run, or an Error.
     */
    async function runSelectedTests({ numLoops, timeoutInMs, jsonReport, suites, tests }, hooks) {
        if (!game.modules.get("quench")?.active) {
            ui.notifications.warn(game.i18n.localize("Warning.Quench.Active"));
            throw new Error("Quench not active. Cannot run tests.");
        }

        const requested = suites === null && tests === null ? { suites: "**" } : { suites, tests };
        const resolved = resolveRunTargets(requested, hooks);
        if (resolved.error) {
            return fail(resolved.error.message);
        }

        const reports = [];
        for (let i = 0; i < numLoops; ++i) {
            try {
                console.log(`Start test run ${i + 1} of ${numLoops} (${resolved.keys.length} test suites)`);
                const report = await runTestSuitesOnce({
                    keys: resolved.keys,
                    grep: resolved.grep,
                    timeoutInMs,
                    jsonReport,
                    onTimeout: () => cleanWorldAfterTimeout(hooks),
                });

                const unmatched = unmatchedSelections(resolved.matchers, report);
                if (unmatched.length > 0) {
                    return fail(
                        `No test matched: ${unmatched.join(", ")}. ` +
                            "Call window.herosystem6eTestNames() to list test case titles.",
                    );
                }

                reports.push({ loop: i + 1, report });
            } catch (err) {
                console.error(`Test run failed: ${err}`);
                return err instanceof Error ? err : new Error(String(err));
            }
        }

        console.log(`Completed ${reports.length} test runs`);

        return reports;
    }

    /**
     * Log a failure and return it as an Error for the caller to hand back.
     *
     * @param {string} message The failure message.
     *
     * @returns {Error} The error to return to the caller.
     */
    function fail(message) {
        console.error(message);
        return new Error(message);
    }

    /**
     * List the test suites this system registered. Pass these names in the `suites` option.
     *
     * @returns {string[]} Suite names without the system prefix, sorted.
     */
    function listSuiteNames() {
        return registeredSuiteKeys()
            .filter((key) => key.startsWith(systemPrefix()))
            .map((key) => key.slice(systemPrefix().length))
            .sort();
    }

    /**
     * Build the batch key prefix this system owns.
     *
     * @returns {string} The system id with a trailing dot.
     */
    function systemPrefix() {
        return `${game.system.id}.`;
    }

    /**
     * Turn the `suites` and `tests` options into the batch keys to run, plus the Mocha grep that
     * narrows the run to the selected test cases. `grep` is null when whole suites run. A `null`
     * `suites` means the caller left the option out, so those batch keys stay out.
     *
     * @param {object} root The caller's selection.
     * @param {string|string[]|null} root.suites Suite names without the system prefix.
     * @param {object|null} root.tests Suite name mapped to single test case titles.
     * @param {object} hooks Global suite names.
     * @param {string} hooks.setupSuite Global setup suite name, without the system prefix.
     * @param {string} hooks.teardownSuite Global teardown suite name, without the system prefix.
     *
     * @returns {object} `{ keys, grep, matchers }`, or `{ error }` when the selection is invalid.
     */
    function resolveRunTargets({ suites, tests }, hooks) {
        const whole = suites === null ? { keys: [] } : resolveSuiteKeys(suites, hooks);
        if (whole.error) return whole;
        if (tests == null) return { keys: whole.keys, grep: null, matchers: [] };

        const selection = normalizeTestSelection(tests);
        if (selection.length === 0) {
            return {
                error: new Error(
                    'The "tests" option needs at least one test case title. ' +
                        "Call window.herosystem6eTestNames() to list them.",
                ),
            };
        }

        const keys = new Set(whole.keys);
        const matchers = [];
        const unknownSuites = [];
        for (const { suite, title } of selection) {
            const batchKeys = matchingSuiteKeys(`${systemPrefix()}${suite}`);
            if (batchKeys.length === 0) {
                unknownSuites.push(suite);
                continue;
            }
            for (const key of batchKeys) {
                keys.add(key);
                matchers.push({ label: `${suite} :: ${title}`, re: testCaseRegExp(key, title) });
            }
        }

        if (unknownSuites.length > 0) {
            return {
                error: new Error(
                    `Unknown test suite(s): ${unknownSuites.join(", ")}. ` +
                        "Names exclude the system prefix. Call window.herosystem6eTestSuites() to list them.",
                ),
            };
        }

        // Global setup and teardown must still wrap the run, so match every test in both.
        const hookKeys = [];
        for (const hook of [hooks.setupSuite, hooks.teardownSuite]) {
            const key = `${systemPrefix()}${hook}`;
            if (registeredSuiteKeys().includes(key)) {
                keys.add(key);
                hookKeys.push(key);
            }
        }

        // Whole-suite selections and the global hooks match every test in their batch. The
        // matchers add the single test cases on top.
        const sources = [...new Set([...whole.keys, ...hookKeys])].map(
            (key) => `^${escapeRegExp(batchRootTitle(key))}`,
        );
        sources.push(...matchers.map((matcher) => matcher.re.source));

        return {
            keys: registeredSuiteKeys().filter((key) => keys.has(key)),
            grep: new RegExp(sources.join("|"), "i"),
            matchers,
        };
    }

    /**
     * Accept `{ "<suite name>": "<test case>" }` or `{ "<suite name>": ["<test case>", ...] }`.
     *
     * @param {object} tests The caller's `tests` option.
     *
     * @returns {Array<{suite: string, title: string}>} One entry per non-empty test case title.
     */
    function normalizeTestSelection(tests) {
        if (!tests || typeof tests !== "object" || Array.isArray(tests)) return [];

        const selection = [];
        for (const [suite, value] of Object.entries(tests)) {
            const titles = Array.isArray(value) ? value : [value];
            for (const title of titles) {
                const trimmed = String(title).trim();
                if (trimmed.length > 0) selection.push({ suite: suite.trim(), title: trimmed });
            }
        }
        return selection;
    }

    /**
     * Build the anchored full-title RegExp for one test case. Quench wraps each batch in a suite
     * named `<batch key>_root`, and Mocha joins suite titles with a space, so the full title of
     * a test reads `<batch key>_root <describe titles> <it title>`.
     *
     * @param {string} batchKey The full batch key, including the system prefix.
     * @param {string} title The test case pattern, with `*` and `?` wildcards.
     *
     * @returns {RegExp} The anchored, case-insensitive pattern.
     */
    function testCaseRegExp(batchKey, title) {
        let source = "";
        for (const char of title) {
            if (char === "*") source += ".*";
            else if (char === "?") source += ".";
            else source += escapeRegExp(char);
        }
        return new RegExp(`^${escapeRegExp(batchRootTitle(batchKey))} ${source}$`, "i");
    }

    /**
     * Build the suite title Quench gives a batch.
     *
     * @param {string} batchKey The full batch key, including the system prefix.
     *
     * @returns {string} The batch key with a `_root` suffix.
     */
    function batchRootTitle(batchKey) {
        return `${batchKey}_root`;
    }

    /**
     * Report the selections that no executed test matched, so a typo cannot pass silently.
     *
     * @param {Array<{label: string, re: RegExp}>} matchers One matcher per selected test case.
     * @param {object} report The Mocha JSON report of the run.
     *
     * @returns {string[]} The labels nothing matched.
     */
    function unmatchedSelections(matchers, report) {
        if (matchers.length === 0) return [];

        const executed = executedFullTitles(report);
        return matchers.filter((matcher) => !executed.some((title) => matcher.re.test(title))).map((m) => m.label);
    }

    /**
     * Collect the full titles of every test the report covers.
     *
     * @param {object} report The Mocha JSON report of the run.
     *
     * @returns {string[]} The full titles of the passed, failed, and pending tests.
     */
    function executedFullTitles(report) {
        if (!report) return [];
        const lists = [report.passes ?? [], report.failures ?? [], report.pending ?? []];
        return lists
            .flat()
            .map((test) => test?.fullTitle)
            .filter(Boolean);
    }

    /**
     * Turn the `suites` option into the exact batch keys to run, in registration order. Registration
     * order keeps global setup first and global teardown last.
     *
     * @param {string|string[]} suites Suite names without the system prefix.
     * @param {object} hooks Global suite names.
     * @param {string} hooks.setupSuite Global setup suite name, without the system prefix.
     * @param {string} hooks.teardownSuite Global teardown suite name, without the system prefix.
     *
     * @returns {object} `{ keys }`, or `{ error }` when a name matches no batch.
     */
    function resolveSuiteKeys(suites, { setupSuite, teardownSuite }) {
        const requested = normalizeSuiteNames(suites);
        if (requested.length === 0) {
            return {
                error: new Error(
                    'No test suites specified. Pass names such as { suites: ["main"] }, ' +
                        "or call window.herosystem6eTestSuites() to list them.",
                ),
            };
        }

        const names = [...requested];
        for (const hook of [setupSuite, teardownSuite]) {
            if (!names.includes(hook)) names.push(hook);
        }

        const matched = new Set();
        const unknown = [];
        for (const name of names) {
            const keys = matchingSuiteKeys(`${systemPrefix()}${name}`);
            if (keys.length === 0) {
                unknown.push(name);
            } else {
                keys.forEach((key) => matched.add(key));
            }
        }

        if (unknown.length > 0) {
            return {
                error: new Error(
                    `Unknown test suite(s): ${unknown.join(", ")}. ` +
                        "Names exclude the system prefix. Call window.herosystem6eTestSuites() to list them.",
                ),
            };
        }

        return { keys: registeredSuiteKeys().filter((key) => matched.has(key)) };
    }

    /**
     * Normalise the `suites` option to a list of trimmed, non-empty names.
     *
     * @param {string|string[]} suites One name or a list of names.
     *
     * @returns {string[]} The trimmed, non-empty names.
     */
    function normalizeSuiteNames(suites) {
        const list = Array.isArray(suites) ? suites : [suites];
        return list.map((name) => String(name).trim()).filter((name) => name.length > 0);
    }

    /**
     * Match a batch key pattern against the registered batches. Quench matches batch keys with
     * wildcard-match, so use its own matcher when available. That keeps validation from disagreeing
     * with the run.
     *
     * @param {string} pattern A batch key or glob, including the system prefix.
     *
     * @returns {string[]} The batch keys that match, in registration order.
     */
    function matchingSuiteKeys(pattern) {
        if (typeof quench?._filterBatches === "function") {
            return quench._filterBatches(pattern, { preSelectedOnly: false });
        }
        return registeredSuiteKeys().filter((key) => globToRegExp(pattern).test(key));
    }

    /**
     * List every registered batch key.
     *
     * @returns {string[]} The keys of Quench's batch registry, empty when Quench holds none.
     */
    function registeredSuiteKeys() {
        const batches = quench?._testBatches;
        if (!batches) return [];
        if (typeof batches.keys === "function") return Array.from(batches.keys());
        return Array.from(batches, ([key]) => key);
    }

    /**
     * Translate a Quench glob into a RegExp. `**` crosses the `.` separator, `*` and `?` do not.
     *
     * @param {string} pattern The glob to translate.
     *
     * @returns {RegExp} The anchored, case-insensitive pattern.
     */
    function globToRegExp(pattern) {
        let source = "";
        for (let i = 0; i < pattern.length; ++i) {
            const char = pattern[i];
            if (char === "*") {
                if (pattern[i + 1] === "*") {
                    source += ".*";
                    ++i;
                } else {
                    source += "[^.]*";
                }
            } else if (char === "?") {
                source += "[^.]";
            } else {
                source += escapeRegExp(char);
            }
        }
        return new RegExp(`^${source}$`, "i");
    }

    /**
     * Escape the RegExp metacharacters in a literal string.
     *
     * @param {string} text The text to escape.
     *
     * @returns {string} Text safe to embed in a RegExp source.
     */
    function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * List the test cases in the given suites. Quench builds the test tree only when a run starts,
     * so this runs the suites in Mocha dry-run mode: it registers every test and skips every test
     * body and hook. Keys and titles drop the system prefix, so they match what the `suites` and
     * `tests` options take.
     *
     * @param {string|string[]} suites Suite names without the system prefix.
     * @param {object} hooks Global suite names.
     * @param {string} hooks.setupSuite Global setup suite name, without the system prefix.
     * @param {string} hooks.teardownSuite Global teardown suite name, without the system prefix.
     *
     * @returns {Promise<object>} Suite name mapped to its sorted test case titles.
     *
     * @throws {Error} When a run blocks this call, or when a suite name matches no batch.
     */
    async function listTestNames(suites, { setupSuite, teardownSuite }) {
        const blocker = runBlocker();
        if (blocker) {
            throw new Error(blocker);
        }

        runInProgress = true;
        try {
            await ensureQuenchDialog();

            const resolved = resolveSuiteKeys(suites, { setupSuite, teardownSuite });
            if (resolved.error) throw resolved.error;

            quench.mocha.dryRun(true);
            try {
                const dryRunner = await quench.runBatches(resolved.keys, {
                    updateSnapshots: false,
                    preSelectedOnly: false,
                });
                const tree = dryRunner.suite;
                await new Promise((resolve) => dryRunner.once("end", resolve));
                return testCasesBySuite(tree);
            } finally {
                quench.mocha.dryRun(false);
            }
        } finally {
            runInProgress = false;
        }
    }

    /**
     * Group the test titles under the suite name this system registered.
     *
     * @param {object} rootSuite The Mocha root suite of the dry run.
     *
     * @returns {object} Suite name without the system prefix, mapped to its sorted test titles.
     */
    function testCasesBySuite(rootSuite) {
        const bySuite = {};
        const prefix = systemPrefix();
        for (const batchSuite of rootSuite?.suites ?? []) {
            const key = batchSuite.title.replace(/_root$/, "");
            if (!key.startsWith(prefix)) continue;
            const titles = [];
            batchSuite.eachTest((test) => titles.push(test.fullTitle().slice(batchSuite.title.length + 1)));
            bySuite[key.slice(prefix.length)] = titles.sort();
        }
        return bySuite;
    }

    /**
     * Run one set of batches once and resolve to the parsed report.
     *
     * @param {object} root The resolved run targets.
     * @param {string[]} root.keys The batch keys to run.
     * @param {RegExp|null} root.grep Narrows the run to selected test cases. Null runs whole suites.
     * @param {number} root.timeoutInMs Timeout for this run, in milliseconds.
     * @param {boolean} root.jsonReport Upload the report to the server.
     * @param {Function} [root.onTimeout] Runs after a timeout aborts the run. Its return value is
     *                    appended to the rejection message. Omit it to skip the clean-up hand-off.
     *
     * @returns {Promise<object>} The parsed Mocha JSON report.
     *
     * @throws {Error} When the run exceeds `timeoutInMs` and the runner was released.
     */
    async function runTestSuitesOnce({ keys, grep, timeoutInMs, jsonReport, onTimeout }) {
        // Mocha copies `options.grep` into its runner when the run starts inside `runBatches`.
        // Set it just before, and clear it as soon as the runner holds its own copy, so a
        // filtered run cannot leak into the next one.
        quench.mocha.grep(grep ?? undefined);
        let mochaRunner;
        try {
            mochaRunner = await quench.runBatches(keys, {
                updateSnapshots: false,
                preSelectedOnly: false,
                json: jsonReport,
            });
        } finally {
            quench.mocha.grep(undefined);
        }

        let timedOut = false;
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(handleTimeout, timeoutInMs);

            mochaRunner.on("end", () => {
                if (timedOut) return;

                clearTimeout(timeoutId);
                finishRunner(mochaRunner);

                // Quench's reporter stores the JSON report before this handler runs.
                resolve(readJsonReport());
            });

            // Abort, hand the world to the caller to clean, then reject. `finishRunner` runs inside
            // `abortRunner`, so the `end` handler above never races it for the dispose.
            async function handleTimeout() {
                timedOut = true;

                try {
                    await abortRunner(mochaRunner);
                } catch (err) {
                    reject(new Error(`Test suite took too long (${timeoutInMs} ms) - abort failed: ${err}`));
                    return;
                }

                let note;
                try {
                    note = await onTimeout?.();
                } catch (err) {
                    note = `clean-up failed: ${err}`;
                }

                reject(new Error(`Test suite took too long (${timeoutInMs} ms) - aborted${note ? `; ${note}` : ""}`));
            }
        });
    }

    /**
     * Drop Quench's reference to one runner.
     *
     * @param {object} runner The runner whose reference to drop.
     */
    function clearRunnerReference(runner) {
        if (quench._currentRunner === runner) {
            quench._currentRunner = undefined;
        }
    }

    /**
     * Finish one runner: drop Quench's reference, then dispose it.
     *
     * Idempotent per runner. The normal run path and every abort path finish the same runner, so the
     * first caller does the work and later callers do nothing. A second `dispose()` would tear at
     * listeners Mocha already removed.
     *
     * @param {object} runner The runner to finish.
     *
     * @returns {boolean} True when this call did the work.
     */
    function finishRunner(runner) {
        if (finishedRunners.has(runner)) {
            return false;
        }

        finishedRunners.add(runner);
        clearRunnerReference(runner);
        runner.dispose();
        return true;
    }

    /**
     * Abort a runner and wait for it to release.
     *
     * Idempotent per runner, because the timeout path and the console abort can target one runner.
     *
     * @param {object} runner The runner to abort.
     *
     * @returns {Promise<void>} Resolves when the runner ends or the grace period runs out.
     */
    async function abortRunner(runner) {
        if (finishedRunners.has(runner)) {
            return;
        }

        runner.abort();
        await releaseRunner(runner);
    }

    /**
     * Release an aborted runner so a later run can start.
     *
     * Quench clears its own runner reference inside its `end` handler. Calling `dispose()` before
     * that handler runs removes the handler and leaves the reference set forever, which makes every
     * later `runBatches` fail with "Mocha instance is currently running tests". So abort, let the
     * run end, then dispose.
     *
     * When the grace period runs out, drop the reference but do not dispose. `dispose()` removes
     * every listener, including the one Mocha uses to resolve its own run promise. Disposing a run
     * that has not ended strands that promise: the run never resolves and Mocha never leaves the
     * "running" state. Leaving the listeners in place lets the wind-down finish and clear the state.
     *
     * One promise per runner, cached. Several callers share one grace timer and one `end` listener.
     *
     * @param {object} runner The runner to release.
     *
     * @returns {Promise<void>} Resolves once the runner reference is dropped.
     */
    function releaseRunner(runner) {
        if (releasePromises.has(runner)) {
            return releasePromises.get(runner);
        }

        const released = new Promise((resolve) => {
            let settled = false;

            runner.once("end", () => {
                if (settled) {
                    return;
                }

                settled = true;
                finishRunner(runner);
                resolve();
            });

            setTimeout(() => {
                if (settled) {
                    return;
                }

                settled = true;
                clearRunnerReference(runner);
                resolve();
            }, ABORT_GRACE_MS);
        });

        releasePromises.set(runner, released);
        return released;
    }

    /**
     * Abort the run in flight, then clean the world.
     *
     * A normal run finishes with the global teardown batch, which deletes the `_Quench` actors,
     * tokens, combats, and scenes the suites created. An abort skips that batch on purpose, so the
     * fixtures stay in the world. That is the designed behaviour: an abort stops work, it does not
     * clean up. Call this when you aborted a run and need a clean world for the next one.
     *
     * This path ignores `runInProgress` on purpose. The run that set that flag is the run this call
     * aborts. Guarding on it would block the only way out of a stuck run.
     *
     * Two clean-up paths, in order of preference:
     *
     * 1. Mocha released. Run the global teardown batch. No test code runs and no setup re-runs.
     * 2. Mocha still holds the run. A test that ignores the abort keeps the run open, so the batch
     *    cannot run. Delete the fixtures directly with the same helpers the batch uses.
     *
     * @param {object} root The teardown targets.
     * @param {string} root.teardownSuite Global teardown suite name, without the system prefix.
     * @param {Function} root.deleteFixtures Deletes every `_Quench` fixture without Mocha.
     * @param {number} root.timeoutInMs Timeout for the teardown run, in milliseconds.
     *
     * @returns {Promise<object|Error>} `{ via, deleted?, teardownReport?, reloadRequired }`. `via`
     *                    is `"mocha"` or `"direct"`. `reloadRequired` is true when Mocha still holds
     *                    the run, because Mocha cannot start a second run while it holds the first.
     *                    Returns an Error when Quench is inactive, when the teardown suite is
     *                    missing, or when another teardown already runs.
     */
    async function abortAndRunGlobalTeardown({ teardownSuite, deleteFixtures, timeoutInMs }) {
        if (!game.modules.get("quench")?.active) {
            return fail("Quench not active. Cannot run global teardown.");
        }

        const teardownKey = `${systemPrefix()}${teardownSuite}`;

        if (!registeredSuiteKeys().includes(teardownKey)) {
            return fail(`Global teardown suite is not registered: ${teardownKey}`);
        }

        if (teardownInProgress) {
            return fail(TEARDOWN_BUSY_MESSAGE);
        }

        teardownInProgress = true;

        try {
            await ensureQuenchDialog();

            const runner = quench._currentRunner;

            if (runner) {
                await abortRunner(runner);
            }

            // The aborted run is over. Clear its flag so a run whose promise never settles cannot
            // leave this API stuck busy.
            runInProgress = false;

            if (await waitForMochaRelease(MOCHA_RELEASE_WAIT_MS)) {
                console.log(`Running global teardown after abort (${teardownKey})`);

                const teardownReport = await runTestSuitesOnce({
                    keys: [teardownKey],
                    grep: null,
                    timeoutInMs,
                    jsonReport: false,
                });

                return { via: "mocha", teardownReport, reloadRequired: false };
            }

            // Mocha cannot run the batch. Clean the world directly so the next run starts from an
            // empty slate. The stuck run keeps its abandoned promise, so a reload is still needed
            // before Mocha can run again.
            console.warn(
                `Mocha still holds the aborted run. Deleting fixtures directly instead of running ${teardownKey}.`,
            );

            const deleted = await deleteFixtures();

            return { via: "direct", deleted, reloadRequired: true };
        } catch (err) {
            console.error(`Global teardown after abort failed: ${err}`);
            return err instanceof Error ? err : new Error(String(err));
        } finally {
            teardownInProgress = false;
        }
    }

    /**
     * Clean the world after a run times out.
     *
     * A timed-out run skips the global teardown batch the same way a manual abort does, so the
     * `_Quench` fixtures stay in the world. Hand the clean-up to `abortAndRunGlobalTeardown` so a
     * timeout leaves the same clean slate a clean run leaves.
     *
     * @param {object} hooks Global suite names and the direct clean-up helper.
     * @param {string} hooks.teardownSuite Global teardown suite name, without the system prefix.
     * @param {Function} hooks.deleteQuenchFixtures Deletes every `_Quench` fixture without Mocha.
     *
     * @returns {Promise<string>} A note describing the clean-up, for the timeout error message.
     */
    async function cleanWorldAfterTimeout({ teardownSuite, deleteQuenchFixtures }) {
        const result = await abortAndRunGlobalTeardown({
            teardownSuite,
            deleteFixtures: deleteQuenchFixtures,
            timeoutInMs: TEARDOWN_TIMEOUT_MS,
        });

        if (result instanceof Error) {
            return `global teardown failed: ${result.message}`;
        }

        if (result.via === "mocha") {
            return "global teardown ran";
        }

        const count = countDeleted(result.deleted);
        return `deleted ${count} fixtures directly; reload the window before Mocha can run again`;
    }

    /**
     * Total a `{ type: count }` clean-up tally.
     *
     * @param {object} tally Counts keyed by fixture type.
     *
     * @returns {number} The sum of the counts.
     */
    function countDeleted(tally = {}) {
        return Object.values(tally).reduce((sum, count) => sum + (Number(count) || 0), 0);
    }

    /**
     * Read the Mocha JSON report Quench stored after the last run.
     *
     * @returns {object|null} The parsed report, or null when absent.
     */
    function readJsonReport() {
        const raw = quench?.reports?.json;
        if (!raw) return null;
        return JSON.parse(raw);
    }
});
