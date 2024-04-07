import { HEROSYS } from "./herosystem6e.mjs";

export function initializeHandlebarsHelpers() {
    Handlebars.registerHelper("indexOf", indexOf);
    Handlebars.registerHelper("abs", abs);
    Handlebars.registerHelper("increment", increment);
    Handlebars.registerHelper("gameConfigValue", gameConfigValue);
    Handlebars.registerHelper("getModulePath", getModulePath);
    Handlebars.registerHelper("isdefined", function (value) {
        return value !== undefined;
    });
    Handlebars.registerHelper("compare", compare);
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

function compare(param1, operator, param2, insensitive) {
    let v1 = param1;
    let v2 = param2;
    if (insensitive === "insensitive") {
        //handle case insensitive conditions if 4 param is passed.
        v1 = param1.toLowerCase();
        v2 = param2.toLowerCase();
    }
    switch (operator) {
        case "==":
            return v1 == v2;
        case "!=":
            return v1 != v2;
        case "===":
            return v1 === v2;
        case "<":
            return v1 < v2;
        case "<=":
            return v1 <= v2;
        case ">":
            return v1 > v2;
        case ">=":
            return v1 >= v2;
        case "&&":
            return !!(v1 && v2);
        case "||":
            return !!(v1 || v2);
        default:
            return false;
    }
}
