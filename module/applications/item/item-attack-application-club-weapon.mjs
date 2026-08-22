import { HeroSystem6eActorActiveEffects } from "../../actor/actor-active-effects.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A lightweight V2 dialog used when the Club Weapon maneuver is active.
 *
 * The dialog simply lets the user pick which hand-to-hand killing attack
 * should be treated as the "club" for the current attack.
 */
export class ItemAttackClubWeaponApplicationV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static {
        Hooks.once("init", () => {
            ItemAttackClubWeaponApplicationV2.initializeTemplate();
        });
    }

    constructor(data = {}) {
        super(data);

        // the caller may pass in an actor or token as part of the data
        this.data = data;
    }

    /**
     * Build a title for the window.
     */
    get title() {
        return `Club Weapon`;
    }

    /**
     * Option defaults for this V2 form.
     */
    static DEFAULT_OPTIONS = {
        classes: ["herosystem6e", "club-weapon-application"],
        id: "item-attack-club-weapon-v2",
        position: {
            width: 400,
        },
        tag: "form",
        form: {
            handler: ItemAttackClubWeaponApplicationV2.#onSubmit,
            closeOnSubmit: false,
        },
        window: {
            icon: "fas fa-screwdriver-wrench",
        },
        actions: {
            cancel: ItemAttackClubWeaponApplicationV2.#onCancel,
        },
    };

    /**
     * Populate the PARTS object that tells ApplicationV2 where to find
     * the handlebars template for the body (and footer if desired).
     */
    static initializeTemplate() {
        const systemId = game.system.id;
        ItemAttackClubWeaponApplicationV2.PARTS = {
            body: {
                template: `systems/${systemId}/templates/attack/item-attack-application-club-weapon-v2.hbs`,
            },
        };
    }

    /**
     * Prepare the context which will be passed to Handlebars.
     * The important piece is to supply a list of eligible HKA items on the
     * actor so the template can render them.
     */
    async _prepareContext(/* options */) {
        const actor = this.data.actor ?? this.data.token?.actor;

        this.data.clubIcon = HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.img;

        this.data.clubWeaponId ??= null;

        this.data.possibleHkaItems ??= actor
            ? actor.items
                  .filter((item) => item.system.XMLID === "HKA" && item.isActive)
                  .map((hka) => {
                      return {
                          id: hka.id,
                          label: hka.name,
                          description: hka.system.description,
                          item: hka,
                      };
                  })
            : [
                  {
                      id: null,
                      label: "No hand-to-hand killing attacks found",
                      description: "No hand-to-hand killing attacks found",
                      item: null,
                  },
              ];

        return this.data;
    }

    /**
     * Get the selected HKA and pass to the build attack dialog handler
     */
    static async #onSubmit(event, form, formData) {
        const clubWeaponId = formData.get("clubWeaponId");
        const clubWeaponItem = this.data.possibleHkaItems.find((hka) => hka.id === clubWeaponId)?.item;
        if (!clubWeaponItem) {
            return ui.notifications.warn("Select a hand-to-hand killing attack to use as a club.");
        }

        this.data.clubWeaponItem = clubWeaponItem;
        await this.close();

        if (this.data.nextApplication) {
            const nextApplication = this.data.nextApplication;
            this.data.nextApplication = null;

            return new nextApplication(this.data).render(true);
        }
    }

    /**
     * Cancel selection and exit dialog.
     */
    static async #onCancel() {
        return this.close();
    }
}
