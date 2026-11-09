/** Preserve the persisted-source decoder's whitespace, URL alphabet and
 * noncanonical padding rules without scanning large files in a JS regexp. */
export function decodeSourceBase64(input: string): Buffer | null {
  const value = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (value.length % 4 === 1 || Buffer.byteLength(value, "utf8") !== value.length) return null;

  let characters = value.length;
  if (value.charCodeAt(characters - 1) === 61) characters--;
  if (value.charCodeAt(characters - 1) === 61) characters--;
  const padding = value.indexOf("=");
  if (padding !== -1 && padding !== characters) return null;

  // The native decoder ignores invalid ASCII and can alias non-ASCII code
  // units, hence the ASCII check above. Only a dangling sextet can hide a
  // skipped character without shortening the output. Complete that case;
  // normal padded/unpadded inputs need no extra copy of the encoded file.
  const dangling = characters % 4 === 1;
  const complete = dangling ? value.slice(0, characters) + "AAA" : value;
  const bytes = Buffer.from(complete, "base64");
  const length = Math.floor(characters * 3 / 4);
  if (bytes.length !== length + (dangling ? 3 : 0)) return null;
  return dangling ? bytes.subarray(0, length) : bytes;
}
