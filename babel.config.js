module.exports = function (api) {
  api.cache(true);
  return {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
          '@screens': './src/screens',
          '@components': './src/components',
          '@custom': './src/Custom-Components',
          '@store': './src/store',
          '@networks': './src/networks',
          '@models': './src/models',
          '@serializers': './src/serializers',
          '@hooks': './src/hooks',
          '@theme': './src/theme',
          '@utils': './src/utils',
          '@navigators': './src/navigators',
          '@assets': './assets',
        },
      },
    ],
    'react-native-reanimated/plugin', // MUST be last plugin
  ],
};
};
