import { DOMParser, type Element } from '@xmldom/xmldom';
import type { SourcePackage, WorkspaceActivityEvent, SourcePackageStatus, WorkspaceFileType, WorkspaceFileReference,
  WorkspaceCatalogFile, WorkspaceFileCatalog } from '@testcenter-rewrite-app/domain';

export type WorkspaceCatalogInput = {
  sourcePackageId: string;
  fileName: string;
  fileType: WorkspaceFileType;
  status: SourcePackageStatus;
  uploadedAt: string;
  fileSizeBytes: number | null;
  sourceText: string | null;
  resourceIdentifier: string | null;
};

export function normalizeWorkspacePlayerResourceId(reference: string): string | null {
  const baseName = reference.split(/[\\/]/).at(-1) ?? reference;
  const stem = baseName.replace(/\.html?$/i, '');
  const versioned = /^(.+?)[@-](\d+)\.(\d+)(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/.exec(stem);
  return versioned?.[1] ? `${versioned[1]}-${Number.parseInt(versioned[2]!, 10)}.${Number.parseInt(versioned[3]!, 10)}` : null;
}

export function selectCurrentWorkspaceFiles(sourcePackages: SourcePackage[], activityEvents: WorkspaceActivityEvent[]): SourcePackage[] {
  const byId = new Map(sourcePackages.map(source => [source.sourcePackageId, source]));
  const generated = new Set<string>(), replaced = new Set<string>();
  for (const event of activityEvents) {
    if (event.eventType === 'source_package_assembled') generated.add(event.subjectId);
    if (event.eventType !== 'source_package_replaced') continue;
    const replacement = typeof event.details.replacementSourcePackageId === 'string'
      ? byId.get(event.details.replacementSourcePackageId) : undefined;
    if (replacement && replacement.status !== 'rejected') replaced.add(event.subjectId);
  }
  return sourcePackages.filter(source => !generated.has(source.sourcePackageId) && !replaced.has(source.sourcePackageId));
}
const children = (node: Element | undefined, name: string): Element[] => {
  const result: Element[] = [];
  for (let child = node?.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1 && (child as Element).tagName === name) result.push(child as Element);
  }
  return result;
};
const text = (node: Element | undefined): string => node?.textContent ?? '';
const first = (node: Element | undefined, name: string): Element | undefined => children(node, name)[0];
// Pinned Source uses PHP strtoupper/trim for IDs. UTF-8 non-ASCII letters do
// not change case there; JavaScript's full Unicode uppercase would change IDs.
const sourceUpper = (value: string): string => value.replace(/[a-z]/g, letter => letter.toUpperCase());
const sourceId = (value: string): string => sourceUpper(value).replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '');
const translated = (value: unknown): string => {
  if (Array.isArray(value)) {
    const rows = value.filter(row => row && typeof row === 'object' && typeof row.value === 'string');
    return (rows.find(row => row.lang === 'de') ?? rows.find(row => row.lang === 'en') ?? rows[0])?.value ?? '';
  }
  if (value && typeof value === 'object') {
    const values = value as Record<string, unknown>;
    const chosen = values.de ?? values.en ?? Object.values(values)[0];
    return typeof chosen === 'string' ? chosen : '';
  }
  return '';
};

