import type {
  NotificationProviderProfileGovernanceAlertDto,
  NotificationProviderProfileGovernanceCaseChecklistItemStatusDto,
  NotificationProviderProfileGovernanceCaseRecommendedActionDto,
  NotificationProviderProfileGovernanceCaseResolutionCodeDto,
  NotificationProviderProfileGovernanceCaseSlaStatusDto,
  NotificationProviderProfileGovernanceCaseStatusDto,
  NotificationProviderProfileGovernanceCaseTransitionTypeDto,
  NotificationProviderProfileGovernanceCaseWorkflowStateDto,
  NotificationProviderProfileIncidentDto,
  WorkspaceNotificationProviderProfileGovernanceCasesResponse,
  WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse
} from "@testcenter-rewrite/contracts";
import type {
  AuditEvent,
  GovernanceCasePolicy,
  NotificationProviderProfileGovernanceAlert,
  NotificationProviderProfileIncident
} from "@testcenter-rewrite/domain";

import {
  buildNotificationProviderProfileGovernanceCaseRequiredChecklistItems,
  isGovernanceCaseResolutionSummaryFieldValue,
  resolveGovernanceCaseAvailableTransitions,
  resolveGovernanceCaseCloseResolutionSummaryFieldRequirements,
  resolveGovernanceCaseCloseResolutionSummaryRequirement,
  resolveGovernanceCaseRecommendedActions,
  toGovernanceCaseResolutionSummaryFieldRequirementDto,
  toGovernanceCaseResolutionSummaryRequirementDto
} from "./governance-case-policy.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getAuditPayloadString = (
  payload: Record<string, unknown>,
  key: string
): string | undefined => (typeof payload[key] === "string" ? payload[key] : undefined);

