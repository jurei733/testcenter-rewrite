import type {AttachmentFile, OriginalNativeUnit} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {assertOriginalUnitRecord, originalUnitHistoryUnavailable, originalUnitParentMatches, originalUnitText, type OriginalUnitInput} from './original-unit-record.js';
import {attachmentStorageId, readAttachmentStorageId} from './attachment-storage-id.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

export type AttachmentFileChange = {file: AttachmentFile} | {deleteFileId: string};
export type OriginalAttachmentMutation = Omit<OriginalUnitInput, 'delivery'> & {
  attachmentId: string;
  testNumber: string;
  originalUnitId: string;
  variableId: string;
  occurredAt: string;
  change: AttachmentFileChange;
};
type AttachmentFileIdentity = Pick<AttachmentFile, 'attachmentFileId' | 'createdAt'>;
type ResponsePart = OriginalNativeUnit['parts'][number];
const responseType = 'iqb-standard@1.0';

export const originalAttachmentUnitName = (unitName: string): string =>
  unitName.replace(/[a-z]/g, letter => letter.toUpperCase());
export const originalAttachmentAddress = (testNumber: string, unitName: string, variableId: string): string =>
  [testNumber, unitName, variableId].join(':');

export type OriginalAttachmentFileMetadata = Pick<AttachmentFile,
  'attachmentId' | 'attachmentFileId' | 'createdAt' | 'tenantId' | 'workspaceId'>;
type StoredAttachment = {unitName: string; variableId: string; fileId: string; time: number};

const attachmentSecond = (milliseconds: number): number => Math.floor(milliseconds / 1000) * 1000;
const attachmentResponsePart = (id: string, variableId: string, fileIds: string[], ts: number): ResponsePart => ({
  id, responseType, ts, content: encodeOriginalReportJson([{id: variableId, value: fileIds, status: 'VALUE_CHANGED'}])
});

export function indexOriginalAttachmentFiles(rows: readonly OriginalAttachmentFileMetadata[],
  scope: Pick<OriginalNativeUnit, 'tenantId' | 'workspaceId'>): Map<string, StoredAttachment[]> {
  const result = new Map<string, StoredAttachment[]>();
  for (const row of rows) {
    if (row.tenantId !== scope.tenantId || row.workspaceId !== scope.workspaceId) continue;
    const tuple = readAttachmentStorageId(row.attachmentId);
    const time = Date.parse(row.createdAt);
    if (!tuple || attachmentStorageId(...tuple) !== row.attachmentId || !Number.isFinite(time) ||
        !/^image:[^/\\\s:]+\.(png|jpe?g)$/.test(row.attachmentFileId)) continue;
    const [testRunId, unitName, variableId] = tuple;
    if (!unitName || !variableId || /[:/\\\u0000-\u001f\u007f]/.test(unitName + variableId)) continue;
    const files = result.get(testRunId) ?? [];
    files.push({unitName, variableId, fileId: row.attachmentFileId, time});
    result.set(testRunId, files);
  }
  return result;
}

/** Older uploads wrote the file before the native attachment response existed.
 * Recover only missing parts of a known Unit from its surviving files. */
export function projectOriginalAttachmentHistory(unit: OriginalNativeUnit, testNumber: string,
  files: readonly StoredAttachment[] | undefined): OriginalNativeUnit {
  if (!files?.length || unit.unknownHistory || !/^[1-9][0-9]{0,18}$/.test(testNumber) ||
      BigInt(testNumber) > 9223372036854775807n) return unit;

  const parts = new Map<string, StoredAttachment[]>();
  for (const file of files) {
    if (!originalParticipantGroupKeysEqual(file.unitName, unit.unitName)) continue;
    const related = parts.get(file.variableId) ?? [];
    related.push(file);
    parts.set(file.variableId, related);
  }

  const existing = new Map(unit.parts.map(part => [part.id, part]));
  const recovered: ResponsePart[] = [];
  for (const [variableId, group] of parts) {
    const alias = group[0]!.unitName;
    const id = originalAttachmentAddress(testNumber, alias, variableId);
    if (existing.has(id) || Array.from(id).length > 50 || group.some(file => file.unitName !== alias)) continue;
    const canonicalId = originalAttachmentAddress(testNumber, originalAttachmentUnitName(alias), variableId);
    const canonical = existing.get(canonicalId);
    if (canonical && isLinkedOriginalAttachmentPart(canonical, new Set(group.map(file => file.fileId)), variableId)) continue;
    const ordered = group.sort((a, b) => a.time - b.time || a.fileId.localeCompare(b.fileId));
    const fileIds = [...new Set(ordered.map(file => file.fileId))];
    recovered.push(attachmentResponsePart(id, variableId, fileIds, attachmentSecond(ordered.at(-1)!.time)));
  }
  if (!recovered.length) return unit;

  // Keep the relative order of persisted parts, including parts with unusual
  // client clocks. A backfilled old upload must not displace a later response.
  recovered.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  let cursor = 0;
  const combined: ResponsePart[] = [];
  for (const part of unit.parts) {
    while (cursor < recovered.length && recovered[cursor]!.ts <= part.ts) combined.push(recovered[cursor++]!);
    combined.push(part);
  }
  combined.push(...recovered.slice(cursor));
  const result = {...unit, parts: combined};
  assertOriginalUnitRecord(result);
  return result;
}

