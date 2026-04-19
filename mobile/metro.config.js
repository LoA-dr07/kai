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
// Block both module-name and absolute-path forms on native.
const BLOCK_ON_NATIVE = [/[/\\]node_modules[/\\]whatwg-url[/\\]/, /[/\\]node_modules[/\\]@powersync[/\\]web[/\\]/];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isNative = platform === 'android' || platform === 'ios' || platform === 'native';
  if (isNative) {
    const isBlockedName =
      moduleName === '@powersync/web' ||
      moduleName.startsWith('@powersync/web/') ||
      moduleName === 'whatwg-url' ||
      moduleName.startsWith('whatwg-url/');
    const isBlockedPath = BLOCK_ON_NATIVE.some(re => re.test(moduleName));
    if (isBlockedName || isBlockedPath) {
      return { type: 'empty' };
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
