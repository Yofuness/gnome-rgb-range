// Based on the GJS style guide: https://gjs.guide/guides/gjs/style-guide.html
import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.es2021,
                console: 'readonly',
                global: 'readonly',
                _: 'readonly',
                C_: 'readonly',
                N_: 'readonly',
                ngettext: 'readonly',
            },
        },
        rules: {
            'eqeqeq': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-shadow': 'warn',
            'no-await-in-loop': 'error',
            'no-loop-func': 'error',
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            'no-restricted-globals': ['error',
                {name: 'log', message: 'Use console.log()'},
                {name: 'logError', message: 'Use console.warn() or console.error()'},
            ],
            'quotes': ['error', 'single', {avoidEscape: true}],
            'semi': ['error', 'always'],
            'indent': ['error', 4, {
                SwitchCase: 0,
                // Same exception as gnome-shell's own config
                ignoredNodes: [
                    'CallExpression[callee.object.name=GObject][callee.property.name=registerClass] > ClassExpression:first-child',
                ],
            }],
            'object-curly-spacing': ['error', 'never'],
            'comma-dangle': ['error', 'always-multiline'],
            'arrow-parens': ['error', 'as-needed'],
        },
    },
];
