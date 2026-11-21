import gulp from "gulp";
import gulpAutoPrefix from "gulp-autoprefixer";
import gulpSass from "gulp-sass";
import * as dartSass from "sass";
import stylelint from "stylelint";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const sass = gulpSass(dartSass);

const SASS_FILES = ["scss/**/*.scss"];
const SASS_ENTRY = "scss/herosystem6e.scss";
const JAVASCRIPT_FILES = ["**/*.js", "**/*.mjs", "!node_modules/**"];
const MARKDOWN_FILES = ["**/*.md", "!node_modules/**"];

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Pass the config path, not a resolved config object. stylelint then skips its
// per-file config search but still applies the config's own `overrides` blocks.
const STYLELINT_CONFIG = path.join(ROOT, "stylelint.config.mjs");
// Batch window for watch events. One edit usually touches several files.
const WATCH_DELAY_MS = 1000;

/* ----------------------------------------- */
/*  Source Code Standard Validation
/* ----------------------------------------- */

// oxlint and oxfmt are native CLIs rather than gulp plugins, so they are spawned as
// child processes instead of being piped into. They are invoked through Node
// (rather than the node_modules/.bin shim) so that the task works regardless of
// whether the working tree sits on a UNC/mapped path, which cmd.exe refuses to use
// as a working directory.
function resolveBin(pkg, name) {
    return path.join(path.dirname(require.resolve(`${pkg}/package.json`)), "bin", name);
}

const oxlintBin = resolveBin("oxlint", "oxlint");
const oxfmtBin = resolveBin("oxfmt", "oxfmt");

// Pass every config path on the command line. Each tool otherwise searches from the
// working directory. When that search misses, oxfmt silently reformats the whole tree
// to its 2 space default instead of the 4 spaces this repo uses. A missing file now
// fails the task with exit 1 instead.
const OXLINT_CONFIG = path.join(ROOT, ".oxlintrc.json");
const OXFMT_CONFIG = path.join(ROOT, ".oxfmtrc.json");
// Anchor the ignore list too. oxfmt otherwise reads .gitignore from the working directory.
const GITIGNORE = path.join(ROOT, ".gitignore");

// Run a native CLI, label its timing line, and resolve with the exit code.
// The CLI prints "Finished in ..." with no owner named. The native binding owns that
// string, so rewrite it here. Print a labelled line when the CLI prints none.
function spawnTool(name, binPath, args) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [binPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
        let labelled = false;
        const labelLine = (line) => {
            if (!line.startsWith("Finished in ")) {
                return line;
            }
            labelled = true;
            return line.replace(/^Finished in /, `${name} finished in `);
        };
        const forward = (source, sink) => {
            let rest = "";
            source.setEncoding("utf8");
            source.on("data", (chunk) => {
                rest += chunk;
                const lines = rest.split("\n");
                rest = lines.pop() ?? "";
                for (const line of lines) {
                    sink.write(`${labelLine(line)}\n`);
                }
            });
            source.on("end", () => {
                if (rest !== "") {
                    sink.write(`${labelLine(rest)}\n`);
                    rest = "";
                }
            });
        };
        forward(child.stdout, process.stdout);
        forward(child.stderr, process.stderr);
        child.on("error", reject);
        child.on("close", (code) => {
            if (!labelled) {
                console.log(`${name} finished in ${Date.now() - startedAt}ms.`);
            }
            resolve(code ?? 1);
        });
    });
}

function spawnOxlint(args) {
    return spawnTool("oxlint", oxlintBin, ["--config", OXLINT_CONFIG, ...args]);
}

function spawnOxfmt(args) {
    return spawnTool("oxfmt", oxfmtBin, ["--config", OXFMT_CONFIG, "--ignore-path", GITIGNORE, ...args]);
}

// Reject with a clean message when a CLI reports a failure.
// `showStack = false` stops gulp-cli from printing a stack trace. The CLI already
// printed every finding, so the trace adds noise. The task still fails with exit 1.
function runTool(name, fixScript, run) {
    return run.then((code) => {
        if (code === 0) {
            return;
        }
        const err = new Error(
            `${name} reported problems (exit code ${code}). Run \`npm run ${fixScript}\` to correct them.`,
        );
        err.showStack = false;
        throw err;
    });
}

function runOxlint(args) {
    return runTool("oxlint", "lint:fix", spawnOxlint(args));
}

/* ----------------------------------------- */
/*  Type-aware lint
/* ----------------------------------------- */

