import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, prettier, {
  languageOptions: {
    parserOptions: { project: './tsconfig.json' },
  },
  ignores: ['node_modules/', 'dist/'],
});
