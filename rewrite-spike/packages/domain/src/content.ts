import { randomUUID } from "node:crypto";

export type ContentReleaseStatus = "draft" | "active";

export interface BookletRunPolicy {
  navigationLocked: boolean;
  timeLimitSeconds: number | null;
}

export interface BookletDefinition {
  bookletKey: string;
  title: string;
  unitKeys: string[];
  runPolicy: BookletRunPolicy;
}

export interface LoginCollection {
  collectionKey: string;
  groupKey: string;
  loginKeys: string[];
}

export interface BookletAssignment {
  assignmentKey: string;
  loginKey: string;
  bookletKey: string;
  initialStateOverrides: Record<string, string>;
}

export interface SystemCheckDefinition {
  systemCheckKey: string;
  title: string;
  checkKeys: string[];
}

export interface CanonicalContentSnapshot {
  fixtureKey: string;
  unitKeys: string[];
  bookletDefinitions: BookletDefinition[];
  loginCollections: LoginCollection[];
  bookletAssignments: BookletAssignment[];
  systemCheckDefinitions: SystemCheckDefinition[];
}

export interface ContentRelease {
  contentReleaseId: string;
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
  importJobId: string;
  fixtureKey: string;
  releaseLabel: string;
  status: ContentReleaseStatus;
  createdAt: string;
  activatedAt: string | null;
  canonicalSnapshot: CanonicalContentSnapshot;
}

export interface ContentReleaseEntityDiff {
  addedKeys: string[];
  removedKeys: string[];
  changedKeys: string[];
  unchangedKeys: string[];
}

export type ContentReleaseFieldValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | Record<string, string>;

export interface ContentReleaseFieldChange {
  fieldKey: string;
  message: string;
  before: ContentReleaseFieldValue;
  after: ContentReleaseFieldValue;
}

export interface ContentReleaseEntityChangeDetail {
  entityKey: string;
  changes: ContentReleaseFieldChange[];
}

export type ContentReleaseImpactArea =
  | "initial_import"
  | "units"
  | "booklets"
  | "run_policy"
  | "login_collections"
  | "assignment_routing"
  | "initial_state";

export type ContentReleaseImpactRiskLevel = "none" | "low" | "medium" | "high";

export interface ContentReleaseActivationImpact {
  riskLevel: ContentReleaseImpactRiskLevel;
  changedAreas: ContentReleaseImpactArea[];
  affectedLoginCount: number;
  affectedLoginKeys: string[];
  affectedGroupKeys: string[];
  affectedBookletKeys: string[];
  affectedAssignmentKeys: string[];
  highlights: string[];
}

export interface ContentReleaseActivationSession {
  testRunId: string;
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  assignmentKey: string;
}

export interface ContentReleaseActivationPolicy {
  blockIncompatibleRoutingChangesWithActiveSessions: boolean;
  warnOnActiveSessions: boolean;
  warnOnHighRiskReleaseChange: boolean;
}

export const defaultContentReleaseActivationPolicy: ContentReleaseActivationPolicy = {
  blockIncompatibleRoutingChangesWithActiveSessions: true,
  warnOnActiveSessions: true,
  warnOnHighRiskReleaseChange: true
};

export type ContentReleaseActivationGuardrailStatus = "ready" | "warning" | "blocked";

export type ContentReleaseActivationGuardrailComparisonMode =
  | "no_active_release"
  | "already_active"
  | "switch_from_active_release";

export type ContentReleaseActivationGuardrailCode =
  | "no_active_release"
  | "already_active"
  | "active_sessions_present"
  | "high_risk_release_change"
  | "active_sessions_incompatible_routing_change";

export interface ContentReleaseActivationGuardrail {
  status: ContentReleaseActivationGuardrailStatus;
  comparisonMode: ContentReleaseActivationGuardrailComparisonMode;
  comparedToActiveContentReleaseId: string | null;
  comparedToActiveReleaseLabel: string | null;
  activeSessionCount: number;
  activeTestRunIds: string[];
  activeLoginKeys: string[];
  activeGroupKeys: string[];
  blockingReasonCodes: ContentReleaseActivationGuardrailCode[];
  warningReasonCodes: ContentReleaseActivationGuardrailCode[];
  highlights: string[];
}

export interface ContentReleaseDiffSummary {
  baselineContentReleaseId: string | null;
  baselineReleaseLabel: string | null;
  comparisonType: "initial_import" | "successive_import";
  changed: boolean;
  totalChanges: number;
  units: ContentReleaseEntityDiff;
  booklets: ContentReleaseEntityDiff;
  loginCollections: ContentReleaseEntityDiff;
  bookletAssignments: ContentReleaseEntityDiff;
  bookletChangeDetails: ContentReleaseEntityChangeDetail[];
  loginCollectionChangeDetails: ContentReleaseEntityChangeDetail[];
  bookletAssignmentChangeDetails: ContentReleaseEntityChangeDetail[];
  runPoliciesChangedBookletKeys: string[];
  activationImpact: ContentReleaseActivationImpact;
}