// Type-aware linting runs through tsgolint, which loads the TypeScript engine. It is opt-in:
// no rule below joins `lint`, `validate`, `build`, or `watch` until the findings are triaged.
const TYPELINT_CONFIG = path.join(ROOT, ".oxlintrc.typelint.json");
// tsgolint finds its program by walking up from each linted file, so the program config must
// sit at the repo root under the standard name. oxlint's `--tsconfig` flag only feeds import
// resolution; it does not select the program. Measured with oxlint 1.87.
const TYPELINT_PROGRAM = path.join(ROOT, "jsconfig.json");
const TYPELINT_PROGRAM_TEMPLATE = path.join(ROOT, "tools", "typelint", "jsconfig.json");

// Publish the program config for the duration of one run, then remove it. Keeping the tracked
// copy under `tools/` leaves the editor out: a `jsconfig.json` at the repo root makes VS Code
// open the folder as a TypeScript project.
async function spawnTypeAwareLint(args) {
    fs.copyFileSync(TYPELINT_PROGRAM_TEMPLATE, TYPELINT_PROGRAM);
    try {
        return await spawnTool("oxlint", oxlintBin, ["--config", TYPELINT_CONFIG, "--type-aware", ...args]);
    } finally {
        fs.rmSync(TYPELINT_PROGRAM, { force: true });
    }
}

// Report type-aware findings. Every added rule warns, so this exits 0 today.
function lintTypes() {
    return spawnTypeAwareLint(["."]);
}

// Same run, plus TypeScript compiler diagnostics. A file needs `// @ts-check`, or the template
// needs `checkJs: true`, for those to appear. Reports thousands of findings today.
function lintTypesCheck() {
    return spawnTypeAwareLint(["--type-check", "."]);
}

function runOxfmt(args) {
    return runTool("oxfmt", "format:fix", spawnOxfmt(args));
}

function validateJavaScriptFilesByLint() {
    return runOxlint(["."]);
}

/* ----------------------------------------- */
/*  SCSS: stylelint owns formatting and linting
/* ----------------------------------------- */

// stylelint loads once at module import. Every run reuses that instance.
// Pass `configFile` so stylelint skips config discovery on each file.
function lintScss(files, { fix = false } = {}) {
    const startedAt = Date.now();
    return stylelint.lint({ files, fix, configFile: STYLELINT_CONFIG, formatter: "string" }).then((result) => {
        console.log(`stylelint finished in ${Date.now() - startedAt}ms.`);
        return result;
    });
}

// Report SCSS findings and fail the task. `fix` rewrites files that stylelint can correct.
async function runScssLint(files, { fix }) {
    const result = await lintScss(files, { fix });
    if (result.report) {
        console[fix ? "log" : "error"](result.report);
    }
    if (!result.errored) {
        return;
    }
    const hint = fix ? "Correct the rest by hand." : "Run `npm run lint:fix` or `npm run format:fix` to correct them.";
    const err = new Error(`stylelint reported problems. ${hint}`);
    err.showStack = false;
    throw err;
}

function validateScssFilesByLint() {
    return runScssLint(SASS_FILES, { fix: false });
}
const lint = gulp.parallel(validateJavaScriptFilesByLint, validateScssFilesByLint);

function autoFixJavaScriptFilesByLint() {
    // `--fix-suggestions` is required because some oxlint corrections (for example
    // no-extra-boolean-cast) are published as suggestions rather than fixes.
    return runOxlint([".", "--fix", "--fix-suggestions"]);
}

function autoFixScssFilesByLint() {
    return runScssLint(SASS_FILES, { fix: true });
}
const lintAutoFix = gulp.parallel(autoFixJavaScriptFilesByLint, autoFixScssFilesByLint);

// oxfmt picks its files itself. It honours the `.gitignore` passed with `--ignore-path`
// and the ignorePatterns in .oxfmtrc.json, so this task passes no globs. Those
// patterns exclude SCSS.
// `format` only reports. `formatAutoFix` rewrites the files. This mirrors `lint` and `lintAutoFix`.
// SCSS formatting comes from stylelint, because oxfmt skips .scss files.
function validateFilesByFormat() {
    return runOxfmt([".", "--check"]);
}
const format = gulp.parallel(validateFilesByFormat, validateScssFilesByLint);

function autoFixFilesByFormat() {
    return runOxfmt(["."]);
}
const formatAutoFix = gulp.parallel(autoFixFilesByFormat, autoFixScssFilesByLint);

const validate = gulp.parallel(validateJavaScriptFilesByLint, validateScssFilesByLint, validateFilesByFormat);
const autoFix = gulp.series(autoFixJavaScriptFilesByLint, autoFixScssFilesByLint, autoFixFilesByFormat);

/* ----------------------------------------- */
/*  Advisory (non-fatal) checks for build and watch
/* ----------------------------------------- */

// Each reporter returns true when it found a problem. Each takes the files to check.
async function reportJavaScriptByLint(files) {
    const code = await spawnOxlint(files);
    return code !== 0;
}

