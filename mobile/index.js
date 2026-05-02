// Custom entry point – must be the very first code executed.
//
// 1. react-native-url-polyfill replaces whatwg-url with an implementation
//    that works in Hermes / React Native.  Without this, navigating to any
//    Stack screen (recipe detail, bulk-import, …) crashes with:
//    "Cannot read property 'decode' of undefined" inside URLStateMachine,
//    triggered by React Navigation's getStateFromPath → URL constructor.
require('react-native-url-polyfill/auto');

// 2. Ensure TextDecoder is available on both global and globalThis.
// Some PowerSync internals capture it from globalThis at class-init time.
if (typeof global.TextDecoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
  const existing =
    (typeof global.TextDecoder === 'function' && global.TextDecoder) ||
    (typeof globalThis !== 'undefined' && typeof globalThis.TextDecoder === 'function' && globalThis.TextDecoder) ||
    null;

  if (existing) {
    global.TextDecoder = existing;
    if (typeof globalThis !== 'undefined') globalThis.TextDecoder = existing;
  } else {
    // Minimal UTF-8 polyfill for environments that truly lack TextDecoder.
    const polyfillDecoder = class TextDecoder {
      decode(input) {
        if (!input) return '';
        const bytes =
          input instanceof Uint8Array
            ? input
            : new Uint8Array(
                input instanceof ArrayBuffer ? input : input.buffer ?? input
              );
        let out = '';
        let i = 0;
        while (i < bytes.length) {
          const b = bytes[i++];
          if (b < 0x80) {
            out += String.fromCharCode(b);
          } else if ((b & 0xe0) === 0xc0) {
            out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
          } else if ((b & 0xf0) === 0xe0) {
            const c1 = bytes[i++], c2 = bytes[i++];
            out += String.fromCharCode(((b & 0x0f) << 12) | ((c1 & 0x3f) << 6) | (c2 & 0x3f));
          } else {
            i += 3; // skip 4-byte sequences (surrogate pairs not needed here)
          }
        }
        return out;
      }
    };
    global.TextDecoder = polyfillDecoder;
    if (typeof globalThis !== 'undefined') globalThis.TextDecoder = polyfillDecoder;
  }
}

if (typeof global.TextEncoder === 'undefined' || typeof globalThis.TextEncoder === 'undefined') {
  const existingEnc =
    (typeof global.TextEncoder === 'function' && global.TextEncoder) ||
    (typeof globalThis !== 'undefined' && typeof globalThis.TextEncoder === 'function' && globalThis.TextEncoder) ||
    null;

  if (existingEnc) {
    global.TextEncoder = existingEnc;
    if (typeof globalThis !== 'undefined') globalThis.TextEncoder = existingEnc;
  } else {
    const polyfillEncoder = class TextEncoder {
      encode(str) {
        const out = [];
        for (let i = 0; i < str.length; i++) {
          const c = str.charCodeAt(i);
          if (c < 0x80) {
            out.push(c);
          } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
          } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
          }
        }
        return new Uint8Array(out);
      }
    };
    global.TextEncoder = polyfillEncoder;
    if (typeof globalThis !== 'undefined') globalThis.TextEncoder = polyfillEncoder;
  }
}

require('expo-router/entry');