export interface ContentReleaseMonitorProjectionAssignment {
  assignmentKey: string;
  loginKey: string;
  bookletKey: string;
  bookletTitle: string;
  unitCount: number;
  initialStateOverrides: Record<string, string>;
}

export interface ContentReleaseMonitorProjectionGroup {
  collectionKey: string;
  groupKey: string;
  loginKeys: string[];
  assignments: ContentReleaseMonitorProjectionAssignment[];
}

export interface ContentReleaseMonitorProjectionBooklet {
  bookletKey: string;
  title: string;
  runPolicy: BookletRunPolicy;
  unitKeys: string[];
  groupKeys: string[];
  loginKeys: string[];
  assignmentKeys: string[];
}

export interface ContentReleaseMonitorProjection {
  groups: ContentReleaseMonitorProjectionGroup[];
  booklets: ContentReleaseMonitorProjectionBooklet[];
}

export interface ContentReleaseSystemCheckProjection {
  systemChecks: SystemCheckDefinition[];
  groupKeys: string[];
  loginKeys: string[];
  loginCount: number;
}

export const createContentRelease = (input: {
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
  importJobId: string;
  fixtureKey: string;
  releaseLabel: string;
  canonicalSnapshot: CanonicalContentSnapshot;
}): ContentRelease => ({
  contentReleaseId: `content-release-${randomUUID()}`,
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  sourcePackageId: input.sourcePackageId,
  importJobId: input.importJobId,
  fixtureKey: input.fixtureKey,
  releaseLabel: input.releaseLabel,
  status: "draft",
  createdAt: new Date().toISOString(),
  activatedAt: null,
  canonicalSnapshot: input.canonicalSnapshot
});

const createInitialEntityDiff = (keys: string[]): ContentReleaseEntityDiff => ({
  addedKeys: keys,
  removedKeys: [],
  changedKeys: [],
  unchangedKeys: []
});

const createChangedEntityDetails = <TCurrent, TPrevious>(input: {
  currentKeys: string[];
  previousKeys: string[];
  currentByKey: Map<string, TCurrent>;
  previousByKey: Map<string, TPrevious>;
  getChanges: (current: TCurrent, previous: TPrevious) => ContentReleaseFieldChange[];
}): ContentReleaseEntityChangeDetail[] => {
  const previousKeySet = new Set(input.previousKeys);
  const sharedKeys = input.currentKeys.filter(key => previousKeySet.has(key));

  return sharedKeys.flatMap(entityKey => {
    const current = input.currentByKey.get(entityKey);
    const previous = input.previousByKey.get(entityKey);

    if (!current || !previous) {
      return [];
    }

    const changes = input.getChanges(current, previous);

    if (changes.length === 0) {
      return [];
    }

    return [{
      entityKey,
      changes
    }];
  });
};

const createEntityDiff = <TCurrent, TPrevious>(input: {
  currentKeys: string[];
  previousKeys: string[];
  currentByKey: Map<string, TCurrent>;
  previousByKey: Map<string, TPrevious>;
  isChanged: (current: TCurrent, previous: TPrevious) => boolean;
}): ContentReleaseEntityDiff => {
  const previousKeySet = new Set(input.previousKeys);
  const currentKeySet = new Set(input.currentKeys);

  const addedKeys = input.currentKeys.filter(key => !previousKeySet.has(key));
  const removedKeys = input.previousKeys.filter(key => !currentKeySet.has(key));
  const sharedKeys = input.currentKeys.filter(key => previousKeySet.has(key));

  return sharedKeys.reduce<ContentReleaseEntityDiff>(
    (diff, key) => {
      const current = input.currentByKey.get(key);
      const previous = input.previousByKey.get(key);

      if (!current || !previous) {
        diff.changedKeys.push(key);
        return diff;
      }

      if (input.isChanged(current, previous)) {
        diff.changedKeys.push(key);
      } else {
        diff.unchangedKeys.push(key);
      }

      return diff;
    },
    {
      addedKeys,
      removedKeys,
      changedKeys: [],
      unchangedKeys: []
    }
  );
};

const areStringArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const areStringRecordsEqual = (left: Record<string, string>, right: Record<string, string>): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (!areStringArraysEqual(leftKeys, rightKeys)) {
    return false;
  }

  return leftKeys.every(key => left[key] === right[key]);
};

const createFieldChange = (
  fieldKey: string,
  message: string,
  before: ContentReleaseFieldValue,
  after: ContentReleaseFieldValue
): ContentReleaseFieldChange => ({
  fieldKey,
  message,
  before,
  after
});

