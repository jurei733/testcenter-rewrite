import type {
  GovernanceCaseChecklistTemplateDto,
  GovernanceCasePolicyDto,
  GovernanceCasePolicyOverrideDto,
  GovernanceCasePolicyOverrideRecordsDto,
  NotificationProviderProfileGovernanceCaseChecklistItemStatusDto,
  NotificationProviderProfileGovernanceCaseFamilyDto,
  NotificationProviderProfileGovernanceCaseRecommendedActionDto,
  NotificationProviderProfileGovernanceCaseResolutionCodeDto,
  NotificationProviderProfileGovernanceCaseSlaStatusDto,
  NotificationProviderProfileGovernanceCaseStatusDto,
  NotificationProviderProfileGovernanceCaseTransitionTypeDto,
  NotificationProviderProfileGovernanceCaseWorkflowStateDto
} from "@testcenter-rewrite/contracts";
import type {
  GovernanceCaseChecklistTemplate,
  GovernanceCasePolicy,
  GovernanceCasePolicyRecommendedAction,
  GovernanceCaseQueuePriorityRule,
  GovernanceCaseRecommendedActionRule,
  GovernanceCaseResolutionSummaryFieldRequirement,
  GovernanceCaseResolutionSummaryRequirement,
  GovernanceCaseWorkflowTransitionRule,
  PolicyOverrideRecord,
  Workspace
} from "@testcenter-rewrite/domain";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getTrimmedString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const isTrimmedString = (value: unknown): value is string =>
  typeof getTrimmedString(value) === "string";

const isNotificationProviderProfileGovernanceCaseStatus = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseStatusDto =>
  value === "awaiting_incident_acknowledgement" ||
  value === "suppressed_monitoring" ||
  value === "awaiting_redrive" ||
  value === "awaiting_alert_acknowledgement" ||
  value === "recovered" ||
  value === "closed";

const isNotificationProviderProfileGovernanceCaseFamily = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseFamilyDto =>
  value === "incident_response" ||
  value === "delivery_recovery" ||
  value === "recovery_follow_up";

const isNotificationProviderProfileGovernanceCaseSeverity = (
  value: unknown
): value is "low" | "medium" | "high" =>
  value === "low" || value === "medium" || value === "high";

const isNotificationProviderProfileGovernanceCaseWorkflowState = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseWorkflowStateDto =>
  value === "open" ||
  value === "in_recovery" ||
  value === "waiting_external" ||
  value === "closed";

const isNotificationProviderProfileGovernanceCaseTransitionType = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseTransitionTypeDto =>
  value === "start_recovery" ||
  value === "mark_waiting_external" ||
  value === "close_case" ||
  value === "reopen_case";

const isNotificationProviderProfileGovernanceCaseRecommendedAction = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseRecommendedActionDto =>
  value === "assign_case" ||
  value === "escalate_case" ||
  value === "reopen_case" ||
  value === "complete_required_checklist" ||
  value === "provide_resolution_summary" ||
  value === "acknowledge_incident" ||
  value === "wait_for_suppression_expiry" ||
  value === "redrive_governance_alert" ||
  value === "acknowledge_governance_alert" ||
  value === "review_recovery_state" ||
  value === "expedite_manual_recovery" ||
  value === "request_secondary_review" ||
  value === "no_action_required";

const isKnownAuditActorType = (value: unknown): boolean =>
  value === "platform_api" ||
  value === "participant" ||
  value === "monitor" ||
  value === "worker" ||
  value === "dispatcher" ||
  value === "notification_service";

export const isGovernanceCaseChecklistTemplate = (
  value: unknown
): value is GovernanceCaseChecklistTemplateDto => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNotificationProviderProfileGovernanceCaseFamily(value.caseFamily) ||
    !isNotificationProviderProfileGovernanceCaseStatus(value.caseStatus) ||
    ("caseSeverity" in value &&
      typeof value.caseSeverity !== "undefined" &&
      !isNotificationProviderProfileGovernanceCaseSeverity(value.caseSeverity)) ||
    !isTrimmedString(value.itemKey) ||
    !isTrimmedString(value.label) ||
    !Array.isArray(value.requiredForTransitions) ||
    value.requiredForTransitions.length === 0
  ) {
    return false;
  }

  const requiredForTransitions = value.requiredForTransitions.filter(
    isNotificationProviderProfileGovernanceCaseTransitionType
  );

  return requiredForTransitions.length === value.requiredForTransitions.length;
};

export const isGovernanceCaseResolutionSummaryRequirement = (
  value: unknown
): value is {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  prompt: string;
  minimumLength: number;
  requiredForTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
} => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNotificationProviderProfileGovernanceCaseFamily(value.caseFamily) ||
    ("caseSeverity" in value &&
      typeof value.caseSeverity !== "undefined" &&
      !isNotificationProviderProfileGovernanceCaseSeverity(value.caseSeverity)) ||
    !isTrimmedString(value.prompt) ||
    typeof value.minimumLength !== "number" ||
    !Number.isInteger(value.minimumLength) ||
    value.minimumLength <= 0 ||
    !Array.isArray(value.requiredForTransitions) ||
    value.requiredForTransitions.length === 0
  ) {
    return false;
  }

  const requiredForTransitions = value.requiredForTransitions.filter(
    isNotificationProviderProfileGovernanceCaseTransitionType
  );

  return requiredForTransitions.length === value.requiredForTransitions.length;
};

