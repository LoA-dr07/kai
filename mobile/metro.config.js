const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WASM support for @powersync/web
config.resolver.assetExts.push('wasm');

// ESM module support
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Respect package.json "exports" field – lets @powersync/web resolve its
// browser-specific build instead of the Node.js/CommonJS build
config.resolver.unstable_enablePackageExports = true;

// Prefer browser-compatible builds
config.resolver.resolverMainFields = ['browser', 'module', 'main'];

module.exports = config;