const isRunPolicyChanged = (current: BookletRunPolicy, previous: BookletRunPolicy): boolean =>
  current.navigationLocked !== previous.navigationLocked ||
  current.timeLimitSeconds !== previous.timeLimitSeconds;

const isBookletChanged = (current: BookletDefinition, previous: BookletDefinition): boolean =>
  current.title !== previous.title ||
  isRunPolicyChanged(current.runPolicy, previous.runPolicy) ||
  !areStringArraysEqual(current.unitKeys, previous.unitKeys);

const isLoginCollectionChanged = (current: LoginCollection, previous: LoginCollection): boolean =>
  current.groupKey !== previous.groupKey ||
  !areStringArraysEqual(current.loginKeys, previous.loginKeys);

const isBookletAssignmentChanged = (current: BookletAssignment, previous: BookletAssignment): boolean =>
  current.loginKey !== previous.loginKey ||
  current.bookletKey !== previous.bookletKey ||
  !areStringRecordsEqual(current.initialStateOverrides, previous.initialStateOverrides);

const getBookletFieldChanges = (
  current: BookletDefinition,
  previous: BookletDefinition
): ContentReleaseFieldChange[] => {
  const changes: ContentReleaseFieldChange[] = [];

  if (current.title !== previous.title) {
    changes.push(createFieldChange("title", "Booklet title changed", previous.title, current.title));
  }

  if (!areStringArraysEqual(current.unitKeys, previous.unitKeys)) {
    changes.push(
      createFieldChange("unitKeys", "Booklet unit sequence changed", previous.unitKeys, current.unitKeys)
    );
  }

  if (current.runPolicy.navigationLocked !== previous.runPolicy.navigationLocked) {
    changes.push(
      createFieldChange(
        "runPolicy.navigationLocked",
        "Booklet navigation lock policy changed",
        previous.runPolicy.navigationLocked,
        current.runPolicy.navigationLocked
      )
    );
  }

  if (current.runPolicy.timeLimitSeconds !== previous.runPolicy.timeLimitSeconds) {
    changes.push(
      createFieldChange(
        "runPolicy.timeLimitSeconds",
        "Booklet time limit changed",
        previous.runPolicy.timeLimitSeconds,
        current.runPolicy.timeLimitSeconds
      )
    );
  }

  return changes;
};

const getLoginCollectionFieldChanges = (
  current: LoginCollection,
  previous: LoginCollection
): ContentReleaseFieldChange[] => {
  const changes: ContentReleaseFieldChange[] = [];

  if (current.groupKey !== previous.groupKey) {
    changes.push(createFieldChange("groupKey", "Login collection group changed", previous.groupKey, current.groupKey));
  }

  if (!areStringArraysEqual(current.loginKeys, previous.loginKeys)) {
    changes.push(
      createFieldChange("loginKeys", "Login collection members changed", previous.loginKeys, current.loginKeys)
    );
  }

  return changes;
};

const getRecordFieldChanges = (
  fieldPrefix: string,
  messagePrefix: string,
  current: Record<string, string>,
  previous: Record<string, string>
): ContentReleaseFieldChange[] => {
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(current)])).sort();

  return keys.flatMap(key => {
    const before = previous[key] ?? null;
    const after = current[key] ?? null;

    if (before === after) {
      return [];
    }

    return [
      createFieldChange(
        `${fieldPrefix}.${key}`,
        `${messagePrefix} '${key}' changed`,
        before,
        after
      )
    ];
  });
};

const getBookletAssignmentFieldChanges = (
  current: BookletAssignment,
  previous: BookletAssignment
): ContentReleaseFieldChange[] => {
  const changes: ContentReleaseFieldChange[] = [];

  if (current.loginKey !== previous.loginKey) {
    changes.push(createFieldChange("loginKey", "Assignment login changed", previous.loginKey, current.loginKey));
  }

  if (current.bookletKey !== previous.bookletKey) {
    changes.push(
      createFieldChange("bookletKey", "Assignment target booklet changed", previous.bookletKey, current.bookletKey)
    );
  }

  changes.push(
    ...getRecordFieldChanges(
      "initialStateOverrides",
      "Assignment initial state override",
      current.initialStateOverrides,
      previous.initialStateOverrides
    )
  );

  return changes;
};

const getChangeCount = (diff: ContentReleaseEntityDiff): number =>
  diff.addedKeys.length + diff.removedKeys.length + diff.changedKeys.length;

const sortUniqueStrings = (values: Iterable<string>): string[] =>
  Array.from(new Set(Array.from(values).filter(value => value.length > 0))).sort();

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

const collectAssignmentLogins = (
  assignmentKeys: string[],
  currentAssignments: Map<string, BookletAssignment>,
  previousAssignments: Map<string, BookletAssignment>
): string[] =>
  sortUniqueStrings(
    assignmentKeys.flatMap(assignmentKey => {
      const current = currentAssignments.get(assignmentKey);
      const previous = previousAssignments.get(assignmentKey);
      return [current?.loginKey ?? "", previous?.loginKey ?? ""];
    })
  );

