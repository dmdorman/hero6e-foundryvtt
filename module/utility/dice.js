export const ROLL_TYPE = {
    SUCCESS: 0,
    NORMAL: 1,
    KILLING: 2,
    ADJUSTMENT: 3,
    ENTANGLE: 4,
    FLASH: 5,
};

/**
 * @typedef {Object} HitLocationInfo
 * @property {string} name
 * @property {"Left" | "Right" | ""} side
 * @property {string} fullName
 * @property {number} stunMultiplier
 * @property {number} bodyMultiplier
 */
export class HeroRoller {
    static STANDARD_EFFECT_DIE_ROLL = 3;
    static STANDARD_EFFECT_HALF_DIE_ROLL = 1;

    static #sidedLocations = [
        "Hand",
        "Shoulder",
        "Arm",
        "Thigh",
        "Leg",
        "Foot",
    ];

    static #sumTerms(terms) {
        return terms.reduce((total, term) => {
            return total + HeroRoller.#sum(term);
        }, 0);
    }

    static #sum(term) {
        return term.reduce((subTotal, result) => {
            return subTotal + result;
        }, 0);
    }

    // Assumption arrays are the same size
    static #zipTerms(first, second) {
        return first.map((ele, index) => [ele, second[index]]);
    }

    constructor(options, rollClass = Roll) {
        this._buildRollClass = rollClass;
        this._options = options;
        this._rollObj = undefined;

        this._formulaTerms = [];

        this._type = ROLL_TYPE.SUCCESS;

        this._killingStunMultiplierHeroRoller = undefined;
        this._killingBaseStunMultiplier = 0;
        this._killingAdditionalStunMultiplier = 0;

        this._standardEffect = false;

        this._hitLocation = {
            name: "body",
            side: "",
            fullName: "body",
            stunMultiplier: 1,
            bodyMultiplier: 1,
        };
        this._useHitLocation = false;
        this._alreadyHitLocation = "none";
    }

    getType() {
        return this._type;
    }

    makeSuccessRoll(apply = true) {
        if (apply) {
            this._type = ROLL_TYPE.SUCCESS;
        }
        return this;
    }

    makeNormalRoll(apply = true) {
        if (apply) {
            this._type = ROLL_TYPE.NORMAL;
        }
        return this;
    }

    makeKillingRoll(apply = true, isd6minus1 = false) {
        if (apply) {
            this._type = ROLL_TYPE.KILLING;
            this._killingStunMultiplier = isd6minus1 ? "1d6-1" : "1d3";
        }
        return this;
    }

    makeAdjustmentRoll(apply = true) {
        if (apply) {
            this._type = ROLL_TYPE.ADJUSTMENT;
        }
        return this;
    }

    makeEntangleRoll(apply = true) {
        if (apply) {
            this._type = ROLL_TYPE.ENTANGLE;
        }
        return this;
    }

    makeFlashRoll(apply = true) {
        if (apply) {
            this._type = ROLL_TYPE.FLASH;
        }
        return this;
    }

    modifyToStandardEffect(apply = true) {
        if (apply) {
            this._standardEffect = true;
        }
        return this;
    }

    addToHitLocation(apply = true, alreadyHitLocation) {
        if (apply) {
            this._useHitLocation = true;
            this._alreadyHitLocation = alreadyHitLocation || "none";
        }
        return this;
    }

    #linkIfNotFirstTerm(operator = "+") {
        if (this._formulaTerms.length > 0) {
            this._formulaTerms.push(new OperatorTerm({ operator: operator }));
        }
    }

    // TODO: May wish to add tagging information to each of these. Are tags always 1:1?
    addDice(numDice) {
        if (!numDice) {
            return this;
        }

        this.#linkIfNotFirstTerm();

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: { _hrFlavor: "add dice" },
            }),
        );

        return this;
    }

    addHalfDice(numDice = 1) {
        if (!numDice) {
            return this;
        }

        this.#linkIfNotFirstTerm();

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: { _hrFlavor: "half die" },
            }),
        );

        return this;
    }

    addDieMinus1(numDice = 1) {
        if (!numDice) {
            return this;
        }

        this.#linkIfNotFirstTerm();

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: { _hrFlavor: "less 1 pip" },
            }),
        );

        return this;
    }

    addDieMinus1Min1(numDice = 1) {
        if (!numDice) {
            return this;
        }

        this.#linkIfNotFirstTerm();

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: { _hrFlavor: "less 1 pip min 1" },
            }),
        );

        return this;
    }

    subDice(numDice) {
        if (!numDice) {
            return this;
        }

        this.#linkIfNotFirstTerm("-");

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: { _hrFlavor: "sub dice" },
            }),
        );

        return this;
    }

    // TODO: Experiment with adding description as flavor and autogenerated tags.
    addNumber(value, description) {
        if (!value) {
            return this;
        }

        this.#linkIfNotFirstTerm();

        this._formulaTerms.push(
            new NumericTerm({
                number: value,
                options: {
                    _hrFlavor: "add number",
                    flavor: description,
                    _hrTag: {
                        name: description,
                        value: value,
                    },
                },
            }),
        );

        return this;
    }

    subNumber(value) {
        if (!value) {
            return this;
        }

        this.#linkIfNotFirstTerm("-");

        this._formulaTerms.push(
            new NumericTerm({
                number: value,
                options: { _hrFlavor: "sub number" },
            }),
        );

        return this;
    }

    addStunMultiplier(levels) {
        if (levels) {
            this._killingAdditionalStunMultiplier += levels;
        }
        return this;
    }

    async roll(options) {
        this._rollObj = this._buildRollClass.fromTerms(
            this._formulaTerms,
            this._options,
        );

        await this._rollObj.evaluate({
            ...options,
            async: true,
        });

        // Convert to standard effect if appropriate.
        this._rollObj.terms = this.#applyStandardEffectIfAppropriate(
            this._rollObj.terms,
        );

        await this.#calculateStunMultiplierIfAppropriate();

        await this.#calculateHitLocationIfAppropriate();

        this._rawBaseTerms = this._rollObj.terms;

        this.#calculate();

        return this;
    }

    // TODO: May wish to consider our own custom chat template for this.
    // TODO: May wish to consider no flavour, but rather have it be the type of roll?
    async render() {
        const template = this._buildRollClass.CHAT_TEMPLATE;

        // TODO: Don't show stun multiplier if hit locations involved
        // TODO: How to best handle the difference between hit location applied on killing vs normal attacks?
        const chatData = {
            formula: this.#buildFormula(),
            flavor: null,
            user: game.user.id,
            tooltip: this.#buildTooltip(),
            total: this.#buildTooltipTotal(),
        };

        return renderTemplate(template, chatData);
    }

    tags() {
        return this._formulaTerms
            .map((term) => {
                return term.options._hrTag;
            })
            .filter(Boolean);
    }

    getFormula() {
        return this.#buildFormula();
    }

    getSuccessTerms() {
        if (this._type === ROLL_TYPE.SUCCESS) {
            return this.getBaseTerms();
        }

        throw new Error(
            `asking for success from type ${this._type} doesn't make sense`,
        );
    }
    getSuccessTotal() {
        if (this._type === ROLL_TYPE.SUCCESS) {
            return this.getBaseTotal();
        }

        throw new Error(
            `asking for success from type ${this._type} doesn't make sense`,
        );
    }

    getStunTerms() {
        if (this._type === ROLL_TYPE.NORMAL) {
            return this.getBaseTerms();
        } else if (this._type === ROLL_TYPE.KILLING) {
            return this.getCalculatedTerms();
        }

        throw new Error(
            `asking for stun from type ${this._type} doesn't make sense`,
        );
    }
    getStunTotal() {
        if (this._type === ROLL_TYPE.NORMAL) {
            return this.getBaseTotal();
        } else if (this._type === ROLL_TYPE.KILLING) {
            return this.getCalculatedTotal();
        }

        throw new Error(
            `asking for stun from type ${this._type} doesn't make sense`,
        );
    }
    getStunMultiplier() {
        if (this._type === ROLL_TYPE.KILLING) {
            return this.getBaseMultiplier();
        }

        throw new Error(
            `asking for stun multiplier from type ${this._type} doesn't make sense`,
        );
    }

    getBodyTerms() {
        if (this._type === ROLL_TYPE.NORMAL) {
            return this.getCalculatedTerms();
        } else if (this._type === ROLL_TYPE.KILLING) {
            return this.getBaseTerms();
        }

        throw new Error(
            `asking for body from type ${this._type} doesn't make sense`,
        );
    }
    getBodyTotal() {
        if (this._type === ROLL_TYPE.NORMAL) {
            return this.getCalculatedTotal();
        } else if (this._type === ROLL_TYPE.KILLING) {
            return this.getBaseTotal();
        }

        throw new Error(
            `asking for body from type ${this._type} doesn't make sense`,
        );
    }

    getEntangleTotal() {
        if (this._type === ROLL_TYPE.ENTANGLE) {
            return this.getBaseTotal();
        }

        throw new Error(
            `asking for entangle from type ${this._type} doesn't make sense`,
        );
    }

    getAdjustmentTotal() {
        if (this._type === ROLL_TYPE.ADJUSTMENT) {
            return this.getBaseTotal();
        }

        throw new Error(
            `asking for adjustment from type ${this._type} doesn't make sense`,
        );
    }

    getFlashTotal() {
        if (this._type === ROLL_TYPE.FLASH) {
            return this.getBaseTotal();
        }

        throw new Error(
            `asking for flash from type ${this._type} doesn't make sense`,
        );
    }

    getBaseTerms() {
        return this._baseTerms;
    }
    getBaseTotal() {
        return this._baseTotal;
    }
    getBaseMultiplier() {
        return Math.max(
            this._killingBaseStunMultiplier +
                this._killingAdditionalStunMultiplier,
            1,
        );
    }

    getCalculatedTerms() {
        if (
            this._type === ROLL_TYPE.SUCCESS ||
            this._type === ROLL_TYPE.ENTANGLE ||
            this._type === ROLL_TYPE.FLASH
        ) {
            console.error(
                `attempting to get calculatedTerms for roll type ${this._type}`,
            );
        }

        return this._calculatedTerms;
    }

    getCalculatedTotal() {
        return this._calculatedTotal;
    }

    /**
     *
     * @returns {HitLocationInfo}
     */
    getHitLocation() {
        return this._hitLocation;
    }

    // TODO: toJSON fromJSON

    async #calculateStunMultiplierIfAppropriate() {
        if (this._type === ROLL_TYPE.KILLING) {
            this._killingStunMultiplierHeroRoller = new HeroRoller(
                {},
                this._buildRollClass,
            )
                .addDieMinus1Min1(
                    this._killingStunMultiplier === "1d6-1" ? 1 : 0,
                )
                .addHalfDice(this._killingStunMultiplier === "1d3" ? 1 : 0)
                .modifyToStandardEffect(this._standardEffect);

            await this._killingStunMultiplierHeroRoller.roll({ async: true });

            this._killingBaseStunMultiplier =
                this._killingStunMultiplierHeroRoller.getSuccessTotal();
        }
    }

    /**
     * @returns {HitLocationInfo}
     */
    async #calculateHitLocationIfAppropriate() {
        if (
            this._useHitLocation &&
            (this._type === ROLL_TYPE.NORMAL ||
                this._type === ROLL_TYPE.KILLING)
        ) {
            this._hitLocationRoller = new HeroRoller({}, this._buildRollClass)
                .addDice(3)
                .addDice(1);
            await this._hitLocationRoller.roll();

            const locationRollTotal = HeroRoller.#sum(
                this._hitLocationRoller.getBaseTerms()[0],
            );
            const locationSideRollTotal = HeroRoller.#sum(
                this._hitLocationRoller.getBaseTerms()[1],
            );

            const locationName =
                this._alreadyHitLocation && this._alreadyHitLocation !== "none"
                    ? this._alreadyHitLocation
                    : CONFIG.HERO.hitLocationsToHit[locationRollTotal];
            const locationSide = locationSideRollTotal > 4 ? "Right" : "Left";

            this._hitLocation = {
                name: locationName,
                side: locationSide,
                fullName: HeroRoller.#sidedLocations.includes(locationName)
                    ? `${locationSide} ${locationName}`
                    : locationName,
                stunMultiplier:
                    this._type === ROLL_TYPE.KILLING
                        ? CONFIG.HERO.hitLocations[locationName][0]
                        : CONFIG.HERO.hitLocations[locationName][1],
                bodyMultiplier: CONFIG.HERO.hitLocations[locationName][2],
            };
        }
    }

    #calculateValue(result) {
        switch (this._type) {
            case ROLL_TYPE.SUCCESS:
            case ROLL_TYPE.ADJUSTMENT:
                // Do nothing as there are no calculated values
                break;

            case ROLL_TYPE.NORMAL:
                // Calculate BODY
                if (result <= 1) {
                    return 0;
                } else if (result === 6) {
                    return 2;
                }

                return 1;

            case ROLL_TYPE.KILLING:
                if (this._useHitLocation) {
                    return result;
                }

                return result * this.getBaseMultiplier();

            case ROLL_TYPE.ENTANGLE:
            case ROLL_TYPE.FLASH:
            default:
                console.error(`Unhandled calculation for type ${this._type}`);
        }
    }

    #calculate() {
        this._calculatedTerms = [];

        let lastOperatorMultiplier = 1;

        this._baseTerms = this._rawBaseTerms
            .map((term) => {
                if (term instanceof NumericTerm) {
                    const number = lastOperatorMultiplier * term.number;
                    const hrExtra = {
                        term: "Numeric",
                        flavor: term.options._hrFlavor,
                        baseNumber: term.number,
                        signMultiplier:
                            lastOperatorMultiplier * (term.number < 0 ? -1 : 1),
                    };

                    const newCalculatedTerm = [this.#calculateValue(number)];
                    newCalculatedTerm._hrExtra = hrExtra;
                    this._calculatedTerms.push(newCalculatedTerm);

                    const newBaseTerm = [number];
                    newBaseTerm._hrExtra = hrExtra;
                    return newBaseTerm;
                } else if (term instanceof OperatorTerm) {
                    // NOTE: No need to handle multiplication and division as
                    //       this class doesn't support it.
                    lastOperatorMultiplier = term.operator === "-" ? -1 : 1;
                } else if (term instanceof Die) {
                    const calculatedTerms = [];
                    const hrExtra = {
                        term: "Dice",
                        flavor: term.options._hrFlavor,
                        numberOfDice: term.results.length,
                        signMultiplier: lastOperatorMultiplier,
                        min: -99,
                        max: -99,
                    };
                    calculatedTerms._hrExtra = foundry.utils.deepClone(hrExtra);

                    const termResults = term.results.map((result) => {
                        let adjustedValue =
                            lastOperatorMultiplier * result.result;

                        if (term.options._hrFlavor === "half die") {
                            adjustedValue = Math.ceil(result.result / 2);
                            hrExtra.min = 1;
                            hrExtra.max = 3;
                        } else if (
                            term.options._hrFlavor === "less 1 pip" &&
                            !this._standardEffect
                        ) {
                            adjustedValue = result.result - 1;
                            hrExtra.min = 0;
                            hrExtra.max = 5;
                        } else if (
                            term.options._hrFlavor === "less 1 pip min 1" &&
                            !this._standardEffect
                        ) {
                            adjustedValue = Math.max(1, result.result - 1);
                            hrExtra.min = 1;
                            hrExtra.max = 5;
                        } else {
                            hrExtra.min = 1;
                            hrExtra.max = 6;
                        }

                        calculatedTerms.push(
                            this.#calculateValue(adjustedValue),
                        );

                        return adjustedValue;
                    });

                    this._calculatedTerms.push(calculatedTerms);

                    termResults._hrExtra = hrExtra;
                    return termResults;
                } else {
                    // Other term types will return undefined and be filtered out
                    // although we shouldn't ever get them.
                }
            })
            .filter(Boolean);

        this._baseTotal = HeroRoller.#sumTerms(this._baseTerms);

        if (this._type !== ROLL_TYPE.SUCCESS) {
            this._calculatedTotal = HeroRoller.#sumTerms(this._calculatedTerms);
        }
    }

    #buildFormula() {
        const formula = this._baseTerms.reduce((formulaSoFar, term, index) => {
            // TODO: This will work until we allow modification post evaluation
            // TODO: Will need to fix things like " + " concatenated with "-2"
            // TODO: Will need to work with 1d6-1, 1d6-1(min 1), and 1/2d6
            return formulaSoFar + this.#buildFormulaForTerm(term, !!index);
        }, "");

        return formula;
    }

    #buildTooltip() {
        return `<div class="dice-tooltip">
                    <section class="tooltip-part">
                        ${this.#buildDiceTooltip()}
                    </section>
                </div>`;
    }

    #buildDiceTooltip() {
        let preliminaryTooltip = "";
        if (this._type === ROLL_TYPE.KILLING) {
            const stunMultiplier =
                this._killingStunMultiplierHeroRoller.getBaseTotal();
            const stunMultiplierFormula =
                this._killingStunMultiplierHeroRoller.getFormula();

            preliminaryTooltip = `
                <div class="dice">
                    <header class="part-header flexrow">
                        <span class="part-formula">${stunMultiplierFormula} STUN Multiplier</span>
                        <span class="part-total">${stunMultiplier}</span>
                    </header>
                    <ol class="dice-rolls">
                        ${this.#buildDiceRollsTooltip(
                            this._killingStunMultiplierHeroRoller.getBaseTerms()[0],
                            true,
                        )}
                    </ol>
                </div>
            `;
        }

        const zippedTerms = HeroRoller.#zipTerms(
            this._baseTerms,
            this._calculatedTerms,
        );

        return zippedTerms.reduce((soFar, zippedTerm) => {
            if (
                zippedTerm[0]._hrExtra.term === "Dice" ||
                zippedTerm[0]._hrExtra.term === "Numeric"
            ) {
                const baseTotal = HeroRoller.#sum(zippedTerm[0]);
                const baseFormula = this.#buildFormulaForTerm(
                    zippedTerm[0],
                    false,
                );
                const baseFormulaPurpose = this.#buildFormulaBasePurpose();

                const baseTermTooltip = `
                        <div class="dice">
                            <header class="part-header flexrow">
                                <span class="part-formula">${baseFormula} ${baseFormulaPurpose}</span>
                                <span class="part-total">${baseTotal}</span>
                            </header>
                            <ol class="dice-rolls">
                                ${this.#buildDiceRollsTooltip(
                                    zippedTerm[0],
                                    true,
                                )}
                            </ol>
                        </div>
                    `;

                const calculatedTotal = HeroRoller.#sum(zippedTerm[1]);
                const calculatedFormulaPurpose =
                    this.#buildFormulaCalculatedPurpose();
                const calculatedTermTooltip =
                    !this.#buildFormulaCalculatedPurpose()
                        ? ""
                        : `
                            <div class="dice">
                                <header class="part-header flexrow">
                                    <span class="part-formula">${calculatedFormulaPurpose} calculated from ${baseFormula} ${baseFormulaPurpose}</span>
                                    <span class="part-total">${calculatedTotal}</span>
                                </header>
                                <ol class="dice-rolls">
                                    ${this.#buildDiceRollsTooltip(
                                        zippedTerm[1],
                                        false,
                                    )}
                                </ol>
                            </div>
                        `;

                return `${soFar}${baseTermTooltip}${calculatedTermTooltip}`;
            }
        }, preliminaryTooltip);
    }

    #buildFormulaForTerm(term, showPositive) {
        const sign =
            term._hrExtra.signMultiplier < 0
                ? " - "
                : showPositive
                  ? " + "
                  : " ";

        if (term._hrExtra.term === "Dice") {
            if (term._hrExtra.flavor === "half die") {
                return `${sign}½d6`;
            } else if (term._hrExtra.flavor === "less 1 pip") {
                return `${
                    term._hrExtra.signMultiplier < 0
                        ? `${sign}(d6-1)`
                        : `${sign}d6-1`
                }`;
            } else if (term._hrExtra.flavor === "less 1 pip min 1") {
                return `${
                    term._hrExtra.signMultiplier < 0
                        ? `${sign}(d6-1[min 1])`
                        : `${sign}d6-1[min 1]`
                }`;
            } else {
                return `${sign}${term.length}d6`;
            }
        } else if (term._hrExtra.term === "Numeric") {
            // NOTE: Should only be 1 value per Numeric term
            return `${sign}${term._hrExtra.signMultiplier * term[0]}`;
        }
    }

    #buildFormulaBasePurpose() {
        switch (this._type) {
            case ROLL_TYPE.SUCCESS:
                return "";

            case ROLL_TYPE.NORMAL:
                return "STUN";

            case ROLL_TYPE.ENTANGLE:
            case ROLL_TYPE.KILLING:
                return "BODY";

            case ROLL_TYPE.ADJUSTMENT:
                return "Active Points";

            case ROLL_TYPE.FLASH:
                return "Segments";

            default:
                console.error(`unknown base purpose type ${this._type}`);
                return "";
        }
    }

    #buildFormulaCalculatedPurpose() {
        switch (this._type) {
            case ROLL_TYPE.SUCCESS:
            case ROLL_TYPE.ENTANGLE:
            case ROLL_TYPE.ADJUSTMENT:
            case ROLL_TYPE.FLASH:
                // No calculated terms
                return "";

            case ROLL_TYPE.KILLING:
                return "STUN";

            case ROLL_TYPE.NORMAL:
                return "BODY";

            default:
                console.error(`unknown base purpose type ${this._type}`);
                return "";
        }
    }

    #buildDiceRollsTooltip(diceTerm, showMinMax) {
        return diceTerm.reduce((soFar, result) => {
            const absNumber = Math.abs(result);

            // TODO: Perhaps should have different interpretation based on 1d6 vs 1d6 - 1 vs 1?
            // TODO: Make able to show for calculated
            return `${soFar}<li class="roll die d6 ${
                showMinMax ? this.#buildMinMaxClass(diceTerm, result) : ""
            }">${absNumber}</li>`;
        }, "");
    }

    #buildMinMaxClass(term, value) {
        if (term._hrExtra.term === "Dice") {
            const absValue = Math.abs(value);
            const minPossible = term._hrExtra.min;
            const maxPossible = term._hrExtra.max;

            return absValue === minPossible
                ? "min"
                : absValue === maxPossible
                  ? "max"
                  : "";
        }

        return "";
    }

    #buildTooltipTotal() {
        switch (this._type) {
            case ROLL_TYPE.SUCCESS:
                return `${this._baseTotal}`;

            case ROLL_TYPE.NORMAL:
                return `${this.getBodyTotal()} BODY; ${this.getStunTotal()} STUN`;

            case ROLL_TYPE.KILLING:
                return `${this.getBodyTotal()} BODY; ${this.getStunTotal()} STUN (${this.getStunMultiplier()}x)`;

            case ROLL_TYPE.ENTANGLE:
                return `${this.getEntangleTotal()} BODY`;

            case ROLL_TYPE.ADJUSTMENT:
                return `${this.getAdjustmentTotal()} Active Points`;

            case ROLL_TYPE.FLASH:
                return `${this.getFlashTotal()} Segments`;

            default:
                console.error(`unknown type ${this._type}`);
                break;
        }
    }

    #applyStandardEffectIfAppropriate(formulaTerms) {
        if (this._standardEffect) {
            for (let i = 0; i < formulaTerms.length; ++i) {
                if (formulaTerms[i] instanceof Die) {
                    for (let j = 0; j < formulaTerms[i].results.length; ++j) {
                        if (formulaTerms[i].options._hrFlavor === "half die") {
                            formulaTerms[i].results[j].result =
                                HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL;
                        } else {
                            // NOTE: 5e p. 104 & 6E1 p.133. Full die and (die - 1) count as 3.
                            formulaTerms[i].results[j].result =
                                HeroRoller.STANDARD_EFFECT_DIE_ROLL;
                        }
                    }
                }
            }
        }

        return formulaTerms;
    }
}
