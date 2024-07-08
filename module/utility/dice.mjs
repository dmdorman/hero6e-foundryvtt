import { isGameV12OrLater } from "./compatibility.mjs";

const DICE_SO_NICE_CUSTOM_SETS = {
    STUNx: {
        colorset: "Stun Multiplier",
        foreground: "white",
        background: "blue",
        edge: "blue",
        material: "wood",
        fontScale: {
            d6: 1.1,
        },
        visibility: "visible",
    },
    HIT_LOC: {
        colorset: "Hit Location - Body Part",
        foreground: "black",
        background: "red",
        edge: "red",
        material: "wood",
        fontScale: {
            d6: 1.1,
        },
        visibility: "visible",
    },
    HIT_LOC_SIDE: {
        colorset: "Hit Location - Body Side",
        foreground: "black",
        background: "green",
        edge: "green",
        material: "wood",
        fontScale: {
            d6: 1.1,
        },
        visibility: "visible",
    },
};

const DICE_SO_NICE_CATEGORY_NAME = "Hero System 6e (Unofficial) V2";

// v11/v12 compatibility shim.
// TODO: Cleanup eslint file with these terms
const Die = CONFIG.Dice.terms.d;
const NumericTerm = CONFIG.Dice.termTypes.NumericTerm;
const OperatorTerm = CONFIG.Dice.termTypes.OperatorTerm;

// foundry.dice.terms.RollTerm is the v12 way of finding the class
const RollTermClass = foundry.dice?.terms.RollTerm ? foundry.dice.terms.RollTerm : RollTerm;

/**
 * Add colour sets into Dice So Nice! This allows users to see what the colour set is for each function.
 * Players can then choose to use that theme for maximum confusion as to which are their rolls and which
 * are the extras for hit location or stun multiplier.
 */
Hooks.once("diceSoNiceReady", (diceSoNice) => {
    diceSoNice.addColorset(
        {
            ...{
                name: "Stun Multiplier",
                description: "Stun Multiplier Dice",
                category: DICE_SO_NICE_CATEGORY_NAME,
            },
            ...DICE_SO_NICE_CUSTOM_SETS.STUNx,
        },
        "default",
    );

    diceSoNice.addColorset(
        {
            ...{
                name: "Hit Location - Body Part",
                description: "Hit Location - Body Part Dice",
                category: DICE_SO_NICE_CATEGORY_NAME,
            },
            ...DICE_SO_NICE_CUSTOM_SETS.HIT_LOC,
        },
        "default",
    );

    diceSoNice.addColorset(
        {
            ...{
                name: "Hit Location - Body Side",
                description: "Hit Location - Body Side Dice",
                category: DICE_SO_NICE_CATEGORY_NAME,
            },
            ...DICE_SO_NICE_CUSTOM_SETS.HIT_LOC_SIDE,
        },
        "default",
    );
});

/**
 * @typedef {Object} TermMetadataEntry
 * @param {string} term
 * @param {number} originalTermIndex
 * @param {number} termIndex
 * @param {HeroRoller.QUALIFIER} qualifier
 * @param {number} originalTermCardinality
 * @param {number} termCardinality
 * @param {number} signMultiplier
 * @param {number} min
 * @param {number} max
 * @param {string} classDecorators
 */