export const isGovernanceCaseResolutionSummaryFieldRequirement = (
  value: unknown
): value is {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  fieldKey: string;
  label: string;
  prompt: string;
  minimumLength: number;
  requiredForTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
} => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNotificationProviderProfileGovernanceCaseFamily(value.caseFamily) ||
    ("caseSeverity" in value &&
      typeof value.caseSeverity !== "undefined" &&
      !isNotificationProviderProfileGovernanceCaseSeverity(value.caseSeverity)) ||
    !isTrimmedString(value.fieldKey) ||
    !isTrimmedString(value.label) ||
    !isTrimmedString(value.prompt) ||
    typeof value.minimumLength !== "number" ||
    !Number.isInteger(value.minimumLength) ||
    value.minimumLength <= 0 ||
    !Array.isArray(value.requiredForTransitions) ||
    value.requiredForTransitions.length === 0
  ) {
    return false;
  }

  const requiredForTransitions = value.requiredForTransitions.filter(
    isNotificationProviderProfileGovernanceCaseTransitionType
  );

  return requiredForTransitions.length === value.requiredForTransitions.length;
};

export const isGovernanceCaseQueuePriorityRule = (
  value: unknown
): value is {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  caseStatus?: NotificationProviderProfileGovernanceCaseStatusDto;
  priorityRank: number;
  priorityReason: string;
} => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNotificationProviderProfileGovernanceCaseFamily(value.caseFamily) &&
    isNotificationProviderProfileGovernanceCaseSeverity(value.caseSeverity) &&
    (!("caseStatus" in value) ||
      typeof value.caseStatus === "undefined" ||
      isNotificationProviderProfileGovernanceCaseStatus(value.caseStatus)) &&
    typeof value.priorityRank === "number" &&
    Number.isInteger(value.priorityRank) &&
    value.priorityRank > 0 &&
    isTrimmedString(value.priorityReason)
  );
};

export const isGovernanceCaseRecommendedActionRule = (
  value: unknown
): value is {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  caseStatus?: NotificationProviderProfileGovernanceCaseStatusDto;
  recommendedAction: NotificationProviderProfileGovernanceCaseRecommendedActionDto;
} => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNotificationProviderProfileGovernanceCaseFamily(value.caseFamily) &&
    isNotificationProviderProfileGovernanceCaseSeverity(value.caseSeverity) &&
    (!("caseStatus" in value) ||
      typeof value.caseStatus === "undefined" ||
      isNotificationProviderProfileGovernanceCaseStatus(value.caseStatus)) &&
    isNotificationProviderProfileGovernanceCaseRecommendedAction(value.recommendedAction)
  );
};

export const isGovernanceCaseWorkflowTransitionRule = (
  value: unknown
): value is {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  workflowState: NotificationProviderProfileGovernanceCaseWorkflowStateDto;
  caseSeverity?: "low" | "medium" | "high";
  transition: NotificationProviderProfileGovernanceCaseTransitionTypeDto;
  enabled: boolean;
  reason: string;
} => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNotificationProviderProfileGovernanceCaseFamily(value.caseFamily) &&
    isNotificationProviderProfileGovernanceCaseWorkflowState(value.workflowState) &&
    (!("caseSeverity" in value) ||
      typeof value.caseSeverity === "undefined" ||
      isNotificationProviderProfileGovernanceCaseSeverity(value.caseSeverity)) &&
    isNotificationProviderProfileGovernanceCaseTransitionType(value.transition) &&
    typeof value.enabled === "boolean" &&
    isTrimmedString(value.reason)
  );
};

export const isGovernanceCasePolicy = (
  value: unknown
): value is GovernanceCasePolicyDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  const expectedKeys = [
    "closeChecklistTemplates",
    "closeResolutionSummaryRequirements",
    "closeResolutionSummaryFieldRequirements",
    "queuePriorityRules",
    "recommendedActionRules",
    "workflowTransitionRules"
  ];

  if (keys.length !== expectedKeys.length || !keys.every(key => expectedKeys.includes(key))) {
    return false;
  }

  return (
    Array.isArray(value.closeChecklistTemplates) &&
    value.closeChecklistTemplates.every(isGovernanceCaseChecklistTemplate) &&
    Array.isArray(value.closeResolutionSummaryRequirements) &&
    value.closeResolutionSummaryRequirements.every(
      isGovernanceCaseResolutionSummaryRequirement
    ) &&
    Array.isArray(value.closeResolutionSummaryFieldRequirements) &&
    value.closeResolutionSummaryFieldRequirements.every(
      isGovernanceCaseResolutionSummaryFieldRequirement
    ) &&
    Array.isArray(value.queuePriorityRules) &&
    value.queuePriorityRules.every(isGovernanceCaseQueuePriorityRule) &&
    Array.isArray(value.recommendedActionRules) &&
    value.recommendedActionRules.every(isGovernanceCaseRecommendedActionRule) &&
    Array.isArray(value.workflowTransitionRules) &&
    value.workflowTransitionRules.every(isGovernanceCaseWorkflowTransitionRule)
  );
};

