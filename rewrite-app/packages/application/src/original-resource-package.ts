import type {SourcePackage} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';

type Entry = {fileName: string; uncompressedSize: number};
const archiveLimit = 64 * 1024 * 1024;
const memberLimit = 20 * 1024 * 1024;
const expandedLimit = 256 * 1024 * 1024;
const entryLimit = 10_000;

// Source ResourceFile uses PHP basename($name, '.itcr.zip'): suffix removal
// is case-sensitive even though package recognition is case-insensitive.
export function originalResourcePackagePrefix(fileName: string): string {
  return fileName.endsWith('.itcr.zip') ? fileName.slice(0, -'.itcr.zip'.length) : fileName;
}

/** Keep the immutable archive, never extracted filesystem paths. A cache hit
 * does not select a publication: callers must resolve the current scoped file. */
export function createOriginalResourcePackages<E extends Entry>(deps: {
  decode: (source: SourcePackage) => {bytes: Uint8Array} | null;
  entries: (bytes: Buffer, maximumEntries: number) => E[] | null;
  read: (bytes: Buffer, entry: E, maximumBytes: number) => Buffer | null;
  safe: (path: string, directory: boolean) => boolean;
  normalize: (path: string) => string;
}) {
  const cache = new Map<string, {document: string; bytes: Buffer; members: Map<string, E>}>();
  let retainedBytes = 0;
  const invalid = () => new FirstSliceError(400, 'workspace_resource_package_invalid',
    'The resource archive is invalid.');
  const oversized = () => new FirstSliceError(413, 'workspace_resource_package_too_large',
    'The resource archive exceeds its bounded archive, member, entry or expanded-size limit.');
  const open = (source: SourcePackage) => {
    if (!/\.itcr\.zip$/i.test(source.fileName) || source.sourceDocument === null ||
        !originalResourcePackagePrefix(source.fileName).split('/').at(-1)) throw invalid();
    const key = JSON.stringify([source.tenantId, source.workspaceId, source.sourcePackageId]);
    const cached = cache.get(key);
    if (cached?.document === source.sourceDocument) {
      cache.delete(key); cache.set(key, cached); return cached;
    }
    const decoded = deps.decode(source);
    if (!decoded) throw invalid();
    if (decoded.bytes.byteLength > archiveLimit) throw oversized();
    const bytes = Buffer.from(decoded.bytes);
    const entries = deps.entries(bytes, entryLimit);
    if (!entries) throw invalid();
    if (entries.length > entryLimit) throw oversized();
    const members = new Map<string, E>(), identities = new Set<string>(), directories = new Set<string>();
    let expandedBytes = 0;
    for (const entry of entries) {
      const directory = entry.fileName.endsWith('/');
      if (!deps.safe(entry.fileName, directory)) throw invalid();
      const path = deps.normalize(entry.fileName), identity = path.toLowerCase();
      if (identities.has(identity)) throw invalid();
      identities.add(identity);
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) throw invalid();
      expandedBytes += entry.uncompressedSize;
      if (entry.uncompressedSize > memberLimit || expandedBytes > expandedLimit) throw oversized();
      if (directory) directories.add(path); else members.set(path, entry);
    }
    for (const path of [...members.keys(), ...directories]) {
      const parts = path.split('/');
      for (let index = 1; index < parts.length; index++) {
        if (members.has(parts.slice(0, index).join('/'))) throw invalid();
      }
    }
    // Finish the metadata budget/path preflight before inflating any member.
    // Then check every local header, method, exact size and CRC before any
    // publication; a bad later member cannot install a prefix.
    for (const entry of entries) {
      if (!deps.read(bytes, entry, entry.fileName.endsWith('/') ? 0 : memberLimit)) throw invalid();
    }
    const archive = {document: source.sourceDocument, bytes, members};
    if (cached) {retainedBytes -= cached.bytes.length; cache.delete(key);}
    cache.set(key, archive); retainedBytes += bytes.length;
    while (cache.size > 8 || retainedBytes > archiveLimit) {
      const oldest = cache.keys().next().value!;
      retainedBytes -= cache.get(oldest)!.bytes.length; cache.delete(oldest);
    }
    return archive;
  };
  return {
    validate(source: SourcePackage): void {open(source);},
    read(source: SourcePackage, path: string): Buffer | null {
      const archive = open(source), entry = archive.members.get(path);
      if (!entry) return null;
      const bytes = deps.read(archive.bytes, entry, memberLimit);
      // Stored ZIP entries may be a view into the cached immutable archive.
      return bytes === null ? null : Buffer.from(bytes);
    }
  };
}