/**
 * @typedef {Object} TermClusterEntry
 * @param {Object} base
 * @param {TermMetadataEntry} baseMetadata
 * @param {Object} calculated
 * @param {TermMetadataEntry} calculatedMetadata
 */

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

    static ROLL_TYPE = {
        BASIC: "basic",
        SUCCESS: "success",
        NORMAL: "normal",
        KILLING: "killing",
        ADJUSTMENT: "adjustment",
        ENTANGLE: "entangle",
        FLASH: "flash",
        EFFECT: "effect",
    };

    static QUALIFIER = {
        FULL_DIE: "full dice",
        HALF_DIE: "half dice",
        FULL_DIE_LESS_ONE: "full dice less 1",
        FULL_DIE_LESS_ONE_MIN_ONE: "full dice less 1 min 1",

        NUMBER: "number",
    };

    static #qualifierToKillingDC = {
        [HeroRoller.QUALIFIER.FULL_DIE]: 3,
        [HeroRoller.QUALIFIER.HALF_DIE]: 2,
        [HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE]: 2,
        [HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE_MIN_ONE]: 2,
        [HeroRoller.QUALIFIER.NUMBER]: 1,
    };

    static #sum(term) {
        return term.reduce((subTotal, result) => {
            return subTotal + result;
        }, 0);
    }

    static #extractPropertyFromTermsCluster(termsCluster, property) {
        return termsCluster.map((termCluster) => termCluster[property]);
    }

    /**
     * Add Dice So Nice dice skinning to rolls.
     */
    static #addDiceSoNiceSkinning(roll) {
        if (roll?.options?.appearance) {
            roll.dice[0].options.appearance = roll.options.appearance;
        }

        return roll;
    }

    /**
     * @type {TermClusterEntry[]}
     */
    _termsCluster;

    constructor(options, rollClass = Roll) {
        this._buildRollClass = rollClass;
        this._options = options;
        this._rollObj = undefined;

        this._formulaTerms = [];

        this._type = HeroRoller.ROLL_TYPE.BASIC;
        this._is5eRoll = false;

        this._termsCluster = [];

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

        this._useHitLocationSide = false;
        this._alreadyHitLocationSide = "none";

        this._successValue = undefined;
        this._successRolledValue = undefined;

        // STUN only?
        this._noBody = false;
    }

    getType() {
        return this._type;
    }

    makeBasicRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.BASIC;
        }
        return this;
    }

    makeSuccessRoll(apply = true, successValue) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.SUCCESS;
            this._successValue = successValue;
        }
        return this;
    }

    makeNormalRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.NORMAL;
        }
        return this;
    }

    makeKillingRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.KILLING;
            this._killingStunMultiplier = this._is5eRoll ? "1d6-1" : "1d3";
        }
        return this;
    }

    makeAdjustmentRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.ADJUSTMENT;
        }
        return this;
    }

    makeEntangleRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.ENTANGLE;
        }
        return this;
    }

    makeFlashRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.FLASH;
        }
        return this;
    }

    makeEffectRoll(apply = true) {
        if (apply) {
            this._type = HeroRoller.ROLL_TYPE.EFFECT;
        }
        return this;
    }

    modifyToStandardEffect(apply = true) {
        if (apply) {
            this._standardEffect = true;
        }
        return this;
    }

    modifyTo5e(apply = false) {
        if (apply) {
            this._is5eRoll = true;
            this.makeKillingRoll(this._type === HeroRoller.ROLL_TYPE.KILLING);
        }
        return this;
    }

    modifyToNoBody(apply = true) {
        if (apply) {
            if (this._type === HeroRoller.ROLL_TYPE.NORMAL) {
                this._noBody = true;
            } else {
                console.error(`Doesn't make sense to make non normal attack STUN only`);
            }
        }
        return this;
    }

    addToHitLocation(
        useHitLocation = true,
        alreadyHitLocation = "none",
        useHitLocationSide = false,
        alreadyHitLocationSide = "none",
    ) {
        if (useHitLocation) {
            this._useHitLocation = useHitLocation;
            this._alreadyHitLocation = alreadyHitLocation;

            this._useHitLocationSide = useHitLocationSide;
            if (useHitLocationSide) {
                this._alreadyHitLocationSide = alreadyHitLocationSide;
            }
        }
        return this;
    }

    /**
     * V11 and V12 (or later) behave differently. V11 can have a operatorTerm to start
     * terms but it cannot have negative dice terms. V12, on the other hand, cannot handle
     * starting with an operatorTerm and cannot handle negative dice terms.
     *
     * @returns {Number} numDice
     */
    static WORK_AROUND_STRING = "v12+ work around";
    #prefixFormula(numDice) {
        if (isGameV12OrLater() && this._formulaTerms.length === 0) {
            if (numDice < 0) {
                this._formulaTerms.push(
                    new NumericTerm({
                        number: 0,
                        options: {
                            _hrQualifier: HeroRoller.QUALIFIER.NUMBER,
                            _hrTag: {
                                name: HeroRoller.WORK_AROUND_STRING,
                                value: 0,
                            },
                        },
                    }),
                );
                this._formulaTerms.push(new OperatorTerm({ operator: "-" }));
            }
        } else {
            this.#addOperatorTerm(numDice >= 0 ? "+" : "-");
        }

        return Math.abs(numDice);
    }

    #addOperatorTerm(operator) {
        this._formulaTerms.push(new OperatorTerm({ operator: operator }));
    }

    addDice(numDice, description) {
        if (!numDice) {
            return this;
        }

        numDice = this.#prefixFormula(numDice);

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: {
                    _hrQualifier: HeroRoller.QUALIFIER.FULL_DIE,
                    flavor: description,
                    _hrTag: !description
                        ? undefined
                        : {
                              name: description,
                              value: numDice,
                          },
                },
            }),
        );

        return this;
    }

    addHalfDice(numDice, description) {
        if (!numDice) {
            return this;
        }

        numDice = this.#prefixFormula(numDice);

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: {
                    _hrQualifier: HeroRoller.QUALIFIER.HALF_DIE,
                    flavor: description,
                    _hrTag: !description
                        ? undefined
                        : {
                              name: description,
                              value: numDice,
                          },
                },
            }),
        );

        return this;
    }

    addDiceMinus1(numDice, description) {
        if (!numDice) {
            return this;
        }

        numDice = this.#prefixFormula(numDice);

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: {
                    _hrQualifier: HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE,
                    flavor: description,
                    _hrTag: !description
                        ? undefined
                        : {
                              name: description,
                              value: numDice,
                          },
                },
            }),
        );

        return this;
    }

    addDieMinus1Min1(numDice, description) {
        if (!numDice) {
            return this;
        }

        numDice = this.#prefixFormula(numDice);

        this._formulaTerms.push(
            new Die({
                faces: 6,
                number: numDice,
                options: {
                    _hrQualifier: HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE_MIN_ONE,
                    flavor: description,
                    _hrTag: !description
                        ? undefined
                        : {
                              name: description,
                              value: numDice,
                          },
                },
            }),
        );

        return this;
    }

    addNumber(value, description) {
        if (!value) {
            return this;
        }

        if (this._formulaTerms.length > 0) {
            this.#addOperatorTerm(value > 0 ? "+" : "-");
        }

        value = this._formulaTerms.length > 0 ? Math.abs(value) : value;
        this._formulaTerms.push(
            new NumericTerm({
                number: value,
                options: {
                    _hrQualifier: HeroRoller.QUALIFIER.NUMBER,
                    flavor: description,
                    _hrTag: !description
                        ? undefined
                        : {
                              name: description,
                              value: value,
                          },
                },
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
        // Build the Foundry pseudo random roller. If no terms are provided, then provide one that equals 0 to
        // ensure that everything else works.
        this._rollObj = this._buildRollClass.fromTerms(
            this._formulaTerms.length > 0
                ? this._formulaTerms
                : [
                      new NumericTerm({
                          number: 0,
                          options: {
                              flavor: "No roller terms provided",
                          },
                      }),
                  ],
            this._options,
        );

        // V12 doesn't have async as an option anymore - it is the default.
        const evaluateOptions = isGameV12OrLater() ? {} : { async: true };
        await this._rollObj.evaluate({
            ...options,
            ...evaluateOptions,
        });

        await this.#calculateResults();

        return this;
    }

    async #calculateResults() {
        await this.#calculateStunMultiplierIfAppropriate();

        await this.#calculateHitLocationIfAppropriate();

        this.#calculate();

        this.#calculateAutoSuccessOrFailureIfAppropriate();
    }

    /**
     * Return raw roll objects. Should only be used for message system integration.
     */
    rawRolls() {
        return [
            HeroRoller.#addDiceSoNiceSkinning(this._rollObj),
            HeroRoller.#addDiceSoNiceSkinning(this._killingStunMultiplierHeroRoller?.rawRolls()),
            HeroRoller.#addDiceSoNiceSkinning(this._hitLocationRoller?.rawRolls()),
            HeroRoller.#addDiceSoNiceSkinning(this._hitSideRoller?.rawRolls()),
        ]
            .flat()
            .filter(Boolean);
    }

    // TODO: May wish to consider our own custom chat template for this.
    // TODO: May wish to consider no flavour, but rather have it be the type of roll?
    // TODO: borderColor: margin >= 0 ? 0x00ff00 : 0xff0000, based on success/failure?
    async render(flavor) {
        const template = this._buildRollClass.CHAT_TEMPLATE;
        const chatData = {
            formula: this.#buildFormula(),
            flavor: flavor,
            user: game.user.id,
            tooltip: this.#buildTooltip(),
            total: this.getTotalSummary(),
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

    getBasicTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.BASIC) {
            return this.getBaseTerms();
        }

        throw new Error(`asking for basic from type ${this._type} doesn't make sense`);
    }
    getBasicTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.BASIC) {
            return this.getBaseTotal();
        }

        throw new Error(`asking for basic from type ${this._type} doesn't make sense`);
    }

    getSuccessTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.SUCCESS) {
            return this.getBaseTerms();
        }

        throw new Error(`asking for success from type ${this._type} doesn't make sense`);
    }
    getSuccessTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.SUCCESS) {
            return this.getBaseTotal();
        }

        throw new Error(`asking for success from type ${this._type} doesn't make sense`);
    }
    getSuccess() {
        if (this._type === HeroRoller.ROLL_TYPE.SUCCESS && this._successValue !== undefined) {
            const autoSuccess = this.getAutoSuccess();

            if (autoSuccess !== undefined) {
                return autoSuccess;
            } else {
                return this.getSuccessTotal() <= this._successValue; // TODO: Is this right? Does it work for attack?
            }
        }

        throw new Error(`asking for success from type ${this._type}/${this._successValue} doesn't make sense`);
    }
    getAutoSuccess() {
        if (this._type === HeroRoller.ROLL_TYPE.SUCCESS) {
            if (this._successRolledValue === 3) {
                return true;
            } else if (this._successRolledValue === 18) {
                return false;
            }

            return undefined;
        }

        throw new Error(`asking for auto success from type ${this._type} doesn't make sense`);
    }

    getStunTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.NORMAL) {
            return this.getBaseTerms();
        } else if (this._type === HeroRoller.ROLL_TYPE.KILLING) {
            return this.getCalculatedTerms();
        }

        throw new Error(`asking for stun from type ${this._type} doesn't make sense`);
    }
    getStunTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.NORMAL) {
            return this.getBaseTotal();
        } else if (this._type === HeroRoller.ROLL_TYPE.KILLING) {
            return this.getCalculatedTotal();
        }

        throw new Error(`asking for stun from type ${this._type} doesn't make sense`);
    }
    getStunMultiplier() {
        if (this._type === HeroRoller.ROLL_TYPE.KILLING && !this._useHitLocation) {
            return this.getBaseMultiplier();
        }

        throw new Error(
            `asking for stun multiplier from type ${this._type}/${this._useHitLocation} doesn't make sense`,
        );
    }

    getBodyTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.NORMAL) {
            return this.getCalculatedTerms();
        } else if (this._type === HeroRoller.ROLL_TYPE.KILLING) {
            return this.getBaseTerms();
        }

        throw new Error(`asking for body from type ${this._type} doesn't make sense`);
    }
    getBodyTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.NORMAL) {
            return this.getCalculatedTotal();
        } else if (this._type === HeroRoller.ROLL_TYPE.KILLING) {
            return this.getBaseTotal();
        }

        throw new Error(`asking for body from type ${this._type} doesn't make sense`);
    }

    getAnnotatedTermsSummary() {
        return this.#getRawSummary().annotatedTerms;
    }

    getTermsSummary() {
        return this.#getRawSummary().terms;
    }

    getTotalSummary() {
        return this.#getRawSummary().total;
    }

    /**
     *
     * @param {number} ranksToRemove
     * @returns {HeroRoller}
     */
    removeNHighestRankTerms(ranksToRemove) {
        if (ranksToRemove && ranksToRemove > 0) {
            this.#removeNHighestRankTerms(ranksToRemove);
        }

        return this;
    }

    /**
     *
     * @param {number} ranksToRemove
     * @returns {HeroRoller}
     */
    removeFirstNTerms(ranksToRemove) {
        if (ranksToRemove && ranksToRemove > 0) {
            this.#removeFirstNTerms(ranksToRemove);
        }

        return this;
    }

    /**
     *
     * @param {number} dcToRemove
     * @returns {HeroRoller}
     */
    removeNDC(dcToRemove) {
        if (dcToRemove && dcToRemove > 0) {
            this.#removeNDcFromTerms(dcToRemove);
        }

        return this;
    }

    getEntangleTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.ENTANGLE) {
            return this.getCalculatedTerms();
        }

        throw new Error(`asking for entangle from type ${this._type} doesn't make sense`);
    }
    getEntangleTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.ENTANGLE) {
            return this.getCalculatedTotal();
        }

        throw new Error(`asking for entangle from type ${this._type} doesn't make sense`);
    }

    getAdjustmentTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.ADJUSTMENT) {
            return this.getBaseTerms();
        }

        throw new Error(`asking for adjustment from type ${this._type} doesn't make sense`);
    }
    getAdjustmentTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.ADJUSTMENT) {
            return this.getBaseTotal();
        }

        throw new Error(`asking for adjustment from type ${this._type} doesn't make sense`);
    }

    getFlashTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.FLASH) {
            return this.getCalculatedTerms();
        }

        throw new Error(`asking for flash from type ${this._type} doesn't make sense`);
    }
    getFlashTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.FLASH) {
            return this.getCalculatedTotal();
        }

        throw new Error(`asking for flash from type ${this._type} doesn't make sense`);
    }

    getEffectTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.EFFECT) {
            return this.getBaseTerms();
        }

        throw new Error(`asking for effect from type ${this._type} doesn't make sense`);
    }
    getEffectTotal() {
        if (this._type === HeroRoller.ROLL_TYPE.EFFECT) {
            return this.getBaseTotal();
        }

        throw new Error(`asking for effect from type ${this._type} doesn't make sense`);
    }

    getBaseTerms() {
        if (this._type === HeroRoller.ROLL_TYPE.FLASH || this._type === HeroRoller.ROLL_TYPE.ENTANGLE) {
            console.error(`attempting to get baseTerms for roll type ${this._type}`);
        }

        return HeroRoller.#extractPropertyFromTermsCluster(this._termsCluster, "base");
    }
    getBaseTotal() {
        return HeroRoller.#sum(this.getBaseTerms());
    }

    // TODO: Is there a better way of doing this?
    getFullBaseTerms() {
        return {
            base: HeroRoller.#extractPropertyFromTermsCluster(this._termsCluster, "base"),
            baseMetadata: HeroRoller.#extractPropertyFromTermsCluster(this._termsCluster, "baseMetadata"),
        };
    }

    getBaseMultiplier() {
        return Math.max(this._killingBaseStunMultiplier + this._killingAdditionalStunMultiplier, 1);
    }

    getCalculatedTerms() {
        if (
            this._type === HeroRoller.ROLL_TYPE.BASIC ||
            this._type === HeroRoller.ROLL_TYPE.SUCCESS ||
            this._type === HeroRoller.ROLL_TYPE.EFFECT
        ) {
            console.error(`attempting to get calculatedTerms for roll type ${this._type}`);
        }

        return HeroRoller.#extractPropertyFromTermsCluster(this._termsCluster, "calculated");
    }

    getCalculatedTotal() {
        return HeroRoller.#sum(this.getCalculatedTerms());
    }

    /**
     *
     * @returns {HitLocationInfo}
     */
    getHitLocation() {
        return this._hitLocation;
    }

    /**
     * Make a copy of this existing roller that can be modified without affecting the original.
     *
     * @returns HeroRoller
     */
    clone() {
        return HeroRoller.fromJSON(this.toJSON());
    }

    /**
     * Make a copy of this existing roller that can be modified without affecting the original however
     * change the type of roll to the newType (e.g. normal, killing, etc)
     *
     * @param {HeroRoller.ROLL_TYPE} newType
     *
     * @returns {HeroRoller}
     */
    async cloneWhileModifyingType(newType) {
        const data = this.toData();
        data._type = newType;

        const newRoller = HeroRoller.fromJSON(JSON.stringify(data));
        if (newRoller._rollObj) {
            await newRoller.#calculateResults();
        }

        return newRoller;
    }

    toData() {
        return {
            // _buildRollClass: this._buildRollClass.name, // TODO: This is just wrong.
            _options: this._options,
            _rollObj: this._rollObj ? this._rollObj.toJSON() : undefined,
            _formulaTerms: this._formulaTerms.map((term) => term.toJSON()),
            _type: this._type,

            _termsCluster: this._termsCluster,

            _killingStunMultiplierHeroRoller: this._killingStunMultiplierHeroRoller?.toData(),
            _killingBaseStunMultiplier: this._killingBaseStunMultiplier,
            _killingAdditionalStunMultiplier: this._killingAdditionalStunMultiplier,

            _standardEffect: this._standardEffect,

            _hitLocation: this._hitLocation,
            _useHitLocation: this._useHitLocation,
            _alreadyHitLocation: this._alreadyHitLocation,
            _useHitLocationSide: this._useHitLocationSide,
            _alreadyHitLocationSide: this._alreadyHitLocationSide,
            _hitLocationRoller: this._hitLocationRoller?.toData(),
            _hitSideRoller: this._hitSideRoller?.toData(),

            _noBody: this._noBody,
        };
    }

    toJSON() {
        return JSON.stringify(this.toData());
    }

    static fromJSON(json) {
        return HeroRoller.fromData(JSON.parse(json));
    }

    static fromData(dataObj) {
        // TODO: Finish this.
        // TODO: I suspect that will only be able to support Roll class.
        const heroRoller = new HeroRoller(dataObj.options, Roll);

        heroRoller._rollObj = dataObj._rollObj ? Roll.fromData(dataObj._rollObj) : undefined;
        heroRoller._formulaTerms = dataObj._formulaTerms.map((_term, index) =>
            RollTermClass.fromData(dataObj._formulaTerms[index]),
        );

        heroRoller._type = dataObj._type;

        heroRoller._termsCluster = dataObj._termsCluster;

        heroRoller._killingStunMultiplierHeroRoller = dataObj._killingStunMultiplierHeroRoller
            ? HeroRoller.fromData(dataObj._killingStunMultiplierHeroRoller)
            : undefined;
        heroRoller._killingBaseStunMultiplier = dataObj._killingBaseStunMultiplier;
        heroRoller._killingAdditionalStunMultiplier = dataObj._killingAdditionalStunMultiplier;

        heroRoller._standardEffect = dataObj._standardEffect;

        heroRoller._hitLocation = dataObj._hitLocation;
        heroRoller._useHitLocation = dataObj._useHitLocation;
        heroRoller._alreadyHitLocation = dataObj._alreadyHitLocation;
        heroRoller._useHitLocationSide = dataObj._useHitLocationSide;
        heroRoller._alreadyHitLocationSide = dataObj._alreadyHitLocationSide;
        heroRoller._hitLocationRoller = dataObj._hitLocationRoller
            ? HeroRoller.fromData(dataObj._hitLocationRoller)
            : undefined;
        heroRoller._hitSideRoller = dataObj._hitSideRoller ? HeroRoller.fromData(dataObj._hitSideRoller) : undefined;

        heroRoller._noBody = dataObj._noBody;

        return heroRoller;
    }

    // Was the roll an auto success or not?
    #calculateAutoSuccessOrFailureIfAppropriate() {
        if (this._type === HeroRoller.ROLL_TYPE.SUCCESS) {
            // Pull out the result of the 3d6 roll somewhere in the terms and use that total
            this._successRolledValue = HeroRoller.#extractPropertyFromTermsCluster(
                this._termsCluster,
                "baseMetadata",
            ).reduce((total, termMetadata) => {
                if (termMetadata.qualifier === HeroRoller.QUALIFIER.FULL_DIE && termMetadata.termCardinality === 3) {
                    return total + termMetadata.originalValue;
                }
                return total;
            }, 0);
        }
    }

    async #calculateStunMultiplierIfAppropriate() {
        if (this._type === HeroRoller.ROLL_TYPE.KILLING && !this._useHitLocation) {
            // NOTE: It appears there is no standard effect for the STUNx per APG p 53
            //       although there don't appear to be any mention of this in other books.
            this._killingStunMultiplierHeroRoller = new HeroRoller(
                game.settings.get(game.system.id, "alphaTesting")
                    ? {
                          appearance: foundry.utils.deepClone(DICE_SO_NICE_CUSTOM_SETS.STUNx),
                      }
                    : {},
                this._buildRollClass,
            )
                .makeBasicRoll()
                .addDieMinus1Min1(this._killingStunMultiplier === "1d6-1" ? 1 : 0)
                .addHalfDice(this._killingStunMultiplier === "1d3" ? 1 : 0);

            // V12 doesn't have async as an option anymore - it is the default.
            const evaluateOptions = isGameV12OrLater() ? {} : { async: true };
            await this._killingStunMultiplierHeroRoller.roll(evaluateOptions);

            this._killingBaseStunMultiplier = this._killingStunMultiplierHeroRoller.getBasicTotal();
        }
    }

    /**
     * @returns {HitLocationInfo}
     */
    async #calculateHitLocationIfAppropriate() {
        if (
            this._useHitLocation &&
            (this._type === HeroRoller.ROLL_TYPE.NORMAL || this._type === HeroRoller.ROLL_TYPE.KILLING)
        ) {
            let locationName;

            if (this._alreadyHitLocation === "none") {
                this._hitLocationRoller = new HeroRoller(
                    game.settings.get(game.system.id, "alphaTesting")
                        ? {
                              appearance: foundry.utils.deepClone(DICE_SO_NICE_CUSTOM_SETS.HIT_LOC),
                          }
                        : {},
                    this._buildRollClass,
                )
                    .makeBasicRoll()
                    .addDice(3);
                await this._hitLocationRoller.roll();
                const locationRollTotal = this._hitLocationRoller.getBasicTotal();

                locationName = CONFIG.HERO.hitLocationsToHit[locationRollTotal];
            } else {
                locationName = this._alreadyHitLocation;
            }

            let locationSide;
            if (
                this._useHitLocationSide &&
                CONFIG.HERO.sidedLocations.has(locationName) &&
                this._alreadyHitLocationSide === "none"
            ) {
                this._hitSideRoller = new HeroRoller(
                    game.settings.get(game.system.id, "alphaTesting")
                        ? {
                              appearance: foundry.utils.deepClone(DICE_SO_NICE_CUSTOM_SETS.HIT_LOC_SIDE),
                          }
                        : {},
                    this._buildRollClass,
                )
                    .makeBasicRoll()
                    .addDice(1);
                await this._hitSideRoller.roll();

                const locationSideRollTotal = this._hitSideRoller.getBasicTotal();

                locationSide = locationSideRollTotal >= 4 ? "Right" : "Left";
            } else {
                locationSide = this._alreadyHitLocationSide;
            }

            this._hitLocation = {
                name: locationName,
                side: locationSide,
                fullName:
                    CONFIG.HERO.sidedLocations.has(locationName) && this._useHitLocationSide
                        ? `${locationSide} ${locationName}`
                        : locationName,
                stunMultiplier: Math.max(
                    1,
                    (this._type === HeroRoller.ROLL_TYPE.KILLING
                        ? CONFIG.HERO.hitLocations[locationName][0]
                        : CONFIG.HERO.hitLocations[locationName][1]) + this._killingAdditionalStunMultiplier,
                ),
                bodyMultiplier: CONFIG.HERO.hitLocations[locationName][2],
            };
        }
    }

    #calculateValue(originalResult, adjustedResult, termQualifier) {
        const adjustedResultSign = adjustedResult < 0 ? -1 : 1;

        switch (this._type) {
            case HeroRoller.ROLL_TYPE.BASIC:
            case HeroRoller.ROLL_TYPE.SUCCESS:
            case HeroRoller.ROLL_TYPE.ADJUSTMENT:
            case HeroRoller.ROLL_TYPE.EFFECT:
                // Do nothing as there are no calculated values
                break;

            case HeroRoller.ROLL_TYPE.ENTANGLE:
            case HeroRoller.ROLL_TYPE.FLASH:
            case HeroRoller.ROLL_TYPE.NORMAL:
                if (this._noBody) {
                    return 0;
                }

                // constants for entangle are straight body
                if (this._type === HeroRoller.ROLL_TYPE.ENTANGLE && termQualifier === HeroRoller.QUALIFIER.NUMBER) {
                    return originalResult;
                }

                // Calculate BODY
                if (termQualifier === HeroRoller.QUALIFIER.HALF_DIE) {
                    if (this._standardEffect) {
                        return 0;
                    } else {
                        if (originalResult >= 4) {
                            // 5e pg. 176 rule that doesn't exist in 6e
                            if (this._type === HeroRoller.ROLL_TYPE.FLASH && this._is5eRoll) {
                                if (originalResult === 6) {
                                    return 1;
                                } else {
                                    return 0;
                                }
                            } else {
                                return 1;
                            }
                        } else {
                            return 0;
                        }
                    }
                } else {
                    if (Math.abs(adjustedResult) <= 1) {
                        return 0;
                    } else if (Math.abs(adjustedResult) === 6) {
                        return 2 * adjustedResultSign;
                    }

                    return 1 * adjustedResultSign;
                }

            case HeroRoller.ROLL_TYPE.KILLING:
                if (this._useHitLocation) {
                    // Use the hit location STUNx
                    return adjustedResult * this._hitLocation.stunMultiplier;
                }

                return adjustedResult * this.getBaseMultiplier();

            default:
                console.error(`Unhandled calculation for type ${this._type}`);
        }
    }

    #buildMetadataForDiceTerm(hrExtra, result, lastOperatorMultiplier) {
        let adjustedValue;

        if (hrExtra.qualifier === HeroRoller.QUALIFIER.HALF_DIE) {
            if (this._standardEffect) {
                adjustedValue = lastOperatorMultiplier * HeroRoller.STANDARD_EFFECT_HALF_DIE_ROLL;
            } else {
                adjustedValue = lastOperatorMultiplier * Math.ceil(result / 2);
            }

            hrExtra.min = 1;
            hrExtra.max = 3;
        } else if (hrExtra.qualifier === HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE) {
            if (this._standardEffect) {
                adjustedValue = lastOperatorMultiplier * HeroRoller.STANDARD_EFFECT_DIE_ROLL;
            } else {
                adjustedValue = lastOperatorMultiplier * (result - 1);
            }

            hrExtra.min = 0;
            hrExtra.max = 5;
        } else if (hrExtra.qualifier === HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE_MIN_ONE) {
            if (this._standardEffect) {
                adjustedValue = lastOperatorMultiplier * HeroRoller.STANDARD_EFFECT_DIE_ROLL;
            } else {
                adjustedValue = lastOperatorMultiplier * Math.max(1, result - 1);
            }

            hrExtra.min = 1;
            hrExtra.max = 5;
        } else {
            if (this._standardEffect) {
                adjustedValue = lastOperatorMultiplier * HeroRoller.STANDARD_EFFECT_DIE_ROLL;
            } else {
                adjustedValue = lastOperatorMultiplier * result;
            }

            hrExtra.min = 1;
            hrExtra.max = 6;
        }

        hrExtra.originalValue = result;
        hrExtra.classDecorators = HeroRoller.#buildMinMaxClassForValue(hrExtra, adjustedValue);

        return adjustedValue;
    }

    #calculate() {
        const _calculatedTermsMetadata = [];
        const _calculatedTerms = [];

        let lastOperatorMultiplier = 1; // Start with +

        const _baseTermsMetadata = [];
        const _baseTerms = this._rollObj.terms
            .map((term, index) => {
                if (term instanceof NumericTerm) {
                    // Filter out the work around start 0 NumericTerm we need to add at the beginning of all terms to handle a
                    // negative dice term. It is only needed to make the roll's evaluation work correctly.
                    if (term.options._hrTag?.name === HeroRoller.WORK_AROUND_STRING) {
                        return undefined;
                    }

                    const number = lastOperatorMultiplier * term.number;
                    const hrExtra = {
                        term: "Numeric",
                        originalTermIndex: index,
                        termIndex: index,
                        qualifier: term.options._hrQualifier,
                        flavor: term.options.flavor,
                        originalTermCardinality: 1,
                        termCardinality: 1,
                        signMultiplier: lastOperatorMultiplier,
                        classDecorators: "",
                        originalValue: term.number,
                    };

                    // Create the metadata for this term
                    _baseTermsMetadata.push([hrExtra]);
                    _calculatedTermsMetadata.push([hrExtra]);

                    const newCalculatedTerm = [this.#calculateValue(number, number, term.options._hrQualifier)];
                    _calculatedTerms.push(newCalculatedTerm);

                    const newBaseTerm = [number];
                    return newBaseTerm;
                } else if (term instanceof OperatorTerm) {
                    // NOTE: No need to handle multiplication, division, and parentheses as
                    //       this class doesn't support it.
                    lastOperatorMultiplier = term.operator === "-" ? -1 : 1;
                } else if (term instanceof Die) {
                    const thisTermBaseTermsMetadata = [];

                    const calculatedTerms = [];
                    const thisTermCalculatedTermsMetadata = [];
                    const hrExtra = {
                        term: "Dice",
                        originalTermIndex: index,
                        termIndex: index,
                        qualifier: term.options._hrQualifier,
                        flavor: term.options.flavor,
                        originalTermCardinality: term.results.length,
                        termCardinality: term.results.length,
                        signMultiplier: lastOperatorMultiplier,
                        min: -99,
                        max: -99,
                    };

                    const termResults = term.results.map((result, index) => {
                        const adjustedValue = this.#buildMetadataForDiceTerm(
                            hrExtra,
                            result.result,
                            lastOperatorMultiplier,
                        );
                        hrExtra.originalResultIndex = index;

                        thisTermBaseTermsMetadata.push(foundry.utils.deepClone(hrExtra));

                        calculatedTerms.push(
                            this.#calculateValue(result.result, adjustedValue, term.options._hrQualifier),
                        );

                        thisTermCalculatedTermsMetadata.push(foundry.utils.deepClone(hrExtra));

                        return adjustedValue;
                    });

                    _baseTermsMetadata.push(thisTermBaseTermsMetadata);
                    _calculatedTermsMetadata.push(thisTermCalculatedTermsMetadata);
                    _calculatedTerms.push(calculatedTerms);

                    return termResults;
                } else {
                    // Other term types will return undefined and be filtered out
                    // although we shouldn't ever get them.
                }
            })
            .filter(Boolean);

        const flatBaseTerms = _baseTerms.flat();
        const flatBaseTermsMetadata = _baseTermsMetadata.flat();
        const flatCalculatedTerms = _calculatedTerms.flat();
        const flatCalculatedTermsMetadata = _calculatedTermsMetadata.flat();

        // combine
        this._termsCluster = flatBaseTerms.map((_term, index) => {
            return {
                base: flatBaseTerms[index],
                baseMetadata: flatBaseTermsMetadata[index],
                calculated: flatCalculatedTerms[index],
                calculatedMetadata: flatCalculatedTermsMetadata[index],
            };
        });
    }

    #buildFormula() {
        const baseMetadata = foundry.utils.deepClone(
            HeroRoller.#extractPropertyFromTermsCluster(this._termsCluster, "baseMetadata"),
        );

        // Sort the metadata by original term - lowest index to highest
        baseMetadata.sort(function (a, b) {
            return a.termIndex - b.termIndex;
        });

        // Just look at the first term of an index we come across so that we don't have duplicate
        const seenAlready = new Set();
        const formula = baseMetadata
            .filter((metadataTerm) => {
                const found = seenAlready.has(metadataTerm.termIndex);
                if (!found) {
                    seenAlready.add(metadataTerm.termIndex);
                }
                return !found;
            })
            .reduce((formulaSoFar, metadataTerm, index) => {
                return formulaSoFar + this.#buildFormulaForTerm(metadataTerm, !!index);
            }, "");

        return formula.trim();
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

        // Show the stun multiplier only if this is a killing attack and there is no
        // hit location.
        if (this._type === HeroRoller.ROLL_TYPE.KILLING && !this._useHitLocation) {
            const stunMultiplier = this._killingStunMultiplierHeroRoller.getBasicTotal();
            const stunMultiplierFormula = this._killingStunMultiplierHeroRoller.getFormula();
            const fullBaseTerms = this._killingStunMultiplierHeroRoller.getFullBaseTerms();

            preliminaryTooltip = `
                <div class="dice">
                    <header class="part-header flexrow">
                        <span class="part-formula">${stunMultiplierFormula} STUN Multiplier</span>
                        <span class="part-total">${stunMultiplier}</span>
                    </header>
                    <ol class="dice-rolls">
                        ${this.#buildDiceRollsTooltip(fullBaseTerms.base, fullBaseTerms.baseMetadata, true)}
                    </ol>
                </div>
            `;
        }

        // Turn the flat termsCluster array back into an unflattened original style of terms.
        const groupedCluster = [];
        this._termsCluster.forEach((termCluster) => {
            const originalTerm = termCluster.baseMetadata.termIndex;
            if (!groupedCluster[originalTerm]) {
                groupedCluster[originalTerm] = [];
            }
            groupedCluster[originalTerm].push(termCluster);
        });

        let tooltipWithDice = groupedCluster.filter(Boolean).reduce((soFar, termCluster) => {
            const baseCluster = HeroRoller.#extractPropertyFromTermsCluster(termCluster, "base");
            const baseTotal = HeroRoller.#sum(baseCluster);

            const baseMetadataCluster = HeroRoller.#extractPropertyFromTermsCluster(termCluster, "baseMetadata");
            const baseFormula = this.#buildFormulaForTerm(baseMetadataCluster[0], false);
            const baseFormulaPurpose = this.#buildFormulaBasePurpose();

            const baseTermTooltip =
                this._type === HeroRoller.ROLL_TYPE.ENTANGLE || this._type === HeroRoller.ROLL_TYPE.FLASH
                    ? ""
                    : `
                    <div class="dice">
                        <header class="part-header flexrow">
                            <span class="part-formula">${baseFormula}${
                                baseFormulaPurpose ? ` ${baseFormulaPurpose}` : ""
                            }${baseMetadataCluster[0].flavor ? ` ${baseMetadataCluster[0].flavor}` : ""}${
                                this._standardEffect ? " (Standard Effect)" : ""
                            }</span>
                            <span class="part-total">${baseTotal}</span>
                        </header>
                        <ol class="dice-rolls">
                            ${this.#buildDiceRollsTooltip(baseCluster, baseMetadataCluster, true)}
                        </ol>
                    </div>
                `;

            const calculatedCluster = HeroRoller.#extractPropertyFromTermsCluster(termCluster, "calculated");
            const calculatedTotal = HeroRoller.#sum(calculatedCluster);
            const calculatedFormulaPurpose = this.#buildFormulaCalculatedPurpose();
            const calculatedMetadataCluster = HeroRoller.#extractPropertyFromTermsCluster(
                termCluster,
                "calculatedMetadata",
            );

            const calculatedTermTooltip =
                !calculatedFormulaPurpose || (this._type === HeroRoller.ROLL_TYPE.NORMAL && this._noBody)
                    ? ""
                    : `
                        <div class="dice">
                            <header class="part-header flexrow">
                                <span class="part-formula">${calculatedFormulaPurpose} calculated from ${baseFormula} ${baseFormulaPurpose}</span>
                                <span class="part-total">${calculatedTotal}</span>
                            </header>
                            <ol class="dice-rolls">
                                ${this.#buildDiceRollsTooltip(calculatedCluster, calculatedMetadataCluster, false)}    
                            </ol>
                        </div>
                    `;

            return `${soFar}${baseTermTooltip}${calculatedTermTooltip}`;
        }, preliminaryTooltip);

        // Show hit location dice?
        if (this._useHitLocation && this._alreadyHitLocation === "none") {
            tooltipWithDice =
                tooltipWithDice +
                `
                    <div class="dice">
                        <header class="part-header flexrow">
                            <span class="part-formula">Random Hit Location</span>
                            <span class="part-total">${
                                this._hitLocation.name
                            } (${this._hitLocationRoller.getBaseTotal()})</span>
                        </header>
                        <ol class="dice-rolls">
                        ${this._hitLocationRoller.getBaseTerms().reduce((soFar, term) => {
                            return `${soFar}<li class="roll d6">${term}</li>`;
                        }, "")}
                        </ol>
                    </div>`;
        }

        // Show hit location side dice?
        if (
            this._useHitLocationSide &&
            CONFIG.HERO.sidedLocations.has(this._hitLocation.name) &&
            this._alreadyHitLocationSide === "none"
        ) {
            tooltipWithDice =
                tooltipWithDice +
                `
                <div class="dice">
                    <header class="part-header flexrow">
                        <span class="part-formula">Random Hit Location Side</span>
                        <span class="part-total">${
                            this._hitLocation.side
                        } (${this._hitSideRoller.getBaseTotal()})</span>
                    </header>
                    <ol class="dice-rolls">
                        ${this._hitSideRoller.getBaseTerms().reduce((soFar, term) => {
                            return `${soFar}<li class="roll d6">${term}</li>`;
                        }, "")}
                    </ol>
                </div>`;
        }

        return tooltipWithDice;
    }

    #buildFormulaForTerm(termMetadata, showOperator) {
        // We want to show a term without sign unless we aren't showing the operator.
        const scalar = termMetadata.term === "Numeric" ? termMetadata.originalValue : termMetadata.termCardinality;
        const sign = showOperator
            ? termMetadata.signMultiplier * scalar < 0
                ? " - "
                : " + "
            : termMetadata.signMultiplier * scalar < 0
              ? " -"
              : " ";

        if (termMetadata.term === "Dice") {
            if (termMetadata.qualifier === HeroRoller.QUALIFIER.HALF_DIE) {
                return `${sign}${
                    termMetadata.termCardinality !== 1 ? `${Math.abs(termMetadata.termCardinality)}(½d6)` : "½d6"
                }`;
            } else if (termMetadata.qualifier === HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE) {
                return `${
                    termMetadata.signMultiplier < 0 || termMetadata.termCardinality !== 1
                        ? `${sign}${Math.abs(termMetadata.termCardinality)}(d6-1)`
                        : `${sign}${Math.abs(termMetadata.termCardinality)}d6-1`
                }`;
            } else if (termMetadata.qualifier === HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE_MIN_ONE) {
                return `${
                    termMetadata.signMultiplier < 0 || termMetadata.termCardinality !== 1
                        ? `${sign}${Math.abs(termMetadata.termCardinality)}(d6-1[min 1])`
                        : `${sign}${Math.abs(termMetadata.termCardinality)}d6-1[min 1]`
                }`;
            } else {
                return `${sign}${termMetadata.termCardinality}d6`;
            }
        } else if (termMetadata.term === "Numeric") {
            // NOTE: Should only be 1 value per Numeric term
            return `${sign}${Math.abs(termMetadata.originalValue)}`;
        }
    }

    #buildFormulaBasePurpose() {
        switch (this._type) {
            case HeroRoller.ROLL_TYPE.BASIC:
            case HeroRoller.ROLL_TYPE.ENTANGLE:
            case HeroRoller.ROLL_TYPE.FLASH:
            case HeroRoller.ROLL_TYPE.SUCCESS:
                return "";

            case HeroRoller.ROLL_TYPE.NORMAL:
                return "STUN";

            case HeroRoller.ROLL_TYPE.KILLING:
                return "BODY";

            case HeroRoller.ROLL_TYPE.ADJUSTMENT:
                return "Active Points";

            case HeroRoller.ROLL_TYPE.EFFECT:
                return "Effect";

            default:
                console.error(`unknown base purpose type ${this._type}`);
                return "";
        }
    }

    #buildFormulaCalculatedPurpose() {
        switch (this._type) {
            case HeroRoller.ROLL_TYPE.BASIC:
            case HeroRoller.ROLL_TYPE.SUCCESS:
            case HeroRoller.ROLL_TYPE.ADJUSTMENT:
            case HeroRoller.ROLL_TYPE.EFFECT:
                // No calculated terms
                return "";

            case HeroRoller.ROLL_TYPE.KILLING:
                return "STUN";

            case HeroRoller.ROLL_TYPE.ENTANGLE:
            case HeroRoller.ROLL_TYPE.NORMAL:
                return "BODY";

            case HeroRoller.ROLL_TYPE.FLASH:
                return "Segments";

            default:
                console.error(`unknown base purpose type ${this._type}`);
                return "";
        }
    }

    #buildDiceRollsTooltip(diceTerm, diceTermMetadata, showMinMax) {
        return diceTerm.reduce((soFar, result, index) => {
            const absUnadjustedNumber = Math.abs(diceTermMetadata[index].originalValue);

            // Show the unadjusted value if this is a partial dice (1d6-1 or 1/2d6)
            // and showMinMax was requested. Alternatively, if this is an ENTANGLE or FLASH
            // we don't show the original roll so always show this.
            const unadjustedTooltip =
                this._type === HeroRoller.ROLL_TYPE.ENTANGLE ||
                this._type === HeroRoller.ROLL_TYPE.FLASH ||
                (diceTermMetadata[index].qualifier !== HeroRoller.QUALIFIER.FULL_DIE &&
                    diceTermMetadata[index].qualifier !== HeroRoller.QUALIFIER.NUMBER &&
                    showMinMax)
                    ? `title="${absUnadjustedNumber}"`
                    : "";

            const absNumber = Math.abs(result);

            return `${soFar}<li class="${
                showMinMax ? `roll die d6 ${diceTermMetadata[index].classDecorators}` : "roll calculated"
            }" ${unadjustedTooltip}>${absNumber}</li>`;
        }, "");
    }

    static #buildMinMaxClassForValue(metadata, value) {
        if (metadata.term === "Dice") {
            const absValue = Math.abs(value);

            return absValue === metadata.min ? "min" : absValue === metadata.max ? "max" : "";
        }

        return "";
    }

    #removeNHighestRankTerms(ranksToRemove) {
        // sort - highest first & lowest last.
        this._termsCluster.sort(function (a, b) {
            return b.base - a.base;
        });

        this.#removeFirstNTerms(ranksToRemove);
    }

    #removeFirstNTerms(ranksToRemove) {
        // Remove the first N ranks
        const removed = this._termsCluster.splice(0, ranksToRemove);

        this.#fixUpTermMetadata(removed);
    }

    // TODO: Added has to be a proper type.
    #fixUpTermMetadata(removed) {
        // Fixup the base and calculated metadata so that it reflects what remains. The base and calculated
        // values are correct as is.
        // NOTE: This will only work for dice term.
        // 1) If all the terms of a part of the equation were removed, there is nothing to fix up
        //    as that has already been removed from the metadata.
        // 2) For parts of the formula that have had terms removed, we need to fixup the expected
        //    number of dice and their indices.

        // For removal: determine indices that have been modified ...
        const fixUp = new Map();
        removed.forEach((termCluster) => {
            const indexCount = fixUp.get(termCluster.baseMetadata.termIndex) || 0;
            fixUp.set(termCluster.baseMetadata.termIndex, indexCount + 1);
        });

        // ... and modify the metadata counts for them
        this._termsCluster.forEach((termCluster) => {
            const indexCount = fixUp.get(termCluster.baseMetadata.termIndex);
            if (indexCount != null) {
                termCluster.baseMetadata.termCardinality -= indexCount;
                termCluster.calculatedMetadata.termCardinality -= indexCount;
            }
        });
    }

    #removeNDcFromTerms(dcToRemove) {
        const baseMetadata = HeroRoller.#extractPropertyFromTermsCluster(this._termsCluster, "baseMetadata");

        // What unique terms do we have?
        const seenAlready = new Set();
        const oneTermOfEachType = baseMetadata
            .map((metadataTerm, index) => {
                const found = seenAlready.has(metadataTerm.termIndex);
                if (!found) {
                    seenAlready.add(metadataTerm.termIndex);
                    return {
                        index: metadataTerm.termIndex,
                        count: metadataTerm.termCardinality,
                        originalCount: metadataTerm.termCardinality,
                        qualifier: metadataTerm.qualifier,
                        flavor: metadataTerm.flavor,
                        changeTo: undefined,
                        metadataTerm: baseMetadata[index],
                    };
                }
                return undefined;
            })
            .filter(Boolean);

        // 1st pass, order from largest DC to smallest DC, and then start subtracting full terms
        oneTermOfEachType.sort((a, b) => {
            return HeroRoller.#qualifierToKillingDC[b.qualifier] - HeroRoller.#qualifierToKillingDC[a.qualifier];
        });

        let remainingPartialTermsToRemove;
        if (this._type === HeroRoller.ROLL_TYPE.KILLING) {
            remainingPartialTermsToRemove = dcToRemove;
        } else {
            remainingPartialTermsToRemove = 3 * dcToRemove;
        }

        // 1st pass: Remove full terms
        oneTermOfEachType.forEach((term, index) => {
            if (
                term.count > 0 &&
                remainingPartialTermsToRemove > 0 &&
                term.qualifier === HeroRoller.QUALIFIER.FULL_DIE
            ) {
                const toRemove = Math.floor(Math.min(term.count * 3, remainingPartialTermsToRemove) / 3);
                term.count = term.count - toRemove;
                remainingPartialTermsToRemove = remainingPartialTermsToRemove - toRemove * 3;

                oneTermOfEachType[index] = term;
            }
        });

        // 2nd pass: Order from smallest DC to largest DC, and then start subtracting until either
        // all terms are removed or all the removal count has hit 0.
        oneTermOfEachType.sort((a, b) => {
            return HeroRoller.#qualifierToKillingDC[a.qualifier] - HeroRoller.#qualifierToKillingDC[b.qualifier];
        });

        const modifiedOneTermOfEachType = oneTermOfEachType
            .map((term) => {
                if (
                    term.count > 0 &&
                    remainingPartialTermsToRemove > 0 &&
                    term.qualifier === HeroRoller.QUALIFIER.NUMBER
                ) {
                    term.count = term.count - 1;
                    remainingPartialTermsToRemove = remainingPartialTermsToRemove - 1;
                    return term;
                } else if (
                    term.count > 0 &&
                    remainingPartialTermsToRemove > 0 &&
                    (term.qualifier === HeroRoller.QUALIFIER.HALF_DIE ||
                        term.qualifier === HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE ||
                        term.qualifier === HeroRoller.QUALIFIER.FULL_DIE_LESS_ONE_MIN_ONE)
                ) {
                    const toRemove = Math.floor(Math.min(term.count * 2, remainingPartialTermsToRemove) / 2);
                    term.count = term.count - toRemove;
                    remainingPartialTermsToRemove = remainingPartialTermsToRemove - toRemove * 2;

                    // turn from half die into 1 pip
                    if (term.count > 0 && remainingPartialTermsToRemove === 1) {
                        term.count = term.count - 1;

                        const newTerm = {
                            index: term.index + 10000, // TODO: Probably need a better approach to identify an empty spot, but this is probably ok.
                            count: 1,
                            originalCount: 0,
                            qualifier: HeroRoller.QUALIFIER.NUMBER,
                            changeTo: term.metadataTerm.originalValue,
                            metadataTerm: foundry.utils.deepClone(term.metadataTerm),
                        };

                        return [term, newTerm];
                    }
                    return term;
                } else if (
                    term.count > 0 &&
                    remainingPartialTermsToRemove > 0 &&
                    term.qualifier === HeroRoller.QUALIFIER.FULL_DIE
                ) {
                    const toRemove = Math.floor(Math.min(term.count * 3, remainingPartialTermsToRemove) / 3);
                    term.count = term.count - toRemove;
                    remainingPartialTermsToRemove = remainingPartialTermsToRemove - toRemove * 3;

                    if (term.count > 0 && remainingPartialTermsToRemove === 2) {
                        // turn from full die to 1 pip
                        term.count = term.count - 1;

                        const newTerm = {
                            index: term.index + 10000, // TODO: Probably need a better approach to identify an empty spot, but this is probably ok.
                            count: 1,
                            originalCount: 0,
                            qualifier: HeroRoller.QUALIFIER.NUMBER,
                            changeTo: 1, // Becomes a +1 term
                            metadataTerm: foundry.utils.deepClone(term.metadataTerm),
                        };

                        return [term, newTerm];
                    } else if (term.count > 0 && remainingPartialTermsToRemove === 1) {
                        // turn from full die to 1/2 die
                        term.count = term.count - 1;

                        const newTerm = {
                            index: term.index + 10000, // TODO: Probably need a better approach to identify an empty spot, but this is probably ok.
                            count: 1,
                            originalCount: 0,
                            qualifier: HeroRoller.QUALIFIER.HALF_DIE, // TODO: Could also be 1d6-1 in some situations.
                            changeTo: term.metadataTerm.originalValue,
                            metadataTerm: foundry.utils.deepClone(term.metadataTerm),
                        };

                        return [term, newTerm];
                    }
                    return term;
                }

                return term;
            })
            .flat();

        // What should we trim?
        const added = [];
        const entriesToTrim = new Map();
        modifiedOneTermOfEachType.forEach((term) => {
            if (term.count < term.originalCount) {
                entriesToTrim.set(term.index, term);
            } else if (term.originalCount < term.count) {
                added.push(this.#buildTermClusterFromFakeTerm(term, term.changeTo));
            }
        });

        const remaining = [];
        const removed = [];
        this._termsCluster.forEach((termCluster) => {
            const termToTrim = entriesToTrim.get(termCluster.baseMetadata.termIndex);

            // Remove the appropriate number of terms matching this index.
            if (termToTrim && termToTrim.originalCount > termToTrim.count) {
                termToTrim.originalCount = termToTrim.originalCount - 1;
                removed.push(termCluster);
            } else {
                remaining.push(termCluster);
            }
        });

        this._termsCluster = remaining;

        this.#fixUpTermMetadata(removed);

        this._termsCluster.splice(this._termsCluster.length, 0, ...added);
    }

    #buildTermClusterFromFakeTerm(fakeTerm, result) {
        const baseMetadata = {
            term: fakeTerm.qualifier === HeroRoller.QUALIFIER.NUMBER ? "Numeric" : "Dice",
            originalTermIndex: fakeTerm.index,
            termIndex: fakeTerm.index,
            originalResultIndex: 0,
            qualifier: fakeTerm.qualifier,
            flavor: fakeTerm.flavor,
            originalTermCardinality: fakeTerm.count,
            termCardinality: fakeTerm.count,
            signMultiplier: 1,
            min: -99,
            max: -99,
            originalValue: fakeTerm.qualifier === HeroRoller.QUALIFIER.NUMBER ? result : undefined,
        };

        const baseResult =
            fakeTerm.qualifier === HeroRoller.QUALIFIER.NUMBER
                ? result
                : this.#buildMetadataForDiceTerm(baseMetadata, result, baseMetadata.signMultiplier);

        const calculatedMetadata = foundry.utils.deepClone(baseMetadata);

        const calculated = this.#calculateValue(result, baseResult, calculatedMetadata.qualifier);

        return {
            base: baseResult,
            baseMetadata: baseMetadata,
            calculated: calculated,
            calculatedMetadata: calculatedMetadata,
        };
    }

    /**
     *
     * @returns {Object[]} summary
     * @param {string} total
     * @param {string} terms
     * @param {string} annotatedTerms
     */
    #getRawSummary() {
        switch (this._type) {
            case HeroRoller.ROLL_TYPE.BASIC:
                return {
                    annotatedTerms: `Basic breakdown: ${this.getBasicTerms()}]`,
                    terms: `${this.getBasicTerms()}`,
                    total: `${this.getBasicTotal()}`,
                };

            case HeroRoller.ROLL_TYPE.SUCCESS:
                return {
                    annotatedTerms: `Success breakdown: ${this.getSuccessTerms()}]`,
                    terms: `${this.getSuccessTerms()}`,
                    total: `${this.getSuccessTotal()}`,
                };

            case HeroRoller.ROLL_TYPE.NORMAL:
                return {
                    annotatedTerms: `${
                        this._noBody ? "" : `BODY breakdown: [${this.getBodyTerms()}], `
                    }STUN breakdown: [${this.getStunTerms()}]`,
                    terms: `${this._noBody ? "" : `${this.getBodyTerms()}; `}${this.getStunTerms()}`,
                    total: `${this._noBody ? "" : `${this.getBodyTotal()} BODY; `}${this.getStunTotal()} STUN`,
                };

            case HeroRoller.ROLL_TYPE.KILLING:
                return {
                    annotatedTerms: `BODY breakdown: [${this.getBodyTerms()}], STUN breakdown: [${this.getStunTerms()}]${
                        !this._useHitLocation
                            ? `, STUNx breakdown: [${this._killingStunMultiplierHeroRoller.getTermsSummary()}]`
                            : ""
                    }`,
                    terms: `${this.getBodyTerms()} BODY; ${this.getStunTerms()} STUN${
                        !this._useHitLocation
                            ? `; (${this._killingStunMultiplierHeroRoller.getTermsSummary()} STUNx)`
                            : ""
                    }`,
                    total: `${this.getBodyTotal()} BODY; ${this.getStunTotal()} STUN${
                        !this._useHitLocation ? ` (${this.getStunMultiplier()} STUNx)` : ""
                    }`,
                };

            case HeroRoller.ROLL_TYPE.ENTANGLE:
                return {
                    annotatedTerms: `BODY breakdown: [${this.getEntangleTerms()}]`,
                    terms: `${this.getEntangleTerms()} BODY`,
                    total: `${this.getEntangleTotal()} BODY`,
                };

            case HeroRoller.ROLL_TYPE.ADJUSTMENT:
                return {
                    annotatedTerms: `Active point breakdown: [${this.getAdjustmentTerms()}]`,
                    terms: `[${this.getAdjustmentTerms()}] Active Points`,
                    total: `${this.getAdjustmentTotal()} Active Points`,
                };

            case HeroRoller.ROLL_TYPE.FLASH:
                return {
                    annotatedTerms: `Segments breakdown: [${this.getFlashTerms()}}]`,
                    terms: `[${this.getFlashTerms()}}] Segments`,
                    total: `${this.getFlashTotal()} Segments`,
                };

            case HeroRoller.ROLL_TYPE.EFFECT:
                return {
                    annotatedTerms: `Effect breakdown: [${this.getEffectTerms()}}]`,
                    terms: `[${this.getEffectTerms()}}] Effect`,
                    total: `${this.getEffectTotal()} Effect`,
                };

            default:
                console.error(`unknown type ${this._type}`);
                break;
        }
    }
}