function inspect(input: WorkspaceCatalogInput): {
  metadata: WorkspaceCatalogFile['metadata']; references: WorkspaceFileReference[];
} {
  const metadata: WorkspaceCatalogFile['metadata'] = {
    identifier: sourceUpper(input.resourceIdentifier ?? input.fileName.split(/[\\/]/).at(-1) ?? input.fileName),
    label: '', description: '', participantCount: null, veronaVersion: null, moduleVersion: null
  };
  const references: WorkspaceFileReference[] = [];
  if (input.sourceText === null || input.fileType === 'Package') return { metadata, references };
  if (input.fileType === 'Resource') {
    if (!/\.html$/i.test(input.fileName)) return {metadata, references};
    // HTML is data here: no document/window, script execution or URL fetching.
    // The established Player validator supplies the normalized resource ID.
    let document;
    try { document = new DOMParser({ onError() {} }).parseFromString(input.sourceText, 'text/html'); }
    catch { return { metadata, references }; }
    const scripts = document.getElementsByTagName('script');
    let jsonLd: string | undefined;
    for (let i = 0; i < scripts.length; i++) if (scripts.item(i)?.getAttribute('type') === 'application/ld+json') {
      jsonLd = scripts.item(i)?.textContent ?? ''; break;
    }
    let knownMetadata = false;
    if (jsonLd) {
      try {
        const value = JSON.parse(jsonLd);
        if (value && typeof value === 'object' && !Array.isArray(value) &&
          (value.$schema === 'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json' ||
           value['@context'] === 'https://w3id.org/iqb/verona-modules')) {
          knownMetadata = true;
          metadata.label = translated(value.name);
          metadata.description = translated(value.description);
          metadata.moduleVersion = typeof value.version === 'string' ? value.version : null;
          metadata.veronaVersion = typeof value.specVersion === 'string' ? value.specVersion
            : typeof value.apiVersion === 'string' ? value.apiVersion : null;
          const id = typeof value.id === 'string' ? value.id : typeof value['@id'] === 'string' ? value['@id'] : '';
          if (!metadata.label && id) metadata.label = id + (metadata.moduleVersion ? '-' + metadata.moduleVersion : '');
        }
      } catch { /* Invalid metadata remains the responsibility of real import validation. */ }
    }
    if (!knownMetadata) {
      const tags = document.getElementsByTagName('meta');
      for (let i = 0; i < tags.length; i++) {
        const tag = tags.item(i);
        if (tag?.getAttribute('name') !== 'application-name') continue;
        metadata.label = document.getElementsByTagName('title').item(0)?.textContent ?? '';
        metadata.description = tag.getAttribute('data-description') ?? '';
        metadata.moduleVersion = tag.getAttribute('data-version') || null;
        metadata.veronaVersion = tag.getAttribute('data-api-version') || null;
        if (!metadata.label) metadata.label = (tag.getAttribute('content') ?? '') +
          (metadata.moduleVersion ? '-' + metadata.moduleVersion : '');
        break;
      }
    }
    return { metadata, references };
  }
  // External entity declarations never enter the metadata parser. Rejected or
  // malformed XML stays listable without exposing any raw document or secrets.
  if (/<!DOCTYPE\b/i.test(input.sourceText)) return { metadata, references };
  let invalid = false, root: Element | null = null;
  try {
    root = new DOMParser({ onError() { invalid = true; } })
      .parseFromString(input.sourceText, 'application/xml')?.documentElement;
  } catch { return { metadata, references }; }
  if (invalid || !root || root.tagName !== input.fileType) return { metadata, references };
  const header = first(root, 'Metadata');
  const identifier = text(first(header, 'Id'));
  if (identifier && identifier !== '0') metadata.identifier = sourceId(identifier);
  metadata.label = text(first(header, 'Label'));
  metadata.description = text(first(header, 'Description'));
  const add = (reference: string, fileType: WorkspaceFileType, relationship: WorkspaceFileReference['relationship']) => {
    const value = reference.trim();
    if (value && !references.some(item => item.reference === value && item.fileType === fileType && item.relationship === relationship)) {
      references.push({ reference: value, fileType, relationship });
    }
  };
  if (input.fileType === 'Testtakers') {
    const logins = children(root, 'Group').flatMap(group => children(group, 'Login')).filter(login => login.hasAttribute('name'));
    metadata.participantCount = logins.length;
    for (const login of logins) for (const booklet of children(login, 'Booklet')) {
      // Source TestName separates authored State parameters with '#'. Codes
      // belong to the Login and never enter catalog output.
      add(text(booklet).replace(/\s/g, '').split('#', 1)[0]!, 'Booklet', 'hasBooklet');
    }
  } else if (input.fileType === 'Booklet') {
    const units = first(root, 'Units');
    const descendants = units?.getElementsByTagName('Unit');
    for (let index = 0; index < (descendants?.length ?? 0); index++) {
      add(descendants!.item(index)?.getAttribute('id') ?? '', 'Unit', 'containsUnit');
    }
  } else if (input.fileType === 'SysCheck') {
    add(first(root, 'Config')?.getAttribute('unit') ?? '', 'Unit', 'containsUnit');
  } else if (input.fileType === 'Unit') {
    const definition = first(root, 'Definition') ?? first(root, 'DefinitionRef');
    const rawPlayer = definition?.getAttribute('player') || definition?.getAttribute('type') || '';
    add(normalizeWorkspacePlayerResourceId(rawPlayer) ?? rawPlayer, 'Resource', 'usesPlayer');
    add(text(first(root, 'DefinitionRef')), 'Resource', 'isDefinedBy');
    add(text(first(root, 'CodingSchemeRef')), 'Resource', 'usesScheme');
    const dependencies = first(root, 'Dependencies');
    for (const name of ['File', 'file']) for (const dependency of children(dependencies, name)) {
      if (!dependency.hasAttribute('for') || dependency.getAttribute('for') === 'player') {
        add(text(dependency), 'Resource', 'usesPlayerResource');
      }
    }
  }
  return { metadata, references };
}