async function reportScssByLint(files) {
    const result = await lintScss(files, { fix: false });
    if (result.report) {
        console.warn(result.report);
    }
    return result.errored;
}

async function reportFilesByFormat(files) {
    const code = await spawnOxfmt([...files, "--check"]);
    return code !== 0;
}

// Run the requested checks in parallel. An empty list skips that tool.
async function runChecks({ js = [], scss = [], format = [] }) {
    const state = { js: false, scss: false, format: false };
    const jobs = [];
    if (js.length > 0) {
        jobs.push(reportJavaScriptByLint(js).then((found) => (state.js = found)));
    }
    if (scss.length > 0) {
        jobs.push(reportScssByLint(scss).then((found) => (state.scss = found)));
    }
    if (format.length > 0) {
        jobs.push(reportFilesByFormat(format).then((found) => (state.format = found)));
    }
    try {
        await Promise.all(jobs);
    } catch (err) {
        console.error(`Checks could not run: ${err?.message ?? err}`);
        return { js: true, scss: true, format: true };
    }
    return state;
}

// Print every lint finding, then continue regardless of the result.
async function reportLintChecks() {
    const state = await runChecks({ js: ["."], scss: SASS_FILES });
    if (!state.js && !state.scss) {
        console.warn("Lint found no problems.");
        return;
    }
    console.warn("Lint reported problems above. The build continues. Run `npm run lint:fix` to correct them.");
}

// Print every validation finding, then keep the watch loop alive.
async function reportValidationChecks() {
    const state = await runChecks({ js: ["."], scss: SASS_FILES, format: ["."] });
    if (!state.js && !state.scss && !state.format) {
        console.warn("Validation found no problems.");
        return;
    }
    console.warn("Validation reported problems above. The watch loop continues.");
}

// Check only the files the watcher reported. oxfmt covers the JS and Markdown paths.
async function reportWatchChecks({ js, scss, md }) {
    const state = await runChecks({ js, scss, format: [...js, ...md] });
    if (!state.js && !state.scss && !state.format) {
        console.warn("Watch checks found no problems.");
        return;
    }
    console.warn("Watch checks reported problems above. The watch loop continues.");
}

const lintWithoutFailing = gulp.series(reportLintChecks);
const validateWithoutFailing = gulp.series(reportValidationChecks);

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

// Small error handler helper function.
function handleError(err) {
    console.error(err.toString());
    this.emit("end");
}

function compileSass() {
    // Configure options for sass output. For example, "expanded" or "nested"
    let options = {
        style: "expanded",
    };
    return gulp
        .src(SASS_ENTRY)
        .pipe(sass.sync(options).on("error", handleError))
        .pipe(
            gulpAutoPrefix({
                cascade: false,
            }),
        )
        .pipe(gulp.dest("./css"));
}
const css = gulp.series(compileSass);

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
    gulp.watch(SASS_FILES, css);

    // Collect changed paths per tool group, then run one batched check.
    // Only changed files reach a tool, so a one file edit costs one file check.
    const pending = { js: new Set(), scss: new Set(), md: new Set() };
    let timer = null;

    function flush() {
        const batch = { js: [...pending.js], scss: [...pending.scss], md: [...pending.md] };
        pending.js.clear();
        pending.scss.clear();
        pending.md.clear();
        timer = null;
        reportWatchChecks(batch).catch((err) => {
            console.error(`Watch check failed: ${err?.message ?? err}`);
        });
    }

    function schedule() {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(flush, WATCH_DELAY_MS);
    }

    // Pass no task to gulp.watch. It would receive no event object anyway. The
    // chokidar events below carry the changed paths. A placeholder task would log
    // a useless stage for every batch.
    function observe(group, globs) {
        const watcher = gulp.watch(globs, { ignoreInitial: false });
        watcher.on("add", (filePath) => {
            pending[group].add(filePath);
            schedule();
        });
        watcher.on("change", (filePath) => {
            pending[group].add(filePath);
            schedule();
        });
    }

    // ignoreInitial: false makes the first scan emit `add` events, so startup checks every file.
    observe("js", JAVASCRIPT_FILES);
    observe("scss", SASS_FILES);
    observe("md", MARKDOWN_FILES);
}

/* ----------------------------------------- */
/*  Default Task
/* ----------------------------------------- */

const defaultGulpTask = gulp.series(compileSass, watchUpdates);

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

export {
    defaultGulpTask as default,
    css,
    lint,
    format,
    validate,
    autoFix,
    lintAutoFix,
    formatAutoFix,
    lintWithoutFailing,
    validateWithoutFailing,
    lintTypes,
    lintTypesCheck,
};
