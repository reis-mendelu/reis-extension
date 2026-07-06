import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.wxt', '.output', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Must be last: turns off any ESLint rules that would conflict with Prettier.
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Enforce using StorageService or IndexedDBService instead of direct storage APIs
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use IndexedDBService or Zustand instead of localStorage.' },
        { name: 'sessionStorage', message: 'Use IndexedDBService or Zustand instead of sessionStorage.' },
      ],
      'no-restricted-syntax': [
        'warn',
        {
          selector: "MemberExpression[object.object.name='chrome'][object.property.name='storage']",
          message: 'Use StorageService from src/services/storage instead of chrome.storage directly.'
        },
        // --- UI/UX gates ---
        // Theme integrity: raw Tailwind color-palette classes silently break the
        // non-active DaisyUI theme (e.g. text-slate-900 is invisible in dark mode).
        // Use semantic classes: text-base-content, bg-base-100/200/300, text-error/warning/success, etc.
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\b(?:text|bg|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d/]",
          message: 'Raw Tailwind palette color in className breaks the inactive DaisyUI theme. Use a semantic class (text-base-content, bg-base-200, text-error, bg-primary, …).'
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\b(?:text|bg|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d/]",
          message: 'Raw Tailwind palette color in className breaks the inactive DaisyUI theme. Use a semantic class (text-base-content, bg-base-200, text-error, bg-primary, …).'
        },
        // Hardcoded hex colors (incl. arbitrary values like bg-[#0d1117]) bypass the theme entirely.
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: 'Hardcoded hex color in className bypasses the DaisyUI theme. Use a semantic class instead.'
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message: 'Hardcoded hex color in className bypasses the DaisyUI theme. Use a semantic class instead.'
        },
        // i18n leakage: literal Czech text in JSX reaches English users untranslated.
        // Route every user-facing string through useTranslation() / locales/{cs,en}.json.
        {
          selector: "JSXText[value=/[\\u011b\\u0161\\u010d\\u0159\\u017e\\u00fd\\u00e1\\u00ed\\u00e9\\u00fa\\u016f\\u010f\\u0165\\u0148\\u00f3\\u011a\\u0160\\u010c\\u0158\\u017d]/]",
          message: 'Hardcoded Czech string in JSX bypasses i18n — English users will see Czech. Use useTranslation() / locales.'
        }
      ],
      // Warn on dangerouslySetInnerHTML usage
      'react/no-danger': 'off', // Using custom rule instead
    },
  },
  // Allow storage APIs in StorageService and specific utilities only
  {
    files: ['**/services/storage/**/*.ts', '**/components/SearchBar.tsx'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  // Allow 'any' in utility files where it's intentional for generics
  {
    files: [
      '**/utils/logger.ts',
      '**/utils/encryption.ts',
      '**/utils/requestQueue.ts',
      '**/types/**/*.ts',
      '**/components/ui/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Parser files (CLAUDE.md Parser Rules) suppress noUncheckedIndexedAccess
  // errors with @ts-ignore, not @ts-expect-error: the real tsconfig doesn't
  // enable the flag until the rollout's final step, so @ts-expect-error would
  // itself error as an unused directive under the normal (flag-off) build.
  {
    files: ['**/utils/parsers/**/*.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
])
