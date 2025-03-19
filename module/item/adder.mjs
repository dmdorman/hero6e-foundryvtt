import { getModifierInfo } from "../utility/util.mjs";
import { HeroSystem6eItem } from "./item.mjs";

export class HeroSystem6eAdder {
    #baseInfo;

    constructor(json, options) {
        // These are needed first
        this.item = options.item;
        // if (!this.item) {
        //     debugger;
        // }
        this.#baseInfo = getModifierInfo({
            xmlid: json.XMLID,
            actor: this.item?.actor,
            is5e: this.item?.is5e,
            item: this.item,
            xmlTag: "ADDER",
        });

        for (const key of Object.keys(json)) {
            if (foundry.utils.hasProperty(this, key)) {
                this[`_${key}`] = json[key];
            } else {
                this[key] = json[key];
            }
        }

        for (const key of Object.keys(options)) {
            this[key] = options[key];
        }

        // We really don't NEED every adder, for example SWIMMINGBEASTS from the RIDINGADNIMALS category of TRANSPORT_FAMILIARITY.
        // Without these adders we will eventually have issues with in-game editing.
        // However, if we have no data to base the cost from, we should investigate
        if (!this.#baseInfo && !this.BASECOST && !this.LVLCOST) {
            if (!window.warnAdder?.includes(this.XMLID)) {
                console.warn(
                    `${this.item?.actor.name}/${this.item?.detailedName()}/${this.XMLID}: missing baseInfo.`,
                    this,
                );
                window.warnAdder ??= [];
                window.warnAdder.push(this.XMLID);
            }
        }
    }

    get baseInfo() {
        return this.#baseInfo;
    }

    get cost() {
        let _cost = 0;
        if (this.SELECTED !== false) {
            // Custom costs calculations
            if (this.baseInfo?.cost) {
                _cost = this.#baseInfo.cost(this, this.item);
            } else {
                // Generic cost calculations
                _cost = parseFloat(this.BASECOST);

                let costPerLevel = this.baseInfo?.costPerLevel ? this.baseInfo?.costPerLevel(this) : 0;
                const levels = parseInt(this.LEVELS) || 0;
                // Override default costPerLevel?
                if (this.LVLCOST && levels > 0) {
                    const _costPerLevel = parseFloat(this.LVLCOST || 0) / parseFloat(this.LVLVAL || 1) || 1;
                    costPerLevel = _costPerLevel;
                }
                _cost += levels * costPerLevel;
            }
        }

        // Some parent modifiers need to override/tweak the adder costs (WEAPONSMITH)
        if (this.parent?.baseInfo?.adderCostAdjustment) {
            _cost = this.parent.baseInfo.adderCostAdjustment({ adder: this, adderCost: _cost });
        }

        // Some ADDERs have ADDERs (for example TRANSPORT_FAMILIARITY)
        for (const adder of this.adders) {
            _cost += adder.cost;
        }

        // TRANSPORT_FAMILIARITY (possibly others) may have a maximum cost per category
        if (this.SELECTED === false && this.item?.type === "skill") {
            const maxCost = parseFloat(this.BASECOST) || 0;
            if (maxCost > 0 && _cost > maxCost) {
                // console.log(
                //     `${this.item?.actor?.name}/${this.item?.name}/${this.item?.system.XMLID}/${this.XMLID} category clamped from ${_cost} down to ${maxCost}`,
                // );
                if (this.item?.system.XMLID != "TRANSPORT_FAMILIARITY") {
                    console.warn(`We found another example of a skill with category limitations ${this.system.XMLID}`);
                }
                _cost = Math.min(maxCost, _cost);
            }
        }

        if (this.parent instanceof HeroSystem6eItem) {
            _cost = Math.ceil(_cost);
        }

        return _cost;
    }

    get adders() {
        const _addres = [];
        for (const _adderJson of this.ADDER || []) {
            _addres.push(new HeroSystem6eAdder(_adderJson, { item: this.item, parent: this }));
        }
        return _addres;
    }

    get BASECOST_total() {
        // if (this._BASECOST_total !== undefined) {
        //     if (this._BASECOST_total !== this.cost) {
        //         console.error(`BASECOST_total (${this.cost}) did not match cost ${this._BASECOST_total}`);
        //     }
        // }
        return this.cost;
    }

    set BASECOST_total(value) {
        // ADDITIONALED is prorated based on ADDITIONALPD, which the legacy code does not do properly.
        // if (this.cost != value && this.XMLID !== "ADDITIONALED") {
        //     console.error(
        //         `${this.item?.actor.name}/${this.item?.name}/${this.item?.system.XMLID}/${this.XMLID} BASECOST_total (${value}) did not match cost ${this.BASECOST_total}`,
        //     );
        //     return;
        // }
    }
}