const collectCollectionGroups = (
  collectionKeys: string[],
  currentCollections: Map<string, LoginCollection>,
  previousCollections: Map<string, LoginCollection>
): string[] =>
  sortUniqueStrings(
    collectionKeys.flatMap(collectionKey => {
      const current = currentCollections.get(collectionKey);
      const previous = previousCollections.get(collectionKey);
      return [current?.groupKey ?? "", previous?.groupKey ?? ""];
    })
  );

const collectCollectionLogins = (
  collectionKeys: string[],
  currentCollections: Map<string, LoginCollection>,
  previousCollections: Map<string, LoginCollection>
): string[] =>
  sortUniqueStrings(
    collectionKeys.flatMap(collectionKey => {
      const current = currentCollections.get(collectionKey);
      const previous = previousCollections.get(collectionKey);
      return [...(current?.loginKeys ?? []), ...(previous?.loginKeys ?? [])];
    })
  );

const collectBookletKeysForAssignments = (
  assignmentKeys: string[],
  currentAssignments: Map<string, BookletAssignment>,
  previousAssignments: Map<string, BookletAssignment>
): string[] =>
  sortUniqueStrings(
    assignmentKeys.flatMap(assignmentKey => {
      const current = currentAssignments.get(assignmentKey);
      const previous = previousAssignments.get(assignmentKey);
      return [current?.bookletKey ?? "", previous?.bookletKey ?? ""];
    })
  );

const collectBookletLogins = (
  bookletKeys: string[],
  currentAssignments: Map<string, BookletAssignment>,
  previousAssignments: Map<string, BookletAssignment>
): string[] => {
  const bookletKeySet = new Set(bookletKeys);

  return sortUniqueStrings([
    ...Array.from(currentAssignments.values())
      .filter(assignment => bookletKeySet.has(assignment.bookletKey))
      .map(assignment => assignment.loginKey),
    ...Array.from(previousAssignments.values())
      .filter(assignment => bookletKeySet.has(assignment.bookletKey))
      .map(assignment => assignment.loginKey)
  ]);
};

const hasInitialStateChanges = (details: ContentReleaseEntityChangeDetail[]): boolean =>
  details.some(detail =>
    detail.changes.some(change => change.fieldKey.startsWith("initialStateOverrides."))
  );

