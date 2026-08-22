import { HEROSYS } from "./herosystem6e.mjs";

export function initializeHandlebarsHelpers() {
    Handlebars.registerHelper("abs", abs);
    Handlebars.registerHelper("actorItemHeroValidation", actorItemHeroValidation);
    Handlebars.registerHelper("actorItemHeroValidationCss", actorItemHeroValidationCss);
    Handlebars.registerHelper("actorHeroValidationCssByItemType", actorHeroValidationCssByItemType);
    Handlebars.registerHelper("actorItemHeroValidation", actorItemHeroValidation);
    Handlebars.registerHelper("appliesTo", appliesTo);
    Handlebars.registerHelper("calculated5eCharacteristic", calculated5eCharacteristic);
    Handlebars.registerHelper("concat", concat);
    Handlebars.registerHelper("equal", equal);
    Handlebars.registerHelper("figured5eCharacteristic", figured5eCharacteristic);
    Handlebars.registerHelper("gameConfigValue", gameConfigValue);
    Handlebars.registerHelper("getModulePath", getModulePath);
    Handlebars.registerHelper("getScopedFlagValue", getScopedFlagValue);
    Handlebars.registerHelper("getUploadLastModifiedDate", getUploadLastModifiedDate);
    Handlebars.registerHelper("hasCharacteristic", hasCharacteristic);
    Handlebars.registerHelper("includes", includes);
    Handlebars.registerHelper("increment", increment);
    Handlebars.registerHelper("indexOf", indexOf);
    Handlebars.registerHelper("isdefined", isDefined);
    Handlebars.registerHelper("hasProperty", hasProperty);
    Handlebars.registerHelper("notEqual", notEqual);
    Handlebars.registerHelper("signedString", signedString);
    Handlebars.registerHelper("toArray", toArray);
    Handlebars.registerHelper("toJsonArray", toJsonArray);
    Handlebars.registerHelper("toJSON", toJSON);
    Handlebars.registerHelper("toLowerCase", toLowerCase);
    Handlebars.registerHelper("toUpperCase", toUpperCase);
    Handlebars.registerHelper("objectNumKeys", objectNumKeys);
    Handlebars.registerHelper("defenseAbbreviation", defenseAbbreviation);
    Handlebars.registerHelper("endOrChargeDisplay", endOrChargeDisplay);
}

function indexOf(str, searchTerm) {
    return str.indexOf(searchTerm);
}

function abs(str) {
    return Math.abs(parseInt(str));
}

function increment(str, value) {
    return parseInt(str) + parseInt(value);
}

function gameConfigValue(configSetting) {
    return game.settings.get(HEROSYS.module, configSetting);
}

function getModulePath(templateDirectory) {
    return `systems/${HEROSYS.module}/templates/${templateDirectory}`;
}

function includes(str, searchTerm) {
    return str?.includes(searchTerm);
}

function toJSON(context) {
    return JSON.stringify(context);
}

/**
 * Takes args and turns it into an array.
 *
 * @returns Array
 */
function toArray(arg) {
    if (arg == null) return [];

    return [arg];
}

function toJsonArray(arg) {
    return toJSON(toArray(arg));
}

function toLowerCase(str) {
    return str?.toLowerCase();
}

function toUpperCase(str) {
    return str?.toUpperCase();
}

function concat() {
    let outStr = "";

    for (const arg in arguments) {
        if (typeof arguments[arg] !== "object") {
            outStr += arguments[arg];
        }
    }

    return outStr;
}

function isDefined(value, item, property) {
    // Prefer passing item and attributePath so we can check the schema.
    if (item.constructor?.name === "HeroSystem6eItem") {
        return foundry.utils.hasProperty(item, property);
    }
    return value !== undefined;
}

/// Is attributeName defined in the schema HeroSystem6eTypeDataModel
function hasProperty(actorOrItem, attributeName) {
    if (!actorOrItem || !attributeName) {
        console.error(`hasProperty call is missing parameters`);
        return false;
    }
    try {
        return foundry.utils.hasProperty(actorOrItem, attributeName);
    } catch (e) {
        throw new Error("foundry.utils.hasProperty failure", { cause: e });
    }
}

// Typically to determine if DEADLYBLOW applies to a specific attack
function appliesTo(power, attack) {
    if (typeof power?.baseInfo?.appliesTo !== "function") return false;
    return power.baseInfo.appliesTo(attack);
}

