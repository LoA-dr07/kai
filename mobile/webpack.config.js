const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Required for @powersync/web: allow WebAssembly modules
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
  };

  // Allow @powersync/web worker files to be bundled correctly
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  });

  return config;
};
