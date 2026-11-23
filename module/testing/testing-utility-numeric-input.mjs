import { createQuenchActor, deleteQuenchActor } from "./quench-helper.mjs";
import { ItemModifierApplicationV2 } from "../applications/item/item-modifier-application.mjs";
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
             * Collect the error notifications one run raises, without showing them.
             *
             * Both item UIs raise a rejection through `ui.notifications.error`, and every suite case that
             * refuses an edit needs the message count without a toast flashing across the screen.
             *
             * @param {() => Promise<void>} run Work that may reject an edit.
             *
             * @returns {Promise<string[]>} The messages, in the order raised.
             */
            async function collectErrorNotifications(run) {
                const messages = [];
                const notify = ui.notifications.error;
                ui.notifications.error = (message) => {
                    messages.push(String(message));
                };

                try {
                    await run();
                } finally {
                    ui.notifications.error = notify;
                }

                return messages;
            }

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

                    it("restores centimetres when a rejected edit lands in the HEIGHT cell", async function () {
                        await setMetricUnits(true);
                        await actor.update({ [HEIGHT_PATH]: 40 });
                        await actor.sheet.render({ force: true });

                        await typeIntoCell(actor, HEIGHT_PATH, "abc");

                        // 40 inches draws 101.6 cm. The old restore printed the stored inches, 40, in a cell
                        // labelled centimetres.
                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("101.6");
                        expect(actor._source.system.CHARACTER.CHARACTER_INFO.HEIGHT).to.equal(40);
                    });

                    it("restores kilograms when a rejected edit lands in the WEIGHT cell", async function () {
                        await setMetricUnits(true);
                        // The pounds a metric commit of 100 kg leaves behind.
                        await actor.update({ [WEIGHT_PATH]: 220.46226218487757 });
                        await actor.sheet.render({ force: true });

                        await typeIntoCell(actor, WEIGHT_PATH, "abc");

                        expect(drawnText(actor, WEIGHT_PATH)).to.equal("100");
                        expect(actor._source.system.CHARACTER.CHARACTER_INFO.WEIGHT).to.equal(220.46226218487757);
                    });

                    it("restores the drawn 3.18 cm, not a re-rounded 3.17", async function () {
                        await setMetricUnits(true);
                        await actor.update({ [HEIGHT_PATH]: 1.25 });
                        await actor.sheet.render({ force: true });

                        await typeIntoCell(actor, HEIGHT_PATH, "abc");

                        // Core rounds by step, so 1.25 inches draws 3.18. A restore that recomputed with
                        // `toFixed` would print 3.17 and split the cell's own tie.
                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("3.18");
                        expect(actor._source.system.CHARACTER.CHARACTER_INFO.HEIGHT).to.equal(1.25);
                    });

                    it("restores the last accepted value, not the value first drawn", async function () {
                        await setMetricUnits(true);
                        await actor.update({ [HEIGHT_PATH]: 40 });
                        await actor.sheet.render({ force: true });

                        await typeIntoCell(actor, HEIGHT_PATH, "180");

                        // 180 cm as inches. The accepted commit must refresh the markup the next reject reads.
                        expect(actor._source.system.CHARACTER.CHARACTER_INFO.HEIGHT).to.equal(70.86614173228347);

                        await typeIntoCell(actor, HEIGHT_PATH, "abc");

                        expect(drawnText(actor, HEIGHT_PATH)).to.equal("180");
                        expect(actor._source.system.CHARACTER.CHARACTER_INFO.HEIGHT).to.equal(70.86614173228347);
                    });

                    it("restores the text a render draws, for both cells in both units", async function () {
                        const drift = [];

                        for (const metric of [false, true]) {
                            await setMetricUnits(metric);

                            for (const path of [HEIGHT_PATH, WEIGHT_PATH]) {
                                await actor.sheet.render({ force: true });
                                const before = drawnText(actor, path);

                                await typeIntoCell(actor, path, "abc");
                                const restored = drawnText(actor, path);

                                if (restored !== before) {
                                    drift.push(
                                        `${metric ? "metric" : "imperial"} ${path}: "${restored}" not "${before}"`,
                                    );
                                }
                            }
                        }

                        expect(drift).to.deep.equal([]);
                    });
                });
            });

            describe("Item sheet number contract", async function () {
                // Each fixture is one item, so the sheet renders only the cells that item owns. The XML
                // carries a BASECOST below zero on purpose: the contract must draw what Hero Designer
                // exports, not merely what a form expects.
                const BLAST_XML = `
                    <POWER XMLID="ENERGYBLAST" ID="1000000000021" BASECOST="-0.25" LEVELS="6" ALIAS="Blast"
                        POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default"
                        SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Contract Blast" INPUT="ED"
                        USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                        <NOTES />
                    </POWER>`;

                // OPTION THREE gives three charges, so the sheet draws the Charges cell.
                const CHARGED_XML = `
                    <POWER XMLID="ENERGYBLAST" ID="1000000000031" BASECOST="5.0" LEVELS="1" ALIAS="Blast"
                        POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default"
                        SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Charged Blast" INPUT="ED"
                        USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <MODIFIER XMLID="CHARGES" ID="1000000000032" BASECOST="-1.25" LEVELS="0" ALIAS="Charges"
                            POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default"
                            SHOW_ACTIVE_COST="Yes" OPTION="THREE" OPTIONID="THREE" OPTION_ALIAS="3"
                            INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                    </POWER>`;

                // REC is the LEVELS of the nested ENDURANCERESERVEREC power, written through its own branch.
                const RESERVE_XML = `
                    <POWER XMLID="ENDURANCERESERVE" ID="1000000000041" BASECOST="0.0" LEVELS="20"
                        ALIAS="Endurance Reserve" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst"
                        COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes"
                        NAME="Reserve" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <POWER XMLID="ENDURANCERESERVEREC" ID="1000000000042" BASECOST="0.0" LEVELS="4"
                            ALIAS="Recovery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255"
                            SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""
                            AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>
                    </POWER>`;

                /**
                 * Create one item and open its sheet, so the sheet's own listener is attached.
                 *
                 * @param {object} test Mocha test context. The fixture helpers name the actor from it.
                 * @param {string} xml Hero Designer XML for one item.
                 *
                 * @returns {Promise<{actor: HeroSystem6eActor, item: HeroSystem6eItem}>} The fixture pair.
                 */
                async function openItemSheet(test, xml) {
                    const actor = await createQuenchActor({
                        quench: test,
                        contents: xml,
                        is5e: false,
                        actorType: "pc",
                    });
                    const item = actor.items.contents[0];

                    await item.sheet.render({ force: true });

                    return { actor, item };
                }

                /**
                 * Read one cell of a rendered item sheet.
                 *
                 * @param {HeroSystem6eItem} item Item whose sheet holds the cell.
                 * @param {string} name Property path the cell writes.
                 *
                 * @returns {HTMLInputElement} The input.
                 *
                 * @throws {Error} When the sheet renders no such cell.
                 */
                function cell(item, name) {
                    const input = item.sheet.element.querySelector(`input[name="${name}"]`);

                    if (!input) {
                        throw new Error(`item sheet renders no input[name="${name}"] for ${item.name}`);
                    }

                    return input;
                }

                /**
                 * Put text in one cell and blur it, so the sheet's change handler runs.
                 *
                 * @param {HeroSystem6eItem} item Item whose sheet holds the cell.
                 * @param {string} name Property path the cell writes.
                 * @param {string} text Text to commit.
                 *
                 * @returns {Promise<void>} Resolves once the handler and its write have settled.
                 */
                async function typeIntoItemCell(item, name, text) {
                    const input = cell(item, name);
                    input.value = text;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    await new Promise((resolve) => setTimeout(resolve, 250));
                }

                /**
                 * Put text in one focused cell and fire nothing, so the edit stays pending.
                 *
                 * Closing a sheet fires no change event for the focused input, so the sheet commits that cell
                 * itself. Focus is what puts the edit on that path.
                 *
                 * @param {HeroSystem6eItem} item Item whose sheet holds the cell.
                 * @param {string} name Property path the cell writes.
                 * @param {string} text Text to leave pending.
                 *
                 * @returns {void}
                 */
                function focusCellWithPendingText(item, name, text) {
                    const input = cell(item, name);
                    input.focus();
                    input.value = text;
                }

                describe("markup contract", async function () {
                    it("declares a legal contract that the drawn text satisfies", async function () {
                        const problems = [];

                        for (const xml of [BLAST_XML, CHARGED_XML, RESERVE_XML]) {
                            const { actor, item } = await openItemSheet(this, xml);

                            for (const input of item.sheet.element.querySelectorAll(
                                'input[type="number"], input[data-dtype="Number"]',
                            )) {
                                let contract;

                                try {
                                    contract = readNumericSchema(input);
                                } catch (error) {
                                    if (error instanceof InputElementNumberSchemaError) {
                                        problems.push(`${item.name} ${input.name}: ${error.reason}`);
                                        continue;
                                    }
                                    throw error;
                                }

                                // The text the sheet drew must pass the contract the same markup declares.
                                // A floor that real data breaks lands here: a negative BASECOST in a cell
                                // declared min="0", or a decimal in a cell declared step="1".
                                if (parseNumericInput(input.value, contract) === null) {
                                    problems.push(`${item.name} ${input.name}: draws "${input.value}"`);
                                }
                            }

                            await deleteQuenchActor({ quench: this, actor });
                        }

                        expect(problems).to.deep.equal([]);
                    });

                    it("declares no floor on BASECOST, so an exported negative still draws", async function () {
                        const { actor, item } = await openItemSheet(this, BLAST_XML);
                        const input = cell(item, "system.BASECOST");

                        expect(input.getAttribute("step")).to.equal("0.01");
                        expect(input.getAttribute("min")).to.equal(null);
                        expect(input.value).to.equal("-0.25");

                        await deleteQuenchActor({ quench: this, actor });
                    });
                });

                describe("rejected edits", async function () {
                    let actor;
                    let item;

                    beforeEach(async function () {
                        ({ actor, item } = await openItemSheet(this, BLAST_XML));
                    });

                    afterEach(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("refuses text that is not a number, and names the field", async function () {
                        const drawn = cell(item, "system.BASECOST").value;

                        const messages = await collectErrorNotifications(async () =>
                            typeIntoItemCell(item, "system.BASECOST", "abc"),
                        );

                        expect(item._source.system.BASECOST).to.equal(-0.25);
                        expect(messages.length, "one rejection must notify once").to.equal(1);
                        expect(messages[0]).to.include("BASECOST");
                        expect(cell(item, "system.BASECOST").value).to.equal(drawn);
                    });

                    it("refuses an exponent in a whole quantity cell", async function () {
                        await collectErrorNotifications(async () => typeIntoItemCell(item, "system.QUANTITY", "1e5"));

                        expect(item._source.system.QUANTITY).to.equal(1);
                    });

                    it("refuses a decimal in a whole quantity cell", async function () {
                        await collectErrorNotifications(async () => typeIntoItemCell(item, "system.QUANTITY", "3.5"));

                        expect(item._source.system.QUANTITY).to.equal(1);
                    });

                    it("refuses a negative in a floored quantity cell", async function () {
                        await collectErrorNotifications(async () => typeIntoItemCell(item, "system.QUANTITY", "-1"));

                        expect(item._source.system.QUANTITY).to.equal(1);
                    });
                });

                describe("accepted edits", async function () {
                    let actor;
                    let item;

                    beforeEach(async function () {
                        ({ actor, item } = await openItemSheet(this, BLAST_XML));
                    });

                    afterEach(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("writes a whole number and drops the leading zero from the box", async function () {
                        await typeIntoItemCell(item, "system.QUANTITY", "010");

                        expect(item._source.system.QUANTITY).to.equal(10);
                        expect(cell(item, "system.QUANTITY").value).to.equal("10");
                    });

                    it("keeps a negative base cost, because an exported power can carry one", async function () {
                        await typeIntoItemCell(item, "system.BASECOST", "-1.25");

                        expect(item._source.system.BASECOST).to.equal(-1.25);
                    });

                    it("commits the pending edit when the sheet closes with the cell focused", async function () {
                        focusCellWithPendingText(item, "system.QUANTITY", "7");
                        await item.sheet.close();

                        expect(item._source.system.QUANTITY).to.equal(7);
                    });

                    it("drops a pending invalid edit when the sheet closes", async function () {
                        focusCellWithPendingText(item, "system.QUANTITY", "1e5");

                        await collectErrorNotifications(async () => item.sheet.close());

                        expect(item._source.system.QUANTITY).to.equal(1);
                    });
                });

                describe("cells that write another field", async function () {
                    it("stores a REC of zero instead of rounding it up to one", async function () {
                        const { actor, item } = await openItemSheet(this, RESERVE_XML);

                        expect(cell(item, "rec").value, "REC draws the nested power's levels").to.equal("4");

                        await typeIntoItemCell(item, "rec", "0");

                        expect(item.findModsByXmlid("ENDURANCERESERVEREC").LEVELS).to.equal(0);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("stores a negative REC, because recovery code interprets it, not the cell", async function () {
                        const { actor, item } = await openItemSheet(this, RESERVE_XML);

                        const messages = await collectErrorNotifications(async () =>
                            typeIntoItemCell(item, "rec", "-2"),
                        );

                        expect(messages, "a negative REC is legal, so nothing may notify").to.deep.equal([]);
                        expect(item.findModsByXmlid("ENDURANCERESERVEREC").LEVELS).to.equal(-2);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("stores a negative END current, because a drained reserve sits below zero", async function () {
                        const { actor, item } = await openItemSheet(this, RESERVE_XML);

                        const messages = await collectErrorNotifications(async () =>
                            typeIntoItemCell(item, "system.value", "-3"),
                        );

                        expect(messages, "a negative pool current is legal, so nothing may notify").to.deep.equal([]);
                        expect(item._source.system.value).to.equal(-3);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("refuses a negative charge count at the cell", async function () {
                        const charged = await openItemSheet(this, CHARGED_XML);

                        // OPTION THREE fills the clip: three charges to start.
                        expect(cell(charged.item, "system.numCharges").value).to.equal("3");

                        const messages = await collectErrorNotifications(async () =>
                            typeIntoItemCell(charged.item, "system.numCharges", "-1"),
                        );

                        expect(charged.item.system.numCharges).to.equal(3);
                        expect(messages.length, "one rejection must notify once").to.equal(1);
                        expect(messages[0]).to.include("Charges");

                        await deleteQuenchActor({ quench: this, actor: charged.actor });
                    });

                    it("routes the charges cell to the helper that writes _charges", async function () {
                        const { actor, item } = await openItemSheet(this, CHARGED_XML);

                        // `system.numCharges` names no stored field. The sheet must hand the value to
                        // setChargesAndSave, which writes the _charges field the getter reads.
                        await typeIntoItemCell(item, "system.numCharges", "2");

                        expect(item._source.system._charges).to.equal(2);
                        expect(item.system.numCharges).to.equal(2);

                        await deleteQuenchActor({ quench: this, actor });
                    });
                });

                describe("martial art range offset", async function () {
                    /**
                     * Create an actor and one martial art, so the sheet draws the RANGE cell. An item needs an
                     * XMLID, and GENERIC_OBJECT is the one Hero Designer writes for a hand-built maneuver.
                     *
                     * @param {object} test Mocha test context. The fixture helpers name the actor from it.
                     * @param {number} range Stored range offset for the martial art.
                     *
                     * @returns {Promise<{actor: HeroSystem6eActor, item: HeroSystem6eItem}>} The fixture pair.
                     */
                    async function openMartialArt(test, range) {
                        const actor = await createQuenchActor({
                            quench: test,
                            contents: BLAST_XML,
                            is5e: false,
                            actorType: "pc",
                        });
                        const [item] = await actor.createEmbeddedDocuments("Item", [
                            {
                                name: "Contract Maneuver",
                                type: "martialart",
                                system: { XMLID: "GENERIC_OBJECT", RANGE: range },
                            },
                        ]);

                        await item.sheet.render({ force: true });

                        return { actor, item };
                    }

                    it("stores -2, the deepest offset the range table grants", async function () {
                        const { actor, item } = await openMartialArt(this, 0);

                        await typeIntoItemCell(item, "system.RANGE", "-2");

                        expect(item._source.system.RANGE).to.equal(-2);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("refuses -3, past the floor the range table grants", async function () {
                        const { actor, item } = await openMartialArt(this, 0);

                        const messages = await collectErrorNotifications(async () =>
                            typeIntoItemCell(item, "system.RANGE", "-3"),
                        );

                        expect(item._source.system.RANGE).to.equal(0);
                        expect(messages.length, "one rejection must notify once").to.equal(1);

                        await deleteQuenchActor({ quench: this, actor });
                    });
                });
            });

            /**
             * The adder and modifier editor declares the same LEVELS contract as the item sheet, and it persists
             * on form submit rather than on one input's change. That second path needs its own cases, because it
             * reaches the item through a merged payload instead of a writer the sheet picks.
             *
             * Measured before the wiring, on this fixture's COSTSEND adder: `3.5` stored 4, `abc` vanished with
             * no message, and `-2` stored -2. The DataModel decided, because nothing read the markup first.
             */
            describe("Adder editor number contract", async function () {
                // One power, one modifier. COSTSEND carries LEVELS, and the editor draws a cell for it.
                const COST_SEND_XML = `
                    <POWER XMLID="FORCEFIELD" ID="1000000000051" BASECOST="0.0" LEVELS="6" ALIAS="Resistant Protection"
                        POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default"
                        SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Contract Protection"
                        QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"
                        PDLEVELS="3" EDLEVELS="3" MDLEVELS="0" POWDLEVELS="0">
                        <NOTES />
                        <MODIFIER XMLID="COSTSEND" ID="1000000000052" BASECOST="-0.5" LEVELS="0" ALIAS="Costs Endurance"
                            POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default"
                            SHOW_ACTIVE_COST="Yes" OPTION="EVERYPHASE" OPTIONID="EVERYPHASE"
                            OPTION_ALIAS="Costs END Every Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS=""
                            PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                    </POWER>`;

                /**
                 * Create the fixture item and open the editor for its one modifier.
                 *
                 * @param {object} test Mocha test context. The fixture helper names the actor from it.
                 *
                 * @returns {Promise<{actor: HeroSystem6eActor, item: HeroSystem6eItem, editor: ItemModifierApplicationV2}>}
                 *     The fixture pair and the open editor.
                 *
                 * @throws {Error} When the fixture carries no COSTSEND modifier.
                 */
                async function openAdderEditor(test) {
                    const actor = await createQuenchActor({
                        quench: test,
                        contents: COST_SEND_XML,
                        is5e: false,
                        actorType: "pc",
                    });
                    const item = actor.items.contents[0];
                    const mod = item.system.MODIFIER?.find((entry) => entry.XMLID === "COSTSEND");

                    if (!mod) {
                        throw new Error("fixture holds no COSTSEND modifier, so the editor has nothing to edit");
                    }

                    const editor = new ItemModifierApplicationV2({ item, mod }, {});
                    await editor.render(true);

                    return { actor, item, editor };
                }

                /**
                 * Read one stored field of the fixture's adder.
                 *
                 * @param {HeroSystem6eItem} item Item that owns the adder.
                 * @param {string} field Field name on the adder source, for example `LEVELS`.
                 *
                 * @returns {number} The stored value.
                 */
                function storedAdderField(item, field) {
                    return item._source.system.MODIFIER.find((entry) => entry.XMLID === "COSTSEND")[field];
                }

                /**
                 * Read one cell of the editor by the label above it.
                 *
                 * A calculated cell carries no `name`, so a name lookup cannot find it. The label is what the
                 * player reads, so the label is what the case matches.
                 *
                 * @param {ItemModifierApplicationV2} editor Open editor holding the cell.
                 * @param {string} label Label text, for example `BASECOST`.
                 *
                 * @returns {HTMLInputElement} The input.
                 *
                 * @throws {Error} When the editor renders no cell with that label.
                 */
                function cellByLabel(editor, label) {
                    const group = [...editor.element.querySelectorAll(".form-group")].find(
                        (g) => g.querySelector("label")?.textContent?.trim() === label,
                    );

                    if (!group) {
                        throw new Error(`adder editor renders no ${label} cell`);
                    }

                    return group.querySelector("input");
                }

                /**
                 * Put text in one editor cell and fire the change that submits the form.
                 *
                 * @param {ItemModifierApplicationV2} editor Open editor holding the cell.
                 * @param {string} name Property path the cell writes, for example `mod.LEVELS`.
                 * @param {string} text Text to commit.
                 *
                 * @returns {Promise<void>} Resolves once the submit and its write have settled.
                 *
                 * @throws {Error} When the editor renders no such cell.
                 */
                async function typeIntoAdderCell(editor, name, text) {
                    const input = editor.element.querySelector(`input[name="${name}"]`);

                    if (!input) {
                        throw new Error(`adder editor renders no input[name="${name}"]`);
                    }

                    input.value = text;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    await new Promise((resolve) => setTimeout(resolve, 250));
                }

                it("stores 4, the whole level a player typed", async function () {
                    const { actor, editor, item } = await openAdderEditor(this);

                    const messages = await collectErrorNotifications(async () =>
                        typeIntoAdderCell(editor, "mod.LEVELS", "4"),
                    );

                    expect(storedAdderField(item, "LEVELS"), "a legal whole level must reach the adder").to.equal(4);
                    expect(messages, "an accepted edit raises no message").to.be.empty;

                    // Close without the animation. It costs about 1.3 s, and Mocha's per-test timeout
                    // is 2 s.
                    await editor.close({ animate: false });
                    await deleteQuenchActor({ quench: this, actor });
                });

                it("refuses 3.5 instead of storing the rounded 4", async function () {
                    const { actor, editor, item } = await openAdderEditor(this);

                    const messages = await collectErrorNotifications(async () =>
                        typeIntoAdderCell(editor, "mod.LEVELS", "3.5"),
                    );

                    expect(
                        storedAdderField(item, "LEVELS"),
                        "step 1 admits no fraction, so nothing may be stored",
                    ).to.equal(0);
                    expect(messages.length, "one rejection must notify once").to.equal(1);

                    // Close without the animation. It costs about 1.3 s, and Mocha's per-test timeout
                    // is 2 s.
                    await editor.close({ animate: false });
                    await deleteQuenchActor({ quench: this, actor });
                });

                it("draws BASECOST read-only, because the item calculates it", async function () {
                    const { actor, editor, item } = await openAdderEditor(this);
                    const cell = cellByLabel(editor, "BASECOST");

                    // The adder's cost comes from the Hero Designer XML, from the OPTION choice table, and from
                    // `replaceBaseCostForHalfDieAdderXml` and `replaceBaseCostForPipAdderXml`. The editor only
                    // shows the answer, so the cell stays disabled and unnamed: a disabled field never enters
                    // the submitted form, and an unnamed one has no key to write.
                    expect(cell.disabled, "BASECOST is calculated, so the player may not type it").to.equal(true);
                    expect(cell.getAttribute("name"), "no name means no key in the payload").to.equal(null);
                    expect(cell.value, "the cell draws the stored cost").to.equal(
                        String(storedAdderField(item, "BASECOST")),
                    );

                    await editor.close({ animate: false });
                    await deleteQuenchActor({ quench: this, actor });
                });

                it("refuses -2, below the level floor of zero", async function () {
                    const { actor, editor, item } = await openAdderEditor(this);

                    const messages = await collectErrorNotifications(async () =>
                        typeIntoAdderCell(editor, "mod.LEVELS", "-2"),
                    );

                    expect(
                        storedAdderField(item, "LEVELS"),
                        "levels count a purchase, so a minus may not be stored",
                    ).to.equal(0);
                    expect(messages.length, "one rejection must notify once").to.equal(1);

                    // Close without the animation. It costs about 1.3 s, and Mocha's per-test timeout
                    // is 2 s.
                    await editor.close({ animate: false });
                    await deleteQuenchActor({ quench: this, actor });
                });
            });
        },
        { displayName: "HERO: Numeric Input Validation" },
    );
}