/** Lightweight complete current-file read model. Import status and validation
 * are not rewritten by this projection. Unresolved/ambiguous edges stay explicit.
 */
export function buildWorkspaceFileCatalog(inputs: WorkspaceCatalogInput[]): WorkspaceFileCatalog {
  const inspected = inputs.map(input => ({ input, ...inspect(input) }));
  const index = new Map<string, Set<number>>();
  const key = (type: WorkspaceFileType, value: string) => JSON.stringify([type, sourceUpper(value)]);
  for (const [at, item] of inspected.entries()) {
    // Source references XML files by Metadata/Id and HTML Players by their
    // normalized module/version ID. A different filename is not a second ID.
    for (const value of [item.metadata.identifier]) {
      const id = key(item.input.fileType, value);
      const values = index.get(id) ?? new Set<number>(); values.add(at); index.set(id, values);
    }
  }
  const dependencySizesCalculated = inputs.length <= 1000;
  const items: WorkspaceCatalogFile[] = inspected.map(({ input, metadata, references }) => ({
    sourcePackageId: input.sourcePackageId, fileName: input.fileName, fileType: input.fileType,
    status: input.status, uploadedAt: input.uploadedAt, fileSizeBytes: input.fileSizeBytes,
    metadata, dependencies: [], unresolvedReferences: references.flatMap(reference => {
      const candidates = [...(index.get(key(reference.fileType, reference.reference)) ?? [])];
      return candidates.length === 1 ? [] : [{ ...reference,
        candidateSourcePackageIds: candidates.map(at => inputs[at]!.sourcePackageId) }];
    }), totalSizeBytes: null
  }));
  const direct = inspected.map(({ references }) => references.flatMap(reference => {
    const candidates = [...(index.get(key(reference.fileType, reference.reference)) ?? [])];
    if (candidates.length !== 1) return [];
    const item = inputs[candidates[0]!]!;
    return [{ sourcePackageId: item.sourcePackageId, fileName: item.fileName, relationship: reference.relationship }];
  }));
  const position = new Map(inputs.map((item, at) => [item.sourcePackageId, at]));
  if (dependencySizesCalculated) for (const [at, item] of items.entries()) {
    const found = new Map<string, WorkspaceCatalogFile['dependencies'][number]>();
    const pending = [...direct[at]!];
    for (let cursor = 0; cursor < pending.length; cursor++) {
      const dependency = pending[cursor]!, id = JSON.stringify([dependency.sourcePackageId, dependency.relationship]);
      if (found.has(id)) continue;
      found.set(id, dependency);
      pending.push(...direct[position.get(dependency.sourcePackageId)!]!);
    }
    item.dependencies = [...found.values()];
    let size = item.fileSizeBytes;
    if (item.fileType === 'Booklet' || item.fileType === 'Unit') for (const dependency of item.dependencies) {
      if (dependency.relationship === 'usesPlayer' && item.fileType !== 'Booklet') continue;
      const target = items[position.get(dependency.sourcePackageId)!]!;
      if (!['Unit', 'Resource'].includes(target.fileType)) continue;
      size = size === null || target.fileSizeBytes === null ? null : size + target.fileSizeBytes;
    }
    item.totalSizeBytes = size;
  }
  items.sort((a, b) => a.fileName.localeCompare(b.fileName) || a.sourcePackageId.localeCompare(b.sourcePackageId));
  return { items, totalCount: items.length, dependencySizesCalculated };
}