const getAuditPayloadRecord = (
  payload: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined => {
  const value = payload[key];
  return isRecord(value) ? value : undefined;
};

const getAuditPayloadNumber = (
  payload: Record<string, unknown>,
  key: string
): number | undefined => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const getAuditPayloadRecordArray = (
  payload: Record<string, unknown>,
  key: string
): Record<string, unknown>[] | undefined => {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(isRecord);
};

const isNotificationProviderProfileGovernanceCaseTransitionType = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseTransitionTypeDto =>
  value === "start_recovery" ||
  value === "mark_waiting_external" ||
  value === "close_case" ||
  value === "reopen_case";

const isNotificationProviderProfileGovernanceCaseResolutionCode = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseResolutionCodeDto =>
  value === "target_corrected" ||
  value === "manual_recovery_completed" ||
  value === "external_dependency" ||
  value === "accepted_risk" ||
  value === "false_positive";

const isNotificationProviderProfileGovernanceCaseChecklistItemStatus = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseChecklistItemStatusDto =>
  value === "open" || value === "completed";

export const toNotificationProviderProfileIncidentDto = (
  incident: NotificationProviderProfileIncident
): NotificationProviderProfileIncidentDto => ({
  incidentId: incident.incidentId,
  profileKey: incident.profileKey,
  incidentType: incident.incidentType,
  status: incident.status,
  openedAt: incident.openedAt,
  openedByActorType: incident.openedByActorType,
  openedByActorId: incident.openedByActorId,
  reasonCode: incident.reasonCode,
  deliveryFailedCount: incident.deliveryFailedCount,
  suppressionUntil: incident.suppressionUntil,
  sourceRequestId: incident.sourceRequestId,
  acknowledgedAt: incident.acknowledgedAt,
  acknowledgedByActorId: incident.acknowledgedByActorId,
  acknowledgementNote: incident.acknowledgementNote,
  resolvedAt: incident.resolvedAt,
  resolutionCode: incident.resolutionCode
});

export const toNotificationProviderProfileGovernanceAlertDto = (
  alert: NotificationProviderProfileGovernanceAlert
): NotificationProviderProfileGovernanceAlertDto => ({
  alertId: alert.alertId,
  incidentId: alert.incidentId,
  profileKey: alert.profileKey,
  alertClass: alert.alertClass,
  status: alert.status,
  governanceStatus: alert.governanceStatus,
  createdAt: alert.createdAt,
  createdByActorType: alert.createdByActorType,
  createdByActorId: alert.createdByActorId,
  sourceRequestId: alert.sourceRequestId,
  deliveryProfileKey: alert.deliveryProfileKey,
  delivery: {
    channel: alert.deliveryChannel,
    status: alert.deliveryStatus,
    target: alert.deliveryTarget,
    attemptCount: alert.deliveryAttemptCount,
    maxAttempts: alert.maxDeliveryAttempts,
    nextAttemptAt: alert.nextDeliveryAttemptAt,
    lastAttemptAt: alert.lastDeliveryAttemptAt,
    receiptId: alert.lastDeliveryReceiptId,
    receiptIssuedAt: alert.lastDeliveryReceiptIssuedAt,
    deliveredAt: alert.deliveredAt,
    lastError: alert.lastDeliveryError
  },
  acknowledgedAt: alert.acknowledgedAt,
  acknowledgedByActorId: alert.acknowledgedByActorId,
  acknowledgementNote: alert.acknowledgementNote
});

export const getAuditEventRelatedIncidentId = (
  auditEvent: AuditEvent
): string | null => {
  const directIncidentId = getAuditPayloadString(auditEvent.payload, "incidentId");
  if (directIncidentId) {
    return directIncidentId;
  }

  const incidentRecord = getAuditPayloadRecord(auditEvent.payload, "incident");
  return incidentRecord ? (getTrimmedString(incidentRecord.incidentId) ?? null) : null;
};

export const getAuditEventRelatedAlertIds = (
  auditEvent: AuditEvent
): string[] => {
  const relatedAlertIds = new Set<string>();
  const directAlertId = getAuditPayloadString(auditEvent.payload, "alertId");
  if (directAlertId) {
    relatedAlertIds.add(directAlertId);
  }

  const recoveryGovernanceAlertId = getAuditPayloadString(
    auditEvent.payload,
    "recoveryGovernanceAlertId"
  );
  if (recoveryGovernanceAlertId) {
    relatedAlertIds.add(recoveryGovernanceAlertId);
  }

  const alertRecord = getAuditPayloadRecord(auditEvent.payload, "alert");
  const nestedAlertId = alertRecord ? getTrimmedString(alertRecord.alertId) : null;
  if (nestedAlertId) {
    relatedAlertIds.add(nestedAlertId);
  }

  return Array.from(relatedAlertIds);
};

export const toNotificationProviderProfileGovernanceCorrelationTimelineEventDto = (
  auditEvent: AuditEvent
) => ({
  occurredAt: auditEvent.occurredAt,
  eventType: auditEvent.eventType,
  requestId: auditEvent.requestId,
  actorType: auditEvent.actorType,
  actorId: auditEvent.actorId,
  relatedIncidentId: getAuditEventRelatedIncidentId(auditEvent),
  relatedAlertId: getAuditEventRelatedAlertIds(auditEvent)[0] ?? null
});

export const getLatestNotificationProviderProfileGovernanceCaseAssignment = (
  auditEvents: AuditEvent[],
  incidentId: string
) => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.assigned" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (!matchingEvent) {
    return null;
  }

  return {
    assignedToActorId:
      getAuditPayloadString(matchingEvent.payload, "assignedToActorId") ?? null,
    assignedByActorId:
      getAuditPayloadString(matchingEvent.payload, "assignedByActorId") ?? null,
    assignedAt: getAuditPayloadString(matchingEvent.payload, "assignedAt") ?? null,
    assignmentNote:
      getAuditPayloadString(matchingEvent.payload, "assignmentNote") ?? null,
    slaSeconds: getAuditPayloadNumber(matchingEvent.payload, "slaSeconds") ?? null
  };
};

export const getLatestNotificationProviderProfileGovernanceCaseEscalation = (
  auditEvents: AuditEvent[],
  incidentId: string
) => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.escalated" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (!matchingEvent) {
    return null;
  }

  return {
    escalatedAt:
      getAuditPayloadString(matchingEvent.payload, "escalatedAt") ?? matchingEvent.occurredAt,
    escalatedByActorId:
      getAuditPayloadString(matchingEvent.payload, "escalatedByActorId") ?? null,
    escalationNote:
      getAuditPayloadString(matchingEvent.payload, "escalationNote") ?? null
  };
};

