import {
  createDatabasePool,
  createPostgresPlatformStore,
  type PlatformStore
} from "@testcenter-rewrite/db";
import { purgeSystemCheckEvidencePayload } from "@testcenter-rewrite/evidence-storage";
import {
  createAuditEvent,
  createContentRelease,
  createSystemCheckEvidenceBreachNotification,
  escalateSystemCheckEvidenceRetentionHold,
  expireTestRunIfNeeded,
  getSystemCheckEvidenceHoldAcknowledgementStatus,
  getSystemCheckEvidenceHoldAssignmentStatus,
  getSystemCheckEvidenceHoldEscalationStatus,
  getSystemCheckEvidenceHoldSlaStatus,
  isSystemCheckEvidenceHeld,
  isSystemCheckEvidenceRetentionExpired,
  markSystemCheckEvidencePurged,
  resolveWorkspaceOperationalPolicy,
  resolveWorkspaceNotificationPolicy,
  resolveWorkspaceNotificationProviderProfiles,
  type SystemCheckEvidence,
  type TestRun
} from "@testcenter-rewrite/domain";
import { runFixtureImportPipeline } from "@testcenter-rewrite/test-fixtures";
import { setTimeout as delay } from "node:timers/promises";

const buildWorkerRequestId = (importJobId: string): string => `worker-import-job-${importJobId}`;
const buildMaintenanceRequestId = (scope: string, recordId: string): string => `worker-${scope}-${recordId}`;
const maintenanceSweepBatchSize = 200;
const defaultPollIntervalMs = Number.parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? "1000", 10);

const toSystemCheckEvidenceHoldAuditPayload = (
  systemCheckEvidence: SystemCheckEvidence
): Record<string, unknown> => ({
  holdReasonCode: systemCheckEvidence.retentionHold?.holdReasonCode ?? null,
  holdNote: systemCheckEvidence.retentionHold?.holdNote ?? null,
  acknowledgementRequired: systemCheckEvidence.retentionHold?.acknowledgementRequired ?? null,
  acknowledgementStatus: systemCheckEvidence.retentionHold
    ? getSystemCheckEvidenceHoldAcknowledgementStatus(systemCheckEvidence.retentionHold)
    : null,
  acknowledgedAt: systemCheckEvidence.retentionHold?.acknowledgedAt ?? null,
  acknowledgedByActorId: systemCheckEvidence.retentionHold?.acknowledgedByActorId ?? null,
  acknowledgementNote: systemCheckEvidence.retentionHold?.acknowledgementNote ?? null,
  defaultAssigneeTarget: systemCheckEvidence.retentionHold?.defaultAssigneeTarget ?? null,
  assignmentStatus: systemCheckEvidence.retentionHold
    ? getSystemCheckEvidenceHoldAssignmentStatus(systemCheckEvidence.retentionHold)
    : null,
  assignedToActorId: systemCheckEvidence.retentionHold?.assignedToActorId ?? null,
  assignedByActorId: systemCheckEvidence.retentionHold?.assignedByActorId ?? null,
  assignedAt: systemCheckEvidence.retentionHold?.assignedAt ?? null,
  assignmentNote: systemCheckEvidence.retentionHold?.assignmentNote ?? null,
  slaSeconds: systemCheckEvidence.retentionHold?.slaSeconds ?? null,
  slaDueAt: systemCheckEvidence.retentionHold?.slaDueAt ?? null,
  slaStatus: systemCheckEvidence.retentionHold
    ? getSystemCheckEvidenceHoldSlaStatus(systemCheckEvidence.retentionHold)
    : null,
  escalationTarget: systemCheckEvidence.retentionHold?.escalationTarget ?? null,
  escalationStatus: systemCheckEvidence.retentionHold
    ? getSystemCheckEvidenceHoldEscalationStatus(systemCheckEvidence.retentionHold)
    : null,
  escalatedAt: systemCheckEvidence.retentionHold?.escalatedAt ?? null,
  escalatedByActorId: systemCheckEvidence.retentionHold?.escalatedByActorId ?? null,
  escalationNote: systemCheckEvidence.retentionHold?.escalationNote ?? null
});