export function originalAttachmentHistoryProjector(scope: Pick<OriginalNativeUnit, 'tenantId' | 'workspaceId'>,
  files: readonly OriginalAttachmentFileMetadata[], numbers: readonly OriginalTestNumberRecord[]): (unit: OriginalNativeUnit) => OriginalNativeUnit {
  const filesByRun = indexOriginalAttachmentFiles(files, scope);
  const numbersByRun = new Map<string, OriginalTestNumberRecord[]>();
  for (const number of numbers) {
    if (!filesByRun.has(number.testRunId)) continue;
    const entries = numbersByRun.get(number.testRunId) ?? [];
    entries.push(number);
    numbersByRun.set(number.testRunId, entries);
  }
  return unit => {
    const entries = numbersByRun.get(unit.testRunId);
    return entries?.length === 1 && originalUnitParentMatches(unit, entries[0])
      ? projectOriginalAttachmentHistory(unit, entries[0]!.testNumber, filesByRun.get(unit.testRunId))
      : unit;
  };
}

function responseAttachmentFileIds(part: ResponsePart | undefined, variableId: string): string[] {
  if (part?.responseType !== responseType || !part.content) return [];
  let content: unknown;
  try { content = JSON.parse(part.content); } catch { return []; }
  if (!Array.isArray(content) || content.length !== 1 || content[0]?.id !== variableId || !Array.isArray(content[0]?.value)) {
    return [];
  }
  return content[0].value.filter((id: unknown): id is string => typeof id === 'string');
}

export function isLinkedOriginalAttachmentPart(part: ResponsePart | undefined, ids: ReadonlySet<string>, variableId: string): boolean {
  return responseAttachmentFileIds(part, variableId).some(id => ids.has(id));
}

export function orderedOriginalAttachmentFiles(fileIds: readonly string[], part: ResponsePart | undefined, variableId: string): string[] {
  const remaining = new Set(fileIds);
  return [...responseAttachmentFileIds(part, variableId).filter(id => remaining.delete(id)), ...remaining];
}

export function prepareOriginalAttachmentResponse(
  input: OriginalAttachmentMutation,
  previous: OriginalNativeUnit | null,
  files: readonly AttachmentFileIdentity[]
): OriginalNativeUnit | null {
  if (previous?.unknownHistory) throw originalUnitHistoryUnavailable();
  const legacyId = originalAttachmentAddress(input.testNumber, input.unitName, input.variableId);
  const partId = input.unitName === input.originalUnitId
    ? originalAttachmentAddress(input.testNumber, originalAttachmentUnitName(input.originalUnitId), input.variableId)
    : legacyId;
  originalUnitText(partId, 50);
  if (input.attachmentId !== attachmentStorageId(input.testRunId, input.unitName, input.variableId)) {
    throw new FirstSliceError(400, 'original_attachment_invalid', 'Invalid attachment identifier.');
  }

  const part = previous?.parts.find(candidate => candidate.id === partId);
  // Rename a historical part only when it references a file owned by this attachment.
  const linkedIds = new Set(files.map(file => file.attachmentFileId));
  const legacyPart = partId === legacyId ? undefined : previous?.parts.find(candidate =>
    candidate.id === legacyId && isLinkedOriginalAttachmentPart(candidate, linkedIds, input.variableId)
  );
  if (partId !== legacyId && part && !isLinkedOriginalAttachmentPart(part, linkedIds, input.variableId)) {
    throw new FirstSliceError(409, 'original_attachment_file_conflict', 'The attachment response identity conflicts with stored data.');
  }
  const fileIds = orderedOriginalAttachmentFiles([...files]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.attachmentFileId.localeCompare(b.attachmentFileId))
    .map(file => file.attachmentFileId), part ?? legacyPart, input.variableId);
  if ('file' in input.change) {
    if (!previous) throw new FirstSliceError(404, 'original_unit_uninitialized',
      'Unit response could not be saved because the unit does not exist (yet). Please try again.');
    const {file} = input.change;
    if (file.attachmentId !== input.attachmentId || file.tenantId !== input.tenantId ||
        file.workspaceId !== input.workspaceId || fileIds.includes(file.attachmentFileId)) {
      throw new FirstSliceError(409, 'original_attachment_file_conflict', 'The attachment file identity conflicts with stored data.');
    }
    fileIds.push(file.attachmentFileId);
  } else {
    const index = fileIds.indexOf(input.change.deleteFileId);
    if (index < 0) throw new FirstSliceError(404, 'attachment_file_not_found', 'The requested attachment file was not found.');
    fileIds.splice(index, 1);
  }

  // Files from before native response linkage can still be deleted when no
  // Unit record was ever opened. There is no native part to remove in that case.
  if (!previous) return null;
  const unit = {...previous, parts: previous.parts.filter(candidate => candidate !== part && candidate !== legacyPart)};
  if (fileIds.length) {
    const timestamp = attachmentSecond(Date.parse(input.occurredAt));
    unit.parts.push(attachmentResponsePart(partId, input.variableId, fileIds,
      Math.max(part?.ts ?? timestamp, legacyPart?.ts ?? timestamp, timestamp)));
  }
  assertOriginalUnitRecord(unit);
  return unit;
}