export const getLatestNotificationProviderProfileGovernanceCaseWorkflowTransition = (
  auditEvents: AuditEvent[],
  incidentId: string
) => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.transitioned" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (!matchingEvent) {
    return null;
  }

  const transition = getAuditPayloadString(matchingEvent.payload, "transition");
  const rawResolutionCode = getAuditPayloadString(
    matchingEvent.payload,
    "resolutionCode"
  );
  const resolutionCode = isNotificationProviderProfileGovernanceCaseResolutionCode(
    rawResolutionCode
  )
    ? rawResolutionCode
    : null;
  let workflowState: NotificationProviderProfileGovernanceCaseWorkflowStateDto = "open";

  if (transition === "start_recovery") {
    workflowState = "in_recovery";
  } else if (transition === "mark_waiting_external") {
    workflowState = "waiting_external";
  } else if (transition === "close_case") {
    workflowState = "closed";
  }

  return {
    transition: isNotificationProviderProfileGovernanceCaseTransitionType(transition)
      ? transition
      : null,
    workflowState,
    workflowUpdatedAt:
      getAuditPayloadString(matchingEvent.payload, "transitionedAt") ?? matchingEvent.occurredAt,
    workflowUpdatedByActorId:
      getAuditPayloadString(matchingEvent.payload, "transitionedByActorId") ?? null,
    workflowNote:
      getAuditPayloadString(matchingEvent.payload, "transitionNote") ?? null,
    resolutionCode
  };
};

export const listNotificationProviderProfileGovernanceCaseNotes = (
  auditEvents: AuditEvent[],
  incidentId: string
) =>
  auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.note_added" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId
    )
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map(auditEvent => ({
      noteId: getAuditPayloadString(auditEvent.payload, "noteId") ?? auditEvent.requestId,
      body: getAuditPayloadString(auditEvent.payload, "noteBody") ?? "",
      createdAt:
        getAuditPayloadString(auditEvent.payload, "createdAt") ?? auditEvent.occurredAt,
      createdByActorId: getAuditPayloadString(auditEvent.payload, "createdByActorId") ?? ""
    }));

export const listNotificationProviderProfileGovernanceCaseChecklistItems = (
  auditEvents: AuditEvent[],
  incidentId: string
) => {
  const latestByItemKey = new Map<
    string,
    {
      itemKey: string;
      label: string;
      status: NotificationProviderProfileGovernanceCaseChecklistItemStatusDto;
      updatedAt: string;
      updatedByActorId: string;
      note: string | null;
    }
  >();

  for (const auditEvent of auditEvents
    .filter(
      currentAuditEvent =>
        currentAuditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.checklist_item_upserted" &&
        getAuditEventRelatedIncidentId(currentAuditEvent) === incidentId
    )
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))) {
    const itemKey = getTrimmedString(
      getAuditPayloadString(auditEvent.payload, "itemKey")
    );
    const label = getTrimmedString(getAuditPayloadString(auditEvent.payload, "label"));
    const status = getAuditPayloadString(auditEvent.payload, "status");
    const updatedByActorId = getTrimmedString(
      getAuditPayloadString(auditEvent.payload, "updatedByActorId")
    );

    if (
      !itemKey ||
      !label ||
      !updatedByActorId ||
      !isNotificationProviderProfileGovernanceCaseChecklistItemStatus(status)
    ) {
      continue;
    }

    latestByItemKey.set(itemKey, {
      itemKey,
      label,
      status,
      updatedAt:
        getAuditPayloadString(auditEvent.payload, "updatedAt") ?? auditEvent.occurredAt,
      updatedByActorId,
      note: getAuditPayloadString(auditEvent.payload, "note") ?? null
    });
  }

  return Array.from(latestByItemKey.values()).sort((left, right) =>
    left.itemKey.localeCompare(right.itemKey)
  );
};

