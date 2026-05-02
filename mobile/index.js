// Custom entry point – must be the very first code executed.

// ---------------------------------------------------------------------------
// 1. Provide URL / URLSearchParams globally.
//
// Both whatwg-url v5 (node-fetch) and whatwg-url-without-unicode v8
// (react-native-url-polyfill) crash on Hermes because their internal decoders
// (TextDecoder or npm-buffer based) fail to initialise.  react-native-url-
// polyfill/auto makes it worse by replacing global.URL with an equally broken
// implementation.
//
// Solution: use our own pure-JS URL shim (shims/whatwg-url.js) as global.URL.
// It uses only built-in string ops, no TextDecoder, no Buffer.
// ---------------------------------------------------------------------------
const { URL: _URL, URLSearchParams: _USP } = require('./shims/whatwg-url');
global.URL            = _URL;
globalThis.URL        = _URL;
global.URLSearchParams   = _USP;
globalThis.URLSearchParams = _USP;

// ---------------------------------------------------------------------------
// 2. Ensure TextEncoder is available on both global and globalThis.
//    (Some PowerSync internals capture it at class-init time.)
// ---------------------------------------------------------------------------
if (typeof global.TextEncoder !== 'function') {
  const existing =
    (typeof globalThis !== 'undefined' && typeof globalThis.TextEncoder === 'function' && globalThis.TextEncoder) ||
    null;
  if (existing) {
    global.TextEncoder = existing;
  } else {
    global.TextEncoder = globalThis.TextEncoder = class TextEncoder {
      encode(str) {
        const out = [];
        for (let i = 0; i < str.length; i++) {
          const c = str.charCodeAt(i);
          if (c < 0x80) out.push(c);
          else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
          else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
        return new Uint8Array(out);
      }
    };
  }
}

require('expo-router/entry');
