/**
 * Number input validation for sheets.
 *
 * The markup declares each field with standard HTML attributes alone. `step` sets the number of
 * decimal places, and `min` and `max` bound the value. Four declarations cover the basic numeric
 * types. The markup is what this module reads; the Name column only states what each one means.
 *
 * | Name                      | Markup                                        | Example values  |
 * | ------------------------- | --------------------------------------------- | --------------- |
 * | integers                  | `step="1"`                                    | -5, 0, 42       |
 * | whole numbers             | `step="1" min="0"`                            | 0, 1, 42        |
 * | real numbers              | `step="0.1"` or `step="0.01"`                 | -1.5, 0, 2.75   |
 * | non-negative real numbers | `step="0.1" min="0"` or `step="0.01" min="0"` | 0, 0.25, 2.75   |
 *
 * `step` picks the precision. `1` allows no decimal point, `0.1` allows one place, and `0.01` allows
 * two. `min` picks the sign. An absent `min`, or one below zero, admits a minus; `min="0"` or above
 * does not. A range that reaches far into the negatives needs no declaration, because no `min` means
 * no floor. `min="-5" max="-3"` takes `-5`, `-4`, and `-3`, and refuses `-2` and `0`.
 *
 * Add `max` to cap the top of a range.
 *
 * A typed `-0` becomes `0` here, before any comparison runs, so no field can store negative zero. The
 * same normalising drops leading zeros, so `010` reads as `10` and `-010` reads as `-10`.
 *
 * The browser enforces what it can during typing. This module is the backstop, because a cleared
 * `input type="number"` still reports an empty string and a browser still accepts an exponent such as
 * `1e5`.
 *
 * `commitNumericInput` is the entry point both sheets use. A sheet hands it the input and a writer, and the
 * writer sees only an accepted value.
 *
 * The adder and modifier editor persists on form submit rather than on one input's change, so it cannot use
 * `commitNumericInput`. It calls `declaresNumberContract`, `validateNumericInput`, and `rejectNumericInput`
 * directly, so both paths read the same markup contract and raise the same message.
 */

/** Allowed `step` values, mapped to the decimal places they permit. */
export const NUMBER_STEPS = Object.freeze({ 1: 0, 0.1: 1, 0.01: 2 });

/**
 * Sign part of the value pattern.
 *
 * A leading minus is legal text in every shape. The `min` bound decides whether the value survives.
 */
const SIGN_PATTERN = "[+-]?";

/** Thrown when markup does not declare a usable number contract. */
export class InputElementNumberSchemaError extends Error {
    /**
     * Build the error.
     *
     * @param {string} reason Why the declaration is unusable.
     * @param {HTMLInputElement} input The input with the bad declaration.
     */
    constructor(reason, input) {
        super(`${reason}. ${describeElement(input)}`);

        this.name = "InputElementNumberSchemaError";
        this.reason = reason;
        this.element = describeElement(input);
    }
}

/**
 * Dump the markup of one input, for error messages.
 *
 * An `input` has no inner HTML, so the dump is the element itself.
 *
 * @param {HTMLInputElement} input The input to describe.
 *
 * @returns {string} The outer HTML, cut to 400 characters.
 */
export function describeElement(input) {
    if (!input || typeof input !== "object") {
        return `element: ${String(input)}`;
    }

    const tag = input.tagName?.toLowerCase?.() ?? "element";

    if (typeof input.outerHTML !== "string" || input.outerHTML === "") {
        return `element: <${tag}>`;
    }

    return `element: ${input.outerHTML.slice(0, 400)}`;
}

/**
 * Resolve the contract one input declares.
 *
 * `step` gives the decimal places and `min` gives the sign rule. `min` and `max` also become bounds,
 * so the caller checks the value against the same numbers the browser enforces.
 *
 * @param {HTMLInputElement} input The input to read.
 *
 * @returns {{decimals: number, min: number|null, max: number|null}} The resolved contract.
 *
 * @throws {InputElementNumberSchemaError} When `step` is missing or unknown, a bound is not a number, or the bounds invert.
 */