export const isGovernanceCasePolicyOverride = (
  value: unknown
): value is GovernanceCasePolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  const allowedKeys = [
    "closeChecklistTemplates",
    "closeResolutionSummaryRequirements",
    "closeResolutionSummaryFieldRequirements",
    "queuePriorityRules",
    "recommendedActionRules",
    "workflowTransitionRules"
  ];

  if (keys.length === 0 || !keys.every(key => allowedKeys.includes(key))) {
    return false;
  }

  return (
    (!("closeChecklistTemplates" in value) ||
      (Array.isArray(value.closeChecklistTemplates) &&
        value.closeChecklistTemplates.length > 0 &&
        value.closeChecklistTemplates.every(isGovernanceCaseChecklistTemplate))) &&
    (!("closeResolutionSummaryRequirements" in value) ||
      (Array.isArray(value.closeResolutionSummaryRequirements) &&
        value.closeResolutionSummaryRequirements.length > 0 &&
        value.closeResolutionSummaryRequirements.every(
          isGovernanceCaseResolutionSummaryRequirement
        ))) &&
    (!("closeResolutionSummaryFieldRequirements" in value) ||
      (Array.isArray(value.closeResolutionSummaryFieldRequirements) &&
        value.closeResolutionSummaryFieldRequirements.length > 0 &&
        value.closeResolutionSummaryFieldRequirements.every(
          isGovernanceCaseResolutionSummaryFieldRequirement
        ))) &&
    (!("queuePriorityRules" in value) ||
      (Array.isArray(value.queuePriorityRules) &&
        value.queuePriorityRules.length > 0 &&
        value.queuePriorityRules.every(isGovernanceCaseQueuePriorityRule))) &&
    (!("recommendedActionRules" in value) ||
      (Array.isArray(value.recommendedActionRules) &&
        value.recommendedActionRules.length > 0 &&
        value.recommendedActionRules.every(isGovernanceCaseRecommendedActionRule))) &&
    (!("workflowTransitionRules" in value) ||
      (Array.isArray(value.workflowTransitionRules) &&
        value.workflowTransitionRules.length > 0 &&
        value.workflowTransitionRules.every(isGovernanceCaseWorkflowTransitionRule)))
  );
};

export const isGovernanceCasePolicyOverrideRecordsDto = (
  value: unknown
): value is GovernanceCasePolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !("closeChecklistTemplates" in value) &&
    !("closeResolutionSummaryRequirements" in value) &&
    !("closeResolutionSummaryFieldRequirements" in value) &&
    !("queuePriorityRules" in value) &&
    !("recommendedActionRules" in value) &&
    !("workflowTransitionRules" in value)
  ) {
    return false;
  }

  return (
    (!("closeChecklistTemplates" in value) ||
      (Array.isArray(value.closeChecklistTemplates) &&
        value.closeChecklistTemplates.every(record => {
          if (!isRecord(record)) {
            return false;
          }

          return (
            isGovernanceCaseChecklistTemplate(record.value) &&
            isTrimmedString(record.updatedAt) &&
            isTrimmedString(record.updatedByRequestId) &&
            isKnownAuditActorType(record.updatedByActorType) &&
            isTrimmedString(record.updatedByActorId)
          );
        }))) &&
    (!("closeResolutionSummaryRequirements" in value) ||
      (Array.isArray(value.closeResolutionSummaryRequirements) &&
        value.closeResolutionSummaryRequirements.every(record => {
          if (!isRecord(record)) {
            return false;
          }

          return (
            isGovernanceCaseResolutionSummaryRequirement(record.value) &&
            isTrimmedString(record.updatedAt) &&
            isTrimmedString(record.updatedByRequestId) &&
            isKnownAuditActorType(record.updatedByActorType) &&
            isTrimmedString(record.updatedByActorId)
          );
        }))) &&
    (!("closeResolutionSummaryFieldRequirements" in value) ||
      (Array.isArray(value.closeResolutionSummaryFieldRequirements) &&
        value.closeResolutionSummaryFieldRequirements.every(record => {
          if (!isRecord(record)) {
            return false;
          }

          return (
            isGovernanceCaseResolutionSummaryFieldRequirement(record.value) &&
            isTrimmedString(record.updatedAt) &&
            isTrimmedString(record.updatedByRequestId) &&
            isKnownAuditActorType(record.updatedByActorType) &&
            isTrimmedString(record.updatedByActorId)
          );
        }))) &&
    (!("queuePriorityRules" in value) ||
      (Array.isArray(value.queuePriorityRules) &&
        value.queuePriorityRules.every(record => {
          if (!isRecord(record)) {
            return false;
          }

          return (
            isGovernanceCaseQueuePriorityRule(record.value) &&
            isTrimmedString(record.updatedAt) &&
            isTrimmedString(record.updatedByRequestId) &&
            isKnownAuditActorType(record.updatedByActorType) &&
            isTrimmedString(record.updatedByActorId)
          );
        }))) &&
    (!("recommendedActionRules" in value) ||
      (Array.isArray(value.recommendedActionRules) &&
        value.recommendedActionRules.every(record => {
          if (!isRecord(record)) {
            return false;
          }

          return (
            isGovernanceCaseRecommendedActionRule(record.value) &&
            isTrimmedString(record.updatedAt) &&
            isTrimmedString(record.updatedByRequestId) &&
            isKnownAuditActorType(record.updatedByActorType) &&
            isTrimmedString(record.updatedByActorId)
          );
        }))) &&
    (!("workflowTransitionRules" in value) ||
      (Array.isArray(value.workflowTransitionRules) &&
        value.workflowTransitionRules.every(record => {
          if (!isRecord(record)) {
            return false;
          }

          return (
            isGovernanceCaseWorkflowTransitionRule(record.value) &&
            isTrimmedString(record.updatedAt) &&
            isTrimmedString(record.updatedByRequestId) &&
            isKnownAuditActorType(record.updatedByActorType) &&
            isTrimmedString(record.updatedByActorId)
          );
        })))
  );
};

