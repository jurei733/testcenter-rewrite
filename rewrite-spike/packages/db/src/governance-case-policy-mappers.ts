import { resolveGovernanceCasePolicyFamilyFromStatus } from "@testcenter-rewrite/domain";
import type {
  GovernanceCaseChecklistTemplate,
  GovernanceCasePolicy,
  GovernanceCasePolicyOverrideRecords,
  GovernanceCaseQueuePriorityRule,
  GovernanceCaseRecommendedActionRule,
  GovernanceCaseResolutionSummaryFieldRequirement,
  GovernanceCaseResolutionSummaryRequirement,
  GovernanceCaseWorkflowTransitionRule
} from "@testcenter-rewrite/domain";

const legacyGovernanceCasePolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-governance-case-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-governance-case-policy-override"
};

const governanceCaseStatusValues = new Set([
  "awaiting_incident_acknowledgement",
  "suppressed_monitoring",
  "awaiting_redrive",
  "awaiting_alert_acknowledgement",
  "recovered",
  "closed"
]);

const governanceCaseTransitionValues = new Set([
  "start_recovery",
  "mark_waiting_external",
  "close_case",
  "reopen_case"
]);

const mapGovernanceCaseChecklistTemplate = (
  value: unknown
): GovernanceCaseChecklistTemplate | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    (typeof source.caseFamily !== "undefined" &&
      (typeof source.caseFamily !== "string" ||
        !["incident_response", "delivery_recovery", "recovery_follow_up"].includes(
          source.caseFamily
        ))) ||
    (typeof source.caseSeverity !== "undefined" &&
      (typeof source.caseSeverity !== "string" ||
        !["low", "medium", "high"].includes(source.caseSeverity))) ||
    typeof source.caseStatus !== "string" ||
    !governanceCaseStatusValues.has(source.caseStatus) ||
    typeof source.itemKey !== "string" ||
    source.itemKey.trim().length === 0 ||
    typeof source.label !== "string" ||
    source.label.trim().length === 0 ||
    !Array.isArray(source.requiredForTransitions) ||
    source.requiredForTransitions.length === 0 ||
    !source.requiredForTransitions.every(
      transition =>
        typeof transition === "string" && governanceCaseTransitionValues.has(transition)
    )
  ) {
    return null;
  }

  return {
    caseFamily:
      typeof source.caseFamily === "string"
        ? (source.caseFamily as GovernanceCaseChecklistTemplate["caseFamily"])
        : resolveGovernanceCasePolicyFamilyFromStatus(
            source.caseStatus as GovernanceCaseChecklistTemplate["caseStatus"]
          ),
    ...(typeof source.caseSeverity === "string"
      ? {
          caseSeverity: source.caseSeverity as GovernanceCaseChecklistTemplate["caseSeverity"]
        }
      : {}),
    caseStatus: source.caseStatus as GovernanceCaseChecklistTemplate["caseStatus"],
    itemKey: source.itemKey.trim(),
    label: source.label.trim(),
    requiredForTransitions: [...new Set(source.requiredForTransitions)] as GovernanceCaseChecklistTemplate["requiredForTransitions"]
  };
};

const mapGovernanceCaseResolutionSummaryRequirement = (
  value: unknown
): GovernanceCaseResolutionSummaryRequirement | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    (typeof source.caseFamily !== "undefined" &&
      (typeof source.caseFamily !== "string" ||
        !["incident_response", "delivery_recovery", "recovery_follow_up"].includes(
          source.caseFamily
        ))) ||
    (typeof source.caseSeverity !== "undefined" &&
      (typeof source.caseSeverity !== "string" ||
        !["low", "medium", "high"].includes(source.caseSeverity))) ||
    typeof source.prompt !== "string" ||
    source.prompt.trim().length === 0 ||
    typeof source.minimumLength !== "number" ||
    !Number.isInteger(source.minimumLength) ||
    source.minimumLength <= 0 ||
    !Array.isArray(source.requiredForTransitions) ||
    source.requiredForTransitions.length === 0 ||
    !source.requiredForTransitions.every(
      transition =>
        typeof transition === "string" && governanceCaseTransitionValues.has(transition)
    )
  ) {
    return null;
  }

  return {
    caseFamily:
      typeof source.caseFamily === "string"
        ? (source.caseFamily as GovernanceCaseResolutionSummaryRequirement["caseFamily"])
        : "recovery_follow_up",
    ...(typeof source.caseSeverity === "string"
      ? {
          caseSeverity:
            source.caseSeverity as GovernanceCaseResolutionSummaryRequirement["caseSeverity"]
        }
      : {}),
    prompt: source.prompt.trim(),
    minimumLength: source.minimumLength,
    requiredForTransitions: [
      ...new Set(source.requiredForTransitions)
    ] as GovernanceCaseResolutionSummaryRequirement["requiredForTransitions"]
  };
};

