import {crc32, deflateRawSync} from 'node:zlib';

/** Independent ZIP writer for HTTP/browser and malformed-container probes. */
export function workspaceZip(entries, {deflate = false, zip64 = false} = {}) {
  const local = [], central = [];
  let offset = 0;
  for (const item of entries) {
    const [path, value, options = {}] = item;
    const name = options.nameBytes ?? Buffer.from(path);
    const bytes = Buffer.from(value);
    const compressed = deflate ? deflateRawSync(bytes) : bytes;
    const size = options.uncompressedSize ?? bytes.length;
    const checksum = options.checksum ?? crc32(bytes);
    const flags = options.flags ?? 0x800;
    const extra = zip64 ? Buffer.alloc(20) : Buffer.alloc(0);
    const directoryExtra = zip64 ? Buffer.alloc(28) : Buffer.alloc(0);
    if (zip64) {
      extra.writeUInt16LE(1); extra.writeUInt16LE(16, 2);
      extra.writeBigUInt64LE(BigInt(size), 4);
      extra.writeBigUInt64LE(BigInt(compressed.length), 12);
      directoryExtra.writeUInt16LE(1); directoryExtra.writeUInt16LE(24, 2);
      directoryExtra.writeBigUInt64LE(BigInt(size), 4);
      directoryExtra.writeBigUInt64LE(BigInt(compressed.length), 12);
      directoryExtra.writeBigUInt64LE(BigInt(offset), 20);
    }
    const head = Buffer.alloc(30), directory = Buffer.alloc(46);
    head.writeUInt32LE(0x04034b50); head.writeUInt16LE(zip64 ? 45 : 20, 4);
    head.writeUInt16LE(flags, 6); head.writeUInt16LE(deflate ? 8 : 0, 8);
    head.writeUInt16LE(options.dosTime ?? 0, 10); head.writeUInt16LE(options.dosDate ?? 0, 12);
    head.writeUInt32LE(checksum, 14);
    head.writeUInt32LE(zip64 ? 0xffffffff : compressed.length, 18);
    head.writeUInt32LE(zip64 ? 0xffffffff : size, 22);
    head.writeUInt16LE(name.length, 26); head.writeUInt16LE(extra.length, 28);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(zip64 ? 45 : 20, 6); directory.writeUInt16LE(flags, 8);
    directory.writeUInt16LE(deflate ? 8 : 0, 10);
    directory.writeUInt16LE(options.dosTime ?? 0, 12); directory.writeUInt16LE(options.dosDate ?? 0, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(zip64 ? 0xffffffff : compressed.length, 20);
    directory.writeUInt32LE(zip64 ? 0xffffffff : size, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt16LE(directoryExtra.length, 30);
    directory.writeUInt32LE(zip64 ? 0xffffffff : offset, 42);
    local.push(head, name, extra, compressed); central.push(directory, name, directoryExtra);
    offset += head.length + name.length + extra.length + compressed.length;
  }
  const table = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(zip64 ? 0xffff : entries.length, 8);
  end.writeUInt16LE(zip64 ? 0xffff : entries.length, 10);
  end.writeUInt32LE(zip64 ? 0xffffffff : table.length, 12);
  end.writeUInt32LE(zip64 ? 0xffffffff : offset, 16);
  const trailer = [];
  if (zip64) {
    const record = Buffer.alloc(56), locator = Buffer.alloc(20);
    record.writeUInt32LE(0x06064b50); record.writeBigUInt64LE(44n, 4);
    record.writeUInt16LE(45, 12); record.writeUInt16LE(45, 14);
    record.writeBigUInt64LE(BigInt(entries.length), 24);
    record.writeBigUInt64LE(BigInt(entries.length), 32);
    record.writeBigUInt64LE(BigInt(table.length), 40); record.writeBigUInt64LE(BigInt(offset), 48);
    locator.writeUInt32LE(0x07064b50); locator.writeBigUInt64LE(BigInt(offset + table.length), 8);
    locator.writeUInt32LE(1, 16); trailer.push(record, locator);
  }
  return Buffer.concat([...local, table, ...trailer, end]);
}