const recordImportAuditEvent = async (input: {
  store: PlatformStore;
  importJob: {
    importJobId: string;
    tenantId: string;
    workspaceId: string;
  };
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> => {
  await input.store.saveAuditEvent(createAuditEvent({
    requestId: buildWorkerRequestId(input.importJob.importJobId),
    tenantId: input.importJob.tenantId,
    workspaceId: input.importJob.workspaceId,
    actorType: "worker",
    actorId: "import-worker",
    eventType: input.eventType,
    payload: input.payload
  }));
};

const resolveTimedRunMaintenanceGraceMs = async (
  store: PlatformStore,
  testRun: TestRun
): Promise<number> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantById(testRun.tenantId),
    store.getWorkspaceById(testRun.workspaceId)
  ]);

  if (!tenant || !workspace) {
    return 0;
  }

  return resolveWorkspaceOperationalPolicy(workspace, tenant).timedRunMaintenanceGraceSeconds * 1000;
};

const persistTimedOutTestRunIfNeeded = async (store: PlatformStore, testRun: TestRun): Promise<TestRun> => {
  const maintenanceGraceMs = await resolveTimedRunMaintenanceGraceMs(store, testRun);
  const synchronizedTestRun = expireTestRunIfNeeded(testRun, Date.now() - maintenanceGraceMs);

  if (synchronizedTestRun === testRun) {
    return testRun;
  }

  await store.updateTestRun(synchronizedTestRun);
  await store.saveAuditEvent(createAuditEvent({
    requestId: buildMaintenanceRequestId("test-run-timeout", synchronizedTestRun.testRunId),
    tenantId: synchronizedTestRun.tenantId,
    workspaceId: synchronizedTestRun.workspaceId,
    participantSessionId: synchronizedTestRun.participantSessionId,
    testRunId: synchronizedTestRun.testRunId,
    loginKey: synchronizedTestRun.loginKey,
    groupKey: synchronizedTestRun.groupKey,
    assignmentKey: synchronizedTestRun.assignmentKey,
    actorType: "worker",
    actorId: "maintenance-worker",
    eventType: "worker.test_run.timed_out",
    payload: {
      testRunId: synchronizedTestRun.testRunId,
      attemptNumber: synchronizedTestRun.attemptNumber,
      timeLimitSeconds: synchronizedTestRun.timeLimitSeconds,
      maintenanceGraceSeconds: Math.floor(maintenanceGraceMs / 1000)
    }
  }));

  return synchronizedTestRun;
};

const synchronizeTimedOutTestRuns = async (store: PlatformStore): Promise<number> => {
  const candidateRuns = await store.listActiveTimedTestRuns(maintenanceSweepBatchSize);
  let timedOutRuns = 0;

  for (const testRun of candidateRuns) {
    const synchronizedTestRun = await persistTimedOutTestRunIfNeeded(store, testRun);

    if (synchronizedTestRun !== testRun) {
      timedOutRuns += 1;
    }
  }

  return timedOutRuns;
};

