module.exports = {
  preset: 'react-native',
  // The react-native preset's transformIgnorePatterns only whitelists
  // react-native and @react-native*. Redux Toolkit ships ESM (and pulls immer,
  // which ships `export {` in its legacy-esm build), so requiring it from a
  // test dies on "Unexpected token 'export'". Slice tests need it, so let Babel
  // transform those two alongside the RN packages.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|redux|reselect)/)',
  ],
};