export const toGovernanceCaseChecklistTemplateDto = (
  template: GovernanceCaseChecklistTemplate
): GovernanceCaseChecklistTemplateDto => ({
  caseFamily: template.caseFamily,
  caseStatus: template.caseStatus,
  ...(template.caseSeverity ? { caseSeverity: template.caseSeverity } : {}),
  itemKey: template.itemKey,
  label: template.label,
  requiredForTransitions: [...template.requiredForTransitions]
});

export const toGovernanceCaseResolutionSummaryRequirementDto = (requirement: {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity?: "low" | "medium" | "high";
  prompt: string;
  minimumLength: number;
  requiredForTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
}) => ({
  caseFamily: requirement.caseFamily,
  ...(requirement.caseSeverity ? { caseSeverity: requirement.caseSeverity } : {}),
  prompt: requirement.prompt,
  minimumLength: requirement.minimumLength,
  requiredForTransitions: [...requirement.requiredForTransitions]
});

export const toGovernanceCaseResolutionSummaryFieldRequirementDto = (requirement: {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity?: "low" | "medium" | "high";
  fieldKey: string;
  label: string;
  prompt: string;
  minimumLength: number;
  requiredForTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
}) => ({
  caseFamily: requirement.caseFamily,
  ...(requirement.caseSeverity ? { caseSeverity: requirement.caseSeverity } : {}),
  fieldKey: requirement.fieldKey,
  label: requirement.label,
  prompt: requirement.prompt,
  minimumLength: requirement.minimumLength,
  requiredForTransitions: [...requirement.requiredForTransitions]
});

const toGovernanceCaseQueuePriorityRuleDto = (rule: {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  caseStatus?: NotificationProviderProfileGovernanceCaseStatusDto;
  priorityRank: number;
  priorityReason: string;
}) => ({
  caseFamily: rule.caseFamily,
  caseSeverity: rule.caseSeverity,
  ...(rule.caseStatus ? { caseStatus: rule.caseStatus } : {}),
  priorityRank: rule.priorityRank,
  priorityReason: rule.priorityReason
});

const toGovernanceCaseRecommendedActionRuleDto = (rule: {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  caseStatus?: NotificationProviderProfileGovernanceCaseStatusDto;
  recommendedAction: NotificationProviderProfileGovernanceCaseRecommendedActionDto;
}) => ({
  caseFamily: rule.caseFamily,
  caseSeverity: rule.caseSeverity,
  ...(rule.caseStatus ? { caseStatus: rule.caseStatus } : {}),
  recommendedAction: rule.recommendedAction
});

const toGovernanceCaseWorkflowTransitionRuleDto = (rule: {
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  workflowState: NotificationProviderProfileGovernanceCaseWorkflowStateDto;
  caseSeverity?: "low" | "medium" | "high";
  transition: NotificationProviderProfileGovernanceCaseTransitionTypeDto;
  enabled: boolean;
  reason: string;
}) => ({
  caseFamily: rule.caseFamily,
  workflowState: rule.workflowState,
  ...(rule.caseSeverity ? { caseSeverity: rule.caseSeverity } : {}),
  transition: rule.transition,
  enabled: rule.enabled,
  reason: rule.reason
});

export const toGovernanceCasePolicyDto = (
  governanceCasePolicy: GovernanceCasePolicy
): GovernanceCasePolicyDto => ({
  closeChecklistTemplates: governanceCasePolicy.closeChecklistTemplates.map(
    toGovernanceCaseChecklistTemplateDto
  ),
  closeResolutionSummaryRequirements:
    governanceCasePolicy.closeResolutionSummaryRequirements.map(
      toGovernanceCaseResolutionSummaryRequirementDto
    ),
  closeResolutionSummaryFieldRequirements:
    governanceCasePolicy.closeResolutionSummaryFieldRequirements.map(
      toGovernanceCaseResolutionSummaryFieldRequirementDto
    ),
  queuePriorityRules: governanceCasePolicy.queuePriorityRules.map(
    toGovernanceCaseQueuePriorityRuleDto
  ),
  recommendedActionRules: governanceCasePolicy.recommendedActionRules.map(
    toGovernanceCaseRecommendedActionRuleDto
  ),
  workflowTransitionRules: governanceCasePolicy.workflowTransitionRules.map(
    toGovernanceCaseWorkflowTransitionRuleDto
  )
});

