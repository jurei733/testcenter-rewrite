import type { RecordCollectionRow } from "./record-collection.component";

export type ParticipantSessionEntryLinkContext = {
  tenantKey?: string | null;
  workspaceKey?: string | null;
  loginKey?: string | null;
  groupKey?: string | null;
  bookletKey?: string | null;
};

export function participantSessionLinkRows(
  participantSessionId?: string | null,
  context: ParticipantSessionEntryLinkContext = {}
): RecordCollectionRow[] {
  const normalizedParticipantSessionId = participantSessionId?.trim();
  if (!normalizedParticipantSessionId) {
    return [];
  }

  const url = buildParticipantSessionEntryUrl(
    normalizedParticipantSessionId,
    context
  );
  return [{ label: "Participant Link", value: url, href: url }];
}

export function buildParticipantSessionEntryUrl(
  participantSessionId: string,
  context: ParticipantSessionEntryLinkContext = {}
): string {
  const query = new URLSearchParams({ participantSessionId });
  appendParticipantLinkParam(query, "tenantKey", context.tenantKey);
  appendParticipantLinkParam(query, "workspaceKey", context.workspaceKey);
  appendParticipantLinkParam(query, "loginKey", context.loginKey);
  appendParticipantLinkParam(query, "groupKey", context.groupKey);
  appendParticipantLinkParam(query, "bookletKey", context.bookletKey);
  const participantPath = `/participant?${query.toString()}`;
  const browserOrigin = globalThis.location?.origin ?? "";
  return browserOrigin ? `${browserOrigin}${participantPath}` : participantPath;
}

function appendParticipantLinkParam(
  query: URLSearchParams,
  key: string,
  value?: string | null
): void {
  const normalizedValue = value?.trim();
  if (normalizedValue) {
    query.set(key, normalizedValue);
  }
}