const mapGovernanceCaseResolutionSummaryFieldRequirement = (
  value: unknown
): GovernanceCaseResolutionSummaryFieldRequirement | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    (typeof source.caseFamily !== "undefined" &&
      (typeof source.caseFamily !== "string" ||
        !["incident_response", "delivery_recovery", "recovery_follow_up"].includes(
          source.caseFamily
        ))) ||
    (typeof source.caseSeverity !== "undefined" &&
      (typeof source.caseSeverity !== "string" ||
        !["low", "medium", "high"].includes(source.caseSeverity))) ||
    typeof source.fieldKey !== "string" ||
    source.fieldKey.trim().length === 0 ||
    typeof source.label !== "string" ||
    source.label.trim().length === 0 ||
    typeof source.prompt !== "string" ||
    source.prompt.trim().length === 0 ||
    typeof source.minimumLength !== "number" ||
    !Number.isInteger(source.minimumLength) ||
    source.minimumLength <= 0 ||
    !Array.isArray(source.requiredForTransitions) ||
    source.requiredForTransitions.length === 0 ||
    !source.requiredForTransitions.every(
      transition =>
        typeof transition === "string" && governanceCaseTransitionValues.has(transition)
    )
  ) {
    return null;
  }

  return {
    caseFamily:
      typeof source.caseFamily === "string"
        ? (source.caseFamily as GovernanceCaseResolutionSummaryFieldRequirement["caseFamily"])
        : "recovery_follow_up",
    ...(typeof source.caseSeverity === "string"
      ? {
          caseSeverity:
            source.caseSeverity as GovernanceCaseResolutionSummaryFieldRequirement["caseSeverity"]
        }
      : {}),
    fieldKey: source.fieldKey.trim(),
    label: source.label.trim(),
    prompt: source.prompt.trim(),
    minimumLength: source.minimumLength,
    requiredForTransitions: [
      ...new Set(source.requiredForTransitions)
    ] as GovernanceCaseResolutionSummaryFieldRequirement["requiredForTransitions"]
  };
};

const mapGovernanceCaseQueuePriorityRule = (
  value: unknown
): GovernanceCaseQueuePriorityRule | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    typeof source.caseFamily !== "string" ||
    !["incident_response", "delivery_recovery", "recovery_follow_up"].includes(
      source.caseFamily
    ) ||
    typeof source.caseSeverity !== "string" ||
    !["low", "medium", "high"].includes(source.caseSeverity) ||
    (typeof source.caseStatus !== "undefined" &&
      (typeof source.caseStatus !== "string" || !governanceCaseStatusValues.has(source.caseStatus))) ||
    typeof source.priorityRank !== "number" ||
    !Number.isInteger(source.priorityRank) ||
    source.priorityRank <= 0 ||
    typeof source.priorityReason !== "string" ||
    source.priorityReason.trim().length === 0
  ) {
    return null;
  }

  return {
    caseFamily: source.caseFamily as GovernanceCaseQueuePriorityRule["caseFamily"],
    caseSeverity: source.caseSeverity as GovernanceCaseQueuePriorityRule["caseSeverity"],
    ...(typeof source.caseStatus === "string"
      ? { caseStatus: source.caseStatus as GovernanceCaseQueuePriorityRule["caseStatus"] }
      : {}),
    priorityRank: source.priorityRank,
    priorityReason: source.priorityReason.trim()
  };
};

