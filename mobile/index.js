// Custom entry point – must be the very first code executed.
//
// Some packages (e.g. whatwg-url, bundled by @react-navigation and others)
// capture `TextDecoder` / `TextEncoder` as a top-level variable at module
// init time.  On Hermes these globals live on `globalThis` but are sometimes
// absent from `global`, so the captured value ends up as `undefined`.
// Setting them here – before any other require – ensures every downstream
// module gets a valid reference.

if (typeof global.TextDecoder === 'undefined') {
  if (typeof globalThis !== 'undefined' && typeof globalThis.TextDecoder === 'function') {
    global.TextDecoder = globalThis.TextDecoder;
  } else {
    // Minimal UTF-8 polyfill for environments that truly lack TextDecoder.
    global.TextDecoder = class TextDecoder {
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
  }
}

if (typeof global.TextEncoder === 'undefined') {
  if (typeof globalThis !== 'undefined' && typeof globalThis.TextEncoder === 'function') {
    global.TextEncoder = globalThis.TextEncoder;
  } else {
    global.TextEncoder = class TextEncoder {
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
  }
}

require('expo-router/entry');
