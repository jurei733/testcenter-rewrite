import {
  createDatabasePool,
  createPostgresPlatformStore,
  type PlatformStore
} from "@testcenter-rewrite/db";
import {
  createAuditEvent,
  createNotificationProviderProfileIncident,
  createNotificationProviderProfileGovernanceAlert,
  resolveWorkspaceNotificationProviderProfiles,
  resolveWorkspaceNotificationProviderPromotionPolicy,
  resolveWorkspaceNotificationPolicy,
  type NotificationProviderProfile,
  type NotificationProviderProfileGovernanceAlert,
  type NotificationProviderProfileIncident,
  type NotificationProviderPromotionPolicy,
  type SystemCheckEvidenceBreachNotification,
  type Workspace
} from "@testcenter-rewrite/domain";
import {
  refreshOutboundNotificationProviderProfileOperationalState,
  isOutboundNotificationProviderProfilePromotionSuppressed,
  resolveOutboundNotificationProviderProfileHealthStatus
} from "@testcenter-rewrite/outbound-messaging";
import { setTimeout as delay } from "node:timers/promises";

const maintenanceSweepBatchSize = 200;
const defaultPollIntervalMs = Number.parseInt(
  process.env.PROVIDER_OPERATIONS_POLL_INTERVAL_MS ?? "1000",
  10
);
const providerOperationsActorId =
  process.env.PROVIDER_OPERATIONS_ID ?? "provider-operations-service";

const buildProviderOperationsRequestId = (scope: string, recordId: string): string =>
  `provider-operations-${scope}-${recordId}`;

const tryExtractRequestedNotificationProviderProfileKey = (
  escalationTarget: string | null
): string | null => {
  const trimmedEscalationTarget = escalationTarget?.trim() ?? "";

  if (!trimmedEscalationTarget.startsWith("profile:")) {
    return null;
  }

  const requestedProfileKey = trimmedEscalationTarget.slice("profile:".length).trim();

  return requestedProfileKey.length > 0 ? requestedProfileKey : null;
};

interface NotificationProviderProfileRolloutMetrics {
  requestedCount: number;
  directSelectionCount: number;
  deliveredCount: number;
  deliveryFailedCount: number;
  promotionReadiness: "ready" | "blocked";
  promotionReadinessReasons: string[];
}

const buildNotificationProviderProfileRolloutMetrics = (input: {
  profile: NotificationProviderProfile;
  notifications: SystemCheckEvidenceBreachNotification[];
  promotionPolicy: NotificationProviderPromotionPolicy;
  evaluationWindowStart: string;
}): NotificationProviderProfileRolloutMetrics => {
  let requestedCount = 0;
  let directSelectionCount = 0;
  let deliveredCount = 0;
  let deliveryFailedCount = 0;

  for (const notification of input.notifications) {
    if (notification.createdAt < input.evaluationWindowStart) {
      continue;
    }

    const requestedProfileKey = tryExtractRequestedNotificationProviderProfileKey(
      notification.escalationTarget
    );

    if (requestedProfileKey === input.profile.profileKey) {
      requestedCount += 1;

      if (notification.deliveryProfileKey === input.profile.profileKey) {
        directSelectionCount += 1;
      }
    }

    if (notification.deliveryProfileKey !== input.profile.profileKey) {
      continue;
    }

    if (notification.deliveryStatus === "delivered") {
      deliveredCount += 1;
    } else if (notification.deliveryStatus === "delivery_failed") {
      deliveryFailedCount += 1;
    }
  }

  const promotionReadinessReasons: string[] = [];

  if (input.profile.rolloutState !== "canary") {
    promotionReadinessReasons.push("profile_is_not_canary");
  }

  if (resolveOutboundNotificationProviderProfileHealthStatus(input.profile) !== "ready") {
    promotionReadinessReasons.push("profile_is_not_ready");
  }

  if (requestedCount < input.promotionPolicy.minimumRequestedCount) {
    promotionReadinessReasons.push("insufficient_requested_volume");
  }

  if (directSelectionCount < input.promotionPolicy.minimumDirectSelectionCount) {
    promotionReadinessReasons.push("insufficient_direct_selection_volume");
  }

  if (deliveredCount < input.promotionPolicy.minimumDeliveredCount) {
    promotionReadinessReasons.push("insufficient_successful_deliveries");
  }

  if (deliveryFailedCount > input.promotionPolicy.maximumDeliveryFailedCount) {
    promotionReadinessReasons.push("delivery_failures_present");
  }

  if (isOutboundNotificationProviderProfilePromotionSuppressed(input.profile)) {
    promotionReadinessReasons.push("promotion_suppressed_after_auto_rollback");
  }

  return {
    requestedCount,
    directSelectionCount,
    deliveredCount,
    deliveryFailedCount,
    promotionReadiness:
      promotionReadinessReasons.length === 0 ? "ready" : "blocked",
    promotionReadinessReasons
  };
};