export function readNumericSchema(input) {
    const step = input?.getAttribute?.("step") ?? input?.dataset?.step;

    if (!Object.hasOwn(NUMBER_STEPS, step ?? "")) {
        throw new InputElementNumberSchemaError(
            `Number input needs step of 1, 0.1, or 0.01 but reads step="${String(step)}"`,
            input,
        );
    }

    const decimals = NUMBER_STEPS[step];
    const minimum = boundAttribute(input, "min");
    const maximum = boundAttribute(input, "max");

    if (minimum !== null && maximum !== null && maximum < minimum) {
        throw new InputElementNumberSchemaError(`Number input declares min="${minimum}" above max="${maximum}"`, input);
    }

    return { decimals, min: minimum, max: maximum };
}

/**
 * Parse a plain number against a resolved contract.
 *
 * This function checks the shape of the text: plain digits, the declared decimal places, no exponent.
 * It does not check the range, because `withinDeclaredBounds` does that against the same `min` and
 * `max` the browser enforces.
 *
 * @param {string} value Raw `input.value`.
 * @param {{decimals: number, min: number|null, max: number|null}} contract The resolved contract.
 *
 * @returns {number|null} The number, or null when the text breaks the contract.
 */
export function parseNumericInput(value, contract) {
    if (!contract || typeof value !== "string") {
        return null;
    }

    const text = value.trim();
    const digits = digitsPatternFor(contract.decimals);

    if (!new RegExp(`^${SIGN_PATTERN}${digits}$`).test(text)) {
        return null;
    }

    const parsed = Number(text);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    if (parsed === 0) {
        return 0;
    }

    return parsed;
}

/**
 * Rewrite accepted text in its shortest form, so a field cannot keep leading zeros.
 *
 * `010` becomes `10`, `-010` becomes `-10`, `+010` becomes `10`, and any zero becomes `0`. A zero that
 * carries a decimal place keeps the digit before the point, so `0.5` stays `0.5`.
 *
 * @param {string} value Raw `input.value`.
 * @param {{decimals: number, min: number|null, max: number|null}} contract The resolved contract.
 *
 * @returns {string|null} The canonical text, or null when the text breaks the contract.
 */
export function canonicalNumericText(value, contract) {
    if (parseNumericInput(value, contract) === null) {
        return null;
    }

    const text = value.trim();
    const negative = text.startsWith("-");
    const [whole, fraction] = text.replace(/^[+-]/, "").split(".");
    const trimmed = whole.replace(/^0+(?=\d)/, "");

    if (Number(trimmed) === 0 && (fraction === undefined || Number(fraction) === 0)) {
        return "0";
    }

    const sign = negative ? "-" : "";

    if (fraction === undefined) {
        return `${sign}${trimmed}`;
    }

    return `${sign}${trimmed}.${fraction}`;
}

/**
 * Build the digit pattern for one decimal ceiling.
 *
 * @param {number} decimals Decimal places the field allows.
 *
 * @returns {string} Regular expression source that matches plain digits, with no exponent.
 */
function digitsPatternFor(decimals) {
    if (decimals === 0) {
        return "\\d+";
    }

    return `\\d+(?:\\.\\d{1,${decimals}})?`;
}

/**
 * Check a parsed number against the bounds the contract carries.
 *
 * @param {number} value The parsed number.
 * @param {{min: number|null, max: number|null}} contract The resolved contract.
 *
 * @returns {boolean} True when the value sits inside the declared bounds.
 */
export function withinDeclaredBounds(value, contract) {
    if (contract.min !== null && value < contract.min) {
        return false;
    }

    if (contract.max !== null && value > contract.max) {
        return false;
    }

    return true;
}

/**
 * Read one bound attribute as a number, keeping "absent" distinct from zero.
 *
 * @param {HTMLInputElement} input The input to read.
 * @param {string} name Attribute name.
 *
 * @returns {number|null} The number, or null when the attribute is absent.
 *
 * @throws {InputElementNumberSchemaError} When the attribute holds something other than a number.
 */
