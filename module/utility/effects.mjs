import { HeroSystem6eItem } from "../item/item.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";

export async function onManageActiveEffect(event, owner) {
    event.preventDefault();
    const a = event.currentTarget;
    const li = a.closest("tr") || a.closest("li");

    if (!li) {
        return;
    }

    const effect = Array.from(owner.allApplicableEffects()).find((o) => o.id == li.dataset.effectId);
    const item = owner.items.get(li.dataset.effectId);

    switch (a.dataset.action) {
        case "create":
            return owner.createEmbeddedDocuments("ActiveEffect", [
                {
                    label: "New Effect",
                    icon: "icons/svg/aura.svg",
                    origin: owner.uuid,
                    disabled: true,
                },
            ]);

        case "edit":
            return (effect || item).sheet.render(true);

        case "delete": {
            if (!effect) {
                return;
            }

            const confirmed = await Dialog.confirm({
                title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title") + " [" + effect.name + "]",
                content: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Content"),
            });

            if (confirmed) {
                if (effect) {
                    if (!effect.disabled) {
                        await onActiveEffectToggle(effect);
                    }
                    await effect.delete();
                } else {
                    await item.delete();
                }
            }
            return;
        }

        case "toggle":
            if (effect) {
                return onActiveEffectToggle(effect);
            }

            return item.toggle();
    }
}

export async function onActiveEffectToggle(effect, newState) {
    if (newState == undefined) {
        await effect.update({ disabled: !effect.disabled });
        newState = effect.disabled;
    } else {
        await effect.update({ disabled: newState });
    }

    // If this is an item update active state
    const origin = await fromUuid(effect.origin);
    const item = origin instanceof HeroSystem6eItem ? origin : effect.parent;
    const actor = item?.actor || (item instanceof HeroSystem6eActor ? item : null);
    if (item) {
        await item.update({ "system.active": newState });
    }

    // Characteristic VALUE should change when toggled on
    for (const change of effect.changes) {
        // match something like system.characteristics.stun.max
        const charMatch = change.key.match(/characteristics\.(.+)\.max$/);
        if (charMatch) {
            const char = charMatch[1];
            const value = newState ? -parseInt(change.value) : parseInt(change.value);
            await actor.update({
                [`system.characteristics.${char}.value`]: parseInt(actor.system.characteristics[char].value) + value,
            });
        }
    }
}