const mapGovernanceCaseRecommendedActionRule = (
  value: unknown
): GovernanceCaseRecommendedActionRule | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    typeof source.caseFamily !== "string" ||
    !["incident_response", "delivery_recovery", "recovery_follow_up"].includes(
      source.caseFamily
    ) ||
    typeof source.caseSeverity !== "string" ||
    !["low", "medium", "high"].includes(source.caseSeverity) ||
    (typeof source.caseStatus !== "undefined" &&
      (typeof source.caseStatus !== "string" ||
        !governanceCaseStatusValues.has(source.caseStatus))) ||
    typeof source.recommendedAction !== "string" ||
    ![
      "assign_case",
      "escalate_case",
      "reopen_case",
      "complete_required_checklist",
      "provide_resolution_summary",
      "acknowledge_incident",
      "wait_for_suppression_expiry",
      "redrive_governance_alert",
      "acknowledge_governance_alert",
      "review_recovery_state",
      "no_action_required",
      "expedite_manual_recovery",
      "request_secondary_review"
    ].includes(source.recommendedAction)
  ) {
    return null;
  }

  return {
    caseFamily: source.caseFamily as GovernanceCaseRecommendedActionRule["caseFamily"],
    caseSeverity: source.caseSeverity as GovernanceCaseRecommendedActionRule["caseSeverity"],
    ...(typeof source.caseStatus === "string"
      ? {
          caseStatus: source.caseStatus as GovernanceCaseRecommendedActionRule["caseStatus"]
        }
      : {}),
    recommendedAction: source.recommendedAction as GovernanceCaseRecommendedActionRule["recommendedAction"]
  };
};

const mapGovernanceCaseWorkflowTransitionRule = (
  value: unknown
): GovernanceCaseWorkflowTransitionRule | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    typeof source.caseFamily !== "string" ||
    !["incident_response", "delivery_recovery", "recovery_follow_up"].includes(
      source.caseFamily
    ) ||
    typeof source.workflowState !== "string" ||
    !["open", "in_recovery", "waiting_external", "closed"].includes(
      source.workflowState
    ) ||
    (typeof source.caseSeverity !== "undefined" &&
      (typeof source.caseSeverity !== "string" ||
        !["low", "medium", "high"].includes(source.caseSeverity))) ||
    typeof source.transition !== "string" ||
    !["start_recovery", "mark_waiting_external", "close_case", "reopen_case"].includes(
      source.transition
    ) ||
    typeof source.enabled !== "boolean" ||
    typeof source.reason !== "string" ||
    source.reason.trim().length === 0
  ) {
    return null;
  }

  return {
    caseFamily: source.caseFamily as GovernanceCaseWorkflowTransitionRule["caseFamily"],
    workflowState: source.workflowState as GovernanceCaseWorkflowTransitionRule["workflowState"],
    ...(typeof source.caseSeverity === "string"
      ? {
          caseSeverity: source.caseSeverity as GovernanceCaseWorkflowTransitionRule["caseSeverity"]
        }
      : {}),
    transition: source.transition as GovernanceCaseWorkflowTransitionRule["transition"],
    enabled: source.enabled,
    reason: source.reason.trim()
  };
};