function boundAttribute(input, name) {
    const raw = input?.getAttribute?.(name);

    if (raw === null || raw === "") {
        return null;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
        throw new InputElementNumberSchemaError(`Number input declares ${name}="${raw}" which is not a number`, input);
    }

    return parsed;
}

/**
 * State what a contract accepts, for the player-facing message.
 *
 * @param {{decimals: number, min: number|null, max: number|null}} contract The resolved contract.
 *
 * @returns {string} One short phrase.
 */
export function describeNumericSchema(contract) {
    const places = decimalPhraseFor(contract.decimals);
    const bounds = describeBounds(contract);
    const core = `digits with ${places}, no exponent`;

    if (bounds === "") {
        return core;
    }

    return `${core}, ${bounds}`;
}

/**
 * State the decimal places, for the player-facing message.
 *
 * @param {number} decimals Decimal places the field allows.
 *
 * @returns {string} One short phrase.
 */
function decimalPhraseFor(decimals) {
    if (decimals === 1) {
        return "one decimal place";
    }

    if (decimals === 2) {
        return "up to two decimal places";
    }

    return "no decimal point";
}

/**
 * State the declared bounds, for the player-facing message.
 *
 * @param {{min: number|null, max: number|null}} contract The bounds of a resolved contract.
 *
 * @returns {string} The bound phrase, or an empty string when the range is open.
 */
function describeBounds({ min, max }) {
    if (min !== null && max !== null) {
        return `between ${min} and ${max}`;
    }

    if (min !== null) {
        return `at least ${min}`;
    }

    if (max !== null) {
        return `at most ${max}`;
    }

    return "";
}

/**
 * State whether one input carries a number contract the sheet must enforce.
 *
 * Markup opts a field in with `type="number"` or `data-dtype="Number"`. Only an `<input>` carries such a
 * contract. A `<select data-dtype="Number">` exists so Foundry casts the chosen option, and its text comes
 * from the option list rather than from a player's keyboard, so no rule applies to it. Text, checkbox, and
 * textarea keep their raw value for the same reason.
 *
 * @param {HTMLInputElement} input The input to read.
 *
 * @returns {boolean} True when the value must parse as a number.
 */
export function declaresNumberContract(input) {
    return input.tagName === "INPUT" && (input.type === "number" || input.dataset.dtype === "Number");
}

/**
 * Check one input's text against the contract its own markup declares.
 *
 * This function reads and decides. It writes nothing: no document, and not even the input.
 *
 * A `step` the module does not know, a bound that is not a number, or inverted bounds are a markup bug, not
 * a player error, so they report `reason: "schema"` and carry the thrown `InputElementNumberSchemaError`.
 * Text the contract cannot describe reports `reason: "shape"`. A number outside the bounds reports
 * `reason: "range"`.
 *
 * @param {HTMLInputElement} input The input to check.
 *
 * @returns {{ok: true, value: number, contract: {decimals: number, min: number|null, max: number|null}, text: string}
 *     | {ok: false, reason: "schema" | "shape" | "range", contract: {decimals: number, min: number|null, max: number|null}|null, error?: InputElementNumberSchemaError}}
 *     The parsed number and canonical text, or the reason the text was rejected.
 *
 * @throws {Error} Anything other than `InputElementNumberSchemaError` from the contract read.
 */
export function validateNumericInput(input) {
    let contract;

    try {
        contract = readNumericSchema(input);
    } catch (error) {
        if (!(error instanceof InputElementNumberSchemaError)) {
            throw error;
        }

        return { ok: false, reason: "schema", contract: null, error };
    }

    const parsed = parseNumericInput(input.value, contract);

    if (parsed === null) {
        return { ok: false, reason: "shape", contract };
    }

    if (!withinDeclaredBounds(parsed, contract)) {
        return { ok: false, reason: "range", contract };
    }

    const text = canonicalNumericText(input.value, contract);

    // `canonicalNumericText` answers null only for text `parseNumericInput` already refused.
    return { ok: true, value: parsed, contract, text: text ?? input.value };
}

