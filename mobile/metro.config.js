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

// Keep 'react-native' first so native packages resolve to their TS source
// (not compiled lib/module/ output) – required for the RN codegen to work.
// 'browser' follows for web-compatible fallbacks (@powersync/web etc.)
config.resolver.resolverMainFields = ['react-native', 'browser', 'module', 'main'];

// @powersync/web bundles whatwg-url which overrides globalThis.URL with a
// broken implementation on Android/iOS (TextDecoder incompatibility in Hermes).
// Block it on native – native builds use @powersync/react-native instead.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (platform === 'android' || platform === 'ios') &&
    (moduleName === '@powersync/web' ||
      moduleName.startsWith('@powersync/web/') ||
      moduleName === 'whatwg-url' ||
      moduleName.startsWith('whatwg-url/'))
  ) {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