const recordNotificationProviderProfileRefreshAuditEvent = async (input: {
  store: PlatformStore;
  tenantId: string;
  workspaceId?: string;
  profile: NotificationProviderProfile;
  requestId: string;
  eventType: string;
}): Promise<void> => {
  await input.store.saveAuditEvent(createAuditEvent({
    requestId: input.requestId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorType: "worker",
    actorId: providerOperationsActorId,
    eventType: input.eventType,
    payload: {
      profileKey: input.profile.profileKey,
      displayLabel: input.profile.displayLabel,
      enabled: input.profile.enabled,
      rolloutState: input.profile.rolloutState,
      rolloutPercentage: input.profile.rolloutPercentage,
      rolloutFallbackProfileKey: input.profile.rolloutFallbackProfileKey,
      targetProbeMode: input.profile.targetProbeMode,
      deliveryChannel: input.profile.deliveryChannel,
      target: input.profile.target,
      incidentState: input.profile.incidentState ?? null,
      lastCheckedAt: input.profile.operationalState?.lastCheckedAt ?? null,
      lastCheckedByActorType: input.profile.operationalState?.lastCheckedByActorType ?? null,
      lastCheckedByActorId: input.profile.operationalState?.lastCheckedByActorId ?? null,
      credentialsStatus: input.profile.operationalState?.credentialsStatus ?? null,
      healthStatus: input.profile.operationalState?.healthStatus ?? null,
      rolloutStatus: input.profile.operationalState?.rolloutStatus ?? null,
      probeStatus: input.profile.operationalState?.probeStatus ?? null,
      probeTarget: input.profile.operationalState?.probeTarget ?? null,
      probeLatencyMs: input.profile.operationalState?.probeLatencyMs ?? null,
      lastCheckError: input.profile.operationalState?.lastCheckError ?? null
    }
  }));
};

const didNotificationProviderProfileOperationalStateChange = (
  previousProfile: NotificationProviderProfile,
  refreshedProfile: NotificationProviderProfile
): boolean => {
  const previousOperationalState = previousProfile.operationalState;
  const refreshedOperationalState = refreshedProfile.operationalState;

  if (!previousOperationalState || !refreshedOperationalState) {
    return previousOperationalState !== refreshedOperationalState;
  }

  return previousOperationalState.lastCheckedByActorType !== refreshedOperationalState.lastCheckedByActorType ||
    previousOperationalState.lastCheckedByActorId !== refreshedOperationalState.lastCheckedByActorId ||
    previousOperationalState.credentialsStatus !== refreshedOperationalState.credentialsStatus ||
    previousOperationalState.healthStatus !== refreshedOperationalState.healthStatus ||
    previousOperationalState.rolloutStatus !== refreshedOperationalState.rolloutStatus ||
    previousOperationalState.probeStatus !== refreshedOperationalState.probeStatus ||
    previousOperationalState.probeTarget !== refreshedOperationalState.probeTarget ||
    previousOperationalState.probeLatencyMs !== refreshedOperationalState.probeLatencyMs ||
    previousOperationalState.lastCheckError !== refreshedOperationalState.lastCheckError;
};

