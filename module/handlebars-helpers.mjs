import { HEROSYS } from "./herosystem6e.mjs";

export function initializeHandlebarsHelpers() {
    Handlebars.registerHelper("abs", abs);
    Handlebars.registerHelper("concat", concat);
    Handlebars.registerHelper("gameConfigValue", gameConfigValue);
    Handlebars.registerHelper("getModulePath", getModulePath);
    Handlebars.registerHelper("includes", includes);
    Handlebars.registerHelper("toJSON", toJSON);
    Handlebars.registerHelper("toArray", toArray);
    Handlebars.registerHelper("toJsonArray", toJsonArray);
    Handlebars.registerHelper("increment", increment);
    Handlebars.registerHelper("indexOf", indexOf);
    Handlebars.registerHelper("is_active_segment", isActiveSegment);
    Handlebars.registerHelper("isdefined", isDefined);
    Handlebars.registerHelper("toLowerCase", toLowerCase);
    Handlebars.registerHelper("toUpperCase", toUpperCase);
    Handlebars.registerHelper("appliesTo", appliesTo);
    Handlebars.registerHelper("checkInit", checkInit);
    Handlebars.registerHelper("objectNumKeys", objectNumKeys);
    Handlebars.registerHelper("getFlag", getFlag);
    Handlebars.registerHelper("getFlagKey2", getFlagKey2);
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

function isActiveSegment(actives, index) {
    return actives?.[index];
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

function isDefined(value) {
    return value !== undefined;
}

// Typically to determine if DEADLYBLOW applies to a specific attack
function appliesTo(power, attack) {
    if (typeof power?.baseInfo?.appliesTo !== "function") return false;
    return power.baseInfo.appliesTo(attack);
}

function checkInit(value) {
    let myValue = Number(value) || 0;
    return myValue > 0;
}

function objectNumKeys(obj) {
    return Object.keys(obj).length;
}

function getFlag(obj, scope, key) {
    try {
        // obj.getFlag assumes an object, which isn't always the case
        return obj?.flags?.[scope]?.[key];
    } catch (e) {
        console.error(e);
    }
    return null;
}

function getFlagKey2(obj, scope, key, key2) {
    try {
        // obj.getFlag assumes an object, which isn't always the case
        return obj?.flags?.[scope]?.[key]?.[key2];
    } catch (e) {
        console.error(e);
    }
    return null;
}
