import type {OriginalAttachment, UploadAttachmentFileRequest} from '@testcenter-rewrite-app/contracts';
import type {AttachmentFile, OriginalNativeUnit, Workspace, WorkspaceAttachment} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import type {AttachmentPort} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import type {OriginalTestAdministrationInventory} from './original-test-administration.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {orderedOriginalAttachmentFiles} from './original-attachment-response.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';

export const isOriginalAttachmentGroup = (group: string): boolean => group.startsWith('experimental');
const missing = () => new FirstSliceError(404, 'original_attachment_not_found', 'The requested attachment was not found.');

type NativeTarget = {source: OriginalAttachment; stored: WorkspaceAttachment; contentReleaseId: string};
type AttachmentRequest = {token: string; attachmentId: string};
type NativeAccess = {workspace: Workspace & {tenantKey: string}; actorAdminUserId: string; groupKeys: string[]};

export type OriginalAttachmentPort = {
  authorize(token: string): Promise<NativeAccess>;
  list(token: string): Promise<OriginalAttachment[]>;
  get(request: AttachmentRequest): Promise<OriginalAttachment>;
  preflight(request: AttachmentRequest): Promise<void>;
  pages(token: string): Promise<WorkspaceAttachment[]>;
  page(request: AttachmentRequest): Promise<WorkspaceAttachment>;
  upload(request: AttachmentRequest, file: UploadAttachmentFileRequest): Promise<void>;
  file(request: AttachmentRequest & {attachmentFileId: string}): Promise<AttachmentFile>;
  delete(request: AttachmentRequest & {attachmentFileId: string}): Promise<void>;
};

const validNumber = (id: string) => /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
export function formatOriginalAttachmentJson(row: OriginalAttachment): string {
  if (!validNumber(row._testId)) throw missing();
  return '{' + Object.entries(row).map(([key, value]) =>
    encodeOriginalReportJson(key) + ':' + (key === '_testId' ? row._testId : encodeOriginalReportJson(value))).join(',') + '}';
}

