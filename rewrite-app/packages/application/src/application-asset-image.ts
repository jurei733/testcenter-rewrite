type BitmapMediaType = 'image/png' | 'image/jpeg' | 'image/webp';

/** Source uses fileinfo and getimagesize, rather than the client's MIME label.
 * Read only their bounded header surface; this is not whole-image decoding.
 * The actual PHP/HTTP counterexamples are pinned in native-application-asset-image-http.
 */
export function applicationAssetImageType(bytes: Buffer): BitmapMediaType | null {
  if (bytes.length >= 25 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.readUInt32BE(8) === 13 && bytes.toString('latin1', 12, 16) === 'IHDR') return 'image/png';
  if (bytes.length >= 30 && bytes.toString('latin1', 0, 4) === 'RIFF' &&
      bytes.toString('latin1', 8, 12) === 'WEBP' && bytes.toString('latin1', 12, 15) === 'VP8' &&
      [0x20, 0x4c, 0x58].includes(bytes[15]!)) return 'image/webp';
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let offset = 3;
  const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset === bytes.length) return null;
    const marker = bytes[offset++]!;
    // Source's header reader acknowledges the first SOF even if later fields
    // are truncated or dimensions are zero. Do not substitute a full decoder.
    if (frames.has(marker)) return 'image/jpeg';
    if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2) return null;
    offset += length;
    while (offset < bytes.length && bytes[offset] !== 0xff) offset++;
    offset++;
  }
  return null;
}
