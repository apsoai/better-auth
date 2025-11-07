module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.test.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off', // Relaxed from 'error'
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Relaxed from 'error'
    '@typescript-eslint/no-explicit-any': 'off', // Relaxed from 'warn'
    '@typescript-eslint/no-unused-vars': [
      'warn', // Relaxed from 'error'
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/prefer-readonly': 'warn', // Relaxed from 'error'
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off', // Relaxed from 'error'
    '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Relaxed from 'error'
    '@typescript-eslint/prefer-optional-chain': 'warn', // Relaxed from 'error'
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'off', // Allow async without await
    '@typescript-eslint/unbound-method': 'off', // Allow unbound methods
    '@typescript-eslint/no-namespace': 'off', // Allow namespaces
    '@typescript-eslint/no-redundant-type-constituents': 'off', // Allow any in union types
    '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Allow type assertions for clarity

    // Relaxed unsafe type checking rules
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',

    // General ESLint rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-case-declarations': 'off', // Allow lexical declarations in case blocks
    'no-useless-escape': 'off', // Allow escape characters in regex
    'no-control-regex': 'off', // Allow control characters in regex
    'object-shorthand': 'warn', // Relaxed from 'error'
    'prefer-arrow-callback': 'warn', // Relaxed from 'error'
    'prefer-template': 'warn', // Relaxed from 'error'
    'no-console': 'off', // Allow console for debugging

    // Prettier integration
    'prettier/prettier': 'warn', // Relaxed from 'error'
  },
  overrides: [
    {
      files: ['tests/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      },
    },
  ],
};