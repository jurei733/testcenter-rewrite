import {
  breachNotificationDispatchQueueChannel,
  createDatabasePool,
  createPostgresPlatformStore,
  type PlatformStore
} from "@testcenter-rewrite/db";
import {
  createAuditEvent,
  markSystemCheckEvidenceBreachNotificationDelivered,
  markSystemCheckEvidenceBreachNotificationDeliveryFailed,
  resolveWorkspaceNotificationPolicy,
  scheduleSystemCheckEvidenceBreachNotificationDeliveryRetry
} from "@testcenter-rewrite/domain";
import {
  deliverSpikeOutboundNotification,
  resolveOutboundNotificationRetryDelaySeconds
} from "@testcenter-rewrite/outbound-messaging";

const maintenanceSweepBatchSize = 200;
const defaultPollIntervalMs = Number.parseInt(
  process.env.NOTIFICATION_SERVICE_POLL_INTERVAL_MS ?? "1000",
  10
);
const notificationServiceId = process.env.NOTIFICATION_SERVICE_ID ?? "outbound-notification-service";

const recordBreachNotificationAuditEvent = async (input: {
  store: PlatformStore;
  notification: import("@testcenter-rewrite/domain").SystemCheckEvidenceBreachNotification;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> => {
  await input.store.saveAuditEvent(createAuditEvent({
    requestId: input.notification.sourceRequestId ?? `notification-service-${input.notification.notificationId}`,
    tenantId: input.notification.tenantId,
    workspaceId: input.notification.workspaceId,
    participantSessionId: input.notification.participantSessionId,
    loginKey: input.notification.loginKey,
    groupKey: input.notification.groupKey,
    actorType: "notification_service",
    actorId: notificationServiceId,
    eventType: input.eventType,
    payload: input.payload ?? {}
  }));
};

const processPendingBreachNotificationDeliveries = async (store: PlatformStore): Promise<number> => {
  const pendingNotifications = await store.listPendingSystemCheckEvidenceBreachNotificationDeliveries(
    maintenanceSweepBatchSize
  );
  let processedNotifications = 0;

  for (const notification of pendingNotifications) {
    const [tenant, workspace] = await Promise.all([
      store.getTenantById(notification.tenantId),
      store.getWorkspaceById(notification.workspaceId)
    ]);
    const notificationPolicy =
      tenant && workspace
        ? resolveWorkspaceNotificationPolicy(workspace, tenant)
        : null;

    if (!notification.deliveryTarget) {
      const failedNotification = markSystemCheckEvidenceBreachNotificationDeliveryFailed({
        notification,
        failureReason: "No delivery target is configured for this breach notification."
      });
      await store.updateSystemCheckEvidenceBreachNotification(failedNotification);
      await recordBreachNotificationAuditEvent({
        store,
        notification: failedNotification,
        eventType: "notification_service.system_check_evidence.breach_notification.delivery_failed",
        payload: {
          notificationId: failedNotification.notificationId,
          evidenceKey: failedNotification.evidenceKey,
          deliveryChannel: failedNotification.deliveryChannel,
          deliveryStatus: failedNotification.deliveryStatus,
          deliveryTarget: failedNotification.deliveryTarget,
          deliveryAttemptCount: failedNotification.deliveryAttemptCount,
          lastDeliveryReceiptId: failedNotification.lastDeliveryReceiptId,
          lastDeliveryReceiptIssuedAt: failedNotification.lastDeliveryReceiptIssuedAt,
          lastDeliveryError: failedNotification.lastDeliveryError
        }
      });
      processedNotifications += 1;
      continue;
    }

    const deliveryResult = await deliverSpikeOutboundNotification({
      deliveryChannel: notification.deliveryChannel,
      deliveryTarget: notification.deliveryTarget,
      deliveryAttemptCount: notification.deliveryAttemptCount
    });

    if (deliveryResult.outcome === "delivered") {
      const deliveredNotification = markSystemCheckEvidenceBreachNotificationDelivered({
        notification: {
          ...notification,
          deliveryTarget: deliveryResult.normalizedTarget
        },
        receiptId: deliveryResult.providerReceiptId,
        receiptIssuedAt: deliveryResult.providerReceiptIssuedAt
      });
      await store.updateSystemCheckEvidenceBreachNotification(deliveredNotification);
      await recordBreachNotificationAuditEvent({
        store,
        notification: deliveredNotification,
        eventType: "notification_service.system_check_evidence.breach_notification.delivered",
        payload: {
          notificationId: deliveredNotification.notificationId,
          evidenceKey: deliveredNotification.evidenceKey,
          deliveryChannel: deliveredNotification.deliveryChannel,
          deliveryStatus: deliveredNotification.deliveryStatus,
          deliveryTarget: deliveredNotification.deliveryTarget,
          deliveryAttemptCount: deliveredNotification.deliveryAttemptCount,
          lastDeliveryReceiptId: deliveredNotification.lastDeliveryReceiptId,
          lastDeliveryReceiptIssuedAt: deliveredNotification.lastDeliveryReceiptIssuedAt,
          deliveredAt: deliveredNotification.deliveredAt
        }
      });
      processedNotifications += 1;
      continue;
    }

    if (
      deliveryResult.outcome === "retryable_failure" &&
      notification.deliveryAttemptCount + 1 < notification.maxDeliveryAttempts
    ) {
      const attemptedAt = new Date().toISOString();
      const retryDelayMs = Math.max(
        0,
        resolveOutboundNotificationRetryDelaySeconds({
          notificationPolicy: notificationPolicy ?? undefined,
          deliveryChannel: notification.deliveryChannel
        }) * 1000
      );
      const retryAt =
        retryDelayMs > 0
          ? new Date(Date.parse(attemptedAt) + retryDelayMs).toISOString()
          : attemptedAt;
      const retryScheduledNotification = scheduleSystemCheckEvidenceBreachNotificationDeliveryRetry({
        notification: {
          ...notification,
          deliveryTarget: deliveryResult.normalizedTarget
        },
        failureReason: deliveryResult.failureReason ?? "Retryable breach-notification delivery failure.",
        attemptedAt,
        retryAt,
        receiptId: deliveryResult.providerReceiptId,
        receiptIssuedAt: deliveryResult.providerReceiptIssuedAt
      });
      await store.updateSystemCheckEvidenceBreachNotification(retryScheduledNotification);
      await recordBreachNotificationAuditEvent({
        store,
        notification: retryScheduledNotification,
        eventType: "notification_service.system_check_evidence.breach_notification.retry_scheduled",
        payload: {
          notificationId: retryScheduledNotification.notificationId,
          evidenceKey: retryScheduledNotification.evidenceKey,
          deliveryChannel: retryScheduledNotification.deliveryChannel,
          deliveryStatus: retryScheduledNotification.deliveryStatus,
          deliveryTarget: retryScheduledNotification.deliveryTarget,
          deliveryAttemptCount: retryScheduledNotification.deliveryAttemptCount,
          nextDeliveryAttemptAt: retryScheduledNotification.nextDeliveryAttemptAt,
          lastDeliveryReceiptId: retryScheduledNotification.lastDeliveryReceiptId,
          lastDeliveryReceiptIssuedAt: retryScheduledNotification.lastDeliveryReceiptIssuedAt,
          lastDeliveryError: retryScheduledNotification.lastDeliveryError
        }
      });
      processedNotifications += 1;
      continue;
    }

    const failedNotification = markSystemCheckEvidenceBreachNotificationDeliveryFailed({
      notification: {
        ...notification,
        deliveryTarget: deliveryResult.normalizedTarget
      },
      failureReason: deliveryResult.failureReason ?? "Breach notification delivery failed.",
      receiptId: deliveryResult.providerReceiptId,
      receiptIssuedAt: deliveryResult.providerReceiptIssuedAt
    });
    await store.updateSystemCheckEvidenceBreachNotification(failedNotification);
    await recordBreachNotificationAuditEvent({
      store,
      notification: failedNotification,
      eventType: "notification_service.system_check_evidence.breach_notification.delivery_failed",
      payload: {
        notificationId: failedNotification.notificationId,
        evidenceKey: failedNotification.evidenceKey,
        deliveryChannel: failedNotification.deliveryChannel,
        deliveryStatus: failedNotification.deliveryStatus,
        deliveryTarget: failedNotification.deliveryTarget,
        deliveryAttemptCount: failedNotification.deliveryAttemptCount,
        lastDeliveryReceiptId: failedNotification.lastDeliveryReceiptId,
        lastDeliveryReceiptIssuedAt: failedNotification.lastDeliveryReceiptIssuedAt,
        lastDeliveryError: failedNotification.lastDeliveryError
      }
    });
    processedNotifications += 1;
  }

  return processedNotifications;
};

interface NotificationServiceConfig {
  mode: "once" | "loop";
  maintenanceIntervalMs: number;
}

const parseNotificationServiceConfig = (argv: string[]): NotificationServiceConfig => {
  const mode = argv.includes("--once") ? "once" : "loop";
  const maintenanceIntervalMs = Number.isInteger(defaultPollIntervalMs) && defaultPollIntervalMs > 0
    ? defaultPollIntervalMs
    : 1000;

  return {
    mode,
    maintenanceIntervalMs
  };
};

const createDispatchSignalWaiter = () => {
  let pendingSignal = false;
  let activeResolver: (() => void) | null = null;

  return {
    notify: (): void => {
      pendingSignal = true;

      if (activeResolver) {
        const resolver = activeResolver;
        activeResolver = null;
        resolver();
      }
    },
    wait: async (timeoutMs: number): Promise<"notification" | "timeout"> => {
      if (pendingSignal) {
        pendingSignal = false;
        return "notification";
      }

      return new Promise(resolve => {
        const timer = setTimeout(() => {
          activeResolver = null;
          resolve("timeout");
        }, timeoutMs);

        activeResolver = () => {
          clearTimeout(timer);
          pendingSignal = false;
          resolve("notification");
        };
      });
    }
  };
};

const main = async (): Promise<void> => {
  const config = parseNotificationServiceConfig(process.argv.slice(2));
  const pool = createDatabasePool();
  const listenerPool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);
  const listenerClient = await listenerPool.connect();
  const dispatchSignalWaiter = createDispatchSignalWaiter();
  let shouldStop = false;

  const requestShutdown = (signal: NodeJS.Signals): void => {
    if (shouldStop) {
      return;
    }

    shouldStop = true;
    dispatchSignalWaiter.notify();
    console.log(`rewrite-spike notification service received ${signal}, finishing current cycle before shutdown`);
  };

  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  listenerClient.on("notification", message => {
    if (message.channel === breachNotificationDispatchQueueChannel) {
      dispatchSignalWaiter.notify();
    }
  });
  await listenerClient.query(`LISTEN ${breachNotificationDispatchQueueChannel}`);

  console.log(
    config.mode === "loop"
      ? `rewrite-spike notification service loop started (maintenanceIntervalMs=${config.maintenanceIntervalMs})`
      : "rewrite-spike notification service once mode started"
  );

  try {
    do {
      const processedNotifications = await processPendingBreachNotificationDeliveries(store);

      if (config.mode === "once" || processedNotifications > 0) {
        console.log(
          `rewrite-spike notification service cycle processed ${processedNotifications} breach notification(s)`
        );
      }

      if (config.mode === "once" || shouldStop) {
        break;
      }

      if (processedNotifications === 0) {
        await dispatchSignalWaiter.wait(config.maintenanceIntervalMs);
      }
    } while (!shouldStop);
  } finally {
    process.removeListener("SIGINT", requestShutdown);
    process.removeListener("SIGTERM", requestShutdown);
    listenerClient.removeAllListeners("notification");
    await listenerClient.query(`UNLISTEN ${breachNotificationDispatchQueueChannel}`).catch(() => undefined);
    listenerClient.release();
    await listenerPool.end();
    await store.close();
  }

  console.log("rewrite-spike notification service stopped");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