const purgeRetainedSystemCheckEvidenceIfNeeded = async (
  store: PlatformStore,
  systemCheckEvidence: SystemCheckEvidence
): Promise<boolean> => {
  if (
    !isSystemCheckEvidenceRetentionExpired(systemCheckEvidence) ||
    systemCheckEvidence.purgedAt ||
    isSystemCheckEvidenceHeld(systemCheckEvidence)
  ) {
    return false;
  }

  await purgeSystemCheckEvidencePayload(systemCheckEvidence);
  const purgedEvidence = markSystemCheckEvidencePurged(systemCheckEvidence);
  await store.updateSystemCheckEvidence(purgedEvidence);
  await store.saveAuditEvent(createAuditEvent({
    requestId: buildMaintenanceRequestId("system-check-evidence-purge", purgedEvidence.evidenceKey),
    tenantId: purgedEvidence.tenantId,
    workspaceId: purgedEvidence.workspaceId,
    participantSessionId: purgedEvidence.participantSessionId,
    loginKey: purgedEvidence.loginKey,
    groupKey: purgedEvidence.groupKey,
    actorType: "worker",
    actorId: "maintenance-worker",
    eventType: "worker.system_check_evidence.purged",
    payload: {
      evidenceKey: purgedEvidence.evidenceKey,
      systemCheckKey: purgedEvidence.systemCheckKey,
      checkKey: purgedEvidence.checkKey,
      retentionClass: purgedEvidence.retentionClass,
      retentionPolicyKey: purgedEvidence.retentionPolicyKey,
      storageBackend: purgedEvidence.storageBackend,
      retentionExpiresAt: purgedEvidence.retentionExpiresAt,
      purgedAt: purgedEvidence.purgedAt,
      purgeReasonCode: purgedEvidence.purgeReasonCode
    }
  }));

  return true;
};

const synchronizeRetainedSystemCheckEvidence = async (store: PlatformStore): Promise<number> => {
  const candidates = await store.listSystemCheckEvidenceRetentionPurgeCandidates(maintenanceSweepBatchSize);
  let purgedEvidenceCount = 0;

  for (const systemCheckEvidence of candidates) {
    if (await purgeRetainedSystemCheckEvidenceIfNeeded(store, systemCheckEvidence)) {
      purgedEvidenceCount += 1;
    }
  }

  return purgedEvidenceCount;
};

const escalateHeldSystemCheckEvidenceIfNeeded = async (
  store: PlatformStore,
  systemCheckEvidence: SystemCheckEvidence
): Promise<boolean> => {
  if (
    !systemCheckEvidence.retentionHold ||
    systemCheckEvidence.purgedAt ||
    systemCheckEvidence.retentionHold.acknowledgedAt ||
    systemCheckEvidence.retentionHold.escalatedAt
  ) {
    return false;
  }

  const escalatedEvidence = escalateSystemCheckEvidenceRetentionHold({
    systemCheckEvidence,
    escalatedByActorId: "maintenance-sla-escalation",
    escalationNote: `Escalated automatically to '${systemCheckEvidence.retentionHold.escalationTarget}' because the hold SLA elapsed without acknowledgement.`
  });
  const requestId = buildMaintenanceRequestId("system-check-evidence-hold-escalation", escalatedEvidence.evidenceKey);
  const [tenant, workspace] = await Promise.all([
    store.getTenantById(escalatedEvidence.tenantId),
    store.getWorkspaceById(escalatedEvidence.workspaceId)
  ]);
  const breachNotification = createSystemCheckEvidenceBreachNotification({
    systemCheckEvidence: escalatedEvidence,
    createdByActorType: "worker",
    createdByActorId: "maintenance-worker",
    sourceRequestId: requestId,
    notificationPolicy:
      tenant && workspace
        ? resolveWorkspaceNotificationPolicy(workspace, tenant)
        : undefined,
    notificationProviderProfiles:
      tenant && workspace
        ? resolveWorkspaceNotificationProviderProfiles(workspace, tenant)
        : undefined
  });

  await store.updateSystemCheckEvidence(escalatedEvidence);
  await store.saveSystemCheckEvidenceBreachNotification(breachNotification);
  await store.saveAuditEvent(createAuditEvent({
    requestId,
    tenantId: escalatedEvidence.tenantId,
    workspaceId: escalatedEvidence.workspaceId,
    participantSessionId: escalatedEvidence.participantSessionId,
    loginKey: escalatedEvidence.loginKey,
    groupKey: escalatedEvidence.groupKey,
    actorType: "worker",
    actorId: "maintenance-worker",
    eventType: "worker.system_check_evidence.hold_escalated",
    payload: {
      evidenceKey: escalatedEvidence.evidenceKey,
      systemCheckKey: escalatedEvidence.systemCheckKey,
      checkKey: escalatedEvidence.checkKey,
      retentionClass: escalatedEvidence.retentionClass,
      retentionPolicyKey: escalatedEvidence.retentionPolicyKey,
      retentionExpiresAt: escalatedEvidence.retentionExpiresAt,
      notificationId: breachNotification.notificationId,
      ...toSystemCheckEvidenceHoldAuditPayload(escalatedEvidence)
    }
  }));
  await store.saveAuditEvent(createAuditEvent({
    requestId,
    tenantId: escalatedEvidence.tenantId,
    workspaceId: escalatedEvidence.workspaceId,
    participantSessionId: escalatedEvidence.participantSessionId,
    loginKey: escalatedEvidence.loginKey,
    groupKey: escalatedEvidence.groupKey,
    actorType: "worker",
    actorId: "maintenance-worker",
    eventType: "worker.system_check_evidence.breach_notification.enqueued",
    payload: {
      notificationId: breachNotification.notificationId,
      evidenceKey: breachNotification.evidenceKey,
      systemCheckKey: breachNotification.systemCheckKey,
      checkKey: breachNotification.checkKey,
      holdReasonCode: breachNotification.holdReasonCode,
      escalationTarget: breachNotification.escalationTarget,
      assignedToActorId: breachNotification.assignedToActorId,
      notificationChannel: breachNotification.notificationChannel,
      status: breachNotification.status,
      sourceRequestId: breachNotification.sourceRequestId
    }
  }));

  return true;
};

