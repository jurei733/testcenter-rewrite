import {
  createDatabasePool,
  createPostgresPlatformStore,
  type PlatformStore
} from "@testcenter-rewrite/db";
import {
  createAuditEvent,
  type NotificationProviderProfile
} from "@testcenter-rewrite/domain";
import { refreshOutboundNotificationProviderProfileOperationalState } from "@testcenter-rewrite/outbound-messaging";
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

      if (config.mode === "once" || refreshedProfiles > 0) {
        console.log(
          `rewrite-spike provider-operations cycle refreshed ${refreshedProfiles} notification provider profile(s)`
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