const createActivationImpact = (input: {
  comparisonType: ContentReleaseDiffSummary["comparisonType"];
  current: ContentRelease;
  previous: ContentRelease | null;
  units: ContentReleaseEntityDiff;
  booklets: ContentReleaseEntityDiff;
  loginCollections: ContentReleaseEntityDiff;
  bookletAssignments: ContentReleaseEntityDiff;
  bookletChangeDetails: ContentReleaseEntityChangeDetail[];
  loginCollectionChangeDetails: ContentReleaseEntityChangeDetail[];
  bookletAssignmentChangeDetails: ContentReleaseEntityChangeDetail[];
  runPoliciesChangedBookletKeys: string[];
  totalChanges: number;
}): ContentReleaseActivationImpact => {
  if (input.comparisonType === "initial_import" || !input.previous) {
    const affectedLoginKeys = sortUniqueStrings(
      input.current.canonicalSnapshot.loginCollections.flatMap(collection => collection.loginKeys)
    );
    const affectedGroupKeys = sortUniqueStrings(
      input.current.canonicalSnapshot.loginCollections.map(collection => collection.groupKey)
    );
    const affectedBookletKeys = sortUniqueStrings(
      input.current.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey)
    );
    const affectedAssignmentKeys = sortUniqueStrings(
      input.current.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey)
    );

    return {
      riskLevel: affectedLoginKeys.length > 0 ? "medium" : "low",
      changedAreas: ["initial_import"],
      affectedLoginCount: affectedLoginKeys.length,
      affectedLoginKeys,
      affectedGroupKeys,
      affectedBookletKeys,
      affectedAssignmentKeys,
      highlights: [
        `Initial activation introduces ${pluralize(affectedLoginKeys.length, "login")} across ${pluralize(affectedGroupKeys.length, "group")}.`,
        `Initial activation introduces ${pluralize(affectedAssignmentKeys.length, "assignment")} across ${pluralize(affectedBookletKeys.length, "booklet")}.`
      ]
    };
  }

  const changedAreas: ContentReleaseImpactArea[] = [];

  if (getChangeCount(input.units) > 0) {
    changedAreas.push("units");
  }

  if (getChangeCount(input.booklets) > 0) {
    changedAreas.push("booklets");
  }

  if (input.runPoliciesChangedBookletKeys.length > 0) {
    changedAreas.push("run_policy");
  }

  if (getChangeCount(input.loginCollections) > 0) {
    changedAreas.push("login_collections");
  }

  if (getChangeCount(input.bookletAssignments) > 0) {
    changedAreas.push("assignment_routing");
  }

  if (hasInitialStateChanges(input.bookletAssignmentChangeDetails)) {
    changedAreas.push("initial_state");
  }

  const currentAssignments = new Map(
    input.current.canonicalSnapshot.bookletAssignments.map(assignment => [assignment.assignmentKey, assignment])
  );
  const previousAssignments = new Map(
    input.previous.canonicalSnapshot.bookletAssignments.map(assignment => [assignment.assignmentKey, assignment])
  );
  const currentCollections = new Map(
    input.current.canonicalSnapshot.loginCollections.map(collection => [collection.collectionKey, collection])
  );
  const previousCollections = new Map(
    input.previous.canonicalSnapshot.loginCollections.map(collection => [collection.collectionKey, collection])
  );

  const affectedAssignmentKeys = sortUniqueStrings([
    ...input.bookletAssignments.addedKeys,
    ...input.bookletAssignments.removedKeys,
    ...input.bookletAssignments.changedKeys
  ]);
  const affectedCollectionKeys = sortUniqueStrings([
    ...input.loginCollections.addedKeys,
    ...input.loginCollections.removedKeys,
    ...input.loginCollections.changedKeys
  ]);
  const affectedBookletKeys = sortUniqueStrings([
    ...input.booklets.addedKeys,
    ...input.booklets.removedKeys,
    ...input.booklets.changedKeys,
    ...collectBookletKeysForAssignments(affectedAssignmentKeys, currentAssignments, previousAssignments),
    ...input.runPoliciesChangedBookletKeys
  ]);
  const affectedGroupKeys = collectCollectionGroups(
    affectedCollectionKeys,
    currentCollections,
    previousCollections
  );
  const affectedLoginKeys = sortUniqueStrings([
    ...collectAssignmentLogins(affectedAssignmentKeys, currentAssignments, previousAssignments),
    ...collectCollectionLogins(affectedCollectionKeys, currentCollections, previousCollections),
    ...collectBookletLogins(affectedBookletKeys, currentAssignments, previousAssignments)
  ]);

  let riskScore = 0;

  if (input.runPoliciesChangedBookletKeys.length > 0) {
    riskScore += 3;
  }

  if (
    input.booklets.removedKeys.length > 0 ||
    input.loginCollections.removedKeys.length > 0 ||
    input.bookletAssignments.removedKeys.length > 0 ||
    input.units.removedKeys.length > 0
  ) {
    riskScore += 3;
  }

  if (
    input.bookletAssignments.addedKeys.length > 0 ||
    input.bookletAssignments.changedKeys.length > 0
  ) {
    riskScore += 2;
  }

  if (
    input.loginCollections.addedKeys.length > 0 ||
    input.loginCollections.changedKeys.length > 0
  ) {
    riskScore += 2;
  }

  if (
    input.booklets.addedKeys.length > 0 ||
    input.booklets.changedKeys.length > 0 ||
    input.units.addedKeys.length > 0
  ) {
    riskScore += 1;
  }

  if (hasInitialStateChanges(input.bookletAssignmentChangeDetails)) {
    riskScore += 1;
  }

  const riskLevel: ContentReleaseImpactRiskLevel =
    input.totalChanges === 0
      ? "none"
      : riskScore >= 5
        ? "high"
        : riskScore >= 2
          ? "medium"
          : "low";

  const highlights: string[] = [];

  if (input.runPoliciesChangedBookletKeys.length > 0) {
    highlights.push(
      `${pluralize(input.runPoliciesChangedBookletKeys.length, "booklet")} changed run policy affecting ${pluralize(affectedLoginKeys.length, "login")}.`
    );
  }

  if (getChangeCount(input.booklets) > 0) {
    highlights.push(
      `${pluralize(input.booklets.addedKeys.length, "booklet")} added, ${pluralize(input.booklets.removedKeys.length, "booklet")} removed, ${pluralize(input.booklets.changedKeys.length, "booklet")} updated.`
    );
  }

  if (getChangeCount(input.loginCollections) > 0) {
    highlights.push(
      `${pluralize(getChangeCount(input.loginCollections), "login collection change")} affect ${pluralize(
        collectCollectionLogins(affectedCollectionKeys, currentCollections, previousCollections).length,
        "login"
      )}.`
    );
  }

  if (getChangeCount(input.bookletAssignments) > 0) {
    highlights.push(
      `${pluralize(getChangeCount(input.bookletAssignments), "assignment change")} affect ${pluralize(
        collectAssignmentLogins(affectedAssignmentKeys, currentAssignments, previousAssignments).length,
        "login"
      )}.`
    );
  }

  if (hasInitialStateChanges(input.bookletAssignmentChangeDetails)) {
    highlights.push(
      `${pluralize(
        input.bookletAssignmentChangeDetails.filter(detail =>
          detail.changes.some(change => change.fieldKey.startsWith("initialStateOverrides."))
        ).length,
        "assignment"
      )} changed initial state overrides.`
    );
  }

  if (highlights.length === 0 && getChangeCount(input.units) > 0) {
    highlights.push(
      `Unit set changed: ${pluralize(input.units.addedKeys.length, "unit")} added and ${pluralize(
        input.units.removedKeys.length,
        "unit"
      )} removed.`
    );
  }

  return {
    riskLevel,
    changedAreas,
    affectedLoginCount: affectedLoginKeys.length,
    affectedLoginKeys,
    affectedGroupKeys,
    affectedBookletKeys,
    affectedAssignmentKeys,
    highlights: highlights.slice(0, 4)
  };
};

