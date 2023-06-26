import { HEROSYS } from "./herosystem6e.js";

export function initializeHandlebarsHelpers() {
    // handlebars helpers go here
    // Handlebars.registerHelper('helperName', async function (args) {});

    Handlebars.registerHelper('filterItem', function (item, filterString) {
        //console.log("filterItem")
        if (!filterString) return item
        if (
            item.name.toLowerCase().includes(filterString.toLowerCase()) ||
            (item.system.description && item.system.description.toLowerCase().includes(filterString.toLowerCase())) ||
            (item.system.XMLID && item.system.XMLID.toLowerCase().includes(filterString.toLowerCase()))
        ) {
            return item
        }
    });

    Handlebars.registerHelper('indexOf', function (string, searchTerm) {
        return string.indexOf(searchTerm)
    });
    

}