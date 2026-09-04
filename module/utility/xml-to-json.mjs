import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo } from "./util.mjs";

// XML attribute values Yes/No coerce to booleans; xmlTag/_hdcXml are stamped on for
// getPowerInfo disambiguation and eventual write-back; super old HDC files get their
// missing XMLID/OPTIONID/ID/BASECOST repaired from config powerInfo.
export function xmlToJsonNode(json, children) {
    if (children.length === 0) return;

    for (const child of children) {
        const tagName = child.tagName;

        let jsonChild = {};
        if (child.childElementCount == 0 && child.attributes.length == 0) {
            jsonChild = child.textContent;
        }
        if (HeroSystem6eItem.ItemXmlTags.includes(child.tagName)) {
            jsonChild = [];
        } else {
            for (const attribute of child.attributes) {
                switch (attribute.value) {
                    case "Yes":
                    case "YES":
                        jsonChild[attribute.name] = true;
                        break;
                    case "No":
                    case "NO":
                        jsonChild[attribute.name] = false;
                        break;
                    case "GENERIC_OBJECT":
                        jsonChild[attribute.name] = child.tagName.toUpperCase(); // e.g. MULTIPOWER
                        jsonChild["xmlid"] = attribute.value.trim(); // Sept 1 2025: Consider keeping the original XMLID for eventual write
                        break;
                    default:
                        jsonChild[attribute.name] = attribute.value.trim();
                }
            }

            // There can be confusion if the item is a MODIFIER or ADDER (EXPLOSION 5e/6e and others).
            // So keep track of the tagName, which we use in getPowerInfo to help filter when there are duplicate XMLID keys.
            if (child.attributes.length > 0) {
                try {
                    jsonChild.xmlTag = tagName;
                    jsonChild._hdcXml = new XMLSerializer().serializeToString(child); //new XMLSerializer().serializeToString(child.cloneNode());
                } catch (e) {
                    console.error(e);
                }
            }
        }

        if (child.children.length > 0) {
            xmlToJsonNode(jsonChild, child.children);
        }

        let isPartOfTemplate = false;
        let ptr = child;
        while (ptr) {
            if (ptr.tagName === "TEMPLATE") {
                isPartOfTemplate = true;
                break;
            }
            ptr = ptr.parentNode;
        }

        if (!isPartOfTemplate) {
            // Some super old items use RANGED, but is now called RANGE
            if (jsonChild.XMLID === "RANGED" && jsonChild.xmlTag === "ADDER") {
                jsonChild.XMLID = "RANGE";
                jsonChild.errors ??= [];
                jsonChild.errors.push("RANGE renamed to RANGED");
            }

            // Items should have an XMLID
            // Some super old items are missing XMLID, which we will try to fix
            // A bit more generic
            if (
                !jsonChild.XMLID &&
                ["CHARACTERISTICS", ...HeroSystem6eItem.ItemXmlTags].includes(child.parentNode.tagName)
            ) {
                const powerInfo = getPowerInfo({
                    xmlid: jsonChild.xmlTag,
                    xmlTag: jsonChild.xmlTag,
                    is5e: true,
                });
                if (powerInfo) {
                    if (powerInfo.key != jsonChild.xmlTag) {
                        console.error(`powerInfo.key != xmlTag`, jsonChild);
                    }
                    jsonChild.XMLID = powerInfo.key;
                    jsonChild.errors ??= [];
                    jsonChild.errors.push("Missing XMLID, using xmlTag reference");
                }
            }

            // Super old HDC missing XMLID for power frameworks & lists (newer has XMLID=GENERIC_OBJECT)
            if (!jsonChild.XMLID && ["LIST", "VPP", "MULTIPOWER"].includes(jsonChild.xmlTag)) {
                jsonChild.XMLID = jsonChild.xmlTag;
            }

            // Some super old items are missing OPTIONID, which we will try to fix
            if (jsonChild.OPTION && !jsonChild.OPTIONID) {
                const powerInfo = getPowerInfo({ xmlid: jsonChild.XMLID, xmlTag: jsonChild.xmlTag, is5e: true });
                jsonChild.OPTIONID = powerInfo?.optionIDFix?.(jsonChild) || jsonChild.OPTION.toUpperCase();
                jsonChild.errors ??= [];
                jsonChild.errors.push("Missing OPTIONID, using OPTION reference");
            }

            // Some super old items are missing and ID (like SCIENTIST skill enhancer)
            if (jsonChild.XMLID && !jsonChild.ID) {
                const powerInfo = getPowerInfo({ xmlid: jsonChild.XMLID, xmlTag: jsonChild.xmlTag, is5e: true });
                const PARENTID = child.nextElementSibling?.attributes?.PARENTID?.value;
                if (PARENTID) {
                    jsonChild.ID = PARENTID;
                    jsonChild.errors ??= [];
                    jsonChild.errors.push("Missing ID, using PARENTID from nextElementSibling");
                }

                if (!jsonChild.BASECOST) {
                    // We are going to rebase this item as we have no BASECOST or likely any other properties
                    if (!powerInfo?.xml) {
                        ui.notifications.error(
                            `Unable to rebase ${jsonChild?.XMLID} because powerInfo is not available.`,
                        );
                        continue;
                    } else {
                        try {
                            jsonChild.errors ??= [];
                            const parser = new DOMParser();
                            const rebase = parser.parseFromString(powerInfo.xml.trim(), "text/xml");
                            for (const attribute of rebase.children[0].attributes) {
                                if (!jsonChild[attribute.name]) {
                                    jsonChild[attribute.name] ??= attribute.value;
                                    jsonChild.errors.push(`${attribute.name} from config.mjs:xml`);
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
        }

        if (
            HeroSystem6eItem.ItemXmlChildTagsUpload.includes(child.tagName) &&
            !HeroSystem6eItem.ItemXmlTags.includes(child.parentElement?.tagName)
        ) {
            json[tagName] ??= [];
            json[tagName].push(jsonChild);
        } else if (Array.isArray(json)) {
            json.push(jsonChild);
        } else {
            json[tagName] = jsonChild;
        }
    }
}
