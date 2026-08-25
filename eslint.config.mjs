import js from "@eslint/js";
import globals from "globals";

import stylistic from "@stylistic/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
    {
        plugins: {
            "@stylistic": stylistic,
        },

        languageOptions: {
            ecmaVersion: 2022,

            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...globals.node,

                _replace: "readonly",
                ActiveEffect: "readonly",
                canvas: "readonly",
                ChatMessage: "readonly",
                Combat: "readonly",
                Combatant: "readonly",
                CONFIG: "readonly",
                CONST: "readonly",
                DetectionMode: "readonly",
                Die: "readonly",
                Folder: "readonly",
                ForgeAPI: "readonly",
                foundry: "readonly",
                fromUuid: "readonly",
                fromUuidSync: "readonly",
                game: "readonly",
                getDocumentClass: "readonly",
                Handlebars: "readonly",
                HERO: "readonly",
                HeroSystem6eItem: "readonly",
                Hooks: "readonly",
                NumericTerm: "readonly",
                OperatorTerm: "readonly",
                PIXI: "readonly",
                quench: "readonly",
                Roll: "readonly",
                Scene: "readonly",
                SimpleCalendar: "readonly",
                ui: "readonly",
                User: "readonly",
            },
        },
    },
    js.configs.recommended,
    {
        // Extra rules beyond the recommended set
        rules: {
            "no-use-before-define": [
                "error",
                {
                    functions: false,
                    classes: true,
                    variables: true,
                    allowNamedExports: true,
                },
            ],
        },
    },
    eslintConfigPrettier,
];
