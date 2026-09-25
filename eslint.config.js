import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'build/', 'dist/', 'release/', 'test-results/'] },
  {
    files: [
      'main/**/*.{ts,cts}',
      'nucleo/**/*.ts',
      'vistas/**/*.{ts,tsx}',
      'scripts/**/*.mjs',
      'vite.config.ts',
    ],
    ...js.configs.recommended,
  },
  {
    files: ['main/**/*.{ts,cts}', 'nucleo/**/*.ts', 'vistas/**/*.{ts,tsx}', 'vite.config.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error',
    },
  },
  {
    files: ['vistas/**/*.{ts,tsx}'],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['main/**/*.{ts,cts}', 'nucleo/**/*.ts', 'scripts/**/*.mjs', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['main/**/*.test.ts', 'nucleo/**/*.test.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/no-floating-promises': 'off' },
  },
  prettier,
);
