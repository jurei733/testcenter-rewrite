// RFC 2152 UTF-7 is an XML encoding accepted by the Original's Debian/libxml
// runtime. It is deliberately separate from the legacy single-byte allowlist:
// replacement characters can be authored and permissive iconv decoding can
// silently discard incomplete shifts. Callers must require an XML declaration.
export const isUtf7XmlEncoding = (encoding: string): boolean =>
  ["utf-7", "utf7", "unicode-1-1-utf-7"].includes(encoding);

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const decodeUtf7XmlBytes = (bytes: Buffer): string | null => {
  const output: string[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const directStart = offset;
    const byte = bytes[offset++]!;
    if (byte !== 0x2b) {
      // Direct sets D/O and whitespace; backslash, tilde and non-ASCII must
      // be shifted. XML character validity is checked after byte decoding.
      let directByte = byte;
      while (true) {
        if (
          !(directByte === 9 || directByte === 10 || directByte === 13 ||
            (directByte >= 0x20 && directByte <= 0x7d && directByte !== 0x5c))
        ) {
          return null;
        }
        if (offset >= bytes.length || bytes[offset] === 0x2b) {
          break;
        }
        directByte = bytes[offset++]!;
      }
      output.push(bytes.toString("ascii", directStart, offset));
      continue;
    }
    if (bytes[offset] === 0x2d) {
      output.push("+");
      offset++;
      continue;
    }
    let bits = 0;
    let value = 0;
    let count = 0;
    let pendingHighSurrogate = false;
    while (offset < bytes.length) {
      const digit = alphabet.indexOf(String.fromCharCode(bytes[offset]!));
      if (digit < 0) {
        break;
      }
      offset++;
      count++;
      value = (value << 6) | digit;
      bits += 6;
      if (bits < 16) {
        continue;
      }
      bits -= 16;
      const unit = value >>> bits;
      value &= (1 << bits) - 1;
      if (pendingHighSurrogate) {
        if (unit < 0xdc00 || unit > 0xdfff) {
          return null;
        }
        pendingHighSurrogate = false;
      } else if (unit >= 0xd800 && unit <= 0xdbff) {
        pendingHighSurrogate = true;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        return null;
      }
      output.push(String.fromCharCode(unit));
    }
    // A shift contains complete UTF-16BE units and at most four zero padding
    // bits. Do not accept libxml variants that drop bare '+' or broken units.
    if (count === 0 || bits > 4 || value !== 0 || pendingHighSurrogate) {
      return null;
    }
    if (bytes[offset] === 0x2d) {
      offset++;
    }
    // Any other terminator remains a literal direct character (including '=').
  }
  return output.join("");
};
