const { getDefaultConfig } = require('expo/metro-config');

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

module.exports = config;
