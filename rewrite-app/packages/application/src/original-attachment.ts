import type {OriginalAttachment, UploadAttachmentFileRequest} from '@testcenter-rewrite-app/contracts';
import type {AttachmentFile, OriginalNativeUnit, Workspace, WorkspaceAttachment} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import type {AttachmentPort} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import type {OriginalTestAdministrationInventory} from './original-test-administration.js';
import {isLinkedOriginalAttachmentPart, orderedOriginalAttachmentFiles,
  originalAttachmentAddress as attachmentAddress, originalAttachmentUnitName as toOriginalUnitName} from './original-attachment-response.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';

export const isOriginalAttachmentGroup = (group: string): boolean => group.startsWith('experimental');
const missing = () => new FirstSliceError(404, 'original_attachment_not_found', 'The requested attachment was not found.');

type NativeTarget = {
  source: OriginalAttachment;
  stored: WorkspaceAttachment;
  contentReleaseId: string;
  bookletName: string;
  testNumber: string;
  legacyId: string;
  legacyQrId: string;
  originalId: string;
  originalUnitName: string;
  responseId: string;
};
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
const validDefinitionName = (unitName: string) => unitName.length > 0 && !/[:/\\\u0000-\u001f\u007f]/.test(unitName);
const indexAddress = (index: Map<string, NativeTarget | null>, key: string, target: NativeTarget) =>
  index.set(key, index.has(key) ? null : target);

type FindTarget = (attachmentId: string) => NativeTarget | null | undefined;

function findEquivalentDefinition(targets: Iterable<NativeTarget>, testNumber: string, unitName: string,
  variableId: string): NativeTarget | undefined {
  if (!validDefinitionName(unitName)) return;
  let match: NativeTarget | undefined;
  for (const target of targets) {
    if (target.testNumber !== testNumber || !originalParticipantGroupKeysEqual(target.stored.variableId, variableId)) continue;
    const definition = validDefinitionName(target.originalUnitName) &&
      originalParticipantGroupKeysEqual(target.originalUnitName, unitName);
    if (!definition && !originalParticipantGroupKeysEqual(target.stored.unitKey, unitName)) continue;
    // An equivalent occurrence alias may shadow a physical code, so require a single definition target.
    if (match || !definition) return;
    match = target;
  }
  return match;
}

export function createOriginalAttachmentPort(input: {
  auth: OriginalAuthenticationPort;
  workspace: (scope: {tenantId: string; workspaceId: string}) => Promise<NativeAccess['workspace'] | undefined>;
  inventory: (tenantId: string, workspaceId: string) => Promise<OriginalTestAdministrationInventory>;
  attachments: (workspace: Workspace) => Promise<{attachment: WorkspaceAttachment; originalUnitId: string}[]>;
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
    const legacyCodes = new Map<string, NativeTarget | null>();
    const originalCodes = new Map<string, NativeTarget | null>();
    for (const {attachment: stored, originalUnitId} of attachments) {
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
      const legacyId = attachmentAddress(mapping.testNumber, stored.unitKey, stored.variableId);
      const legacyQrId = attachmentAddress(mapping.testNumber, toOriginalUnitName(stored.unitKey), stored.variableId);
      const originalUnitName = toOriginalUnitName(originalUnitId);
      const originalId = attachmentAddress(mapping.testNumber, originalUnitName, stored.variableId);
      const groupLabel = stored.groupLabel ?? group;
      const suffix = person.originalNameSuffix ?? '';
      const personLabel = groupLabel + '/' + person.originalLoginKey + (suffix && suffix !== '0' ? '/' + suffix : '');
      const source: OriginalAttachment = {
        attachmentId: legacyId, attachmentType: stored.attachmentType, dataType: stored.dataType,
        attachmentFileIds: stored.attachmentFileIds, lastModified: stored.lastModified,
        testLabel: run.bookletLabel ?? stored.testLabel, unitLabel: stored.unitKey, personLabel,
        variableId: stored.variableId
      };
      if (targets.has(legacyId)) throw new FirstSliceError(409, 'original_attachment_ambiguous', 'The attachment identity is ambiguous.');
      const target = {source, stored, contentReleaseId: run.contentReleaseId, bookletName: run.bookletName, testNumber: mapping.testNumber,
        legacyId, legacyQrId, originalId, originalUnitName,
        responseId: stored.unitKey === originalUnitId ? originalId : legacyId};
      targets.set(legacyId, target);
      indexAddress(legacyCodes, legacyQrId, target);
      if (validDefinitionName(originalUnitName)) indexAddress(originalCodes, originalId, target);
    }
    // Keep old addresses authoritative and publish a definition ID only if it selects this occurrence.
    const find: FindTarget = id => targets.get(id) ?? (legacyCodes.has(id) ? legacyCodes.get(id) : originalCodes.get(id));
    for (const target of targets.values()) {
      if (find(target.originalId) !== target) continue;
      target.source.attachmentId = target.originalId;
      target.source.unitLabel = target.originalUnitName;
    }
    return {workspace, targets, find};
  };

  const resolve = async ({token, attachmentId}: AttachmentRequest) => {
    const {workspace, targets, find} = await scopedTargets(token);
    const [number, unit, variable, extra] = attachmentId.split(':');
    if (!number || !validNumber(number) || !unit || !variable || extra !== undefined) {
      throw new FirstSliceError(400, 'original_attachment_invalid', 'Invalid attachment identifier.');
    }
    const exact = find(attachmentId);
    const target = exact === undefined ? findEquivalentDefinition(targets.values(), number, unit, variable) : exact;
    if (!target) throw missing();
    return {target, find, workspace, sessionToken: token, workspaceKey: workspace.workspaceKey, tenantKey: workspace.tenantKey,
      attachmentId: target.stored.attachmentId};
  };
  const page = (target: NativeTarget, find: FindTarget): WorkspaceAttachment => {
    const usesOriginalAddress = target.source.attachmentId === target.originalId;
    const unit = usesOriginalAddress ? target.originalUnitName : toOriginalUnitName(target.stored.unitKey);
    return {
      ...target.stored,
      attachmentId: usesOriginalAddress || find(target.legacyQrId) !== target
        ? target.source.attachmentId : target.legacyQrId,
      personLabel: target.source.personLabel,
      bookletKey: target.bookletName,
      testLabel: target.source.testLabel,
      unitKey: unit,
      unitLabel: unit
    };
  };

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
    for (const {stored, source, contentReleaseId, legacyId, responseId} of withFiles) {
      const unit = unitsByRun.get(stored.testRunId)?.find(row =>
        row.participantSessionId === stored.participantSessionId && row.contentReleaseId === contentReleaseId &&
        !row.unknownHistory && originalParticipantGroupKeysEqual(row.unitName, stored.unitKey));
      const files = new Set(stored.attachmentFileIds);
      const part = unit?.parts.find(row =>
        row.id === responseId && isLinkedOriginalAttachmentPart(row, files, stored.variableId)
      ) ?? unit?.parts.find(row => row.id === legacyId && row.responseType === 'iqb-standard@1.0');
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
    async pages(token) {
      const {targets, find} = await scopedTargets(token);
      return [...targets.values()].map(target => page(target, find));
    },
    async page(request) {
      const {target, find} = await resolve(request);
      return page(target, find);
    },
    async upload(request, file) {await operations.uploadAttachmentFile({...await resolve(request), ...file});},
    async file(request) {return operations.getAttachmentFile({...await resolve(request), attachmentFileId: request.attachmentFileId});},
    async delete(request) {await operations.deleteAttachmentFile({...await resolve(request), attachmentFileId: request.attachmentFileId});}
  };
}
