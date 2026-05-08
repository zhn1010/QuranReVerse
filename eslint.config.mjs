import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import nextTs from 'eslint-config-next/typescript';
import tailwindCanonicalClasses from 'eslint-plugin-tailwind-canonical-classes';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  ...tailwindCanonicalClasses.configs['flat/recommended'],
  {
    rules: {
      'tailwind-canonical-classes/tailwind-canonical-classes': [
        'error',
        {
          cssPath: './src/app/globals.css',
        },
      ],
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