function equal(value1, value2) {
    return value1 === value2;
}

function objectNumKeys(obj) {
    try {
        return Object.keys(obj).length;
    } catch (e) {
        console.error(e);
        return 0;
    }
}

function defenseAbbreviation(defense) {
    return CONFIG.HERO.DEFENSE_ABBREVIATIONS[defense] || defense;
}

function endOrChargeDisplay(item) {
    const chargeText = item.system.chargesMax > 0 ? `[${item.system.numCharges}]` : "";

    // You can have charges and end, so show both if that's the case.
    return `${item.system.endEstimate ? item.system.endEstimate : ""} ${chargeText}`.trim();
}

/**
 *
 * @param {object} obj
 * @param {string} scope
 * @param  {...string} args - 1 or more strings defining the property/key to examine
 * @returns
 */
function getScopedFlagValue(obj, scope, ...args) {
    try {
        if (!obj || !scope) {
            throw Error(`Invalid arguments ${obj} ${scope}`);
        }

        // Handlebars will have an object at the end of the args. Ignore it and just get the strings we've passed in.
        const keys = args.filter((arg) => typeof arg === "string");

        let keyValue = obj.flags[scope];
        keys.forEach((key) => {
            // Silently swallow undefined and null dereferencing
            keyValue = keyValue == null ? keyValue : keyValue[key];
        });

        return keyValue;
    } catch (e) {
        console.error(e);
    }
    return null;
}

function actorItemHeroValidation(item) {
    return item.heroValidation.map((m) => m.message).join(", ");
}

function actorItemHeroValidationCss(item) {
    function getKeyByValue(object, value) {
        return Object.keys(object).find((key) => object[key] === value);
    }
    const severityMax = Math.max(0, ...item.heroValidation.map((m) => m.severity ?? 0));

    if (severityMax > 0) {
        return `validation validation-${getKeyByValue(CONFIG.HERO.VALIDATION_SEVERITY, severityMax).toLocaleLowerCase()}`;
    }

    return "";
}

function actorHeroValidationCssByItemType(actor, itemType) {
    // Need to be careful here as a SKILL in a COMPOUNDPOWER as a piece of EQUIPMENT
    // doesn't show in SKILL tab

    function getKeyByValue(object, value) {
        return Object.keys(object).find((key) => object[key] === value);
    }

    const validationsOfType = actor.items
        .filter((item) => (item.parentItem?.parentItem || item.parentItem || item).type === itemType)
        .reduce((accumulator, currentArray) => {
            return accumulator.concat(currentArray.heroValidation);
        }, []);

    const severityMax = Math.max(0, ...validationsOfType.map((m) => m.severity ?? 0));

    if (severityMax > 0) {
        return `validation validation-${getKeyByValue(CONFIG.HERO.VALIDATION_SEVERITY, severityMax).toLocaleLowerCase()}`;
    }

    return "";
}

function hasCharacteristic(actor, characteristic) {
    if (actor) {
        return actor.hasCharacteristic(characteristic);
    }
    console.error("No actor provided");
    return false;
}

function notEqual(value1, value2) {
    return value1 !== value2;
}

function signedString(value) {
    try {
        return Number(value).signedString() || value;
    } catch (e) {
        console.error(e);
    }
    return value;
}

function calculated5eCharacteristic(actor, characteristic) {
    try {
        // The base getter evaluates the formula against effect-free sources: the displayed base
        // must not follow an AID/DRAIN on the source primary — the max column carries that number
        // and its tooltip explains it.
        return characteristic.base;
    } catch (e) {
        console.error(e);
    }
    return "?";
}

function figured5eCharacteristic(actor, characteristic) {
    try {
        // Return the raw unrounded values. It works because SPD is the only non rounded value.
        // Routed through the base getter, which is effect-free for 5e dependents.
        return characteristic.base;
    } catch (e) {
        console.error(e);
    }
    return "?";
}

function getUploadLastModifiedDate(actor) {
    if (!actor) {
        console.error("getUploadTimeLocale actor is undefined");
        return "undefined";
    }
    const lastModifiedDate = actor.flags?.[game.system.id]?.file?.lastModifiedDate;
    if (!lastModifiedDate) {
        console.warn("getUploadTimeLocale lastModifiedDate is undefined");
        return "undefined";
    }

    const dt = new Date(lastModifiedDate);
    return dt.toLocaleString();
}