const synchronizeHeldSystemCheckEvidenceEscalations = async (store: PlatformStore): Promise<number> => {
  const candidates = await store.listSystemCheckEvidenceHoldEscalationCandidates(maintenanceSweepBatchSize);
  let escalatedEvidenceCount = 0;

  for (const systemCheckEvidence of candidates) {
    if (await escalateHeldSystemCheckEvidenceIfNeeded(store, systemCheckEvidence)) {
      escalatedEvidenceCount += 1;
    }
  }

  return escalatedEvidenceCount;
};

const processImportJobs = async (store: PlatformStore): Promise<number> => {
  let processedJobs = 0;

  while (true) {
    const importJob = await store.claimNextQueuedImportJob();

    if (!importJob) {
      break;
    }

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.started",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: importJob.sourcePackageId,
        stage: "worker_started"
      }
    });

    const sourcePackage = await store.getSourcePackageById(importJob.sourcePackageId);

    if (!sourcePackage) {
      const failureMessage = `Source package '${importJob.sourcePackageId}' could not be found for import.`;
      await store.markImportJobFailed(importJob.importJobId, failureMessage);
      await recordImportAuditEvent({
        store,
        importJob,
        eventType: "worker.import_job.failed",
        payload: {
          importJobId: importJob.importJobId,
          sourcePackageId: importJob.sourcePackageId,
          failedStage: "load_source_package",
          failureMessage
        }
      });
      continue;
    }

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.source_package.loaded",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        fileName: sourcePackage.fileName,
        stage: "load_source_package"
      }
    });

    const importPipelineResult = runFixtureImportPipeline(
      sourcePackage.fileName,
      sourcePackage.manifestHash
    );

    if (!importPipelineResult) {
      const failureMessage = `No registered importer matches source package '${sourcePackage.fileName}'.`;
      await store.markImportJobFailed(importJob.importJobId, failureMessage);
      await recordImportAuditEvent({
        store,
        importJob,
        eventType: "worker.import_job.failed",
        payload: {
          importJobId: importJob.importJobId,
          sourcePackageId: sourcePackage.sourcePackageId,
          fileName: sourcePackage.fileName,
          failedStage: "select_importer",
          failureMessage
        }
      });
      continue;
    }

    const {
      importerKey,
      fixture,
      sourceManifest,
      sourceModelSummary,
      canonicalSnapshot,
      referenceMappings,
      failureScenario
    } = importPipelineResult;

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.importer.selected",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        importerKey,
        fixtureKey: fixture.fixtureKey,
        releaseLabel: fixture.releaseLabel,
        stage: "select_importer"
      }
    });

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.source_manifest.extracted",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        stage: "extract_source_manifest",
        ...sourceManifest
      }
    });

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.source_model.built",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        stage: "build_source_model",
        ...sourceModelSummary
      }
    });

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.reference_map.built",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        stage: "build_reference_map",
        importerKey,
        fixtureKey: fixture.fixtureKey,
        referenceMappings
      }
    });

    if (failureScenario?.failedStage === "validate_source_model") {
      await store.markImportJobFailed(importJob.importJobId, failureScenario.failureMessage);
      await recordImportAuditEvent({
        store,
        importJob,
        eventType: "worker.import_job.failed",
        payload: {
          importJobId: importJob.importJobId,
          sourcePackageId: sourcePackage.sourcePackageId,
          failedStage: "validate_source_model",
          importerKey,
          fixtureKey: fixture.fixtureKey,
          failureMessage: failureScenario.failureMessage,
          referenceMappings,
          validationIssues: failureScenario.validationIssues
        }
      });
      continue;
    }

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.source_model.validated",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        stage: "validate_source_model",
        importerKey,
        fixtureKey: fixture.fixtureKey,
        validationStatus: "ok"
      }
    });

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.canonical_snapshot.transformed",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        stage: "transform_to_canonical",
        fixtureKey: fixture.fixtureKey,
        unitCount: canonicalSnapshot.unitKeys.length,
        bookletCount: canonicalSnapshot.bookletDefinitions.length,
        loginCount: canonicalSnapshot.loginCollections.reduce(
          (count, collection) => count + collection.loginKeys.length,
          0
        ),
        assignmentCount: canonicalSnapshot.bookletAssignments.length
      }
    });

    if (failureScenario?.failedStage === "validate_canonical_snapshot") {
      await store.markImportJobFailed(importJob.importJobId, failureScenario.failureMessage);
      await recordImportAuditEvent({
        store,
        importJob,
        eventType: "worker.import_job.failed",
        payload: {
          importJobId: importJob.importJobId,
          sourcePackageId: sourcePackage.sourcePackageId,
          failedStage: "validate_canonical_snapshot",
          importerKey,
          fixtureKey: fixture.fixtureKey,
          failureMessage: failureScenario.failureMessage,
          referenceMappings,
          validationIssues: failureScenario.validationIssues,
          unitCount: canonicalSnapshot.unitKeys.length,
          bookletCount: canonicalSnapshot.bookletDefinitions.length,
          loginCount: canonicalSnapshot.loginCollections.reduce(
            (count, collection) => count + collection.loginKeys.length,
            0
          ),
          assignmentCount: canonicalSnapshot.bookletAssignments.length
        }
      });
      continue;
    }

    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.canonical_snapshot.validated",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        stage: "validate_canonical_snapshot",
        fixtureKey: fixture.fixtureKey,
        validationStatus: "ok",
        unitCount: canonicalSnapshot.unitKeys.length,
        bookletCount: canonicalSnapshot.bookletDefinitions.length,
        loginCount: canonicalSnapshot.loginCollections.reduce(
          (count, collection) => count + collection.loginKeys.length,
          0
        ),
        assignmentCount: canonicalSnapshot.bookletAssignments.length
      }
    });

    const contentRelease = createContentRelease({
      tenantId: importJob.tenantId,
      workspaceId: importJob.workspaceId,
      sourcePackageId: sourcePackage.sourcePackageId,
      importJobId: importJob.importJobId,
      fixtureKey: fixture.fixtureKey,
      releaseLabel: fixture.releaseLabel,
      canonicalSnapshot
    });

    await store.saveContentRelease(contentRelease);
    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.canonical_snapshot.materialized",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        contentReleaseId: contentRelease.contentReleaseId,
        fixtureKey: fixture.fixtureKey,
        stage: "materialize_content_release",
        unitCount: canonicalSnapshot.unitKeys.length,
        bookletCount: canonicalSnapshot.bookletDefinitions.length,
        loginCount: canonicalSnapshot.loginCollections.reduce(
          (count, collection) => count + collection.loginKeys.length,
          0
        ),
        assignmentCount: canonicalSnapshot.bookletAssignments.length
      }
    });
    await store.markImportJobCompleted(importJob.importJobId);
    await recordImportAuditEvent({
      store,
      importJob,
      eventType: "worker.import_job.completed",
      payload: {
        importJobId: importJob.importJobId,
        sourcePackageId: sourcePackage.sourcePackageId,
        contentReleaseId: contentRelease.contentReleaseId,
        fixtureKey: fixture.fixtureKey,
        stage: "complete"
      }
    });
    processedJobs += 1;
  }

  return processedJobs;
};

