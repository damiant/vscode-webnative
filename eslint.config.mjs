// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  globalIgnores([
    'starter/**/*',
    'preview/**/*',
    'plugin-explorer/**/*',
    'out/**/*',
    'tests/**/*',
    'resources/**/*',
    'certificates/**/*',
    'node_modules/**/*',
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
);