/**
 * Find the words a player uses for one input.
 *
 * Markup wins in this order: a `data-field-label`, a `<label for>` pointing at the input's `id`, the first
 * label in the enclosing `.form-group`, then the first legend of the enclosing `fieldset`. The property path
 * answers last, because a player cannot read a path.
 *
 * @param {HTMLInputElement} input The input to name.
 *
 * @returns {string} The visible label, or the input's `name`.
 */
function labelForNumericInput(input) {
    if (input.dataset.fieldLabel) {
        return input.dataset.fieldLabel;
    }

    if (input.id) {
        const bound = input.ownerDocument.querySelector(`label[for="${input.id}"]`);

        if (bound?.textContent?.trim()) {
            return bound.textContent.trim();
        }
    }

    const group = input.closest(".form-group");
    const groupLabel = group?.querySelector("label")?.textContent?.trim();

    if (groupLabel) {
        return groupLabel;
    }

    const legend = input.closest("fieldset")?.querySelector("legend")?.textContent?.trim();

    if (legend) {
        return legend;
    }

    return input.name;
}

/**
 * Put the text the sheet last drew back into a rejected input, and tell the player what the field accepts.
 *
 * `input.defaultValue` mirrors the `value` attribute, and the template wrote that attribute. Core writes it
 * from the converted value, already rounded to the field's `step`, so the attribute carries the unit the label
 * names and the precision the field declares. This function converts nothing and rounds nothing, so a converted
 * field cannot drift from its own label here. A field whose stored value is a string, such as `BODYLEVELS`,
 * restores that string for the same reason: the markup already holds it.
 *
 * A rejection writes no document, so no render competes with this write. An accepted change does update the
 * document, and core re-renders the sheet, which replaces the part with fresh markup. The attribute therefore
 * tracks every commit the player makes. REF: `Document#_onUpdate` and `createNumberInput` in foundry.mjs.
 *
 * @param {HTMLInputElement} input The input whose change was rejected.
 * @param {{reason: "schema" | "shape" | "range", contract: {decimals: number, min: number|null, max: number|null}|null, error?: InputElementNumberSchemaError}} result
 *     The rejection from `validateNumericInput`.
 * @param {string} [label] Name shown to the player. Omit it to let `labelForNumericInput` answer.
 *
 * @returns {void}
 */
export function rejectNumericInput(input, result, label) {
    if (result.reason === "schema") {
        console.error(result.error);
        ui.notifications.error(result.error.message);
        return;
    }

    input.value = input.defaultValue;

    const name = label ?? labelForNumericInput(input);

    ui.notifications.error(`${name} needs ${describeNumericSchema(result.contract)}.`);
}

/**
 * Validate one number input, then hand the parsed value to a writer.
 *
 * A rejected change hands the input back to `rejectNumericInput`, which puts the drawn text back. The document
 * is not read, because the markup already holds the text the player saw. Nothing is guessed.
 *
 * Non-numeric inputs keep their raw value, so a sheet may route every change through this function.
 *
 * @param {HTMLInputElement} input The input that changed.
 * @param {(value: number|string) => Promise<unknown>} write Writes the parsed number, or the raw text of a
 *     non-numeric input.
 * @param {string} [label] Name shown to the player when the value is rejected. Omit it to let the markup
 *     answer.
 *
 * @returns {Promise<void>} Resolves when the write finishes, or at once when the value is rejected.
 */
export async function commitNumericInput(input, write, label) {
    if (!declaresNumberContract(input)) {
        await write(input.value);
        return;
    }

    const result = validateNumericInput(input);

    if (!result.ok) {
        rejectNumericInput(input, result, label);
        return;
    }

    if (result.text !== input.value) {
        input.value = result.text;
    }

    await write(result.value);
}