export const mapGovernanceCasePolicy = (value: unknown): GovernanceCasePolicy | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    !Array.isArray(source.closeChecklistTemplates) ||
    !Array.isArray(source.closeResolutionSummaryRequirements) ||
    !Array.isArray(source.closeResolutionSummaryFieldRequirements) ||
    !Array.isArray(source.queuePriorityRules) ||
    !Array.isArray(source.recommendedActionRules) ||
    !Array.isArray(source.workflowTransitionRules)
  ) {
    return null;
  }

  const closeChecklistTemplates = source.closeChecklistTemplates
    .map(mapGovernanceCaseChecklistTemplate)
    .filter((template): template is GovernanceCaseChecklistTemplate => template !== null)
    .sort((left, right) =>
      left.caseFamily.localeCompare(right.caseFamily) ||
      left.caseStatus.localeCompare(right.caseStatus) ||
      (left.caseSeverity ?? "").localeCompare(right.caseSeverity ?? "") ||
      left.itemKey.localeCompare(right.itemKey)
    );

  if (closeChecklistTemplates.length !== source.closeChecklistTemplates.length) {
    return null;
  }

  const closeResolutionSummaryRequirements = source.closeResolutionSummaryRequirements
    .map(mapGovernanceCaseResolutionSummaryRequirement)
    .filter(
      (
        requirement
      ): requirement is GovernanceCaseResolutionSummaryRequirement => requirement !== null
    )
    .sort(
      (left, right) =>
        left.caseFamily.localeCompare(right.caseFamily) ||
        (left.caseSeverity ?? "").localeCompare(right.caseSeverity ?? "")
    );

  if (
    closeResolutionSummaryRequirements.length !==
    source.closeResolutionSummaryRequirements.length
  ) {
    return null;
  }

  const closeResolutionSummaryFieldRequirements = source.closeResolutionSummaryFieldRequirements
    .map(mapGovernanceCaseResolutionSummaryFieldRequirement)
    .filter(
      (
        requirement
      ): requirement is GovernanceCaseResolutionSummaryFieldRequirement => requirement !== null
    )
    .sort(
      (left, right) =>
        left.caseFamily.localeCompare(right.caseFamily) ||
        (left.caseSeverity ?? "").localeCompare(right.caseSeverity ?? "") ||
        left.fieldKey.localeCompare(right.fieldKey)
    );

  if (
    closeResolutionSummaryFieldRequirements.length !==
    source.closeResolutionSummaryFieldRequirements.length
  ) {
    return null;
  }

  const queuePriorityRules = source.queuePriorityRules
    .map(mapGovernanceCaseQueuePriorityRule)
    .filter((rule): rule is GovernanceCaseQueuePriorityRule => rule !== null)
    .sort(
      (left, right) =>
        left.caseFamily.localeCompare(right.caseFamily) ||
        left.caseSeverity.localeCompare(right.caseSeverity) ||
        (left.caseStatus ?? "").localeCompare(right.caseStatus ?? "")
    );

  if (queuePriorityRules.length !== source.queuePriorityRules.length) {
    return null;
  }

  const recommendedActionRules = source.recommendedActionRules
    .map(mapGovernanceCaseRecommendedActionRule)
    .filter((rule): rule is GovernanceCaseRecommendedActionRule => rule !== null)
    .sort(
      (left, right) =>
        left.caseFamily.localeCompare(right.caseFamily) ||
        left.caseSeverity.localeCompare(right.caseSeverity) ||
        (left.caseStatus ?? "").localeCompare(right.caseStatus ?? "") ||
        left.recommendedAction.localeCompare(right.recommendedAction)
    );

  if (recommendedActionRules.length !== source.recommendedActionRules.length) {
    return null;
  }

  const workflowTransitionRules = source.workflowTransitionRules
    .map(mapGovernanceCaseWorkflowTransitionRule)
    .filter((rule): rule is GovernanceCaseWorkflowTransitionRule => rule !== null)
    .sort(
      (left, right) =>
        left.caseFamily.localeCompare(right.caseFamily) ||
        left.workflowState.localeCompare(right.workflowState) ||
        left.transition.localeCompare(right.transition) ||
        (left.caseSeverity ?? "").localeCompare(right.caseSeverity ?? "")
    );

  if (workflowTransitionRules.length !== source.workflowTransitionRules.length) {
    return null;
  }

  return {
    closeChecklistTemplates,
    closeResolutionSummaryRequirements,
    closeResolutionSummaryFieldRequirements,
    queuePriorityRules,
    recommendedActionRules,
    workflowTransitionRules
  };
};

