// Minimal punycode shim (RFC 3492) used to keep the MongoDB driver bundleable.
import * as puny from "punycode/punycode.es6.js";

export const ucs2 = (puny as any).ucs2;
export const decode = (puny as any).decode;
export const encode = (puny as any).encode;
export const toASCII = (puny as any).toASCII;
export const toUnicode = (puny as any).toUnicode;
export const version = (puny as any).version;
export default { ucs2, decode, encode, toASCII, toUnicode, version };
