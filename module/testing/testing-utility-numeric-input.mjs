import { createQuenchActor, deleteQuenchActor } from "./quench-helper.mjs";
import { getAndSetGameSetting } from "../settings/settings-helpers.mjs";
import {
    canonicalNumericText,
    describeNumericSchema,
    InputElementNumberSchemaError,
    parseNumericInput,
    readNumericSchema,
    withinDeclaredBounds,
} from "../utility/numeric-input.mjs";

export function registerNumericInputTests(quench) {
    quench.registerBatch(
        `${game.system.id}.utils.numeric-input`,
        (context) => {
            const { afterEach, beforeEach, describe, expect, it } = context;

            /**
             * Build a detached input with the given attributes.
             *
             * @param {object} attributes Attribute name mapped to value.
             *
             * @returns {HTMLInputElement} The input.
             */
            function makeInput(attributes) {
                const input = document.createElement("input");

                for (const [key, value] of Object.entries(attributes)) {
                    input.setAttribute(key, String(value));
                }

                return input;
            }

            describe("Input number validation", async function () {
                describe("readNumericSchema", async function () {
                    it("reads step 1 with no min as integers with no bounds", function () {
                        const input = makeInput({ step: 1 });

                        expect(readNumericSchema(input)).to.deep.equal({ decimals: 0, min: null, max: null });
                    });

                    it("reads step 1 with min 0 as whole numbers floored at 0", function () {
                        const input = makeInput({ step: 1, min: 0 });

                        expect(readNumericSchema(input)).to.deep.equal({ decimals: 0, min: 0, max: null });
                    });

                    it("reads step 0.1 with no min as one decimal place with no bounds", function () {
                        const input = makeInput({ step: "0.1" });

                        expect(readNumericSchema(input)).to.deep.equal({ decimals: 1, min: null, max: null });
                    });

                    it("reads step 0.1 with min 0 as one decimal place floored at 0", function () {
                        const input = makeInput({ step: "0.1", min: "0" });

                        expect(readNumericSchema(input)).to.deep.equal({ decimals: 1, min: 0, max: null });
                    });

                    it("reads step 0.01 with no min as two decimal places with no bounds", function () {
                        const input = makeInput({ step: "0.01" });

                        expect(readNumericSchema(input)).to.deep.equal({ decimals: 2, min: null, max: null });
                    });

                    it("reads step 0.01 with min 0 and max 250 as a bounded decimal", function () {
                        const input = makeInput({ step: "0.01", min: "0", max: "250" });

                        expect(readNumericSchema(input)).to.deep.equal({ decimals: 2, min: 0, max: 250 });
                    });

                    it("throws when the markup declares no step", function () {
                        expect(() => readNumericSchema(makeInput({ min: "0" }))).to.throw(
                            InputElementNumberSchemaError,
                            "step",
                        );
                    });

                    it("throws when the step is 2", function () {
                        expect(() => readNumericSchema(makeInput({ step: "2" }))).to.throw(
                            InputElementNumberSchemaError,
                            "step",
                        );
                    });

                    it("throws when the step is 0.5", function () {
                        expect(() => readNumericSchema(makeInput({ step: "0.5" }))).to.throw(
                            InputElementNumberSchemaError,
                            "step",
                        );
                    });

                    it("throws when the step is an empty string", function () {
                        expect(() => readNumericSchema(makeInput({ step: "" }))).to.throw(
                            InputElementNumberSchemaError,
                            "step",
                        );
                    });

                    it("throws when min is not a number", function () {
                        expect(() => readNumericSchema(makeInput({ step: 1, min: "abc" }))).to.throw(
                            InputElementNumberSchemaError,
                            "min",
                        );
                    });

                    it("throws when max is not a number", function () {
                        expect(() => readNumericSchema(makeInput({ step: 1, max: "abc" }))).to.throw(
                            InputElementNumberSchemaError,
                            "max",
                        );
                    });

                    it("throws when min sits above max", function () {
                        expect(() => readNumericSchema(makeInput({ step: 1, min: "10", max: "5" }))).to.throw(
                            InputElementNumberSchemaError,
                            "min",
                        );
                    });

                    it("names the offending element in the error", function () {
                        const input = makeInput({ name: "system.WEIGHT", step: "0.01", min: "10", max: "1" });
                        let message = "";

                        try {
                            readNumericSchema(input);
                        } catch (error) {
                            message = error.message;
                        }

                        expect(message).to.contain("system.WEIGHT");
                        expect(message).to.contain("element:");
                    });

                    it("passes no min as no bound on a wide negative range", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(contract.min).to.equal(null);
                        expect(withinDeclaredBounds(-1000000, contract)).to.equal(true);
                    });
                });

                describe("parseNumericInput", async function () {
                    it("answers 42 for the text 42 in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("42", contract)).to.equal(42);
                    });

                    it("ignores surrounding spaces in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput(" 42 ", contract)).to.equal(42);
                    });

                    it("answers 0 for the text 0 in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("0", contract)).to.equal(0);
                    });

                    it("answers plain 0 for the text -0 in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("-0", contract)).to.equal(0);
                    });

                    it("answers -5 for the text -5 in an integer cell with no floor", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("-5", contract)).to.equal(-5);
                    });

                    it("answers 5 for the text +5 in an integer cell with no floor", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("+5", contract)).to.equal(5);
                    });

                    it("refuses the exponent 1e5 in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("1e5", contract)).to.equal(null);
                    });

                    it("refuses 4.0 in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("4.0", contract)).to.equal(null);
                    });

                    it("refuses the empty text in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("", contract)).to.equal(null);
                    });

                    it("refuses the text abc in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("abc", contract)).to.equal(null);
                    });

                    it("refuses Infinity in an integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput("Infinity", contract)).to.equal(null);
                    });

                    it("answers 42 for the text 42 in a floored integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(parseNumericInput("42", contract)).to.equal(42);
                    });

                    it("answers plain 0 for the text -0 in a floored integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(parseNumericInput("-0", contract)).to.equal(0);
                    });

                    it("parses -5 in a floored integer cell, so the bounds do the refusing", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(parseNumericInput("-5", contract)).to.equal(-5);
                    });

                    it("refuses the exponent 1e5 in a floored integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(parseNumericInput("1e5", contract)).to.equal(null);
                    });

                    it("refuses the empty text in a floored integer cell", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(parseNumericInput("", contract)).to.equal(null);
                    });

                    it("answers 1.5 for the text 1.5 in a one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(parseNumericInput("1.5", contract)).to.equal(1.5);
                    });

                    it("answers -1.5 for the text -1.5 in a one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(parseNumericInput("-1.5", contract)).to.equal(-1.5);
                    });

                    it("answers 0 for the text 0.0 in a one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(parseNumericInput("0.0", contract)).to.equal(0);
                    });

                    it("refuses 1.25 in a one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(parseNumericInput("1.25", contract)).to.equal(null);
                    });

                    it("answers plain 0 for the text -0 in a one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(parseNumericInput("-0", contract)).to.equal(0);
                    });

                    it("answers 1.5 for the text 1.5 in a floored one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1", min: "0" }));

                        expect(parseNumericInput("1.5", contract)).to.equal(1.5);
                    });

                    it("answers plain 0 for the text -0 in a floored one decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1", min: "0" }));

                        expect(parseNumericInput("-0", contract)).to.equal(0);
                    });

                    it("answers 1.25 for the text 1.25 in a two decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(parseNumericInput("1.25", contract)).to.equal(1.25);
                    });

                    it("answers -1.25 for the text -1.25 in a two decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(parseNumericInput("-1.25", contract)).to.equal(-1.25);
                    });

                    it("refuses 1.253 in a two decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(parseNumericInput("1.253", contract)).to.equal(null);
                    });

                    it("answers 1.25 for the text 1.25 in a floored two decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01", min: "0" }));

                        expect(parseNumericInput("1.25", contract)).to.equal(1.25);
                    });

                    it("answers plain 0 for the text -0 in a floored two decimal place cell", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01", min: "0" }));

                        expect(parseNumericInput("-0", contract)).to.equal(0);
                    });

                    it("refuses an object as the value", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(parseNumericInput({}, contract)).to.equal(null);
                    });

                    it("refuses any value when the contract is missing", function () {
                        expect(parseNumericInput("42", null)).to.equal(null);
                        expect(parseNumericInput("42", undefined)).to.equal(null);
                    });

                    it("turns a typed -0 into plain 0, so no field can hold negative zero", function () {
                        const floored = readNumericSchema(makeInput({ step: 1, min: "0" }));
                        const open = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(Object.is(parseNumericInput("-0", floored), -0)).to.equal(false);
                        expect(Object.is(parseNumericInput("-0", open), -0)).to.equal(false);
                        expect(withinDeclaredBounds(parseNumericInput("-0", floored), floored)).to.equal(true);
                    });
                });

                describe("canonicalNumericText", async function () {
                    it("truncates the leading zero of 010 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("010", contract)).to.equal("10");
                    });

                    it("truncates the leading zeros of 0010 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("0010", contract)).to.equal("10");
                    });

                    it("truncates -010 to -10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("-010", contract)).to.equal("-10");
                    });

                    it("drops the leading plus of +010 and answers 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("+010", contract)).to.equal("10");
                    });

                    it("turns 000 into 0", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("000", contract)).to.equal("0");
                    });

                    it("turns -0 into 0", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("-0", contract)).to.equal("0");
                    });

                    it("keeps the leading zero of 0.5", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(canonicalNumericText("0.5", contract)).to.equal("0.5");
                    });

                    it("truncates 00.25 to 0.25", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(canonicalNumericText("00.25", contract)).to.equal("0.25");
                    });

                    it("turns 0.00 into 0", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(canonicalNumericText("0.00", contract)).to.equal("0");
                    });

                    it("keeps the decimal place of 10.0", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(canonicalNumericText("10.0", contract)).to.equal("10.0");
                    });

                    it("truncates -0.5 written as -00.5 to -0.5", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(canonicalNumericText("-00.5", contract)).to.equal("-0.5");
                    });

                    it("refuses abc", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("abc", contract)).to.equal(null);
                    });

                    it("refuses an empty string", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("", contract)).to.equal(null);
                    });

                    it("refuses the exponent 1e5", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(canonicalNumericText("1e5", contract)).to.equal(null);
                    });
                });

                describe("bounds and messages", async function () {
                    it("puts -1 outside a range from 0 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: 0, max: 10 }));

                        expect(withinDeclaredBounds(-1, contract)).to.equal(false);
                    });

                    it("puts 0 inside a range from 0 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: 0, max: 10 }));

                        expect(withinDeclaredBounds(0, contract)).to.equal(true);
                    });

                    it("puts 10 inside a range from 0 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: 0, max: 10 }));

                        expect(withinDeclaredBounds(10, contract)).to.equal(true);
                    });

                    it("puts 11 outside a range from 0 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: 0, max: 10 }));

                        expect(withinDeclaredBounds(11, contract)).to.equal(false);
                    });

                    it("puts -50 inside a ceiling of 10 with no floor", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, max: 10 }));

                        expect(withinDeclaredBounds(-50, contract)).to.equal(true);
                    });

                    it("puts 11 outside a ceiling of 10 with no floor", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, max: 10 }));

                        expect(withinDeclaredBounds(11, contract)).to.equal(false);
                    });

                    it("puts -1000000 inside a field that declares no bounds", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(withinDeclaredBounds(-1000000, contract)).to.equal(true);
                    });

                    it("puts -5 outside a floor of 0", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(withinDeclaredBounds(-5, contract)).to.equal(false);
                    });

                    it("puts 0 inside a floor of 0", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "0" }));

                        expect(withinDeclaredBounds(0, contract)).to.equal(true);
                    });

                    it("puts -5 inside a field whose min attribute is empty", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "" }));

                        expect(withinDeclaredBounds(-5, contract)).to.equal(true);
                    });

                    it("puts -2 outside a floor of -1", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "-1" }));

                        expect(withinDeclaredBounds(-2, contract)).to.equal(false);
                    });

                    it("puts -1 inside a floor of -1", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: "-1" }));

                        expect(withinDeclaredBounds(-1, contract)).to.equal(true);
                    });

                    it("puts -5 outside a floor of 0.5 on a two decimal place field", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01", min: "0.5" }));

                        expect(withinDeclaredBounds(-5, contract)).to.equal(false);
                    });

                    it("puts -5 inside a range from -5 to -3", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: -5, max: -3 }));

                        expect(withinDeclaredBounds(-5, contract)).to.equal(true);
                    });

                    it("puts -4 inside a range from -5 to -3", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: -5, max: -3 }));

                        expect(withinDeclaredBounds(-4, contract)).to.equal(true);
                    });

                    it("puts -3 inside a range from -5 to -3", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: -5, max: -3 }));

                        expect(withinDeclaredBounds(-3, contract)).to.equal(true);
                    });

                    it("puts -2 outside a range from -5 to -3", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: -5, max: -3 }));

                        expect(withinDeclaredBounds(-2, contract)).to.equal(false);
                    });

                    it("puts 0 outside a range from -5 to -3", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: -5, max: -3 }));

                        expect(withinDeclaredBounds(0, contract)).to.equal(false);
                    });

                    it("states no decimal point for step 1", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(describeNumericSchema(contract)).to.contain("no decimal point");
                    });

                    it("states no exponent for step 1", function () {
                        const contract = readNumericSchema(makeInput({ step: 1 }));

                        expect(describeNumericSchema(contract)).to.contain("no exponent");
                    });

                    it("states one decimal place for step 0.1", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.1" }));

                        expect(describeNumericSchema(contract)).to.contain("one decimal place");
                    });

                    it("states up to two decimal places for step 0.01", function () {
                        const contract = readNumericSchema(makeInput({ step: "0.01" }));

                        expect(describeNumericSchema(contract)).to.contain("up to two decimal places");
                    });

                    it("states at least 0 for a floor of 0", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: 0 }));

                        expect(describeNumericSchema(contract)).to.contain("at least 0");
                    });

                    it("states at most 10 for a ceiling of 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, max: 10 }));

                        expect(describeNumericSchema(contract)).to.contain("at most 10");
                    });

                    it("states between 0 and 10 for a range from 0 to 10", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: 0, max: 10 }));

                        expect(describeNumericSchema(contract)).to.contain("between 0 and 10");
                    });

                    it("states between -5 and -3 for a wholly negative range", function () {
                        const contract = readNumericSchema(makeInput({ step: 1, min: -5, max: -3 }));

                        expect(describeNumericSchema(contract)).to.contain("between -5 and -3");
                    });
                });

                describe("sheet coverage", async function () {
                    // Covers the parts the sheet renders on open. A lazy tab needs its own case once
                    // it holds numeric inputs, because those inputs do not exist until the tab opens.
                    it("declares a legal step on every numeric input", async function () {
                        const actor = await createQuenchActor({
                            quench: this,
                            actorType: "pc",
                            is5e: false,
                            name: "declared inputs",
                        });
                        await actor.sheet.render({ force: true });

                        const numeric = [
                            ...actor.sheet.element.querySelectorAll('input[type="number"], input[data-dtype="Number"]'),
                        ];

                        const undeclared = numeric.filter((input) => {
                            try {
                                readNumericSchema(input);
                                return false;
                            } catch (error) {
                                return error instanceof InputElementNumberSchemaError;
                            }
                        });

                        await deleteQuenchActor({ quench: this, actor });

                        expect(undeclared.map((input) => input.outerHTML.slice(0, 120))).to.deep.equal([]);
                    });

                    it("drops no retired data-hero-number attribute", async function () {
                        const actor = await createQuenchActor({
                            quench: this,
                            actorType: "pc",
                            is5e: false,
                            name: "retired attribute",
                        });
                        await actor.sheet.render({ force: true });

                        const numeric = [
                            ...actor.sheet.element.querySelectorAll('input[type="number"], input[data-dtype="Number"]'),
                        ];

                        const retired = numeric.filter((input) => input.dataset.heroNumber !== undefined);

                        await deleteQuenchActor({ quench: this, actor });

                        expect(retired.map((input) => input.outerHTML.slice(0, 120))).to.deep.equal([]);
                    });

                    it("floors EXPERIENCE at 0, so a minus lands outside", async function () {
                        const actor = await createQuenchActor({
                            quench: this,
                            actorType: "pc",
                            is5e: false,
                            name: "floor EXPERIENCE",
                        });
                        await actor.sheet.render({ force: true });

                        const input = actor.sheet.element.querySelector(
                            `input[name="system.CHARACTER.BASIC_CONFIGURATION.EXPERIENCE"]`,
                        );
                        const contract = readNumericSchema(input);

                        expect(contract.min).to.equal(0);
                        expect(contract.decimals).to.equal(0);
                        expect(withinDeclaredBounds(-1, contract)).to.equal(false);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    if (game.settings.get(game.system.id, "HAP")) {
                        it("floors HAP at 0, so a minus lands outside", async function () {
                            const actor = await createQuenchActor({
                                quench: this,
                                actorType: "pc",
                                is5e: false,
                                name: "floor HAP",
                            });
                            expect(actor.system.hap.value).to.equal(0);
                            await actor.sheet.render({ force: true });

                            const input = actor.sheet.element.querySelector(`input[name="system.hap.value"]`);
                            const contract = readNumericSchema(input);

                            expect(input.value).to.equal("0");
                            expect(contract.min).to.equal(0);
                            expect(contract.decimals).to.equal(0);
                            expect(withinDeclaredBounds(-1, contract)).to.equal(false);

                            await deleteQuenchActor({ quench: this, actor });
                        });
                    }

                    it("floors HEIGHT at 0, so a minus lands outside", async function () {
                        const actor = await createQuenchActor({
                            quench: this,
                            actorType: "pc",
                            is5e: false,
                            name: "floor HEIGHT",
                        });
                        await actor.sheet.render({ force: true });

                        const input = actor.sheet.element.querySelector(
                            `input[name="system.CHARACTER.CHARACTER_INFO.HEIGHT"]`,
                        );
                        const contract = readNumericSchema(input);

                        expect(contract.min).to.equal(0);
                        expect(contract.decimals).to.equal(2);
                        expect(withinDeclaredBounds(-1, contract)).to.equal(false);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("floors WEIGHT at 0, so a minus lands outside", async function () {
                        const actor = await createQuenchActor({
                            quench: this,
                            actorType: "pc",
                            is5e: false,
                            name: "floor WEIGHT",
                        });
                        await actor.sheet.render({ force: true });

                        const input = actor.sheet.element.querySelector(
                            `input[name="system.CHARACTER.CHARACTER_INFO.WEIGHT"]`,
                        );
                        const contract = readNumericSchema(input);

                        expect(contract.min).to.equal(0);
                        expect(contract.decimals).to.equal(2);
                        expect(withinDeclaredBounds(-1, contract)).to.equal(false);

                        await deleteQuenchActor({ quench: this, actor });
                    });
                });

                describe("characteristic value cell", async function () {
                    const PATH = "system.characteristics.str.value";

                    /**
                     * Create a pc and open its sheet, so the sheet's own listeners are attached.
                     *
                     * @param {object} test Mocha test context. The fixture helper names the actor from it.
                     *
                     * @returns {Promise<Actor>} The actor with a rendered sheet.
                     */
                    async function openSheet(test) {
                        const actor = await createQuenchActor({
                            quench: test,
                            actorType: "pc",
                            is5e: false,
                            name: "numeric input",
                        });
                        await actor.sheet.render({ force: true });

                        return actor;
                    }

                    /**
                     * Type into one input on the rendered sheet and wait for the change handler.
                     *
                     * @param {Actor} actor Actor whose sheet holds the input.
                     * @param {string} text Value to type. `""` clears the cell.
                     *
                     * @returns {Promise<HTMLInputElement>} The input that changed.
                     */
                    async function typeInto(actor, text) {
                        const input = actor.sheet.element.querySelector(`input[name="${PATH}"]`);
                        input.value = text;
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                        await new Promise((resolve) => setTimeout(resolve, 250));

                        return input;
                    }

                    it("declares a step of one and no floor", async function () {
                        const actor = await openSheet(this);
                        const input = actor.sheet.element.querySelector(`input[name="${PATH}"]`);

                        expect(input.getAttribute("step")).to.equal("1");
                        expect(input.getAttribute("min")).to.equal(null);
                        expect(withinDeclaredBounds(-3, readNumericSchema(input))).to.equal(true);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("refuses a cleared cell and restores the stored value", async function () {
                        const actor = await openSheet(this);
                        const stored = actor._source.system.characteristics.str.value;

                        const input = await typeInto(actor, "");

                        expect(actor._source.system.characteristics.str.value).to.equal(stored);
                        expect(input.value).to.equal(String(stored));

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("refuses an exponent and keeps the stored value", async function () {
                        const actor = await openSheet(this);
                        const stored = actor._source.system.characteristics.str.value;

                        const input = await typeInto(actor, "1e5");

                        expect(actor._source.system.characteristics.str.value).to.equal(stored);
                        expect(input.value).to.equal(String(stored));

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("refuses a decimal in an integer cell and keeps the stored value", async function () {
                        const actor = await openSheet(this);
                        const stored = actor._source.system.characteristics.str.value;

                        const input = await typeInto(actor, "3.5");

                        expect(actor._source.system.characteristics.str.value).to.equal(stored);
                        expect(input.value).to.equal(String(stored));

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("writes a negative integer", async function () {
                        const actor = await openSheet(this);

                        await typeInto(actor, "-3");

                        expect(actor._source.system.characteristics.str.value).to.equal(-3);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("writes a plain integer", async function () {
                        const actor = await openSheet(this);

                        await typeInto(actor, "17");

                        expect(actor._source.system.characteristics.str.value).to.equal(17);

                        await deleteQuenchActor({ quench: this, actor });
                    });
                });
            });

            describe("Unit display", async function () {
                const HEIGHT_PATH = "system.CHARACTER.CHARACTER_INFO.HEIGHT";
                const WEIGHT_PATH = "system.CHARACTER.CHARACTER_INFO.WEIGHT";

                // Both store more than two decimals, so an unrounded draw breaks the cell's own contract.
                // 31.111 inches is 79.02194 cm. 123.456 pounds is 55.998699630720004 kg.
                //
                // Expectations stay literal. Deriving them with `convertCmToInches` or `convertLbsToKg`
                // would put one factor on both sides of every assertion, so each round trip would pass
                // whatever factor the code carried. The factors themselves are definitions in
                // `module/utility/units.mjs` and carry no test of their own.
                const STORED_HEIGHT_INCHES = 31.111;
                const STORED_WEIGHT_LBS = 123.456;

                /**
                 * Turn metric units on or off for every sheet render that follows.
                 *
                 * @param {boolean} enabled True draws centimetres and kilograms.
                 * @returns {Promise<void>}
                 */
                async function setMetricUnits(enabled) {
                    await getAndSetGameSetting("metricUnits", enabled);
                }

                /**
                 * Read the text one cell holds.
                 *
                 * @param {Actor} actor Actor whose sheet holds the cell.
                 * @param {string} path Property path the cell writes.
                 * @returns {string} The `value` attribute of the rendered input.
                 */
                function drawnText(actor, path) {
                    return actor.sheet.element.querySelector(`input[name="${path}"]`).value;
                }

                /**
                 * Type into one cell on the rendered sheet and wait for its change handler.
                 *
                 * @param {Actor} actor Actor whose sheet holds the cell.
                 * @param {string} path Property path the cell writes.
                 * @param {string} text Value to type.
                 * @returns {Promise<void>}
                 */
                async function typeIntoCell(actor, path, text) {
                    const input = actor.sheet.element.querySelector(`input[name="${path}"]`);
                    input.value = text;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    await new Promise((resolve) => setTimeout(resolve, 250));
                }

                let originalMetricUnits;

                beforeEach(async function () {
                    // Hold the world's value and start every case from imperial.
                    originalMetricUnits = await getAndSetGameSetting("metricUnits", false);
                });

                afterEach(async function () {
                    await getAndSetGameSetting("metricUnits", originalMetricUnits);
                });

                describe("background tab cells", async function () {
                    let actor;

                    beforeEach(async function () {
                        actor = await createQuenchActor({
                            quench: this,
                            actorType: "pc",
                            is5e: false,
                            name: "unit display",
                        });
                        await actor.update({
                            [HEIGHT_PATH]: STORED_HEIGHT_INCHES,
                            [WEIGHT_PATH]: STORED_WEIGHT_LBS,
                        });
                        await actor.sheet.render({ force: true });
                    });

                    afterEach(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("draws stored inches and pounds when imperial units are on", async function () {
                        await setMetricUnits(false);
                        await actor.sheet.render({ force: true });

                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("31.11");
                        expect(drawnText(actor, WEIGHT_PATH)).to.equal("123.46");
                    });

                    it("draws centimetres and kilograms when metric units are on", async function () {
                        await setMetricUnits(true);
                        await actor.sheet.render({ force: true });

                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("79.02");
                        expect(drawnText(actor, WEIGHT_PATH)).to.equal("56");
                    });

                    it("draws text every cell accepts, in both units", async function () {
                        // Checks the drawn text against the step the markup declares, rather than against
                        // a transcription of it, so a step change with no display change still fails.
                        const rejected = [];

                        for (const metric of [false, true]) {
                            await setMetricUnits(metric);
                            await actor.sheet.render({ force: true });

                            for (const path of [HEIGHT_PATH, WEIGHT_PATH]) {
                                const input = actor.sheet.element.querySelector(`input[name="${path}"]`);
                                const text = input.value;

                                if (parseNumericInput(text, readNumericSchema(input)) === null) {
                                    rejected.push(`${metric ? "metric" : "imperial"} ${path}: "${text}"`);
                                }
                            }
                        }

                        expect(rejected).to.deep.equal([]);
                    });

                    it("stores a typed centimetre value as inches, then draws 175 again", async function () {
                        await setMetricUnits(true);
                        await actor.sheet.render({ force: true });

                        await typeIntoCell(actor, HEIGHT_PATH, "175");

                        // 175 cm as inches. Literal, so a factor change lands here rather than passing
                        // unnoticed through the redraw below.
                        expect(actor._source.system.CHARACTER.CHARACTER_INFO.HEIGHT).to.equal(68.89763779527559);

                        await actor.sheet.render({ force: true });

                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("175");
                    });

                    it("draws 3.18 cm for 1.25 inches, the step rounding tie", async function () {
                        await setMetricUnits(true);
                        await actor.update({ [HEIGHT_PATH]: 1.25 });
                        await actor.sheet.render({ force: true });

                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("3.18");
                    });
                });
            });
        },
        { displayName: "HERO: Numeric Input Validation" },
    );
}
