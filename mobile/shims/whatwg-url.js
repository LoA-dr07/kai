// Redirect whatwg-url to the Hermes-safe polyfill.
// whatwg-url's URLStateMachine creates a TextDecoder instance at module-init
// time with options (fatal, ignoreBOM) that Hermes's native TextDecoder does
// not support, leaving utf8Decoder as undefined. Any subsequent .decode() call
// then crashes with "Cannot read property 'decode' of undefined".
// react-native-url-polyfill provides a TextDecoder-free URL implementation.
const { URL, URLSearchParams } = require('react-native-url-polyfill');
module.exports = { URL, URLSearchParams };
