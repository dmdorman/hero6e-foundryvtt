import gulp from "gulp";
import gulpAutoPrefix from "gulp-autoprefixer";
import gulpEslintNew from "gulp-eslint-new";
import gulpPrettier from "gulp-prettier";
import gulpSass from "gulp-sass";
import * as dartSass from "sass";

const sass = gulpSass(dartSass);

const SASS_FILES = ["scss/**/*.scss"];
const JAVASCRIPT_FILES = ["**/*.js", "**/*.mjs", "!node_modules/**"];

/* ----------------------------------------- */
/*  Source Code Standard Validation
/* ----------------------------------------- */

const eslintDefaultConfig = { overrideConfigFile: "eslint.config.mjs" };
const eslintFixConfig = { fix: true };

function validateFilesByLint() {
    return gulp
        .src(JAVASCRIPT_FILES)
        .pipe(gulpEslintNew(eslintDefaultConfig))
        .pipe(gulpEslintNew.formatEach("compact", process.stderr))
        .pipe(gulpEslintNew.failAfterError());
}
const lint = gulp.series(validateFilesByLint);

function autoFixFilesByLint() {
    return gulp
        .src(JAVASCRIPT_FILES)
        .pipe(gulpEslintNew({ ...eslintDefaultConfig, ...eslintFixConfig }))
        .pipe(gulpEslintNew.fix())
        .pipe(gulpEslintNew.formatEach("compact", process.stderr))
        .pipe(gulpEslintNew.failAfterError());
}
const lintAutoFix = gulp.series(autoFixFilesByLint);

function validateFilesByPrettier() {
    return gulp.src(JAVASCRIPT_FILES).pipe(gulpPrettier.check());
}
const prettier = gulp.series(validateFilesByPrettier);

function autoFixFilesByPrettier() {
    return gulp
        .src(JAVASCRIPT_FILES)
        .pipe(gulpPrettier())
        .pipe(gulp.dest((file) => file.base));
}
const prettierAutoFix = gulp.series(autoFixFilesByPrettier);

const validate = gulp.parallel(validateFilesByLint, validateFilesByPrettier);
const autoFix = gulp.series(autoFixFilesByPrettier, autoFixFilesByLint);

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
        outputStyle: "expanded",
    };
    return gulp
        .src(SASS_FILES)
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
    gulp.watch(JAVASCRIPT_FILES, validate);
}

/* ----------------------------------------- */
/*  Default Task
/* ----------------------------------------- */

const defaultGulpTask = gulp.series(compileSass, watchUpdates);

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

export { defaultGulpTask as default, css, lint, prettier, validate, autoFix, lintAutoFix, prettierAutoFix };
