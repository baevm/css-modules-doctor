import eslint from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tsEslint from 'typescript-eslint'

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
  ...tsEslint.configs.strictTypeChecked,
  ...tsEslint.configs.stylistic,
  eslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsEslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },

    settings: {
      'import/extensions': ['.ts'],

      'import/resolver': {
        node: true,
        typescript: true,
      },
    },

    rules: {
      'array-callback-return': [
        'error',
        {
          checkForEach: true,
        },
      ],

      eqeqeq: [
        'error',
        'always',
        {
          null: 'ignore',
        },
      ],

      'linebreak-style': 'off',
      'no-else-return': 'error',
      'no-loop-func': 'error',
      'no-multi-assign': 'error',
      'no-nested-ternary': 'error',
      'no-new-func': 'error',
      'no-new-object': 'error',
      'no-new-wrappers': 'error',
      'no-param-reassign': 'error',
      'no-restricted-globals': 'error',
      'no-return-await': 'error',
      'no-underscore-dangle': 'error',
      'no-unneeded-ternary': 'error',
      'nonblock-statement-body-position': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      camelcase: 'error',

      'prefer-arrow-callback': [
        'error',
        {
          allowNamedFunctions: true,
        },
      ],

      'prefer-object-spread': 'error',
      'prefer-template': 'error',
      'prettier/prettier': 'error',
      'quote-props': ['error', 'as-needed'],
      quotes: ['error', 'single'],
      'template-curly-spacing': 'error',
      radix: 'error',
      'wrap-iife': 'error',

      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],

      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'warn',

      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/prefer-regexp-exec': 'warn',
      '@typescript-eslint/require-array-sort-compare': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'warn',

      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import/no-mutable-exports': 'error',

      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',

      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/consistent-generic-constructors': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-tslint-comment': 'off',
      '@typescript-eslint/no-misused-spread': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  },
]