export const getLatestNotificationProviderProfileGovernanceCaseCloseResolutionSummary = (
  auditEvents: AuditEvent[],
  incidentId: string
): string | null => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.transitioned" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId &&
        getAuditPayloadString(auditEvent.payload, "transition") === "close_case"
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  return matchingEvent
    ? (getAuditPayloadString(matchingEvent.payload, "transitionNote") ?? null)
    : null;
};

export const getLatestNotificationProviderProfileGovernanceCaseCloseResolutionSummaryFields = (
  auditEvents: AuditEvent[],
  incidentId: string
): Array<{ fieldKey: string; value: string }> => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.transitioned" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId &&
        getAuditPayloadString(auditEvent.payload, "transition") === "close_case"
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (!matchingEvent) {
    return [];
  }

  const rawFields = getAuditPayloadRecordArray(
    matchingEvent.payload,
    "resolutionSummaryFields"
  );
  if (!rawFields) {
    return [];
  }

  return rawFields
    .filter(isGovernanceCaseResolutionSummaryFieldValue)
    .map((field): { fieldKey: string; value: string } => ({
      fieldKey: field.fieldKey.trim(),
      value: field.value.trim()
    }))
    .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey));
};

const deriveNotificationProviderProfileGovernanceCaseFamily = (input: {
  failedAlertCount: number;
  pendingAlertAcknowledgementCount: number;
  hasDeliveredRecoveryAlert: boolean;
  incidentStatus: NotificationProviderProfileIncident["status"];
  suppressionActive: boolean;
}): "incident_response" | "delivery_recovery" | "recovery_follow_up" => {
  if (input.failedAlertCount > 0) {
    return "delivery_recovery";
  }

  if (input.incidentStatus === "open" || input.suppressionActive) {
    return "incident_response";
  }

  return "recovery_follow_up";
};

const deriveNotificationProviderProfileGovernanceCaseSeverity = (input: {
  failedAlertCount: number;
  pendingAlertAcknowledgementCount: number;
  hasDeliveredRecoveryAlert: boolean;
  incidentStatus: NotificationProviderProfileIncident["status"];
  suppressionActive: boolean;
  slaStatus: NotificationProviderProfileGovernanceCaseSlaStatusDto;
}): "low" | "medium" | "high" => {
  if (
    input.slaStatus === "breached" ||
    input.slaStatus === "escalated" ||
    input.failedAlertCount > 0 ||
    input.incidentStatus === "open"
  ) {
    return "high";
  }

  if (
    input.suppressionActive ||
    input.pendingAlertAcknowledgementCount > 0 ||
    input.hasDeliveredRecoveryAlert ||
    input.incidentStatus === "acknowledged"
  ) {
    return "medium";
  }

  return "low";
};

