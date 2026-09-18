module.exports = {
  root: true,
  extends: [
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Editor-side feedback for the same thing `npm run check:tokens` gates in
    // CI. Warnings here, because the lint job is informational; the script is
    // what actually fails the build.
    'no-restricted-syntax': [
      'warn',
      {
        selector: "Property[key.name='fontSize'][value.type='Literal'][value.raw=/^[0-9]/]",
        message: 'Use a typography role (…typography.bodySm) rather than a literal fontSize.',
      },
      {
        selector: "Property[key.name='fontWeight'][value.type='Literal']",
        message: 'Use a typography role, or typography.<role>.fontWeight, rather than a literal.',
      },
      {
        selector: "Property[key.name='fontFamily'][value.type='Literal']",
        message: 'Use typography.fontFamily — it is the one place a typeface is named.',
      },
      {
        selector: "Literal[value=/^#[0-9A-Fa-f]{3,8}$/]",
        message: 'Use a colour token from src/theme/theme.ts rather than a hex literal.',
      },
    ],
  },
};
