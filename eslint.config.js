import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/dist/',
      '**/build/',
      '**/node_modules/',
      '**/coverage/',
      '**/*.d.ts',
      '**/*.config.js',
      '**/*.config.ts'
    ]
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked.map(config => ({
    ...config,
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts']
  })),

  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname
      }
    },

    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-debugger': 'error',
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }]
    }
  },

  // Non-type-checked config for test files
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.test.ts']
  })),

  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      'no-debugger': 'error'
    }
  }
]