export const mapGovernanceCasePolicyOverrideRecords = (
  value: unknown
): GovernanceCasePolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const rawTemplates = source.closeChecklistTemplates;
  const rawResolutionSummaryRequirements = source.closeResolutionSummaryRequirements;
  const rawResolutionSummaryFieldRequirements =
    source.closeResolutionSummaryFieldRequirements;
  const rawQueuePriorityRules = source.queuePriorityRules;
  const rawRecommendedActionRules = source.recommendedActionRules;
  const rawWorkflowTransitionRules = source.workflowTransitionRules;

  if (
    (!rawTemplates || typeof rawTemplates !== "object") &&
    (!rawResolutionSummaryRequirements || typeof rawResolutionSummaryRequirements !== "object") &&
    (!rawResolutionSummaryFieldRequirements ||
      typeof rawResolutionSummaryFieldRequirements !== "object") &&
    (!rawQueuePriorityRules || typeof rawQueuePriorityRules !== "object") &&
    (!rawRecommendedActionRules || typeof rawRecommendedActionRules !== "object") &&
    (!rawWorkflowTransitionRules || typeof rawWorkflowTransitionRules !== "object")
  ) {
    return null;
  }

  const records: NonNullable<GovernanceCasePolicyOverrideRecords["closeChecklistTemplates"]> = {};
  const resolutionSummaryRequirementRecords: NonNullable<
    GovernanceCasePolicyOverrideRecords["closeResolutionSummaryRequirements"]
  > = {};
  const resolutionSummaryFieldRequirementRecords: NonNullable<
    GovernanceCasePolicyOverrideRecords["closeResolutionSummaryFieldRequirements"]
  > = {};
  const queuePriorityRuleRecords: NonNullable<
    GovernanceCasePolicyOverrideRecords["queuePriorityRules"]
  > = {};
  const recommendedActionRuleRecords: NonNullable<
    GovernanceCasePolicyOverrideRecords["recommendedActionRules"]
  > = {};
  const workflowTransitionRuleRecords: NonNullable<
    GovernanceCasePolicyOverrideRecords["workflowTransitionRules"]
  > = {};

  if (rawTemplates && typeof rawTemplates === "object") {
    for (const [templateKey, rawRecord] of Object.entries(rawTemplates as Record<string, unknown>)) {
      if (!rawRecord || typeof rawRecord !== "object") {
        continue;
      }

      const recordValue = rawRecord as Record<string, unknown>;
      const template = mapGovernanceCaseChecklistTemplate(recordValue.value);

      if (
        template &&
        typeof recordValue.updatedAt === "string" &&
        typeof recordValue.updatedByRequestId === "string" &&
        typeof recordValue.updatedByActorType === "string" &&
        typeof recordValue.updatedByActorId === "string"
      ) {
        records[templateKey] = {
          value: template,
          updatedAt: recordValue.updatedAt,
          updatedByRequestId: recordValue.updatedByRequestId,
          updatedByActorType: recordValue.updatedByActorType as
            | "platform_api"
            | "participant"
            | "monitor"
            | "worker"
            | "dispatcher"
            | "notification_service",
          updatedByActorId: recordValue.updatedByActorId
        };
        continue;
      }

      const legacyTemplate = mapGovernanceCaseChecklistTemplate(rawRecord);
      if (legacyTemplate) {
        records[templateKey] = {
          value: legacyTemplate,
          ...legacyGovernanceCasePolicyOverrideMetadata
        };
      }
    }
  }

  if (rawResolutionSummaryRequirements && typeof rawResolutionSummaryRequirements === "object") {
    for (const [requirementKey, rawRecord] of Object.entries(
      rawResolutionSummaryRequirements as Record<string, unknown>
    )) {
      if (!rawRecord || typeof rawRecord !== "object") {
        continue;
      }

      const recordValue = rawRecord as Record<string, unknown>;
      const requirement = mapGovernanceCaseResolutionSummaryRequirement(recordValue.value);

      if (
        requirement &&
        typeof recordValue.updatedAt === "string" &&
        typeof recordValue.updatedByRequestId === "string" &&
        typeof recordValue.updatedByActorType === "string" &&
        typeof recordValue.updatedByActorId === "string"
      ) {
        resolutionSummaryRequirementRecords[requirementKey] = {
          value: requirement,
          updatedAt: recordValue.updatedAt,
          updatedByRequestId: recordValue.updatedByRequestId,
          updatedByActorType: recordValue.updatedByActorType as
            | "platform_api"
            | "participant"
            | "monitor"
            | "worker"
            | "dispatcher"
            | "notification_service",
          updatedByActorId: recordValue.updatedByActorId
        };
        continue;
      }

      const legacyRequirement = mapGovernanceCaseResolutionSummaryRequirement(rawRecord);
      if (legacyRequirement) {
        resolutionSummaryRequirementRecords[requirementKey] = {
          value: legacyRequirement,
          ...legacyGovernanceCasePolicyOverrideMetadata
        };
      }
    }
  }

  if (
    rawResolutionSummaryFieldRequirements &&
    typeof rawResolutionSummaryFieldRequirements === "object"
  ) {
    for (const [requirementKey, rawRecord] of Object.entries(
      rawResolutionSummaryFieldRequirements as Record<string, unknown>
    )) {
      if (!rawRecord || typeof rawRecord !== "object") {
        continue;
      }

      const recordValue = rawRecord as Record<string, unknown>;
      const requirement = mapGovernanceCaseResolutionSummaryFieldRequirement(
        recordValue.value
      );

      if (
        requirement &&
        typeof recordValue.updatedAt === "string" &&
        typeof recordValue.updatedByRequestId === "string" &&
        typeof recordValue.updatedByActorType === "string" &&
        typeof recordValue.updatedByActorId === "string"
      ) {
        resolutionSummaryFieldRequirementRecords[requirementKey] = {
          value: requirement,
          updatedAt: recordValue.updatedAt,
          updatedByRequestId: recordValue.updatedByRequestId,
          updatedByActorType: recordValue.updatedByActorType as
            | "platform_api"
            | "participant"
            | "monitor"
            | "worker"
            | "dispatcher"
            | "notification_service",
          updatedByActorId: recordValue.updatedByActorId
        };
        continue;
      }

      const legacyRequirement = mapGovernanceCaseResolutionSummaryFieldRequirement(rawRecord);
      if (legacyRequirement) {
        resolutionSummaryFieldRequirementRecords[requirementKey] = {
          value: legacyRequirement,
          ...legacyGovernanceCasePolicyOverrideMetadata
        };
      }
    }
  }

  if (rawQueuePriorityRules && typeof rawQueuePriorityRules === "object") {
    for (const [ruleKey, rawRecord] of Object.entries(
      rawQueuePriorityRules as Record<string, unknown>
    )) {
      if (!rawRecord || typeof rawRecord !== "object") {
        continue;
      }

      const recordValue = rawRecord as Record<string, unknown>;
      const rule = mapGovernanceCaseQueuePriorityRule(recordValue.value);

      if (
        rule &&
        typeof recordValue.updatedAt === "string" &&
        typeof recordValue.updatedByRequestId === "string" &&
        typeof recordValue.updatedByActorType === "string" &&
        typeof recordValue.updatedByActorId === "string"
      ) {
        queuePriorityRuleRecords[ruleKey] = {
          value: rule,
          updatedAt: recordValue.updatedAt,
          updatedByRequestId: recordValue.updatedByRequestId,
          updatedByActorType: recordValue.updatedByActorType as
            | "platform_api"
            | "participant"
            | "monitor"
            | "worker"
            | "dispatcher"
            | "notification_service",
          updatedByActorId: recordValue.updatedByActorId
        };
        continue;
      }

      const legacyRule = mapGovernanceCaseQueuePriorityRule(rawRecord);
      if (legacyRule) {
        queuePriorityRuleRecords[ruleKey] = {
          value: legacyRule,
          ...legacyGovernanceCasePolicyOverrideMetadata
        };
      }
    }
  }

  if (rawRecommendedActionRules && typeof rawRecommendedActionRules === "object") {
    for (const [ruleKey, rawRecord] of Object.entries(
      rawRecommendedActionRules as Record<string, unknown>
    )) {
      if (!rawRecord || typeof rawRecord !== "object") {
        continue;
      }

      const recordValue = rawRecord as Record<string, unknown>;
      const rule = mapGovernanceCaseRecommendedActionRule(recordValue.value);

      if (
        rule &&
        typeof recordValue.updatedAt === "string" &&
        typeof recordValue.updatedByRequestId === "string" &&
        typeof recordValue.updatedByActorType === "string" &&
        typeof recordValue.updatedByActorId === "string"
      ) {
        recommendedActionRuleRecords[ruleKey] = {
          value: rule,
          updatedAt: recordValue.updatedAt,
          updatedByRequestId: recordValue.updatedByRequestId,
          updatedByActorType: recordValue.updatedByActorType as
            | "platform_api"
            | "participant"
            | "monitor"
            | "worker"
            | "dispatcher"
            | "notification_service",
          updatedByActorId: recordValue.updatedByActorId
        };
        continue;
      }

      const legacyRule = mapGovernanceCaseRecommendedActionRule(rawRecord);
      if (legacyRule) {
        recommendedActionRuleRecords[ruleKey] = {
          value: legacyRule,
          ...legacyGovernanceCasePolicyOverrideMetadata
        };
      }
    }
  }

  if (rawWorkflowTransitionRules && typeof rawWorkflowTransitionRules === "object") {
    for (const [ruleKey, rawRecord] of Object.entries(
      rawWorkflowTransitionRules as Record<string, unknown>
    )) {
      if (!rawRecord || typeof rawRecord !== "object") {
        continue;
      }

      const recordValue = rawRecord as Record<string, unknown>;
      const rule = mapGovernanceCaseWorkflowTransitionRule(recordValue.value);

      if (
        rule &&
        typeof recordValue.updatedAt === "string" &&
        typeof recordValue.updatedByRequestId === "string" &&
        typeof recordValue.updatedByActorType === "string" &&
        typeof recordValue.updatedByActorId === "string"
      ) {
        workflowTransitionRuleRecords[ruleKey] = {
          value: rule,
          updatedAt: recordValue.updatedAt,
          updatedByRequestId: recordValue.updatedByRequestId,
          updatedByActorType: recordValue.updatedByActorType as
            | "platform_api"
            | "participant"
            | "monitor"
            | "worker"
            | "dispatcher"
            | "notification_service",
          updatedByActorId: recordValue.updatedByActorId
        };
        continue;
      }

      const legacyRule = mapGovernanceCaseWorkflowTransitionRule(rawRecord);
      if (legacyRule) {
        workflowTransitionRuleRecords[ruleKey] = {
          value: legacyRule,
          ...legacyGovernanceCasePolicyOverrideMetadata
        };
      }
    }
  }

  return Object.keys(records).length > 0 ||
    Object.keys(resolutionSummaryRequirementRecords).length > 0 ||
    Object.keys(resolutionSummaryFieldRequirementRecords).length > 0 ||
    Object.keys(queuePriorityRuleRecords).length > 0 ||
    Object.keys(recommendedActionRuleRecords).length > 0 ||
    Object.keys(workflowTransitionRuleRecords).length > 0
    ? {
        ...(Object.keys(records).length > 0 ? { closeChecklistTemplates: records } : {}),
        ...(Object.keys(resolutionSummaryRequirementRecords).length > 0
          ? { closeResolutionSummaryRequirements: resolutionSummaryRequirementRecords }
          : {}),
        ...(Object.keys(resolutionSummaryFieldRequirementRecords).length > 0
          ? {
              closeResolutionSummaryFieldRequirements:
                resolutionSummaryFieldRequirementRecords
            }
          : {}),
        ...(Object.keys(queuePriorityRuleRecords).length > 0
          ? { queuePriorityRules: queuePriorityRuleRecords }
          : {}),
        ...(Object.keys(recommendedActionRuleRecords).length > 0
          ? { recommendedActionRules: recommendedActionRuleRecords }
          : {}),
        ...(Object.keys(workflowTransitionRuleRecords).length > 0
          ? { workflowTransitionRules: workflowTransitionRuleRecords }
          : {})
      }
    : null;
};