const updateWorkspaceNotificationProviderProfileRecord = (input: {
  workspace: Workspace;
  profileKey: string;
  nextProfile: NotificationProviderProfile;
  requestId: string;
  updatedAt: string;
}): Workspace => {
  const previousRecords = input.workspace.notificationProviderProfileOverrideRecords ?? {};
  const previousRecord = previousRecords[input.profileKey];

  return {
    ...input.workspace,
    notificationProviderProfileOverrideRecords: {
      ...previousRecords,
      [input.profileKey]: {
        value: input.nextProfile,
        updatedAt: input.updatedAt,
        updatedByRequestId: input.requestId,
        updatedByActorType: "worker",
        updatedByActorId: providerOperationsActorId
      }
    }
  };
};

const recordNotificationProviderProfileAutomationAuditEvent = async (input: {
  store: PlatformStore;
  tenantId: string;
  workspaceId: string;
  profile: NotificationProviderProfile;
  requestId: string;
  eventType: string;
  metrics: NotificationProviderProfileRolloutMetrics;
  promotionPolicy: NotificationProviderPromotionPolicy;
  automationAction: "auto_promoted" | "auto_rolled_back";
}): Promise<void> => {
  await input.store.saveAuditEvent(createAuditEvent({
    requestId: input.requestId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorType: "worker",
    actorId: providerOperationsActorId,
    eventType: input.eventType,
    payload: {
      automationAction: input.automationAction,
      profileKey: input.profile.profileKey,
      displayLabel: input.profile.displayLabel,
      rolloutState: input.profile.rolloutState,
      rolloutPercentage: input.profile.rolloutPercentage,
      rolloutFallbackProfileKey: input.profile.rolloutFallbackProfileKey,
      requestedCount: input.metrics.requestedCount,
      directSelectionCount: input.metrics.directSelectionCount,
      deliveredCount: input.metrics.deliveredCount,
      deliveryFailedCount: input.metrics.deliveryFailedCount,
      promotionReadiness: input.metrics.promotionReadiness,
      promotionReadinessReasons: input.metrics.promotionReadinessReasons,
      promotionPolicy: input.promotionPolicy,
      incidentState: input.profile.incidentState ?? null
    }
  }));
};

const synchronizeNotificationProviderProfiles = async (
  store: PlatformStore,
  checkedAt: string
): Promise<number> => {
  const tenants = await store.listTenants();
  let refreshedProfiles = 0;

  for (const tenant of tenants) {
    if (tenant.defaultNotificationProviderProfiles.length > 0) {
      const refreshedTenantProfiles = tenant.defaultNotificationProviderProfiles.map(profile =>
        refreshOutboundNotificationProviderProfileOperationalState({
          profile,
          checkedAt,
          checkedByActorType: "worker",
          checkedByActorId: providerOperationsActorId
        })
      );
      const changedTenantProfiles = refreshedTenantProfiles.filter((profile, index) =>
        didNotificationProviderProfileOperationalStateChange(
          tenant.defaultNotificationProviderProfiles[index],
          profile
        )
      );

      if (changedTenantProfiles.length > 0) {
        await store.saveTenant({
          ...tenant,
          defaultNotificationProviderProfiles: refreshedTenantProfiles
        });

        for (const profile of changedTenantProfiles) {
          await recordNotificationProviderProfileRefreshAuditEvent({
            store,
            tenantId: tenant.tenantId,
            profile,
            requestId: buildProviderOperationsRequestId(
              "tenant-notification-provider-profile-refresh",
              `${tenant.tenantId}-${profile.profileKey}`
            ),
            eventType: "provider_operations.tenant.notification_provider_profile.refreshed"
          });
        }
      }

      refreshedProfiles += changedTenantProfiles.length;
    }

    const workspaces = await store.listWorkspacesByTenant(tenant.tenantKey);

    for (const workspace of workspaces) {
      if (!workspace.notificationProviderProfileOverrideRecords) {
        continue;
      }

      const refreshedOverrideEntries: Array<
        [string, NonNullable<typeof workspace.notificationProviderProfileOverrideRecords>[string]]
      > = Object.entries(workspace.notificationProviderProfileOverrideRecords).map(
        ([profileKey, record]) => [
          profileKey,
          record.value === null
            ? record
            : {
                ...record,
                value: refreshOutboundNotificationProviderProfileOperationalState({
                  profile: record.value,
                  checkedAt,
                  checkedByActorType: "worker",
                  checkedByActorId: providerOperationsActorId
                })
              }
        ]
      );
      const refreshedWorkspaceProfiles = refreshedOverrideEntries
        .map(([, record]) => record.value)
        .filter((profile): profile is NotificationProviderProfile => profile !== null);
      const changedWorkspaceProfiles = refreshedOverrideEntries.flatMap(([profileKey, record]) => {
        if (record.value === null) {
          return [];
        }

        const previousRecord = workspace.notificationProviderProfileOverrideRecords?.[profileKey];

        if (!previousRecord?.value) {
          return [record.value];
        }

        return didNotificationProviderProfileOperationalStateChange(previousRecord.value, record.value)
          ? [record.value]
          : [];
      });

      if (refreshedWorkspaceProfiles.length === 0) {
        continue;
      }

      if (changedWorkspaceProfiles.length > 0) {
        await store.saveWorkspace({
          ...workspace,
          notificationProviderProfileOverrideRecords: Object.fromEntries(refreshedOverrideEntries)
        });

        for (const profile of changedWorkspaceProfiles) {
          await recordNotificationProviderProfileRefreshAuditEvent({
            store,
            tenantId: tenant.tenantId,
            workspaceId: workspace.workspaceId,
            profile,
            requestId: buildProviderOperationsRequestId(
              "workspace-notification-provider-profile-refresh",
              `${workspace.workspaceId}-${profile.profileKey}`
            ),
            eventType: "provider_operations.workspace.notification_provider_profile.refreshed"
          });
        }
      }

      refreshedProfiles += changedWorkspaceProfiles.length;
    }
  }

  return refreshedProfiles;
};