export function createOriginalAttachmentPort(input: {
  auth: OriginalAuthenticationPort;
  workspace: (scope: {tenantId: string; workspaceId: string}) => Promise<NativeAccess['workspace'] | undefined>;
  inventory: (tenantId: string, workspaceId: string) => Promise<OriginalTestAdministrationInventory>;
  attachments: (workspace: Workspace) => Promise<WorkspaceAttachment[]>;
  units: (tenantId: string, workspaceId: string, testRunIds: string[]) => Promise<OriginalNativeUnit[]>;
  scopedOperations: (authorize: OriginalAttachmentPort['authorize']) => AttachmentPort;
}): OriginalAttachmentPort {
  const authorize = async (token: string): Promise<NativeAccess> => {
    const state = await input.auth.read({token});
    if (state.kind !== 'person' || state.participantSession.originalOperationalMode !== 'monitor-group' ||
        !isOriginalAttachmentGroup(state.participantSession.groupKey)) {
      throw new FirstSliceError(403, 'original_attachment_forbidden', 'Attachment management requires a current authorized group monitor.');
    }
    const person = state.participantSession;
    const workspace = await input.workspace(person);
    if (!workspace) throw missing();
    return {workspace, actorAdminUserId: person.participantSessionId, groupKeys: [person.groupKey]};
  };
  const operations = input.scopedOperations(authorize);

  const scopedTargets = async (token: string) => {
    const access = await authorize(token);
    const {workspace} = access;
    const group = access.groupKeys[0]!;
    const [inventory, attachments] = await Promise.all([
      input.inventory(workspace.tenantId, workspace.workspaceId),
      input.attachments(workspace)
    ]);
    const people = new Map(inventory.people.map(row => [row.participantSessionId, row]));
    const bindings = new Map(inventory.bindings.map(row => [row.loginKey, row]));
    const runs = new Map(inventory.runs.map(row => [row.testRunId, row]));
    const numbers = new Map(inventory.numbers.map(row => [row.testRunId, row]));
    const targets = new Map<string, NativeTarget>();
    for (const stored of attachments) {
      if (stored.groupKey !== group) continue;
      const person = people.get(stored.participantSessionId);
      const run = runs.get(stored.testRunId);
      const mapping = numbers.get(stored.testRunId);
      if (!person?.originalLoginKey || person.groupKey !== group ||
          bindings.get(person.originalLoginKey)?.groupKey !== group ||
          !run?.bookletName || !mapping || !validNumber(mapping.testNumber) ||
          run.participantSessionId !== person.participantSessionId ||
          mapping.participantSessionId !== person.participantSessionId ||
          mapping.contentReleaseId !== run.contentReleaseId ||
          person.contentReleaseId !== run.contentReleaseId ||
          stored.unitKey.includes(':') || stored.variableId.includes(':')) continue;
      const attachmentId = [mapping.testNumber, stored.unitKey, stored.variableId].join(':');
      const groupLabel = stored.groupLabel ?? group;
      const suffix = person.originalNameSuffix ?? '';
      const personLabel = groupLabel + '/' + person.originalLoginKey + (suffix && suffix !== '0' ? '/' + suffix : '');
      const source: OriginalAttachment = {
        attachmentId, attachmentType: stored.attachmentType, dataType: stored.dataType,
        attachmentFileIds: stored.attachmentFileIds, lastModified: stored.lastModified,
        _groupName: group, _groupLabel: groupLabel, _loginName: person.originalLoginKey,
        _loginNameSuffix: suffix, testLabel: run.bookletLabel ?? stored.testLabel, _bookletName: run.bookletName,
        unitLabel: stored.unitKey, personLabel, _testId: mapping.testNumber, _unitName: stored.unitKey,
        variableId: stored.variableId
      };
      if (targets.has(attachmentId)) throw new FirstSliceError(409, 'original_attachment_ambiguous', 'The attachment identity is ambiguous.');
      targets.set(attachmentId, {source, stored, contentReleaseId: run.contentReleaseId});
    }
    return {workspace, targets};
  };

  const resolve = async ({token, attachmentId}: AttachmentRequest) => {
    const {workspace, targets} = await scopedTargets(token);
    const [number, unit, variable, extra] = attachmentId.split(':');
    if (!number || !validNumber(number) || !unit || !variable || extra !== undefined) {
      throw new FirstSliceError(400, 'original_attachment_invalid', 'Invalid attachment identifier.');
    }
    const target = targets.get(attachmentId);
    if (!target) throw missing();
    return {target, workspace, sessionToken: token, workspaceKey: workspace.workspaceKey, tenantKey: workspace.tenantKey,
      attachmentId: target.stored.attachmentId};
  };
  const page = (target: NativeTarget): WorkspaceAttachment => ({...target.stored,
    attachmentId: target.source.attachmentId, personLabel: target.source.personLabel, testLabel: target.source.testLabel,
    unitLabel: target.source.unitLabel});

  const hydrateResponses = async (workspace: Workspace, targets: NativeTarget[]) => {
    const withFiles = targets.filter(({stored}) => stored.attachmentFileIds.length);
    if (!withFiles.length) return;
    const runIds = [...new Set(withFiles.map(({stored}) => stored.testRunId))];
    const units = await input.units(workspace.tenantId, workspace.workspaceId, runIds);
    const unitsByRun = new Map<string, OriginalNativeUnit[]>();
    for (const unit of units) {
      const known = unitsByRun.get(unit.testRunId) ?? [];
      known.push(unit);
      unitsByRun.set(unit.testRunId, known);
    }
    for (const {stored, source, contentReleaseId} of withFiles) {
      const unit = unitsByRun.get(stored.testRunId)?.find(row =>
        row.participantSessionId === stored.participantSessionId && row.contentReleaseId === contentReleaseId &&
        !row.unknownHistory && originalParticipantGroupKeysEqual(row.unitName, stored.unitKey));
      const part = unit?.parts.find(row => row.id === source.attachmentId && row.responseType === 'iqb-standard@1.0');
      if (!part) {
        if (source.lastModified !== null) source.lastModified = Math.floor(source.lastModified / 1000) * 1000;
        continue;
      }
      source.attachmentFileIds = orderedOriginalAttachmentFiles(stored.attachmentFileIds, part, stored.variableId);
      source.lastModified = part.ts;
    }
  };

  return {
    authorize,
    async list(token) {
      const {workspace, targets} = await scopedTargets(token);
      const rows = [...targets.values()];
      await hydrateResponses(workspace, rows);
      return rows.map(row => row.source);
    },
    async get(request) {
      const {workspace, target} = await resolve(request);
      await hydrateResponses(workspace, [target]);
      return target.source;
    },
    async preflight(request) {await resolve(request);},
    async pages(token) {return [...(await scopedTargets(token)).targets.values()].map(page);},
    async page(request) {return page((await resolve(request)).target);},
    async upload(request, file) {await operations.uploadAttachmentFile({...await resolve(request), ...file});},
    async file(request) {return operations.getAttachmentFile({...await resolve(request), attachmentFileId: request.attachmentFileId});},
    async delete(request) {await operations.deleteAttachmentFile({...await resolve(request), attachmentFileId: request.attachmentFileId});}
  };
}
