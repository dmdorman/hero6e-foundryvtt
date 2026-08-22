// Inspired from Draw Steel https://github.com/MetaMorphic-Digital/draw-steel/blob/develop/src/module/applications/api/application.mjs

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class HeroApplication extends HandlebarsApplicationMixin(ApplicationV2) {
    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ["hero6efoundryvttv2"],
        form: {
            handler: HeroApplication.#submitHandler,
            closeOnSubmit: true,
        },
        position: {
            width: 450,
            height: "auto",
        },
        tag: "form",
        window: {
            contentClasses: ["standard-form"],
        },
    };

    config = null;

    static async create(options) {
        const { promise, resolve } = Promise.withResolvers();
        const application = new this(options);
        application.addEventListener("close", () => resolve(application.config), { once: true });
        application.render({ force: true });
        return promise;
    }

    static #submitHandler(event, form, formData, submitOptions = {}) {
        this.config = this._processFormData(event, form, formData, submitOptions);
    }

    _processFormData(event, form, formData) {
        return foundry.utils.expandObject(formData.object);
    }
}