const hasIncompatibleRoutingChanges = (diffSummary: ContentReleaseDiffSummary): boolean =>
  diffSummary.units.removedKeys.length > 0 ||
  diffSummary.booklets.removedKeys.length > 0 ||
  diffSummary.loginCollections.removedKeys.length > 0 ||
  diffSummary.bookletAssignments.addedKeys.length > 0 ||
  diffSummary.bookletAssignments.removedKeys.length > 0 ||
  diffSummary.bookletAssignments.changedKeys.length > 0 ||
  diffSummary.bookletChangeDetails.some(detail =>
    detail.changes.some(change => change.fieldKey === "unitKeys")
  );

export const evaluateContentReleaseActivationGuardrail = (input: {
  target: ContentRelease;
  active: ContentRelease | null;
  activeSessions: ContentReleaseActivationSession[];
  policy?: ContentReleaseActivationPolicy;
}): ContentReleaseActivationGuardrail => {
  const policy = input.policy ?? defaultContentReleaseActivationPolicy;
  const activeTestRunIds = sortUniqueStrings(input.activeSessions.map(session => session.testRunId));
  const activeLoginKeys = sortUniqueStrings(input.activeSessions.map(session => session.loginKey));
  const activeGroupKeys = sortUniqueStrings(input.activeSessions.map(session => session.groupKey));

  if (!input.active) {
    return {
      status: "ready",
      comparisonMode: "no_active_release",
      comparedToActiveContentReleaseId: null,
      comparedToActiveReleaseLabel: null,
      activeSessionCount: 0,
      activeTestRunIds: [],
      activeLoginKeys: [],
      activeGroupKeys: [],
      blockingReasonCodes: [],
      warningReasonCodes: [],
      highlights: ["No active release is currently set for this workspace."]
    };
  }

  if (input.active.contentReleaseId === input.target.contentReleaseId) {
    return {
      status: "ready",
      comparisonMode: "already_active",
      comparedToActiveContentReleaseId: input.active.contentReleaseId,
      comparedToActiveReleaseLabel: input.active.releaseLabel,
      activeSessionCount: input.activeSessions.length,
      activeTestRunIds,
      activeLoginKeys,
      activeGroupKeys,
      blockingReasonCodes: [],
      warningReasonCodes: [],
      highlights: ["This release is already active in the workspace."]
    };
  }

  const diffSummary = compareContentReleaseToPrevious(input.target, input.active);
  const warningReasonCodes: ContentReleaseActivationGuardrailCode[] = [];
  const blockingReasonCodes: ContentReleaseActivationGuardrailCode[] = [];

  if (policy.warnOnHighRiskReleaseChange && diffSummary.activationImpact.riskLevel === "high") {
    warningReasonCodes.push("high_risk_release_change");
  }

  if (policy.warnOnActiveSessions && input.activeSessions.length > 0) {
    warningReasonCodes.push("active_sessions_present");
  }

  if (
    policy.blockIncompatibleRoutingChangesWithActiveSessions &&
    input.activeSessions.length > 0 &&
    hasIncompatibleRoutingChanges(diffSummary)
  ) {
    blockingReasonCodes.push("active_sessions_incompatible_routing_change");
  }

  const highlights: string[] = [];

  if (blockingReasonCodes.includes("active_sessions_incompatible_routing_change")) {
    highlights.push(
      `Activation blocked because ${pluralize(input.activeSessions.length, "active session")} coexist with incompatible routing changes.`
    );
  } else if (input.activeSessions.length > 0) {
    highlights.push(
      `${pluralize(input.activeSessions.length, "active session")} are still open in the workspace during this switch.`
    );
  }

  if (warningReasonCodes.includes("high_risk_release_change")) {
    highlights.push(...diffSummary.activationImpact.highlights);
  }

  return {
    status: blockingReasonCodes.length > 0 ? "blocked" : warningReasonCodes.length > 0 ? "warning" : "ready",
    comparisonMode: "switch_from_active_release",
    comparedToActiveContentReleaseId: input.active.contentReleaseId,
    comparedToActiveReleaseLabel: input.active.releaseLabel,
    activeSessionCount: input.activeSessions.length,
    activeTestRunIds,
    activeLoginKeys,
    activeGroupKeys,
    blockingReasonCodes,
    warningReasonCodes,
    highlights: highlights.slice(0, 5)
  };
};

