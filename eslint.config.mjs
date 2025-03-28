// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default tseslint.config(
  globalIgnores([
    'starter/**/*',
    'preview/**/*',
    'plugin-explorer/**/*',
    'out/**/*',
    'resources/**/*',
    'certificates/**/*',
    'node_modules/**/*',
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
