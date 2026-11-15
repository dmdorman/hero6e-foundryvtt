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
 * A typed `-0` becomes `0` here, before any comparison runs, so no field can store negative zero.
 *
 * The browser enforces what it can during typing. This module is the backstop, because a cleared
 * `input type="number"` still reports an empty string and a browser still accepts an exponent such as
 * `1e5`.
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
 * Put the stored value back into a numeric input and tell the player what the field accepts.
 *
 * @param {HTMLInputElement} input The input whose change was rejected.
 * @param {Actor} actor Document the input writes to.
 * @param {string} path Property path the input writes.
 * @param {{decimals: number, min: number|null, max: number|null}} contract The resolved contract.
 *
 * @returns {void}
 */
export function restoreNumericInput(input, actor, path, contract) {
    const stored = foundry.utils.getProperty(actor, path);

    if (typeof stored === "number" && Number.isFinite(stored)) {
        input.value = stored;
    } else {
        input.value = "";
    }

    ui.notifications.error(`${path} needs ${describeNumericSchema(contract)}.`);
}