export const toNotificationProviderProfileGovernanceCaseDto = (input: {
  profileKey: string;
  incident: NotificationProviderProfileIncident;
  alerts: NotificationProviderProfileGovernanceAlert[];
  timeline: ReturnType<typeof toNotificationProviderProfileGovernanceCorrelationTimelineEventDto>[];
  assignment: {
    assignedToActorId: string | null;
    assignedByActorId: string | null;
    assignedAt: string | null;
    assignmentNote: string | null;
    slaSeconds: number | null;
  } | null;
  escalation: {
    escalatedAt: string | null;
    escalatedByActorId: string | null;
    escalationNote: string | null;
  } | null;
  workflowTransition: {
    transition: NotificationProviderProfileGovernanceCaseTransitionTypeDto | null;
    workflowState: NotificationProviderProfileGovernanceCaseWorkflowStateDto;
    workflowUpdatedAt: string | null;
    workflowUpdatedByActorId: string | null;
    workflowNote: string | null;
    resolutionCode: NotificationProviderProfileGovernanceCaseResolutionCodeDto | null;
  } | null;
  notes: Array<{
    noteId: string;
    body: string;
    createdAt: string;
    createdByActorId: string;
  }>;
  governanceCasePolicy: GovernanceCasePolicy;
  latestCloseResolutionSummary: string | null;
  latestCloseResolutionSummaryFields?: Array<{ fieldKey: string; value: string }>;
  checklistItems: Array<{
    itemKey: string;
    label: string;
    status: NotificationProviderProfileGovernanceCaseChecklistItemStatusDto;
    updatedAt: string;
    updatedByActorId: string;
    note: string | null;
  }>;
}): WorkspaceNotificationProviderProfileGovernanceCasesResponse["items"][number] => {
  const nowIso = new Date().toISOString();
  const openAlertCount = input.alerts.filter(alert => alert.alertClass === "incident_open").length;
  const failedAlertCount = input.alerts.filter(
    alert => alert.deliveryStatus === "delivery_failed"
  ).length;
  const pendingAlertAcknowledgementCount = input.alerts.filter(
    alert => alert.status === "pending_acknowledgement"
  ).length;
  const suppressionActive =
    input.incident.suppressionUntil !== null &&
    input.incident.suppressionUntil > nowIso;
  const allAlertsAcknowledged =
    input.alerts.length > 0 &&
    input.alerts.every(alert => alert.status === "acknowledged");
  const hasDeliveredRecoveryAlert = input.alerts.some(
    alert =>
      alert.alertClass === "incident_resolved" &&
      alert.deliveryStatus === "delivered"
  );
  const slaDueAt =
    input.assignment?.assignedAt &&
    typeof input.assignment.slaSeconds === "number" &&
    input.assignment.slaSeconds > 0
      ? new Date(
          Date.parse(input.assignment.assignedAt) + input.assignment.slaSeconds * 1000
        ).toISOString()
      : null;
  const slaStatus: NotificationProviderProfileGovernanceCaseSlaStatusDto =
    input.escalation !== null
      ? "escalated"
      : slaDueAt === null
        ? "not_applicable"
        : slaDueAt < nowIso
          ? "breached"
          : "on_track";
  const caseFamily = deriveNotificationProviderProfileGovernanceCaseFamily({
    failedAlertCount,
    pendingAlertAcknowledgementCount,
    hasDeliveredRecoveryAlert,
    incidentStatus: input.incident.status,
    suppressionActive
  });
  const caseSeverity = deriveNotificationProviderProfileGovernanceCaseSeverity({
    failedAlertCount,
    pendingAlertAcknowledgementCount,
    hasDeliveredRecoveryAlert,
    incidentStatus: input.incident.status,
    suppressionActive,
    slaStatus
  });

  let caseStatus: NotificationProviderProfileGovernanceCaseStatusDto;
  let recommendedActions: WorkspaceNotificationProviderProfileGovernanceCasesResponse["items"][number]["recommendedActions"];

  if (failedAlertCount > 0) {
    caseStatus = "awaiting_redrive";
    recommendedActions = ["redrive_governance_alert"];
  } else if (input.incident.status === "open") {
    caseStatus = "awaiting_incident_acknowledgement";
    recommendedActions = ["acknowledge_incident"];
  } else if (suppressionActive) {
    caseStatus = "suppressed_monitoring";
    recommendedActions = ["wait_for_suppression_expiry"];
  } else if (pendingAlertAcknowledgementCount > 0) {
    caseStatus = "awaiting_alert_acknowledgement";
    recommendedActions = ["acknowledge_governance_alert"];
  } else if (hasDeliveredRecoveryAlert) {
    caseStatus = "recovered";
    recommendedActions = ["review_recovery_state"];
  } else if (allAlertsAcknowledged || input.incident.status === "resolved") {
    caseStatus = "closed";
    recommendedActions = ["no_action_required"];
  } else {
    caseStatus = "closed";
    recommendedActions = ["no_action_required"];
  }

  const workflowState = input.workflowTransition?.workflowState ?? "open";
  const closeResolutionSummaryRequirement =
    resolveGovernanceCaseCloseResolutionSummaryRequirement({
      governanceCasePolicy: input.governanceCasePolicy,
      caseFamily,
      caseSeverity
    });
  const closeResolutionSummaryFieldRequirements =
    resolveGovernanceCaseCloseResolutionSummaryFieldRequirements({
      governanceCasePolicy: input.governanceCasePolicy,
      caseFamily,
      caseSeverity
    });
  const latestCloseResolutionSummary = input.latestCloseResolutionSummary;
  const latestCloseResolutionSummaryFields =
    input.latestCloseResolutionSummaryFields ?? [];
  const requiredChecklistItems =
    buildNotificationProviderProfileGovernanceCaseRequiredChecklistItems({
      governanceCasePolicy: input.governanceCasePolicy,
      caseFamily,
      caseSeverity,
      caseStatus,
      checklistItems: input.checklistItems
    });
  const closeBlockedByChecklistItemKeys =
    workflowState === "closed"
      ? []
      : requiredChecklistItems
          .filter(
            item =>
              item.requiredForTransitions.includes("close_case") && !item.completed
          )
          .map(item => item.itemKey);
  const closeReadiness =
    closeBlockedByChecklistItemKeys.length === 0 ? "ready" : "blocked";

  if (slaStatus === "breached") {
    recommendedActions = ["escalate_case", ...recommendedActions];
  }

  if (
    input.assignment === null &&
    recommendedActions[0] !== "no_action_required" &&
    recommendedActions[0] !== "assign_case"
  ) {
    recommendedActions = ["assign_case", ...recommendedActions];
  }

  if (workflowState === "closed") {
    recommendedActions = ["reopen_case"];
  }

  if (
    workflowState !== "closed" &&
    closeBlockedByChecklistItemKeys.length > 0 &&
    !recommendedActions.includes("complete_required_checklist")
  ) {
    if (recommendedActions[0] === "assign_case") {
      recommendedActions = [
        "assign_case",
        "complete_required_checklist",
        ...recommendedActions.slice(1)
      ];
    } else if (recommendedActions[0] !== "no_action_required") {
      recommendedActions = ["complete_required_checklist", ...recommendedActions];
    }
  }

  if (
    workflowState !== "closed" &&
    ((closeResolutionSummaryRequirement &&
      closeResolutionSummaryRequirement.requiredForTransitions.includes("close_case")) ||
      closeResolutionSummaryFieldRequirements.some(requirement =>
        requirement.requiredForTransitions.includes("close_case")
      )) &&
    !recommendedActions.includes("provide_resolution_summary")
  ) {
    if (recommendedActions[0] === "assign_case") {
      recommendedActions = [
        "assign_case",
        "provide_resolution_summary",
        ...recommendedActions.slice(1)
      ];
    } else if (recommendedActions[0] !== "no_action_required") {
      recommendedActions = ["provide_resolution_summary", ...recommendedActions];
    }
  }

  if (workflowState !== "closed") {
    const policyRecommendedActions = resolveGovernanceCaseRecommendedActions({
      governanceCasePolicy: input.governanceCasePolicy,
      caseFamily,
      caseSeverity,
      caseStatus
    }).filter(action => !recommendedActions.includes(action));

    if (policyRecommendedActions.length > 0) {
      if (recommendedActions[0] === "assign_case") {
        recommendedActions = [
          "assign_case",
          ...policyRecommendedActions,
          ...recommendedActions.slice(1)
        ];
      } else if (recommendedActions[0] !== "no_action_required") {
        recommendedActions = [...policyRecommendedActions, ...recommendedActions];
      }
    }
  }

  const closeCaseTransitionSuffix: NotificationProviderProfileGovernanceCaseTransitionTypeDto[] =
    closeBlockedByChecklistItemKeys.length === 0 ? ["close_case"] : [];
  const baseAvailableTransitions: NotificationProviderProfileGovernanceCaseTransitionTypeDto[] =
    workflowState === "closed"
      ? ["reopen_case"]
      : workflowState === "in_recovery"
        ? ["mark_waiting_external", ...closeCaseTransitionSuffix]
        : workflowState === "waiting_external"
          ? ["start_recovery", ...closeCaseTransitionSuffix]
          : ["start_recovery", "mark_waiting_external", ...closeCaseTransitionSuffix];
  const availableTransitions = resolveGovernanceCaseAvailableTransitions({
    governanceCasePolicy: input.governanceCasePolicy,
    caseFamily,
    caseSeverity,
    workflowState,
    baseTransitions: baseAvailableTransitions
  });

  const latestActivityAt = [
    input.incident.openedAt,
    input.incident.acknowledgedAt,
    input.incident.resolvedAt,
    input.assignment?.assignedAt,
    slaDueAt,
    input.escalation?.escalatedAt,
    input.workflowTransition?.workflowUpdatedAt,
    ...input.alerts.flatMap(alert => [
      alert.createdAt,
      alert.acknowledgedAt,
      alert.deliveredAt,
      alert.lastDeliveryAttemptAt
    ]),
    ...input.timeline.map(item => item.occurredAt)
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => right.localeCompare(left))[0] ?? input.incident.openedAt;

  return {
    profileKey: input.profileKey,
    caseFamily,
    caseSeverity,
    caseStatus,
    assignmentStatus: input.assignment ? "assigned" : "unassigned",
    assignedToActorId: input.assignment?.assignedToActorId ?? null,
    assignedByActorId: input.assignment?.assignedByActorId ?? null,
    assignedAt: input.assignment?.assignedAt ?? null,
    assignmentNote: input.assignment?.assignmentNote ?? null,
    slaSeconds: input.assignment?.slaSeconds ?? null,
    slaDueAt,
    slaStatus,
    escalatedAt: input.escalation?.escalatedAt ?? null,
    escalatedByActorId: input.escalation?.escalatedByActorId ?? null,
    escalationNote: input.escalation?.escalationNote ?? null,
    workflowState,
    workflowUpdatedAt: input.workflowTransition?.workflowUpdatedAt ?? null,
    workflowUpdatedByActorId:
      input.workflowTransition?.workflowUpdatedByActorId ?? null,
    workflowNote: input.workflowTransition?.workflowNote ?? null,
    resolutionCode:
      workflowState === "closed"
        ? (input.workflowTransition?.resolutionCode ?? null)
        : null,
    availableTransitions,
    closeReadiness,
    closeBlockedByChecklistItemKeys,
    closeResolutionSummaryRequirement:
      closeResolutionSummaryRequirement
        ? toGovernanceCaseResolutionSummaryRequirementDto(
            closeResolutionSummaryRequirement
          )
        : null,
    closeResolutionSummaryFieldRequirements:
      closeResolutionSummaryFieldRequirements.map(
        toGovernanceCaseResolutionSummaryFieldRequirementDto
      ),
    latestCloseResolutionSummary,
    latestCloseResolutionSummaryFields,
    latestActivityAt,
    openAlertCount,
    failedAlertCount,
    pendingAlertAcknowledgementCount,
    recommendedActions,
    notes: input.notes,
    checklistItems: input.checklistItems,
    requiredChecklistItems,
    incident: toNotificationProviderProfileIncidentDto(input.incident),
    alerts: input.alerts.map(toNotificationProviderProfileGovernanceAlertDto),
    timeline: input.timeline
  };
};

