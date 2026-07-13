import type { RecordCollectionRow } from "./record-collection.component";

export function participantSessionLinkRows(
  participantSessionId?: string | null
): RecordCollectionRow[] {
  const normalizedParticipantSessionId = participantSessionId?.trim();
  if (!normalizedParticipantSessionId) {
    return [];
  }

  const url = buildParticipantSessionEntryUrl(normalizedParticipantSessionId);
  return [{ label: "Participant Link", value: url, href: url }];
}

export function buildParticipantSessionEntryUrl(
  participantSessionId: string
): string {
  const query = new URLSearchParams({ participantSessionId });
  const participantPath = `/participant?${query.toString()}`;
  const browserOrigin = globalThis.location?.origin ?? "";
  return browserOrigin ? `${browserOrigin}${participantPath}` : participantPath;
}
