export const attachmentStorageId = (testRunId: string, unitName: string, variableId: string): string =>
  'att-' + Buffer.from(JSON.stringify([testRunId, unitName, variableId]), 'utf8').toString('base64url');

export function readAttachmentStorageId(attachmentId: string): [string, string, string] | null {
  if (!/^att-[A-Za-z0-9_-]+$/.test(attachmentId)) return null;
  try {
    const encoded = attachmentId.slice(4);
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) return null;
    const tuple: unknown = JSON.parse(bytes.toString('utf8'));
    return Array.isArray(tuple) && tuple.length === 3 && tuple.every(value => typeof value === 'string') && tuple[0].length
      ? [tuple[0], tuple[1], tuple[2]] : null;
  } catch {
    return null;
  }
}

/** Only complete base64 quanta are included. Always verify the full decoded
 * storage identity after this candidate query. */
export function attachmentStorageRunPrefix(testRunId: string): string {
  const prefix = Buffer.from(JSON.stringify([testRunId]).slice(0, -1) + ',', 'utf8');
  return 'att-' + prefix.subarray(0, prefix.length - prefix.length % 3).toString('base64url');
}

export function groupAttachmentStorageRunPrefixes(testRunIds: readonly string[]): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const prefix of new Set(testRunIds.map(attachmentStorageRunPrefix))) {
    const prefixes = groups.get(prefix.length) ?? [];
    prefixes.push(prefix);
    groups.set(prefix.length, prefixes);
  }
  return groups;
}
