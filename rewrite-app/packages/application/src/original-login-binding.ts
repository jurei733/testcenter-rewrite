import type {OriginalLoginBinding} from '@testcenter-rewrite-app/domain';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';

export type OriginalLoginBindingInput = {
  tenantId: string;
  workspaceId: string;
  loginKey: string;
  groupKey: string;
  groupSnapshotKey: string;
  authenticatedAt: string;
};

export function prepareOriginalLoginBinding(input: OriginalLoginBindingInput,
  previous?: OriginalLoginBinding): OriginalLoginBinding {
  for (const field of ['tenantId','workspaceId','loginKey','groupKey','groupSnapshotKey'] as const) {
    if (typeof input[field] !== 'string' || !input[field].length) throw new TypeError('Original login binding requires a scope, login and group.');
  }
  if (typeof input.authenticatedAt !== 'string' || !Number.isFinite(Date.parse(input.authenticatedAt)) ||
      !originalParticipantGroupKeysEqual(input.groupKey,input.groupSnapshotKey)) throw new TypeError('Invalid Original login binding metadata.');
  if (previous && (previous.tenantId !== input.tenantId || previous.workspaceId !== input.workspaceId ||
      previous.loginKey !== input.loginKey)) throw new TypeError('Original login binding cannot change its identity.');
  return {tenantId:input.tenantId,workspaceId:input.workspaceId,loginKey:previous?.loginKey ?? input.loginKey,
    groupKey:input.groupKey,groupSnapshotKey:input.groupSnapshotKey,
    createdAt:previous?.createdAt ?? input.authenticatedAt,lastAuthenticatedAt:input.authenticatedAt};
}