export const buildContentReleaseMonitorProjection = (
  contentRelease: ContentRelease
): ContentReleaseMonitorProjection => {
  const bookletByKey = new Map(
    contentRelease.canonicalSnapshot.bookletDefinitions.map(booklet => [booklet.bookletKey, booklet])
  );
  const groupByLoginKey = new Map<string, {
    collectionKey: string;
    groupKey: string;
  }>();

  for (const collection of contentRelease.canonicalSnapshot.loginCollections) {
    for (const loginKey of collection.loginKeys) {
      groupByLoginKey.set(loginKey, {
        collectionKey: collection.collectionKey,
        groupKey: collection.groupKey
      });
    }
  }

  const groups = contentRelease.canonicalSnapshot.loginCollections.map(collection => ({
    collectionKey: collection.collectionKey,
    groupKey: collection.groupKey,
    loginKeys: collection.loginKeys,
    assignments: contentRelease.canonicalSnapshot.bookletAssignments
      .filter(assignment => collection.loginKeys.includes(assignment.loginKey))
      .map(assignment => {
        const booklet = bookletByKey.get(assignment.bookletKey);

        return {
          assignmentKey: assignment.assignmentKey,
          loginKey: assignment.loginKey,
          bookletKey: assignment.bookletKey,
          bookletTitle: booklet?.title ?? assignment.bookletKey,
          unitCount: booklet?.unitKeys.length ?? 0,
          initialStateOverrides: assignment.initialStateOverrides
        };
      })
  }));

  const booklets = contentRelease.canonicalSnapshot.bookletDefinitions.map(booklet => {
    const assignments = contentRelease.canonicalSnapshot.bookletAssignments.filter(
      assignment => assignment.bookletKey === booklet.bookletKey
    );

    return {
      bookletKey: booklet.bookletKey,
      title: booklet.title,
      runPolicy: booklet.runPolicy,
      unitKeys: booklet.unitKeys,
      groupKeys: sortUniqueStrings(
        assignments.map(assignment => groupByLoginKey.get(assignment.loginKey)?.groupKey ?? "")
      ),
      loginKeys: sortUniqueStrings(assignments.map(assignment => assignment.loginKey)),
      assignmentKeys: assignments.map(assignment => assignment.assignmentKey)
    };
  });

  return {
    groups,
    booklets
  };
};

export const buildContentReleaseSystemCheckProjection = (
  contentRelease: ContentRelease
): ContentReleaseSystemCheckProjection => {
  const loginKeys = contentRelease.canonicalSnapshot.loginCollections.flatMap(collection => collection.loginKeys);
  const groupKeys = contentRelease.canonicalSnapshot.loginCollections.map(collection => collection.groupKey);

  return {
    systemChecks: contentRelease.canonicalSnapshot.systemCheckDefinitions,
    groupKeys,
    loginKeys,
    loginCount: loginKeys.length
  };
};