export const toGovernanceCasePolicyOverrideDto = (
  governanceCasePolicyOverride: GovernanceCasePolicyOverrideDto
): GovernanceCasePolicyOverrideDto => ({
  ...(Array.isArray(governanceCasePolicyOverride.closeChecklistTemplates) &&
  governanceCasePolicyOverride.closeChecklistTemplates.length > 0
    ? {
        closeChecklistTemplates: governanceCasePolicyOverride.closeChecklistTemplates.map(
          template => ({
            caseFamily: template.caseFamily,
            caseStatus: template.caseStatus,
            ...(template.caseSeverity ? { caseSeverity: template.caseSeverity } : {}),
            itemKey: template.itemKey,
            label: template.label,
            requiredForTransitions: [...template.requiredForTransitions]
          })
        )
      }
    : {}),
  ...(Array.isArray(governanceCasePolicyOverride.closeResolutionSummaryRequirements) &&
  governanceCasePolicyOverride.closeResolutionSummaryRequirements.length > 0
    ? {
        closeResolutionSummaryRequirements:
          governanceCasePolicyOverride.closeResolutionSummaryRequirements.map(
            requirement => toGovernanceCaseResolutionSummaryRequirementDto(requirement)
          )
      }
    : {}),
  ...(Array.isArray(governanceCasePolicyOverride.closeResolutionSummaryFieldRequirements) &&
  governanceCasePolicyOverride.closeResolutionSummaryFieldRequirements.length > 0
    ? {
        closeResolutionSummaryFieldRequirements:
          governanceCasePolicyOverride.closeResolutionSummaryFieldRequirements.map(
            requirement => toGovernanceCaseResolutionSummaryFieldRequirementDto(requirement)
          )
      }
    : {}),
  ...(Array.isArray(governanceCasePolicyOverride.queuePriorityRules) &&
  governanceCasePolicyOverride.queuePriorityRules.length > 0
    ? {
        queuePriorityRules: governanceCasePolicyOverride.queuePriorityRules.map(
          toGovernanceCaseQueuePriorityRuleDto
        )
      }
    : {}),
  ...(Array.isArray(governanceCasePolicyOverride.recommendedActionRules) &&
  governanceCasePolicyOverride.recommendedActionRules.length > 0
    ? {
        recommendedActionRules:
          governanceCasePolicyOverride.recommendedActionRules.map(
            toGovernanceCaseRecommendedActionRuleDto
          )
      }
    : {}),
  ...(Array.isArray(governanceCasePolicyOverride.workflowTransitionRules) &&
  governanceCasePolicyOverride.workflowTransitionRules.length > 0
    ? {
        workflowTransitionRules:
          governanceCasePolicyOverride.workflowTransitionRules.map(
            toGovernanceCaseWorkflowTransitionRuleDto
          )
      }
    : {})
});

