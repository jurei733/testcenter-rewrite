import {
  createDatabasePool,
  createPostgresPlatformStore,
  monitorCommandDispatchQueueChannel,
  type PlatformStore
} from "@testcenter-rewrite/db";
import {
  createAuditEvent,
  expireTestRunIfNeeded,
  markMonitorCommandApplied,
  markMonitorCommandExpired,
  markMonitorCommandRejected,
  pauseTestRun,
  resumeTestRun,
  unlockTestRunNavigation,
  type MonitorCommand,
  type TestRun
} from "@testcenter-rewrite/domain";

const maintenanceSweepBatchSize = 200;
const defaultPollIntervalMs = Number.parseInt(process.env.DISPATCHER_POLL_INTERVAL_MS ?? "1000", 10);
const dispatcherConsumerId = process.env.DISPATCHER_CONSUMER_ID ?? "monitor-dispatcher";

const recordMonitorCommandAuditEvent = async (input: {
  store: PlatformStore;
  command: MonitorCommand;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> => {
  await input.store.saveAuditEvent(createAuditEvent({
    requestId: input.command.requestId,
    tenantId: input.command.tenantId,
    workspaceId: input.command.workspaceId,
    participantSessionId: input.command.participantSessionId,
    testRunId: input.command.testRunId,
    loginKey: input.command.loginKey,
    groupKey: input.command.groupKey,
    assignmentKey: input.command.assignmentKey,
    actorType: "dispatcher",
    actorId: "monitor-dispatcher",
    eventType: input.eventType,
    payload: input.payload ?? {}
  }));
};

const synchronizeTimedOutTestRunIfNeeded = async (
  store: PlatformStore,
  command: MonitorCommand,
  testRun: TestRun
): Promise<TestRun> => {
  const synchronizedTestRun = expireTestRunIfNeeded(testRun);

  if (synchronizedTestRun === testRun) {
    return testRun;
  }

  await store.updateTestRun(synchronizedTestRun);
  await store.saveAuditEvent(createAuditEvent({
    requestId: command.requestId,
    tenantId: synchronizedTestRun.tenantId,
    workspaceId: synchronizedTestRun.workspaceId,
    participantSessionId: synchronizedTestRun.participantSessionId,
    testRunId: synchronizedTestRun.testRunId,
    loginKey: synchronizedTestRun.loginKey,
    groupKey: synchronizedTestRun.groupKey,
    assignmentKey: synchronizedTestRun.assignmentKey,
    actorType: "dispatcher",
    actorId: "monitor-dispatcher",
    eventType: "dispatcher.test_run.timed_out",
    payload: {
      testRunId: synchronizedTestRun.testRunId,
      attemptNumber: synchronizedTestRun.attemptNumber,
      timeLimitSeconds: synchronizedTestRun.timeLimitSeconds
    }
  }));

  return synchronizedTestRun;
};

const applyQueuedMonitorCommandToTestRun = (
  command: MonitorCommand,
  testRun: TestRun
): {
  updatedTestRun: TestRun | undefined;
  rejectionReason: string;
} => {
  switch (command.commandType) {
    case "pause":
      return {
        updatedTestRun: pauseTestRun(testRun),
        rejectionReason: `Test run '${command.testRunId}' could not be paused in its current state.`
      };
    case "resume":
      return {
        updatedTestRun: resumeTestRun(testRun),
        rejectionReason: `Test run '${command.testRunId}' could not be resumed in its current state.`
      };
    case "unlock_navigation":
      return {
        updatedTestRun: unlockTestRunNavigation(testRun),
        rejectionReason: `Test run '${command.testRunId}' could not unlock navigation in its current state.`
      };
    default:
      return {
        updatedTestRun: undefined,
        rejectionReason: `Unsupported monitor command '${String(command.commandType)}'.`
      };
  }
};

const expireStaleMonitorCommands = async (store: PlatformStore): Promise<number> => {
  const candidateCommands = await store.listExpirableMonitorCommands(maintenanceSweepBatchSize);
  let expiredCommands = 0;

  for (const command of candidateCommands) {
    const expirationReason = command.ackState === "pending_delivery"
      ? "delivery_timeout"
      : "resolution_timeout";
    const expiredCommand = markMonitorCommandExpired(command, expirationReason);

    await store.updateMonitorCommand(expiredCommand);
    await recordMonitorCommandAuditEvent({
      store,
      command: expiredCommand,
      eventType: "dispatcher.monitor_command.expired",
      payload: {
        commandId: expiredCommand.commandId,
        commandType: expiredCommand.commandType,
        attemptNumber: expiredCommand.attemptNumber,
        previousAckState: command.ackState,
        expirationReason
      }
    });
    expiredCommands += 1;
  }

  return expiredCommands;
};

const processQueuedMonitorCommands = async (store: PlatformStore): Promise<number> => {
  let processedCommands = 0;

  while (true) {
    const command = await store.claimNextPendingMonitorCommand(dispatcherConsumerId);

    if (!command) {
      break;
    }

    await recordMonitorCommandAuditEvent({
      store,
      command,
      eventType: "monitor.command.delivered",
      payload: {
        commandId: command.commandId,
        commandType: command.commandType,
        ackState: command.ackState
      }
    });

    const existingTestRun = await store.getTestRunById(command.testRunId);

    if (!existingTestRun) {
      const rejectedCommand = markMonitorCommandRejected(
        command,
        `Test run '${command.testRunId}' was not found for queued monitor command processing.`
      );
      await store.updateMonitorCommand(rejectedCommand);
      await recordMonitorCommandAuditEvent({
        store,
        command: rejectedCommand,
        eventType: "monitor.command.rejected",
        payload: {
          commandId: rejectedCommand.commandId,
          commandType: rejectedCommand.commandType,
          ackState: rejectedCommand.ackState,
          rejectionReason: rejectedCommand.rejectionReason
        }
      });
      processedCommands += 1;
      continue;
    }

    const synchronizedTestRun = await synchronizeTimedOutTestRunIfNeeded(store, command, existingTestRun);
    const commandResult = applyQueuedMonitorCommandToTestRun(command, synchronizedTestRun);

    if (!commandResult.updatedTestRun) {
      const rejectedCommand = markMonitorCommandRejected(command, commandResult.rejectionReason);
      await store.updateMonitorCommand(rejectedCommand);
      await recordMonitorCommandAuditEvent({
        store,
        command: rejectedCommand,
        eventType: "monitor.command.rejected",
        payload: {
          commandId: rejectedCommand.commandId,
          commandType: rejectedCommand.commandType,
          ackState: rejectedCommand.ackState,
          rejectionReason: rejectedCommand.rejectionReason
        }
      });
      processedCommands += 1;
      continue;
    }

    await store.updateTestRun(commandResult.updatedTestRun);
    const appliedCommand = markMonitorCommandApplied(command);
    await store.updateMonitorCommand(appliedCommand);
    await recordMonitorCommandAuditEvent({
      store,
      command: appliedCommand,
      eventType: "monitor.command.applied",
      payload: {
        commandId: appliedCommand.commandId,
        commandType: appliedCommand.commandType,
        ackState: appliedCommand.ackState
      }
    });
    processedCommands += 1;
  }

  return processedCommands;
};

const runDispatcherCycle = async (store: PlatformStore): Promise<{
  processedMonitorCommands: number;
  expiredCommands: number;
}> => {
  const processedMonitorCommands = await processQueuedMonitorCommands(store);
  const expiredCommands = await expireStaleMonitorCommands(store);

  return {
    processedMonitorCommands,
    expiredCommands
  };
};

interface DispatcherConfig {
  mode: "once" | "loop";
  maintenanceIntervalMs: number;
}

const parseDispatcherConfig = (argv: string[]): DispatcherConfig => {
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
  const config = parseDispatcherConfig(process.argv.slice(2));
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
    console.log(`rewrite-spike dispatcher received ${signal}, finishing current cycle before shutdown`);
  };

  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  listenerClient.on("notification", message => {
    if (message.channel === monitorCommandDispatchQueueChannel) {
      dispatchSignalWaiter.notify();
    }
  });
  await listenerClient.query(`LISTEN ${monitorCommandDispatchQueueChannel}`);

  console.log(
    config.mode === "loop"
      ? `rewrite-spike dispatcher loop started (maintenanceIntervalMs=${config.maintenanceIntervalMs})`
      : "rewrite-spike dispatcher once mode started"
  );

  try {
    do {
      const cycleSummary = await runDispatcherCycle(store);

      if (config.mode === "once" ||
        cycleSummary.processedMonitorCommands > 0 ||
        cycleSummary.expiredCommands > 0) {
        console.log(
          `rewrite-spike dispatcher cycle processed ${cycleSummary.processedMonitorCommands} monitor command(s), expired ${cycleSummary.expiredCommands} command(s)`
        );
      }

      if (config.mode === "once" || shouldStop) {
        break;
      }

      if (cycleSummary.processedMonitorCommands === 0) {
        await dispatchSignalWaiter.wait(config.maintenanceIntervalMs);
      }
    } while (!shouldStop);
  } finally {
    process.removeListener("SIGINT", requestShutdown);
    process.removeListener("SIGTERM", requestShutdown);
    listenerClient.removeAllListeners("notification");
    await listenerClient.query(`UNLISTEN ${monitorCommandDispatchQueueChannel}`).catch(() => undefined);
    listenerClient.release();
    await listenerPool.end();
    await store.close();
  }

  console.log("rewrite-spike dispatcher stopped");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