export const compareContentReleaseToPrevious = (
  current: ContentRelease,
  previous: ContentRelease | null
): ContentReleaseDiffSummary => {
  if (!previous) {
    const initialUnits = createInitialEntityDiff(current.canonicalSnapshot.unitKeys);
    const initialBooklets = createInitialEntityDiff(
      current.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey)
    );
    const initialLoginCollections = createInitialEntityDiff(
      current.canonicalSnapshot.loginCollections.map(collection => collection.collectionKey)
    );
    const initialAssignments = createInitialEntityDiff(
      current.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey)
    );

    const totalChanges =
      getChangeCount(initialUnits) +
      getChangeCount(initialBooklets) +
      getChangeCount(initialLoginCollections) +
      getChangeCount(initialAssignments);

    return {
      baselineContentReleaseId: null,
      baselineReleaseLabel: null,
      comparisonType: "initial_import",
      changed: totalChanges > 0,
      totalChanges,
      units: initialUnits,
      booklets: initialBooklets,
      loginCollections: initialLoginCollections,
      bookletAssignments: initialAssignments,
      bookletChangeDetails: [],
      loginCollectionChangeDetails: [],
      bookletAssignmentChangeDetails: [],
      runPoliciesChangedBookletKeys: [],
      activationImpact: createActivationImpact({
        comparisonType: "initial_import",
        current,
        previous: null,
        units: initialUnits,
        booklets: initialBooklets,
        loginCollections: initialLoginCollections,
        bookletAssignments: initialAssignments,
        bookletChangeDetails: [],
        loginCollectionChangeDetails: [],
        bookletAssignmentChangeDetails: [],
        runPoliciesChangedBookletKeys: [],
        totalChanges
      })
    };
  }

  const units = createEntityDiff({
    currentKeys: current.canonicalSnapshot.unitKeys,
    previousKeys: previous.canonicalSnapshot.unitKeys,
    currentByKey: new Map(current.canonicalSnapshot.unitKeys.map(unitKey => [unitKey, unitKey])),
    previousByKey: new Map(previous.canonicalSnapshot.unitKeys.map(unitKey => [unitKey, unitKey])),
    isChanged: () => false
  });

  const currentBooklets = new Map(
    current.canonicalSnapshot.bookletDefinitions.map(booklet => [booklet.bookletKey, booklet])
  );
  const previousBooklets = new Map(
    previous.canonicalSnapshot.bookletDefinitions.map(booklet => [booklet.bookletKey, booklet])
  );
  const booklets = createEntityDiff({
    currentKeys: current.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey),
    previousKeys: previous.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey),
    currentByKey: currentBooklets,
    previousByKey: previousBooklets,
    isChanged: isBookletChanged
  });
  const bookletChangeDetails = createChangedEntityDetails({
    currentKeys: current.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey),
    previousKeys: previous.canonicalSnapshot.bookletDefinitions.map(booklet => booklet.bookletKey),
    currentByKey: currentBooklets,
    previousByKey: previousBooklets,
    getChanges: getBookletFieldChanges
  });

  const currentLoginCollections = new Map(
    current.canonicalSnapshot.loginCollections.map(collection => [collection.collectionKey, collection])
  );
  const previousLoginCollections = new Map(
    previous.canonicalSnapshot.loginCollections.map(collection => [collection.collectionKey, collection])
  );
  const loginCollections = createEntityDiff({
    currentKeys: current.canonicalSnapshot.loginCollections.map(collection => collection.collectionKey),
    previousKeys: previous.canonicalSnapshot.loginCollections.map(collection => collection.collectionKey),
    currentByKey: currentLoginCollections,
    previousByKey: previousLoginCollections,
    isChanged: isLoginCollectionChanged
  });
  const loginCollectionChangeDetails = createChangedEntityDetails({
    currentKeys: current.canonicalSnapshot.loginCollections.map(collection => collection.collectionKey),
    previousKeys: previous.canonicalSnapshot.loginCollections.map(collection => collection.collectionKey),
    currentByKey: currentLoginCollections,
    previousByKey: previousLoginCollections,
    getChanges: getLoginCollectionFieldChanges
  });

  const currentAssignments = new Map(
    current.canonicalSnapshot.bookletAssignments.map(assignment => [assignment.assignmentKey, assignment])
  );
  const previousAssignments = new Map(
    previous.canonicalSnapshot.bookletAssignments.map(assignment => [assignment.assignmentKey, assignment])
  );
  const bookletAssignments = createEntityDiff({
    currentKeys: current.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey),
    previousKeys: previous.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey),
    currentByKey: currentAssignments,
    previousByKey: previousAssignments,
    isChanged: isBookletAssignmentChanged
  });
  const bookletAssignmentChangeDetails = createChangedEntityDetails({
    currentKeys: current.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey),
    previousKeys: previous.canonicalSnapshot.bookletAssignments.map(assignment => assignment.assignmentKey),
    currentByKey: currentAssignments,
    previousByKey: previousAssignments,
    getChanges: getBookletAssignmentFieldChanges
  });

  const runPoliciesChangedBookletKeys = bookletChangeDetails
    .filter(detail => detail.changes.some(change => change.fieldKey.startsWith("runPolicy.")))
    .map(detail => detail.entityKey);

  const totalChanges =
    getChangeCount(units) +
    getChangeCount(booklets) +
    getChangeCount(loginCollections) +
    getChangeCount(bookletAssignments);

  return {
    baselineContentReleaseId: previous.contentReleaseId,
    baselineReleaseLabel: previous.releaseLabel,
    comparisonType: "successive_import",
    changed: totalChanges > 0,
    totalChanges,
    units,
    booklets,
    loginCollections,
    bookletAssignments,
    bookletChangeDetails,
    loginCollectionChangeDetails,
    bookletAssignmentChangeDetails,
    runPoliciesChangedBookletKeys,
    activationImpact: createActivationImpact({
      comparisonType: "successive_import",
      current,
      previous,
      units,
      booklets,
      loginCollections,
      bookletAssignments,
      bookletChangeDetails,
      loginCollectionChangeDetails,
      bookletAssignmentChangeDetails,
      runPoliciesChangedBookletKeys,
      totalChanges
    })
  };
};
