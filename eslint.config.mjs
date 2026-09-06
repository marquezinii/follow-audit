import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true },
      globals: {
        AbortController: 'readonly', AbortSignal: 'readonly', alert: 'readonly', Blob: 'readonly',
        clearTimeout: 'readonly', confirm: 'readonly', document: 'readonly', DOMException: 'readonly',
        Element: 'readonly', Error: 'readonly', Event: 'readonly', fetch: 'readonly', File: 'readonly',
        location: 'readonly', localStorage: 'readonly', navigator: 'readonly', Node: 'readonly',
        Request: 'readonly', Response: 'readonly', setTimeout: 'readonly', URL: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  { ignores: ['dist/**', 'public/dist.js'] },
);
