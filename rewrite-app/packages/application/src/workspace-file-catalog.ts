import { DOMParser, type Element } from '@xmldom/xmldom';
import {inspectOriginalHtmlResource,guessOriginalResourceName} from './original-resource-metadata.js';
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
  sourceBytes?: Uint8Array;
};

export function normalizeWorkspacePlayerResourceId(reference: string): string | null {
  if(!reference||reference==='0')return null;
  const guessed=guessOriginalResourceName(reference);
  return `${guessed.moduleId}-${guessed.major}.${guessed.minor}`;
}

export function selectCurrentWorkspaceFiles<T extends Pick<SourcePackage,'sourcePackageId'|'status'>>(sourcePackages: T[], activityEvents: Pick<WorkspaceActivityEvent,'eventType'|'subjectId'|'details'>[]): T[] {
  const byId = new Map(sourcePackages.map(source => [source.sourcePackageId, source]));
  const generated = new Set<string>(), replaced = new Set<string>();
  for (const event of activityEvents) {
    if (event.eventType === 'source_package_assembled') generated.add(event.subjectId);
    if (event.eventType !== 'source_package_replaced') continue;
    const replacement = typeof event.details.replacementSourcePackageId === 'string'
      ? byId.get(event.details.replacementSourcePackageId) : undefined;
    // A physical file replacement and its accepted row commit atomically.
    // Once that row is deleted its predecessor must not become live again,
    // including the interval before the later deletion activity is recorded.
    if (replacement && replacement.status !== 'rejected' ||
        !replacement && event.details.replacementMode === 'workspace_file') replaced.add(event.subjectId);
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

function inspect(input: WorkspaceCatalogInput): {
  metadata: WorkspaceCatalogFile['metadata']; references: WorkspaceFileReference[]; moduleId: string;
  diagnostics?: WorkspaceCatalogFile['validationDiagnostics'];
} {
  const metadata: WorkspaceCatalogFile['metadata'] = {
    identifier: sourceUpper(input.resourceIdentifier ?? input.fileName.split(/[\\/]/).at(-1) ?? input.fileName),
    label: '', description: '', participantCount: null, veronaVersion: null, moduleVersion: null
  };
  const references: WorkspaceFileReference[] = [];
  let moduleId = '';
  if (input.sourceText === null || input.fileType === 'Package') return { metadata, references, moduleId };
  if (input.fileType === 'Resource') {
    if (!/\.html$/i.test(input.fileName)) return {metadata, references, moduleId};
    const parsed=inspectOriginalHtmlResource(input.fileName,input.sourceText,input.sourceBytes);
    Object.assign(metadata,{identifier:parsed.identifier,label:parsed.label,description:parsed.description,
      moduleVersion:parsed.moduleVersion,veronaVersion:parsed.veronaVersion});
    return{metadata,references,moduleId:parsed.moduleId,diagnostics:[
      ...parsed.errors.map(message=>({code:'workspace_resource_metadata_invalid',severity:'error' as const,message})),
      ...parsed.catalogWarnings.map(message=>({code:'workspace_resource_metadata_warning',severity:'warning' as const,message})),
      ...parsed.info.map(message=>({code:'workspace_resource_metadata_info',severity:'info' as const,message}))
    ]};
  }

  // External entity declarations never enter the metadata parser. Rejected or
  // malformed XML stays listable without exposing any raw document or secrets.
  if (/<!DOCTYPE\b/i.test(input.sourceText)) return { metadata, references, moduleId };
  let invalid = false, root: Element | null = null;
  try {
    root = new DOMParser({ onError() { invalid = true; } })
      .parseFromString(input.sourceText, 'application/xml')?.documentElement;
  } catch { return { metadata, references, moduleId }; }
  if (invalid || !root || root.tagName !== input.fileType) return { metadata, references, moduleId };
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
  return { metadata, references, moduleId };
}

/** Lightweight complete current-file read model. Import status and validation
 * are not rewritten by this projection. Unresolved/ambiguous edges stay explicit.
 */
export function buildWorkspaceFileCatalog(inputs: WorkspaceCatalogInput[], options: {requireDependencies?: boolean} = {}): WorkspaceFileCatalog {
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
  const dependencySizesCalculated = options.requireDependencies === true || inputs.length <= 1000;
  const items: WorkspaceCatalogFile[] = inspected.map(({ input, metadata, references, diagnostics }) => ({
    sourcePackageId: input.sourcePackageId, fileName: input.fileName, fileType: input.fileType,
    status: input.status, uploadedAt: input.uploadedAt, fileSizeBytes: input.fileSizeBytes,
    metadata, ...(diagnostics?.length?{validationDiagnostics:diagnostics}:{}), dependencies: [], unresolvedReferences: references.flatMap(reference => {
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

/** Identity-only projection for Source's overwrite guard, without raw data.
 * XML files have no module version in Source FileData; patch labels do not
 * affect compatibility, while Verona module IDs remain case-sensitive.
 */
export function workspaceFileReplacementIdentity(input: WorkspaceCatalogInput) {
  if(input.fileType==='Resource'&&/\.html$/i.test(input.fileName)&&input.sourceText!==null){
    const parsed=inspectOriginalHtmlResource(input.fileName,input.sourceText,input.sourceBytes);
    return{fileType:input.fileType,identifier:parsed.identifier,moduleId:parsed.moduleId,version:parsed.effectiveVersion};
  }
  const {metadata, moduleId: inspectedModuleId} = inspect(input);
  let moduleId = inspectedModuleId, identifier = metadata.identifier, version = '';

  return {fileType: input.fileType, identifier, moduleId, version};
}
