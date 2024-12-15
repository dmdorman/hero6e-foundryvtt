import js from "@eslint/js";
import globals from "globals";

import stylisticJs from "@stylistic/eslint-plugin-js";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
    {
        plugins: {
            "@stylistic/js": stylisticJs,
        },

        languageOptions: {
            ecmaVersion: 2022,

            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...globals.node,

                ActiveEffect: "readonly",
                Actor: "readonly",
                Actors: "readonly",
                ActorSheet: "readonly",
                Application: "readonly",
                canvas: "readonly",
                ChatMessage: "readonly",
                Combat: "readonly",
                Combatant: "readonly",
                CombatTracker: "readonly",
                CONFIG: "readonly",
                CONST: "readonly",
                Dialog: "readonly",
                Die: "readonly",
                dragRuler: "readonly",
                FilePicker: "readonly",
                fromUuid: "readonly",
                fromUuidSync: "readonly",
                Folder: "readonly",
                FormApplication: "readonly",
                FormDataExtended: "readonly",
                foundry: "readonly",
                game: "readonly",
                getDocumentClass: "readonly",
                Handlebars: "readonly",
                HERO: "readonly",
                HeroRuler: "readonly",
                HeroSystem6eItem: "readonly",
                HexagonalGrid: "readonly",
                Hooks: "readonly",
                ImageHelper: "readonly",
                Item: "readonly",
                Items: "readonly",
                ItemSheet: "readonly",
                loadTemplates: "readonly",
                NumericTerm: "readonly",
                Macro: "readonly",
                OperatorTerm: "readonly",
                OutlineOverlayFilter: "readonly",
                PIXI: "readonly",
                quench: "readonly",
                renderTemplate: "readonly",
                Roll: "readonly",
                RollTerm: "readonly",
                SceneNavigation: "readonly",
                SimpleCalendar: "readonly",
                TextEditor: "readonly",
                TokenDocument: "readonly",
                ui: "readonly",
            },
        },
    },
    js.configs.recommended,
    eslintConfigPrettier,
];
