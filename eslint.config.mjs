import javascript from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['.astro/', '.local/', 'dist/', 'gestor.html']),
  javascript.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'src/server/**/*.{js,mjs}', 'src/pages/api/**/*.js', 'src/middleware.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/components/**/*.{js,jsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]);
