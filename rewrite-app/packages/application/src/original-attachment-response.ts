import type {AttachmentFile, OriginalNativeUnit} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {assertOriginalUnitRecord, originalUnitHistoryUnavailable, originalUnitText, type OriginalUnitInput} from './original-unit-record.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

export type AttachmentFileChange = {file: AttachmentFile} | {deleteFileId: string};
export type OriginalAttachmentMutation = Omit<OriginalUnitInput, 'delivery'> & {
  attachmentId: string;
  partId: string;
  variableId: string;
  occurredAt: string;
  change: AttachmentFileChange;
};
type AttachmentFileIdentity = Pick<AttachmentFile, 'attachmentFileId' | 'createdAt'>;
type ResponsePart = OriginalNativeUnit['parts'][number];
const responseType = 'iqb-standard@1.0';

export const attachmentStorageId = (testRunId: string, unitName: string, variableId: string): string =>
  'att-' + Buffer.from(JSON.stringify([testRunId, unitName, variableId]), 'utf8').toString('base64url');

export function orderedOriginalAttachmentFiles(fileIds: readonly string[], part: ResponsePart | undefined, variableId: string): string[] {
  const remaining = new Set(fileIds);
  if (part?.responseType !== responseType || !part.content) return [...remaining];
  let content: unknown;
  try { content = JSON.parse(part.content); } catch { return [...remaining]; }
  if (!Array.isArray(content) || content.length !== 1 || content[0]?.id !== variableId || !Array.isArray(content[0]?.value)) {
    return [...remaining];
  }
  return [...content[0].value.filter((id: unknown): id is string => typeof id === 'string' && remaining.delete(id)), ...remaining];
}

export function prepareOriginalAttachmentResponse(
  input: OriginalAttachmentMutation,
  previous: OriginalNativeUnit | null,
  files: readonly AttachmentFileIdentity[]
): OriginalNativeUnit | null {
  if (previous?.unknownHistory) throw originalUnitHistoryUnavailable();
  originalUnitText(input.partId, 50);
  if (input.attachmentId !== attachmentStorageId(input.testRunId, input.unitName, input.variableId)) {
    throw new FirstSliceError(400, 'original_attachment_invalid', 'Invalid attachment identifier.');
  }

  const part = previous?.parts.find(candidate => candidate.id === input.partId);
  const fileIds = orderedOriginalAttachmentFiles([...files]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.attachmentFileId.localeCompare(b.attachmentFileId))
    .map(file => file.attachmentFileId), part, input.variableId);
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
  const unit = {...previous, parts: previous.parts.filter(candidate => candidate.id !== input.partId)};
  if (fileIds.length) {
    const timestamp = Math.floor(Date.parse(input.occurredAt) / 1000) * 1000;
    unit.parts.push({id: input.partId, responseType, ts: Math.max(part?.ts ?? timestamp, timestamp),
      content: encodeOriginalReportJson([{id: input.variableId, value: fileIds, status: 'VALUE_CHANGED'}])});
  }
  assertOriginalUnitRecord(unit);
  return unit;
}
