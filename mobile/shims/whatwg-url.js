// Minimal URL / URLSearchParams for React Native / Hermes.
//
// Both whatwg-url v5 (via node-fetch) and whatwg-url-without-unicode v8
// (via react-native-url-polyfill) crash on Hermes with:
//   "Cannot read property 'decode' of undefined"
// because their internal decoders (TextDecoder or Buffer-based) fail to
// initialise in the Hermes / Metro environment.
//
// This shim uses only built-in JS string operations — no TextDecoder, no
// Buffer, no external deps — and covers all cases React Navigation needs.

function _decode(s) {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (_) { return s; }
}
function _encode(s) {
  try { return encodeURIComponent(String(s)); } catch (_) { return String(s); }
}

class URLSearchParams {
  constructor(init) {
    this._p = [];
    const str =
      init == null ? '' :
      typeof init === 'string' ? init.replace(/^\?/, '') :
      String(init);
    if (!str) return;
    for (const part of str.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq < 0) this._p.push([_decode(part), '']);
      else this._p.push([_decode(part.slice(0, eq)), _decode(part.slice(eq + 1))]);
    }
  }
  get(k)       { const p = this._p.find(([x]) => x === k); return p ? p[1] : null; }
  getAll(k)    { return this._p.filter(([x]) => x === k).map(([, v]) => v); }
  has(k)       { return this._p.some(([x]) => x === k); }
  set(k, v)    { const i = this._p.findIndex(([x]) => x === k); i < 0 ? this._p.push([k, String(v)]) : (this._p[i] = [k, String(v)]); }
  append(k, v) { this._p.push([k, String(v)]); }
  delete(k)    { this._p = this._p.filter(([x]) => x !== k); }
  toString()   { return this._p.map(([k, v]) => v !== '' ? _encode(k) + '=' + _encode(v) : _encode(k)).join('&'); }
  forEach(fn)  { this._p.forEach(([k, v]) => fn(v, k, this)); }
  entries()    { return this._p.map(([k, v]) => [k, v])[Symbol.iterator](); }
  keys()       { return this._p.map(([k]) => k)[Symbol.iterator](); }
  values()     { return this._p.map(([, v]) => v)[Symbol.iterator](); }
  [Symbol.iterator]() { return this.entries(); }
  get size()   { return this._p.length; }
}

class URL {
  constructor(input, base) {
    let full = String(input);

    // Resolve relative URL against base
    if (base != null) {
      const b = base instanceof URL ? base : new URL(String(base));
      if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(full)) {
        if (full.startsWith('//')) {
          full = b.protocol + full;
        } else if (full.startsWith('/')) {
          full = b.protocol + '//' + b.host + full;
        } else if (full.startsWith('?')) {
          full = b.protocol + '//' + b.host + b.pathname + full;
        } else if (full.startsWith('#')) {
          full = b.protocol + '//' + b.host + b.pathname + b.search + full;
        } else {
          const dir = b.pathname.replace(/\/[^/]*$/, '/');
          full = b.protocol + '//' + b.host + dir + full;
        }
      }
    }

    // Protocol
    const protoMatch = full.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*:)(\/\/)?/);
    this.protocol = protoMatch ? protoMatch[1].toLowerCase() : '';
    let rest = protoMatch ? full.slice(protoMatch[0].length) : full;

    // Hash
    const hashIdx = rest.indexOf('#');
    this.hash = hashIdx >= 0 ? rest.slice(hashIdx) : '';
    if (hashIdx >= 0) rest = rest.slice(0, hashIdx);

    // Search
    const qIdx = rest.indexOf('?');
    this.search = qIdx >= 0 ? rest.slice(qIdx) : '';
    if (qIdx >= 0) rest = rest.slice(0, qIdx);

    // Host vs pathname
    if (protoMatch && protoMatch[2]) {
      const slashIdx = rest.indexOf('/');
      if (slashIdx < 0) {
        this.host = rest;
        this.pathname = '/';
        rest = '';
      } else {
        this.host = rest.slice(0, slashIdx);
        this.pathname = rest.slice(slashIdx);
      }
    } else {
      this.host = '';
      this.pathname = rest;
    }

    // Hostname / port
    const portIdx = this.host.lastIndexOf(':');
    if (portIdx >= 0 && /^\d+$/.test(this.host.slice(portIdx + 1))) {
      this.hostname = this.host.slice(0, portIdx);
      this.port = this.host.slice(portIdx + 1);
    } else {
      this.hostname = this.host;
      this.port = '';
    }

    this.origin = this.protocol ? this.protocol + '//' + this.host : 'null';
    this.username = '';
    this.password = '';
    this.searchParams = new URLSearchParams(this.search);
    this.href = this.protocol
      ? this.protocol + '//' + this.host + this.pathname + this.search + this.hash
      : this.pathname + this.search + this.hash;
  }

  toString() { return this.href; }
  toJSON()   { return this.href; }
}

module.exports = { URL, URLSearchParams };