const runWorkerCycle = async (store: PlatformStore): Promise<{
  processedJobs: number;
  timedOutRuns: number;
  purgedEvidence: number;
  escalatedHeldEvidence: number;
}> => {
  const processedJobs = await processImportJobs(store);
  const timedOutRuns = await synchronizeTimedOutTestRuns(store);
  const purgedEvidence = await synchronizeRetainedSystemCheckEvidence(store);
  const escalatedHeldEvidence = await synchronizeHeldSystemCheckEvidenceEscalations(store);

  return {
    processedJobs,
    timedOutRuns,
    purgedEvidence,
    escalatedHeldEvidence
  };
};

interface WorkerConfig {
  mode: "once" | "loop";
  pollIntervalMs: number;
}

const parseWorkerConfig = (argv: string[]): WorkerConfig => {
  const mode = argv.includes("--once") ? "once" : "loop";
  const pollIntervalMs = Number.isInteger(defaultPollIntervalMs) && defaultPollIntervalMs > 0
    ? defaultPollIntervalMs
    : 1000;

  return {
    mode,
    pollIntervalMs
  };
};

const sleepUntilNextCycle = async (pollIntervalMs: number): Promise<void> => {
  await delay(pollIntervalMs);
};

const main = async (): Promise<void> => {
  const config = parseWorkerConfig(process.argv.slice(2));
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);
  let shouldStop = false;

  const requestShutdown = (signal: NodeJS.Signals): void => {
    if (shouldStop) {
      return;
    }

    shouldStop = true;
    console.log(`rewrite-spike worker received ${signal}, finishing current cycle before shutdown`);
  };

  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);

  console.log(
    config.mode === "loop"
      ? `rewrite-spike worker loop started (pollIntervalMs=${config.pollIntervalMs})`
      : "rewrite-spike worker once mode started"
  );

  try {
    do {
      const cycleSummary = await runWorkerCycle(store);

      if (config.mode === "once" ||
        cycleSummary.processedJobs > 0 ||
        cycleSummary.timedOutRuns > 0 ||
        cycleSummary.purgedEvidence > 0 ||
        cycleSummary.escalatedHeldEvidence > 0) {
        console.log(
          `rewrite-spike worker cycle processed ${cycleSummary.processedJobs} import job(s), timed out ${cycleSummary.timedOutRuns} run(s), purged ${cycleSummary.purgedEvidence} evidence item(s), escalated ${cycleSummary.escalatedHeldEvidence} held evidence item(s)`
        );
      }

      if (config.mode === "once" || shouldStop) {
        break;
      }

      await sleepUntilNextCycle(config.pollIntervalMs);
    } while (!shouldStop);
  } finally {
    process.removeListener("SIGINT", requestShutdown);
    process.removeListener("SIGTERM", requestShutdown);
    await store.close();
  }

  console.log("rewrite-spike worker stopped");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
