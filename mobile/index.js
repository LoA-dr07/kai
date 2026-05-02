// Custom entry point – must be the very first code executed.

// ---------------------------------------------------------------------------
// 1. Patch TextDecoder – MUST run before any other require.
//
// whatwg-url's URLStateMachine (used by both whatwg-url v5 and
// whatwg-url-without-unicode v8) creates a module-level decoder:
//   new TextDecoder("utf-8", { fatal: false, ignoreBOM: false })
//
// Hermes's native TextDecoder does not support the 'ignoreBOM' option and
// throws a TypeError.  The throw is caught silently, leaving utf8Decoder as
// undefined.  The first call to utf8Decoder.decode() then crashes with:
//   [Fatal] Cannot read property 'decode' of undefined
//
// Fix: wrap the native TextDecoder so unsupported options are stripped before
// the native constructor is called.  All decoding is still delegated to the
// native implementation so behaviour is unchanged.
// ---------------------------------------------------------------------------
(function patchTextDecoder() {
  if (typeof globalThis.TextDecoder !== 'function') return;
  const Native = globalThis.TextDecoder;
  function SafeTextDecoder(encoding, options) {
    // Pass only 'fatal' – the only option Hermes reliably supports.
    // 'ignoreBOM' and others are silently dropped.
    const safeOpts = options ? { fatal: !!options.fatal } : undefined;
    try {
      this._d = new Native(encoding || 'utf-8', safeOpts);
    } catch (_) {
      this._d = new Native('utf-8');
    }
  }
  SafeTextDecoder.prototype.decode = function (input, opts) {
    return this._d.decode(input, opts);
  };
  Object.defineProperty(SafeTextDecoder.prototype, 'encoding', {
    get() { return this._d.encoding; },
  });
  Object.defineProperty(SafeTextDecoder.prototype, 'fatal', {
    get() { return this._d.fatal; },
  });
  Object.defineProperty(SafeTextDecoder.prototype, 'ignoreBOM', {
    get() { return false; },
  });
  global.TextDecoder = globalThis.TextDecoder = SafeTextDecoder;
}());

// ---------------------------------------------------------------------------
// 2. Ensure TextEncoder is on both global and globalThis (PowerSync needs it).
// ---------------------------------------------------------------------------
if (typeof global.TextEncoder !== 'function') {
  const existingEnc =
    (typeof globalThis !== 'undefined' && typeof globalThis.TextEncoder === 'function' && globalThis.TextEncoder) ||
    null;
  if (existingEnc) {
    global.TextEncoder = existingEnc;
  } else {
    const PolyfillEncoder = class TextEncoder {
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
    global.TextEncoder = globalThis.TextEncoder = PolyfillEncoder;
  }
}

// ---------------------------------------------------------------------------
// 3. react-native-url-polyfill patches global.URL with a URL implementation
//    that now works correctly because TextDecoder is fixed above.
// ---------------------------------------------------------------------------
require('react-native-url-polyfill/auto');

require('expo-router/entry');