const reconcileNotificationProviderProfileRollouts = async (
  store: PlatformStore,
  checkedAt: string
): Promise<number> => {
  const tenants = await store.listTenants();
  let automatedChanges = 0;

  for (const tenant of tenants) {
    const workspaces = await store.listWorkspacesByTenant(tenant.tenantKey);

    for (const workspace of workspaces) {
      if (!workspace.notificationProviderProfileOverrideRecords) {
        continue;
      }

      const effectivePromotionPolicy = resolveWorkspaceNotificationProviderPromotionPolicy(
        workspace,
        tenant
      );

      if (
        !effectivePromotionPolicy.autoPromoteEnabled &&
        !effectivePromotionPolicy.autoRollbackOnFailureEnabled
      ) {
        continue;
      }

      const notifications = await store.listSystemCheckEvidenceBreachNotificationsByWorkspace(
        tenant.tenantKey,
        workspace.workspaceKey,
        {
          limit: 500
        }
      );
      const effectiveProfiles = resolveWorkspaceNotificationProviderProfiles(workspace, tenant);
      const evaluationWindowStart = new Date(
        new Date(checkedAt).getTime() -
          effectivePromotionPolicy.evaluationWindowHours * 60 * 60 * 1000
      ).toISOString();

      let updatedWorkspace = workspace;
      const automationAuditEvents: Array<{
        requestId: string;
        eventType: string;
        profile: NotificationProviderProfile;
        metrics: NotificationProviderProfileRolloutMetrics;
        automationAction: "auto_promoted" | "auto_rolled_back";
      }> = [];
      const incidentsToCreate: NotificationProviderProfileIncident[] = [];
      const governanceAlertsToCreate: NotificationProviderProfileGovernanceAlert[] = [];
      const incidentsToUpdate: NotificationProviderProfileIncident[] = [];

      for (const profile of effectiveProfiles) {
        const workspaceOverrideRecord =
          updatedWorkspace.notificationProviderProfileOverrideRecords?.[profile.profileKey];

        if (!workspaceOverrideRecord?.value) {
          continue;
        }

        const currentProfile = workspaceOverrideRecord.value;
        const metrics = buildNotificationProviderProfileRolloutMetrics({
          profile: currentProfile,
          notifications,
          promotionPolicy: effectivePromotionPolicy,
          evaluationWindowStart
        });
        const isPromotionSuppressed = isOutboundNotificationProviderProfilePromotionSuppressed(
          currentProfile,
          checkedAt
        );

        if (
          effectivePromotionPolicy.autoPromoteEnabled &&
          currentProfile.rolloutState === "canary" &&
          metrics.promotionReadiness === "ready" &&
          !isPromotionSuppressed
        ) {
          const promotedProfile: NotificationProviderProfile = {
            ...currentProfile,
            rolloutState: "active",
            rolloutPercentage: 100,
            incidentState: currentProfile.incidentState
              ? {
                  ...currentProfile.incidentState,
                  suppressionUntil: null,
                  resolvedAt: checkedAt,
                  resolutionCode: "auto_promoted"
                }
              : null,
            operationalState: null
          };
          const requestId = buildProviderOperationsRequestId(
            "workspace-notification-provider-profile-auto-promote",
            `${workspace.workspaceId}-${currentProfile.profileKey}`
          );

          updatedWorkspace = updateWorkspaceNotificationProviderProfileRecord({
            workspace: updatedWorkspace,
            profileKey: currentProfile.profileKey,
            nextProfile: promotedProfile,
            requestId,
            updatedAt: checkedAt
          });
          const unresolvedIncident =
            await store.getLatestUnresolvedNotificationProviderProfileIncident(
              workspace.workspaceId,
              currentProfile.profileKey
            );

          if (unresolvedIncident) {
            incidentsToUpdate.push({
              ...unresolvedIncident,
              status: "resolved",
              suppressionUntil: null,
              resolvedAt: checkedAt,
              resolutionCode: "auto_promoted",
              sourceRequestId: requestId
            });
          }
          automationAuditEvents.push({
            requestId,
            eventType:
              "provider_operations.workspace.notification_provider_profile.auto_promoted",
            profile: promotedProfile,
            metrics,
            automationAction: "auto_promoted"
          });
          automatedChanges += 1;
          continue;
        }

        if (
          effectivePromotionPolicy.autoRollbackOnFailureEnabled &&
          currentProfile.rolloutState === "active" &&
          metrics.deliveryFailedCount >
            effectivePromotionPolicy.maximumDeliveryFailedCount
        ) {
          const suppressionUntil =
            effectivePromotionPolicy.autoPromotionSuppressionSeconds > 0
              ? new Date(
                  new Date(checkedAt).getTime() +
                    effectivePromotionPolicy.autoPromotionSuppressionSeconds * 1000
                ).toISOString()
              : null;
          const rolledBackProfile: NotificationProviderProfile = {
            ...currentProfile,
            rolloutState:
              currentProfile.rolloutFallbackProfileKey === null ? "paused" : "canary",
            rolloutPercentage:
              currentProfile.rolloutFallbackProfileKey === null
                ? currentProfile.rolloutPercentage
                : 0,
            incidentState: {
              incidentType: "auto_rollback_failure",
              openedAt: checkedAt,
              openedByActorType: "worker",
              openedByActorId: providerOperationsActorId,
              reasonCode: "delivery_failures_present",
              deliveryFailedCount: metrics.deliveryFailedCount,
              suppressionUntil,
              resolvedAt: null,
              resolutionCode: null
            },
            operationalState: null
          };
          const requestId = buildProviderOperationsRequestId(
            "workspace-notification-provider-profile-auto-rollback",
            `${workspace.workspaceId}-${currentProfile.profileKey}`
          );

          updatedWorkspace = updateWorkspaceNotificationProviderProfileRecord({
            workspace: updatedWorkspace,
            profileKey: currentProfile.profileKey,
            nextProfile: rolledBackProfile,
            requestId,
            updatedAt: checkedAt
          });
          const unresolvedIncident =
            await store.getLatestUnresolvedNotificationProviderProfileIncident(
              workspace.workspaceId,
              currentProfile.profileKey
            );

          if (!unresolvedIncident) {
            const createdIncident = createNotificationProviderProfileIncident({
                tenantId: workspace.tenantId,
                workspaceId: workspace.workspaceId,
                profileKey: currentProfile.profileKey,
                incidentType: "auto_rollback_failure",
                openedAt: checkedAt,
                openedByActorType: "worker",
                openedByActorId: providerOperationsActorId,
                reasonCode: "delivery_failures_present",
                deliveryFailedCount: metrics.deliveryFailedCount,
                suppressionUntil,
                sourceRequestId: requestId
              });
            incidentsToCreate.push(createdIncident);
            governanceAlertsToCreate.push(
              createNotificationProviderProfileGovernanceAlert({
                incident: createdIncident,
                profile: rolledBackProfile,
                notificationPolicy: resolveWorkspaceNotificationPolicy(workspace, tenant),
                notificationProviderProfiles: resolveWorkspaceNotificationProviderProfiles(
                  updatedWorkspace,
                  tenant
                ),
                createdAt: checkedAt,
                createdByActorType: "worker",
                createdByActorId: providerOperationsActorId,
                sourceRequestId: requestId
              })
            );
          }
          automationAuditEvents.push({
            requestId,
            eventType:
              "provider_operations.workspace.notification_provider_profile.auto_rolled_back",
            profile: rolledBackProfile,
            metrics,
            automationAction: "auto_rolled_back"
          });
          automatedChanges += 1;
        }
      }

      if (automationAuditEvents.length === 0) {
        continue;
      }

      await store.saveWorkspace(updatedWorkspace);

      for (const incident of incidentsToCreate) {
        await store.saveNotificationProviderProfileIncident(incident);
      }

      for (const governanceAlert of governanceAlertsToCreate) {
        await store.saveNotificationProviderProfileGovernanceAlert(governanceAlert);
      }

      for (const incident of incidentsToUpdate) {
        await store.updateNotificationProviderProfileIncident(incident);
      }

      for (const auditEvent of automationAuditEvents) {
        await recordNotificationProviderProfileAutomationAuditEvent({
          store,
          tenantId: tenant.tenantId,
          workspaceId: workspace.workspaceId,
          profile: auditEvent.profile,
          requestId: auditEvent.requestId,
          eventType: auditEvent.eventType,
          metrics: auditEvent.metrics,
          promotionPolicy: effectivePromotionPolicy,
          automationAction: auditEvent.automationAction
        });
      }
    }
  }

  return automatedChanges;
};

