module.exports = function (api) {
  const isWeb = api.caller(caller => caller?.platform === 'web');
  api.cache.using(() => isWeb);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-worklets/plugin',
      // only needed on web: transforms import.meta for @powersync/web in Metro
      ...(isWeb ? ['babel-plugin-transform-import-meta'] : []),
    ],
  };
};
