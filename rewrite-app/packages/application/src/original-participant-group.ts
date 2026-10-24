import type { OriginalParticipantGroup } from "@testcenter-rewrite-app/domain";

// Source uses german2_ci: de-DE-u-ks-level2, case insensitive and accent sensitive.
// Compare within a locked workspace instead of inventing a lowercase Unicode key.
const groupCollator = new Intl.Collator("de-DE-u-ks-level2", { usage: "sort", sensitivity: "accent" });

export const originalParticipantGroupKeysEqual = (left: string, right: string): boolean =>
  groupCollator.compare(left, right) === 0;

export const prepareOriginalParticipantGroup = (input: {
  tenantId: string;
  workspaceId: string;
  groupKey: string;
  groupLabel: string;
  createdAt: string;
}): OriginalParticipantGroup => {
  if ([input.tenantId, input.workspaceId, input.groupKey].some(value => typeof value !== "string" || !value.length) ||
      typeof input.groupLabel !== "string" || !input.groupLabel.length || typeof input.createdAt !== "string" ||
      !Number.isFinite(Date.parse(input.createdAt))) {
    throw new TypeError("Original participant group requires a scope, name, label and server timestamp.");
  }
  return {
    tenantId: input.tenantId, workspaceId: input.workspaceId,
    groupKey: input.groupKey, groupLabel: input.groupLabel,
    createdAt: input.createdAt, lastModifiedAt: input.createdAt
  };
};
