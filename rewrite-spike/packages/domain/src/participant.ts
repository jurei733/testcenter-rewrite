import { randomUUID } from "node:crypto";

import type {
  BookletAssignment,
  ContentRelease
} from "./content.js";

export interface ParticipantSession {
  participantSessionId: string;
  sessionToken: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  createdAt: string;
}

export interface StarterAssignment {
  assignmentKey: string;
  bookletKey: string;
  bookletTitle: string;
  unitCount: number;
  initialStateOverrides: Record<string, string>;
}

export interface ParticipantStarterContext {
  loginKey: string;
  groupKey: string;
  assignments: StarterAssignment[];
}

export const createParticipantSession = (input: {
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
}): ParticipantSession => ({
  participantSessionId: `participant-session-${randomUUID()}`,
  sessionToken: `participant-token-${randomUUID()}`,
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  contentReleaseId: input.contentReleaseId,
  loginKey: input.loginKey,
  groupKey: input.groupKey,
  createdAt: new Date().toISOString()
});

const toStarterAssignment = (
  assignment: BookletAssignment,
  contentRelease: ContentRelease
): StarterAssignment | undefined => {
  const booklet = contentRelease.canonicalSnapshot.bookletDefinitions.find(
    currentBooklet => currentBooklet.bookletKey === assignment.bookletKey
  );

  if (!booklet) {
    return undefined;
  }

  return {
    assignmentKey: assignment.assignmentKey,
    bookletKey: assignment.bookletKey,
    bookletTitle: booklet.title,
    unitCount: booklet.unitKeys.length,
    initialStateOverrides: assignment.initialStateOverrides
  };
};

export const resolveParticipantStarterContext = (
  contentRelease: ContentRelease,
  loginKey: string
): ParticipantStarterContext | undefined => {
  const loginCollection = contentRelease.canonicalSnapshot.loginCollections.find(collection =>
    collection.loginKeys.includes(loginKey)
  );

  if (!loginCollection) {
    return undefined;
  }

  const assignments = contentRelease.canonicalSnapshot.bookletAssignments
    .filter(assignment => assignment.loginKey === loginKey)
    .map(assignment => toStarterAssignment(assignment, contentRelease))
    .filter((assignment): assignment is StarterAssignment => Boolean(assignment));

  if (!assignments.length) {
    return undefined;
  }

  return {
    loginKey,
    groupKey: loginCollection.groupKey,
    assignments
  };
};