const toGovernanceCasePolicyOverrideRecordDto = (
  record: PolicyOverrideRecord<GovernanceCaseChecklistTemplate>
) => ({
  value: toGovernanceCaseChecklistTemplateDto(record.value),
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toGovernanceCaseResolutionSummaryRequirementOverrideRecordDto = (
  record: PolicyOverrideRecord<{
    caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
    prompt: string;
    minimumLength: number;
    requiredForTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
  }>
) => ({
  value: toGovernanceCaseResolutionSummaryRequirementDto(record.value),
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toGovernanceCaseResolutionSummaryFieldRequirementOverrideRecordDto = (
  record: PolicyOverrideRecord<{
    caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
    fieldKey: string;
    label: string;
    prompt: string;
    minimumLength: number;
    requiredForTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
  }>
) => ({
  value: toGovernanceCaseResolutionSummaryFieldRequirementDto(record.value),
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toGovernanceCaseQueuePriorityRuleOverrideRecordDto = (
  record: PolicyOverrideRecord<{
    caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
    caseSeverity: "low" | "medium" | "high";
    caseStatus?: NotificationProviderProfileGovernanceCaseStatusDto;
    priorityRank: number;
    priorityReason: string;
  }>
) => ({
  value: toGovernanceCaseQueuePriorityRuleDto(record.value),
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toGovernanceCaseRecommendedActionRuleOverrideRecordDto = (
  record: PolicyOverrideRecord<{
    caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
    caseSeverity: "low" | "medium" | "high";
    caseStatus?: NotificationProviderProfileGovernanceCaseStatusDto;
    recommendedAction: NotificationProviderProfileGovernanceCaseRecommendedActionDto;
  }>
) => ({
  value: toGovernanceCaseRecommendedActionRuleDto(record.value),
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toGovernanceCaseWorkflowTransitionRuleOverrideRecordDto = (
  record: PolicyOverrideRecord<{
    caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
    workflowState: NotificationProviderProfileGovernanceCaseWorkflowStateDto;
    caseSeverity?: "low" | "medium" | "high";
    transition: NotificationProviderProfileGovernanceCaseTransitionTypeDto;
    enabled: boolean;
    reason: string;
  }>
) => ({
  value: toGovernanceCaseWorkflowTransitionRuleDto(record.value),
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

export const toGovernanceCasePolicyOverrideRecordsDto = (
  governanceCasePolicyOverrideRecords: Workspace["governanceCasePolicyOverrideRecords"]
): GovernanceCasePolicyOverrideRecordsDto | null => {
  if (
    !governanceCasePolicyOverrideRecords?.closeChecklistTemplates &&
    !governanceCasePolicyOverrideRecords?.closeResolutionSummaryRequirements &&
    !governanceCasePolicyOverrideRecords?.closeResolutionSummaryFieldRequirements &&
    !governanceCasePolicyOverrideRecords?.queuePriorityRules &&
    !governanceCasePolicyOverrideRecords?.recommendedActionRules &&
    !governanceCasePolicyOverrideRecords?.workflowTransitionRules
  ) {
    return null;
  }

  return {
    ...(governanceCasePolicyOverrideRecords.closeChecklistTemplates
      ? {
          closeChecklistTemplates: Object.values(
            governanceCasePolicyOverrideRecords.closeChecklistTemplates
          )
            .map(toGovernanceCasePolicyOverrideRecordDto)
            .sort((left, right) =>
              left.value.caseFamily.localeCompare(right.value.caseFamily) ||
              left.value.caseStatus.localeCompare(right.value.caseStatus) ||
              (left.value.caseSeverity ?? "").localeCompare(right.value.caseSeverity ?? "") ||
              left.value.itemKey.localeCompare(right.value.itemKey)
            )
        }
      : {}),
    ...(governanceCasePolicyOverrideRecords.closeResolutionSummaryRequirements
      ? {
          closeResolutionSummaryRequirements: Object.values(
            governanceCasePolicyOverrideRecords.closeResolutionSummaryRequirements
          )
            .map(toGovernanceCaseResolutionSummaryRequirementOverrideRecordDto)
            .sort(
              (left, right) =>
                left.value.caseFamily.localeCompare(right.value.caseFamily) ||
                (left.value.caseSeverity ?? "").localeCompare(
                  right.value.caseSeverity ?? ""
                )
            )
        }
      : {}),
    ...(governanceCasePolicyOverrideRecords.closeResolutionSummaryFieldRequirements
      ? {
          closeResolutionSummaryFieldRequirements: Object.values(
            governanceCasePolicyOverrideRecords.closeResolutionSummaryFieldRequirements
          )
            .map(toGovernanceCaseResolutionSummaryFieldRequirementOverrideRecordDto)
            .sort(
              (left, right) =>
                left.value.caseFamily.localeCompare(right.value.caseFamily) ||
                (left.value.caseSeverity ?? "").localeCompare(
                  right.value.caseSeverity ?? ""
                ) ||
                left.value.fieldKey.localeCompare(right.value.fieldKey)
            )
        }
      : {}),
    ...(governanceCasePolicyOverrideRecords.queuePriorityRules
      ? {
          queuePriorityRules: Object.values(
            governanceCasePolicyOverrideRecords.queuePriorityRules
          )
            .map(toGovernanceCaseQueuePriorityRuleOverrideRecordDto)
            .sort(
              (left, right) =>
                left.value.caseFamily.localeCompare(right.value.caseFamily) ||
                left.value.caseSeverity.localeCompare(right.value.caseSeverity) ||
                (left.value.caseStatus ?? "").localeCompare(right.value.caseStatus ?? "")
            )
        }
      : {}),
    ...(governanceCasePolicyOverrideRecords.recommendedActionRules
      ? {
          recommendedActionRules: Object.values(
            governanceCasePolicyOverrideRecords.recommendedActionRules
          )
            .map(toGovernanceCaseRecommendedActionRuleOverrideRecordDto)
            .sort(
              (left, right) =>
                left.value.caseFamily.localeCompare(right.value.caseFamily) ||
                left.value.caseSeverity.localeCompare(right.value.caseSeverity) ||
                (left.value.caseStatus ?? "").localeCompare(right.value.caseStatus ?? "") ||
                left.value.recommendedAction.localeCompare(right.value.recommendedAction)
            )
        }
      : {}),
    ...(governanceCasePolicyOverrideRecords.workflowTransitionRules
      ? {
          workflowTransitionRules: Object.values(
            governanceCasePolicyOverrideRecords.workflowTransitionRules
          )
            .map(toGovernanceCaseWorkflowTransitionRuleOverrideRecordDto)
            .sort(
              (left, right) =>
                left.value.caseFamily.localeCompare(right.value.caseFamily) ||
                left.value.workflowState.localeCompare(right.value.workflowState) ||
                left.value.transition.localeCompare(right.value.transition) ||
                (left.value.caseSeverity ?? "").localeCompare(
                  right.value.caseSeverity ?? ""
                )
            )
        }
      : {})
  };
};

export const getGovernanceCaseChecklistTemplateKey = (template: {
  caseFamily: string;
  caseStatus: string;
  caseSeverity?: string;
  itemKey: string;
}): string =>
  `${template.caseFamily}:${template.caseStatus}:${template.itemKey}${
    template.caseSeverity ? `:${template.caseSeverity}` : ""
  }`;

export const getGovernanceCaseResolutionSummaryRequirementKey = (requirement: {
  caseFamily: string;
  caseSeverity?: string;
}): string =>
  `resolution_summary:${requirement.caseFamily}${
    requirement.caseSeverity ? `:${requirement.caseSeverity}` : ""
  }`;

export const getGovernanceCaseResolutionSummaryFieldRequirementKey = (requirement: {
  caseFamily: string;
  fieldKey: string;
  caseSeverity?: string;
}): string =>
  `resolution_summary_field:${requirement.caseFamily}:${requirement.fieldKey}${
    requirement.caseSeverity ? `:${requirement.caseSeverity}` : ""
  }`;

export const getGovernanceCaseQueuePriorityRuleKey = (rule: {
  caseFamily: string;
  caseSeverity: string;
  caseStatus?: string;
}): string =>
  `queue_priority:${rule.caseFamily}:${rule.caseSeverity}${
    rule.caseStatus ? `:${rule.caseStatus}` : ""
  }`;

export const getGovernanceCaseRecommendedActionRuleKey = (rule: {
  caseFamily: string;
  caseSeverity: string;
  caseStatus?: string;
  recommendedAction: string;
}): string =>
  `recommended_action:${rule.caseFamily}:${rule.caseSeverity}${
    rule.caseStatus ? `:${rule.caseStatus}` : ""
  }:${rule.recommendedAction}`;

export const getGovernanceCaseWorkflowTransitionRuleKey = (rule: {
  caseFamily: string;
  workflowState: string;
  caseSeverity?: string;
  transition: string;
}): string =>
  `workflow_transition:${rule.caseFamily}:${rule.workflowState}:${rule.transition}${
    rule.caseSeverity ? `:${rule.caseSeverity}` : ""
  }`;

export const hasDuplicateGovernanceCaseChecklistTemplates = (
  templates: GovernanceCaseChecklistTemplateDto[]
): boolean => {
  const seen = new Set<string>();

  for (const template of templates) {
    const templateKey = getGovernanceCaseChecklistTemplateKey(template);
    if (seen.has(templateKey)) {
      return true;
    }
    seen.add(templateKey);
  }

  return false;
};

export const hasDuplicateGovernanceCaseResolutionSummaryRequirements = (
  requirements: Array<{
    caseFamily: string;
    caseSeverity?: string;
  }>
): boolean => {
  const seen = new Set<string>();

  for (const requirement of requirements) {
    const requirementKey = getGovernanceCaseResolutionSummaryRequirementKey(requirement);
    if (seen.has(requirementKey)) {
      return true;
    }
    seen.add(requirementKey);
  }

  return false;
};

export const hasDuplicateGovernanceCaseResolutionSummaryFieldRequirements = (
  requirements: Array<{
    caseFamily: string;
    fieldKey: string;
    caseSeverity?: string;
  }>
): boolean => {
  const seen = new Set<string>();

  for (const requirement of requirements) {
    const requirementKey =
      getGovernanceCaseResolutionSummaryFieldRequirementKey(requirement);
    if (seen.has(requirementKey)) {
      return true;
    }
    seen.add(requirementKey);
  }

  return false;
};

export const hasDuplicateGovernanceCaseQueuePriorityRules = (
  rules: Array<{
    caseFamily: string;
    caseSeverity: string;
    caseStatus?: string;
  }>
): boolean => {
  const seen = new Set<string>();

  for (const rule of rules) {
    const ruleKey = getGovernanceCaseQueuePriorityRuleKey(rule);
    if (seen.has(ruleKey)) {
      return true;
    }
    seen.add(ruleKey);
  }

  return false;
};

export const hasDuplicateGovernanceCaseRecommendedActionRules = (
  rules: Array<{
    caseFamily: string;
    caseSeverity: string;
    caseStatus?: string;
    recommendedAction: string;
  }>
): boolean => {
  const seen = new Set<string>();

  for (const rule of rules) {
    const ruleKey = getGovernanceCaseRecommendedActionRuleKey(rule);
    if (seen.has(ruleKey)) {
      return true;
    }
    seen.add(ruleKey);
  }

  return false;
};

export const hasDuplicateGovernanceCaseWorkflowTransitionRules = (
  rules: Array<{
    caseFamily: string;
    workflowState: string;
    caseSeverity?: string;
    transition: string;
  }>
): boolean => {
  const seen = new Set<string>();

  for (const rule of rules) {
    const ruleKey = getGovernanceCaseWorkflowTransitionRuleKey(rule);
    if (seen.has(ruleKey)) {
      return true;
    }
    seen.add(ruleKey);
  }

  return false;
};

export const buildNotificationProviderProfileGovernanceCaseRequiredChecklistItems = (input: {
  governanceCasePolicy: GovernanceCasePolicy;
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  caseStatus: NotificationProviderProfileGovernanceCaseStatusDto;
  checklistItems: Array<{
    itemKey: string;
    label: string;
    status: NotificationProviderProfileGovernanceCaseChecklistItemStatusDto;
    updatedAt: string;
    updatedByActorId: string;
    note: string | null;
  }>;
}) => {
  const checklistStatusByKey = new Map(
    input.checklistItems.map(item => [item.itemKey, item.status] as const)
  );
  const templateDefinitions = input.governanceCasePolicy.closeChecklistTemplates
    .filter(
      template =>
        template.caseFamily === input.caseFamily &&
        template.caseStatus === input.caseStatus &&
        (!template.caseSeverity || template.caseSeverity === input.caseSeverity)
    )
    .sort(
      (left, right) =>
        left.itemKey.localeCompare(right.itemKey) ||
        (left.caseSeverity ? 1 : 0) - (right.caseSeverity ? 1 : 0)
    );
  const resolvedTemplates = new Map<string, (typeof templateDefinitions)[number]>();
  for (const template of templateDefinitions) {
    resolvedTemplates.set(template.itemKey, template);
  }

  return Array.from(resolvedTemplates.values())
    .sort((left, right) => left.itemKey.localeCompare(right.itemKey))
    .map(template => ({
      ...template,
      completed: checklistStatusByKey.get(template.itemKey) === "completed"
    }));
};

export const resolveGovernanceCaseCloseResolutionSummaryRequirement = (input: {
  governanceCasePolicy: GovernanceCasePolicy;
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
}) =>
  input.governanceCasePolicy.closeResolutionSummaryRequirements
    .filter(
      requirement =>
        requirement.caseFamily === input.caseFamily &&
        (!requirement.caseSeverity || requirement.caseSeverity === input.caseSeverity)
    )
    .sort(
      (left, right) => (left.caseSeverity ? 1 : 0) - (right.caseSeverity ? 1 : 0)
    )
    .at(-1) ?? null;

export const resolveGovernanceCaseCloseResolutionSummaryFieldRequirements = (input: {
  governanceCasePolicy: GovernanceCasePolicy;
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
}) =>
  Array.from(
    input.governanceCasePolicy.closeResolutionSummaryFieldRequirements
      .filter(
        requirement =>
          requirement.caseFamily === input.caseFamily &&
          (!requirement.caseSeverity || requirement.caseSeverity === input.caseSeverity)
      )
      .sort(
        (left, right) =>
          left.fieldKey.localeCompare(right.fieldKey) ||
          (left.caseSeverity ? 1 : 0) - (right.caseSeverity ? 1 : 0)
      )
      .reduce((map, requirement) => map.set(requirement.fieldKey, requirement), new Map())
      .values()
  ).sort((left, right) => left.fieldKey.localeCompare(right.fieldKey));

export const resolveGovernanceCaseRecommendedActions = (input: {
  governanceCasePolicy: GovernanceCasePolicy;
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  caseStatus: NotificationProviderProfileGovernanceCaseStatusDto;
}) =>
  Array.from(
    input.governanceCasePolicy.recommendedActionRules
      .filter(
        rule =>
          rule.caseFamily === input.caseFamily &&
          rule.caseSeverity === input.caseSeverity &&
          (!rule.caseStatus || rule.caseStatus === input.caseStatus)
      )
      .sort(
        (left, right) =>
          left.recommendedAction.localeCompare(right.recommendedAction) ||
          (left.caseStatus ? 1 : 0) - (right.caseStatus ? 1 : 0)
      )
      .reduce(
        (map, rule) => map.set(rule.recommendedAction, rule.recommendedAction),
        new Map<
          NotificationProviderProfileGovernanceCaseRecommendedActionDto,
          NotificationProviderProfileGovernanceCaseRecommendedActionDto
        >()
      )
      .values()
  );

const governanceCaseWorkflowTransitionOrder: NotificationProviderProfileGovernanceCaseTransitionTypeDto[] = [
  "start_recovery",
  "mark_waiting_external",
  "close_case",
  "reopen_case"
];

export const resolveGovernanceCaseAvailableTransitions = (input: {
  governanceCasePolicy: GovernanceCasePolicy;
  caseFamily: "incident_response" | "delivery_recovery" | "recovery_follow_up";
  caseSeverity: "low" | "medium" | "high";
  workflowState: NotificationProviderProfileGovernanceCaseWorkflowStateDto;
  baseTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[];
}) => {
  const matchingRules = input.governanceCasePolicy.workflowTransitionRules
    .filter(
      rule =>
        rule.caseFamily === input.caseFamily &&
        rule.workflowState === input.workflowState &&
        (!rule.caseSeverity || rule.caseSeverity === input.caseSeverity)
    )
    .sort(
      (left, right) =>
        left.transition.localeCompare(right.transition) ||
        (left.caseSeverity ? 1 : 0) - (right.caseSeverity ? 1 : 0)
    );

  const candidateTransitions = new Set<NotificationProviderProfileGovernanceCaseTransitionTypeDto>(
    input.baseTransitions
  );
  for (const rule of matchingRules) {
    if (rule.enabled) {
      candidateTransitions.add(rule.transition);
    }
  }

  return governanceCaseWorkflowTransitionOrder.filter(transition => {
    if (!candidateTransitions.has(transition)) {
      return false;
    }

    const matchingRuleForTransition =
      matchingRules.filter(rule => rule.transition === transition).at(-1) ?? null;

    if (matchingRuleForTransition) {
      return matchingRuleForTransition.enabled;
    }

    return input.baseTransitions.includes(transition);
  });
};

export const isGovernanceCaseResolutionSummaryFieldValue = (
  value: unknown
): value is { fieldKey: string; value: string } =>
  isRecord(value) && isTrimmedString(value.fieldKey) && isTrimmedString(value.value);

export const isNotificationProviderProfileGovernanceCaseResolutionCode = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseResolutionCodeDto =>
  value === "target_corrected" ||
  value === "manual_recovery_completed" ||
  value === "external_dependency" ||
  value === "accepted_risk" ||
  value === "false_positive";
