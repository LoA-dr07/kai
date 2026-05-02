const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// WASM support for @powersync/web
config.resolver.assetExts.push('wasm');

// ESM module support
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Enable package.json "exports" field resolution.
config.resolver.unstable_enablePackageExports = true;

// 'react-native' first, then ESM/CJS fallbacks.
// 'browser' is intentionally omitted: it causes @react-navigation and other
// packages to resolve their browser-specific builds on Android/iOS. Those
// builds bundle whatwg-url inline, whose URLStateMachine crashes on Hermes
// because TextDecoder is captured as undefined at module init time.
// The web build uses REST API hooks (*.web.ts) and doesn't rely on @powersync/web.
config.resolver.resolverMainFields = ['react-native', 'module', 'main'];

// Restrict exports-field conditions to native-safe ones only.
// Without this, Metro would still apply 'browser' condition from exports maps.
config.resolver.unstable_conditionNames = ['require', 'default', 'react-native'];

// Redirect whatwg-url to a Hermes-safe shim.
// whatwg-url's URLStateMachine creates a TextDecoder instance at module-init
// time with options that Hermes does not support, leaving utf8Decoder as
// undefined and crashing on the first .decode() call (e.g. when React
// Navigation's getStateFromPath parses a route URL).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'whatwg-url': path.resolve(__dirname, 'shims/whatwg-url.js'),
};

module.exports = config;
