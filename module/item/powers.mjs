import { getModifierInfo } from "../utility/util.mjs";
import { HeroSystem6eItem } from "./item.mjs";
import { HeroSystem6eAdder } from "./adder.mjs";

export class HeroSystem6ePower {
    #baseInfo = null;
    constructor(json, options) {
        // Item first so we can get baseInfo
        this._item = options?.item;
        this._id = json?.ID;
        this.#baseInfo = getModifierInfo({ xmlid: json.XMLID, actor: options.item?.actor, is5e: options.item?.is5e });

        for (const key of Object.keys(json)) {
            /// Create getters (if we don't already have one)
            if (!Object.getOwnPropertyDescriptor(HeroSystem6ePower.prototype, key)?.["get"]) {
                {
                    Object.defineProperty(this, key, {
                        get() {
                            return this._original[key];
                        },
                        set(value) {
                            this._original.LEVELS = value;
                        },
                    });
                }
                // Should probably create setters too, but not yet as we only support LEVELS at the moment
            }
        }

        if (!(this.item instanceof HeroSystem6eItem)) {
            console.warn(`${this.XMLID} item not found`);
        }
        if (!this.#baseInfo) {
            console.warn(`${this.item?.actor.name}/${this.item?.detailedName()}/${this.XMLID} baseInfo not found`);
        }
    }

    get item() {
        return this._item;
    }

    get _original() {
        return this.item?.system.POWER.find((p) => p.ID === this._id);
    }

    get baseInfo() {
        return this.#baseInfo;
    }

    get cost() {
        let _cost = 0;
        // Custom costs calculations
        if (this.baseInfo?.cost) {
            _cost = this.baseInfo.cost(this, this.item);
        } else {
            // Generic cost calculations
            _cost = parseFloat(this.BASECOST);

            const costPerLevel = this.baseInfo?.costPerLevel(this) || 0;
            const levels = parseInt(this.LEVELS) || 0;
            _cost += levels * costPerLevel;
        }

        // POWER-adders do not have ADDER (that we are aware of)
        for (const adder of this.adders) {
            _cost += adder.cost;
        }

        return Math.ceil(_cost);
    }

    get adders() {
        const _addres = [];
        for (const _adderJson of this.ADDER || []) {
            _addres.push(new HeroSystem6eAdder(_adderJson, { item: this.item, parent: this }));
        }
        return _addres;
    }

    get BASECOST_total() {
        if (this._BASECOST_total !== undefined) {
            if (this._BASECOST_total !== this.cost) {
                console.error(`BASECOST_total (${this.cost}) did not match cost ${this._BASECOST_total}`);
            }
        }
        return this.cost;
    }

    set BASECOST_total(value) {
        if (this.cost != value) {
            //debugger;
            console.error(
                `${this.item?.actor.name}/${this.item?.detailedName()}/${this.XMLID} BASECOST_total (${value}) did not match cost ${this.BASECOST_total}`,
            );
        }
    }
}