export const buildNotificationProviderProfileGovernanceCaseItem = (input: {
  incident: NotificationProviderProfileIncident;
  alerts: NotificationProviderProfileGovernanceAlert[];
  auditEvents: AuditEvent[];
  governanceCasePolicy: GovernanceCasePolicy;
}) => {
  const incidentAlerts = input.alerts
    .filter(alert => alert.incidentId === input.incident.incidentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const requestIds = new Set<string>();

  if (input.incident.sourceRequestId) {
    requestIds.add(input.incident.sourceRequestId);
  }
  for (const alert of incidentAlerts) {
    if (alert.sourceRequestId) {
      requestIds.add(alert.sourceRequestId);
    }
  }

  const alertIds = new Set(incidentAlerts.map(alert => alert.alertId));
  const timeline = input.auditEvents
    .filter(auditEvent => {
      if (requestIds.has(auditEvent.requestId)) {
        return true;
      }
      const relatedIncidentId = getAuditEventRelatedIncidentId(auditEvent);
      if (relatedIncidentId === input.incident.incidentId) {
        return true;
      }
      const relatedAlertIds = getAuditEventRelatedAlertIds(auditEvent);
      return relatedAlertIds.some(alertId => alertIds.has(alertId));
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map(toNotificationProviderProfileGovernanceCorrelationTimelineEventDto);

  return toNotificationProviderProfileGovernanceCaseDto({
    profileKey: input.incident.profileKey,
    incident: input.incident,
    alerts: incidentAlerts,
    timeline,
    assignment: getLatestNotificationProviderProfileGovernanceCaseAssignment(
      input.auditEvents,
      input.incident.incidentId
    ),
    escalation: getLatestNotificationProviderProfileGovernanceCaseEscalation(
      input.auditEvents,
      input.incident.incidentId
    ),
    workflowTransition: getLatestNotificationProviderProfileGovernanceCaseWorkflowTransition(
      input.auditEvents,
      input.incident.incidentId
    ),
    notes: listNotificationProviderProfileGovernanceCaseNotes(
      input.auditEvents,
      input.incident.incidentId
    ),
    governanceCasePolicy: input.governanceCasePolicy,
    latestCloseResolutionSummary:
      getLatestNotificationProviderProfileGovernanceCaseCloseResolutionSummary(
        input.auditEvents,
        input.incident.incidentId
      ),
    latestCloseResolutionSummaryFields:
      getLatestNotificationProviderProfileGovernanceCaseCloseResolutionSummaryFields(
        input.auditEvents,
        input.incident.incidentId
      ),
    checklistItems: listNotificationProviderProfileGovernanceCaseChecklistItems(
      input.auditEvents,
      input.incident.incidentId
    )
  });
};

const toNotificationProviderProfileGovernanceCaseQueueItemDto = (
  caseItem: WorkspaceNotificationProviderProfileGovernanceCasesResponse["items"][number],
  governanceCasePolicy?: GovernanceCasePolicy
): WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse["items"][number] => {
  let priorityRank = 999;
  let priorityReason = "closed_or_inactive";

  if (caseItem.slaStatus === "escalated") {
    priorityRank = 10;
    priorityReason = "case_escalated";
  } else if (caseItem.slaStatus === "breached") {
    priorityRank = 20;
    priorityReason = "sla_breached";
  } else if (caseItem.caseStatus === "awaiting_redrive") {
    priorityRank = 30;
    priorityReason = "delivery_failed";
  } else if (caseItem.caseStatus === "awaiting_alert_acknowledgement") {
    priorityRank = 40;
    priorityReason = "alert_acknowledgement_pending";
  } else if (caseItem.caseStatus === "awaiting_incident_acknowledgement") {
    priorityRank = 50;
    priorityReason = "incident_acknowledgement_pending";
  } else if (caseItem.caseStatus === "suppressed_monitoring") {
    priorityRank = 60;
    priorityReason = "suppression_monitoring";
  } else if (caseItem.caseStatus === "recovered") {
    priorityRank = 70;
    priorityReason = "recovered_review";
  }

  const matchingQueuePriorityRule =
    governanceCasePolicy?.queuePriorityRules
      .filter(
        rule =>
          rule.caseFamily === caseItem.caseFamily &&
          rule.caseSeverity === caseItem.caseSeverity &&
          (!rule.caseStatus || rule.caseStatus === caseItem.caseStatus)
      )
      .sort(
        (left, right) =>
          (left.caseStatus ? 1 : 0) - (right.caseStatus ? 1 : 0) ||
          left.priorityRank - right.priorityRank
      )
      .at(-1) ?? null;

  if (
    matchingQueuePriorityRule &&
    caseItem.workflowState !== "closed" &&
    matchingQueuePriorityRule.priorityRank < priorityRank
  ) {
    priorityRank = matchingQueuePriorityRule.priorityRank;
    priorityReason = matchingQueuePriorityRule.priorityReason;
  }

  return {
    priorityRank,
    priorityReason,
    caseItem
  };
};

export const buildNotificationProviderProfileGovernanceCaseQueueItems = (input: {
  incidents: NotificationProviderProfileIncident[];
  alerts: NotificationProviderProfileGovernanceAlert[];
  auditEvents: AuditEvent[];
  governanceCasePolicy: GovernanceCasePolicy;
}) =>
  input.incidents.map(incident =>
    toNotificationProviderProfileGovernanceCaseQueueItemDto(
      buildNotificationProviderProfileGovernanceCaseItem({
        incident,
        alerts: input.alerts,
        auditEvents: input.auditEvents,
        governanceCasePolicy: input.governanceCasePolicy
      }),
      input.governanceCasePolicy
    )
  );