interface ProviderOperationsConfig {
  mode: "once" | "loop";
  maintenanceIntervalMs: number;
}

const parseProviderOperationsConfig = (argv: string[]): ProviderOperationsConfig => {
  const mode = argv.includes("--once") ? "once" : "loop";
  const maintenanceIntervalMs = Number.isInteger(defaultPollIntervalMs) && defaultPollIntervalMs > 0
    ? defaultPollIntervalMs
    : 1000;

  return {
    mode,
    maintenanceIntervalMs
  };
};

const main = async (): Promise<void> => {
  const config = parseProviderOperationsConfig(process.argv.slice(2));
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);
  let shouldStop = false;

  const requestShutdown = (signal: NodeJS.Signals): void => {
    if (shouldStop) {
      return;
    }

    shouldStop = true;
    console.log(
      `rewrite-spike provider-operations received ${signal}, finishing current cycle before shutdown`
    );
  };

  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  console.log(
    config.mode === "loop"
      ? `rewrite-spike provider-operations loop started (maintenanceIntervalMs=${config.maintenanceIntervalMs})`
      : "rewrite-spike provider-operations once mode started"
  );

  try {
    do {
      const refreshedProfiles = await synchronizeNotificationProviderProfiles(
        store,
        new Date().toISOString()
      );
      const automatedChanges = await reconcileNotificationProviderProfileRollouts(
        store,
        new Date().toISOString()
      );

      if (config.mode === "once" || refreshedProfiles > 0 || automatedChanges > 0) {
        console.log(
          `rewrite-spike provider-operations cycle refreshed ${refreshedProfiles} notification provider profile(s) and applied ${automatedChanges} rollout automation change(s)`
        );
      }

      if (config.mode === "once" || shouldStop) {
        break;
      }

      await delay(config.maintenanceIntervalMs);
    } while (!shouldStop);
  } finally {
    process.removeListener("SIGINT", requestShutdown);
    process.removeListener("SIGTERM", requestShutdown);
    await store.close();
  }

  console.log("rewrite-spike provider-operations stopped");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
