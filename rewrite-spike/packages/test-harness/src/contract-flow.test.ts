import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  apiRoutes,
  type AssignNotificationProviderProfileGovernanceCaseResponse,
  type AcknowledgeNotificationProviderProfileGovernanceAlertResponse,
  type AcknowledgeNotificationProviderProfileIncidentResponse,
  type EscalateNotificationProviderProfileGovernanceCaseResponse,
  type TransitionNotificationProviderProfileGovernanceCaseResponse,
  type AddNotificationProviderProfileGovernanceCaseNoteResponse,
  type UpsertNotificationProviderProfileGovernanceCaseChecklistItemResponse,
  type PolicyHistoryResponse,
  type PromoteWorkspaceNotificationProviderProfileResponse,
  type RedriveNotificationProviderProfileGovernanceAlertResponse,
  type TenantActivationPolicyResponse,
  type TenantEvidenceRetentionClassPolicyResponse,
  type TenantEvidenceRetentionPolicyResponse,
  type TenantLaunchApprovalPolicyResponse,
  type TenantGovernanceNotificationPolicyResponse,
  type TenantRecoveryGovernanceNotificationPolicyResponse,
  type TenantNotificationProviderPromotionPolicyResponse,
  type TenantNotificationPolicyResponse,
  type TenantNotificationProviderProfilesResponse,
  type TenantOperationalPolicyResponse,
  type WorkspaceActivationPolicyResponse,
  type WorkspaceEvidenceRetentionClassPolicyResponse,
  type WorkspaceEvidenceRetentionClassesResponse,
  type WorkspaceEvidenceRetentionPolicyResponse,
  type WorkspaceLaunchApprovalPolicyResponse,
  type WorkspaceGovernanceNotificationPolicyResponse,
  type WorkspaceRecoveryGovernanceNotificationPolicyResponse,
  type WorkspaceNotificationProviderPromotionPolicyResponse,
  type WorkspaceNotificationPolicyResponse,
  type WorkspaceNotificationProviderProfileIncidentsResponse,
  type WorkspaceNotificationProviderProfileGovernanceQueueResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertsResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse,
  type WorkspaceNotificationProviderProfileGovernanceCorrelationsResponse,
  type WorkspaceNotificationProviderProfileGovernanceCasesResponse,
  type WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse,
  type WorkspaceNotificationProviderProfileGovernanceCaseBoardResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueResponse,
  type WorkspaceNotificationProviderProfileRolloutMetricsResponse,
  type WorkspaceNotificationProviderProfilesResponse,
  type WorkspaceOperationalPolicyResponse
} from "@testcenter-rewrite/contracts";
import {
  createDatabasePool,
  createPostgresPlatformStore
} from "@testcenter-rewrite/db";
import {
  createNotificationProviderProfileGovernanceAlert,
  createNotificationProviderProfileIncident,
  createMonitorCommand,
  createSystemCheckEvidence,
  createSystemCheckEvidenceBreachNotification,
  markNotificationProviderProfileGovernanceAlertDeliveryFailed,
  markSystemCheckEvidenceBreachNotificationDeliveryFailed,
  resolveWorkspaceNotificationPolicy,
  resolveWorkspaceNotificationProviderProfiles
} from "@testcenter-rewrite/domain";
import {
  maskOutboundNotificationCredentialsRef,
  isOutboundNotificationProviderProfileDeliverable,
  resolveOutboundNotificationProviderProfileCredentialsStatus,
  resolveOutboundNotificationProviderProfileHealthStatus,
  resolveOutboundNotificationDestination
} from "@testcenter-rewrite/outbound-messaging";
import { fixtureCatalog } from "@testcenter-rewrite/test-fixtures";

const spikeRoot = process.cwd();
const apiBaseUrl = "http://127.0.0.1:4100";
const minioHealthUrl = "http://127.0.0.1:9000/minio/health/live";
const demoTenantKey = "demo-tenant";
const demoWorkspaceKey = "demo-workspace";
const emptyWorkspaceKey = "empty-workspace";
const tenantPolicyWorkspaceKey = "tenant-policy-workspace";
const starterFixture = fixtureCatalog.find(fixture => fixture.fixtureKey === "starter-and-login-baseline");
const groupMonitorFixture = fixtureCatalog.find(fixture => fixture.fixtureKey === "group-monitor-matrix");
const groupMonitorRevisionFixture = fixtureCatalog.find(
  fixture => fixture.fixtureKey === "group-monitor-matrix-revision"
);
const invalidSourceModelFixture = fixtureCatalog.find(fixture => fixture.fixtureKey === "invalid-source-model");
const invalidCanonicalFixture = fixtureCatalog.find(fixture => fixture.fixtureKey === "invalid-canonical-snapshot");

if (!starterFixture) {
  throw new Error("starter-and-login-baseline fixture must exist for the contract flow test.");
}

if (!groupMonitorFixture) {
  throw new Error("group-monitor-matrix fixture must exist for the contract flow test.");
}

if (!groupMonitorRevisionFixture) {
  throw new Error("group-monitor-matrix-revision fixture must exist for the contract flow test.");
}

if (!invalidSourceModelFixture) {
  throw new Error("invalid-source-model fixture must exist for the contract flow test.");
}

if (!invalidCanonicalFixture) {
  throw new Error("invalid-canonical-snapshot fixture must exist for the contract flow test.");
}

const toExpectedNotificationProviderProfileDto = (input: {
  profileKey: string;
  displayLabel: string;
  deliveryChannel: "webhook_spike" | "email_spike";
  target: string;
  credentialsRef: string | null;
  enabled?: boolean;
  rolloutState?: "active" | "paused" | "canary";
  rolloutPercentage?: number;
  rolloutFallbackProfileKey?: string | null;
  targetProbeMode?: "active" | "skip";
  incidentState?: {
    incidentType: "auto_rollback_failure";
    openedAt: string;
    openedByActorType: "worker" | "notification_service" | "platform_api";
    openedByActorId: string;
    reasonCode: "delivery_failures_present";
    deliveryFailedCount: number;
    suppressionUntil: string | null;
    resolvedAt: string | null;
    resolutionCode: "auto_promoted" | "manually_promoted" | null;
  } | null;
  operationalState?: {
    lastCheckedAt: string;
    lastCheckedByActorType: "worker" | "notification_service" | "platform_api";
    lastCheckedByActorId: string;
    credentialsStatus: "not_configured" | "reachable" | "unreachable";
    healthStatus:
      | "ready"
      | "paused"
      | "disabled"
      | "credentials_unreachable"
      | "target_unreachable";
    rolloutStatus:
      | "active_ready"
      | "active_blocked"
      | "paused"
      | "disabled"
      | "canary_ready"
      | "canary_blocked";
    probeStatus:
      | "succeeded"
      | "skipped_paused"
      | "skipped_disabled"
      | "skipped_by_policy"
      | "credentials_unreachable"
      | "target_unreachable";
    probeTarget: string | null;
    probeLatencyMs: number | null;
    lastCheckError: string | null;
  } | null;
}) => ({
  profileKey: input.profileKey,
  displayLabel: input.displayLabel,
  enabled: input.enabled ?? true,
  rolloutState: input.rolloutState ?? "active",
  rolloutPercentage: input.rolloutPercentage ?? 100,
  rolloutFallbackProfileKey: input.rolloutFallbackProfileKey ?? null,
  targetProbeMode: input.targetProbeMode ?? "active",
  deliveryChannel: input.deliveryChannel,
  target: input.target,
  credentialsRefPresent: input.credentialsRef !== null,
  credentialsRefMasked: maskOutboundNotificationCredentialsRef(input.credentialsRef),
  credentialsStatus: resolveOutboundNotificationProviderProfileCredentialsStatus({
    profileKey: input.profileKey,
    displayLabel: input.displayLabel,
    enabled: input.enabled ?? true,
    rolloutState: input.rolloutState ?? "active",
    rolloutPercentage: input.rolloutPercentage ?? 100,
    rolloutFallbackProfileKey: input.rolloutFallbackProfileKey ?? null,
    targetProbeMode: input.targetProbeMode ?? "active",
    deliveryChannel: input.deliveryChannel,
    target: input.target,
    credentialsRef: input.credentialsRef
  }),
  healthStatus: resolveOutboundNotificationProviderProfileHealthStatus({
    profileKey: input.profileKey,
    displayLabel: input.displayLabel,
    enabled: input.enabled ?? true,
    rolloutState: input.rolloutState ?? "active",
    rolloutPercentage: input.rolloutPercentage ?? 100,
    rolloutFallbackProfileKey: input.rolloutFallbackProfileKey ?? null,
    targetProbeMode: input.targetProbeMode ?? "active",
    deliveryChannel: input.deliveryChannel,
    target: input.target,
    credentialsRef: input.credentialsRef
  }),
  incidentState: input.incidentState ?? null,
  operationalState: input.operationalState ?? null
});

const stripNotificationProviderProfileOperationalState = <Profile extends {
  operationalState?: unknown;
}>(profile: Profile): Omit<Profile, "operationalState"> => {
  const { operationalState: _operationalState, ...rest } = profile;

  return rest;
};

const stripNotificationProviderProfileOperationalStates = <Profile extends {
  operationalState?: unknown;
}>(profiles: Profile[] | null): Array<Omit<Profile, "operationalState">> | null =>
  profiles
    ? profiles.map(profile => stripNotificationProviderProfileOperationalState(profile))
    : null;

const stripNotificationProviderProfileOverrideRecordOperationalStates = <
  RecordDto extends {
    value: { operationalState?: unknown } | null;
  }
>(
  records: RecordDto[] | null
): Array<Omit<RecordDto, "value"> & { value: Omit<NonNullable<RecordDto["value"]>, "operationalState"> | null }> | null =>
  records
    ? records.map(record => ({
        ...record,
        value: record.value
          ? stripNotificationProviderProfileOperationalState(record.value)
          : null
      }))
    : null;

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ImportJobDiagnosticFailure {
  failedStage: string;
  failureMessage: string;
  validationIssues: Array<{
    code: string;
    severity: "error" | "warning";
    scope: "source_package" | "source_model" | "canonical_snapshot";
    path: string | null;
    message: string;
    mappingKeys: string[];
  }>;
  eventType: string;
  occurredAt: string;
}

interface ImportJobReferenceMapping {
  mappingKey: string;
  source: {
    entityKind: "unit" | "booklet" | "login_collection" | "booklet_assignment";
    identifier: string;
    path: string | null;
  };
  canonical: {
    entityKind: "unit" | "booklet" | "login_collection" | "booklet_assignment";
    identifier: string;
    path: string | null;
  } | null;
}

interface ContentReleaseComparisonToPrevious {
  baselineContentReleaseId: string | null;
  baselineReleaseLabel: string | null;
  comparisonType: "initial_import" | "successive_import";
  changed: boolean;
  totalChanges: number;
  units: {
    addedKeys: string[];
    removedKeys: string[];
    changedKeys: string[];
    unchangedKeys: string[];
  };
  booklets: {
    addedKeys: string[];
    removedKeys: string[];
    changedKeys: string[];
    unchangedKeys: string[];
  };
  loginCollections: {
    addedKeys: string[];
    removedKeys: string[];
    changedKeys: string[];
    unchangedKeys: string[];
  };
  bookletAssignments: {
    addedKeys: string[];
    removedKeys: string[];
    changedKeys: string[];
    unchangedKeys: string[];
  };
  bookletChangeDetails: Array<{
    entityKey: string;
    changes: Array<{
      fieldKey: string;
      message: string;
      before: unknown;
      after: unknown;
    }>;
  }>;
  loginCollectionChangeDetails: Array<{
    entityKey: string;
    changes: Array<{
      fieldKey: string;
      message: string;
      before: unknown;
      after: unknown;
    }>;
  }>;
  bookletAssignmentChangeDetails: Array<{
    entityKey: string;
    changes: Array<{
      fieldKey: string;
      message: string;
      before: unknown;
      after: unknown;
    }>;
  }>;
  runPoliciesChangedBookletKeys: string[];
  activationImpact: {
    riskLevel: "none" | "low" | "medium" | "high";
    changedAreas: Array<
      "initial_import" | "units" | "booklets" | "run_policy" | "login_collections" | "assignment_routing" | "initial_state"
    >;
    affectedLoginCount: number;
    affectedLoginKeys: string[];
    affectedGroupKeys: string[];
    affectedBookletKeys: string[];
    affectedAssignmentKeys: string[];
    highlights: string[];
  };
}

interface ContentReleaseActivationGuardrail {
  status: "ready" | "warning" | "blocked";
  comparisonMode: "no_active_release" | "already_active" | "switch_from_active_release";
  comparedToActiveContentReleaseId: string | null;
  comparedToActiveReleaseLabel: string | null;
  activeSessionCount: number;
  activeTestRunIds: string[];
  activeLoginKeys: string[];
  activeGroupKeys: string[];
  blockingReasonCodes: string[];
  warningReasonCodes: string[];
  highlights: string[];
}

const runCommand = (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? spikeRoot,
      env: {
        ...process.env,
        ...options.env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", exitCode => {
      if (exitCode !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with exit code ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`
          )
        );
        return;
      }

      resolve({
        exitCode: exitCode ?? 0,
        stdout,
        stderr
      });
    });
  });

const retry = async <T>(
  action: () => Promise<T>,
  attempts: number,
  waitMs: number
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(waitMs);
      }
    }
  }

  throw lastError;
};

class ManagedProcess {
  private readonly command: string;
  private readonly args: string[];
  private readonly cwd: string;
  private readonly env: NodeJS.ProcessEnv;
  private process: ReturnType<typeof spawn> | undefined;
  private stdout = "";
  private stderr = "";

  constructor(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
    } = {}
  ) {
    this.command = command;
    this.args = args;
    this.cwd = options.cwd ?? spikeRoot;
    this.env = {
      ...process.env,
      ...options.env
    };
  }

  start(): void {
    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.process = child;

    child.stdout?.on("data", chunk => {
      this.stdout += chunk.toString();
    });

    child.stderr?.on("data", chunk => {
      this.stderr += chunk.toString();
    });
  }

  async stop(): Promise<void> {
    const currentProcess = this.process;

    if (!currentProcess || currentProcess.killed) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      currentProcess.once("error", reject);
      currentProcess.once("close", () => resolve());
      currentProcess.kill("SIGINT");
    });
  }

  get output(): string {
    return [this.stdout, this.stderr].filter(Boolean).join("\n");
  }
}

const fetchJsonResponse = async <T>(
  path: string,
  options: RequestInit = {},
  expectedStatus = 200
): Promise<{
  body: T;
  headers: Headers;
}> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const body = await response.json() as T | { error: unknown };

  if (response.status !== expectedStatus) {
    throw new Error(
      `${options.method ?? "GET"} ${path} expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(body)}`
    );
  }

  return {
    body: body as T,
    headers: response.headers
  };
};

const normalizeNotificationProviderProfilesForComparison = <T extends {
  operationalState?: unknown;
}>(profiles: T[]): Array<Omit<T, "operationalState"> & { operationalState: null }> =>
  profiles.map(profile => ({
    ...profile,
    operationalState: null
  }));

const fetchJson = async <T>(
  path: string,
  options: RequestInit = {},
  expectedStatus = 200
): Promise<T> => (await fetchJsonResponse<T>(path, options, expectedStatus)).body;

const seedStaleMaintenanceFixtures = async (testRunId: string): Promise<{
  staleCommandId: string;
}> => {
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);

  try {
    const testRun = await store.getTestRunById(testRunId);
    assert.ok(testRun, `Expected test run '${testRunId}' to exist before seeding maintenance fixtures.`);

    const staleTimestamp = new Date(Date.now() - 2500).toISOString();

    await pool.query(
      `
        UPDATE test_runs
        SET created_at = $2,
            updated_at = $2,
            time_limit_seconds = 1,
            pause_accumulated_ms = 0,
            paused_at = NULL,
            status = 'active',
            completed_at = NULL
        WHERE test_run_id = $1
      `,
      [testRunId, staleTimestamp]
    );

    const staleCommand = {
      ...createMonitorCommand({
        requestId: "contract-stale-monitor-command",
        tenantId: testRun.tenantId,
        workspaceId: testRun.workspaceId,
        testRunId: testRun.testRunId,
        participantSessionId: testRun.participantSessionId,
        loginKey: testRun.loginKey,
        groupKey: testRun.groupKey,
        assignmentKey: testRun.assignmentKey,
        attemptNumber: testRun.attemptNumber,
        commandType: "pause",
        actorId: "workspace-monitor"
      }),
      ackState: "delivered" as const,
      issuedAt: staleTimestamp,
      deliveredAt: staleTimestamp
    };

    await store.saveMonitorCommand(staleCommand);

    return {
      staleCommandId: staleCommand.commandId
    };
  } finally {
    await store.close();
  }
};

const getPersistedTestRun = async (testRunId: string): Promise<{
  status: string;
  completedAt: string | null;
} | undefined> => {
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);

  try {
    const testRun = await store.getTestRunById(testRunId);

    if (!testRun) {
      return undefined;
    }

    return {
      status: testRun.status,
      completedAt: testRun.completedAt
    };
  } finally {
    await store.close();
  }
};

const expireSystemCheckEvidenceRetention = async (evidenceKey: string): Promise<void> => {
  const pool = createDatabasePool();

  try {
    await pool.query(
      `
        UPDATE system_check_evidence
        SET retention_expires_at = $2
        WHERE evidence_key = $1
      `,
      [evidenceKey, new Date(Date.now() - 2_500).toISOString()]
    );
  } finally {
    await pool.end();
  }
};

const setSystemCheckEvidenceBreachNotificationCreatedAt = async (input: {
  evidenceKey: string;
  createdAt: string;
}): Promise<void> => {
  const pool = createDatabasePool();

  try {
    await pool.query(
      `
        UPDATE system_check_evidence_breach_notifications
        SET created_at = $2
        WHERE evidence_key = $1
      `,
      [input.evidenceKey, input.createdAt]
    );
  } finally {
    await pool.end();
  }
};

const getPersistedSystemCheckEvidence = async (evidenceKey: string): Promise<{
  payloadBase64: string | null;
  payloadPreviewText: string | null;
  storageLocator: string | null;
  retentionHold: {
    holdReasonCode: string;
    holdNote: string;
    heldByActorId: string;
    assignedToActorId: string | null;
    assignedByActorId: string | null;
    acknowledgedByActorId: string | null;
    acknowledgementNote: string | null;
    escalationTarget: string | null;
    escalatedAt: string | null;
  } | null;
  purgedAt: string | null;
  purgeReasonCode: string | null;
} | undefined> => {
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);

  try {
    const systemCheckEvidence = await store.getSystemCheckEvidenceByKey(evidenceKey);

    if (!systemCheckEvidence) {
      return undefined;
    }

    return {
      payloadBase64: systemCheckEvidence.payloadBase64,
      payloadPreviewText: systemCheckEvidence.payloadPreviewText,
      storageLocator: systemCheckEvidence.storageLocator,
      retentionHold: systemCheckEvidence.retentionHold
        ? {
            holdReasonCode: systemCheckEvidence.retentionHold.holdReasonCode,
            holdNote: systemCheckEvidence.retentionHold.holdNote,
            heldByActorId: systemCheckEvidence.retentionHold.heldByActorId,
            assignedToActorId: systemCheckEvidence.retentionHold.assignedToActorId,
            assignedByActorId: systemCheckEvidence.retentionHold.assignedByActorId,
            acknowledgedByActorId: systemCheckEvidence.retentionHold.acknowledgedByActorId,
            acknowledgementNote: systemCheckEvidence.retentionHold.acknowledgementNote,
            escalationTarget: systemCheckEvidence.retentionHold.escalationTarget,
            escalatedAt: systemCheckEvidence.retentionHold.escalatedAt
          }
        : null,
      purgedAt: systemCheckEvidence.purgedAt,
      purgeReasonCode: systemCheckEvidence.purgeReasonCode
    };
  } finally {
    await store.close();
  }
};

const seedFailedSystemCheckEvidenceBreachNotification = async (input: {
  tenantKey: string;
  workspaceKey: string;
  evidenceKey: string;
  escalationTarget: string;
  createdByActorId: string;
}): Promise<void> => {
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);

  try {
    const [tenant, workspace, evidence] = await Promise.all([
      store.getTenantByKey(input.tenantKey),
      store.getWorkspaceByKey(input.tenantKey, input.workspaceKey),
      store.getSystemCheckEvidenceByKey(input.evidenceKey)
    ]);

    assert.ok(tenant, `Expected tenant '${input.tenantKey}' when seeding failed breach notification.`);
    assert.ok(
      workspace,
      `Expected workspace '${input.workspaceKey}' in tenant '${input.tenantKey}' when seeding failed breach notification.`
    );
    assert.ok(evidence, `Expected evidence '${input.evidenceKey}' when seeding failed breach notification.`);
    assert.ok(evidence.retentionHold, "Expected seeded evidence to still have a retention hold.");

    const seededEvidence = {
      ...evidence,
      retentionHold: {
        ...evidence.retentionHold,
        escalationTarget: input.escalationTarget
      }
    };
    const notificationPolicy = resolveWorkspaceNotificationPolicy(workspace, tenant);
    const notificationProviderProfiles = resolveWorkspaceNotificationProviderProfiles(
      workspace,
      tenant
    );
    const existingNotification = (
      await store.listSystemCheckEvidenceBreachNotificationsByWorkspace(
        input.tenantKey,
        input.workspaceKey,
        {
          limit: 200
        }
      )
    ).find(notification => notification.evidenceKey === input.evidenceKey);
    const baseNotification = createSystemCheckEvidenceBreachNotification({
      systemCheckEvidence: seededEvidence,
      createdByActorType: "worker",
      createdByActorId: input.createdByActorId,
      sourceRequestId: `${input.createdByActorId}-seeded-failed-notification`,
      notificationPolicy,
      notificationProviderProfiles
    });
    const failedNotification = markSystemCheckEvidenceBreachNotificationDeliveryFailed({
      notification: existingNotification
        ? {
            ...baseNotification,
            notificationId: existingNotification.notificationId,
            createdAt: new Date().toISOString()
          }
        : baseNotification,
      failureReason: "Seeded terminal failure for provider-operations rollback coverage."
    });

    if (existingNotification) {
      await store.updateSystemCheckEvidenceBreachNotification(failedNotification);
    } else {
      await store.saveSystemCheckEvidenceBreachNotification(failedNotification);
    }
  } finally {
    await store.close();
  }
};

const seedFailedNotificationProviderProfileGovernanceAlert = async (input: {
  tenantKey: string;
  workspaceKey: string;
  profileKey: string;
  createdByActorId: string;
}): Promise<string> => {
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);

  try {
    const [tenant, workspace] = await Promise.all([
      store.getTenantByKey(input.tenantKey),
      store.getWorkspaceByKey(input.tenantKey, input.workspaceKey)
    ]);

    assert.ok(tenant, `Expected tenant '${input.tenantKey}' when seeding failed governance alert.`);
    assert.ok(
      workspace,
      `Expected workspace '${input.workspaceKey}' in tenant '${input.tenantKey}' when seeding failed governance alert.`
    );

    const notificationProviderProfiles = resolveWorkspaceNotificationProviderProfiles(workspace, tenant);
    const profile = notificationProviderProfiles.find(
      currentProfile => currentProfile.profileKey === input.profileKey
    );
    assert.ok(profile, `Expected provider profile '${input.profileKey}' when seeding failed governance alert.`);

    const incident = createNotificationProviderProfileIncident({
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      profileKey: input.profileKey,
      incidentType: "auto_rollback_failure",
      openedAt: new Date().toISOString(),
      openedByActorType: "worker",
      openedByActorId: input.createdByActorId,
      reasonCode: "delivery_failures_present",
      deliveryFailedCount: 1,
      suppressionUntil: null,
      sourceRequestId: `${input.createdByActorId}-seeded-governance-incident`
    });

    const notificationPolicy = resolveWorkspaceNotificationPolicy(workspace, tenant);
    const governanceAlert = createNotificationProviderProfileGovernanceAlert({
      incident,
      profile,
      notificationPolicy,
      notificationProviderProfiles,
      createdByActorType: "worker",
      createdByActorId: input.createdByActorId,
      sourceRequestId: `${input.createdByActorId}-seeded-governance-alert`
    });
    const failedGovernanceAlert = markNotificationProviderProfileGovernanceAlertDeliveryFailed({
      alert: governanceAlert,
      failureReason: "Seeded terminal failure for governance alert dead-letter coverage."
    });

    await store.saveNotificationProviderProfileIncident(incident);
    await store.saveNotificationProviderProfileGovernanceAlert(failedGovernanceAlert);

    return failedGovernanceAlert.alertId;
  } finally {
    await store.close();
  }
};

const waitForApi = async (): Promise<void> => {
  await retry(async () => {
    const response = await fetch(`${apiBaseUrl}${apiRoutes.platformHealth}`);

    if (!response.ok) {
      throw new Error(`API health returned ${response.status}`);
    }
  }, 30, 500);
};

const waitForObjectStorage = async (): Promise<void> => {
  await retry(async () => {
    const response = await fetch(minioHealthUrl);

    if (!response.ok) {
      throw new Error(`Object storage health returned ${response.status}`);
    }
  }, 30, 500);
};

test("contract flow covers migrations, monitor read models, audit events, runtime policy controls, and retry semantics", {
  timeout: 120_000
}, async t => {
  const apiProcess = new ManagedProcess("node", ["apps/api/dist/src/index.js"], {
    env: {
      SYSTEM_CHECK_EVIDENCE_STORAGE_BACKEND: "s3_compatible_spike",
      SYSTEM_CHECK_EVIDENCE_RETENTION_SECONDS: "3600",
      SYSTEM_CHECK_EVIDENCE_S3_ENDPOINT: "http://127.0.0.1:9000",
      SYSTEM_CHECK_EVIDENCE_S3_REGION: "us-east-1",
      SYSTEM_CHECK_EVIDENCE_S3_BUCKET: "testcenter-rewrite-spike-evidence",
      SYSTEM_CHECK_EVIDENCE_S3_ACCESS_KEY_ID: "minioadmin",
      SYSTEM_CHECK_EVIDENCE_S3_SECRET_ACCESS_KEY: "minioadmin",
      SYSTEM_CHECK_EVIDENCE_S3_FORCE_PATH_STYLE: "true"
    }
  });
  const dispatcherProcess = new ManagedProcess("node", ["apps/dispatcher/dist/src/index.js"], {
    env: {
      DISPATCHER_POLL_INTERVAL_MS: "100"
    }
  });
  const notificationsProcess = new ManagedProcess("node", ["apps/notifications/dist/src/index.js"], {
    env: {
      NOTIFICATION_SERVICE_POLL_INTERVAL_MS: "100"
    }
  });
  const providerOperationsProcess = new ManagedProcess(
    "node",
    ["apps/provider-operations/dist/src/index.js"],
    {
      env: {
        PROVIDER_OPERATIONS_POLL_INTERVAL_MS: "100"
      }
    }
  );
  const workerProcess = new ManagedProcess("node", ["apps/worker/dist/src/index.js"], {
    env: {
      WORKER_POLL_INTERVAL_MS: "100"
    }
  });

  t.after(async () => {
    await providerOperationsProcess.stop();
    await notificationsProcess.stop();
    await dispatcherProcess.stop();
    await workerProcess.stop();
    await apiProcess.stop();
    await runCommand("docker", ["compose", "-f", "docker-compose.yml", "down", "-v"]).catch(() => undefined);
  });

  await runCommand("docker", ["compose", "-f", "docker-compose.yml", "down", "-v"]).catch(() => undefined);
  await runCommand("docker", ["compose", "-f", "docker-compose.yml", "up", "-d"]);
  await waitForObjectStorage();

  await retry(
    () => runCommand("node", ["packages/db/dist/src/cli.js"]),
    20,
    500
  );

  apiProcess.start();
  await waitForApi();
  dispatcherProcess.start();
  notificationsProcess.start();
  providerOperationsProcess.start();
  workerProcess.start();

  const tenants = await fetchJson<{ items: Array<{ tenantKey: string }> }>(apiRoutes.platformTenants);
  assert.ok(tenants.items.some(tenant => tenant.tenantKey === demoTenantKey));

  await fetchJson(
    apiRoutes.tenantWorkspaces(demoTenantKey),
    {
      method: "POST",
      body: JSON.stringify({
        workspaceKey: emptyWorkspaceKey,
        displayName: "Empty Workspace"
      })
    },
    201
  );

  await fetchJson<{ error: { code: string } }>(apiRoutes.participantAuthSignIn, {
    method: "POST",
    body: JSON.stringify({
      tenantKey: demoTenantKey,
      workspaceKey: emptyWorkspaceKey,
      loginKey: "alpha-001"
    })
  }, 409).then(body => {
    assert.equal(body.error.code, "no_active_content_release");
  });

  const defaultWorkspaceActivationPolicy = await fetchJson<WorkspaceActivationPolicyResponse>(
    apiRoutes.workspaceActivationPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(defaultWorkspaceActivationPolicy.tenantKey, demoTenantKey);
  assert.equal(defaultWorkspaceActivationPolicy.workspaceKey, demoWorkspaceKey);
  assert.equal(defaultWorkspaceActivationPolicy.mode, "inherit");
  assert.equal(defaultWorkspaceActivationPolicy.activationPolicyOverride, null);
  assert.equal(defaultWorkspaceActivationPolicy.activationPolicyOverrideRecords, null);
  assert.deepEqual(defaultWorkspaceActivationPolicy.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  });
  assert.deepEqual(defaultWorkspaceActivationPolicy.effectiveActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  });

  const defaultTenantActivationPolicy = await fetchJson<TenantActivationPolicyResponse>(
    apiRoutes.tenantActivationPolicy(demoTenantKey)
  );

  assert.equal(defaultTenantActivationPolicy.tenantKey, demoTenantKey);
  assert.deepEqual(defaultTenantActivationPolicy.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  });

  const defaultWorkspaceOperationalPolicy = await fetchJson<WorkspaceOperationalPolicyResponse>(
    apiRoutes.workspaceOperationalPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(defaultWorkspaceOperationalPolicy.tenantKey, demoTenantKey);
  assert.equal(defaultWorkspaceOperationalPolicy.workspaceKey, demoWorkspaceKey);
  assert.equal(defaultWorkspaceOperationalPolicy.mode, "inherit");
  assert.equal(defaultWorkspaceOperationalPolicy.operationalPolicyOverride, null);
  assert.equal(defaultWorkspaceOperationalPolicy.operationalPolicyOverrideRecords, null);
  assert.deepEqual(defaultWorkspaceOperationalPolicy.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 30,
    monitorCommandLeaseSeconds: 15,
    timedRunMaintenanceGraceSeconds: 0
  });
  assert.deepEqual(defaultWorkspaceOperationalPolicy.effectiveOperationalPolicy, {
    monitorCommandTtlSeconds: 30,
    monitorCommandLeaseSeconds: 15,
    timedRunMaintenanceGraceSeconds: 0
  });

  const defaultTenantOperationalPolicy = await fetchJson<TenantOperationalPolicyResponse>(
    apiRoutes.tenantOperationalPolicy(demoTenantKey)
  );

  assert.equal(defaultTenantOperationalPolicy.tenantKey, demoTenantKey);
  assert.deepEqual(defaultTenantOperationalPolicy.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 30,
    monitorCommandLeaseSeconds: 15,
    timedRunMaintenanceGraceSeconds: 0
  });

  const defaultWorkspaceLaunchApprovalPolicy = await fetchJson<WorkspaceLaunchApprovalPolicyResponse>(
    apiRoutes.workspaceLaunchApprovalPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(defaultWorkspaceLaunchApprovalPolicy.tenantKey, demoTenantKey);
  assert.equal(defaultWorkspaceLaunchApprovalPolicy.workspaceKey, demoWorkspaceKey);
  assert.equal(defaultWorkspaceLaunchApprovalPolicy.mode, "inherit");
  assert.equal(defaultWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverride, null);
  assert.equal(defaultWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverrideRecords, null);
  assert.deepEqual(defaultWorkspaceLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 0
  });
  assert.deepEqual(defaultWorkspaceLaunchApprovalPolicy.effectiveLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 0
  });

  const defaultTenantLaunchApprovalPolicy = await fetchJson<TenantLaunchApprovalPolicyResponse>(
    apiRoutes.tenantLaunchApprovalPolicy(demoTenantKey)
  );

  assert.equal(defaultTenantLaunchApprovalPolicy.tenantKey, demoTenantKey);
  assert.deepEqual(defaultTenantLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 0
  });

  const defaultWorkspaceNotificationPolicy = await fetchJson<WorkspaceNotificationPolicyResponse>(
    apiRoutes.workspaceNotificationPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(defaultWorkspaceNotificationPolicy.tenantKey, demoTenantKey);
  assert.equal(defaultWorkspaceNotificationPolicy.workspaceKey, demoWorkspaceKey);
  assert.equal(defaultWorkspaceNotificationPolicy.mode, "inherit");
  assert.equal(defaultWorkspaceNotificationPolicy.notificationPolicyOverride, null);
  assert.equal(defaultWorkspaceNotificationPolicy.notificationPolicyOverrideRecords, null);
  assert.deepEqual(defaultWorkspaceNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 3,
    emailSpikeRetryDelaySeconds: 0,
    emailSpikeMaxDeliveryAttempts: 3
  });
  assert.deepEqual(defaultWorkspaceNotificationPolicy.effectiveNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 3,
    emailSpikeRetryDelaySeconds: 0,
    emailSpikeMaxDeliveryAttempts: 3
  });

  const defaultTenantNotificationPolicy = await fetchJson<TenantNotificationPolicyResponse>(
    apiRoutes.tenantNotificationPolicy(demoTenantKey)
  );

  assert.equal(defaultTenantNotificationPolicy.tenantKey, demoTenantKey);
  assert.deepEqual(defaultTenantNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 3,
    emailSpikeRetryDelaySeconds: 0,
    emailSpikeMaxDeliveryAttempts: 3
  });

  const defaultTenantNotificationProviderProfiles = await fetchJson<TenantNotificationProviderProfilesResponse>(
    apiRoutes.tenantNotificationProviderProfiles(demoTenantKey)
  );

  assert.equal(defaultTenantNotificationProviderProfiles.tenantKey, demoTenantKey);
  assert.deepEqual(defaultTenantNotificationProviderProfiles.defaultNotificationProviderProfiles, []);

  const invalidTenantNotificationProviderProfilesResponse = await fetchJsonResponse<{
    error: { code: string };
  }>(apiRoutes.tenantNotificationProviderProfiles(demoTenantKey), {
    method: "PATCH",
    body: JSON.stringify({
      defaultNotificationProviderProfiles: [
        {
          profileKey: "invalid-alerts-email-profile",
          displayLabel: "Invalid Alerts Email Profile",
          deliveryChannel: "email_spike",
          target: "retry-once:alerts@example.test",
          credentialsRef: "invalid-secret-ref"
        }
      ]
    })
  }, 400);
  assert.equal(
    invalidTenantNotificationProviderProfilesResponse.body.error.code,
    "invalid_tenant_notification_provider_profiles_payload"
  );

  const updatedTenantNotificationProviderProfiles = await fetchJson<TenantNotificationProviderProfilesResponse>(
    apiRoutes.tenantNotificationProviderProfiles(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultNotificationProviderProfiles: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Alerts Email Profile",
            deliveryChannel: "email_spike",
            target: "retry-once:alerts@example.test",
            credentialsRef: "vault://notifications/alerts-email"
          },
          {
            profileKey: "dead-letter-email-profile",
            displayLabel: "Dead Letter Email Profile",
            deliveryChannel: "email_spike",
            target: "fail-permanent:dead-letter@example.test",
            credentialsRef: "vault://notifications/dead-letter-email"
          }
        ]
      })
    }
  );

  assert.deepEqual(
    normalizeNotificationProviderProfilesForComparison(
      updatedTenantNotificationProviderProfiles.defaultNotificationProviderProfiles
    ),
    normalizeNotificationProviderProfilesForComparison([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:alerts@example.test",
        credentialsRef: "vault://notifications/alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "dead-letter-email-profile",
        displayLabel: "Dead Letter Email Profile",
        deliveryChannel: "email_spike",
        target: "fail-permanent:dead-letter@example.test",
        credentialsRef: "vault://notifications/dead-letter-email"
      })
    ])
  );

  const workspaceNotificationProviderProfiles = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(workspaceNotificationProviderProfiles.tenantKey, demoTenantKey);
  assert.equal(workspaceNotificationProviderProfiles.workspaceKey, demoWorkspaceKey);
  assert.equal(workspaceNotificationProviderProfiles.mode, "inherit");
  assert.deepEqual(
    normalizeNotificationProviderProfilesForComparison(
      workspaceNotificationProviderProfiles.defaultNotificationProviderProfiles
    ),
    normalizeNotificationProviderProfilesForComparison(
      updatedTenantNotificationProviderProfiles.defaultNotificationProviderProfiles
    )
  );
  assert.equal(workspaceNotificationProviderProfiles.notificationProviderProfileOverride, null);
  assert.equal(workspaceNotificationProviderProfiles.removedNotificationProviderProfileKeys, null);
  assert.equal(workspaceNotificationProviderProfiles.notificationProviderProfileOverrideRecords, null);
  assert.deepEqual(
    normalizeNotificationProviderProfilesForComparison(
      workspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles
    ),
    normalizeNotificationProviderProfilesForComparison(
      updatedTenantNotificationProviderProfiles.defaultNotificationProviderProfiles
    )
  );

  const demoWorkspaceNotificationProviderProfilesResponse = await fetchJsonResponse<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Workspace Alerts Email Profile",
            deliveryChannel: "email_spike",
            target: "retry-once:workspace-alerts@example.test",
            credentialsRef: "vault://notifications/workspace-alerts-email"
          }
        ]
      })
    }
  );
  const demoWorkspaceNotificationProviderProfiles = demoWorkspaceNotificationProviderProfilesResponse.body;
  const demoWorkspaceNotificationProviderProfilesRequestId =
    demoWorkspaceNotificationProviderProfilesResponse.headers.get("x-request-id");
  assert.ok(demoWorkspaceNotificationProviderProfilesRequestId);
  assert.equal(demoWorkspaceNotificationProviderProfiles.mode, "override");
  assert.deepEqual(
    normalizeNotificationProviderProfilesForComparison(
      demoWorkspaceNotificationProviderProfiles.defaultNotificationProviderProfiles
    ),
    normalizeNotificationProviderProfilesForComparison(
      updatedTenantNotificationProviderProfiles.defaultNotificationProviderProfiles
    )
  );
  assert.deepEqual(demoWorkspaceNotificationProviderProfiles.notificationProviderProfileOverride, [
    toExpectedNotificationProviderProfileDto({
      profileKey: "alerts-email-profile",
      displayLabel: "Workspace Alerts Email Profile",
      deliveryChannel: "email_spike",
      target: "retry-once:workspace-alerts@example.test",
      credentialsRef: "vault://notifications/workspace-alerts-email"
    })
  ]);
  assert.equal(demoWorkspaceNotificationProviderProfiles.removedNotificationProviderProfileKeys, null);
  assert.equal(demoWorkspaceNotificationProviderProfiles.notificationProviderProfileOverrideRecords?.length, 1);
  assert.equal(
    demoWorkspaceNotificationProviderProfiles.notificationProviderProfileOverrideRecords?.[0]?.profileKey,
    "alerts-email-profile"
  );
  assert.equal(
    demoWorkspaceNotificationProviderProfiles.notificationProviderProfileOverrideRecords?.[0]?.updatedByRequestId,
    demoWorkspaceNotificationProviderProfilesRequestId
  );
  assert.deepEqual(
    normalizeNotificationProviderProfilesForComparison(
      demoWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles
    ),
    normalizeNotificationProviderProfilesForComparison([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "dead-letter-email-profile",
        displayLabel: "Dead Letter Email Profile",
        deliveryChannel: "email_spike",
        target: "fail-permanent:dead-letter@example.test",
        credentialsRef: "vault://notifications/dead-letter-email"
      })
    ])
  );

  await fetchJson<TenantNotificationPolicyResponse>(
    apiRoutes.tenantNotificationPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultNotificationPolicy: {
          breachNotificationDeliverySelectionMode: "force_webhook_spike",
          webhookSpikeRetryDelaySeconds: 2,
          webhookSpikeMaxDeliveryAttempts: 5,
          emailSpikeRetryDelaySeconds: 1,
          emailSpikeMaxDeliveryAttempts: 6
        }
      })
    }
  );

  await fetchJson<WorkspaceNotificationPolicyResponse>(
    apiRoutes.workspaceNotificationPolicy(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationPolicyOverride: {
          breachNotificationDeliverySelectionMode: "infer_from_target",
          webhookSpikeRetryDelaySeconds: 0,
          webhookSpikeMaxDeliveryAttempts: 4
        }
      })
    }
  );

  const defaultWorkspaceEvidenceRetentionPolicy = await fetchJson<WorkspaceEvidenceRetentionPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(defaultWorkspaceEvidenceRetentionPolicy.tenantKey, demoTenantKey);
  assert.equal(defaultWorkspaceEvidenceRetentionPolicy.workspaceKey, demoWorkspaceKey);
  assert.equal(defaultWorkspaceEvidenceRetentionPolicy.mode, "inherit");
  assert.equal(defaultWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverride, null);
  assert.equal(defaultWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverrideRecords, null);
  assert.deepEqual(defaultWorkspaceEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 604800,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 2592000
  });
  assert.deepEqual(defaultWorkspaceEvidenceRetentionPolicy.effectiveEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 604800,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 2592000
  });

  const defaultTenantEvidenceRetentionPolicy = await fetchJson<TenantEvidenceRetentionPolicyResponse>(
    apiRoutes.tenantEvidenceRetentionPolicy(demoTenantKey)
  );

  assert.equal(defaultTenantEvidenceRetentionPolicy.tenantKey, demoTenantKey);
  assert.deepEqual(defaultTenantEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 604800,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 2592000
  });

  const defaultWorkspaceEvidenceRetentionClassPolicy = await fetchJson<WorkspaceEvidenceRetentionClassPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionClassPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(defaultWorkspaceEvidenceRetentionClassPolicy.tenantKey, demoTenantKey);
  assert.equal(defaultWorkspaceEvidenceRetentionClassPolicy.workspaceKey, demoWorkspaceKey);
  assert.equal(defaultWorkspaceEvidenceRetentionClassPolicy.mode, "inherit");
  assert.equal(defaultWorkspaceEvidenceRetentionClassPolicy.evidenceRetentionClassPolicyOverride, null);
  assert.equal(defaultWorkspaceEvidenceRetentionClassPolicy.evidenceRetentionClassPolicyOverrideRecords, null);
  assert.deepEqual(
    defaultWorkspaceEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons,
    [
      {
        holdReasonCode: "workspace_review",
        displayLabel: "Workspace Review",
        workflowHint: "Keep evidence available while a workspace reviewer inspects the submission.",
        severity: "low",
        escalationTarget: null,
        uiGroup: "review",
        acknowledgementRequired: false,
        defaultAssigneeTarget: "workspace-reviewers",
        slaSeconds: 86400
      },
      {
        holdReasonCode: "operator_investigation",
        displayLabel: "Operator Investigation",
        workflowHint: "Escalate evidence into the longer investigation workflow for operator follow-up.",
        severity: "high",
        escalationTarget: "ops-investigation",
        uiGroup: "investigation",
        acknowledgementRequired: true,
        defaultAssigneeTarget: "ops-investigation-primary",
        slaSeconds: 14400
      }
    ]
  );
  assert.equal(
    defaultWorkspaceEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.defaultCaptureRetentionClass,
    "workspace_review"
  );
  assert.equal(
    defaultWorkspaceEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.classes.length,
    2
  );

  const defaultTenantEvidenceRetentionClassPolicy = await fetchJson<TenantEvidenceRetentionClassPolicyResponse>(
    apiRoutes.tenantEvidenceRetentionClassPolicy(demoTenantKey)
  );

  assert.equal(defaultTenantEvidenceRetentionClassPolicy.tenantKey, demoTenantKey);
  assert.deepEqual(
    defaultTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons,
    [
      {
        holdReasonCode: "workspace_review",
        displayLabel: "Workspace Review",
        workflowHint: "Keep evidence available while a workspace reviewer inspects the submission.",
        severity: "low",
        escalationTarget: null,
        uiGroup: "review",
        acknowledgementRequired: false,
        defaultAssigneeTarget: "workspace-reviewers",
        slaSeconds: 86400
      },
      {
        holdReasonCode: "operator_investigation",
        displayLabel: "Operator Investigation",
        workflowHint: "Escalate evidence into the longer investigation workflow for operator follow-up.",
        severity: "high",
        escalationTarget: "ops-investigation",
        uiGroup: "investigation",
        acknowledgementRequired: true,
        defaultAssigneeTarget: "ops-investigation-primary",
        slaSeconds: 14400
      }
    ]
  );
  assert.equal(
    defaultTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.defaultCaptureRetentionClass,
    "workspace_review"
  );
  assert.equal(defaultTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.classes.length, 2);

  const defaultWorkspaceEvidenceRetentionClasses = await fetchJson<WorkspaceEvidenceRetentionClassesResponse>(
    apiRoutes.workspaceEvidenceRetentionClasses(demoTenantKey, demoWorkspaceKey)
  );
  const defaultWorkspaceReviewClass = defaultWorkspaceEvidenceRetentionClasses.classes.find(
    entry => entry.retentionClass === "workspace_review"
  );
  const defaultInvestigationClass = defaultWorkspaceEvidenceRetentionClasses.classes.find(
    entry => entry.retentionClass === "operator_investigation"
  );
  assert.ok(defaultWorkspaceReviewClass);
  assert.ok(defaultInvestigationClass);
  assert.equal(defaultWorkspaceReviewClass?.ttlSeconds, 604800);
  assert.equal(defaultWorkspaceReviewClass?.retentionPolicyKey, "spike_workspace_review");
  assert.deepEqual(
    defaultWorkspaceReviewClass?.holdTransitions.map(entry => entry.holdReasonCode),
    ["workspace_review", "operator_investigation"]
  );
  assert.equal(defaultInvestigationClass?.ttlSeconds, 2592000);
  assert.equal(defaultInvestigationClass?.retentionPolicyKey, "spike_operator_investigation");
  assert.deepEqual(
    defaultInvestigationClass?.holdTransitions.map(entry => entry.holdReasonCode),
    ["operator_investigation"]
  );

  const baselineSourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: starterFixture.sourcePackageFileNames[0],
        manifestHash: starterFixture.fixtureKey,
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const groupMonitorSourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: groupMonitorFixture.sourcePackageFileNames[0],
        manifestHash: groupMonitorFixture.fixtureKey,
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const groupMonitorRevisionSourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: groupMonitorRevisionFixture.sourcePackageFileNames[0],
        manifestHash: groupMonitorRevisionFixture.fixtureKey,
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const invalidSourceModelSourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: invalidSourceModelFixture.sourcePackageFileNames[0],
        manifestHash: invalidSourceModelFixture.fixtureKey,
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const invalidCanonicalSourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: invalidCanonicalFixture.sourcePackageFileNames[0],
        manifestHash: invalidCanonicalFixture.fixtureKey,
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const unknownImporterSourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: "unknown-fixture.xml.zip",
        manifestHash: "unknown-fixture",
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const baselineImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: baselineSourcePackage.sourcePackageId
      })
    },
    201
  );

  const groupMonitorImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: groupMonitorSourcePackage.sourcePackageId
      })
    },
    201
  );

  const groupMonitorRevisionImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: groupMonitorRevisionSourcePackage.sourcePackageId
      })
    },
    201
  );

  const invalidSourceModelImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: invalidSourceModelSourcePackage.sourcePackageId
      })
    },
    201
  );

  const invalidCanonicalImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: invalidCanonicalSourcePackage.sourcePackageId
      })
    },
    201
  );

  const invalidImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: unknownImporterSourcePackage.sourcePackageId
      })
    },
    201
  );

  const importJobs = await retry(async () => {
    const currentImportJobs = await fetchJson<{
      items: Array<{
        importJobId: string;
        sourcePackageId: string;
        status: string;
        failureMessage: string | null;
      }>;
    }>(apiRoutes.workspaceImportJobs(demoTenantKey, demoWorkspaceKey));

    assert.equal(currentImportJobs.items.length, 6);
    assert.ok(currentImportJobs.items.some(item =>
      item.sourcePackageId === baselineSourcePackage.sourcePackageId &&
      item.status === "completed" &&
      item.failureMessage === null
    ));
    assert.ok(currentImportJobs.items.some(item =>
      item.sourcePackageId === groupMonitorSourcePackage.sourcePackageId &&
      item.status === "completed" &&
      item.failureMessage === null
    ));
    assert.ok(currentImportJobs.items.some(item =>
      item.sourcePackageId === groupMonitorRevisionSourcePackage.sourcePackageId &&
      item.status === "completed" &&
      item.failureMessage === null
    ));
    assert.ok(currentImportJobs.items.some(item =>
      item.sourcePackageId === invalidSourceModelSourcePackage.sourcePackageId &&
      item.status === "failed" &&
      item.failureMessage?.includes("Source model validation failed")
    ));
    assert.ok(currentImportJobs.items.some(item =>
      item.sourcePackageId === invalidCanonicalSourcePackage.sourcePackageId &&
      item.status === "failed" &&
      item.failureMessage?.includes("Canonical snapshot validation failed")
    ));
    assert.ok(currentImportJobs.items.some(item =>
      item.sourcePackageId === unknownImporterSourcePackage.sourcePackageId &&
      item.status === "failed" &&
      item.failureMessage?.includes("No registered importer matches source package")
    ));

    return currentImportJobs;
  }, 40, 250);
  assert.equal(importJobs.items.length, 6);
  assert.ok(importJobs.items.some(item =>
    item.sourcePackageId === baselineSourcePackage.sourcePackageId &&
    item.status === "completed" &&
    item.failureMessage === null
  ));
  assert.ok(importJobs.items.some(item =>
    item.sourcePackageId === groupMonitorSourcePackage.sourcePackageId &&
    item.status === "completed" &&
    item.failureMessage === null
  ));
  assert.ok(importJobs.items.some(item =>
    item.sourcePackageId === groupMonitorRevisionSourcePackage.sourcePackageId &&
    item.status === "completed" &&
    item.failureMessage === null
  ));
  assert.ok(importJobs.items.some(item =>
    item.sourcePackageId === invalidSourceModelSourcePackage.sourcePackageId &&
    item.status === "failed" &&
    item.failureMessage?.includes("Source model validation failed")
  ));
  assert.ok(importJobs.items.some(item =>
    item.sourcePackageId === invalidCanonicalSourcePackage.sourcePackageId &&
    item.status === "failed" &&
    item.failureMessage?.includes("Canonical snapshot validation failed")
  ));
  assert.ok(importJobs.items.some(item =>
    item.sourcePackageId === unknownImporterSourcePackage.sourcePackageId &&
    item.status === "failed" &&
    item.failureMessage?.includes("No registered importer matches source package")
  ));

  const releases = await retry(async () => {
    const currentReleases = await fetchJson<{
      items: Array<{
        contentReleaseId: string;
        fixtureKey: string;
        releaseLabel: string;
        bookletCount: number;
        loginCount: number;
        assignmentCount: number;
        comparisonToPrevious: ContentReleaseComparisonToPrevious;
        activationGuardrail: ContentReleaseActivationGuardrail;
      }>;
    }>(
      apiRoutes.workspaceContentReleases(demoTenantKey, demoWorkspaceKey)
    );

    assert.equal(currentReleases.items.length, 3);
    return currentReleases;
  }, 40, 250);
  assert.equal(releases.items.length, 3);
  const baselineContentRelease = releases.items.find(item => item.fixtureKey === starterFixture.fixtureKey);
  const groupMonitorContentRelease = releases.items.find(item => item.fixtureKey === groupMonitorFixture.fixtureKey);
  const groupMonitorRevisionContentRelease = releases.items.find(
    item => item.fixtureKey === groupMonitorRevisionFixture.fixtureKey
  );
  assert.ok(baselineContentRelease);
  assert.ok(groupMonitorContentRelease);
  assert.ok(groupMonitorRevisionContentRelease);
  assert.equal(baselineContentRelease.assignmentCount, 1);
  assert.equal(baselineContentRelease.comparisonToPrevious.comparisonType, "initial_import");
  assert.equal(baselineContentRelease.comparisonToPrevious.baselineContentReleaseId, null);
  assert.equal(baselineContentRelease.comparisonToPrevious.totalChanges, 5);
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.units.addedKeys, ["UNIT-INTRO", "UNIT-MAIN"]);
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.booklets.addedKeys, ["BOOKLET-STARTER"]);
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.bookletChangeDetails, []);
  assert.equal(baselineContentRelease.comparisonToPrevious.activationImpact.riskLevel, "medium");
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.activationImpact.changedAreas, ["initial_import"]);
  assert.equal(baselineContentRelease.comparisonToPrevious.activationImpact.affectedLoginCount, 1);
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.activationImpact.affectedLoginKeys, ["alpha-001"]);
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.activationImpact.affectedGroupKeys, ["group-alpha"]);
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.activationImpact.affectedBookletKeys, ["BOOKLET-STARTER"]);
  assert.deepEqual(
    baselineContentRelease.comparisonToPrevious.activationImpact.affectedAssignmentKeys,
    ["alpha-001-main"]
  );
  assert.deepEqual(baselineContentRelease.comparisonToPrevious.activationImpact.highlights, [
    "Initial activation introduces 1 login across 1 group.",
    "Initial activation introduces 1 assignment across 1 booklet."
  ]);
  assert.equal(baselineContentRelease.activationGuardrail.status, "ready");
  assert.equal(baselineContentRelease.activationGuardrail.comparisonMode, "no_active_release");
  assert.equal(baselineContentRelease.activationGuardrail.activeSessionCount, 0);
  assert.equal(groupMonitorContentRelease.assignmentCount, 3);
  assert.equal(groupMonitorContentRelease.bookletCount, 2);
  assert.equal(groupMonitorContentRelease.loginCount, 3);
  assert.equal(groupMonitorContentRelease.comparisonToPrevious.comparisonType, "successive_import");
  assert.equal(groupMonitorContentRelease.comparisonToPrevious.baselineContentReleaseId, baselineContentRelease.contentReleaseId);
  assert.equal(groupMonitorContentRelease.comparisonToPrevious.baselineReleaseLabel, baselineContentRelease.releaseLabel);
  assert.equal(groupMonitorContentRelease.comparisonToPrevious.totalChanges, 13);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.units.addedKeys, [
    "UNIT-REVIEW",
    "UNIT-ALT-A",
    "UNIT-ALT-B"
  ]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.booklets.addedKeys, [
    "BOOKLET-MAIN",
    "BOOKLET-ALT"
  ]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.booklets.removedKeys, ["BOOKLET-STARTER"]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.bookletChangeDetails, []);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.runPoliciesChangedBookletKeys, []);
  assert.equal(groupMonitorContentRelease.comparisonToPrevious.activationImpact.riskLevel, "high");
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.activationImpact.changedAreas, [
    "units",
    "booklets",
    "login_collections",
    "assignment_routing"
  ]);
  assert.equal(groupMonitorContentRelease.comparisonToPrevious.activationImpact.affectedLoginCount, 4);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.activationImpact.affectedLoginKeys, [
    "alpha-001",
    "bravo-001",
    "bravo-002",
    "charlie-001"
  ]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.activationImpact.affectedGroupKeys, [
    "group-alpha",
    "group-bravo",
    "group-charlie"
  ]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.activationImpact.affectedBookletKeys, [
    "BOOKLET-ALT",
    "BOOKLET-MAIN",
    "BOOKLET-STARTER"
  ]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.activationImpact.affectedAssignmentKeys, [
    "alpha-001-main",
    "bravo-001-main",
    "bravo-002-main",
    "charlie-001-alt"
  ]);
  assert.deepEqual(groupMonitorContentRelease.comparisonToPrevious.activationImpact.highlights, [
    "2 booklets added, 1 booklet removed, 0 booklets updated.",
    "3 login collection changes affect 4 logins.",
    "4 assignment changes affect 4 logins."
  ]);
  assert.equal(groupMonitorContentRelease.activationGuardrail.status, "ready");
  assert.equal(groupMonitorContentRelease.activationGuardrail.comparisonMode, "no_active_release");
  assert.equal(groupMonitorRevisionContentRelease.assignmentCount, 3);
  assert.equal(groupMonitorRevisionContentRelease.bookletCount, 2);
  assert.equal(groupMonitorRevisionContentRelease.loginCount, 3);
  assert.equal(groupMonitorRevisionContentRelease.comparisonToPrevious.comparisonType, "successive_import");
  assert.equal(
    groupMonitorRevisionContentRelease.comparisonToPrevious.baselineContentReleaseId,
    groupMonitorContentRelease.contentReleaseId
  );
  assert.equal(
    groupMonitorRevisionContentRelease.comparisonToPrevious.baselineReleaseLabel,
    groupMonitorContentRelease.releaseLabel
  );
  assert.equal(groupMonitorRevisionContentRelease.comparisonToPrevious.totalChanges, 5);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.units.changedKeys, []);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.booklets.changedKeys, [
    "BOOKLET-MAIN",
    "BOOKLET-ALT"
  ]);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.loginCollections.changedKeys, [
    "COLLECTION-BRAVO"
  ]);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.bookletAssignments.changedKeys, [
    "bravo-002-main",
    "charlie-001-alt"
  ]);
  assert.deepEqual(
    groupMonitorRevisionContentRelease.comparisonToPrevious.runPoliciesChangedBookletKeys,
    ["BOOKLET-MAIN", "BOOKLET-ALT"]
  );
  assert.equal(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.riskLevel, "high");
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.changedAreas, [
    "booklets",
    "run_policy",
    "login_collections",
    "assignment_routing",
    "initial_state"
  ]);
  assert.equal(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.affectedLoginCount, 3);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.affectedLoginKeys, [
    "bravo-001",
    "bravo-002",
    "charlie-001"
  ]);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.affectedGroupKeys, [
    "group-bravo",
    "group-bravo-revision"
  ]);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.affectedBookletKeys, [
    "BOOKLET-ALT",
    "BOOKLET-MAIN"
  ]);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.affectedAssignmentKeys, [
    "bravo-002-main",
    "charlie-001-alt"
  ]);
  assert.deepEqual(groupMonitorRevisionContentRelease.comparisonToPrevious.activationImpact.highlights, [
    "2 booklets changed run policy affecting 3 logins.",
    "0 booklets added, 0 booklets removed, 2 booklets updated.",
    "1 login collection change affect 2 logins.",
    "2 assignment changes affect 2 logins."
  ]);
  assert.equal(groupMonitorRevisionContentRelease.activationGuardrail.status, "ready");
  assert.equal(groupMonitorRevisionContentRelease.activationGuardrail.comparisonMode, "no_active_release");
  assert.deepEqual(
    groupMonitorRevisionContentRelease.comparisonToPrevious.bookletChangeDetails,
    [
      {
        entityKey: "BOOKLET-MAIN",
        changes: [
          {
            fieldKey: "title",
            message: "Booklet title changed",
            before: "Main Cohort Booklet",
            after: "Main Cohort Booklet Rev B"
          },
          {
            fieldKey: "runPolicy.timeLimitSeconds",
            message: "Booklet time limit changed",
            before: 2700,
            after: 3000
          }
        ]
      },
      {
        entityKey: "BOOKLET-ALT",
        changes: [
          {
            fieldKey: "runPolicy.navigationLocked",
            message: "Booklet navigation lock policy changed",
            before: false,
            after: true
          },
          {
            fieldKey: "runPolicy.timeLimitSeconds",
            message: "Booklet time limit changed",
            before: null,
            after: 1200
          }
        ]
      }
    ]
  );
  assert.deepEqual(
    groupMonitorRevisionContentRelease.comparisonToPrevious.loginCollectionChangeDetails,
    [
      {
        entityKey: "COLLECTION-BRAVO",
        changes: [
          {
            fieldKey: "groupKey",
            message: "Login collection group changed",
            before: "group-bravo",
            after: "group-bravo-revision"
          }
        ]
      }
    ]
  );
  assert.deepEqual(
    groupMonitorRevisionContentRelease.comparisonToPrevious.bookletAssignmentChangeDetails,
    [
      {
        entityKey: "bravo-002-main",
        changes: [
          {
            fieldKey: "bookletKey",
            message: "Assignment target booklet changed",
            before: "BOOKLET-MAIN",
            after: "BOOKLET-ALT"
          }
        ]
      },
      {
        entityKey: "charlie-001-alt",
        changes: [
          {
            fieldKey: "initialStateOverrides.HELP",
            message: "Assignment initial state override 'HELP' changed",
            before: "enabled",
            after: "disabled"
          }
        ]
      }
    ]
  );

  const baselineContentReleaseId = baselineContentRelease.contentReleaseId;
  const groupMonitorContentReleaseId = groupMonitorContentRelease.contentReleaseId;
  const groupMonitorRevisionContentReleaseId = groupMonitorRevisionContentRelease.contentReleaseId;

  const baselineImportDiagnostics = await retry(async () => {
    const diagnostics = await fetchJson<{
      importJob: {
        importJobId: string;
        sourcePackageId: string;
        status: string;
        failureMessage: string | null;
      };
      sourcePackage: {
        sourcePackageId: string;
        fileName: string;
      } | null;
      contentRelease: {
        contentReleaseId: string;
        status: string;
        assignmentCount: number;
        activationGuardrail: ContentReleaseActivationGuardrail;
      } | null;
      diagnostics: {
        stages: Array<{
          stageKey: string;
          status: string;
        }>;
        artifacts: {
          importerKey: string | null;
          sourceManifest: {
            importerKey: string;
            manifestHash: string;
            declaredUnitKeys: string[];
            declaredBookletKeys: string[];
            declaredGroupKeys: string[];
            declaredLoginCount: number;
          } | null;
          sourceModel: {
            importerKey: string;
            fixtureKey: string;
            releaseLabel: string;
            unitCount: number;
            bookletCount: number;
            loginCollectionCount: number;
            groupCount: number;
            loginCount: number;
            assignmentCount: number;
            bookletKeys: string[];
            groupKeys: string[];
            assignmentKeys: string[];
          } | null;
          canonicalSummary: {
            fixtureKey: string;
            unitCount: number;
            bookletCount: number;
            loginCount: number;
            assignmentCount: number;
          } | null;
          referenceMappings: ImportJobReferenceMapping[];
        };
        failure: ImportJobDiagnosticFailure | null;
      };
      auditTrail: Array<{
        eventType: string;
      }>;
    }>(apiRoutes.workspaceImportJob(demoTenantKey, demoWorkspaceKey, baselineImportJob.importJobId));

    assert.equal(diagnostics.importJob.status, "completed");
    assert.equal(diagnostics.contentRelease?.contentReleaseId, baselineContentReleaseId);
    return diagnostics;
  }, 40, 250);

  assert.equal(baselineImportDiagnostics.importJob.importJobId, baselineImportJob.importJobId);
  assert.equal(baselineImportDiagnostics.importJob.sourcePackageId, baselineSourcePackage.sourcePackageId);
  assert.equal(baselineImportDiagnostics.importJob.status, "completed");
  assert.equal(baselineImportDiagnostics.importJob.failureMessage, null);
  assert.equal(baselineImportDiagnostics.sourcePackage?.sourcePackageId, baselineSourcePackage.sourcePackageId);
  assert.equal(baselineImportDiagnostics.sourcePackage?.fileName, starterFixture.sourcePackageFileNames[0]);
  assert.equal(baselineImportDiagnostics.contentRelease?.contentReleaseId, baselineContentReleaseId);
  assert.equal(baselineImportDiagnostics.contentRelease?.status, "draft");
  assert.equal(baselineImportDiagnostics.contentRelease?.assignmentCount, 1);
  assert.equal(baselineImportDiagnostics.contentRelease?.activationGuardrail.status, "ready");
  assert.equal(
    baselineImportDiagnostics.contentRelease?.activationGuardrail.comparisonMode,
    "no_active_release"
  );
  assert.deepEqual(
    baselineImportDiagnostics.diagnostics.stages.map(item => item.stageKey),
    [
      "queued",
      "worker_started",
      "load_source_package",
      "select_importer",
      "extract_source_manifest",
      "build_source_model",
      "validate_source_model",
      "transform_to_canonical",
      "validate_canonical_snapshot",
      "materialize_content_release",
      "complete"
    ]
  );
  assert.ok(baselineImportDiagnostics.diagnostics.stages.every(item => item.status === "completed"));
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.importerKey, "fixture-catalog:starter-and-login-baseline");
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.sourceManifest?.manifestHash, starterFixture.fixtureKey);
  assert.deepEqual(
    baselineImportDiagnostics.diagnostics.artifacts.sourceManifest?.declaredBookletKeys,
    ["BOOKLET-STARTER"]
  );
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.sourceModel?.fixtureKey, starterFixture.fixtureKey);
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.sourceModel?.unitCount, 2);
  assert.deepEqual(
    baselineImportDiagnostics.diagnostics.artifacts.sourceModel?.assignmentKeys,
    ["alpha-001-main"]
  );
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.canonicalSummary?.fixtureKey, starterFixture.fixtureKey);
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.canonicalSummary?.assignmentCount, 1);
  assert.equal(baselineImportDiagnostics.diagnostics.artifacts.referenceMappings.length, 5);
  assert.deepEqual(
    baselineImportDiagnostics.diagnostics.artifacts.referenceMappings.find(item => item.mappingKey === "booklet:BOOKLET-STARTER"),
    {
      mappingKey: "booklet:BOOKLET-STARTER",
      source: {
        entityKind: "booklet",
        identifier: "BOOKLET-STARTER",
        path: "booklets[0]"
      },
      canonical: {
        entityKind: "booklet",
        identifier: "BOOKLET-STARTER",
        path: "bookletDefinitions[0]"
      }
    }
  );
  assert.equal(baselineImportDiagnostics.diagnostics.failure, null);
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "workspace.import_job.queued"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.started"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_package.loaded"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.importer.selected"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_manifest.extracted"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.built"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.reference_map.built"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.validated"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.transformed"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.validated"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.materialized"));
  assert.ok(baselineImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.completed"));

  const groupMonitorImportDiagnostics = await retry(async () => {
    const diagnostics = await fetchJson<{
      importJob: {
        importJobId: string;
        sourcePackageId: string;
        status: string;
        failureMessage: string | null;
      };
      sourcePackage: {
        sourcePackageId: string;
        fileName: string;
      } | null;
      contentRelease: {
        contentReleaseId: string;
        status: string;
        assignmentCount: number;
      } | null;
      diagnostics: {
        stages: Array<{
          stageKey: string;
          status: string;
        }>;
        artifacts: {
          importerKey: string | null;
          sourceManifest: {
            importerKey: string;
            manifestHash: string;
            declaredUnitKeys: string[];
            declaredBookletKeys: string[];
            declaredGroupKeys: string[];
            declaredLoginCount: number;
          } | null;
          sourceModel: {
            importerKey: string;
            fixtureKey: string;
            releaseLabel: string;
            unitCount: number;
            bookletCount: number;
            loginCollectionCount: number;
            groupCount: number;
            loginCount: number;
            assignmentCount: number;
            bookletKeys: string[];
            groupKeys: string[];
            assignmentKeys: string[];
          } | null;
          canonicalSummary: {
            fixtureKey: string;
            unitCount: number;
            bookletCount: number;
            loginCount: number;
            assignmentCount: number;
          } | null;
          referenceMappings: ImportJobReferenceMapping[];
        };
        failure: ImportJobDiagnosticFailure | null;
      };
      auditTrail: Array<{
        eventType: string;
      }>;
    }>(apiRoutes.workspaceImportJob(demoTenantKey, demoWorkspaceKey, groupMonitorImportJob.importJobId));

    assert.equal(diagnostics.importJob.status, "completed");
    assert.equal(diagnostics.contentRelease?.contentReleaseId, groupMonitorContentReleaseId);
    return diagnostics;
  }, 40, 250);

  assert.equal(groupMonitorImportDiagnostics.importJob.importJobId, groupMonitorImportJob.importJobId);
  assert.equal(groupMonitorImportDiagnostics.importJob.sourcePackageId, groupMonitorSourcePackage.sourcePackageId);
  assert.equal(groupMonitorImportDiagnostics.importJob.status, "completed");
  assert.equal(groupMonitorImportDiagnostics.importJob.failureMessage, null);
  assert.equal(groupMonitorImportDiagnostics.sourcePackage?.sourcePackageId, groupMonitorSourcePackage.sourcePackageId);
  assert.equal(groupMonitorImportDiagnostics.sourcePackage?.fileName, groupMonitorFixture.sourcePackageFileNames[0]);
  assert.equal(groupMonitorImportDiagnostics.contentRelease?.contentReleaseId, groupMonitorContentReleaseId);
  assert.equal(groupMonitorImportDiagnostics.contentRelease?.status, "draft");
  assert.equal(groupMonitorImportDiagnostics.contentRelease?.assignmentCount, 3);
  assert.deepEqual(
    groupMonitorImportDiagnostics.diagnostics.stages.map(item => item.stageKey),
    [
      "queued",
      "worker_started",
      "load_source_package",
      "select_importer",
      "extract_source_manifest",
      "build_source_model",
      "validate_source_model",
      "transform_to_canonical",
      "validate_canonical_snapshot",
      "materialize_content_release",
      "complete"
    ]
  );
  assert.ok(groupMonitorImportDiagnostics.diagnostics.stages.every(item => item.status === "completed"));
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.importerKey, "fixture-catalog:group-monitor-matrix");
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.sourceManifest?.manifestHash, groupMonitorFixture.fixtureKey);
  assert.deepEqual(
    groupMonitorImportDiagnostics.diagnostics.artifacts.sourceManifest?.declaredGroupKeys,
    ["group-bravo", "group-charlie"]
  );
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.sourceModel?.fixtureKey, groupMonitorFixture.fixtureKey);
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.sourceModel?.bookletCount, 2);
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.sourceModel?.groupCount, 2);
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.sourceModel?.assignmentCount, 3);
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.canonicalSummary?.fixtureKey, groupMonitorFixture.fixtureKey);
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.canonicalSummary?.unitCount, 5);
  assert.equal(groupMonitorImportDiagnostics.diagnostics.artifacts.referenceMappings.length, 12);
  assert.deepEqual(
    groupMonitorImportDiagnostics.diagnostics.artifacts.referenceMappings.find(item => item.mappingKey === "login_collection:COLLECTION-CHARLIE"),
    {
      mappingKey: "login_collection:COLLECTION-CHARLIE",
      source: {
        entityKind: "login_collection",
        identifier: "COLLECTION-CHARLIE",
        path: "loginCollections[1]"
      },
      canonical: {
        entityKind: "login_collection",
        identifier: "COLLECTION-CHARLIE",
        path: "loginCollections[1]"
      }
    }
  );
  assert.equal(groupMonitorImportDiagnostics.diagnostics.failure, null);
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "workspace.import_job.queued"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.started"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_package.loaded"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.importer.selected"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_manifest.extracted"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.built"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.reference_map.built"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.validated"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.transformed"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.validated"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.materialized"));
  assert.ok(groupMonitorImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.completed"));

  const invalidSourceModelImportDiagnostics = await retry(async () => {
    const diagnostics = await fetchJson<{
      importJob: {
        importJobId: string;
        status: string;
        failureMessage: string | null;
      };
      sourcePackage: {
        sourcePackageId: string;
      } | null;
      contentRelease: {
        contentReleaseId: string;
      } | null;
      diagnostics: {
        stages: Array<{
          stageKey: string;
          status: string;
        }>;
        artifacts: {
          importerKey: string | null;
          sourceManifest: {
            manifestHash: string;
            declaredBookletKeys: string[];
          } | null;
          sourceModel: {
            fixtureKey: string;
            assignmentKeys: string[];
          } | null;
          canonicalSummary: unknown;
          referenceMappings: ImportJobReferenceMapping[];
        };
        failure: ImportJobDiagnosticFailure | null;
      };
      auditTrail: Array<{
        eventType: string;
      }>;
    }>(apiRoutes.workspaceImportJob(demoTenantKey, demoWorkspaceKey, invalidSourceModelImportJob.importJobId));

    assert.equal(diagnostics.importJob.status, "failed");
    return diagnostics;
  }, 40, 250);

  assert.equal(invalidSourceModelImportDiagnostics.importJob.importJobId, invalidSourceModelImportJob.importJobId);
  assert.equal(invalidSourceModelImportDiagnostics.importJob.status, "failed");
  assert.ok(invalidSourceModelImportDiagnostics.importJob.failureMessage?.includes("Source model validation failed"));
  assert.equal(invalidSourceModelImportDiagnostics.sourcePackage?.sourcePackageId, invalidSourceModelSourcePackage.sourcePackageId);
  assert.equal(invalidSourceModelImportDiagnostics.contentRelease, null);
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.stages.map(item => item.stageKey),
    [
      "queued",
      "worker_started",
      "load_source_package",
      "select_importer",
      "extract_source_manifest",
      "build_source_model",
      "validate_source_model"
    ]
  );
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.stages.map(item => item.status),
    ["completed", "completed", "completed", "completed", "completed", "completed", "failed"]
  );
  assert.equal(
    invalidSourceModelImportDiagnostics.diagnostics.artifacts.importerKey,
    "fixture-catalog:invalid-source-model"
  );
  assert.equal(
    invalidSourceModelImportDiagnostics.diagnostics.artifacts.sourceManifest?.manifestHash,
    invalidSourceModelFixture.fixtureKey
  );
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.artifacts.sourceManifest?.declaredBookletKeys,
    ["BOOKLET-BROKEN"]
  );
  assert.equal(
    invalidSourceModelImportDiagnostics.diagnostics.artifacts.sourceModel?.fixtureKey,
    invalidSourceModelFixture.fixtureKey
  );
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.artifacts.sourceModel?.assignmentKeys,
    ["broken-001-main"]
  );
  assert.equal(invalidSourceModelImportDiagnostics.diagnostics.artifacts.canonicalSummary, null);
  assert.equal(invalidSourceModelImportDiagnostics.diagnostics.artifacts.referenceMappings.length, 4);
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.artifacts.referenceMappings.find(
      item => item.mappingKey === "login_collection:COLLECTION-BROKEN"
    ),
    {
      mappingKey: "login_collection:COLLECTION-BROKEN",
      source: {
        entityKind: "login_collection",
        identifier: "COLLECTION-BROKEN",
        path: "loginCollections[0]"
      },
      canonical: {
        entityKind: "login_collection",
        identifier: "COLLECTION-BROKEN",
        path: "loginCollections[0]"
      }
    }
  );
  assert.equal(invalidSourceModelImportDiagnostics.diagnostics.failure?.failedStage, "validate_source_model");
  assert.ok(
    invalidSourceModelImportDiagnostics.diagnostics.failure?.failureMessage.includes("Source model validation failed")
  );
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.failure?.validationIssues,
    invalidSourceModelFixture.failureScenario?.validationIssues
  );
  assert.deepEqual(
    invalidSourceModelImportDiagnostics.diagnostics.failure?.validationIssues.map(issue => issue.mappingKeys),
    invalidSourceModelFixture.failureScenario?.validationIssues.map(issue => issue.mappingKeys)
  );
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "workspace.import_job.queued"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.started"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_package.loaded"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.importer.selected"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_manifest.extracted"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.built"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.reference_map.built"));
  assert.ok(invalidSourceModelImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.failed"));

  const invalidCanonicalImportDiagnostics = await retry(async () => {
    const diagnostics = await fetchJson<{
      importJob: {
        importJobId: string;
        status: string;
        failureMessage: string | null;
      };
      sourcePackage: {
        sourcePackageId: string;
      } | null;
      contentRelease: {
        contentReleaseId: string;
      } | null;
      diagnostics: {
        stages: Array<{
          stageKey: string;
          status: string;
        }>;
        artifacts: {
          importerKey: string | null;
          sourceManifest: {
            manifestHash: string;
          } | null;
          sourceModel: {
            fixtureKey: string;
            assignmentCount?: number;
          } | null;
          canonicalSummary: {
            fixtureKey: string;
            unitCount: number;
            assignmentCount: number;
          } | null;
          referenceMappings: ImportJobReferenceMapping[];
        };
        failure: ImportJobDiagnosticFailure | null;
      };
      auditTrail: Array<{
        eventType: string;
      }>;
    }>(apiRoutes.workspaceImportJob(demoTenantKey, demoWorkspaceKey, invalidCanonicalImportJob.importJobId));

    assert.equal(diagnostics.importJob.status, "failed");
    return diagnostics;
  }, 40, 250);

  assert.equal(invalidCanonicalImportDiagnostics.importJob.importJobId, invalidCanonicalImportJob.importJobId);
  assert.equal(invalidCanonicalImportDiagnostics.importJob.status, "failed");
  assert.ok(invalidCanonicalImportDiagnostics.importJob.failureMessage?.includes("Canonical snapshot validation failed"));
  assert.equal(invalidCanonicalImportDiagnostics.sourcePackage?.sourcePackageId, invalidCanonicalSourcePackage.sourcePackageId);
  assert.equal(invalidCanonicalImportDiagnostics.contentRelease, null);
  assert.deepEqual(
    invalidCanonicalImportDiagnostics.diagnostics.stages.map(item => item.stageKey),
    [
      "queued",
      "worker_started",
      "load_source_package",
      "select_importer",
      "extract_source_manifest",
      "build_source_model",
      "validate_source_model",
      "transform_to_canonical",
      "validate_canonical_snapshot"
    ]
  );
  assert.deepEqual(
    invalidCanonicalImportDiagnostics.diagnostics.stages.map(item => item.status),
    ["completed", "completed", "completed", "completed", "completed", "completed", "completed", "completed", "failed"]
  );
  assert.equal(
    invalidCanonicalImportDiagnostics.diagnostics.artifacts.importerKey,
    "fixture-catalog:invalid-canonical-snapshot"
  );
  assert.equal(
    invalidCanonicalImportDiagnostics.diagnostics.artifacts.sourceManifest?.manifestHash,
    invalidCanonicalFixture.fixtureKey
  );
  assert.equal(
    invalidCanonicalImportDiagnostics.diagnostics.artifacts.sourceModel?.fixtureKey,
    invalidCanonicalFixture.fixtureKey
  );
  assert.equal(
    invalidCanonicalImportDiagnostics.diagnostics.artifacts.canonicalSummary?.fixtureKey,
    invalidCanonicalFixture.fixtureKey
  );
  assert.equal(invalidCanonicalImportDiagnostics.diagnostics.artifacts.canonicalSummary?.unitCount, 2);
  assert.equal(invalidCanonicalImportDiagnostics.diagnostics.artifacts.canonicalSummary?.assignmentCount, 2);
  assert.equal(invalidCanonicalImportDiagnostics.diagnostics.artifacts.referenceMappings.length, 6);
  assert.deepEqual(
    invalidCanonicalImportDiagnostics.diagnostics.artifacts.referenceMappings.find(
      item => item.mappingKey === "booklet_assignment:canonical-broken-002-main"
    ),
    {
      mappingKey: "booklet_assignment:canonical-broken-002-main",
      source: {
        entityKind: "booklet_assignment",
        identifier: "canonical-broken-002-main",
        path: "bookletAssignments[1]"
      },
      canonical: {
        entityKind: "booklet_assignment",
        identifier: "canonical-broken-002-main",
        path: "bookletAssignments[1]"
      }
    }
  );
  assert.equal(invalidCanonicalImportDiagnostics.diagnostics.failure?.failedStage, "validate_canonical_snapshot");
  assert.ok(
    invalidCanonicalImportDiagnostics.diagnostics.failure?.failureMessage.includes("Canonical snapshot validation failed")
  );
  assert.deepEqual(
    invalidCanonicalImportDiagnostics.diagnostics.failure?.validationIssues,
    invalidCanonicalFixture.failureScenario?.validationIssues
  );
  assert.deepEqual(
    invalidCanonicalImportDiagnostics.diagnostics.failure?.validationIssues.map(issue => issue.mappingKeys),
    invalidCanonicalFixture.failureScenario?.validationIssues.map(issue => issue.mappingKeys)
  );
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "workspace.import_job.queued"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.started"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_package.loaded"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.importer.selected"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_manifest.extracted"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.built"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.reference_map.built"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_model.validated"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.canonical_snapshot.transformed"));
  assert.ok(invalidCanonicalImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.failed"));

  const invalidImportDiagnostics = await retry(async () => {
    const diagnostics = await fetchJson<{
      importJob: {
        importJobId: string;
        status: string;
        failureMessage: string | null;
      };
      sourcePackage: {
        sourcePackageId: string;
      } | null;
      contentRelease: {
        contentReleaseId: string;
      } | null;
      diagnostics: {
        stages: Array<{
          stageKey: string;
          status: string;
        }>;
        artifacts: {
          importerKey: string | null;
          sourceManifest: unknown;
          sourceModel: unknown;
          canonicalSummary: unknown;
          referenceMappings: ImportJobReferenceMapping[];
        };
        failure: ImportJobDiagnosticFailure | null;
      };
      auditTrail: Array<{
        eventType: string;
      }>;
    }>(apiRoutes.workspaceImportJob(demoTenantKey, demoWorkspaceKey, invalidImportJob.importJobId));

    assert.equal(diagnostics.importJob.status, "failed");
    return diagnostics;
  }, 40, 250);

  assert.equal(invalidImportDiagnostics.importJob.importJobId, invalidImportJob.importJobId);
  assert.equal(invalidImportDiagnostics.importJob.status, "failed");
  assert.ok(invalidImportDiagnostics.importJob.failureMessage?.includes("No registered importer matches source package"));
  assert.equal(invalidImportDiagnostics.sourcePackage?.sourcePackageId, unknownImporterSourcePackage.sourcePackageId);
  assert.equal(invalidImportDiagnostics.contentRelease, null);
  assert.deepEqual(
    invalidImportDiagnostics.diagnostics.stages.map(item => item.stageKey),
    ["queued", "worker_started", "load_source_package", "select_importer"]
  );
  assert.deepEqual(
    invalidImportDiagnostics.diagnostics.stages.map(item => item.status),
    ["completed", "completed", "completed", "failed"]
  );
  assert.equal(invalidImportDiagnostics.diagnostics.artifacts.importerKey, null);
  assert.equal(invalidImportDiagnostics.diagnostics.artifacts.sourceManifest, null);
  assert.equal(invalidImportDiagnostics.diagnostics.artifacts.sourceModel, null);
  assert.equal(invalidImportDiagnostics.diagnostics.artifacts.canonicalSummary, null);
  assert.deepEqual(invalidImportDiagnostics.diagnostics.artifacts.referenceMappings, []);
  assert.equal(invalidImportDiagnostics.diagnostics.failure?.failedStage, "select_importer");
  assert.ok(
    invalidImportDiagnostics.diagnostics.failure?.failureMessage.includes("No registered importer matches source package")
  );
  assert.deepEqual(invalidImportDiagnostics.diagnostics.failure?.validationIssues, []);
  assert.ok(invalidImportDiagnostics.auditTrail.some(item => item.eventType === "workspace.import_job.queued"));
  assert.ok(invalidImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.started"));
  assert.ok(invalidImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.source_package.loaded"));
  assert.ok(invalidImportDiagnostics.auditTrail.some(item => item.eventType === "worker.import_job.failed"));

  const baselineContentReleaseDetail = await retry(async () => {
    const detail = await fetchJson<{
      contentRelease: {
        contentReleaseId: string;
        sourcePackageId: string;
        importJobId: string;
        status: string;
        unitCount: number;
        comparisonToPrevious: ContentReleaseComparisonToPrevious;
        activationGuardrail: ContentReleaseActivationGuardrail;
      };
      sourcePackage: {
        sourcePackageId: string;
        fileName: string;
      } | null;
      importJob: {
        importJobId: string;
        status: string;
      } | null;
      canonicalSnapshot: {
        fixtureKey: string;
        unitKeys: string[];
        bookletDefinitions: Array<{
          bookletKey: string;
          unitCount: number;
          runPolicy: {
            navigationLocked: boolean;
            timeLimitSeconds: number | null;
          };
        }>;
        loginCollections: Array<{
          collectionKey: string;
          groupKey: string;
          loginKeys: string[];
        }>;
        bookletAssignments: Array<{
          assignmentKey: string;
          loginKey: string;
          bookletKey: string;
          initialStateOverrides: Record<string, string>;
        }>;
        systemCheckDefinitions: Array<{
          systemCheckKey: string;
          title: string;
          checkKeys: string[];
        }>;
      };
    }>(apiRoutes.workspaceContentRelease(demoTenantKey, demoWorkspaceKey, baselineContentReleaseId));

    assert.equal(detail.contentRelease.status, "draft");
    return detail;
  }, 40, 250);

  assert.equal(baselineContentReleaseDetail.contentRelease.contentReleaseId, baselineContentReleaseId);
  assert.equal(baselineContentReleaseDetail.contentRelease.sourcePackageId, baselineSourcePackage.sourcePackageId);
  assert.equal(baselineContentReleaseDetail.contentRelease.importJobId, baselineImportJob.importJobId);
  assert.equal(baselineContentReleaseDetail.contentRelease.status, "draft");
  assert.equal(baselineContentReleaseDetail.contentRelease.unitCount, 2);
  assert.equal(baselineContentReleaseDetail.contentRelease.comparisonToPrevious.comparisonType, "initial_import");
  assert.equal(baselineContentReleaseDetail.contentRelease.comparisonToPrevious.baselineContentReleaseId, null);
  assert.equal(baselineContentReleaseDetail.contentRelease.comparisonToPrevious.totalChanges, 5);
  assert.deepEqual(
    baselineContentReleaseDetail.contentRelease.comparisonToPrevious.units.addedKeys,
    ["UNIT-INTRO", "UNIT-MAIN"]
  );
  assert.deepEqual(baselineContentReleaseDetail.contentRelease.comparisonToPrevious.bookletChangeDetails, []);
  assert.equal(baselineContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.riskLevel, "medium");
  assert.deepEqual(
    baselineContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.highlights,
    [
      "Initial activation introduces 1 login across 1 group.",
      "Initial activation introduces 1 assignment across 1 booklet."
    ]
  );
  assert.equal(baselineContentReleaseDetail.contentRelease.activationGuardrail.status, "ready");
  assert.equal(
    baselineContentReleaseDetail.contentRelease.activationGuardrail.comparisonMode,
    "no_active_release"
  );
  assert.equal(baselineContentReleaseDetail.sourcePackage?.sourcePackageId, baselineSourcePackage.sourcePackageId);
  assert.equal(baselineContentReleaseDetail.sourcePackage?.fileName, starterFixture.sourcePackageFileNames[0]);
  assert.equal(baselineContentReleaseDetail.importJob?.importJobId, baselineImportJob.importJobId);
  assert.equal(baselineContentReleaseDetail.importJob?.status, "completed");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.fixtureKey, starterFixture.fixtureKey);
  assert.deepEqual(baselineContentReleaseDetail.canonicalSnapshot.unitKeys, ["UNIT-INTRO", "UNIT-MAIN"]);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletDefinitions.length, 1);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].bookletKey, "BOOKLET-STARTER");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].unitCount, 2);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].runPolicy.navigationLocked, true);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].runPolicy.timeLimitSeconds, 1800);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.loginCollections.length, 1);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.loginCollections[0].collectionKey, "COLLECTION-ALPHA");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.loginCollections[0].groupKey, "group-alpha");
  assert.deepEqual(baselineContentReleaseDetail.canonicalSnapshot.loginCollections[0].loginKeys, ["alpha-001"]);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletAssignments.length, 1);
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].assignmentKey, "alpha-001-main");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].loginKey, "alpha-001");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].bookletKey, "BOOKLET-STARTER");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].initialStateOverrides.START, "ready");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].initialStateOverrides.REVIEW, "disabled");
  assert.equal(baselineContentReleaseDetail.canonicalSnapshot.systemCheckDefinitions.length, 1);
  assert.equal(
    baselineContentReleaseDetail.canonicalSnapshot.systemCheckDefinitions[0].systemCheckKey,
    "SC-BASELINE"
  );
  assert.deepEqual(
    baselineContentReleaseDetail.canonicalSnapshot.systemCheckDefinitions[0].checkKeys,
    ["browser", "audio", "screen"]
  );

  const baselineSystemCheckProjection = await fetchJson<{
    contentRelease: {
      contentReleaseId: string;
    };
    projection: {
      systemChecks: Array<{
        systemCheckKey: string;
        title: string;
        checkKeys: string[];
      }>;
      groupKeys: string[];
      loginKeys: string[];
      loginCount: number;
    };
  }>(
    apiRoutes.workspaceContentReleaseSystemCheckProjection(
      demoTenantKey,
      demoWorkspaceKey,
      baselineContentReleaseId
    )
  );

  assert.equal(baselineSystemCheckProjection.contentRelease.contentReleaseId, baselineContentReleaseId);
  assert.equal(baselineSystemCheckProjection.projection.systemChecks.length, 1);
  assert.equal(baselineSystemCheckProjection.projection.systemChecks[0].systemCheckKey, "SC-BASELINE");
  assert.deepEqual(baselineSystemCheckProjection.projection.groupKeys, ["group-alpha"]);
  assert.deepEqual(baselineSystemCheckProjection.projection.loginKeys, ["alpha-001"]);
  assert.equal(baselineSystemCheckProjection.projection.loginCount, 1);

  const groupMonitorContentReleaseDetail = await retry(async () => {
    const detail = await fetchJson<{
      contentRelease: {
        contentReleaseId: string;
        sourcePackageId: string;
        importJobId: string;
        status: string;
        unitCount: number;
        comparisonToPrevious: ContentReleaseComparisonToPrevious;
        activationGuardrail: ContentReleaseActivationGuardrail;
      };
      sourcePackage: {
        sourcePackageId: string;
        fileName: string;
      } | null;
      importJob: {
        importJobId: string;
        status: string;
      } | null;
      canonicalSnapshot: {
        fixtureKey: string;
        unitKeys: string[];
        bookletDefinitions: Array<{
          bookletKey: string;
          unitCount: number;
          runPolicy: {
            navigationLocked: boolean;
            timeLimitSeconds: number | null;
          };
        }>;
        loginCollections: Array<{
          collectionKey: string;
          groupKey: string;
          loginKeys: string[];
        }>;
        bookletAssignments: Array<{
          assignmentKey: string;
          loginKey: string;
          bookletKey: string;
          initialStateOverrides: Record<string, string>;
        }>;
      };
    }>(apiRoutes.workspaceContentRelease(demoTenantKey, demoWorkspaceKey, groupMonitorContentReleaseId));

    assert.equal(detail.contentRelease.status, "draft");
    return detail;
  }, 40, 250);

  assert.equal(groupMonitorContentReleaseDetail.contentRelease.contentReleaseId, groupMonitorContentReleaseId);
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.sourcePackageId, groupMonitorSourcePackage.sourcePackageId);
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.importJobId, groupMonitorImportJob.importJobId);
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.status, "draft");
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.unitCount, 5);
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.comparisonType, "successive_import");
  assert.equal(
    groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.baselineContentReleaseId,
    baselineContentReleaseId
  );
  assert.equal(
    groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.baselineReleaseLabel,
    baselineContentRelease.releaseLabel
  );
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.totalChanges, 13);
  assert.deepEqual(
    groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.units.addedKeys,
    ["UNIT-REVIEW", "UNIT-ALT-A", "UNIT-ALT-B"]
  );
  assert.deepEqual(
    groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.booklets.removedKeys,
    ["BOOKLET-STARTER"]
  );
  assert.deepEqual(groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.bookletChangeDetails, []);
  assert.deepEqual(
    groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.runPoliciesChangedBookletKeys,
    []
  );
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.riskLevel, "high");
  assert.deepEqual(
    groupMonitorContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.affectedBookletKeys,
    ["BOOKLET-ALT", "BOOKLET-MAIN", "BOOKLET-STARTER"]
  );
  assert.equal(groupMonitorContentReleaseDetail.contentRelease.activationGuardrail.status, "ready");
  assert.equal(
    groupMonitorContentReleaseDetail.contentRelease.activationGuardrail.comparisonMode,
    "no_active_release"
  );
  assert.equal(groupMonitorContentReleaseDetail.sourcePackage?.sourcePackageId, groupMonitorSourcePackage.sourcePackageId);
  assert.equal(groupMonitorContentReleaseDetail.sourcePackage?.fileName, groupMonitorFixture.sourcePackageFileNames[0]);
  assert.equal(groupMonitorContentReleaseDetail.importJob?.importJobId, groupMonitorImportJob.importJobId);
  assert.equal(groupMonitorContentReleaseDetail.importJob?.status, "completed");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.fixtureKey, groupMonitorFixture.fixtureKey);
  assert.deepEqual(
    groupMonitorContentReleaseDetail.canonicalSnapshot.unitKeys,
    ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW", "UNIT-ALT-A", "UNIT-ALT-B"]
  );
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions.length, 2);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].bookletKey, "BOOKLET-MAIN");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].unitCount, 3);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].runPolicy.navigationLocked, true);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].runPolicy.timeLimitSeconds, 2700);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[1].bookletKey, "BOOKLET-ALT");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[1].unitCount, 2);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[1].runPolicy.navigationLocked, false);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletDefinitions[1].runPolicy.timeLimitSeconds, null);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections.length, 2);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections[0].collectionKey, "COLLECTION-BRAVO");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections[0].groupKey, "group-bravo");
  assert.deepEqual(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections[0].loginKeys, ["bravo-001", "bravo-002"]);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections[1].collectionKey, "COLLECTION-CHARLIE");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections[1].groupKey, "group-charlie");
  assert.deepEqual(groupMonitorContentReleaseDetail.canonicalSnapshot.loginCollections[1].loginKeys, ["charlie-001"]);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments.length, 3);
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].assignmentKey, "bravo-001-main");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[0].bookletKey, "BOOKLET-MAIN");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[1].assignmentKey, "bravo-002-main");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[1].bookletKey, "BOOKLET-MAIN");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[2].assignmentKey, "charlie-001-alt");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[2].bookletKey, "BOOKLET-ALT");
  assert.equal(groupMonitorContentReleaseDetail.canonicalSnapshot.bookletAssignments[2].initialStateOverrides.HELP, "enabled");

  const groupMonitorRevisionContentReleaseDetail = await retry(async () => {
    const detail = await fetchJson<{
      contentRelease: {
        contentReleaseId: string;
        sourcePackageId: string;
        importJobId: string;
        status: string;
        unitCount: number;
        comparisonToPrevious: ContentReleaseComparisonToPrevious;
        activationGuardrail: ContentReleaseActivationGuardrail;
      };
      sourcePackage: {
        sourcePackageId: string;
        fileName: string;
      } | null;
      importJob: {
        importJobId: string;
        status: string;
      } | null;
      canonicalSnapshot: {
        fixtureKey: string;
        unitKeys: string[];
        bookletDefinitions: Array<{
          bookletKey: string;
          title: string;
          unitCount: number;
          runPolicy: {
            navigationLocked: boolean;
            timeLimitSeconds: number | null;
          };
        }>;
        loginCollections: Array<{
          collectionKey: string;
          groupKey: string;
          loginKeys: string[];
        }>;
        bookletAssignments: Array<{
          assignmentKey: string;
          loginKey: string;
          bookletKey: string;
          initialStateOverrides: Record<string, string>;
        }>;
      };
    }>(apiRoutes.workspaceContentRelease(demoTenantKey, demoWorkspaceKey, groupMonitorRevisionContentReleaseId));

    assert.equal(detail.contentRelease.status, "draft");
    return detail;
  }, 40, 250);

  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.contentReleaseId, groupMonitorRevisionContentReleaseId);
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.sourcePackageId, groupMonitorRevisionSourcePackage.sourcePackageId);
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.importJobId, groupMonitorRevisionImportJob.importJobId);
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.status, "draft");
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.unitCount, 5);
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.baselineContentReleaseId,
    groupMonitorContentReleaseId
  );
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.baselineReleaseLabel,
    groupMonitorFixture.releaseLabel
  );
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.totalChanges, 5);
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.booklets.changedKeys,
    ["BOOKLET-MAIN", "BOOKLET-ALT"]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.loginCollections.changedKeys,
    ["COLLECTION-BRAVO"]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.bookletAssignments.changedKeys,
    ["bravo-002-main", "charlie-001-alt"]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.runPoliciesChangedBookletKeys,
    ["BOOKLET-MAIN", "BOOKLET-ALT"]
  );
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.riskLevel, "high");
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.changedAreas,
    ["booklets", "run_policy", "login_collections", "assignment_routing", "initial_state"]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.affectedGroupKeys,
    ["group-bravo", "group-bravo-revision"]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.activationImpact.highlights,
    [
      "2 booklets changed run policy affecting 3 logins.",
      "0 booklets added, 0 booklets removed, 2 booklets updated.",
      "1 login collection change affect 2 logins.",
      "2 assignment changes affect 2 logins."
    ]
  );
  assert.equal(groupMonitorRevisionContentReleaseDetail.contentRelease.activationGuardrail.status, "ready");
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.contentRelease.activationGuardrail.comparisonMode,
    "no_active_release"
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.bookletChangeDetails,
    [
      {
        entityKey: "BOOKLET-MAIN",
        changes: [
          {
            fieldKey: "title",
            message: "Booklet title changed",
            before: "Main Cohort Booklet",
            after: "Main Cohort Booklet Rev B"
          },
          {
            fieldKey: "runPolicy.timeLimitSeconds",
            message: "Booklet time limit changed",
            before: 2700,
            after: 3000
          }
        ]
      },
      {
        entityKey: "BOOKLET-ALT",
        changes: [
          {
            fieldKey: "runPolicy.navigationLocked",
            message: "Booklet navigation lock policy changed",
            before: false,
            after: true
          },
          {
            fieldKey: "runPolicy.timeLimitSeconds",
            message: "Booklet time limit changed",
            before: null,
            after: 1200
          }
        ]
      }
    ]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.loginCollectionChangeDetails,
    [
      {
        entityKey: "COLLECTION-BRAVO",
        changes: [
          {
            fieldKey: "groupKey",
            message: "Login collection group changed",
            before: "group-bravo",
            after: "group-bravo-revision"
          }
        ]
      }
    ]
  );
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.contentRelease.comparisonToPrevious.bookletAssignmentChangeDetails,
    [
      {
        entityKey: "bravo-002-main",
        changes: [
          {
            fieldKey: "bookletKey",
            message: "Assignment target booklet changed",
            before: "BOOKLET-MAIN",
            after: "BOOKLET-ALT"
          }
        ]
      },
      {
        entityKey: "charlie-001-alt",
        changes: [
          {
            fieldKey: "initialStateOverrides.HELP",
            message: "Assignment initial state override 'HELP' changed",
            before: "enabled",
            after: "disabled"
          }
        ]
      }
    ]
  );
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.sourcePackage?.sourcePackageId,
    groupMonitorRevisionSourcePackage.sourcePackageId
  );
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.sourcePackage?.fileName,
    groupMonitorRevisionFixture.sourcePackageFileNames[0]
  );
  assert.equal(groupMonitorRevisionContentReleaseDetail.importJob?.importJobId, groupMonitorRevisionImportJob.importJobId);
  assert.equal(groupMonitorRevisionContentReleaseDetail.importJob?.status, "completed");
  assert.equal(groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.fixtureKey, groupMonitorRevisionFixture.fixtureKey);
  assert.deepEqual(
    groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.unitKeys,
    ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW", "UNIT-ALT-A", "UNIT-ALT-B"]
  );
  assert.equal(groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].title, "Main Cohort Booklet Rev B");
  assert.equal(groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.bookletDefinitions[0].runPolicy.timeLimitSeconds, 3000);
  assert.equal(groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.bookletDefinitions[1].runPolicy.navigationLocked, true);
  assert.equal(groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.bookletDefinitions[1].runPolicy.timeLimitSeconds, 1200);
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.loginCollections[0].groupKey,
    "group-bravo-revision"
  );
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.bookletAssignments[1].bookletKey,
    "BOOKLET-ALT"
  );
  assert.equal(
    groupMonitorRevisionContentReleaseDetail.canonicalSnapshot.bookletAssignments[2].initialStateOverrides.HELP,
    "disabled"
  );

  const groupMonitorRevisionProjection = await fetchJson<{
    contentRelease: {
      contentReleaseId: string;
      activationGuardrail: ContentReleaseActivationGuardrail;
    };
    projection: {
      groups: Array<{
        collectionKey: string;
        groupKey: string;
        loginKeys: string[];
        assignments: Array<{
          assignmentKey: string;
          loginKey: string;
          bookletKey: string;
          bookletTitle: string;
          unitCount: number;
          initialStateOverrides: Record<string, string>;
        }>;
      }>;
      booklets: Array<{
        bookletKey: string;
        title: string;
        runPolicy: {
          navigationLocked: boolean;
          timeLimitSeconds: number | null;
        };
        unitKeys: string[];
        groupKeys: string[];
        loginKeys: string[];
        assignmentKeys: string[];
      }>;
    };
  }>(
    apiRoutes.workspaceContentReleaseMonitorProjection(
      demoTenantKey,
      demoWorkspaceKey,
      groupMonitorRevisionContentReleaseId
    )
  );

  assert.equal(groupMonitorRevisionProjection.contentRelease.contentReleaseId, groupMonitorRevisionContentReleaseId);
  assert.equal(groupMonitorRevisionProjection.contentRelease.activationGuardrail.status, "ready");
  assert.equal(groupMonitorRevisionProjection.projection.groups.length, 2);
  assert.deepEqual(groupMonitorRevisionProjection.projection.groups[0], {
    collectionKey: "COLLECTION-BRAVO",
    groupKey: "group-bravo-revision",
    loginKeys: ["bravo-001", "bravo-002"],
    assignments: [
      {
        assignmentKey: "bravo-001-main",
        loginKey: "bravo-001",
        bookletKey: "BOOKLET-MAIN",
        bookletTitle: "Main Cohort Booklet Rev B",
        unitCount: 3,
        initialStateOverrides: {
          START: "ready",
          REVIEW: "enabled"
        }
      },
      {
        assignmentKey: "bravo-002-main",
        loginKey: "bravo-002",
        bookletKey: "BOOKLET-ALT",
        bookletTitle: "Alternate Cohort Booklet",
        unitCount: 2,
        initialStateOverrides: {
          START: "ready",
          REVIEW: "enabled"
        }
      }
    ]
  });
  assert.deepEqual(groupMonitorRevisionProjection.projection.groups[1], {
    collectionKey: "COLLECTION-CHARLIE",
    groupKey: "group-charlie",
    loginKeys: ["charlie-001"],
    assignments: [
      {
        assignmentKey: "charlie-001-alt",
        loginKey: "charlie-001",
        bookletKey: "BOOKLET-ALT",
        bookletTitle: "Alternate Cohort Booklet",
        unitCount: 2,
        initialStateOverrides: {
          START: "ready",
          HELP: "disabled"
        }
      }
    ]
  });
  assert.deepEqual(groupMonitorRevisionProjection.projection.booklets, [
    {
      bookletKey: "BOOKLET-MAIN",
      title: "Main Cohort Booklet Rev B",
      runPolicy: {
        navigationLocked: true,
        timeLimitSeconds: 3000
      },
      unitKeys: ["UNIT-INTRO", "UNIT-MAIN", "UNIT-REVIEW"],
      groupKeys: ["group-bravo-revision"],
      loginKeys: ["bravo-001"],
      assignmentKeys: ["bravo-001-main"]
    },
    {
      bookletKey: "BOOKLET-ALT",
      title: "Alternate Cohort Booklet",
      runPolicy: {
        navigationLocked: true,
        timeLimitSeconds: 1200
      },
      unitKeys: ["UNIT-ALT-A", "UNIT-ALT-B"],
      groupKeys: ["group-bravo-revision", "group-charlie"],
      loginKeys: ["bravo-002", "charlie-001"],
      assignmentKeys: ["bravo-002-main", "charlie-001-alt"]
    }
  ]);

  const activationResponse = await fetchJson<{
    contentReleaseId: string;
    status: string;
    comparisonToPrevious: ContentReleaseComparisonToPrevious;
    activationGuardrail: ContentReleaseActivationGuardrail;
  }>(
    apiRoutes.contentReleaseActivate(demoTenantKey, demoWorkspaceKey, baselineContentReleaseId),
    {
      method: "POST"
    }
  );
  assert.equal(activationResponse.contentReleaseId, baselineContentReleaseId);
  assert.equal(activationResponse.status, "active");
  assert.equal(activationResponse.comparisonToPrevious.activationImpact.riskLevel, "medium");
  assert.equal(activationResponse.activationGuardrail.status, "ready");
  assert.equal(activationResponse.activationGuardrail.comparisonMode, "already_active");
  assert.equal(activationResponse.activationGuardrail.activeSessionCount, 0);
  assert.deepEqual(activationResponse.activationGuardrail.highlights, [
    "This release is already active in the workspace."
  ]);

  const revisionGuardrailBeforeSessions = await fetchJson<{
    contentRelease: {
      activationGuardrail: ContentReleaseActivationGuardrail;
    };
  }>(
    apiRoutes.workspaceContentRelease(demoTenantKey, demoWorkspaceKey, groupMonitorRevisionContentReleaseId)
  );

  assert.equal(revisionGuardrailBeforeSessions.contentRelease.activationGuardrail.status, "warning");
  assert.equal(
    revisionGuardrailBeforeSessions.contentRelease.activationGuardrail.comparisonMode,
    "switch_from_active_release"
  );
  assert.equal(
    revisionGuardrailBeforeSessions.contentRelease.activationGuardrail.comparedToActiveContentReleaseId,
    baselineContentReleaseId
  );
  assert.equal(revisionGuardrailBeforeSessions.contentRelease.activationGuardrail.activeSessionCount, 0);
  assert.ok(
    revisionGuardrailBeforeSessions.contentRelease.activationGuardrail.warningReasonCodes.includes(
      "high_risk_release_change"
    )
  );
  assert.deepEqual(
    revisionGuardrailBeforeSessions.contentRelease.activationGuardrail.blockingReasonCodes,
    []
  );

  const signInResponse = await fetchJsonResponse<{
    loginFlow: {
      participantSessionToken: string;
    };
  }>(apiRoutes.participantAuthSignIn, {
    method: "POST",
    body: JSON.stringify({
      tenantKey: demoTenantKey,
      workspaceKey: demoWorkspaceKey,
      loginKey: "alpha-001"
    })
  });

  const signInRequestId = signInResponse.headers.get("x-request-id");
  assert.ok(signInRequestId);
  const signIn = signInResponse.body;
  const participantSessionToken = signIn.loginFlow.participantSessionToken;

  const starter = await fetchJson<{
    assignments: Array<{ assignmentKey: string }>;
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
      warningReasonCodes: string[];
    };
  }>(`${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);
  assert.equal(starter.assignments.length, 1);
  assert.equal(starter.systemCheckReadiness.status, "blocked");
  assert.deepEqual(starter.systemCheckReadiness.blockingReasonCodes, ["missing_submission"]);
  assert.deepEqual(starter.systemCheckReadiness.warningReasonCodes, []);

  const assignmentKey = starter.assignments[0].assignmentKey;

  const blockedLaunchBeforeSystemCheck = await fetchJsonResponse<{
    error: {
      code: string;
      details: {
        systemCheckReadiness: {
          status: string;
          blockingReasonCodes: string[];
        };
      };
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create"
    })
  }, 409);
  const blockedLaunchBeforeSystemCheckRequestId = blockedLaunchBeforeSystemCheck.headers.get("x-request-id");
  assert.ok(blockedLaunchBeforeSystemCheckRequestId);
  assert.equal(
    blockedLaunchBeforeSystemCheck.body.error.code,
    "starter_launch_blocked_by_system_check"
  );
  assert.equal(
    blockedLaunchBeforeSystemCheck.body.error.details.systemCheckReadiness.status,
    "blocked"
  );
  assert.deepEqual(
    blockedLaunchBeforeSystemCheck.body.error.details.systemCheckReadiness.blockingReasonCodes,
    ["missing_submission"]
  );

  const participantSystemCheck = await fetchJson<{
    participantSessionToken: string;
    loginKey: string;
    groupKey: string;
    contentReleaseId: string;
    systemChecks: Array<{
      systemCheckKey: string;
      title: string;
      checkKeys: string[];
    }>;
    submissions: Array<{
      systemCheckSubmissionId: string;
      review: {
        reviewStatus: string;
      };
    }>;
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
    };
  }>(`${apiRoutes.participantSystemCheck}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);
  assert.equal(participantSystemCheck.participantSessionToken, participantSessionToken);
  assert.equal(participantSystemCheck.loginKey, "alpha-001");
  assert.equal(participantSystemCheck.groupKey, "group-alpha");
  assert.equal(participantSystemCheck.contentReleaseId, baselineContentReleaseId);
  assert.equal(participantSystemCheck.systemChecks.length, 1);
  assert.equal(participantSystemCheck.systemChecks[0].systemCheckKey, "SC-BASELINE");
  assert.equal(participantSystemCheck.systemCheckReadiness.status, "blocked");
  assert.deepEqual(participantSystemCheck.systemCheckReadiness.blockingReasonCodes, ["missing_submission"]);
  assert.deepEqual(participantSystemCheck.submissions, []);

  const audioEvidencePayloadBase64 = Buffer
    .from("audio-check-log: output device is quiet on default speakers", "utf-8")
    .toString("base64");
  const systemCheckEvidenceCaptureResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      systemCheckKey: string;
      checkKey: string;
      fileName: string;
      contentType: string;
      byteSize: number;
      sha256: string;
      payloadPreviewText: string | null;
      storage: {
        storageBackend: string;
        retrievalMode: string;
        inlinePayloadAvailable: boolean;
        payloadAvailability: string;
      };
      retention: {
        state: string;
        retentionClass: string;
        retentionPolicyKey: string;
        expiresAt: string | null;
        hold: {
          holdReasonCode: string;
          holdNote: string;
          heldByActorId: string;
        } | null;
        purgedAt: string | null;
        purgeReasonCode: string | null;
      };
    };
    accessGrant: {
      accessToken: string;
      evidenceKey: string;
      issuedFor: string;
      issuedAt: string;
      expiresAt: string;
      retrievalUrl: string;
    };
  }>(apiRoutes.participantSystemCheckEvidenceCapture, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkKey: "audio",
      fileName: "audio-check.log",
      contentType: "text/plain",
      payloadBase64: audioEvidencePayloadBase64
    })
  }, 201);
  const systemCheckEvidenceCaptureRequestId = systemCheckEvidenceCaptureResponse.headers.get("x-request-id");
  assert.ok(systemCheckEvidenceCaptureRequestId);
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.systemCheckKey, "SC-BASELINE");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.checkKey, "audio");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.fileName, "audio-check.log");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.contentType, "text/plain");
  assert.equal(
    systemCheckEvidenceCaptureResponse.body.evidence.payloadPreviewText,
    "audio-check-log: output device is quiet on default speakers"
  );
  assert.ok(systemCheckEvidenceCaptureResponse.body.evidence.byteSize > 0);
  assert.ok(systemCheckEvidenceCaptureResponse.body.evidence.sha256);
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.storage.storageBackend, "s3_compatible_spike");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.storage.retrievalMode, "access_grant_required");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.storage.inlinePayloadAvailable, false);
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.storage.payloadAvailability, "available");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.retention.state, "retained");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.retention.retentionClass, "workspace_review");
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.retention.retentionPolicyKey, "spike_workspace_review");
  assert.ok(systemCheckEvidenceCaptureResponse.body.evidence.retention.expiresAt);
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.retention.hold, null);
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.retention.purgedAt, null);
  assert.equal(systemCheckEvidenceCaptureResponse.body.evidence.retention.purgeReasonCode, null);
  assert.equal(systemCheckEvidenceCaptureResponse.body.accessGrant.evidenceKey, systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey);
  assert.equal(systemCheckEvidenceCaptureResponse.body.accessGrant.issuedFor, "participant_capture");
  assert.ok(systemCheckEvidenceCaptureResponse.body.accessGrant.accessToken);
  assert.ok(systemCheckEvidenceCaptureResponse.body.accessGrant.issuedAt);
  assert.ok(systemCheckEvidenceCaptureResponse.body.accessGrant.expiresAt);
  assert.equal(
    systemCheckEvidenceCaptureResponse.body.accessGrant.retrievalUrl,
    apiRoutes.systemCheckEvidenceAccess(systemCheckEvidenceCaptureResponse.body.accessGrant.accessToken)
  );

  const participantEvidenceAccessResponse = await fetchJson<{
    evidence: {
      evidenceKey: string;
      payloadPreviewText: string | null;
    };
    accessGrant: {
      accessToken: string;
      issuedFor: string;
      lastAccessedAt?: string | null;
    };
    content: {
      payloadBase64: string;
      payloadPreviewText: string | null;
    };
  }>(systemCheckEvidenceCaptureResponse.body.accessGrant.retrievalUrl);
  assert.equal(
    participantEvidenceAccessResponse.evidence.evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(participantEvidenceAccessResponse.accessGrant.accessToken, systemCheckEvidenceCaptureResponse.body.accessGrant.accessToken);
  assert.equal(participantEvidenceAccessResponse.accessGrant.issuedFor, "participant_capture");
  assert.equal(participantEvidenceAccessResponse.content.payloadBase64, audioEvidencePayloadBase64);
  assert.equal(
    participantEvidenceAccessResponse.content.payloadPreviewText,
    "audio-check-log: output device is quiet on default speakers"
  );

  const systemCheckSubmitResponse = await fetchJsonResponse<{
    submission: {
      systemCheckSubmissionId: string;
      participantSessionId: string;
      contentReleaseId: string;
      loginKey: string;
      groupKey: string;
      systemCheckKey: string;
      systemCheckTitle: string | null;
      status: string;
      checkResults: Record<string, {
        status: string;
        detailMessage: string | null;
        observedValue: string | null;
        evidenceKeys: string[];
        evidenceItems: Array<{
          evidenceKey: string;
          fileName: string;
          contentType: string;
          payloadBase64?: string;
        }>;
      }>;
      review: {
        reviewStatus: string;
        reviewNote: string | null;
        reviewedAt: string | null;
      };
      summary: {
        totalChecks: number;
        passedChecks: number;
        warningChecks: number;
        failedChecks: number;
      };
      submittedAt: string;
    };
  }>(apiRoutes.participantSystemCheckSubmit, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkResults: {
        browser: {
          status: "passed",
          detailMessage: "Chromium 123",
          observedValue: "supported",
          evidenceKeys: []
        },
        audio: {
          status: "warning",
          detailMessage: "Audio output is quiet",
          observedValue: "low-volume",
          evidenceKeys: [systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey]
        },
        screen: {
          status: "passed",
          detailMessage: null,
          observedValue: "1920x1080",
          evidenceKeys: []
        }
      }
    })
  }, 201);
  const systemCheckSubmitRequestId = systemCheckSubmitResponse.headers.get("x-request-id");
  assert.ok(systemCheckSubmitRequestId);
  assert.equal(systemCheckSubmitResponse.body.submission.contentReleaseId, baselineContentReleaseId);
  assert.equal(systemCheckSubmitResponse.body.submission.systemCheckKey, "SC-BASELINE");
  assert.equal(systemCheckSubmitResponse.body.submission.systemCheckTitle, "Starter Device Check");
  assert.equal(systemCheckSubmitResponse.body.submission.status, "warning");
  assert.equal(systemCheckSubmitResponse.body.submission.checkResults.audio.status, "warning");
  assert.equal(
    systemCheckSubmitResponse.body.submission.checkResults.audio.detailMessage,
    "Audio output is quiet"
  );
  assert.deepEqual(
    systemCheckSubmitResponse.body.submission.checkResults.audio.evidenceKeys,
    [systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey]
  );
  assert.equal(systemCheckSubmitResponse.body.submission.checkResults.audio.evidenceItems.length, 1);
  assert.equal(
    systemCheckSubmitResponse.body.submission.checkResults.audio.evidenceItems[0].evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(
    systemCheckSubmitResponse.body.submission.checkResults.audio.evidenceItems[0].fileName,
    "audio-check.log"
  );
  assert.equal(systemCheckSubmitResponse.body.submission.review.reviewStatus, "pending");
  assert.equal(systemCheckSubmitResponse.body.submission.review.reviewNote, null);
  assert.equal(systemCheckSubmitResponse.body.submission.review.reviewedAt, null);
  const participantSessionId = systemCheckSubmitResponse.body.submission.participantSessionId;
  assert.deepEqual(systemCheckSubmitResponse.body.submission.summary, {
    totalChecks: 3,
    passedChecks: 2,
    warningChecks: 1,
    failedChecks: 0
  });

  const participantSystemCheckAfterSubmit = await fetchJson<{
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
      warningReasonCodes: string[];
      checks: Array<{
        systemCheckKey: string;
        readinessStatus: string;
        reasonCodes: string[];
      }>;
    };
    submissions: Array<{
      systemCheckSubmissionId: string;
      status: string;
      systemCheckTitle: string | null;
      review: {
        reviewStatus: string;
        reviewNote: string | null;
        reviewedAt: string | null;
      };
      checkResults: Record<string, {
        evidenceItems: Array<{
          evidenceKey: string;
          fileName: string;
        }>;
      }>;
      summary: {
        totalChecks: number;
        passedChecks: number;
        warningChecks: number;
        failedChecks: number;
      };
    }>;
  }>(`${apiRoutes.participantSystemCheck}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);
  assert.equal(participantSystemCheckAfterSubmit.systemCheckReadiness.status, "blocked");
  assert.deepEqual(
    participantSystemCheckAfterSubmit.systemCheckReadiness.blockingReasonCodes,
    ["pending_review"]
  );
  assert.deepEqual(participantSystemCheckAfterSubmit.systemCheckReadiness.warningReasonCodes, []);
  assert.equal(participantSystemCheckAfterSubmit.systemCheckReadiness.checks.length, 1);
  assert.equal(
    participantSystemCheckAfterSubmit.systemCheckReadiness.checks[0].readinessStatus,
    "blocked"
  );
  assert.deepEqual(
    participantSystemCheckAfterSubmit.systemCheckReadiness.checks[0].reasonCodes,
    ["pending_review"]
  );
  assert.equal(participantSystemCheckAfterSubmit.submissions.length, 1);
  assert.equal(
    participantSystemCheckAfterSubmit.submissions[0].systemCheckSubmissionId,
    systemCheckSubmitResponse.body.submission.systemCheckSubmissionId
  );
  assert.equal(participantSystemCheckAfterSubmit.submissions[0].status, "warning");
  assert.equal(participantSystemCheckAfterSubmit.submissions[0].systemCheckTitle, "Starter Device Check");
  assert.equal(participantSystemCheckAfterSubmit.submissions[0].review.reviewStatus, "pending");
  assert.equal(participantSystemCheckAfterSubmit.submissions[0].checkResults.audio.evidenceItems.length, 1);
  assert.equal(
    participantSystemCheckAfterSubmit.submissions[0].checkResults.audio.evidenceItems[0].evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.deepEqual(participantSystemCheckAfterSubmit.submissions[0].summary, {
    totalChecks: 3,
    passedChecks: 2,
    warningChecks: 1,
    failedChecks: 0
  });

  const workspaceSystemCheckResults = await fetchJson<{
    items: Array<{
      systemCheckSubmissionId: string;
      contentReleaseId: string;
      loginKey: string;
      groupKey: string;
      systemCheckKey: string;
      systemCheckTitle: string | null;
      status: string;
      review: {
        reviewStatus: string;
        reviewNote: string | null;
      };
      checkResults: Record<string, {
        evidenceItems: Array<{
          evidenceKey: string;
          fileName: string;
        }>;
      }>;
    }>;
    filters: {
      groupKey: string | null;
      status: string | null;
      reviewStatus: string | null;
    };
  }>(`${apiRoutes.workspaceSystemCheckResults(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&status=warning`);
  assert.deepEqual(workspaceSystemCheckResults.filters, {
    groupKey: "group-alpha",
    status: "warning",
    reviewStatus: null
  });
  assert.equal(workspaceSystemCheckResults.items.length, 1);
  assert.equal(
    workspaceSystemCheckResults.items[0].systemCheckSubmissionId,
    systemCheckSubmitResponse.body.submission.systemCheckSubmissionId
  );
  assert.equal(workspaceSystemCheckResults.items[0].contentReleaseId, baselineContentReleaseId);
  assert.equal(workspaceSystemCheckResults.items[0].loginKey, "alpha-001");
  assert.equal(workspaceSystemCheckResults.items[0].groupKey, "group-alpha");
  assert.equal(workspaceSystemCheckResults.items[0].systemCheckKey, "SC-BASELINE");
  assert.equal(workspaceSystemCheckResults.items[0].systemCheckTitle, "Starter Device Check");
  assert.equal(workspaceSystemCheckResults.items[0].status, "warning");
  assert.equal(workspaceSystemCheckResults.items[0].review.reviewStatus, "pending");
  assert.equal(workspaceSystemCheckResults.items[0].checkResults.audio.evidenceItems.length, 1);
  assert.equal(
    workspaceSystemCheckResults.items[0].checkResults.audio.evidenceItems[0].evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );

  const workspaceSystemCheckEvidence = await fetchJson<{
    evidence: {
      evidenceKey: string;
      systemCheckKey: string;
      checkKey: string;
      fileName: string;
      contentType: string;
      payloadPreviewText: string | null;
      storage: {
        payloadAvailability: string;
      };
      retention: {
        state: string;
        retentionClass: string;
        retentionPolicyKey: string;
        hold: {
          holdReasonCode: string;
          holdNote: string;
          heldByActorId: string;
        } | null;
        purgedAt: string | null;
        purgeReasonCode: string | null;
      };
    };
    accessGrant: {
      accessToken: string;
      evidenceKey: string;
      issuedFor: string;
      retrievalUrl: string;
      expiresAt: string;
    } | null;
  }>(
    apiRoutes.workspaceSystemCheckEvidence(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.equal(
    workspaceSystemCheckEvidence.evidence.evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(workspaceSystemCheckEvidence.evidence.checkKey, "audio");
  assert.equal(workspaceSystemCheckEvidence.evidence.fileName, "audio-check.log");
  assert.equal(workspaceSystemCheckEvidence.evidence.contentType, "text/plain");
  assert.equal(workspaceSystemCheckEvidence.evidence.storage.payloadAvailability, "available");
  assert.equal(workspaceSystemCheckEvidence.evidence.retention.state, "retained");
  assert.equal(workspaceSystemCheckEvidence.evidence.retention.retentionClass, "workspace_review");
  assert.equal(workspaceSystemCheckEvidence.evidence.retention.retentionPolicyKey, "spike_workspace_review");
  assert.equal(workspaceSystemCheckEvidence.evidence.retention.hold, null);
  assert.equal(workspaceSystemCheckEvidence.evidence.retention.purgedAt, null);
  assert.equal(workspaceSystemCheckEvidence.evidence.retention.purgeReasonCode, null);
  assert.equal(
    workspaceSystemCheckEvidence.evidence.payloadPreviewText,
    "audio-check-log: output device is quiet on default speakers"
  );
  assert.ok(workspaceSystemCheckEvidence.accessGrant);
  if (!workspaceSystemCheckEvidence.accessGrant) {
    throw new Error("Workspace evidence access grant should exist before retention purge.");
  }
  assert.equal(workspaceSystemCheckEvidence.accessGrant.evidenceKey, systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey);
  assert.equal(workspaceSystemCheckEvidence.accessGrant.issuedFor, "workspace_review");
  assert.ok(workspaceSystemCheckEvidence.accessGrant.expiresAt);

  const workspaceEvidenceAccessResponse = await fetchJson<{
    evidence: {
      evidenceKey: string;
    };
    accessGrant: {
      accessToken: string;
      issuedFor: string;
    };
    content: {
      payloadBase64: string;
      payloadPreviewText: string | null;
    };
  }>(workspaceSystemCheckEvidence.accessGrant.retrievalUrl);
  assert.equal(
    workspaceEvidenceAccessResponse.evidence.evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(
    workspaceEvidenceAccessResponse.accessGrant.accessToken,
    workspaceSystemCheckEvidence.accessGrant.accessToken
  );
  assert.equal(workspaceEvidenceAccessResponse.accessGrant.issuedFor, "workspace_review");
  assert.equal(workspaceEvidenceAccessResponse.content.payloadBase64, audioEvidencePayloadBase64);
  assert.equal(
    workspaceEvidenceAccessResponse.content.payloadPreviewText,
    "audio-check-log: output device is quiet on default speakers"
  );

  const earlyAuditReviewTenantEvidenceRetentionClassPolicy = await fetchJson<TenantEvidenceRetentionClassPolicyResponse>(
    apiRoutes.tenantEvidenceRetentionClassPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultEvidenceRetentionClassPolicy: {
          ...defaultTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy,
          holdReasons: [
            ...defaultTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons,
            {
              holdReasonCode: "audit_review",
              displayLabel: "Audit Review",
              workflowHint: "Route evidence into the audit review workflow before escalation.",
              severity: "medium",
              escalationTarget: "audit-ops",
              uiGroup: "audit",
              acknowledgementRequired: true,
              defaultAssigneeTarget: "audit-primary",
              slaSeconds: 43200
            },
            {
              holdReasonCode: "email_alert",
              displayLabel: "Email Alert",
              workflowHint: "Escalate evidence into the spike email delivery adapter with retry semantics.",
              severity: "high",
              escalationTarget: "profile:alerts-email-profile",
              uiGroup: "notifications",
              acknowledgementRequired: false,
              defaultAssigneeTarget: null,
              slaSeconds: 43200
            },
            {
              holdReasonCode: "email_dead_letter",
              displayLabel: "Email Dead Letter",
              workflowHint: "Escalate evidence into the email adapter with a permanent failure so dead-letter redrive can be exercised.",
              severity: "high",
              escalationTarget: "profile:dead-letter-email-profile",
              uiGroup: "notifications",
              acknowledgementRequired: false,
              defaultAssigneeTarget: null,
              slaSeconds: 43200
            }
          ],
          classes: defaultTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.classes.map(
            classEntry =>
              classEntry.retentionClass === "workspace_review"
                ? {
                    ...classEntry,
                    holdTransitions: [
                      ...classEntry.holdTransitions,
                      {
                        holdReasonCode: "audit_review",
                        targetRetentionClass: "operator_investigation"
                      },
                      {
                        holdReasonCode: "email_alert",
                        targetRetentionClass: "operator_investigation"
                      },
                      {
                        holdReasonCode: "email_dead_letter",
                        targetRetentionClass: "operator_investigation"
                      }
                    ]
                  }
                : classEntry
          )
        }
      })
    }
  );
  assert.ok(
    earlyAuditReviewTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons.some(
      holdReason => holdReason.holdReasonCode === "audit_review"
    )
  );
  assert.ok(
    earlyAuditReviewTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons.some(
      holdReason => holdReason.holdReasonCode === "email_alert"
    )
  );
  assert.ok(
    earlyAuditReviewTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons.some(
      holdReason => holdReason.holdReasonCode === "email_dead_letter"
    )
  );

  const heldWorkspaceSystemCheckEvidenceResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        state: string;
        retentionClass: string;
        retentionPolicyKey: string;
        hold: {
          holdReasonCode: string;
          holdNote: string;
          heldByActorId: string;
          acknowledgementRequired: boolean;
          acknowledgementStatus: string;
          defaultAssigneeTarget: string | null;
          assignmentStatus: string;
          assignedToActorId: string | null;
          assignedByActorId: string | null;
          assignedAt: string | null;
          assignmentNote: string | null;
          acknowledgedAt: string | null;
          acknowledgedByActorId: string | null;
          acknowledgementNote: string | null;
          slaSeconds: number | null;
          slaDueAt: string | null;
          slaStatus: string;
          escalationTarget: string | null;
          escalationStatus: string;
          escalatedAt: string | null;
          escalatedByActorId: string | null;
          escalationNote: string | null;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceHold(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        heldByActorId: "reviewer-a",
        holdReasonCode: "audit_review",
        holdNote: "Keep evidence available during manual follow-up."
      })
    }
  );
  const heldWorkspaceSystemCheckEvidenceRequestId = heldWorkspaceSystemCheckEvidenceResponse.headers.get("x-request-id");
  assert.ok(heldWorkspaceSystemCheckEvidenceRequestId);
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.state, "held");
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.retentionClass,
    "operator_investigation"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.retentionPolicyKey,
    "spike_operator_investigation"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.holdReasonCode,
    "audit_review"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.holdNote,
    "Keep evidence available during manual follow-up."
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.heldByActorId,
    "reviewer-a"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.acknowledgementRequired,
    true
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.acknowledgementStatus,
    "pending"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.defaultAssigneeTarget,
    "audit-primary"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignmentStatus,
    "assigned"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignedByActorId,
    "policy-default-assignment"
  );
  assert.ok(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignedAt
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignmentNote,
    "Assigned automatically from hold-reason default assignee target."
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.slaSeconds,
    43200
  );
  assert.ok(heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.slaDueAt);
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.slaStatus,
    "on_track"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.escalationTarget,
    "audit-ops"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.escalationStatus,
    "pending"
  );

  const assignedWorkspaceSystemCheckEvidenceResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        hold: {
          assignmentStatus: string;
          assignedToActorId: string | null;
          assignedByActorId: string | null;
          assignedAt: string | null;
          assignmentNote: string | null;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceAssignHold(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        assignedByActorId: "reviewer-lead",
        assignedToActorId: "audit-primary",
        assignmentNote: "Assigning to the audit queue owner."
      })
    }
  );
  const assignedWorkspaceSystemCheckEvidenceRequestId =
    assignedWorkspaceSystemCheckEvidenceResponse.headers.get("x-request-id");
  assert.ok(assignedWorkspaceSystemCheckEvidenceRequestId);
  assert.equal(
    assignedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignmentStatus,
    "assigned"
  );
  assert.equal(
    assignedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    assignedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignedByActorId,
    "reviewer-lead"
  );
  assert.ok(
    assignedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignedAt
  );
  assert.equal(
    assignedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.assignmentNote,
    "Assigning to the audit queue owner."
  );

  const acknowledgedWorkspaceSystemCheckEvidenceResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        hold: {
          acknowledgementStatus: string;
          acknowledgedAt: string | null;
          acknowledgedByActorId: string | null;
          acknowledgementNote: string | null;
          slaStatus: string;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceAcknowledgeHold(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        acknowledgedByActorId: "reviewer-lead",
        acknowledgementNote: "Audit queue owner confirmed follow-up."
      })
    }
  );
  const acknowledgedWorkspaceSystemCheckEvidenceRequestId =
    acknowledgedWorkspaceSystemCheckEvidenceResponse.headers.get("x-request-id");
  assert.ok(acknowledgedWorkspaceSystemCheckEvidenceRequestId);
  assert.equal(
    acknowledgedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.acknowledgementStatus,
    "acknowledged"
  );
  assert.ok(
    acknowledgedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.acknowledgedAt
  );
  assert.equal(
    acknowledgedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.acknowledgedByActorId,
    "reviewer-lead"
  );
  assert.equal(
    acknowledgedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.acknowledgementNote,
    "Audit queue owner confirmed follow-up."
  );
  assert.equal(
    acknowledgedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold?.slaStatus,
    "acknowledged"
  );

  const acknowledgedBreachQueueResponse = await fetchJson<{
    items: Array<{
      participantSessionId: string;
      contentReleaseId: string;
      loginKey: string;
      groupKey: string;
      breachQueueStatus: string;
      evidence: {
        evidenceKey: string;
        retention: {
          hold: {
            escalationTarget: string | null;
            assignedToActorId: string | null;
            acknowledgementStatus: string;
          } | null;
        };
      };
    }>;
    filters: {
      groupKey: string | null;
      escalationTarget: string | null;
      breachQueueStatus: string | null;
      assignedToActorId: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckEvidenceBreachQueue(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&escalationTarget=audit-ops&breachQueueStatus=acknowledged&assignedToActorId=audit-primary&limit=20`
  );
  const acknowledgedBreachQueueItem = acknowledgedBreachQueueResponse.items.find(item =>
    item.evidence.evidenceKey === systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.ok(acknowledgedBreachQueueItem);
  assert.equal(acknowledgedBreachQueueResponse.filters.groupKey, "group-alpha");
  assert.equal(acknowledgedBreachQueueResponse.filters.escalationTarget, "audit-ops");
  assert.equal(acknowledgedBreachQueueResponse.filters.breachQueueStatus, "acknowledged");
  assert.equal(acknowledgedBreachQueueResponse.filters.assignedToActorId, "audit-primary");
  assert.equal(acknowledgedBreachQueueItem?.participantSessionId, participantSessionId);
  assert.equal(acknowledgedBreachQueueItem?.contentReleaseId, baselineContentReleaseId);
  assert.equal(acknowledgedBreachQueueItem?.loginKey, "alpha-001");
  assert.equal(acknowledgedBreachQueueItem?.groupKey, "group-alpha");
  assert.equal(acknowledgedBreachQueueItem?.breachQueueStatus, "acknowledged");
  assert.equal(
    acknowledgedBreachQueueItem?.evidence.retention.hold?.escalationTarget,
    "audit-ops"
  );
  assert.equal(
    acknowledgedBreachQueueItem?.evidence.retention.hold?.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    acknowledgedBreachQueueItem?.evidence.retention.hold?.acknowledgementStatus,
    "acknowledged"
  );

  await expireSystemCheckEvidenceRetention(systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey);
  await delay(1_500);

  const heldPersistedEvidence = await getPersistedSystemCheckEvidence(
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.ok(heldPersistedEvidence);
  assert.equal(heldPersistedEvidence?.payloadBase64, null, "Filesystem-backed evidence should not keep inline payload bytes.");
  assert.equal(
    heldPersistedEvidence?.payloadPreviewText,
    "audio-check-log: output device is quiet on default speakers"
  );
  assert.ok(heldPersistedEvidence?.storageLocator);
  assert.equal(heldPersistedEvidence?.retentionHold?.holdReasonCode, "audit_review");
  assert.equal(heldPersistedEvidence?.retentionHold?.heldByActorId, "reviewer-a");
  assert.equal(heldPersistedEvidence?.retentionHold?.assignedToActorId, "audit-primary");
  assert.equal(heldPersistedEvidence?.retentionHold?.assignedByActorId, "reviewer-lead");
  assert.equal(heldPersistedEvidence?.retentionHold?.acknowledgedByActorId, "reviewer-lead");
  assert.equal(heldPersistedEvidence?.retentionHold?.escalationTarget, "audit-ops");
  assert.equal(heldPersistedEvidence?.retentionHold?.escalatedAt, null);
  assert.equal(
    heldPersistedEvidence?.retentionHold?.acknowledgementNote,
    "Audit queue owner confirmed follow-up."
  );
  assert.equal(heldPersistedEvidence?.purgedAt, null);
  assert.equal(heldPersistedEvidence?.purgeReasonCode, null);

  const heldWorkspaceSystemCheckEvidence = await fetchJson<{
    evidence: {
      evidenceKey: string;
      storage: {
        payloadAvailability: string;
      };
      retention: {
        state: string;
        retentionClass: string;
        retentionPolicyKey: string;
        hold: {
          holdReasonCode: string;
          holdNote: string;
          heldByActorId: string;
          acknowledgementStatus: string;
          assignedToActorId: string | null;
          assignedByActorId: string | null;
          acknowledgedByActorId: string | null;
          slaStatus: string;
          escalationStatus: string;
          escalatedAt: string | null;
          escalatedByActorId: string | null;
        } | null;
        purgedAt: string | null;
      };
    };
    accessGrant: {
      accessToken: string;
      retrievalUrl: string;
    } | null;
  }>(
    apiRoutes.workspaceSystemCheckEvidence(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.equal(heldWorkspaceSystemCheckEvidence.evidence.retention.state, "held");
  assert.equal(heldWorkspaceSystemCheckEvidence.evidence.retention.retentionClass, "operator_investigation");
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.retentionPolicyKey,
    "spike_operator_investigation"
  );
  assert.equal(heldWorkspaceSystemCheckEvidence.evidence.storage.payloadAvailability, "available");
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.holdReasonCode,
    "audit_review"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.acknowledgementStatus,
    "acknowledged"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.assignedByActorId,
    "reviewer-lead"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.acknowledgedByActorId,
    "reviewer-lead"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.slaStatus,
    "acknowledged"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.escalationStatus,
    "acknowledged"
  );
  assert.equal(
    heldWorkspaceSystemCheckEvidence.evidence.retention.hold?.escalatedAt,
    null
  );
  assert.equal(heldWorkspaceSystemCheckEvidence.evidence.retention.purgedAt, null);
  assert.ok(heldWorkspaceSystemCheckEvidence.accessGrant);

  const heldEvidenceRetentionHistory = await fetchJson<{
    items: Array<{
      eventType: string;
      stateAfter: string;
      actorId: string;
      details: {
        retentionClass: string | null;
        retentionPolicyKey: string | null;
        holdReasonCode: string | null;
        holdNote: string | null;
        acknowledgementRequired: boolean | null;
        acknowledgementStatus: string | null;
        acknowledgedAt: string | null;
        acknowledgedByActorId: string | null;
        acknowledgementNote: string | null;
        defaultAssigneeTarget: string | null;
        assignmentStatus: string | null;
        assignedToActorId: string | null;
        assignedByActorId: string | null;
        assignedAt: string | null;
        assignmentNote: string | null;
        slaSeconds: number | null;
        slaDueAt: string | null;
        slaStatus: string | null;
        escalationTarget: string | null;
        escalationStatus: string | null;
        escalatedAt: string | null;
        escalatedByActorId: string | null;
        escalationNote: string | null;
        releaseNote: string | null;
        purgeReasonCode: string | null;
        retentionExpiresAt: string | null;
      };
    }>;
  }>(
    apiRoutes.workspaceSystemCheckEvidenceRetentionHistory(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.deepEqual(
    heldEvidenceRetentionHistory.items.slice(0, 4).map(item => item.eventType),
    ["hold_acknowledged", "hold_assigned", "hold_applied", "captured"]
  );
  assert.equal(heldEvidenceRetentionHistory.items[0].stateAfter, "held");
  assert.equal(heldEvidenceRetentionHistory.items[0].actorId, "reviewer-lead");
  assert.equal(
    heldEvidenceRetentionHistory.items[0].details.acknowledgementStatus,
    "acknowledged"
  );
  assert.equal(
    heldEvidenceRetentionHistory.items[0].details.acknowledgedByActorId,
    "reviewer-lead"
  );
  assert.equal(
    heldEvidenceRetentionHistory.items[0].details.acknowledgementNote,
    "Audit queue owner confirmed follow-up."
  );
  assert.equal(heldEvidenceRetentionHistory.items[1].stateAfter, "held");
  assert.equal(heldEvidenceRetentionHistory.items[1].actorId, "reviewer-lead");
  assert.equal(heldEvidenceRetentionHistory.items[1].details.assignmentStatus, "assigned");
  assert.equal(
    heldEvidenceRetentionHistory.items[1].details.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    heldEvidenceRetentionHistory.items[1].details.assignmentNote,
    "Assigning to the audit queue owner."
  );
  assert.equal(heldEvidenceRetentionHistory.items[2].stateAfter, "held");
  assert.equal(heldEvidenceRetentionHistory.items[2].actorId, "reviewer-a");
  assert.equal(heldEvidenceRetentionHistory.items[2].details.retentionClass, "operator_investigation");
  assert.equal(
    heldEvidenceRetentionHistory.items[2].details.retentionPolicyKey,
    "spike_operator_investigation"
  );
  assert.equal(heldEvidenceRetentionHistory.items[2].details.holdReasonCode, "audit_review");
  assert.equal(
    heldEvidenceRetentionHistory.items[2].details.holdNote,
    "Keep evidence available during manual follow-up."
  );
  assert.equal(heldEvidenceRetentionHistory.items[2].details.acknowledgementRequired, true);
  assert.equal(
    heldEvidenceRetentionHistory.items[2].details.defaultAssigneeTarget,
    "audit-primary"
  );
  assert.equal(heldEvidenceRetentionHistory.items[2].details.slaSeconds, 43200);
  assert.ok(heldEvidenceRetentionHistory.items[2].details.slaDueAt);
  assert.equal(heldEvidenceRetentionHistory.items[2].details.slaStatus, "on_track");
  assert.equal(heldEvidenceRetentionHistory.items[2].details.escalationTarget, "audit-ops");
  assert.equal(heldEvidenceRetentionHistory.items[2].details.escalationStatus, "pending");
  assert.ok(heldEvidenceRetentionHistory.items[3].details.retentionExpiresAt);

  const currentTenantEvidenceRetentionClassPolicy = await fetchJson<{
    defaultEvidenceRetentionClassPolicy: {
      holdReasons: Array<{
        holdReasonCode: string;
        displayLabel: string;
        workflowHint: string | null;
        severity: string;
        escalationTarget: string | null;
        uiGroup: string | null;
        acknowledgementRequired: boolean;
        defaultAssigneeTarget: string | null;
        slaSeconds: number | null;
      }>;
      defaultCaptureRetentionClass: string;
      classes: Array<{
        retentionClass: string;
        retentionPolicyKey: string;
        ttlFieldKey: string;
        manualHoldAllowed: boolean;
        payloadAccessGrantsAllowed: boolean;
        holdTransitions: Array<{
          holdReasonCode: string;
          targetRetentionClass: string;
        }>;
      }>;
    };
  }>(apiRoutes.tenantEvidenceRetentionClassPolicy(demoTenantKey));

  await fetchJsonResponse(
    apiRoutes.tenantEvidenceRetentionClassPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultEvidenceRetentionClassPolicy: {
          ...currentTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy,
          holdReasons: currentTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.holdReasons.map(
            holdReason =>
              holdReason.holdReasonCode === "audit_review" ||
              holdReason.holdReasonCode === "email_alert" ||
              holdReason.holdReasonCode === "email_dead_letter"
                ? {
                    ...holdReason,
                    slaSeconds: 1
                  }
                : holdReason
          )
        }
      })
    }
  );

  const escalationEvidenceCaptureResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
    };
  }>(apiRoutes.participantSystemCheckEvidenceCapture, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkKey: "audio",
      fileName: "audio-check-escalation.log",
      contentType: "text/plain",
      payloadBase64: Buffer
        .from("audio-check-log: escalation scenario evidence payload", "utf-8")
        .toString("base64")
    })
  }, 201);

  const escalatedEvidenceHoldResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        hold: {
          assignmentStatus: string;
          assignedToActorId: string | null;
          assignedByActorId: string | null;
          escalationStatus: string;
          escalationTarget: string | null;
          escalatedAt: string | null;
          escalatedByActorId: string | null;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceHold(
      demoTenantKey,
      demoWorkspaceKey,
      escalationEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        heldByActorId: "reviewer-c",
        holdReasonCode: "audit_review",
        holdNote: "Escalation scenario pending acknowledgement."
      })
    }
  );
  assert.equal(
    escalatedEvidenceHoldResponse.body.evidence.retention.hold?.assignmentStatus,
    "assigned"
  );
  assert.equal(
    escalatedEvidenceHoldResponse.body.evidence.retention.hold?.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    escalatedEvidenceHoldResponse.body.evidence.retention.hold?.assignedByActorId,
    "policy-default-assignment"
  );
  assert.equal(
    escalatedEvidenceHoldResponse.body.evidence.retention.hold?.escalationStatus,
    "pending"
  );
  assert.equal(
    escalatedEvidenceHoldResponse.body.evidence.retention.hold?.escalationTarget,
    "audit-ops"
  );
  assert.equal(
    escalatedEvidenceHoldResponse.body.evidence.retention.hold?.escalatedAt,
    null
  );

  const escalatedHoldQueueResult = await retry(async () => {
    const currentHoldQueueResponse = await fetchJson<{
      items: Array<{
        participantSessionId: string;
        contentReleaseId: string;
        loginKey: string;
        groupKey: string;
        evidence: {
          evidenceKey: string;
          retention: {
            hold: {
              acknowledgementStatus: string;
              assignmentStatus: string;
              escalationStatus: string;
              escalationTarget: string | null;
              escalatedAt: string | null;
              escalatedByActorId: string | null;
              escalationNote: string | null;
              slaStatus: string;
            } | null;
          };
        };
      }>;
      filters: {
        groupKey: string | null;
        holdReasonCode: string | null;
        acknowledgementStatus: string | null;
        assignmentStatus: string | null;
        escalationStatus: string | null;
      };
    }>(
      `${apiRoutes.workspaceSystemCheckEvidenceHoldQueue(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&holdReasonCode=audit_review&limit=20`
    );
    const queueItem = currentHoldQueueResponse.items.find(item =>
      item.evidence.evidenceKey === escalationEvidenceCaptureResponse.body.evidence.evidenceKey
    );

    assert.ok(queueItem, "Escalated evidence should appear in the workspace hold queue.");
    assert.equal(
      queueItem.evidence.retention.hold?.escalationStatus,
      "escalated",
      "Escalated evidence should reach escalated hold status."
    );

    return {
      currentHoldQueueResponse,
      queueItem
    };
  }, 100, 250);
  const escalatedHoldQueueItem = escalatedHoldQueueResult.queueItem;
  if (!escalatedHoldQueueItem) {
    throw new Error("Escalated hold queue item should exist.");
  }
  const escalatedHoldQueueHold = escalatedHoldQueueItem.evidence.retention.hold;
  if (!escalatedHoldQueueHold) {
    throw new Error("Escalated hold queue item should include hold metadata.");
  }
  assert.equal(escalatedHoldQueueResult.currentHoldQueueResponse.filters.groupKey, "group-alpha");
  assert.equal(escalatedHoldQueueResult.currentHoldQueueResponse.filters.holdReasonCode, "audit_review");
  assert.equal(escalatedHoldQueueResult.currentHoldQueueResponse.filters.acknowledgementStatus, null);
  assert.equal(escalatedHoldQueueResult.currentHoldQueueResponse.filters.assignmentStatus, null);
  assert.equal(escalatedHoldQueueResult.currentHoldQueueResponse.filters.escalationStatus, null);
  assert.equal(escalatedHoldQueueItem.participantSessionId, participantSessionId);
  assert.equal(escalatedHoldQueueItem.contentReleaseId, baselineContentReleaseId);
  assert.equal(escalatedHoldQueueItem.loginKey, "alpha-001");
  assert.equal(escalatedHoldQueueItem.groupKey, "group-alpha");
  assert.equal(
    escalatedHoldQueueHold.acknowledgementStatus,
    "pending"
  );
  assert.equal(
    escalatedHoldQueueHold.assignmentStatus,
    "assigned"
  );
  assert.equal(
    escalatedHoldQueueHold.escalationStatus,
    "escalated"
  );
  assert.equal(
    escalatedHoldQueueHold.escalationTarget,
    "audit-ops"
  );
  assert.ok(escalatedHoldQueueHold.escalatedAt);
  assert.equal(
    escalatedHoldQueueHold.escalatedByActorId,
    "maintenance-sla-escalation"
  );
  assert.equal(
    escalatedHoldQueueHold.slaStatus,
    "breached"
  );
  assert.match(
    escalatedHoldQueueHold.escalationNote ?? "",
    /SLA elapsed/
  );

  const escalatedBreachQueueResponse = await retry(async () => {
    const currentBreachQueueResponse = await fetchJson<{
      items: Array<{
        participantSessionId: string;
        contentReleaseId: string;
        loginKey: string;
        groupKey: string;
        breachQueueStatus: string;
        evidence: {
          evidenceKey: string;
          retention: {
            hold: {
              escalationTarget: string | null;
              assignedToActorId: string | null;
              escalatedByActorId: string | null;
            } | null;
          };
        };
      }>;
      filters: {
        groupKey: string | null;
        escalationTarget: string | null;
        breachQueueStatus: string | null;
        assignedToActorId: string | null;
      };
    }>(
      `${apiRoutes.workspaceSystemCheckEvidenceBreachQueue(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&escalationTarget=audit-ops&breachQueueStatus=escalated&assignedToActorId=audit-primary&limit=20`
    );
    const item = currentBreachQueueResponse.items.find(candidate =>
      candidate.evidence.evidenceKey === escalationEvidenceCaptureResponse.body.evidence.evidenceKey
    );

    assert.ok(item, "Escalated evidence should appear in the workspace breach queue.");

    return {
      currentBreachQueueResponse,
      item
    };
  }, 60, 250);
  const escalatedBreachQueueItem = escalatedBreachQueueResponse.item;
  assert.ok(escalatedBreachQueueItem);
  assert.equal(escalatedBreachQueueResponse.currentBreachQueueResponse.filters.groupKey, "group-alpha");
  assert.equal(
    escalatedBreachQueueResponse.currentBreachQueueResponse.filters.escalationTarget,
    "audit-ops"
  );
  assert.equal(
    escalatedBreachQueueResponse.currentBreachQueueResponse.filters.breachQueueStatus,
    "escalated"
  );
  assert.equal(
    escalatedBreachQueueResponse.currentBreachQueueResponse.filters.assignedToActorId,
    "audit-primary"
  );
  assert.equal(escalatedBreachQueueItem?.participantSessionId, participantSessionId);
  assert.equal(escalatedBreachQueueItem?.contentReleaseId, baselineContentReleaseId);
  assert.equal(escalatedBreachQueueItem?.loginKey, "alpha-001");
  assert.equal(escalatedBreachQueueItem?.groupKey, "group-alpha");
  assert.equal(escalatedBreachQueueItem?.breachQueueStatus, "escalated");
  assert.equal(
    escalatedBreachQueueItem?.evidence.retention.hold?.escalationTarget,
    "audit-ops"
  );
  assert.equal(
    escalatedBreachQueueItem?.evidence.retention.hold?.assignedToActorId,
    "audit-primary"
  );
  assert.equal(
    escalatedBreachQueueItem?.evidence.retention.hold?.escalatedByActorId,
    "maintenance-sla-escalation"
  );

  const escalatedBreachNotificationsResponse = await retry(async () => {
    const currentNotificationResponse = await fetchJson<{
      items: Array<{
        notificationId: string;
        participantSessionId: string;
        contentReleaseId: string;
        loginKey: string;
        groupKey: string;
        holdReasonCode: string;
        escalationTarget: string | null;
        assignedToActorId: string | null;
        notificationChannel: string;
        status: string;
        createdAt: string;
        createdByActorType: string;
        createdByActorId: string;
        sourceRequestId: string | null;
        delivery: {
          channel: string;
          status: string;
          target: string | null;
          attemptCount: number;
          maxAttempts: number;
          nextAttemptAt: string | null;
          lastAttemptAt: string | null;
          deliveredAt: string | null;
          receiptId: string | null;
          receiptIssuedAt: string | null;
          lastError: string | null;
        };
        acknowledgedAt: string | null;
        acknowledgedByActorId: string | null;
        acknowledgementNote: string | null;
        evidence: {
          evidenceKey: string;
          retention: {
            hold: {
              escalationStatus: string;
            } | null;
          };
        };
      }>;
      filters: {
        groupKey: string | null;
        escalationTarget: string | null;
        status: string | null;
        deliveryStatus: string | null;
        assignedToActorId: string | null;
      };
    }>(
      `${apiRoutes.workspaceSystemCheckEvidenceBreachNotifications(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&escalationTarget=audit-ops&status=pending_acknowledgement&deliveryStatus=delivered&assignedToActorId=audit-primary&limit=20`
    );
    const item = currentNotificationResponse.items.find(candidate =>
      candidate.evidence.evidenceKey === escalationEvidenceCaptureResponse.body.evidence.evidenceKey
    );

    assert.ok(item, "Escalated evidence should create a persisted breach notification.");

    return {
      currentNotificationResponse,
      item
    };
  }, 60, 250);
  const escalatedBreachNotificationItem = escalatedBreachNotificationsResponse.item;
  assert.equal(escalatedBreachNotificationsResponse.currentNotificationResponse.filters.groupKey, "group-alpha");
  assert.equal(
    escalatedBreachNotificationsResponse.currentNotificationResponse.filters.escalationTarget,
    "audit-ops"
  );
  assert.equal(
    escalatedBreachNotificationsResponse.currentNotificationResponse.filters.status,
    "pending_acknowledgement"
  );
  assert.equal(
    escalatedBreachNotificationsResponse.currentNotificationResponse.filters.deliveryStatus,
    "delivered"
  );
  assert.equal(
    escalatedBreachNotificationsResponse.currentNotificationResponse.filters.assignedToActorId,
    "audit-primary"
  );
  assert.equal(escalatedBreachNotificationItem.participantSessionId, participantSessionId);
  assert.equal(escalatedBreachNotificationItem.contentReleaseId, baselineContentReleaseId);
  assert.equal(escalatedBreachNotificationItem.loginKey, "alpha-001");
  assert.equal(escalatedBreachNotificationItem.groupKey, "group-alpha");
  assert.equal(escalatedBreachNotificationItem.holdReasonCode, "audit_review");
  assert.equal(escalatedBreachNotificationItem.escalationTarget, "audit-ops");
  assert.equal(escalatedBreachNotificationItem.assignedToActorId, "audit-primary");
  assert.equal(escalatedBreachNotificationItem.notificationChannel, "workspace_queue");
  assert.equal(escalatedBreachNotificationItem.status, "pending_acknowledgement");
  assert.equal(escalatedBreachNotificationItem.createdByActorType, "worker");
  assert.equal(escalatedBreachNotificationItem.createdByActorId, "maintenance-worker");
  assert.match(
    escalatedBreachNotificationItem.sourceRequestId ?? "",
    /^worker-system-check-evidence-hold-escalation-/
  );
  assert.equal(escalatedBreachNotificationItem.acknowledgedAt, null);
  assert.equal(escalatedBreachNotificationItem.acknowledgedByActorId, null);
  assert.equal(escalatedBreachNotificationItem.acknowledgementNote, null);
  assert.equal(escalatedBreachNotificationItem.delivery.channel, "webhook_spike");
  assert.equal(escalatedBreachNotificationItem.delivery.status, "delivered");
  assert.equal(escalatedBreachNotificationItem.delivery.target, "audit-ops");
  assert.equal(escalatedBreachNotificationItem.delivery.attemptCount, 1);
  assert.ok(
    [4, 5].includes(escalatedBreachNotificationItem.delivery.maxAttempts)
  );
  assert.equal(escalatedBreachNotificationItem.delivery.nextAttemptAt, null);
  assert.ok(escalatedBreachNotificationItem.delivery.lastAttemptAt);
  assert.ok(escalatedBreachNotificationItem.delivery.deliveredAt);
  assert.ok(escalatedBreachNotificationItem.delivery.receiptId);
  assert.ok(escalatedBreachNotificationItem.delivery.receiptIssuedAt);
  assert.equal(escalatedBreachNotificationItem.delivery.lastError, null);
  assert.equal(
    escalatedBreachNotificationItem.evidence.retention.hold?.escalationStatus,
    "escalated"
  );

  const acknowledgedBreachNotificationResponse = await fetchJsonResponse<{
    notification: {
      notificationId: string;
      status: string;
      acknowledgedAt: string | null;
      acknowledgedByActorId: string | null;
      acknowledgementNote: string | null;
      evidence: {
        evidenceKey: string;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceBreachNotificationAcknowledge(
      demoTenantKey,
      demoWorkspaceKey,
      escalatedBreachNotificationItem.notificationId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        acknowledgedByActorId: "audit-lead",
        acknowledgementNote: "Acknowledged from the workspace breach notification queue."
      })
    }
  );
  const acknowledgedBreachNotificationRequestId = acknowledgedBreachNotificationResponse.headers.get("x-request-id");
  assert.ok(acknowledgedBreachNotificationRequestId);
  assert.equal(
    acknowledgedBreachNotificationResponse.body.notification.notificationId,
    escalatedBreachNotificationItem.notificationId
  );
  assert.equal(acknowledgedBreachNotificationResponse.body.notification.status, "acknowledged");
  assert.ok(acknowledgedBreachNotificationResponse.body.notification.acknowledgedAt);
  assert.equal(
    acknowledgedBreachNotificationResponse.body.notification.acknowledgedByActorId,
    "audit-lead"
  );
  assert.equal(
    acknowledgedBreachNotificationResponse.body.notification.acknowledgementNote,
    "Acknowledged from the workspace breach notification queue."
  );
  assert.equal(
    acknowledgedBreachNotificationResponse.body.notification.evidence.evidenceKey,
    escalationEvidenceCaptureResponse.body.evidence.evidenceKey
  );

  const acknowledgedBreachNotificationsResponse = await fetchJson<{
    items: Array<{
      notificationId: string;
      status: string;
      delivery: {
        status: string;
      };
      acknowledgedByActorId: string | null;
    }>;
    filters: {
      groupKey: string | null;
      escalationTarget: string | null;
      status: string | null;
      deliveryStatus: string | null;
      assignedToActorId: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckEvidenceBreachNotifications(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&escalationTarget=audit-ops&status=acknowledged&deliveryStatus=delivered&assignedToActorId=audit-primary&limit=20`
  );
  const acknowledgedBreachNotificationItem = acknowledgedBreachNotificationsResponse.items.find(item =>
    item.notificationId === escalatedBreachNotificationItem.notificationId
  );
  assert.ok(acknowledgedBreachNotificationItem);
  assert.equal(acknowledgedBreachNotificationsResponse.filters.status, "acknowledged");
  assert.equal(acknowledgedBreachNotificationsResponse.filters.deliveryStatus, "delivered");
  assert.equal(acknowledgedBreachNotificationItem?.status, "acknowledged");
  assert.equal(acknowledgedBreachNotificationItem?.delivery.status, "delivered");
  assert.equal(acknowledgedBreachNotificationItem?.acknowledgedByActorId, "audit-lead");

  const emailAlertEvidencePayloadBase64 = Buffer
    .from("email-alert-check-log: retry the outbound notification once before success", "utf-8")
    .toString("base64");
  const emailAlertEvidenceCaptureResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      systemCheckKey: string;
      checkKey: string;
      fileName: string;
    };
  }>(apiRoutes.participantSystemCheckEvidenceCapture, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkKey: "audio",
      fileName: "email-alert-check.log",
      contentType: "text/plain",
      payloadBase64: emailAlertEvidencePayloadBase64
    })
  }, 201);
  assert.equal(emailAlertEvidenceCaptureResponse.body.evidence.systemCheckKey, "SC-BASELINE");
  assert.equal(emailAlertEvidenceCaptureResponse.body.evidence.checkKey, "audio");
  assert.equal(emailAlertEvidenceCaptureResponse.body.evidence.fileName, "email-alert-check.log");

  const emailAlertHeldResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        hold: {
          holdReasonCode: string;
          escalationTarget: string | null;
          acknowledgementRequired: boolean;
          assignmentStatus: string;
          assignedToActorId: string | null;
          escalationStatus: string;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceHold(
      demoTenantKey,
      demoWorkspaceKey,
      emailAlertEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        heldByActorId: "reviewer-email",
        holdReasonCode: "email_alert",
        holdNote: "Route this evidence through the email delivery adapter with retry."
      })
    }
  );
  assert.equal(
    emailAlertHeldResponse.body.evidence.retention.hold?.holdReasonCode,
    "email_alert"
  );
  assert.equal(
    emailAlertHeldResponse.body.evidence.retention.hold?.escalationTarget,
    "profile:alerts-email-profile"
  );
  assert.equal(
    emailAlertHeldResponse.body.evidence.retention.hold?.acknowledgementRequired,
    false
  );
  assert.equal(
    emailAlertHeldResponse.body.evidence.retention.hold?.assignmentStatus,
    "unassigned"
  );
  assert.equal(
    emailAlertHeldResponse.body.evidence.retention.hold?.assignedToActorId,
    null
  );
  assert.equal(
    emailAlertHeldResponse.body.evidence.retention.hold?.escalationStatus,
    "pending"
  );

  const deliveredEmailAlertNotificationResponse = await retry(async () => {
    const currentNotificationResponse = await fetchJson<{
      items: Array<{
        notificationId: string;
        holdReasonCode: string;
        notificationChannel: string;
        status: string;
        deliveryProfileKey: string | null;
        delivery: {
          channel: string;
          status: string;
          target: string | null;
          attemptCount: number;
          maxAttempts: number;
          nextAttemptAt: string | null;
          lastAttemptAt: string | null;
          deliveredAt: string | null;
          receiptId: string | null;
          receiptIssuedAt: string | null;
          lastError: string | null;
        };
        evidence: {
          evidenceKey: string;
        };
      }>;
      filters: {
        groupKey: string | null;
        escalationTarget: string | null;
        status: string | null;
        deliveryStatus: string | null;
        assignedToActorId: string | null;
      };
    }>(
      `${apiRoutes.workspaceSystemCheckEvidenceBreachNotifications(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&status=pending_acknowledgement&deliveryStatus=delivered&limit=50`
    );
    const item = currentNotificationResponse.items.find(candidate =>
      candidate.evidence.evidenceKey === emailAlertEvidenceCaptureResponse.body.evidence.evidenceKey
    );

    assert.ok(item, "Email-adapter evidence should create a delivered breach notification after retry.");

    return {
      currentNotificationResponse,
      item
    };
  }, 40, 250);
  const deliveredEmailAlertNotificationItem = deliveredEmailAlertNotificationResponse.item;
  assert.equal(deliveredEmailAlertNotificationResponse.currentNotificationResponse.filters.groupKey, "group-alpha");
  assert.equal(deliveredEmailAlertNotificationResponse.currentNotificationResponse.filters.status, "pending_acknowledgement");
  assert.equal(deliveredEmailAlertNotificationResponse.currentNotificationResponse.filters.deliveryStatus, "delivered");
  assert.equal(deliveredEmailAlertNotificationItem.holdReasonCode, "email_alert");
  assert.equal(deliveredEmailAlertNotificationItem.notificationChannel, "workspace_queue");
  assert.equal(deliveredEmailAlertNotificationItem.status, "pending_acknowledgement");
  assert.equal(deliveredEmailAlertNotificationItem.deliveryProfileKey, "alerts-email-profile");
  assert.equal(deliveredEmailAlertNotificationItem.delivery.channel, "email_spike");
  assert.equal(deliveredEmailAlertNotificationItem.delivery.status, "delivered");
  assert.equal(deliveredEmailAlertNotificationItem.delivery.target, "workspace-alerts@example.test");
  assert.equal(deliveredEmailAlertNotificationItem.delivery.attemptCount, 2);
  assert.equal(deliveredEmailAlertNotificationItem.delivery.maxAttempts, 6);
  assert.equal(deliveredEmailAlertNotificationItem.delivery.nextAttemptAt, null);
  assert.ok(deliveredEmailAlertNotificationItem.delivery.lastAttemptAt);
  assert.ok(deliveredEmailAlertNotificationItem.delivery.deliveredAt);
  assert.ok(deliveredEmailAlertNotificationItem.delivery.receiptId);
  assert.ok(deliveredEmailAlertNotificationItem.delivery.receiptIssuedAt);
  assert.equal(deliveredEmailAlertNotificationItem.delivery.lastError, null);

  const deadLetterEvidencePayloadBase64 = Buffer
    .from("dead-letter-check-log: force a permanent outbound failure before operator redrive", "utf-8")
    .toString("base64");
  const deadLetterEvidenceCaptureResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      systemCheckKey: string;
      checkKey: string;
      fileName: string;
    };
  }>(apiRoutes.participantSystemCheckEvidenceCapture, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkKey: "audio",
      fileName: "dead-letter-check.log",
      contentType: "text/plain",
      payloadBase64: deadLetterEvidencePayloadBase64
    })
  }, 201);
  assert.equal(deadLetterEvidenceCaptureResponse.body.evidence.systemCheckKey, "SC-BASELINE");
  assert.equal(deadLetterEvidenceCaptureResponse.body.evidence.checkKey, "audio");
  assert.equal(deadLetterEvidenceCaptureResponse.body.evidence.fileName, "dead-letter-check.log");

  const deadLetterHeldResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        hold: {
          holdReasonCode: string;
          escalationTarget: string | null;
          acknowledgementRequired: boolean;
          assignmentStatus: string;
          assignedToActorId: string | null;
          escalationStatus: string;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceHold(
      demoTenantKey,
      demoWorkspaceKey,
      deadLetterEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        heldByActorId: "reviewer-dead-letter",
        holdReasonCode: "email_dead_letter",
        holdNote: "Force a permanent email delivery failure so the dead-letter queue can be redriven."
      })
    }
  );
  assert.equal(
    deadLetterHeldResponse.body.evidence.retention.hold?.holdReasonCode,
    "email_dead_letter"
  );
  assert.equal(
    deadLetterHeldResponse.body.evidence.retention.hold?.escalationTarget,
    "profile:dead-letter-email-profile"
  );
  assert.equal(
    deadLetterHeldResponse.body.evidence.retention.hold?.acknowledgementRequired,
    false
  );
  assert.equal(
    deadLetterHeldResponse.body.evidence.retention.hold?.assignmentStatus,
    "unassigned"
  );
  assert.equal(
    deadLetterHeldResponse.body.evidence.retention.hold?.assignedToActorId,
    null
  );
  assert.equal(
    deadLetterHeldResponse.body.evidence.retention.hold?.escalationStatus,
    "pending"
  );

  const deadLetterQueueResult = await retry(async () => {
    const currentDeadLetterQueueResponse = await fetchJson<{
      items: Array<{
        notificationId: string;
        holdReasonCode: string;
        notificationChannel: string;
        status: string;
        escalationTarget: string | null;
        assignedToActorId: string | null;
        deliveryProfileKey: string | null;
        delivery: {
          channel: string;
          status: string;
          target: string | null;
          attemptCount: number;
          maxAttempts: number;
          nextAttemptAt: string | null;
          lastAttemptAt: string | null;
          deliveredAt: string | null;
          receiptId: string | null;
          receiptIssuedAt: string | null;
          lastError: string | null;
        };
        evidence: {
          evidenceKey: string;
        };
      }>;
      filters: {
        groupKey: string | null;
        escalationTarget: string | null;
        status: string | null;
        deliveryChannel: string | null;
        assignedToActorId: string | null;
      };
    }>(
      `${apiRoutes.workspaceSystemCheckEvidenceBreachDeadLetterQueue(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&escalationTarget=profile%3Adead-letter-email-profile&status=pending_acknowledgement&deliveryChannel=email_spike&limit=20`
    );
    const item = currentDeadLetterQueueResponse.items.find(candidate =>
      candidate.evidence.evidenceKey === deadLetterEvidenceCaptureResponse.body.evidence.evidenceKey
    );

    assert.ok(item, "Permanently failed email evidence should appear in the breach dead-letter queue.");

    return {
      currentDeadLetterQueueResponse,
      item
    };
  }, 40, 250);
  const deadLetterQueueItem = deadLetterQueueResult.item;
  assert.equal(deadLetterQueueResult.currentDeadLetterQueueResponse.filters.groupKey, "group-alpha");
  assert.equal(
    deadLetterQueueResult.currentDeadLetterQueueResponse.filters.escalationTarget,
    "profile:dead-letter-email-profile"
  );
  assert.equal(deadLetterQueueResult.currentDeadLetterQueueResponse.filters.status, "pending_acknowledgement");
  assert.equal(deadLetterQueueResult.currentDeadLetterQueueResponse.filters.deliveryChannel, "email_spike");
  assert.equal(deadLetterQueueResult.currentDeadLetterQueueResponse.filters.assignedToActorId, null);
  assert.equal(deadLetterQueueItem.holdReasonCode, "email_dead_letter");
  assert.equal(deadLetterQueueItem.notificationChannel, "workspace_queue");
  assert.equal(deadLetterQueueItem.status, "pending_acknowledgement");
  assert.equal(deadLetterQueueItem.escalationTarget, "profile:dead-letter-email-profile");
  assert.equal(deadLetterQueueItem.assignedToActorId, null);
  assert.equal(deadLetterQueueItem.deliveryProfileKey, "dead-letter-email-profile");
  assert.equal(deadLetterQueueItem.delivery.channel, "email_spike");
  assert.equal(deadLetterQueueItem.delivery.status, "delivery_failed");
  assert.equal(deadLetterQueueItem.delivery.target, "dead-letter@example.test");
  assert.equal(deadLetterQueueItem.delivery.attemptCount, 1);
  assert.equal(deadLetterQueueItem.delivery.maxAttempts, 6);
  assert.equal(deadLetterQueueItem.delivery.nextAttemptAt, null);
  assert.ok(deadLetterQueueItem.delivery.lastAttemptAt);
  assert.equal(deadLetterQueueItem.delivery.deliveredAt, null);
  assert.ok(deadLetterQueueItem.delivery.receiptId);
  assert.ok(deadLetterQueueItem.delivery.receiptIssuedAt);
  assert.match(deadLetterQueueItem.delivery.lastError ?? "", /failed permanently in spike mode/);

  const redrivenDeadLetterNotificationResponse = await fetchJsonResponse<{
    notification: {
      notificationId: string;
      deliveryProfileKey: string | null;
      delivery: {
        channel: string;
        status: string;
        target: string | null;
        attemptCount: number;
        maxAttempts: number;
        nextAttemptAt: string | null;
        lastAttemptAt: string | null;
        deliveredAt: string | null;
        receiptId: string | null;
        receiptIssuedAt: string | null;
        lastError: string | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceBreachNotificationRedrive(
      demoTenantKey,
      demoWorkspaceKey,
      deadLetterQueueItem.notificationId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        redrivenByActorId: "notification-ops",
        redriveNote: "Update the dead-letter notification target and requeue delivery.",
        deliveryTarget: "alerts-dead-letter@example.test"
      })
    }
  );
  const redrivenDeadLetterNotificationRequestId = redrivenDeadLetterNotificationResponse.headers.get("x-request-id");
  assert.ok(redrivenDeadLetterNotificationRequestId);
  assert.equal(
    redrivenDeadLetterNotificationResponse.body.notification.notificationId,
    deadLetterQueueItem.notificationId
  );
  assert.equal(
    redrivenDeadLetterNotificationResponse.body.notification.deliveryProfileKey,
    null
  );
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.channel, "email_spike");
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.status, "pending_delivery");
  assert.equal(
    redrivenDeadLetterNotificationResponse.body.notification.delivery.target,
    "alerts-dead-letter@example.test"
  );
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.attemptCount, 0);
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.maxAttempts, 6);
  assert.ok(redrivenDeadLetterNotificationResponse.body.notification.delivery.nextAttemptAt);
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.lastAttemptAt, null);
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.deliveredAt, null);
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.receiptId, null);
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.receiptIssuedAt, null);
  assert.equal(redrivenDeadLetterNotificationResponse.body.notification.delivery.lastError, null);

  const redrivenDeliveredNotificationResult = await retry(async () => {
    const currentNotificationResponse = await fetchJson<{
      items: Array<{
        notificationId: string;
        holdReasonCode: string;
        status: string;
        deliveryProfileKey: string | null;
        delivery: {
          channel: string;
          status: string;
          target: string | null;
          attemptCount: number;
          maxAttempts: number;
          nextAttemptAt: string | null;
          lastAttemptAt: string | null;
          deliveredAt: string | null;
          receiptId: string | null;
          receiptIssuedAt: string | null;
          lastError: string | null;
        };
        evidence: {
          evidenceKey: string;
        };
      }>;
    }>(
      `${apiRoutes.workspaceSystemCheckEvidenceBreachNotifications(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&status=pending_acknowledgement&deliveryStatus=delivered&limit=50`
    );
    const item = currentNotificationResponse.items.find(candidate =>
      candidate.evidence.evidenceKey === deadLetterEvidenceCaptureResponse.body.evidence.evidenceKey
    );

    assert.ok(item, "Redriven dead-letter notification should eventually deliver.");

    return item;
  }, 40, 250);
  assert.equal(redrivenDeliveredNotificationResult.holdReasonCode, "email_dead_letter");
  assert.equal(redrivenDeliveredNotificationResult.status, "pending_acknowledgement");
  assert.equal(redrivenDeliveredNotificationResult.deliveryProfileKey, null);
  assert.equal(redrivenDeliveredNotificationResult.delivery.channel, "email_spike");
  assert.equal(redrivenDeliveredNotificationResult.delivery.status, "delivered");
  assert.equal(redrivenDeliveredNotificationResult.delivery.target, "alerts-dead-letter@example.test");
  assert.equal(redrivenDeliveredNotificationResult.delivery.attemptCount, 1);
  assert.equal(redrivenDeliveredNotificationResult.delivery.maxAttempts, 6);
  assert.equal(redrivenDeliveredNotificationResult.delivery.nextAttemptAt, null);
  assert.ok(redrivenDeliveredNotificationResult.delivery.lastAttemptAt);
  assert.ok(redrivenDeliveredNotificationResult.delivery.deliveredAt);
  assert.ok(redrivenDeliveredNotificationResult.delivery.receiptId);
  assert.ok(redrivenDeliveredNotificationResult.delivery.receiptIssuedAt);
  assert.equal(redrivenDeliveredNotificationResult.delivery.lastError, null);

  const deadLetterQueueAfterRedriveResponse = await fetchJson<{
    items: Array<{
      notificationId: string;
      evidence: {
        evidenceKey: string;
      };
    }>;
  }>(
    `${apiRoutes.workspaceSystemCheckEvidenceBreachDeadLetterQueue(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&deliveryChannel=email_spike&limit=50`
  );
  assert.ok(
    !deadLetterQueueAfterRedriveResponse.items.some(item =>
      item.evidence.evidenceKey === deadLetterEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );

  const escalatedWorkspaceEvidenceResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        hold: {
          escalationStatus: string;
          escalationTarget: string | null;
          escalatedAt: string | null;
          escalatedByActorId: string | null;
          escalationNote: string | null;
          slaStatus: string;
        } | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidence(
      demoTenantKey,
      demoWorkspaceKey,
      escalationEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.equal(
    escalatedWorkspaceEvidenceResponse.body.evidence.retention.hold?.escalationStatus,
    "escalated"
  );
  assert.equal(
    escalatedWorkspaceEvidenceResponse.body.evidence.retention.hold?.escalationTarget,
    "audit-ops"
  );
  assert.ok(
    escalatedWorkspaceEvidenceResponse.body.evidence.retention.hold?.escalatedAt
  );
  assert.equal(
    escalatedWorkspaceEvidenceResponse.body.evidence.retention.hold?.escalatedByActorId,
    "maintenance-sla-escalation"
  );
  assert.equal(
    escalatedWorkspaceEvidenceResponse.body.evidence.retention.hold?.slaStatus,
    "breached"
  );
  assert.match(
    escalatedWorkspaceEvidenceResponse.body.evidence.retention.hold?.escalationNote ?? "",
    /SLA elapsed/
  );

  const escalatedEvidenceRetentionHistory = await fetchJson<{
    items: Array<{
      requestId: string;
      eventType: string;
      actorId: string;
      details: {
        escalationStatus: string | null;
        escalationTarget: string | null;
        escalatedAt: string | null;
        escalatedByActorId: string | null;
        escalationNote: string | null;
      };
    }>;
  }>(
    apiRoutes.workspaceSystemCheckEvidenceRetentionHistory(
      demoTenantKey,
      demoWorkspaceKey,
      escalationEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.deepEqual(
    escalatedEvidenceRetentionHistory.items.slice(0, 3).map(item => item.eventType),
    ["hold_escalated", "hold_applied", "captured"]
  );
  assert.match(
    escalatedEvidenceRetentionHistory.items[0].requestId,
    /worker-system-check-evidence-hold-escalation-/
  );
  assert.equal(escalatedEvidenceRetentionHistory.items[0].actorId, "maintenance-worker");
  assert.equal(escalatedEvidenceRetentionHistory.items[0].details.escalationStatus, "escalated");
  assert.equal(escalatedEvidenceRetentionHistory.items[0].details.escalationTarget, "audit-ops");
  assert.ok(escalatedEvidenceRetentionHistory.items[0].details.escalatedAt);
  assert.equal(
    escalatedEvidenceRetentionHistory.items[0].details.escalatedByActorId,
    "maintenance-sla-escalation"
  );
  assert.match(
    escalatedEvidenceRetentionHistory.items[0].details.escalationNote ?? "",
    /SLA elapsed/
  );

  const legacyInlineEvidencePayloadBase64 = Buffer
    .from("legacy-inline-audio-log: fallback inline storage is still readable", "utf-8")
    .toString("base64");
  const legacyInlineEvidencePool = createDatabasePool();
  const legacyInlineEvidenceStore = createPostgresPlatformStore(legacyInlineEvidencePool);
  const legacyInlineTenant = await legacyInlineEvidenceStore.getTenantByKey(demoTenantKey);
  const legacyInlineWorkspace = await legacyInlineEvidenceStore.getWorkspaceByKey(
    demoTenantKey,
    demoWorkspaceKey
  );
  assert.ok(legacyInlineTenant);
  assert.ok(legacyInlineWorkspace);
  const legacyInlineEvidence = createSystemCheckEvidence({
    participantSessionId,
    tenantId: legacyInlineTenant.tenantId,
    workspaceId: legacyInlineWorkspace.workspaceId,
    contentReleaseId: baselineContentReleaseId,
    loginKey: "alpha-001",
    groupKey: "group-alpha",
    systemCheckKey: "SC-BASELINE",
    checkKey: "audio",
    fileName: "legacy-inline-audio.log",
    contentType: "text/plain",
    payloadBase64: legacyInlineEvidencePayloadBase64,
    persistedPayloadBase64: legacyInlineEvidencePayloadBase64,
    storageBackend: "postgres_inline_spike"
  });

  try {
    await legacyInlineEvidenceStore.saveSystemCheckEvidence(legacyInlineEvidence);
  } finally {
    await legacyInlineEvidenceStore.close();
  }

  const legacyInlineWorkspaceEvidence = await fetchJson<{
    evidence: {
      evidenceKey: string;
      storage: {
        storageBackend: string;
        payloadAvailability: string;
      };
      payloadPreviewText: string | null;
    };
    accessGrant: {
      accessToken: string;
      retrievalUrl: string;
    } | null;
  }>(
    apiRoutes.workspaceSystemCheckEvidence(
      demoTenantKey,
      demoWorkspaceKey,
      legacyInlineEvidence.evidenceKey
    )
  );
  assert.equal(legacyInlineWorkspaceEvidence.evidence.evidenceKey, legacyInlineEvidence.evidenceKey);
  assert.equal(legacyInlineWorkspaceEvidence.evidence.storage.storageBackend, "postgres_inline_spike");
  assert.equal(legacyInlineWorkspaceEvidence.evidence.storage.payloadAvailability, "available");
  assert.equal(
    legacyInlineWorkspaceEvidence.evidence.payloadPreviewText,
    "legacy-inline-audio-log: fallback inline storage is still readable"
  );
  assert.ok(legacyInlineWorkspaceEvidence.accessGrant);
  if (!legacyInlineWorkspaceEvidence.accessGrant) {
    throw new Error("Legacy inline workspace evidence should still issue an access grant.");
  }

  const legacyInlineEvidenceAccess = await fetchJson<{
    evidence: {
      evidenceKey: string;
      storage: {
        storageBackend: string;
      };
    };
    content: {
      payloadBase64: string;
      payloadPreviewText: string | null;
    };
  }>(legacyInlineWorkspaceEvidence.accessGrant.retrievalUrl);
  assert.equal(legacyInlineEvidenceAccess.evidence.evidenceKey, legacyInlineEvidence.evidenceKey);
  assert.equal(legacyInlineEvidenceAccess.evidence.storage.storageBackend, "postgres_inline_spike");
  assert.equal(legacyInlineEvidenceAccess.content.payloadBase64, legacyInlineEvidencePayloadBase64);
  assert.equal(
    legacyInlineEvidenceAccess.content.payloadPreviewText,
    "legacy-inline-audio-log: fallback inline storage is still readable"
  );

  const releasedWorkspaceSystemCheckEvidenceResponse = await fetchJsonResponse<{
    evidence: {
      evidenceKey: string;
      retention: {
        state: string;
        retentionClass: string;
        retentionPolicyKey: string;
        hold: null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckEvidenceReleaseHold(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    ),
    {
      method: "POST",
      body: JSON.stringify({
        releasedByActorId: "reviewer-b",
        releaseNote: "Follow-up completed."
      })
    }
  );
  const releasedWorkspaceSystemCheckEvidenceRequestId =
    releasedWorkspaceSystemCheckEvidenceResponse.headers.get("x-request-id");
  assert.ok(releasedWorkspaceSystemCheckEvidenceRequestId);
  assert.equal(
    releasedWorkspaceSystemCheckEvidenceResponse.body.evidence.evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(releasedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.state, "retained");
  assert.equal(
    releasedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.retentionClass,
    "operator_investigation"
  );
  assert.equal(
    releasedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.retentionPolicyKey,
    "spike_operator_investigation"
  );
  assert.equal(releasedWorkspaceSystemCheckEvidenceResponse.body.evidence.retention.hold, null);

  await retry(async () => {
    const persistedEvidence = await getPersistedSystemCheckEvidence(
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    );
    assert.ok(persistedEvidence);
    assert.equal(persistedEvidence.payloadBase64, null);
    assert.equal(persistedEvidence.payloadPreviewText, null);
    assert.equal(persistedEvidence.storageLocator, null);
    assert.equal(persistedEvidence.retentionHold, null);
    assert.ok(persistedEvidence.purgedAt);
    assert.equal(persistedEvidence.purgeReasonCode, "retention_elapsed");
  }, 60, 250);

  const purgedWorkspaceSystemCheckEvidence = await fetchJson<{
    evidence: {
      evidenceKey: string;
      payloadPreviewText: string | null;
      storage: {
        payloadAvailability: string;
      };
      retention: {
        state: string;
        retentionClass: string;
        retentionPolicyKey: string;
        hold: null;
        purgedAt: string | null;
        purgeReasonCode: string | null;
      };
    };
    accessGrant: null;
  }>(
    apiRoutes.workspaceSystemCheckEvidence(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.equal(
    purgedWorkspaceSystemCheckEvidence.evidence.evidenceKey,
    systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
  );
  assert.equal(purgedWorkspaceSystemCheckEvidence.evidence.payloadPreviewText, null);
  assert.equal(purgedWorkspaceSystemCheckEvidence.evidence.storage.payloadAvailability, "purged");
  assert.equal(purgedWorkspaceSystemCheckEvidence.evidence.retention.state, "purged");
  assert.equal(
    purgedWorkspaceSystemCheckEvidence.evidence.retention.retentionClass,
    "operator_investigation"
  );
  assert.equal(
    purgedWorkspaceSystemCheckEvidence.evidence.retention.retentionPolicyKey,
    "spike_operator_investigation"
  );
  assert.equal(purgedWorkspaceSystemCheckEvidence.evidence.retention.hold, null);
  assert.ok(purgedWorkspaceSystemCheckEvidence.evidence.retention.purgedAt);
  assert.equal(
    purgedWorkspaceSystemCheckEvidence.evidence.retention.purgeReasonCode,
    "retention_elapsed"
  );
  assert.equal(purgedWorkspaceSystemCheckEvidence.accessGrant, null);

  const purgedEvidenceRetentionHistory = await fetchJson<{
    items: Array<{
      eventType: string;
      stateAfter: string;
      actorId: string;
      details: {
        retentionClass: string | null;
        retentionPolicyKey: string | null;
        holdReasonCode: string | null;
        holdNote: string | null;
        releaseNote: string | null;
        purgeReasonCode: string | null;
      };
    }>;
  }>(
    apiRoutes.workspaceSystemCheckEvidenceRetentionHistory(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckEvidenceCaptureResponse.body.evidence.evidenceKey
    )
  );
  assert.deepEqual(
    purgedEvidenceRetentionHistory.items.slice(0, 6).map(item => item.eventType),
    ["purged", "hold_released", "hold_acknowledged", "hold_assigned", "hold_applied", "captured"]
  );
  assert.equal(purgedEvidenceRetentionHistory.items[0].stateAfter, "purged");
  assert.equal(purgedEvidenceRetentionHistory.items[0].details.retentionClass, "operator_investigation");
  assert.equal(
    purgedEvidenceRetentionHistory.items[0].details.retentionPolicyKey,
    "spike_operator_investigation"
  );
  assert.equal(purgedEvidenceRetentionHistory.items[0].details.purgeReasonCode, "retention_elapsed");
  assert.equal(purgedEvidenceRetentionHistory.items[1].stateAfter, "retained");
  assert.equal(purgedEvidenceRetentionHistory.items[1].actorId, "reviewer-b");
  assert.equal(purgedEvidenceRetentionHistory.items[1].details.releaseNote, "Follow-up completed.");

  const purgedEvidenceAccess = await fetchJson<{
    error: {
      code: string;
      details?: {
        purgedAt?: string | null;
        purgeReasonCode?: string | null;
      };
    };
  }>(
    systemCheckEvidenceCaptureResponse.body.accessGrant.retrievalUrl,
    {},
    410
  );
  assert.equal(purgedEvidenceAccess.error.code, "system_check_evidence_purged");
  assert.ok(purgedEvidenceAccess.error.details?.purgedAt);
  assert.equal(purgedEvidenceAccess.error.details?.purgeReasonCode, "retention_elapsed");

  const workspaceSystemCheckReadinessPending = await fetchJson<{
    items: Array<{
      participantSessionId: string;
      loginKey: string;
      groupKey: string;
      readiness: {
        status: string;
        blockingReasonCodes: string[];
        warningReasonCodes: string[];
      };
    }>;
    filters: {
      groupKey: string | null;
      readinessStatus: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckReadiness(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha&readinessStatus=blocked`
  );
  assert.deepEqual(workspaceSystemCheckReadinessPending.filters, {
    groupKey: "group-alpha",
    readinessStatus: "blocked"
  });
  assert.equal(workspaceSystemCheckReadinessPending.items.length, 1);
  assert.equal(workspaceSystemCheckReadinessPending.items[0].loginKey, "alpha-001");
  assert.equal(workspaceSystemCheckReadinessPending.items[0].groupKey, "group-alpha");
  assert.equal(workspaceSystemCheckReadinessPending.items[0].readiness.status, "blocked");
  assert.deepEqual(
    workspaceSystemCheckReadinessPending.items[0].readiness.blockingReasonCodes,
    ["pending_review"]
  );

  const systemCheckReviewResponse = await fetchJsonResponse<{
    submission: {
      systemCheckSubmissionId: string;
      review: {
        reviewStatus: string;
        reviewNote: string | null;
        reviewedAt: string | null;
        reviewedByActorId: string | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckResultReview(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckSubmitResponse.body.submission.systemCheckSubmissionId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "needs_follow_up",
        reviewNote: "Please re-run the audio check with headphones."
      })
    }
  );
  const systemCheckReviewRequestId = systemCheckReviewResponse.headers.get("x-request-id");
  assert.ok(systemCheckReviewRequestId);
  assert.equal(
    systemCheckReviewResponse.body.submission.systemCheckSubmissionId,
    systemCheckSubmitResponse.body.submission.systemCheckSubmissionId
  );
  assert.equal(systemCheckReviewResponse.body.submission.review.reviewStatus, "needs_follow_up");
  assert.equal(
    systemCheckReviewResponse.body.submission.review.reviewNote,
    "Please re-run the audio check with headphones."
  );
  assert.equal(systemCheckReviewResponse.body.submission.review.reviewedByActorId, "platform-api");
  assert.ok(systemCheckReviewResponse.body.submission.review.reviewedAt);

  const blockedLaunchAfterFollowUpReview = await fetchJsonResponse<{
    error: {
      code: string;
      details: {
        systemCheckReadiness: {
          status: string;
          blockingReasonCodes: string[];
        };
      };
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create"
    })
  }, 409);
  const blockedLaunchAfterFollowUpReviewRequestId = blockedLaunchAfterFollowUpReview.headers.get("x-request-id");
  assert.ok(blockedLaunchAfterFollowUpReviewRequestId);
  assert.equal(
    blockedLaunchAfterFollowUpReview.body.error.code,
    "starter_launch_blocked_by_system_check"
  );
  assert.deepEqual(
    blockedLaunchAfterFollowUpReview.body.error.details.systemCheckReadiness.blockingReasonCodes,
    ["requires_follow_up"]
  );

  const workspaceSystemCheckResultsAfterReview = await fetchJson<{
    items: Array<{
      systemCheckSubmissionId: string;
      review: {
        reviewStatus: string;
        reviewNote: string | null;
      };
    }>;
    filters: {
      groupKey: string | null;
      status: string | null;
      reviewStatus: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckResults(demoTenantKey, demoWorkspaceKey)}?reviewStatus=needs_follow_up`
  );
  assert.deepEqual(workspaceSystemCheckResultsAfterReview.filters, {
    groupKey: null,
    status: null,
    reviewStatus: "needs_follow_up"
  });
  assert.equal(workspaceSystemCheckResultsAfterReview.items.length, 1);
  assert.equal(
    workspaceSystemCheckResultsAfterReview.items[0].systemCheckSubmissionId,
    systemCheckSubmitResponse.body.submission.systemCheckSubmissionId
  );
  assert.equal(
    workspaceSystemCheckResultsAfterReview.items[0].review.reviewStatus,
    "needs_follow_up"
  );
  assert.equal(
    workspaceSystemCheckResultsAfterReview.items[0].review.reviewNote,
    "Please re-run the audio check with headphones."
  );

  const workspaceSystemCheckReadinessAfterFollowUp = await fetchJson<{
    items: Array<{
      readiness: {
        status: string;
        blockingReasonCodes: string[];
      };
    }>;
  }>(
    `${apiRoutes.workspaceSystemCheckReadiness(demoTenantKey, demoWorkspaceKey)}?readinessStatus=blocked`
  );
  assert.equal(workspaceSystemCheckReadinessAfterFollowUp.items.length, 1);
  assert.equal(workspaceSystemCheckReadinessAfterFollowUp.items[0].readiness.status, "blocked");
  assert.deepEqual(
    workspaceSystemCheckReadinessAfterFollowUp.items[0].readiness.blockingReasonCodes,
    ["requires_follow_up"]
  );

  const systemCheckAcceptedReviewResponse = await fetchJsonResponse<{
    submission: {
      review: {
        reviewStatus: string;
        reviewNote: string | null;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckResultReview(
      demoTenantKey,
      demoWorkspaceKey,
      systemCheckSubmitResponse.body.submission.systemCheckSubmissionId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "accepted",
        reviewNote: "Audio issue acknowledged for this supervised launch."
      })
    }
  );
  const systemCheckAcceptedReviewRequestId = systemCheckAcceptedReviewResponse.headers.get("x-request-id");
  assert.ok(systemCheckAcceptedReviewRequestId);
  assert.equal(systemCheckAcceptedReviewResponse.body.submission.review.reviewStatus, "accepted");
  assert.equal(
    systemCheckAcceptedReviewResponse.body.submission.review.reviewNote,
    "Audio issue acknowledged for this supervised launch."
  );

  const participantStarterAfterAcceptedReview = await fetchJson<{
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
      warningReasonCodes: string[];
      checks: Array<{
        readinessStatus: string;
        reasonCodes: string[];
      }>;
    };
  }>(`${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);
  assert.equal(participantStarterAfterAcceptedReview.systemCheckReadiness.status, "warning");
  assert.deepEqual(participantStarterAfterAcceptedReview.systemCheckReadiness.blockingReasonCodes, []);
  assert.deepEqual(
    participantStarterAfterAcceptedReview.systemCheckReadiness.warningReasonCodes,
    ["accepted_with_warning"]
  );
  assert.equal(
    participantStarterAfterAcceptedReview.systemCheckReadiness.checks[0].readinessStatus,
    "warning"
  );
  assert.deepEqual(
    participantStarterAfterAcceptedReview.systemCheckReadiness.checks[0].reasonCodes,
    ["accepted_with_warning"]
  );

  const workspaceLaunchApprovalResponse = await fetchJsonResponse<{
    approval: {
      launchApprovalId: string;
      participantSessionId: string;
      assignmentKey: string;
      approvalScope: string;
      status: string;
      approvedBySupervisorId: string;
      approvalNote: string;
      warningReasonCodes: string[];
      consumedAt: string | null;
      consumedByTestRunId: string | null;
    };
  }>(apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, demoWorkspaceKey), {
    method: "POST",
    body: JSON.stringify({
      participantSessionId,
      assignmentKey,
      approvalScope: "session_assignment",
      approvedBySupervisorId: "proctor-alpha",
      approvalNote: "Accepted audio warning for supervised launch."
    })
  }, 201);
  const workspaceLaunchApprovalRequestId = workspaceLaunchApprovalResponse.headers.get("x-request-id");
  assert.ok(workspaceLaunchApprovalRequestId);
  assert.equal(workspaceLaunchApprovalResponse.body.approval.participantSessionId, participantSessionId);
  assert.equal(workspaceLaunchApprovalResponse.body.approval.assignmentKey, assignmentKey);
  assert.equal(workspaceLaunchApprovalResponse.body.approval.approvalScope, "session_assignment");
  assert.equal(workspaceLaunchApprovalResponse.body.approval.status, "active");
  assert.equal(workspaceLaunchApprovalResponse.body.approval.approvedBySupervisorId, "proctor-alpha");
  assert.equal(
    workspaceLaunchApprovalResponse.body.approval.approvalNote,
    "Accepted audio warning for supervised launch."
  );
  assert.deepEqual(
    workspaceLaunchApprovalResponse.body.approval.warningReasonCodes,
    ["accepted_with_warning"]
  );
  assert.equal(workspaceLaunchApprovalResponse.body.approval.consumedAt, null);
  assert.equal(workspaceLaunchApprovalResponse.body.approval.consumedByTestRunId, null);

  const workspaceLaunchApprovals = await fetchJson<{
    items: Array<{
      launchApprovalId: string;
      participantSessionId: string;
      assignmentKey: string;
      approvalScope: string;
      status: string;
    }>;
    filters: {
      participantSessionId: string | null;
      assignmentKey: string | null;
      status: string | null;
      approvalScope: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, demoWorkspaceKey)}?participantSessionId=${encodeURIComponent(participantSessionId)}&assignmentKey=${encodeURIComponent(assignmentKey)}&status=active&approvalScope=session_assignment`
  );
  assert.deepEqual(workspaceLaunchApprovals.filters, {
    participantSessionId,
    assignmentKey,
    status: "active",
    approvalScope: "session_assignment"
  });
  assert.equal(workspaceLaunchApprovals.items.length, 1);
  assert.equal(
    workspaceLaunchApprovals.items[0].launchApprovalId,
    workspaceLaunchApprovalResponse.body.approval.launchApprovalId
  );

  const warningLaunchWithoutApproval = await fetchJsonResponse<{
    error: {
      code: string;
      details: {
        systemCheckReadiness: {
          status: string;
          warningReasonCodes: string[];
        };
      };
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create"
    })
  }, 409);
  const warningLaunchWithoutApprovalRequestId =
    warningLaunchWithoutApproval.headers.get("x-request-id");
  assert.ok(warningLaunchWithoutApprovalRequestId);
  assert.equal(
    warningLaunchWithoutApproval.body.error.code,
    "starter_launch_requires_launch_approval"
  );
  assert.equal(
    warningLaunchWithoutApproval.body.error.details.systemCheckReadiness.status,
    "warning"
  );
  assert.deepEqual(
    warningLaunchWithoutApproval.body.error.details.systemCheckReadiness.warningReasonCodes,
    ["accepted_with_warning"]
  );

  const workspaceSystemCheckReadinessWarning = await fetchJson<{
    items: Array<{
      loginKey: string;
      readiness: {
        status: string;
        warningReasonCodes: string[];
      };
    }>;
    filters: {
      groupKey: string | null;
      readinessStatus: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckReadiness(demoTenantKey, demoWorkspaceKey)}?readinessStatus=warning`
  );
  assert.deepEqual(workspaceSystemCheckReadinessWarning.filters, {
    groupKey: null,
    readinessStatus: "warning"
  });
  assert.equal(workspaceSystemCheckReadinessWarning.items.length, 1);
  assert.equal(workspaceSystemCheckReadinessWarning.items[0].loginKey, "alpha-001");
  assert.equal(workspaceSystemCheckReadinessWarning.items[0].readiness.status, "warning");
  assert.deepEqual(
    workspaceSystemCheckReadinessWarning.items[0].readiness.warningReasonCodes,
    ["accepted_with_warning"]
  );

  const workspaceAuditEventsAfterSystemCheck = await fetchJson<{
    items: Array<{
      requestId: string;
      eventType: string;
      loginKey: string | null;
      groupKey: string | null;
    }>;
  }>(`${apiRoutes.workspaceAuditEvents(demoTenantKey, demoWorkspaceKey)}?limit=200`);
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === workspaceLaunchApprovalRequestId &&
      item.eventType === "workspace.system_check.launch_approval.created" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === warningLaunchWithoutApprovalRequestId &&
      item.eventType === "participant.starter.launch_requires_launch_approval" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === blockedLaunchBeforeSystemCheckRequestId &&
      item.eventType === "participant.starter.launch_blocked_by_system_check" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === systemCheckEvidenceCaptureRequestId &&
      item.eventType === "participant.system_check.evidence_captured" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === heldWorkspaceSystemCheckEvidenceRequestId &&
      item.eventType === "workspace.system_check.evidence_hold.applied" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === assignedWorkspaceSystemCheckEvidenceRequestId &&
      item.eventType === "workspace.system_check.evidence_hold.assigned" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === acknowledgedWorkspaceSystemCheckEvidenceRequestId &&
      item.eventType === "workspace.system_check.evidence_hold.acknowledged" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === escalatedEvidenceRetentionHistory.items[0].requestId &&
      item.eventType === "worker.system_check_evidence.hold_escalated" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === escalatedEvidenceRetentionHistory.items[0].requestId &&
      item.eventType === "worker.system_check_evidence.breach_notification.enqueued" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === escalatedEvidenceRetentionHistory.items[0].requestId &&
      item.actorType === "notification_service" &&
      item.eventType === "notification_service.system_check_evidence.breach_notification.delivered" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.actorType === "notification_service" &&
      item.eventType === "notification_service.system_check_evidence.breach_notification.retry_scheduled" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.actorType === "notification_service" &&
      item.eventType === "notification_service.system_check_evidence.breach_notification.delivery_failed" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === redrivenDeadLetterNotificationRequestId &&
      item.eventType === "workspace.system_check.evidence_breach_notification.redriven" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === redrivenDeadLetterNotificationRequestId &&
      item.actorType === "notification_service" &&
      item.eventType === "notification_service.system_check_evidence.breach_notification.delivered" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === acknowledgedBreachNotificationRequestId &&
      item.eventType === "workspace.system_check.evidence_breach_notification.acknowledged" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === releasedWorkspaceSystemCheckEvidenceRequestId &&
      item.eventType === "workspace.system_check.evidence_hold.released" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.eventType === "worker.system_check_evidence.purged" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === systemCheckSubmitRequestId &&
      item.eventType === "participant.system_check.submitted" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === systemCheckReviewRequestId &&
      item.eventType === "workspace.system_check.reviewed" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === blockedLaunchAfterFollowUpReviewRequestId &&
      item.eventType === "participant.starter.launch_blocked_by_system_check" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    workspaceAuditEventsAfterSystemCheck.items.some(item =>
      item.requestId === systemCheckAcceptedReviewRequestId &&
      item.eventType === "workspace.system_check.reviewed" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );

  const launchResponse = await fetchJsonResponse<{
    testRunId: string;
    launchDisposition: string;
    attemptNumber: number;
    status: string;
    runPolicy: {
      navigationLocked: boolean;
      timeLimitSeconds: number | null;
      timeRemainingSeconds: number | null;
    };
    systemCheckReadiness: {
      status: string;
      warningReasonCodes: string[];
    };
    launchAuthorization: {
      launchApprovalId: string | null;
      approvalScope: string | null;
      approvalApplied: boolean;
      approvedBySupervisorId: string | null;
      approvalNote: string | null;
      approvedAt: string | null;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create",
      launchApprovalId: workspaceLaunchApprovalResponse.body.approval.launchApprovalId
    })
  }, 201);

  const launchRequestId = launchResponse.headers.get("x-request-id");
  assert.ok(launchRequestId);
  const launch = launchResponse.body;
  assert.equal(launch.launchDisposition, "created");
  assert.equal(launch.attemptNumber, 1);
  assert.equal(launch.runPolicy.navigationLocked, true);
  assert.equal(launch.runPolicy.timeLimitSeconds, 1800);
  assert.equal(typeof launch.runPolicy.timeRemainingSeconds, "number");
  assert.equal(launch.systemCheckReadiness.status, "warning");
  assert.deepEqual(launch.systemCheckReadiness.warningReasonCodes, ["accepted_with_warning"]);
  assert.equal(
    launch.launchAuthorization.launchApprovalId,
    workspaceLaunchApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(launch.launchAuthorization.approvalScope, "session_assignment");
  assert.equal(launch.launchAuthorization.approvalApplied, true);
  assert.equal(launch.launchAuthorization.approvedBySupervisorId, "proctor-alpha");
  assert.equal(
    launch.launchAuthorization.approvalNote,
    "Accepted audio warning for supervised launch."
  );
  assert.ok(launch.launchAuthorization.approvedAt);

  const testRunId = launch.testRunId;

  const initialMonitorList = await fetchJson<{
    items: Array<{
      testRunId: string;
      loginKey: string;
      groupKey: string;
      attemptNumber: number;
      status: string;
    }>;
    filters: {
      groupKey: string | null;
    };
  }>(`${apiRoutes.workspaceMonitorTestRuns(demoTenantKey, demoWorkspaceKey)}?groupKey=group-alpha`);

  assert.equal(initialMonitorList.filters.groupKey, "group-alpha");
  assert.equal(initialMonitorList.items.length, 1);
  assert.equal(initialMonitorList.items[0].testRunId, testRunId);
  assert.equal(initialMonitorList.items[0].loginKey, "alpha-001");
  assert.equal(initialMonitorList.items[0].status, "active");

  const revisionGuardrailWithActiveSession = await fetchJson<{
    contentRelease: {
      activationGuardrail: ContentReleaseActivationGuardrail;
    };
  }>(
    apiRoutes.workspaceContentRelease(demoTenantKey, demoWorkspaceKey, groupMonitorRevisionContentReleaseId)
  );

  assert.equal(revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.status, "blocked");
  assert.equal(revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.activeSessionCount, 1);
  assert.deepEqual(
    revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.activeTestRunIds,
    [testRunId]
  );
  assert.deepEqual(
    revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.activeLoginKeys,
    ["alpha-001"]
  );
  assert.deepEqual(
    revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.activeGroupKeys,
    ["group-alpha"]
  );
  assert.ok(
    revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.warningReasonCodes.includes(
      "active_sessions_present"
    )
  );
  assert.ok(
    revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.warningReasonCodes.includes(
      "high_risk_release_change"
    )
  );
  assert.ok(
    revisionGuardrailWithActiveSession.contentRelease.activationGuardrail.blockingReasonCodes.includes(
      "active_sessions_incompatible_routing_change"
    )
  );

  const blockedActivation = await fetchJson<{
    error: {
      code: string;
      details?: {
        activationGuardrail: ContentReleaseActivationGuardrail;
      };
    };
  }>(
    apiRoutes.contentReleaseActivate(demoTenantKey, demoWorkspaceKey, groupMonitorRevisionContentReleaseId),
    {
      method: "POST"
    },
    409
  );

  assert.equal(blockedActivation.error.code, "activation_guardrail_blocked");
  assert.equal(blockedActivation.error.details?.activationGuardrail.status, "blocked");
  assert.ok(
    blockedActivation.error.details?.activationGuardrail.blockingReasonCodes.includes(
      "active_sessions_incompatible_routing_change"
    )
  );

  const relaxedActivationPolicyResponse = await fetchJsonResponse<WorkspaceActivationPolicyResponse>(
    apiRoutes.workspaceActivationPolicy(demoTenantKey, demoWorkspaceKey),
    {
    method: "PATCH",
    body: JSON.stringify({
      mode: "override",
      activationPolicyOverride: {
        blockIncompatibleRoutingChangesWithActiveSessions: false
      }
    })
    }
  );
  const relaxedActivationPolicy = relaxedActivationPolicyResponse.body;
  const relaxedActivationPolicyRequestId = relaxedActivationPolicyResponse.headers.get("x-request-id");
  assert.ok(relaxedActivationPolicyRequestId);

  assert.equal(relaxedActivationPolicy.mode, "override");
  assert.deepEqual(relaxedActivationPolicy.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  });
  assert.deepEqual(relaxedActivationPolicy.activationPolicyOverride, {
    blockIncompatibleRoutingChangesWithActiveSessions: false
  });
  assert.ok(relaxedActivationPolicy.activationPolicyOverrideRecords);
  assert.equal(
    relaxedActivationPolicy.activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions?.value,
    false
  );
  assert.equal(
    relaxedActivationPolicy.activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions?.updatedByRequestId,
    relaxedActivationPolicyRequestId
  );
  assert.equal(
    relaxedActivationPolicy.activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions?.updatedByActorType,
    "platform_api"
  );
  assert.equal(
    relaxedActivationPolicy.activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions?.updatedByActorId,
    "platform-api"
  );
  assert.ok(
    relaxedActivationPolicy.activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions?.updatedAt
  );
  assert.deepEqual(relaxedActivationPolicy.effectiveActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: false,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  });

  const updatedTenantActivationPolicy = await fetchJson<TenantActivationPolicyResponse>(
    apiRoutes.tenantActivationPolicy(demoTenantKey),
    {
    method: "PATCH",
    body: JSON.stringify({
      defaultActivationPolicy: {
        blockIncompatibleRoutingChangesWithActiveSessions: true,
        warnOnActiveSessions: true,
        warnOnHighRiskReleaseChange: false
      }
    })
    }
  );

  assert.deepEqual(updatedTenantActivationPolicy.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });

  const emptyWorkspaceActivationPolicy = await fetchJson<WorkspaceActivationPolicyResponse>(
    apiRoutes.workspaceActivationPolicy(demoTenantKey, emptyWorkspaceKey)
  );

  assert.equal(emptyWorkspaceActivationPolicy.mode, "inherit");
  assert.equal(emptyWorkspaceActivationPolicy.activationPolicyOverride, null);
  assert.equal(emptyWorkspaceActivationPolicy.activationPolicyOverrideRecords, null);
  assert.deepEqual(emptyWorkspaceActivationPolicy.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });
  assert.deepEqual(emptyWorkspaceActivationPolicy.effectiveActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });

  await fetchJson(
    apiRoutes.tenantWorkspaces(demoTenantKey),
    {
      method: "POST",
      body: JSON.stringify({
        workspaceKey: tenantPolicyWorkspaceKey,
        displayName: "Tenant Policy Workspace"
      })
    },
    201
  );

  const inheritedWorkspaceActivationPolicy = await fetchJson<WorkspaceActivationPolicyResponse>(
    apiRoutes.workspaceActivationPolicy(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceActivationPolicy.workspaceKey, tenantPolicyWorkspaceKey);
  assert.equal(inheritedWorkspaceActivationPolicy.mode, "inherit");
  assert.equal(inheritedWorkspaceActivationPolicy.activationPolicyOverride, null);
  assert.equal(inheritedWorkspaceActivationPolicy.activationPolicyOverrideRecords, null);
  assert.deepEqual(inheritedWorkspaceActivationPolicy.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });
  assert.deepEqual(inheritedWorkspaceActivationPolicy.effectiveActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });

  const demoWorkspaceActivationPolicyAfterTenantUpdate = await fetchJson<WorkspaceActivationPolicyResponse>(
    apiRoutes.workspaceActivationPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(demoWorkspaceActivationPolicyAfterTenantUpdate.mode, "override");
  assert.deepEqual(demoWorkspaceActivationPolicyAfterTenantUpdate.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });
  assert.deepEqual(demoWorkspaceActivationPolicyAfterTenantUpdate.activationPolicyOverride, {
    blockIncompatibleRoutingChangesWithActiveSessions: false
  });
  assert.ok(demoWorkspaceActivationPolicyAfterTenantUpdate.activationPolicyOverrideRecords);
  assert.equal(
    demoWorkspaceActivationPolicyAfterTenantUpdate.activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions?.updatedByRequestId,
    relaxedActivationPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceActivationPolicyAfterTenantUpdate.effectiveActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: false,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });

  const tightenedWorkspaceOperationalPolicyResponse = await fetchJsonResponse<WorkspaceOperationalPolicyResponse>(
    apiRoutes.workspaceOperationalPolicy(demoTenantKey, demoWorkspaceKey),
    {
    method: "PATCH",
    body: JSON.stringify({
      mode: "override",
      operationalPolicyOverride: {
        monitorCommandTtlSeconds: 1,
        timedRunMaintenanceGraceSeconds: 1
      }
    })
    }
  );
  const tightenedWorkspaceOperationalPolicy = tightenedWorkspaceOperationalPolicyResponse.body;
  const tightenedWorkspaceOperationalPolicyRequestId =
    tightenedWorkspaceOperationalPolicyResponse.headers.get("x-request-id");
  assert.ok(tightenedWorkspaceOperationalPolicyRequestId);

  assert.equal(tightenedWorkspaceOperationalPolicy.mode, "override");
  assert.deepEqual(tightenedWorkspaceOperationalPolicy.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 30,
    monitorCommandLeaseSeconds: 15,
    timedRunMaintenanceGraceSeconds: 0
  });
  assert.deepEqual(tightenedWorkspaceOperationalPolicy.operationalPolicyOverride, {
    monitorCommandTtlSeconds: 1,
    timedRunMaintenanceGraceSeconds: 1
  });
  assert.ok(tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords);
  assert.equal(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.monitorCommandTtlSeconds?.value,
    1
  );
  assert.equal(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.monitorCommandTtlSeconds?.updatedByRequestId,
    tightenedWorkspaceOperationalPolicyRequestId
  );
  assert.equal(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.monitorCommandTtlSeconds?.updatedByActorType,
    "platform_api"
  );
  assert.equal(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.monitorCommandTtlSeconds?.updatedByActorId,
    "platform-api"
  );
  assert.ok(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.monitorCommandTtlSeconds?.updatedAt
  );
  assert.equal(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.timedRunMaintenanceGraceSeconds?.value,
    1
  );
  assert.equal(
    tightenedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords.timedRunMaintenanceGraceSeconds?.updatedByRequestId,
    tightenedWorkspaceOperationalPolicyRequestId
  );
  assert.deepEqual(tightenedWorkspaceOperationalPolicy.effectiveOperationalPolicy, {
    monitorCommandTtlSeconds: 1,
    monitorCommandLeaseSeconds: 15,
    timedRunMaintenanceGraceSeconds: 1
  });

  const updatedTenantOperationalPolicy = await fetchJson<TenantOperationalPolicyResponse>(
    apiRoutes.tenantOperationalPolicy(demoTenantKey),
    {
    method: "PATCH",
    body: JSON.stringify({
      defaultOperationalPolicy: {
        monitorCommandTtlSeconds: 45,
        monitorCommandLeaseSeconds: 3,
        timedRunMaintenanceGraceSeconds: 10
      }
    })
    }
  );

  assert.deepEqual(updatedTenantOperationalPolicy.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });

  const emptyWorkspaceOperationalPolicy = await fetchJson<WorkspaceOperationalPolicyResponse>(
    apiRoutes.workspaceOperationalPolicy(demoTenantKey, emptyWorkspaceKey)
  );

  assert.equal(emptyWorkspaceOperationalPolicy.mode, "inherit");
  assert.equal(emptyWorkspaceOperationalPolicy.operationalPolicyOverride, null);
  assert.equal(emptyWorkspaceOperationalPolicy.operationalPolicyOverrideRecords, null);
  assert.deepEqual(emptyWorkspaceOperationalPolicy.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });
  assert.deepEqual(emptyWorkspaceOperationalPolicy.effectiveOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });

  const inheritedWorkspaceOperationalPolicy = await fetchJson<WorkspaceOperationalPolicyResponse>(
    apiRoutes.workspaceOperationalPolicy(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceOperationalPolicy.workspaceKey, tenantPolicyWorkspaceKey);
  assert.equal(inheritedWorkspaceOperationalPolicy.mode, "inherit");
  assert.equal(inheritedWorkspaceOperationalPolicy.operationalPolicyOverride, null);
  assert.equal(inheritedWorkspaceOperationalPolicy.operationalPolicyOverrideRecords, null);
  assert.deepEqual(inheritedWorkspaceOperationalPolicy.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });
  assert.deepEqual(inheritedWorkspaceOperationalPolicy.effectiveOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });

  const demoWorkspaceOperationalPolicyAfterTenantUpdate = await fetchJson<WorkspaceOperationalPolicyResponse>(
    apiRoutes.workspaceOperationalPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(demoWorkspaceOperationalPolicyAfterTenantUpdate.mode, "override");
  assert.deepEqual(demoWorkspaceOperationalPolicyAfterTenantUpdate.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });
  assert.deepEqual(demoWorkspaceOperationalPolicyAfterTenantUpdate.operationalPolicyOverride, {
    monitorCommandTtlSeconds: 1,
    timedRunMaintenanceGraceSeconds: 1
  });
  assert.ok(demoWorkspaceOperationalPolicyAfterTenantUpdate.operationalPolicyOverrideRecords);
  assert.equal(
    demoWorkspaceOperationalPolicyAfterTenantUpdate.operationalPolicyOverrideRecords.monitorCommandTtlSeconds?.updatedByRequestId,
    tightenedWorkspaceOperationalPolicyRequestId
  );
  assert.equal(
    demoWorkspaceOperationalPolicyAfterTenantUpdate.operationalPolicyOverrideRecords.timedRunMaintenanceGraceSeconds?.updatedByRequestId,
    tightenedWorkspaceOperationalPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceOperationalPolicyAfterTenantUpdate.effectiveOperationalPolicy, {
    monitorCommandTtlSeconds: 1,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 1
  });

  const initialTenantLaunchApprovalPolicy = await fetchJson<TenantLaunchApprovalPolicyResponse>(
    apiRoutes.tenantLaunchApprovalPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultLaunchApprovalPolicy: {
          systemCheckLaunchApprovalTtlSeconds: 300
        }
      })
    }
  );

  assert.deepEqual(initialTenantLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 300
  });

  const emptyWorkspaceLaunchApprovalPolicy = await fetchJson<WorkspaceLaunchApprovalPolicyResponse>(
    apiRoutes.workspaceLaunchApprovalPolicy(demoTenantKey, emptyWorkspaceKey)
  );

  assert.equal(emptyWorkspaceLaunchApprovalPolicy.mode, "inherit");
  assert.equal(emptyWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverride, null);
  assert.equal(emptyWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverrideRecords, null);
  assert.deepEqual(emptyWorkspaceLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 300
  });
  assert.deepEqual(emptyWorkspaceLaunchApprovalPolicy.effectiveLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 300
  });

  const demoWorkspaceLaunchApprovalPolicyResponse = await fetchJsonResponse<WorkspaceLaunchApprovalPolicyResponse>(
    apiRoutes.workspaceLaunchApprovalPolicy(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        launchApprovalPolicyOverride: {
          systemCheckLaunchApprovalTtlSeconds: 120
        }
      })
    }
  );
  const demoWorkspaceLaunchApprovalPolicy = demoWorkspaceLaunchApprovalPolicyResponse.body;
  const demoWorkspaceLaunchApprovalPolicyRequestId =
    demoWorkspaceLaunchApprovalPolicyResponse.headers.get("x-request-id");
  assert.ok(demoWorkspaceLaunchApprovalPolicyRequestId);
  assert.equal(demoWorkspaceLaunchApprovalPolicy.mode, "override");
  assert.deepEqual(demoWorkspaceLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 300
  });
  assert.deepEqual(demoWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverride, {
    systemCheckLaunchApprovalTtlSeconds: 120
  });
  assert.equal(
    demoWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverrideRecords?.systemCheckLaunchApprovalTtlSeconds?.value,
    120
  );
  assert.equal(
    demoWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverrideRecords?.systemCheckLaunchApprovalTtlSeconds?.updatedByRequestId,
    demoWorkspaceLaunchApprovalPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceLaunchApprovalPolicy.effectiveLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 120
  });

  const updatedTenantLaunchApprovalPolicy = await fetchJson<TenantLaunchApprovalPolicyResponse>(
    apiRoutes.tenantLaunchApprovalPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultLaunchApprovalPolicy: {
          systemCheckLaunchApprovalTtlSeconds: 30
        }
      })
    }
  );

  assert.deepEqual(updatedTenantLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 30
  });

  const inheritedWorkspaceLaunchApprovalPolicy = await fetchJson<WorkspaceLaunchApprovalPolicyResponse>(
    apiRoutes.workspaceLaunchApprovalPolicy(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceLaunchApprovalPolicy.workspaceKey, tenantPolicyWorkspaceKey);
  assert.equal(inheritedWorkspaceLaunchApprovalPolicy.mode, "inherit");
  assert.equal(inheritedWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverride, null);
  assert.equal(inheritedWorkspaceLaunchApprovalPolicy.launchApprovalPolicyOverrideRecords, null);
  assert.deepEqual(inheritedWorkspaceLaunchApprovalPolicy.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 30
  });
  assert.deepEqual(inheritedWorkspaceLaunchApprovalPolicy.effectiveLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 30
  });

  const demoWorkspaceLaunchApprovalPolicyAfterTenantUpdate = await fetchJson<WorkspaceLaunchApprovalPolicyResponse>(
    apiRoutes.workspaceLaunchApprovalPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(demoWorkspaceLaunchApprovalPolicyAfterTenantUpdate.mode, "override");
  assert.deepEqual(demoWorkspaceLaunchApprovalPolicyAfterTenantUpdate.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 30
  });
  assert.deepEqual(demoWorkspaceLaunchApprovalPolicyAfterTenantUpdate.launchApprovalPolicyOverride, {
    systemCheckLaunchApprovalTtlSeconds: 120
  });
  assert.equal(
    demoWorkspaceLaunchApprovalPolicyAfterTenantUpdate.launchApprovalPolicyOverrideRecords?.systemCheckLaunchApprovalTtlSeconds?.updatedByRequestId,
    demoWorkspaceLaunchApprovalPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceLaunchApprovalPolicyAfterTenantUpdate.effectiveLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 120
  });

  const initialTenantNotificationPolicy = await fetchJson<TenantNotificationPolicyResponse>(
    apiRoutes.tenantNotificationPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultNotificationPolicy: {
          breachNotificationDeliverySelectionMode: "force_webhook_spike",
          webhookSpikeRetryDelaySeconds: 2,
          webhookSpikeMaxDeliveryAttempts: 5,
          emailSpikeRetryDelaySeconds: 7,
          emailSpikeMaxDeliveryAttempts: 8
        }
      })
    }
  );

  assert.deepEqual(initialTenantNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 2,
    webhookSpikeMaxDeliveryAttempts: 5,
    emailSpikeRetryDelaySeconds: 7,
    emailSpikeMaxDeliveryAttempts: 8
  });

  const emptyWorkspaceNotificationPolicy = await fetchJson<WorkspaceNotificationPolicyResponse>(
    apiRoutes.workspaceNotificationPolicy(demoTenantKey, emptyWorkspaceKey)
  );

  assert.equal(emptyWorkspaceNotificationPolicy.mode, "inherit");
  assert.equal(emptyWorkspaceNotificationPolicy.notificationPolicyOverride, null);
  assert.equal(emptyWorkspaceNotificationPolicy.notificationPolicyOverrideRecords, null);
  assert.deepEqual(emptyWorkspaceNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 2,
    webhookSpikeMaxDeliveryAttempts: 5,
    emailSpikeRetryDelaySeconds: 7,
    emailSpikeMaxDeliveryAttempts: 8
  });
  assert.deepEqual(emptyWorkspaceNotificationPolicy.effectiveNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 2,
    webhookSpikeMaxDeliveryAttempts: 5,
    emailSpikeRetryDelaySeconds: 7,
    emailSpikeMaxDeliveryAttempts: 8
  });

  const demoWorkspaceNotificationPolicyResponse = await fetchJsonResponse<WorkspaceNotificationPolicyResponse>(
    apiRoutes.workspaceNotificationPolicy(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationPolicyOverride: {
          breachNotificationDeliverySelectionMode: "infer_from_target",
          webhookSpikeRetryDelaySeconds: 0,
          webhookSpikeMaxDeliveryAttempts: 4
        }
      })
    }
  );
  const demoWorkspaceNotificationPolicy = demoWorkspaceNotificationPolicyResponse.body;
  const demoWorkspaceNotificationPolicyRequestId =
    demoWorkspaceNotificationPolicyResponse.headers.get("x-request-id");
  assert.ok(demoWorkspaceNotificationPolicyRequestId);
  assert.equal(demoWorkspaceNotificationPolicy.mode, "override");
  assert.deepEqual(demoWorkspaceNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 2,
    webhookSpikeMaxDeliveryAttempts: 5,
    emailSpikeRetryDelaySeconds: 7,
    emailSpikeMaxDeliveryAttempts: 8
  });
  assert.deepEqual(demoWorkspaceNotificationPolicy.notificationPolicyOverride, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 4
  });
  assert.equal(
    demoWorkspaceNotificationPolicy.notificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.value,
    "infer_from_target"
  );
  assert.equal(
    demoWorkspaceNotificationPolicy.notificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.updatedByRequestId,
    demoWorkspaceNotificationPolicyRequestId
  );
  assert.equal(
    demoWorkspaceNotificationPolicy.notificationPolicyOverrideRecords
      ?.webhookSpikeRetryDelaySeconds?.value,
    0
  );
  assert.equal(
    demoWorkspaceNotificationPolicy.notificationPolicyOverrideRecords
      ?.webhookSpikeMaxDeliveryAttempts?.value,
    4
  );
  assert.deepEqual(demoWorkspaceNotificationPolicy.effectiveNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 4,
    emailSpikeRetryDelaySeconds: 7,
    emailSpikeMaxDeliveryAttempts: 8
  });

  const updatedTenantNotificationPolicy = await fetchJson<TenantNotificationPolicyResponse>(
    apiRoutes.tenantNotificationPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultNotificationPolicy: {
          breachNotificationDeliverySelectionMode: "force_email_spike",
          webhookSpikeRetryDelaySeconds: 3,
          webhookSpikeMaxDeliveryAttempts: 6,
          emailSpikeRetryDelaySeconds: 4,
          emailSpikeMaxDeliveryAttempts: 7
        }
      })
    }
  );

  assert.deepEqual(updatedTenantNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 3,
    webhookSpikeMaxDeliveryAttempts: 6,
    emailSpikeRetryDelaySeconds: 4,
    emailSpikeMaxDeliveryAttempts: 7
  });

  const inheritedWorkspaceNotificationPolicy = await fetchJson<WorkspaceNotificationPolicyResponse>(
    apiRoutes.workspaceNotificationPolicy(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceNotificationPolicy.workspaceKey, tenantPolicyWorkspaceKey);
  assert.equal(inheritedWorkspaceNotificationPolicy.mode, "inherit");
  assert.equal(inheritedWorkspaceNotificationPolicy.notificationPolicyOverride, null);
  assert.equal(inheritedWorkspaceNotificationPolicy.notificationPolicyOverrideRecords, null);
  assert.deepEqual(inheritedWorkspaceNotificationPolicy.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 3,
    webhookSpikeMaxDeliveryAttempts: 6,
    emailSpikeRetryDelaySeconds: 4,
    emailSpikeMaxDeliveryAttempts: 7
  });
  assert.deepEqual(inheritedWorkspaceNotificationPolicy.effectiveNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 3,
    webhookSpikeMaxDeliveryAttempts: 6,
    emailSpikeRetryDelaySeconds: 4,
    emailSpikeMaxDeliveryAttempts: 7
  });

  const demoWorkspaceNotificationPolicyAfterTenantUpdate = await fetchJson<WorkspaceNotificationPolicyResponse>(
    apiRoutes.workspaceNotificationPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(demoWorkspaceNotificationPolicyAfterTenantUpdate.mode, "override");
  assert.deepEqual(demoWorkspaceNotificationPolicyAfterTenantUpdate.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 3,
    webhookSpikeMaxDeliveryAttempts: 6,
    emailSpikeRetryDelaySeconds: 4,
    emailSpikeMaxDeliveryAttempts: 7
  });
  assert.deepEqual(demoWorkspaceNotificationPolicyAfterTenantUpdate.notificationPolicyOverride, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 4
  });
  assert.equal(
    demoWorkspaceNotificationPolicyAfterTenantUpdate.notificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.updatedByRequestId,
    demoWorkspaceNotificationPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceNotificationPolicyAfterTenantUpdate.effectiveNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 4,
    emailSpikeRetryDelaySeconds: 4,
    emailSpikeMaxDeliveryAttempts: 7
  });

  const updatedTenantNotificationProviderProfilesAfterWorkspaceOverride = await fetchJson<TenantNotificationProviderProfilesResponse>(
    apiRoutes.tenantNotificationProviderProfiles(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultNotificationProviderProfiles: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Tenant Updated Alerts Email Profile",
            deliveryChannel: "email_spike",
            target: "retry-once:tenant-updated-alerts@example.test",
            credentialsRef: "vault://notifications/tenant-updated-alerts-email"
          },
          {
            profileKey: "dead-letter-email-profile",
            displayLabel: "Tenant Updated Dead Letter Email Profile",
            deliveryChannel: "email_spike",
            target: "fail-permanent:tenant-updated-dead-letter@example.test",
            credentialsRef: "vault://notifications/tenant-updated-dead-letter-email"
          }
        ]
      })
    }
  );

  assert.deepEqual(updatedTenantNotificationProviderProfilesAfterWorkspaceOverride.defaultNotificationProviderProfiles, [
    toExpectedNotificationProviderProfileDto({
      profileKey: "alerts-email-profile",
      displayLabel: "Tenant Updated Alerts Email Profile",
      deliveryChannel: "email_spike",
      target: "retry-once:tenant-updated-alerts@example.test",
      credentialsRef: "vault://notifications/tenant-updated-alerts-email"
    }),
    toExpectedNotificationProviderProfileDto({
      profileKey: "dead-letter-email-profile",
      displayLabel: "Tenant Updated Dead Letter Email Profile",
      deliveryChannel: "email_spike",
      target: "fail-permanent:tenant-updated-dead-letter@example.test",
      credentialsRef: "vault://notifications/tenant-updated-dead-letter-email"
    })
  ]);

  const inheritedWorkspaceNotificationProviderProfiles = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceNotificationProviderProfiles.workspaceKey, tenantPolicyWorkspaceKey);
  assert.equal(inheritedWorkspaceNotificationProviderProfiles.mode, "inherit");
  assert.equal(inheritedWorkspaceNotificationProviderProfiles.notificationProviderProfileOverride, null);
  assert.equal(inheritedWorkspaceNotificationProviderProfiles.removedNotificationProviderProfileKeys, null);
  assert.equal(inheritedWorkspaceNotificationProviderProfiles.notificationProviderProfileOverrideRecords, null);
  assert.deepEqual(
    inheritedWorkspaceNotificationProviderProfiles.defaultNotificationProviderProfiles,
    updatedTenantNotificationProviderProfilesAfterWorkspaceOverride.defaultNotificationProviderProfiles
  );
  assert.deepEqual(
    inheritedWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles,
    updatedTenantNotificationProviderProfilesAfterWorkspaceOverride.defaultNotificationProviderProfiles
  );

  const pausedWorkspaceNotificationProviderProfiles = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, emptyWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Paused Empty Workspace Alerts Email Profile",
            rolloutState: "paused",
            deliveryChannel: "email_spike",
            target: "retry-once:paused-alerts@example.test",
            credentialsRef: "vault://notifications/paused-alerts-email"
          }
        ]
      })
    }
  );
  assert.equal(pausedWorkspaceNotificationProviderProfiles.mode, "override");
  assert.deepEqual(pausedWorkspaceNotificationProviderProfiles.notificationProviderProfileOverride, [
    toExpectedNotificationProviderProfileDto({
      profileKey: "alerts-email-profile",
      displayLabel: "Paused Empty Workspace Alerts Email Profile",
      rolloutState: "paused",
      deliveryChannel: "email_spike",
      target: "retry-once:paused-alerts@example.test",
      credentialsRef: "vault://notifications/paused-alerts-email"
    })
  ]);
  assert.deepEqual(
    pausedWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles,
    [
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Paused Empty Workspace Alerts Email Profile",
        rolloutState: "paused",
        deliveryChannel: "email_spike",
        target: "retry-once:paused-alerts@example.test",
        credentialsRef: "vault://notifications/paused-alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "dead-letter-email-profile",
        displayLabel: "Tenant Updated Dead Letter Email Profile",
        deliveryChannel: "email_spike",
        target: "fail-permanent:tenant-updated-dead-letter@example.test",
        credentialsRef: "vault://notifications/tenant-updated-dead-letter-email"
      })
    ]
  );
  const pausedProfile = {
    profileKey: "alerts-email-profile",
    displayLabel: "Paused Empty Workspace Alerts Email Profile",
    enabled: true,
    rolloutState: "paused" as const,
    rolloutPercentage: 100,
    rolloutFallbackProfileKey: null,
    targetProbeMode: "active" as const,
    deliveryChannel: "email_spike" as const,
    target: "retry-once:paused-alerts@example.test",
    credentialsRef: "vault://notifications/paused-alerts-email"
  };
  const pausedProfileResolution = resolveOutboundNotificationDestination({
    target: "profile:alerts-email-profile",
    providerProfiles: [
      pausedProfile,
      {
        profileKey: "dead-letter-email-profile",
        displayLabel: "Tenant Updated Dead Letter Email Profile",
        enabled: true,
        rolloutState: "active",
        rolloutPercentage: 100,
        rolloutFallbackProfileKey: null,
        targetProbeMode: "active",
        deliveryChannel: "email_spike",
        target: "fail-permanent:tenant-updated-dead-letter@example.test",
        credentialsRef: null
      }
    ]
  });
  assert.equal(resolveOutboundNotificationProviderProfileCredentialsStatus(pausedProfile), "reachable");
  assert.equal(resolveOutboundNotificationProviderProfileHealthStatus(pausedProfile), "paused");
  assert.equal(isOutboundNotificationProviderProfileDeliverable(pausedProfile), false);
  assert.deepEqual(pausedProfileResolution, {
    deliveryProfileKey: "alerts-email-profile",
    deliveryChannel: "email_spike",
    deliveryTarget: null
  });
  const unreachableCanaryProfile = {
    profileKey: "unreachable-canary-profile",
    displayLabel: "Unreachable Canary Profile",
    enabled: true,
    rolloutState: "canary" as const,
    rolloutPercentage: 100,
    rolloutFallbackProfileKey: null,
    targetProbeMode: "active" as const,
    deliveryChannel: "email_spike" as const,
    target: "retry-once:unreachable-canary@example.test",
    credentialsRef: "vault://unreachable/notifications/canary-email"
  };
  assert.equal(
    resolveOutboundNotificationProviderProfileCredentialsStatus(unreachableCanaryProfile),
    "unreachable"
  );
  assert.equal(
    resolveOutboundNotificationProviderProfileHealthStatus(unreachableCanaryProfile),
    "credentials_unreachable"
  );
  assert.equal(isOutboundNotificationProviderProfileDeliverable(unreachableCanaryProfile), false);
  assert.deepEqual(
    resolveOutboundNotificationDestination({
      target: "profile:unreachable-canary-profile",
      providerProfiles: [unreachableCanaryProfile]
    }),
    {
      deliveryProfileKey: "unreachable-canary-profile",
      deliveryChannel: "email_spike",
      deliveryTarget: null
    }
  );
  const rolloutFallbackProfile = {
    profileKey: "rollout-canary-profile",
    displayLabel: "Rollout Canary Profile",
    enabled: true,
    rolloutState: "canary" as const,
    rolloutPercentage: 0,
    rolloutFallbackProfileKey: "dead-letter-email-profile",
    targetProbeMode: "active" as const,
    deliveryChannel: "email_spike" as const,
    target: "retry-once:canary-only@example.test",
    credentialsRef: "vault://notifications/canary-only-email"
  };
  const fallbackDeliveryProfile = {
    profileKey: "dead-letter-email-profile",
    displayLabel: "Tenant Updated Dead Letter Email Profile",
    enabled: true,
    rolloutState: "active" as const,
    rolloutPercentage: 100,
    rolloutFallbackProfileKey: null,
    targetProbeMode: "active" as const,
    deliveryChannel: "email_spike" as const,
    target: "fail-permanent:tenant-updated-dead-letter@example.test",
    credentialsRef: null
  };
  assert.equal(
    isOutboundNotificationProviderProfileDeliverable(
      rolloutFallbackProfile,
      "breach-notification-1"
    ),
    false
  );
  assert.deepEqual(
    resolveOutboundNotificationDestination({
      target: "profile:rollout-canary-profile",
      providerProfiles: [rolloutFallbackProfile, fallbackDeliveryProfile],
      rolloutSubjectKey: "breach-notification-1"
    }),
    {
      deliveryProfileKey: "dead-letter-email-profile",
      deliveryChannel: "email_spike",
      deliveryTarget: "fail-permanent:tenant-updated-dead-letter@example.test"
    }
  );

  const demoWorkspaceNotificationProviderProfilesAfterTenantUpdate = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(demoWorkspaceNotificationProviderProfilesAfterTenantUpdate.mode, "override");
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      demoWorkspaceNotificationProviderProfilesAfterTenantUpdate.defaultNotificationProviderProfiles
    ),
    stripNotificationProviderProfileOperationalStates(
      updatedTenantNotificationProviderProfilesAfterWorkspaceOverride.defaultNotificationProviderProfiles
    )
  );
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      demoWorkspaceNotificationProviderProfilesAfterTenantUpdate.notificationProviderProfileOverride
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      })
    ])
  );
  assert.equal(
    demoWorkspaceNotificationProviderProfilesAfterTenantUpdate.removedNotificationProviderProfileKeys,
    null
  );
  assert.equal(
    demoWorkspaceNotificationProviderProfilesAfterTenantUpdate.notificationProviderProfileOverrideRecords?.[0]?.updatedByRequestId,
    demoWorkspaceNotificationProviderProfilesRequestId
  );
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      demoWorkspaceNotificationProviderProfilesAfterTenantUpdate.effectiveNotificationProviderProfiles
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "dead-letter-email-profile",
        displayLabel: "Tenant Updated Dead Letter Email Profile",
        deliveryChannel: "email_spike",
        target: "fail-permanent:tenant-updated-dead-letter@example.test",
        credentialsRef: "vault://notifications/tenant-updated-dead-letter-email"
      })
    ])
  );

  const emptyWorkspaceNotificationProviderProfilesWithCanary = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, emptyWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Paused Empty Workspace Alerts Email Profile",
            rolloutState: "paused",
            deliveryChannel: "email_spike",
            target: "retry-once:paused-alerts@example.test",
            credentialsRef: "vault://notifications/paused-alerts-email"
          },
          {
            profileKey: "canary-email-profile",
            displayLabel: "Unreachable Canary Empty Workspace Email Profile",
            rolloutState: "canary",
            deliveryChannel: "email_spike",
            target: "retry-once:unreachable-canary@example.test",
            credentialsRef: "vault://unreachable/notifications/canary-email"
          },
          {
            profileKey: "rollout-canary-email-profile",
            displayLabel: "Rollout Canary Empty Workspace Email Profile",
            rolloutState: "canary",
            rolloutPercentage: 0,
            rolloutFallbackProfileKey: "dead-letter-email-profile",
            deliveryChannel: "email_spike",
            target: "retry-once:workspace-canary@example.test",
            credentialsRef: "vault://notifications/workspace-canary-email"
          },
          {
            profileKey: "probe-failing-webhook-profile",
            displayLabel: "Probe Failing Empty Workspace Webhook Profile",
            rolloutState: "active",
            deliveryChannel: "webhook_spike",
            target: "probe-unreachable:https://workspace-webhook.example.test/hooks/probe-fail",
            credentialsRef: "vault://notifications/probe-failing-webhook"
          },
          {
            profileKey: "probe-skipped-webhook-profile",
            displayLabel: "Probe Skipped Empty Workspace Webhook Profile",
            rolloutState: "active",
            targetProbeMode: "skip",
            deliveryChannel: "webhook_spike",
            target: "probe-unreachable:https://workspace-webhook.example.test/hooks/probe-skip",
            credentialsRef: "vault://notifications/probe-skipped-webhook"
          }
        ]
      })
    }
  );
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      emptyWorkspaceNotificationProviderProfilesWithCanary.notificationProviderProfileOverride
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Paused Empty Workspace Alerts Email Profile",
        rolloutState: "paused",
        deliveryChannel: "email_spike",
        target: "retry-once:paused-alerts@example.test",
        credentialsRef: "vault://notifications/paused-alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "canary-email-profile",
        displayLabel: "Unreachable Canary Empty Workspace Email Profile",
        rolloutState: "canary",
        deliveryChannel: "email_spike",
        target: "retry-once:unreachable-canary@example.test",
        credentialsRef: "vault://unreachable/notifications/canary-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "probe-failing-webhook-profile",
        displayLabel: "Probe Failing Empty Workspace Webhook Profile",
        rolloutState: "active",
        deliveryChannel: "webhook_spike",
        target: "probe-unreachable:https://workspace-webhook.example.test/hooks/probe-fail",
        credentialsRef: "vault://notifications/probe-failing-webhook"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "probe-skipped-webhook-profile",
        displayLabel: "Probe Skipped Empty Workspace Webhook Profile",
        rolloutState: "active",
        targetProbeMode: "skip",
        deliveryChannel: "webhook_spike",
        target: "probe-unreachable:https://workspace-webhook.example.test/hooks/probe-skip",
        credentialsRef: "vault://notifications/probe-skipped-webhook"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "rollout-canary-email-profile",
        displayLabel: "Rollout Canary Empty Workspace Email Profile",
        rolloutState: "canary",
        rolloutPercentage: 0,
        rolloutFallbackProfileKey: "dead-letter-email-profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-canary@example.test",
        credentialsRef: "vault://notifications/workspace-canary-email"
      })
    ])
  );

  const refreshedTenantNotificationProviderProfiles = await retry(
    () => fetchJson<TenantNotificationProviderProfilesResponse>(
      apiRoutes.tenantNotificationProviderProfiles(demoTenantKey)
    ).then(response => {
      const refreshedTenantAlertsProfile = response.defaultNotificationProviderProfiles.find(
        profile => profile.profileKey === "alerts-email-profile"
      );

      assert.equal(
        refreshedTenantAlertsProfile?.operationalState?.lastCheckedByActorId,
        "provider-operations-service"
      );

      return response;
    }),
    40,
    250
  );
  const refreshedTenantAlertsProfile = refreshedTenantNotificationProviderProfiles.defaultNotificationProviderProfiles.find(
    profile => profile.profileKey === "alerts-email-profile"
  );
  assert.ok(refreshedTenantAlertsProfile?.operationalState);
  assert.equal(refreshedTenantAlertsProfile.operationalState.lastCheckedByActorType, "worker");
  assert.equal(
    refreshedTenantAlertsProfile.operationalState.lastCheckedByActorId,
    "provider-operations-service"
  );
  assert.equal(refreshedTenantAlertsProfile.operationalState.credentialsStatus, "reachable");
  assert.equal(refreshedTenantAlertsProfile.operationalState.healthStatus, "ready");
  assert.equal(refreshedTenantAlertsProfile.operationalState.rolloutStatus, "active_ready");
  assert.equal(refreshedTenantAlertsProfile.operationalState.probeStatus, "succeeded");
  assert.equal(
    refreshedTenantAlertsProfile.operationalState.probeTarget,
    "tenant-updated-alerts@example.test"
  );
  assert.equal(typeof refreshedTenantAlertsProfile.operationalState.probeLatencyMs, "number");
  assert.equal(refreshedTenantAlertsProfile.operationalState.lastCheckError, null);

  const refreshedEmptyWorkspaceNotificationProviderProfiles = await retry(
    () => fetchJson<WorkspaceNotificationProviderProfilesResponse>(
      apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, emptyWorkspaceKey)
    ).then(response => {
      const refreshedCanaryWorkspaceProfile = response.effectiveNotificationProviderProfiles.find(
        profile => profile.profileKey === "canary-email-profile"
      );

      assert.equal(
        refreshedCanaryWorkspaceProfile?.operationalState?.lastCheckedByActorId,
        "provider-operations-service"
      );

      return response;
    }),
    40,
    250
  );
  const refreshedPausedWorkspaceProfile = refreshedEmptyWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles.find(
    profile => profile.profileKey === "alerts-email-profile"
  );
  assert.ok(refreshedPausedWorkspaceProfile?.operationalState);
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.lastCheckedByActorType, "worker");
  assert.equal(
    refreshedPausedWorkspaceProfile.operationalState.lastCheckedByActorId,
    "provider-operations-service"
  );
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.healthStatus, "paused");
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.rolloutStatus, "paused");
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.probeStatus, "skipped_paused");
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.probeTarget, null);
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.probeLatencyMs, null);
  assert.equal(refreshedPausedWorkspaceProfile.operationalState.lastCheckError, null);
  const refreshedCanaryWorkspaceProfile = refreshedEmptyWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles.find(
    profile => profile.profileKey === "canary-email-profile"
  );
  assert.ok(refreshedCanaryWorkspaceProfile?.operationalState);
  assert.equal(refreshedCanaryWorkspaceProfile.operationalState.lastCheckedByActorType, "worker");
  assert.equal(
    refreshedCanaryWorkspaceProfile.operationalState.lastCheckedByActorId,
    "provider-operations-service"
  );
  assert.equal(refreshedCanaryWorkspaceProfile.operationalState.credentialsStatus, "unreachable");
  assert.equal(
    refreshedCanaryWorkspaceProfile.operationalState.healthStatus,
    "credentials_unreachable"
  );
  assert.equal(refreshedCanaryWorkspaceProfile.operationalState.rolloutStatus, "canary_blocked");
  assert.equal(refreshedCanaryWorkspaceProfile.operationalState.probeStatus, "credentials_unreachable");
  assert.equal(
    refreshedCanaryWorkspaceProfile.operationalState.probeTarget,
    "unreachable-canary@example.test"
  );
  assert.equal(refreshedCanaryWorkspaceProfile.operationalState.probeLatencyMs, null);
  assert.equal(
    refreshedCanaryWorkspaceProfile.operationalState.lastCheckError,
    "Credential reference reachability probe failed."
  );
  const refreshedProbeFailingWorkspaceProfile = refreshedEmptyWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles.find(
    profile => profile.profileKey === "probe-failing-webhook-profile"
  );
  assert.ok(refreshedProbeFailingWorkspaceProfile?.operationalState);
  assert.equal(refreshedProbeFailingWorkspaceProfile.operationalState.lastCheckedByActorType, "worker");
  assert.equal(
    refreshedProbeFailingWorkspaceProfile.operationalState.lastCheckedByActorId,
    "provider-operations-service"
  );
  assert.equal(refreshedProbeFailingWorkspaceProfile.operationalState.credentialsStatus, "reachable");
  assert.equal(
    refreshedProbeFailingWorkspaceProfile.operationalState.healthStatus,
    "target_unreachable"
  );
  assert.equal(refreshedProbeFailingWorkspaceProfile.operationalState.rolloutStatus, "active_blocked");
  assert.equal(refreshedProbeFailingWorkspaceProfile.operationalState.probeStatus, "target_unreachable");
  assert.equal(
    refreshedProbeFailingWorkspaceProfile.operationalState.probeTarget,
    "https://workspace-webhook.example.test/hooks/probe-fail"
  );
  assert.equal(refreshedProbeFailingWorkspaceProfile.operationalState.probeLatencyMs, 250);
  assert.equal(
    refreshedProbeFailingWorkspaceProfile.operationalState.lastCheckError,
    "Active target probe failed."
  );
  const refreshedProbeSkippedWorkspaceProfile = refreshedEmptyWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles.find(
    profile => profile.profileKey === "probe-skipped-webhook-profile"
  );
  assert.ok(refreshedProbeSkippedWorkspaceProfile?.operationalState);
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.lastCheckedByActorType, "worker");
  assert.equal(
    refreshedProbeSkippedWorkspaceProfile.operationalState.lastCheckedByActorId,
    "provider-operations-service"
  );
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.credentialsStatus, "reachable");
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.healthStatus, "ready");
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.rolloutStatus, "active_ready");
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.probeStatus, "skipped_by_policy");
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.probeTarget, null);
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.probeLatencyMs, null);
  assert.equal(refreshedProbeSkippedWorkspaceProfile.operationalState.lastCheckError, null);
  const refreshedRolloutCanaryWorkspaceProfile = refreshedEmptyWorkspaceNotificationProviderProfiles.effectiveNotificationProviderProfiles.find(
    profile => profile.profileKey === "rollout-canary-email-profile"
  );
  assert.ok(refreshedRolloutCanaryWorkspaceProfile?.operationalState);
  assert.equal(
    refreshedRolloutCanaryWorkspaceProfile.operationalState.lastCheckedByActorId,
    "provider-operations-service"
  );
  assert.equal(refreshedRolloutCanaryWorkspaceProfile.operationalState.credentialsStatus, "reachable");
  assert.equal(refreshedRolloutCanaryWorkspaceProfile.operationalState.healthStatus, "ready");
  assert.equal(refreshedRolloutCanaryWorkspaceProfile.operationalState.rolloutStatus, "canary_ready");
  assert.equal(refreshedRolloutCanaryWorkspaceProfile.operationalState.probeStatus, "succeeded");
  assert.equal(
    refreshedRolloutCanaryWorkspaceProfile.operationalState.probeTarget,
    "workspace-canary@example.test"
  );
  assert.equal(typeof refreshedRolloutCanaryWorkspaceProfile.operationalState.probeLatencyMs, "number");
  assert.equal(refreshedRolloutCanaryWorkspaceProfile.operationalState.lastCheckError, null);

  const demoWorkspaceNotificationProviderRolloutMetrics = await fetchJson<WorkspaceNotificationProviderProfileRolloutMetricsResponse>(
    apiRoutes.workspaceNotificationProviderProfileRolloutMetrics(demoTenantKey, demoWorkspaceKey)
  );
  const alertsRolloutMetrics = demoWorkspaceNotificationProviderRolloutMetrics.items.find(
    item => item.profileKey === "alerts-email-profile"
  );
  assert.ok(alertsRolloutMetrics);
  assert.equal(alertsRolloutMetrics.rolloutState, "active");
  assert.equal(alertsRolloutMetrics.requestedCount, 1);
  assert.equal(alertsRolloutMetrics.directSelectionCount, 1);
  assert.equal(alertsRolloutMetrics.fallbackRoutedCount, 0);
  assert.equal(alertsRolloutMetrics.fallbackRecipientCount, 0);
  assert.equal(alertsRolloutMetrics.rolloutBlockedCount, 0);
  assert.equal(alertsRolloutMetrics.deliveredCount, 1);
  assert.equal(alertsRolloutMetrics.pendingDeliveryCount, 0);
  assert.equal(alertsRolloutMetrics.deliveryFailedCount, 0);
  assert.ok(alertsRolloutMetrics.lastDeliveredAt);
  assert.equal(alertsRolloutMetrics.promotionReadiness.status, "blocked");
  assert.ok(alertsRolloutMetrics.promotionReadiness.reasons.includes("profile_is_not_canary"));
  const deadLetterRolloutMetrics = demoWorkspaceNotificationProviderRolloutMetrics.items.find(
    item => item.profileKey === "dead-letter-email-profile"
  );
  assert.ok(deadLetterRolloutMetrics);
  assert.equal(deadLetterRolloutMetrics.requestedCount, 1);
  assert.equal(deadLetterRolloutMetrics.directSelectionCount, 0);
  assert.equal(deadLetterRolloutMetrics.fallbackRoutedCount, 0);
  assert.equal(deadLetterRolloutMetrics.fallbackRecipientCount, 0);
  assert.equal(deadLetterRolloutMetrics.rolloutBlockedCount, 0);
  assert.equal(deadLetterRolloutMetrics.deliveredCount, 0);
  assert.equal(deadLetterRolloutMetrics.pendingDeliveryCount, 0);
  assert.equal(deadLetterRolloutMetrics.deliveryFailedCount, 0);
  assert.equal(deadLetterRolloutMetrics.lastDeliveryFailedAt, null);
  assert.equal(deadLetterRolloutMetrics.promotionReadiness.status, "blocked");
  assert.ok(deadLetterRolloutMetrics.promotionReadiness.reasons.includes("profile_is_not_canary"));

  const tenantNotificationProviderPromotionPolicy = await fetchJson<TenantNotificationProviderPromotionPolicyResponse>(
    apiRoutes.tenantNotificationProviderPromotionPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultNotificationProviderPromotionPolicy: {
          evaluationWindowHours: 48,
          minimumRequestedCount: 2,
          minimumDirectSelectionCount: 1,
          minimumDeliveredCount: 1,
          maximumDeliveryFailedCount: 0,
          autoPromoteEnabled: false,
          autoRollbackOnFailureEnabled: false,
          autoPromotionSuppressionSeconds: 0
        }
      })
    }
  );
  assert.deepEqual(tenantNotificationProviderPromotionPolicy.defaultNotificationProviderPromotionPolicy, {
    evaluationWindowHours: 48,
    minimumRequestedCount: 2,
    minimumDirectSelectionCount: 1,
    minimumDeliveredCount: 1,
    maximumDeliveryFailedCount: 0,
    autoPromoteEnabled: false,
    autoRollbackOnFailureEnabled: false,
    autoPromotionSuppressionSeconds: 0
  });

  const inheritedEmptyWorkspaceNotificationProviderPromotionPolicy = await fetchJson<WorkspaceNotificationProviderPromotionPolicyResponse>(
    apiRoutes.workspaceNotificationProviderPromotionPolicy(demoTenantKey, emptyWorkspaceKey)
  );
  assert.equal(inheritedEmptyWorkspaceNotificationProviderPromotionPolicy.mode, "inherit");
  assert.equal(
    inheritedEmptyWorkspaceNotificationProviderPromotionPolicy.notificationProviderPromotionPolicyOverride,
    null
  );
  assert.equal(
    inheritedEmptyWorkspaceNotificationProviderPromotionPolicy.notificationProviderPromotionPolicyOverrideRecords,
    null
  );
  assert.deepEqual(
    inheritedEmptyWorkspaceNotificationProviderPromotionPolicy.defaultNotificationProviderPromotionPolicy,
    {
      evaluationWindowHours: 48,
      minimumRequestedCount: 2,
      minimumDirectSelectionCount: 1,
      minimumDeliveredCount: 1,
      maximumDeliveryFailedCount: 0,
      autoPromoteEnabled: false,
      autoRollbackOnFailureEnabled: false,
      autoPromotionSuppressionSeconds: 0
    }
  );
  assert.deepEqual(
    inheritedEmptyWorkspaceNotificationProviderPromotionPolicy.effectiveNotificationProviderPromotionPolicy,
    {
      evaluationWindowHours: 48,
      minimumRequestedCount: 2,
      minimumDirectSelectionCount: 1,
      minimumDeliveredCount: 1,
      maximumDeliveryFailedCount: 0,
      autoPromoteEnabled: false,
      autoRollbackOnFailureEnabled: false,
      autoPromotionSuppressionSeconds: 0
    }
  );

  const blockedPromotionResponse = await fetchJsonResponse<ErrorResponse>(
    apiRoutes.workspaceNotificationProviderProfilePromote(
      demoTenantKey,
      emptyWorkspaceKey,
      "rollout-canary-email-profile"
    ),
    {
      method: "POST",
      body: JSON.stringify({
        promotedByActorId: "provider-rollout-ops",
        promotionNote: "Attempt promotion before canary burn-in completes."
      })
    },
    409
  );
  assert.equal(
    blockedPromotionResponse.body.error.code,
    "notification_provider_profile_promotion_blocked"
  );
  assert.match(
    blockedPromotionResponse.body.error.message,
    /insufficient_requested_volume/
  );

  const emptyWorkspaceNotificationProviderPromotionPolicyResponse = await fetchJsonResponse<WorkspaceNotificationProviderPromotionPolicyResponse>(
    apiRoutes.workspaceNotificationProviderPromotionPolicy(demoTenantKey, emptyWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderPromotionPolicyOverride: {
          minimumRequestedCount: 0,
          minimumDirectSelectionCount: 0,
          minimumDeliveredCount: 0
        }
      })
    }
  );
  const emptyWorkspaceNotificationProviderPromotionPolicy =
    emptyWorkspaceNotificationProviderPromotionPolicyResponse.body;
  const emptyWorkspaceNotificationProviderPromotionPolicyRequestId =
    emptyWorkspaceNotificationProviderPromotionPolicyResponse.headers.get("x-request-id");
  assert.ok(emptyWorkspaceNotificationProviderPromotionPolicyRequestId);
  assert.equal(emptyWorkspaceNotificationProviderPromotionPolicy.mode, "override");
  assert.deepEqual(
    emptyWorkspaceNotificationProviderPromotionPolicy.defaultNotificationProviderPromotionPolicy,
    {
      evaluationWindowHours: 48,
      minimumRequestedCount: 2,
      minimumDirectSelectionCount: 1,
      minimumDeliveredCount: 1,
      maximumDeliveryFailedCount: 0,
      autoPromoteEnabled: false,
      autoRollbackOnFailureEnabled: false,
      autoPromotionSuppressionSeconds: 0
    }
  );
  assert.deepEqual(
    emptyWorkspaceNotificationProviderPromotionPolicy.notificationProviderPromotionPolicyOverride,
    {
      minimumRequestedCount: 0,
      minimumDirectSelectionCount: 0,
      minimumDeliveredCount: 0
    }
  );
  assert.equal(
    emptyWorkspaceNotificationProviderPromotionPolicy
      .notificationProviderPromotionPolicyOverrideRecords?.minimumRequestedCount?.updatedByRequestId,
    emptyWorkspaceNotificationProviderPromotionPolicyRequestId
  );
  assert.deepEqual(
    emptyWorkspaceNotificationProviderPromotionPolicy.effectiveNotificationProviderPromotionPolicy,
    {
      evaluationWindowHours: 48,
      minimumRequestedCount: 0,
      minimumDirectSelectionCount: 0,
      minimumDeliveredCount: 0,
      maximumDeliveryFailedCount: 0,
      autoPromoteEnabled: false,
      autoRollbackOnFailureEnabled: false,
      autoPromotionSuppressionSeconds: 0
    }
  );

  const emptyWorkspaceNotificationProviderRolloutMetrics = await fetchJson<WorkspaceNotificationProviderProfileRolloutMetricsResponse>(
    apiRoutes.workspaceNotificationProviderProfileRolloutMetrics(demoTenantKey, emptyWorkspaceKey)
  );
  const rolloutCanaryMetrics = emptyWorkspaceNotificationProviderRolloutMetrics.items.find(
    item => item.profileKey === "rollout-canary-email-profile"
  );
  assert.ok(rolloutCanaryMetrics);
  assert.equal(emptyWorkspaceNotificationProviderRolloutMetrics.evaluationWindowHours, 48);
  assert.equal(rolloutCanaryMetrics.rolloutState, "canary");
  assert.equal(rolloutCanaryMetrics.rolloutPercentage, 0);
  assert.equal(rolloutCanaryMetrics.requestedCount, 0);
  assert.equal(rolloutCanaryMetrics.directSelectionCount, 0);
  assert.equal(rolloutCanaryMetrics.deliveredCount, 0);
  assert.equal(rolloutCanaryMetrics.deliveryFailedCount, 0);
  assert.equal(rolloutCanaryMetrics.promotionReadiness.status, "ready");
  assert.deepEqual(rolloutCanaryMetrics.promotionReadiness.reasons, []);

  const promotedRolloutCanaryWorkspaceResponse = await fetchJsonResponse<PromoteWorkspaceNotificationProviderProfileResponse>(
    apiRoutes.workspaceNotificationProviderProfilePromote(
      demoTenantKey,
      emptyWorkspaceKey,
      "rollout-canary-email-profile"
    ),
    {
      method: "POST",
      body: JSON.stringify({
        promotedByActorId: "provider-rollout-ops",
        promotionNote: "Promote the healthy canary after workspace policy relaxation.",
        clearRolloutFallbackProfile: true
      })
    }
  );
  assert.equal(
    promotedRolloutCanaryWorkspaceResponse.body.profileKey,
    "rollout-canary-email-profile"
  );
  const promotedRolloutCanaryWorkspaceProfile = promotedRolloutCanaryWorkspaceResponse.body.workspace.effectiveNotificationProviderProfiles.find(
    profile => profile.profileKey === "rollout-canary-email-profile"
  );
  assert.ok(promotedRolloutCanaryWorkspaceProfile);
  assert.equal(promotedRolloutCanaryWorkspaceProfile.rolloutState, "active");
  assert.equal(promotedRolloutCanaryWorkspaceProfile.rolloutPercentage, 100);
  assert.equal(promotedRolloutCanaryWorkspaceProfile.rolloutFallbackProfileKey, null);
  assert.equal(promotedRolloutCanaryWorkspaceProfile.operationalState, null);
  const promotedRolloutCanaryWorkspaceOverrideRecord = promotedRolloutCanaryWorkspaceResponse.body.workspace.notificationProviderProfileOverrideRecords?.find(
    record => record.profileKey === "rollout-canary-email-profile"
  );
  assert.ok(promotedRolloutCanaryWorkspaceOverrideRecord);
  assert.equal(promotedRolloutCanaryWorkspaceOverrideRecord.updatedByActorId, "provider-rollout-ops");
  assert.equal(
    promotedRolloutCanaryWorkspaceOverrideRecord.value?.rolloutState,
    "active"
  );

  await fetchJson(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, emptyWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "rollout-canary-email-profile",
            displayLabel: "Rollout Canary Email",
            deliveryChannel: "email_spike",
            target: "retry-once:workspace-canary@example.test",
            credentialsRef: "vault://workspace/canary-email",
            rolloutState: "canary",
            rolloutPercentage: 0,
            rolloutFallbackProfileKey: "dead-letter-email-profile"
          }
        ]
      })
    }
  );

  await fetchJson(
    apiRoutes.workspaceNotificationProviderPromotionPolicy(demoTenantKey, emptyWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderPromotionPolicyOverride: {
          minimumRequestedCount: 0,
          minimumDirectSelectionCount: 0,
          minimumDeliveredCount: 0,
          autoPromoteEnabled: true
        }
      })
    }
  );

  const autoPromotedRolloutCanaryWorkspace = await retry(async () => {
    const currentWorkspace = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
      apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, emptyWorkspaceKey)
    );
    const currentProfile = currentWorkspace.effectiveNotificationProviderProfiles.find(
      profile => profile.profileKey === "rollout-canary-email-profile"
    );

    assert.ok(currentProfile, "Expected rollout canary profile to remain visible in empty workspace.");
    assert.equal(currentProfile.rolloutState, "active");
    assert.equal(currentProfile.rolloutPercentage, 100);
    assert.ok(
      currentProfile.rolloutFallbackProfileKey === null ||
        currentProfile.rolloutFallbackProfileKey === "dead-letter-email-profile"
    );
    if (currentProfile.operationalState !== null) {
      assert.equal(currentProfile.operationalState.lastCheckedByActorType, "worker");
      assert.equal(
        currentProfile.operationalState.lastCheckedByActorId,
        "provider-operations-service"
      );
      assert.equal(currentProfile.operationalState.rolloutStatus, "active_ready");
    }

    const currentOverrideRecord =
      currentWorkspace.notificationProviderProfileOverrideRecords?.find(
        record => record.profileKey === "rollout-canary-email-profile"
      );
    assert.ok(currentOverrideRecord);
    assert.equal(currentOverrideRecord.updatedByActorType, "worker");
    assert.equal(currentOverrideRecord.updatedByActorId, "provider-operations-service");
    assert.match(
      currentOverrideRecord.updatedByRequestId,
      /^provider-operations-workspace-notification-provider-profile-auto-promote-/
    );

    return {
      currentWorkspace,
      currentProfile,
      currentOverrideRecord
    };
  }, 30, 250);
  const autoPromotedRolloutCanaryWorkspaceOverrideRecord =
    autoPromotedRolloutCanaryWorkspace.currentOverrideRecord;

  const autoPromoteAuditEvents = await retry(async () => {
    const auditEventsResponse = await fetchJson<{
      items: Array<{ eventType: string; payload: Record<string, unknown> }>;
    }>(
      `${apiRoutes.workspaceAuditEvents(demoTenantKey, emptyWorkspaceKey)}?limit=200`
    );
    const matchingEvent = auditEventsResponse.items.find(
      item =>
        item.eventType ===
          "provider_operations.workspace.notification_provider_profile.auto_promoted" &&
        item.payload.profileKey === "rollout-canary-email-profile"
    );

    assert.ok(matchingEvent, "Expected provider-operations auto-promote audit event.");

    return matchingEvent;
  }, 30, 250);
  assert.equal(autoPromoteAuditEvents.payload.automationAction, "auto_promoted");

  await fetchJson(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "dead-letter-email-profile",
            displayLabel: "Dead Letter Email",
            deliveryChannel: "email_spike",
            target: "dead-letter@example.test",
            credentialsRef: "vault://tenant/alerts-email",
            rolloutState: "active",
            rolloutPercentage: 100,
            rolloutFallbackProfileKey: "alerts-email-profile"
          }
        ]
      })
    }
  );

  await seedFailedSystemCheckEvidenceBreachNotification({
    tenantKey: demoTenantKey,
    workspaceKey: demoWorkspaceKey,
    evidenceKey: deadLetterEvidenceCaptureResponse.body.evidence.evidenceKey,
    escalationTarget: "profile:dead-letter-email-profile",
    createdByActorId: "provider-operations-auto-rollback-seed"
  });

  await fetchJson(
    apiRoutes.workspaceNotificationProviderPromotionPolicy(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderPromotionPolicyOverride: {
          evaluationWindowHours: 1,
          minimumRequestedCount: 0,
          minimumDirectSelectionCount: 0,
          minimumDeliveredCount: 0,
          maximumDeliveryFailedCount: 0,
          autoPromoteEnabled: true,
          autoRollbackOnFailureEnabled: true,
          autoPromotionSuppressionSeconds: 3600
        }
      })
    }
  );

  const autoRolledBackDeadLetterWorkspace = await retry(async () => {
    const currentWorkspace = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
      apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey)
    );
    const currentProfile = currentWorkspace.effectiveNotificationProviderProfiles.find(
      profile => profile.profileKey === "dead-letter-email-profile"
    );

    assert.ok(currentProfile, "Expected dead-letter profile to remain visible in demo workspace.");
    assert.equal(currentProfile.rolloutState, "canary");
    assert.equal(currentProfile.rolloutPercentage, 0);
    assert.equal(currentProfile.rolloutFallbackProfileKey, "alerts-email-profile");
    assert.ok(currentProfile.incidentState);
    assert.equal(currentProfile.incidentState?.incidentType, "auto_rollback_failure");
    assert.equal(currentProfile.incidentState?.reasonCode, "delivery_failures_present");
    assert.equal(currentProfile.incidentState?.deliveryFailedCount, 1);
    assert.equal(currentProfile.incidentState?.openedByActorId, "provider-operations-service");
    assert.ok(currentProfile.incidentState?.suppressionUntil);
    assert.equal(currentProfile.incidentState?.resolvedAt, null);
    assert.equal(currentProfile.incidentState?.resolutionCode, null);
    if (currentProfile.operationalState !== null) {
      assert.equal(currentProfile.operationalState.lastCheckedByActorType, "worker");
      assert.equal(
        currentProfile.operationalState.lastCheckedByActorId,
        "provider-operations-service"
      );
      assert.equal(currentProfile.operationalState.rolloutStatus, "canary_ready");
    }

    return {
      currentWorkspace,
      currentProfile
    };
  }, 30, 250);
  const autoRolledBackDeadLetterWorkspaceOverrideRecord =
    autoRolledBackDeadLetterWorkspace.currentWorkspace.notificationProviderProfileOverrideRecords?.find(
      record => record.profileKey === "dead-letter-email-profile"
    );
  assert.ok(autoRolledBackDeadLetterWorkspaceOverrideRecord);
  assert.equal(autoRolledBackDeadLetterWorkspaceOverrideRecord.updatedByActorType, "worker");
  assert.equal(
    autoRolledBackDeadLetterWorkspaceOverrideRecord.updatedByActorId,
    "provider-operations-service"
  );
  assert.match(
    autoRolledBackDeadLetterWorkspaceOverrideRecord.updatedByRequestId,
    /^provider-operations-workspace-notification-provider-profile-auto-rollback-/
  );

  const autoRollbackAuditEvent = await retry(async () => {
    const auditEventsResponse = await fetchJson<{
      items: Array<{ eventType: string; payload: Record<string, unknown> }>;
    }>(
      `${apiRoutes.workspaceAuditEvents(demoTenantKey, demoWorkspaceKey)}?limit=200`
    );
    const matchingEvent = auditEventsResponse.items.find(
      item =>
        item.eventType ===
          "provider_operations.workspace.notification_provider_profile.auto_rolled_back" &&
        item.payload.profileKey === "dead-letter-email-profile"
    );

    assert.ok(matchingEvent, "Expected provider-operations auto-rollback audit event.");

    return matchingEvent;
  }, 30, 250);
  assert.equal(autoRollbackAuditEvent.payload.automationAction, "auto_rolled_back");
  assert.equal(autoRollbackAuditEvent.payload.deliveryFailedCount, 1);

  const providerIncidentQueue = await retry(async () => {
    const response = await fetchJson<WorkspaceNotificationProviderProfileIncidentsResponse>(
      apiRoutes.workspaceNotificationProviderProfileIncidents(demoTenantKey, demoWorkspaceKey)
    );
    const matchingIncident = response.items.find(
      item => item.profileKey === "dead-letter-email-profile"
    );

    assert.ok(matchingIncident, "Expected dead-letter provider incident to be queued.");
    assert.equal(matchingIncident.status, "open");
    assert.equal(matchingIncident.reasonCode, "delivery_failures_present");
    assert.equal(matchingIncident.deliveryFailedCount, 1);
    assert.equal(matchingIncident.openedByActorId, "provider-operations-service");

    return {
      response,
      matchingIncident
    };
  }, 40, 250);

  const providerGovernanceQueueBeforeAcknowledgement = await fetchJson<WorkspaceNotificationProviderProfileGovernanceQueueResponse>(
    apiRoutes.workspaceNotificationProviderProfileGovernanceQueue(
      demoTenantKey,
      demoWorkspaceKey
    )
  );
  const governanceItemBeforeAcknowledgement =
    providerGovernanceQueueBeforeAcknowledgement.items.find(
      item => item.profileKey === "dead-letter-email-profile"
    );
  assert.ok(governanceItemBeforeAcknowledgement);
  assert.equal(governanceItemBeforeAcknowledgement.governanceStatus, "needs_acknowledgement");
  assert.deepEqual(governanceItemBeforeAcknowledgement.recommendedActions, [
    "acknowledge_incident",
    "investigate_delivery_failures"
  ]);

  const providerGovernanceAlertQueue = await retry(async () => {
    const response = await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertsResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlerts(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&deliveryStatus=delivered`
    );
    const matchingAlert = response.items.find(
      item => item.profileKey === "dead-letter-email-profile"
    );

    assert.ok(matchingAlert, "Expected dead-letter provider governance alert to be delivered.");
    assert.equal(matchingAlert.status, "pending_acknowledgement");
    assert.equal(matchingAlert.governanceStatus, "needs_acknowledgement");
    assert.equal(matchingAlert.deliveryProfileKey, "alerts-email-profile");
    assert.equal(matchingAlert.delivery.channel, "email_spike");
    assert.equal(matchingAlert.delivery.status, "delivered");
    assert.equal(matchingAlert.delivery.target, "tenant-updated-alerts@example.test");
    assert.equal(matchingAlert.createdByActorType, "worker");
    assert.equal(matchingAlert.createdByActorId, "provider-operations-service");

    return matchingAlert;
  }, 30, 250);

  const acknowledgedProviderGovernanceAlert =
    await fetchJson<AcknowledgeNotificationProviderProfileGovernanceAlertResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceAlertAcknowledge(
        demoTenantKey,
        demoWorkspaceKey,
        providerGovernanceAlertQueue.alertId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          acknowledgedByActorId: "ops-governance-1",
          acknowledgementNote: "Governance alert received and linked to provider incident."
        })
      }
    );
  assert.equal(acknowledgedProviderGovernanceAlert.alert.status, "acknowledged");
  assert.equal(
    acknowledgedProviderGovernanceAlert.alert.acknowledgedByActorId,
    "ops-governance-1"
  );
  assert.equal(
    acknowledgedProviderGovernanceAlert.alert.acknowledgementNote,
    "Governance alert received and linked to provider incident."
  );

  const acknowledgedProviderIncident =
    await fetchJson<AcknowledgeNotificationProviderProfileIncidentResponse>(
      apiRoutes.workspaceNotificationProviderProfileIncidentAcknowledge(
        demoTenantKey,
        demoWorkspaceKey,
        providerIncidentQueue.matchingIncident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          acknowledgedByActorId: "ops-governance-1",
          acknowledgementNote: "Investigating rollout failure before manual recovery."
        })
      }
    );
  assert.equal(acknowledgedProviderIncident.incident.status, "acknowledged");
  assert.equal(acknowledgedProviderIncident.incident.acknowledgedByActorId, "ops-governance-1");
  assert.equal(
    acknowledgedProviderIncident.incident.acknowledgementNote,
    "Investigating rollout failure before manual recovery."
  );

  const governanceAlertAcknowledgementAuditEvent = await retry(async () => {
    const auditEventsResponse = await fetchJson<{
      items: Array<{ eventType: string; payload: Record<string, unknown> }>;
    }>(
      `${apiRoutes.workspaceAuditEvents(demoTenantKey, demoWorkspaceKey)}?limit=200`
    );
    const matchingEvent = auditEventsResponse.items.find(
      item =>
        item.eventType ===
          "workspace.notification_provider_profile_governance_alert.acknowledged" &&
        (item.payload.alert as { alertId?: string } | undefined)?.alertId ===
          providerGovernanceAlertQueue.alertId
    );

    assert.ok(matchingEvent, "Expected governance-alert acknowledgement audit event.");

    return matchingEvent;
  }, 20, 250);
  assert.equal(
    (governanceAlertAcknowledgementAuditEvent.payload.alert as { acknowledgedByActorId: string })
      .acknowledgedByActorId,
    "ops-governance-1"
  );

  const providerGovernanceQueueAfterAcknowledgement = await fetchJson<WorkspaceNotificationProviderProfileGovernanceQueueResponse>(
    apiRoutes.workspaceNotificationProviderProfileGovernanceQueue(
      demoTenantKey,
      demoWorkspaceKey
    )
  );
  const governanceItemAfterAcknowledgement =
    providerGovernanceQueueAfterAcknowledgement.items.find(
      item => item.profileKey === "dead-letter-email-profile"
    );
  assert.ok(governanceItemAfterAcknowledgement);
  assert.equal(governanceItemAfterAcknowledgement.governanceStatus, "suppressed");
  assert.deepEqual(governanceItemAfterAcknowledgement.recommendedActions, [
    "wait_for_suppression_expiry",
    "investigate_delivery_failures"
  ]);

  await setSystemCheckEvidenceBreachNotificationCreatedAt({
    evidenceKey: deadLetterEvidenceCaptureResponse.body.evidence.evidenceKey,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  });

  const suppressedDeadLetterRolloutMetrics = await fetchJson<WorkspaceNotificationProviderProfileRolloutMetricsResponse>(
    `${apiRoutes.workspaceNotificationProviderProfileRolloutMetrics(demoTenantKey, demoWorkspaceKey)}?windowHours=1`
  );
  const suppressedDeadLetterMetrics = suppressedDeadLetterRolloutMetrics.items.find(
    item => item.profileKey === "dead-letter-email-profile"
  );
  assert.ok(suppressedDeadLetterMetrics);
  assert.equal(suppressedDeadLetterMetrics.deliveryFailedCount, 0);
  assert.equal(suppressedDeadLetterMetrics.requestedCount, 0);
  assert.equal(suppressedDeadLetterMetrics.promotionReadiness.status, "blocked");
  assert.deepEqual(
    suppressedDeadLetterMetrics.promotionReadiness.reasons,
    ["promotion_suppressed_after_auto_rollback"]
  );

  const stillSuppressedDeadLetterWorkspace = await retry(async () => {
    const currentWorkspace = await fetchJson<WorkspaceNotificationProviderProfilesResponse>(
      apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey)
    );
    const currentProfile = currentWorkspace.effectiveNotificationProviderProfiles.find(
      profile => profile.profileKey === "dead-letter-email-profile"
    );

    assert.ok(currentProfile);
    assert.equal(currentProfile.rolloutState, "canary");
    assert.equal(currentProfile.rolloutPercentage, 0);
    assert.ok(currentProfile.incidentState?.suppressionUntil);

    return currentProfile;
  }, 20, 250);
  assert.equal(stillSuppressedDeadLetterWorkspace.profileKey, "dead-letter-email-profile");

  const stillSuppressedGovernanceQueue = await fetchJson<WorkspaceNotificationProviderProfileGovernanceQueueResponse>(
    `${apiRoutes.workspaceNotificationProviderProfileGovernanceQueue(
      demoTenantKey,
      demoWorkspaceKey
    )}?profileKey=dead-letter-email-profile&windowHours=1`
  );
  assert.equal(stillSuppressedGovernanceQueue.items.length, 1);
  assert.equal(stillSuppressedGovernanceQueue.items[0].governanceStatus, "suppressed");
  assert.deepEqual(stillSuppressedGovernanceQueue.items[0].recommendedActions, [
    "wait_for_suppression_expiry",
    "investigate_delivery_failures"
  ]);

  const tenantRecoveryGovernanceNotificationPolicyResponse =
    await fetchJsonResponse<TenantRecoveryGovernanceNotificationPolicyResponse>(
      apiRoutes.tenantRecoveryGovernanceNotificationPolicy(demoTenantKey),
      {
        method: "PATCH",
        body: JSON.stringify({
          defaultRecoveryGovernanceNotificationPolicy: {
            breachNotificationDeliverySelectionMode: "force_email_spike",
            webhookSpikeRetryDelaySeconds: 21,
            webhookSpikeMaxDeliveryAttempts: 22,
            emailSpikeRetryDelaySeconds: 23,
            emailSpikeMaxDeliveryAttempts: 24
          }
        })
      }
    );
  const tenantRecoveryGovernanceNotificationPolicy =
    tenantRecoveryGovernanceNotificationPolicyResponse.body;
  const tenantRecoveryGovernanceNotificationPolicyRequestId =
    tenantRecoveryGovernanceNotificationPolicyResponse.headers.get("x-request-id");
  assert.ok(tenantRecoveryGovernanceNotificationPolicyRequestId);
  assert.deepEqual(
    tenantRecoveryGovernanceNotificationPolicy.defaultRecoveryGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 21,
      webhookSpikeMaxDeliveryAttempts: 22,
      emailSpikeRetryDelaySeconds: 23,
      emailSpikeMaxDeliveryAttempts: 24
    }
  );

  const workspaceRecoveryGovernanceNotificationPolicyResponse =
    await fetchJsonResponse<WorkspaceRecoveryGovernanceNotificationPolicyResponse>(
      apiRoutes.workspaceRecoveryGovernanceNotificationPolicy(demoTenantKey, demoWorkspaceKey),
      {
        method: "PATCH",
        body: JSON.stringify({
          mode: "override",
          recoveryGovernanceNotificationPolicyOverride: {
            breachNotificationDeliverySelectionMode: "force_email_spike",
            emailSpikeRetryDelaySeconds: 1,
            emailSpikeMaxDeliveryAttempts: 6
          }
        })
      }
    );
  const workspaceRecoveryGovernanceNotificationPolicy =
    workspaceRecoveryGovernanceNotificationPolicyResponse.body;
  const workspaceRecoveryGovernanceNotificationPolicyRequestId =
    workspaceRecoveryGovernanceNotificationPolicyResponse.headers.get("x-request-id");
  assert.ok(workspaceRecoveryGovernanceNotificationPolicyRequestId);
  assert.equal(workspaceRecoveryGovernanceNotificationPolicy.mode, "override");
  assert.deepEqual(
    workspaceRecoveryGovernanceNotificationPolicy.effectiveRecoveryGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 21,
      webhookSpikeMaxDeliveryAttempts: 22,
      emailSpikeRetryDelaySeconds: 1,
      emailSpikeMaxDeliveryAttempts: 6
    }
  );

  const forcedPromotionAfterIncident = await fetchJson<PromoteWorkspaceNotificationProviderProfileResponse>(
    apiRoutes.workspaceNotificationProviderProfilePromote(
      demoTenantKey,
      demoWorkspaceKey,
      "dead-letter-email-profile"
    ),
    {
      method: "POST",
      body: JSON.stringify({
        promotedByActorId: "ops-governance-1",
        promotionNote: "Manual recovery after incident acknowledgement.",
        forcePromotion: true,
        clearRolloutFallbackProfile: false,
        evaluationWindowHours: 1
      })
    }
  );
  assert.equal(
    forcedPromotionAfterIncident.workspace.effectiveNotificationProviderProfiles.find(
      profile => profile.profileKey === "dead-letter-email-profile"
    )?.rolloutState,
    "active"
  );

  const resolvedProviderIncidentQueue = await retry(async () => {
    const response = await fetchJson<WorkspaceNotificationProviderProfileIncidentsResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileIncidents(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile`
    );
    const resolvedIncident = response.items[0];

    assert.ok(resolvedIncident);
    assert.equal(resolvedIncident.status, "resolved");
    assert.equal(resolvedIncident.resolutionCode, "manually_promoted");
    assert.ok(resolvedIncident.resolvedAt);

    return resolvedIncident;
  }, 20, 250);
  assert.equal(
    resolvedProviderIncidentQueue.profileKey,
    "dead-letter-email-profile"
  );

  const recoveryGovernanceAlert = await retry(async () => {
    const response = await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertsResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlerts(demoTenantKey, demoWorkspaceKey)}?profileKey=dead-letter-email-profile`
    );
    const matchingAlert = response.items.find(
      item =>
        item.incidentId === resolvedProviderIncidentQueue.incidentId &&
        item.alertClass === "incident_resolved"
    );

    assert.ok(matchingAlert, "Expected a recovery governance alert after manual promotion.");
    assert.equal(matchingAlert.governanceStatus, "resolved_recovery");
    assert.equal(matchingAlert.delivery.channel, "email_spike");
    assert.equal(matchingAlert.delivery.maxAttempts, 6);
    assert.notEqual(matchingAlert.delivery.status, "pending_delivery");

    return matchingAlert;
  }, 20, 250);
  assert.equal(recoveryGovernanceAlert.profileKey, "dead-letter-email-profile");

  const recoveryGovernanceAlertMetrics = await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse>(
    `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlertMetrics(
      demoTenantKey,
      demoWorkspaceKey
    )}?profileKey=dead-letter-email-profile&alertClass=incident_resolved`
  );
  const recoveryGovernanceAlertMetricsItem =
    recoveryGovernanceAlertMetrics.items[0];
  assert.ok(recoveryGovernanceAlertMetricsItem);
  assert.equal(recoveryGovernanceAlertMetricsItem.profileKey, "dead-letter-email-profile");
  assert.equal(recoveryGovernanceAlertMetricsItem.alertClass, "incident_resolved");
  assert.equal(recoveryGovernanceAlertMetricsItem.totalCount, 1);
  assert.equal(recoveryGovernanceAlertMetricsItem.pendingAcknowledgementCount, 1);
  assert.equal(recoveryGovernanceAlertMetricsItem.acknowledgedCount, 0);
  assert.equal(recoveryGovernanceAlertMetricsItem.pendingDeliveryCount, 0);
  assert.equal(recoveryGovernanceAlertMetricsItem.deliveredCount, 1);
  assert.equal(recoveryGovernanceAlertMetricsItem.deliveryFailedCount, 0);
  assert.ok(recoveryGovernanceAlertMetricsItem.latestDeliveredAt);

  const recoveryGovernanceAlertTrends =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlertTrends(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&alertClass=incident_resolved&windowHours=24&bucketHours=24`
    );
  const recoveryGovernanceAlertTrendItem =
    recoveryGovernanceAlertTrends.items[0];
  assert.ok(recoveryGovernanceAlertTrendItem);
  assert.equal(recoveryGovernanceAlertTrendItem.profileKey, "dead-letter-email-profile");
  assert.equal(recoveryGovernanceAlertTrendItem.alertClass, "incident_resolved");
  assert.equal(recoveryGovernanceAlertTrendItem.totalCount, 1);
  assert.equal(recoveryGovernanceAlertTrends.windowHours, 24);
  assert.equal(recoveryGovernanceAlertTrends.bucketHours, 24);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets.length, 1);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets[0].totalCount, 1);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets[0].pendingAcknowledgementCount, 1);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets[0].acknowledgedCount, 0);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets[0].pendingDeliveryCount, 0);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets[0].deliveredCount, 1);
  assert.equal(recoveryGovernanceAlertTrendItem.buckets[0].deliveryFailedCount, 0);

  const resolvedGovernanceCorrelations =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCorrelationsResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCorrelations(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&status=resolved`
    );
  const resolvedGovernanceCorrelation = resolvedGovernanceCorrelations.items.find(
    item => item.incident.incidentId === resolvedProviderIncidentQueue.incidentId
  );
  assert.ok(resolvedGovernanceCorrelation);
  assert.equal(resolvedGovernanceCorrelation.profileKey, "dead-letter-email-profile");
  assert.equal(resolvedGovernanceCorrelation.incident.status, "resolved");
  assert.equal(resolvedGovernanceCorrelation.alerts.length, 2);
  assert.ok(
    resolvedGovernanceCorrelation.alerts.some(
      item => item.alertClass === "incident_open"
    )
  );
  assert.ok(
    resolvedGovernanceCorrelation.alerts.some(
      item => item.alertClass === "incident_resolved"
    )
  );
  assert.ok(
    resolvedGovernanceCorrelation.timeline.some(
      item => item.eventType === "workspace.notification_provider_profile.promoted"
    )
  );
  assert.ok(
    resolvedGovernanceCorrelation.timeline.some(
      item =>
        item.eventType ===
        "notification_service.notification_provider_profile.governance_alert.delivered"
    )
  );

  const resolvedGovernanceCases =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCasesResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCases(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&status=resolved`
    );
  const resolvedGovernanceCase = resolvedGovernanceCases.items.find(
    item => item.incident.incidentId === resolvedProviderIncidentQueue.incidentId
  );
  assert.ok(resolvedGovernanceCase);
  assert.equal(resolvedGovernanceCase.caseStatus, "awaiting_alert_acknowledgement");
  assert.equal(resolvedGovernanceCase.assignmentStatus, "unassigned");
  assert.equal(resolvedGovernanceCase.assignedToActorId, null);
  assert.equal(resolvedGovernanceCase.failedAlertCount, 0);
  assert.equal(resolvedGovernanceCase.pendingAlertAcknowledgementCount, 1);
  assert.equal(resolvedGovernanceCase.closeReadiness, "blocked");
  assert.deepEqual(resolvedGovernanceCase.closeBlockedByChecklistItemKeys, [
    "review-recovery-alert"
  ]);
  assert.deepEqual(resolvedGovernanceCase.recommendedActions, [
    "assign_case",
    "complete_required_checklist",
    "acknowledge_governance_alert"
  ]);

  const assignedResolvedGovernanceCase =
    await fetchJson<AssignNotificationProviderProfileGovernanceCaseResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseAssign(
        demoTenantKey,
        demoWorkspaceKey,
        resolvedProviderIncidentQueue.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          assignedByActorId: "ops-governance-lead",
          assignedToActorId: "ops-governance-analyst",
          assignmentNote: "Handle recovery acknowledgement and confirm rollout state.",
          slaSeconds: 1
        })
      }
    );
  assert.equal(assignedResolvedGovernanceCase.caseItem.assignmentStatus, "assigned");
  assert.equal(
    assignedResolvedGovernanceCase.caseItem.assignedToActorId,
    "ops-governance-analyst"
  );
  assert.equal(
    assignedResolvedGovernanceCase.caseItem.assignedByActorId,
    "ops-governance-lead"
  );
  assert.equal(
    assignedResolvedGovernanceCase.caseItem.assignmentNote,
    "Handle recovery acknowledgement and confirm rollout state."
  );
  assert.equal(assignedResolvedGovernanceCase.caseItem.slaSeconds, 1);
  assert.ok(assignedResolvedGovernanceCase.caseItem.slaDueAt);
  assert.equal(assignedResolvedGovernanceCase.caseItem.slaStatus, "on_track");
  assert.deepEqual(assignedResolvedGovernanceCase.caseItem.recommendedActions, [
    "complete_required_checklist",
    "acknowledge_governance_alert"
  ]);

  await delay(1_200);

  const breachedResolvedGovernanceCases =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCasesResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCases(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&status=resolved&slaStatus=breached`
    );
  const breachedResolvedGovernanceCase = breachedResolvedGovernanceCases.items.find(
    item => item.incident.incidentId === resolvedProviderIncidentQueue.incidentId
  );
  assert.ok(breachedResolvedGovernanceCase);
  assert.equal(breachedResolvedGovernanceCase.slaStatus, "breached");
  assert.deepEqual(breachedResolvedGovernanceCase.recommendedActions, [
    "complete_required_checklist",
    "escalate_case",
    "acknowledge_governance_alert"
  ]);

  const escalatedResolvedGovernanceCase =
    await fetchJson<EscalateNotificationProviderProfileGovernanceCaseResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseEscalate(
        demoTenantKey,
        demoWorkspaceKey,
        resolvedProviderIncidentQueue.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          escalatedByActorId: "ops-governance-manager",
          escalationNote: "Recovery acknowledgement breached SLA, escalating to manager."
        })
      }
    );
  assert.equal(escalatedResolvedGovernanceCase.caseItem.slaStatus, "escalated");
  assert.equal(
    escalatedResolvedGovernanceCase.caseItem.escalatedByActorId,
    "ops-governance-manager"
  );
  assert.equal(
    escalatedResolvedGovernanceCase.caseItem.escalationNote,
    "Recovery acknowledgement breached SLA, escalating to manager."
  );
  assert.deepEqual(escalatedResolvedGovernanceCase.caseItem.recommendedActions, [
    "complete_required_checklist",
    "acknowledge_governance_alert"
  ]);

  const escalatedGovernanceCaseQueue =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCaseQueue(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&slaStatus=escalated`
    );
  const escalatedGovernanceCaseQueueItem = escalatedGovernanceCaseQueue.items.find(
    item => item.caseItem.incident.incidentId === resolvedProviderIncidentQueue.incidentId
  );
  assert.ok(escalatedGovernanceCaseQueueItem);
  assert.equal(escalatedGovernanceCaseQueueItem.priorityRank, 10);
  assert.equal(escalatedGovernanceCaseQueueItem.priorityReason, "case_escalated");
  assert.equal(escalatedGovernanceCaseQueueItem.caseItem.slaStatus, "escalated");
  assert.equal(escalatedGovernanceCaseQueueItem.caseItem.assignmentStatus, "assigned");

  const resolvedGovernanceQueue = await fetchJson<WorkspaceNotificationProviderProfileGovernanceQueueResponse>(
    `${apiRoutes.workspaceNotificationProviderProfileGovernanceQueue(
      demoTenantKey,
      demoWorkspaceKey
    )}?profileKey=dead-letter-email-profile`
  );
  assert.equal(resolvedGovernanceQueue.items.length, 0);

  await fetchJson(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Workspace Alerts Email",
            deliveryChannel: "email_spike",
            target: "fail-permanent:governance-alert-dead@example.test",
            credentialsRef: "vault://tenant/alerts-email",
            rolloutState: "active",
            rolloutPercentage: 100,
            rolloutFallbackProfileKey: null
          }
        ]
      })
    }
  );

  const seededFailedGovernanceAlertId = await seedFailedNotificationProviderProfileGovernanceAlert({
    tenantKey: demoTenantKey,
    workspaceKey: demoWorkspaceKey,
    profileKey: "dead-letter-email-profile",
    createdByActorId: "provider-governance-alert-dead-letter-seed"
  });

  const governanceAlertDeadLetterQueue = await retry(async () => {
    const response = await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueue(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile`
    );
    const matchingAlert = response.items.find(
      item => item.alertId === seededFailedGovernanceAlertId
    );

    assert.ok(matchingAlert, "Expected dead-letter governance alert to enter the dead-letter queue.");
    assert.equal(matchingAlert.delivery.status, "delivery_failed");

    return matchingAlert;
  }, 60, 250);

  const governanceAlertDeadLetterCases =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCasesResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCases(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&caseStatus=awaiting_redrive`
    );
  const governanceAlertDeadLetterCase = governanceAlertDeadLetterCases.items.find(
    item => item.alerts.some(alert => alert.alertId === seededFailedGovernanceAlertId)
  );
  assert.ok(governanceAlertDeadLetterCase);
  assert.equal(governanceAlertDeadLetterCase.caseStatus, "awaiting_redrive");
  assert.equal(governanceAlertDeadLetterCase.assignmentStatus, "unassigned");
  assert.equal(governanceAlertDeadLetterCase.failedAlertCount, 1);
  assert.equal(governanceAlertDeadLetterCase.closeReadiness, "blocked");
  assert.deepEqual(governanceAlertDeadLetterCase.closeBlockedByChecklistItemKeys, [
    "verify-target",
    "document-disposition"
  ]);
  assert.deepEqual(governanceAlertDeadLetterCase.recommendedActions, [
    "assign_case",
    "complete_required_checklist",
    "redrive_governance_alert"
  ]);

  const unassignedGovernanceCaseQueue =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCaseQueue(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&caseStatus=awaiting_redrive&assignmentStatus=unassigned`
    );
  const deadLetterGovernanceCaseQueueItem = unassignedGovernanceCaseQueue.items.find(
    item => item.caseItem.alerts.some(alert => alert.alertId === seededFailedGovernanceAlertId)
  );
  assert.ok(deadLetterGovernanceCaseQueueItem);
  assert.equal(deadLetterGovernanceCaseQueueItem.priorityRank, 30);
  assert.equal(deadLetterGovernanceCaseQueueItem.priorityReason, "delivery_failed");
  assert.equal(deadLetterGovernanceCaseQueueItem.caseItem.caseStatus, "awaiting_redrive");
  assert.equal(deadLetterGovernanceCaseQueueItem.caseItem.assignmentStatus, "unassigned");

  const governanceCaseBoard =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCaseBoardResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCaseBoard(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile`
    );
  const needsAssignmentLane = governanceCaseBoard.lanes.find(
    lane => lane.laneKey === "needs_assignment"
  );
  assert.ok(needsAssignmentLane);
  const boardDeadLetterCase = needsAssignmentLane.items.find(item =>
    item.caseItem.alerts.some(alert => alert.alertId === seededFailedGovernanceAlertId)
  );
  assert.ok(boardDeadLetterCase);
  assert.equal(boardDeadLetterCase.caseItem.caseStatus, "awaiting_redrive");
  assert.equal(boardDeadLetterCase.caseItem.assignmentStatus, "unassigned");

  const breachedOrEscalatedLane = governanceCaseBoard.lanes.find(
    lane => lane.laneKey === "breached_or_escalated"
  );
  assert.ok(breachedOrEscalatedLane);
  const boardEscalatedCase = breachedOrEscalatedLane.items.find(
    item => item.caseItem.incident.incidentId === resolvedProviderIncidentQueue.incidentId
  );
  assert.ok(boardEscalatedCase);
  assert.equal(boardEscalatedCase.caseItem.slaStatus, "escalated");
  assert.equal(boardEscalatedCase.caseItem.assignmentStatus, "assigned");

  const recoveryTransitionedDeadLetterCase =
    await fetchJson<TransitionNotificationProviderProfileGovernanceCaseResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseTransition(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          transition: "start_recovery",
          transitionedByActorId: "ops-governance-analyst",
          transitionNote: "Starting manual recovery workflow for the failed governance alert."
        })
      }
    );
  assert.equal(recoveryTransitionedDeadLetterCase.caseItem.workflowState, "in_recovery");
  assert.equal(
    recoveryTransitionedDeadLetterCase.caseItem.workflowUpdatedByActorId,
    "ops-governance-analyst"
  );
  assert.equal(recoveryTransitionedDeadLetterCase.caseItem.closeReadiness, "blocked");
  assert.deepEqual(
    recoveryTransitionedDeadLetterCase.caseItem.closeBlockedByChecklistItemKeys,
    ["verify-target", "document-disposition"]
  );
  assert.deepEqual(recoveryTransitionedDeadLetterCase.caseItem.availableTransitions, [
    "mark_waiting_external"
  ]);

  const waitingExternalDeadLetterCase =
    await fetchJson<TransitionNotificationProviderProfileGovernanceCaseResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseTransition(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          transition: "mark_waiting_external",
          transitionedByActorId: "ops-governance-analyst",
          transitionNote: "Waiting for external mail-routing correction before redrive."
        })
      }
    );
  assert.equal(waitingExternalDeadLetterCase.caseItem.workflowState, "waiting_external");
  assert.deepEqual(waitingExternalDeadLetterCase.caseItem.availableTransitions, [
    "start_recovery"
  ]);

  await fetchJsonResponse(
    apiRoutes.workspaceNotificationProviderProfileGovernanceCaseTransition(
      demoTenantKey,
      demoWorkspaceKey,
      governanceAlertDeadLetterCase.incident.incidentId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        transition: "close_case",
        transitionedByActorId: "ops-governance-manager",
        transitionNote: "Trying to close before the required checklist is done.",
        resolutionCode: "target_corrected"
      })
    },
    409
  );

  const deadLetterCaseWithRequiredChecklistA =
    await fetchJson<UpsertNotificationProviderProfileGovernanceCaseChecklistItemResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseUpsertChecklistItem(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          itemKey: "verify-target",
          label: "Verify corrected provider target",
          status: "completed",
          updatedByActorId: "ops-governance-analyst",
          note: "Verified corrected provider target."
        })
      }
    );
  assert.equal(
    deadLetterCaseWithRequiredChecklistA.caseItem.closeReadiness,
    "blocked"
  );
  assert.deepEqual(
    deadLetterCaseWithRequiredChecklistA.caseItem.closeBlockedByChecklistItemKeys,
    ["document-disposition"]
  );

  const deadLetterCaseWithRequiredChecklistB =
    await fetchJson<UpsertNotificationProviderProfileGovernanceCaseChecklistItemResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseUpsertChecklistItem(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          itemKey: "document-disposition",
          label: "Document disposition before closure",
          status: "completed",
          updatedByActorId: "ops-governance-manager",
          note: "Documented closure disposition after target correction."
        })
      }
    );
  assert.equal(deadLetterCaseWithRequiredChecklistB.caseItem.closeReadiness, "ready");
  assert.deepEqual(deadLetterCaseWithRequiredChecklistB.caseItem.closeBlockedByChecklistItemKeys, []);
  assert.deepEqual(deadLetterCaseWithRequiredChecklistB.caseItem.availableTransitions, [
    "start_recovery",
    "close_case"
  ]);

  await retry(async () => {
    const governanceCasesResponse =
      await fetchJson<WorkspaceNotificationProviderProfileGovernanceCasesResponse>(
        `${apiRoutes.workspaceNotificationProviderProfileGovernanceCases(
          demoTenantKey,
          demoWorkspaceKey
        )}?profileKey=dead-letter-email-profile&caseStatus=awaiting_redrive&auditLimit=5000`
      );
    const readyDeadLetterCase = governanceCasesResponse.items.find(
      item => item.incident.incidentId === governanceAlertDeadLetterCase.incident.incidentId
    );

    assert.ok(readyDeadLetterCase);
    assert.equal(readyDeadLetterCase.closeReadiness, "ready");
    assert.deepEqual(readyDeadLetterCase.closeBlockedByChecklistItemKeys, []);
    assert.deepEqual(readyDeadLetterCase.availableTransitions, [
      "start_recovery",
      "close_case"
    ]);
  }, 20, 100);

  const closedDeadLetterCase =
    await retry(
      () =>
        fetchJson<TransitionNotificationProviderProfileGovernanceCaseResponse>(
          apiRoutes.workspaceNotificationProviderProfileGovernanceCaseTransition(
            demoTenantKey,
            demoWorkspaceKey,
            governanceAlertDeadLetterCase.incident.incidentId
          ),
          {
            method: "POST",
            body: JSON.stringify({
              transition: "close_case",
              transitionedByActorId: "ops-governance-manager",
              transitionNote: "Closing the case until the provider target is corrected.",
              resolutionCode: "target_corrected"
            })
          }
        ),
      20,
      100
    );
  assert.equal(closedDeadLetterCase.caseItem.workflowState, "closed");
  assert.equal(closedDeadLetterCase.caseItem.resolutionCode, "target_corrected");
  assert.deepEqual(closedDeadLetterCase.caseItem.recommendedActions, ["reopen_case"]);
  assert.deepEqual(closedDeadLetterCase.caseItem.availableTransitions, ["reopen_case"]);

  const governanceCaseQueueAfterClose =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCaseQueue(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile`
    );
  assert.equal(
    governanceCaseQueueAfterClose.items.some(item =>
      item.caseItem.alerts.some(alert => alert.alertId === seededFailedGovernanceAlertId)
    ),
    false
  );

  const governanceCaseBoardAfterClose =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCaseBoardResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCaseBoard(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile`
    );
  assert.equal(
    governanceCaseBoardAfterClose.lanes.some(lane =>
      lane.items.some(item =>
        item.caseItem.alerts.some(alert => alert.alertId === seededFailedGovernanceAlertId)
      )
    ),
    false
  );

  const reopenedDeadLetterCase =
    await fetchJson<TransitionNotificationProviderProfileGovernanceCaseResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseTransition(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          transition: "reopen_case",
          transitionedByActorId: "ops-governance-manager",
          transitionNote: "Reopening after provider target correction is ready for redrive."
        })
      }
    );
  assert.equal(reopenedDeadLetterCase.caseItem.workflowState, "open");
  assert.equal(reopenedDeadLetterCase.caseItem.resolutionCode, null);
  assert.deepEqual(reopenedDeadLetterCase.caseItem.availableTransitions, [
    "start_recovery",
    "mark_waiting_external",
    "close_case"
  ]);

  const governanceCaseQueueAfterReopen =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceCaseQueue(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&caseStatus=awaiting_redrive`
    );
  assert.ok(
    governanceCaseQueueAfterReopen.items.some(item =>
      item.caseItem.alerts.some(alert => alert.alertId === seededFailedGovernanceAlertId)
    )
  );

  const deadLetterCaseWithNote =
    await fetchJson<AddNotificationProviderProfileGovernanceCaseNoteResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseAddNote(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          createdByActorId: "ops-governance-analyst",
          noteBody: "Verified provider target correction and prepared manual redrive."
        })
      }
    );
  assert.equal(deadLetterCaseWithNote.caseItem.notes.length, 1);
  assert.equal(
    deadLetterCaseWithNote.caseItem.notes[0].createdByActorId,
    "ops-governance-analyst"
  );
  assert.match(
    deadLetterCaseWithNote.caseItem.notes[0].body,
    /prepared manual redrive/
  );

  const deadLetterCaseWithChecklistItem =
    await fetchJson<UpsertNotificationProviderProfileGovernanceCaseChecklistItemResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseUpsertChecklistItem(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          itemKey: "manual-redrive",
          label: "Perform manual redrive",
          status: "open",
          updatedByActorId: "ops-governance-analyst",
          note: "Manual redrive is prepared and waiting for execution."
        })
      }
    );
  const manualRedriveOpenChecklistItem =
    deadLetterCaseWithChecklistItem.caseItem.checklistItems.find(
      item => item.itemKey === "manual-redrive"
    );
  assert.ok(manualRedriveOpenChecklistItem);
  assert.equal(manualRedriveOpenChecklistItem.status, "open");

  const deadLetterCaseWithCompletedChecklistItem =
    await fetchJson<UpsertNotificationProviderProfileGovernanceCaseChecklistItemResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceCaseUpsertChecklistItem(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterCase.incident.incidentId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          itemKey: "manual-redrive",
          label: "Perform manual redrive",
          status: "completed",
          updatedByActorId: "ops-governance-manager",
          note: "Completed manual redrive and confirmed delivery path."
        })
      }
    );
  const manualRedriveCompletedChecklistItem =
    deadLetterCaseWithCompletedChecklistItem.caseItem.checklistItems.find(
      item => item.itemKey === "manual-redrive"
    );
  assert.ok(manualRedriveCompletedChecklistItem);
  assert.equal(manualRedriveCompletedChecklistItem.status, "completed");
  assert.equal(
    manualRedriveCompletedChecklistItem.updatedByActorId,
    "ops-governance-manager"
  );
  assert.match(
    manualRedriveCompletedChecklistItem.note ?? "",
    /Completed manual redrive and confirmed delivery path\./
  );

  const tenantGovernanceNotificationPolicyResponse =
    await fetchJsonResponse<TenantGovernanceNotificationPolicyResponse>(
      apiRoutes.tenantGovernanceNotificationPolicy(demoTenantKey),
      {
        method: "PATCH",
        body: JSON.stringify({
          defaultGovernanceNotificationPolicy: {
            breachNotificationDeliverySelectionMode: "force_email_spike",
            webhookSpikeRetryDelaySeconds: 13,
            webhookSpikeMaxDeliveryAttempts: 14,
            emailSpikeRetryDelaySeconds: 15,
            emailSpikeMaxDeliveryAttempts: 16
          }
        })
      }
    );
  const tenantGovernanceNotificationPolicy = tenantGovernanceNotificationPolicyResponse.body;
  const tenantGovernanceNotificationPolicyRequestId =
    tenantGovernanceNotificationPolicyResponse.headers.get("x-request-id");
  assert.ok(tenantGovernanceNotificationPolicyRequestId);
  assert.deepEqual(tenantGovernanceNotificationPolicy.defaultGovernanceNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 13,
    webhookSpikeMaxDeliveryAttempts: 14,
    emailSpikeRetryDelaySeconds: 15,
    emailSpikeMaxDeliveryAttempts: 16
  });

  const inheritedWorkspaceGovernanceNotificationPolicy =
    await fetchJson<WorkspaceGovernanceNotificationPolicyResponse>(
      apiRoutes.workspaceGovernanceNotificationPolicy(demoTenantKey, emptyWorkspaceKey)
    );
  assert.equal(inheritedWorkspaceGovernanceNotificationPolicy.mode, "inherit");
  assert.equal(
    inheritedWorkspaceGovernanceNotificationPolicy.governanceNotificationPolicyOverride,
    null
  );
  assert.deepEqual(
    inheritedWorkspaceGovernanceNotificationPolicy.effectiveGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 13,
      webhookSpikeMaxDeliveryAttempts: 14,
      emailSpikeRetryDelaySeconds: 15,
      emailSpikeMaxDeliveryAttempts: 16
    }
  );

  const workspaceGovernanceNotificationPolicyResponse =
    await fetchJsonResponse<WorkspaceGovernanceNotificationPolicyResponse>(
      apiRoutes.workspaceGovernanceNotificationPolicy(demoTenantKey, demoWorkspaceKey),
      {
        method: "PATCH",
        body: JSON.stringify({
          mode: "override",
          governanceNotificationPolicyOverride: {
            breachNotificationDeliverySelectionMode: "force_webhook_spike",
            webhookSpikeRetryDelaySeconds: 1,
            webhookSpikeMaxDeliveryAttempts: 9
          }
        })
      }
    );
  const workspaceGovernanceNotificationPolicy = workspaceGovernanceNotificationPolicyResponse.body;
  const workspaceGovernanceNotificationPolicyRequestId =
    workspaceGovernanceNotificationPolicyResponse.headers.get("x-request-id");
  assert.ok(workspaceGovernanceNotificationPolicyRequestId);
  assert.equal(workspaceGovernanceNotificationPolicy.mode, "override");
  assert.deepEqual(workspaceGovernanceNotificationPolicy.defaultGovernanceNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 13,
    webhookSpikeMaxDeliveryAttempts: 14,
    emailSpikeRetryDelaySeconds: 15,
    emailSpikeMaxDeliveryAttempts: 16
  });
  assert.deepEqual(workspaceGovernanceNotificationPolicy.governanceNotificationPolicyOverride, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 1,
    webhookSpikeMaxDeliveryAttempts: 9
  });
  assert.equal(
    workspaceGovernanceNotificationPolicy.governanceNotificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.updatedByRequestId,
    workspaceGovernanceNotificationPolicyRequestId
  );
  assert.deepEqual(workspaceGovernanceNotificationPolicy.effectiveGovernanceNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 1,
    webhookSpikeMaxDeliveryAttempts: 9,
    emailSpikeRetryDelaySeconds: 15,
    emailSpikeMaxDeliveryAttempts: 16
  });

  const redrivenGovernanceAlert =
    await fetchJson<RedriveNotificationProviderProfileGovernanceAlertResponse>(
      apiRoutes.workspaceNotificationProviderProfileGovernanceAlertRedrive(
        demoTenantKey,
        demoWorkspaceKey,
        governanceAlertDeadLetterQueue.alertId
      ),
      {
        method: "POST",
        body: JSON.stringify({
          redrivenByActorId: "ops-governance-2",
          redriveNote: "Corrected governance alert delivery target.",
          deliveryTarget: "manual-governance-recovery@example.test"
        })
      }
    );
  assert.equal(redrivenGovernanceAlert.alert.delivery.status, "pending_delivery");
  assert.equal(redrivenGovernanceAlert.alert.delivery.channel, "webhook_spike");
  assert.equal(redrivenGovernanceAlert.alert.delivery.target, "manual-governance-recovery@example.test");
  assert.equal(redrivenGovernanceAlert.alert.deliveryProfileKey, null);

  const deliveredRedrivenGovernanceAlert = await retry(async () => {
    const response = await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertsResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlerts(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile&deliveryStatus=delivered`
    );
    const matchingAlert = response.items.find(
      item => item.alertId === seededFailedGovernanceAlertId
    );

    assert.ok(matchingAlert, "Expected redriven governance alert to be delivered.");
    assert.equal(matchingAlert.delivery.channel, "webhook_spike");
    assert.equal(matchingAlert.delivery.status, "delivered");
    assert.equal(matchingAlert.delivery.target, "manual-governance-recovery@example.test");
    assert.equal(matchingAlert.deliveryProfileKey, null);
    assert.ok(matchingAlert.delivery.receiptId);

    return matchingAlert;
  }, 30, 250);
  assert.equal(deliveredRedrivenGovernanceAlert.alertId, seededFailedGovernanceAlertId);

  const emptiedGovernanceAlertDeadLetterQueue =
    await fetchJson<WorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueResponse>(
      `${apiRoutes.workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueue(
        demoTenantKey,
        demoWorkspaceKey
      )}?profileKey=dead-letter-email-profile`
    );
  assert.equal(
    emptiedGovernanceAlertDeadLetterQueue.items.some(
      item => item.alertId === seededFailedGovernanceAlertId
    ),
    false
  );

  const initialTenantEvidenceRetentionPolicy = await fetchJson<TenantEvidenceRetentionPolicyResponse>(
    apiRoutes.tenantEvidenceRetentionPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultEvidenceRetentionPolicy: {
          systemCheckEvidenceRetentionTtlSeconds: 7200,
          systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
        }
      })
    }
  );

  assert.deepEqual(initialTenantEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 7200,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
  });

  const emptyWorkspaceEvidenceRetentionPolicy = await fetchJson<WorkspaceEvidenceRetentionPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionPolicy(demoTenantKey, emptyWorkspaceKey)
  );

  assert.equal(emptyWorkspaceEvidenceRetentionPolicy.mode, "inherit");
  assert.equal(emptyWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverride, null);
  assert.equal(emptyWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverrideRecords, null);
  assert.deepEqual(emptyWorkspaceEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 7200,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
  });
  assert.deepEqual(emptyWorkspaceEvidenceRetentionPolicy.effectiveEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 7200,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
  });

  const demoWorkspaceEvidenceRetentionPolicyResponse = await fetchJsonResponse<WorkspaceEvidenceRetentionPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionPolicy(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        evidenceRetentionPolicyOverride: {
          systemCheckEvidenceRetentionTtlSeconds: 3600
        }
      })
    }
  );
  const demoWorkspaceEvidenceRetentionPolicy = demoWorkspaceEvidenceRetentionPolicyResponse.body;
  const demoWorkspaceEvidenceRetentionPolicyRequestId =
    demoWorkspaceEvidenceRetentionPolicyResponse.headers.get("x-request-id");
  assert.ok(demoWorkspaceEvidenceRetentionPolicyRequestId);
  assert.equal(demoWorkspaceEvidenceRetentionPolicy.mode, "override");
  assert.deepEqual(demoWorkspaceEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 7200,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
  });
  assert.deepEqual(demoWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverride, {
    systemCheckEvidenceRetentionTtlSeconds: 3600
  });
  assert.equal(
    demoWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverrideRecords?.systemCheckEvidenceRetentionTtlSeconds?.value,
    3600
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverrideRecords?.systemCheckEvidenceRetentionTtlSeconds?.updatedByRequestId,
    demoWorkspaceEvidenceRetentionPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceEvidenceRetentionPolicy.effectiveEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 3600,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
  });

  const updatedTenantEvidenceRetentionPolicy = await fetchJson<TenantEvidenceRetentionPolicyResponse>(
    apiRoutes.tenantEvidenceRetentionPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultEvidenceRetentionPolicy: {
          systemCheckEvidenceRetentionTtlSeconds: 5400,
          systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
        }
      })
    }
  );

  assert.deepEqual(updatedTenantEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 5400,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
  });

  const inheritedWorkspaceEvidenceRetentionPolicy = await fetchJson<WorkspaceEvidenceRetentionPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionPolicy(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceEvidenceRetentionPolicy.workspaceKey, tenantPolicyWorkspaceKey);
  assert.equal(inheritedWorkspaceEvidenceRetentionPolicy.mode, "inherit");
  assert.equal(inheritedWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverride, null);
  assert.equal(inheritedWorkspaceEvidenceRetentionPolicy.evidenceRetentionPolicyOverrideRecords, null);
  assert.deepEqual(inheritedWorkspaceEvidenceRetentionPolicy.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 5400,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
  });
  assert.deepEqual(inheritedWorkspaceEvidenceRetentionPolicy.effectiveEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 5400,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
  });

  const demoWorkspaceEvidenceRetentionPolicyAfterTenantUpdate = await fetchJson<WorkspaceEvidenceRetentionPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionPolicy(demoTenantKey, demoWorkspaceKey)
  );

  assert.equal(demoWorkspaceEvidenceRetentionPolicyAfterTenantUpdate.mode, "override");
  assert.deepEqual(demoWorkspaceEvidenceRetentionPolicyAfterTenantUpdate.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 5400,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
  });
  assert.deepEqual(demoWorkspaceEvidenceRetentionPolicyAfterTenantUpdate.evidenceRetentionPolicyOverride, {
    systemCheckEvidenceRetentionTtlSeconds: 3600
  });
  assert.equal(
    demoWorkspaceEvidenceRetentionPolicyAfterTenantUpdate.evidenceRetentionPolicyOverrideRecords?.systemCheckEvidenceRetentionTtlSeconds?.updatedByRequestId,
    demoWorkspaceEvidenceRetentionPolicyRequestId
  );
  assert.deepEqual(demoWorkspaceEvidenceRetentionPolicyAfterTenantUpdate.effectiveEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 3600,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
  });

  const updatedTenantEvidenceRetentionClassPolicy = await fetchJson<TenantEvidenceRetentionClassPolicyResponse>(
    apiRoutes.tenantEvidenceRetentionClassPolicy(demoTenantKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        defaultEvidenceRetentionClassPolicy: {
          holdReasons: [
            {
              holdReasonCode: "workspace_review",
              displayLabel: "Workspace Review",
              workflowHint: "Keep evidence available while a workspace reviewer inspects the submission.",
              severity: "low",
              escalationTarget: null,
              uiGroup: "review",
              acknowledgementRequired: false,
              defaultAssigneeTarget: "workspace-reviewers",
              slaSeconds: 86400
            },
            {
              holdReasonCode: "operator_investigation",
              displayLabel: "Operator Investigation",
              workflowHint: "Escalate evidence into the longer investigation workflow for operator follow-up.",
              severity: "high",
              escalationTarget: "ops-investigation",
              uiGroup: "investigation",
              acknowledgementRequired: true,
              defaultAssigneeTarget: "ops-investigation-primary",
              slaSeconds: 14400
            },
            {
              holdReasonCode: "audit_review",
              displayLabel: "Audit Review",
              workflowHint: "Route evidence into the audit review workflow before escalation.",
              severity: "medium",
              escalationTarget: "audit-team",
              uiGroup: "audit",
              acknowledgementRequired: true,
              defaultAssigneeTarget: "audit-primary",
              slaSeconds: 43200
            }
          ],
          defaultCaptureRetentionClass: "workspace_review",
          classes: [
            {
              retentionClass: "workspace_review",
              retentionPolicyKey: "spike_workspace_review",
              ttlFieldKey: "systemCheckEvidenceRetentionTtlSeconds",
              manualHoldAllowed: true,
              payloadAccessGrantsAllowed: true,
              holdTransitions: [
                {
                  holdReasonCode: "workspace_review",
                  targetRetentionClass: "workspace_review"
                },
                {
                  holdReasonCode: "operator_investigation",
                  targetRetentionClass: "investigation_queue"
                },
                {
                  holdReasonCode: "audit_review",
                  targetRetentionClass: "investigation_queue"
                }
              ]
            },
            {
              retentionClass: "investigation_queue",
              retentionPolicyKey: "spike_operator_investigation_queue",
              ttlFieldKey: "systemCheckEvidenceInvestigationRetentionTtlSeconds",
              manualHoldAllowed: true,
              payloadAccessGrantsAllowed: true,
              holdTransitions: [
                {
                  holdReasonCode: "operator_investigation",
                  targetRetentionClass: "operator_investigation"
                },
                {
                  holdReasonCode: "audit_review",
                  targetRetentionClass: "operator_investigation"
                }
              ]
            },
            {
              retentionClass: "operator_investigation",
              retentionPolicyKey: "spike_operator_investigation",
              ttlFieldKey: "systemCheckEvidenceInvestigationRetentionTtlSeconds",
              manualHoldAllowed: true,
              payloadAccessGrantsAllowed: true,
              holdTransitions: [
                {
                  holdReasonCode: "operator_investigation",
                  targetRetentionClass: "operator_investigation"
                },
                {
                  holdReasonCode: "audit_review",
                  targetRetentionClass: "operator_investigation"
                }
              ]
            }
          ]
        }
      })
    }
  );

  assert.equal(
    updatedTenantEvidenceRetentionClassPolicy.defaultEvidenceRetentionClassPolicy.classes.length,
    3
  );

  const inheritedWorkspaceEvidenceRetentionClassPolicy = await fetchJson<WorkspaceEvidenceRetentionClassPolicyResponse>(
    apiRoutes.workspaceEvidenceRetentionClassPolicy(demoTenantKey, tenantPolicyWorkspaceKey)
  );

  assert.equal(inheritedWorkspaceEvidenceRetentionClassPolicy.mode, "inherit");
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.displayLabel,
    "Audit Review"
  );
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.severity,
    "medium"
  );
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.acknowledgementRequired,
    true
  );
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.classes.length,
    3
  );
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.classes.find(
      entry => entry.retentionClass === "workspace_review"
    )?.holdTransitions.find(entry => entry.holdReasonCode === "operator_investigation")
      ?.targetRetentionClass,
    "investigation_queue"
  );

  const demoWorkspaceEvidenceRetentionClassPolicyResponse =
    await fetchJsonResponse<WorkspaceEvidenceRetentionClassPolicyResponse>(
      apiRoutes.workspaceEvidenceRetentionClassPolicy(demoTenantKey, demoWorkspaceKey),
      {
        method: "PATCH",
        body: JSON.stringify({
          mode: "override",
          evidenceRetentionClassPolicyOverride: {
            classEntries: [
              {
                retentionClass: "workspace_review",
                retentionPolicyKey: "spike_workspace_review",
                ttlFieldKey: "systemCheckEvidenceRetentionTtlSeconds",
                manualHoldAllowed: true,
                payloadAccessGrantsAllowed: true,
                holdTransitions: [
                  {
                    holdReasonCode: "workspace_review",
                    targetRetentionClass: "workspace_review"
                  },
                  {
                    holdReasonCode: "operator_investigation",
                    targetRetentionClass: "operator_investigation"
                  },
                  {
                    holdReasonCode: "audit_review",
                    targetRetentionClass: "operator_investigation"
                  }
                ]
              }
            ]
          }
        })
      }
    );
  const demoWorkspaceEvidenceRetentionClassPolicy = demoWorkspaceEvidenceRetentionClassPolicyResponse.body;
  const demoWorkspaceEvidenceRetentionClassPolicyRequestId =
    demoWorkspaceEvidenceRetentionClassPolicyResponse.headers.get("x-request-id");
  assert.ok(demoWorkspaceEvidenceRetentionClassPolicyRequestId);
  assert.equal(demoWorkspaceEvidenceRetentionClassPolicy.mode, "override");
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.evidenceRetentionClassPolicyOverride?.classEntries?.length,
    1
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.evidenceRetentionClassPolicyOverrideRecords?.classEntries?.[0]
      ?.updatedByRequestId,
    demoWorkspaceEvidenceRetentionClassPolicyRequestId
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.classes.length,
    3
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.classes.find(
      entry => entry.retentionClass === "workspace_review"
    )?.holdTransitions.find(entry => entry.holdReasonCode === "operator_investigation")
      ?.targetRetentionClass,
    "operator_investigation"
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.workflowHint,
    "Route evidence into the audit review workflow before escalation."
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.escalationTarget,
    "audit-team"
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.defaultAssigneeTarget,
    "audit-primary"
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      entry => entry.holdReasonCode === "audit_review"
    )?.slaSeconds,
    43200
  );
  assert.equal(
    demoWorkspaceEvidenceRetentionClassPolicy.effectiveEvidenceRetentionClassPolicy.classes.find(
      entry => entry.retentionClass === "workspace_review"
    )?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.targetRetentionClass,
    "operator_investigation"
  );

  const demoWorkspaceEvidenceRetentionClasses = await fetchJson<WorkspaceEvidenceRetentionClassesResponse>(
    apiRoutes.workspaceEvidenceRetentionClasses(demoTenantKey, demoWorkspaceKey)
  );
  const demoWorkspaceReviewClass = demoWorkspaceEvidenceRetentionClasses.classes.find(
    entry => entry.retentionClass === "workspace_review"
  );
  const demoInvestigationQueueClass = demoWorkspaceEvidenceRetentionClasses.classes.find(
    entry => entry.retentionClass === "investigation_queue"
  );
  const demoInvestigationClass = demoWorkspaceEvidenceRetentionClasses.classes.find(
    entry => entry.retentionClass === "operator_investigation"
  );
  assert.ok(demoWorkspaceReviewClass);
  assert.ok(demoInvestigationQueueClass);
  assert.ok(demoInvestigationClass);
  assert.equal(demoWorkspaceEvidenceRetentionClasses.classes.length, 3);
  assert.equal(demoWorkspaceReviewClass?.ttlSeconds, 3600);
  assert.equal(demoInvestigationQueueClass?.ttlSeconds, 259200);
  assert.equal(demoInvestigationClass?.ttlSeconds, 259200);
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(
      entry => entry.holdReasonCode === "operator_investigation"
    )?.targetRetentionClass,
    "operator_investigation"
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonDisplayLabel,
    "Audit Review"
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonWorkflowHint,
    "Route evidence into the audit review workflow before escalation."
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonSeverity,
    "medium"
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonEscalationTarget,
    "audit-team"
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonUiGroup,
    "audit"
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonAcknowledgementRequired,
    true
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonDefaultAssigneeTarget,
    "audit-primary"
  );
  assert.equal(
    demoWorkspaceReviewClass?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.holdReasonSlaSeconds,
    43200
  );

  const inheritedWorkspaceEvidenceRetentionClasses = await fetchJson<WorkspaceEvidenceRetentionClassesResponse>(
    apiRoutes.workspaceEvidenceRetentionClasses(demoTenantKey, tenantPolicyWorkspaceKey)
  );
  assert.equal(inheritedWorkspaceEvidenceRetentionClasses.classes.length, 3);
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClasses.classes.find(
      entry => entry.retentionClass === "workspace_review"
    )?.holdTransitions.find(entry => entry.holdReasonCode === "operator_investigation")
      ?.targetRetentionClass,
    "investigation_queue"
  );
  assert.equal(
    inheritedWorkspaceEvidenceRetentionClasses.classes.find(
      entry => entry.retentionClass === "workspace_review"
    )?.holdTransitions.find(entry => entry.holdReasonCode === "audit_review")
      ?.targetRetentionClass,
    "investigation_queue"
  );

  const demoWorkspaceNotificationProviderProfilesTombstoneResponse = await fetchJsonResponse<WorkspaceNotificationProviderProfilesResponse>(
    apiRoutes.workspaceNotificationProviderProfiles(demoTenantKey, demoWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        notificationProviderProfileOverride: [
          {
            profileKey: "alerts-email-profile",
            displayLabel: "Workspace Alerts Email Profile",
            deliveryChannel: "email_spike",
            target: "retry-once:workspace-alerts@example.test",
            credentialsRef: "vault://notifications/workspace-alerts-email"
          }
        ],
        removedNotificationProviderProfileKeys: ["dead-letter-email-profile"]
      })
    }
  );
  const demoWorkspaceNotificationProviderProfilesTombstone =
    demoWorkspaceNotificationProviderProfilesTombstoneResponse.body;
  const demoWorkspaceNotificationProviderProfilesTombstoneRequestId =
    demoWorkspaceNotificationProviderProfilesTombstoneResponse.headers.get("x-request-id");
  assert.ok(demoWorkspaceNotificationProviderProfilesTombstoneRequestId);
  assert.equal(demoWorkspaceNotificationProviderProfilesTombstone.mode, "override");
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      demoWorkspaceNotificationProviderProfilesTombstone.notificationProviderProfileOverride
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      })
    ])
  );
  assert.deepEqual(
    demoWorkspaceNotificationProviderProfilesTombstone.removedNotificationProviderProfileKeys,
    ["dead-letter-email-profile"]
  );
  assert.deepEqual(
    stripNotificationProviderProfileOverrideRecordOperationalStates(
      demoWorkspaceNotificationProviderProfilesTombstone.notificationProviderProfileOverrideRecords
    ),
    stripNotificationProviderProfileOverrideRecordOperationalStates([
      {
        profileKey: "alerts-email-profile",
        value: toExpectedNotificationProviderProfileDto({
          profileKey: "alerts-email-profile",
          displayLabel: "Workspace Alerts Email Profile",
          deliveryChannel: "email_spike",
          target: "retry-once:workspace-alerts@example.test",
          credentialsRef: "vault://notifications/workspace-alerts-email"
        }),
        updatedAt:
          demoWorkspaceNotificationProviderProfilesTombstone.notificationProviderProfileOverrideRecords?.[0]
            ?.updatedAt ?? "",
        updatedByRequestId: demoWorkspaceNotificationProviderProfilesTombstoneRequestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      },
      {
        profileKey: "dead-letter-email-profile",
        value: null,
        updatedAt:
          demoWorkspaceNotificationProviderProfilesTombstone.notificationProviderProfileOverrideRecords?.[1]
            ?.updatedAt ?? "",
        updatedByRequestId: demoWorkspaceNotificationProviderProfilesTombstoneRequestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      }
    ])
  );
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      demoWorkspaceNotificationProviderProfilesTombstone.effectiveNotificationProviderProfiles
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      })
    ])
  );

  const tenantPolicyHistory = await fetchJson<PolicyHistoryResponse>(
    apiRoutes.tenantPolicyHistory(demoTenantKey)
  );

  const tenantActivationPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item => item.eventType === "tenant.activation_policy.updated"
  );
  assert.ok(tenantActivationPolicyHistoryEntry);
  assert.equal(tenantActivationPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(tenantActivationPolicyHistoryEntry.policyFamily, "activation");
  assert.equal(tenantActivationPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantActivationPolicyHistoryEntry.changedFields, [
    "blockIncompatibleRoutingChangesWithActiveSessions",
    "warnOnActiveSessions",
    "warnOnHighRiskReleaseChange"
  ]);
  assert.deepEqual(tenantActivationPolicyHistoryEntry.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: false
  });

  const tenantOperationalPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item => item.eventType === "tenant.operational_policy.updated"
  );
  assert.ok(tenantOperationalPolicyHistoryEntry);
  assert.equal(tenantOperationalPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(tenantOperationalPolicyHistoryEntry.policyFamily, "operational");
  assert.equal(tenantOperationalPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantOperationalPolicyHistoryEntry.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 45,
    monitorCommandLeaseSeconds: 3,
    timedRunMaintenanceGraceSeconds: 10
  });

  const tenantLaunchApprovalPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.launch_approval_policy.updated" &&
      item.defaultLaunchApprovalPolicy?.systemCheckLaunchApprovalTtlSeconds === 30
  );
  assert.ok(tenantLaunchApprovalPolicyHistoryEntry);
  assert.equal(tenantLaunchApprovalPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(tenantLaunchApprovalPolicyHistoryEntry.policyFamily, "launch_approval");
  assert.equal(tenantLaunchApprovalPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantLaunchApprovalPolicyHistoryEntry.changedFields, [
    "systemCheckLaunchApprovalTtlSeconds"
  ]);
  assert.deepEqual(tenantLaunchApprovalPolicyHistoryEntry.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 30
  });

  const tenantNotificationProviderPromotionPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.notification_provider_promotion_policy.updated" &&
      item.defaultNotificationProviderPromotionPolicy?.evaluationWindowHours === 48
  );
  assert.ok(tenantNotificationProviderPromotionPolicyHistoryEntry);
  assert.equal(
    tenantNotificationProviderPromotionPolicyHistoryEntry.scope,
    "tenant_default"
  );
  assert.equal(
    tenantNotificationProviderPromotionPolicyHistoryEntry.policyFamily,
    "notification_provider_promotion"
  );
  assert.equal(tenantNotificationProviderPromotionPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantNotificationProviderPromotionPolicyHistoryEntry.changedFields, [
    "evaluationWindowHours",
    "minimumRequestedCount",
    "minimumDirectSelectionCount",
    "minimumDeliveredCount",
    "maximumDeliveryFailedCount",
    "autoPromoteEnabled",
    "autoRollbackOnFailureEnabled",
    "autoPromotionSuppressionSeconds"
  ]);
  assert.deepEqual(
    tenantNotificationProviderPromotionPolicyHistoryEntry.defaultNotificationProviderPromotionPolicy,
    {
      evaluationWindowHours: 48,
      minimumRequestedCount: 2,
      minimumDirectSelectionCount: 1,
      minimumDeliveredCount: 1,
      maximumDeliveryFailedCount: 0,
      autoPromoteEnabled: false,
      autoRollbackOnFailureEnabled: false,
      autoPromotionSuppressionSeconds: 0
    }
  );

  const tenantNotificationPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.notification_policy.updated" &&
      item.defaultNotificationPolicy?.breachNotificationDeliverySelectionMode === "force_email_spike"
  );
  assert.ok(tenantNotificationPolicyHistoryEntry);
  assert.equal(tenantNotificationPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(tenantNotificationPolicyHistoryEntry.policyFamily, "notification");
  assert.equal(tenantNotificationPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantNotificationPolicyHistoryEntry.changedFields, [
    "breachNotificationDeliverySelectionMode",
    "webhookSpikeRetryDelaySeconds",
    "webhookSpikeMaxDeliveryAttempts",
    "emailSpikeRetryDelaySeconds",
    "emailSpikeMaxDeliveryAttempts"
  ]);
  assert.deepEqual(tenantNotificationPolicyHistoryEntry.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_email_spike",
    webhookSpikeRetryDelaySeconds: 3,
    webhookSpikeMaxDeliveryAttempts: 6,
    emailSpikeRetryDelaySeconds: 4,
    emailSpikeMaxDeliveryAttempts: 7
  });

  const tenantGovernanceNotificationPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.governance_notification_policy.updated" &&
      item.requestId === tenantGovernanceNotificationPolicyRequestId
  );
  assert.ok(tenantGovernanceNotificationPolicyHistoryEntry);
  assert.equal(tenantGovernanceNotificationPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(tenantGovernanceNotificationPolicyHistoryEntry.policyFamily, "governance_notification");
  assert.equal(tenantGovernanceNotificationPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantGovernanceNotificationPolicyHistoryEntry.changedFields, [
    "breachNotificationDeliverySelectionMode",
    "webhookSpikeRetryDelaySeconds",
    "webhookSpikeMaxDeliveryAttempts",
    "emailSpikeRetryDelaySeconds",
    "emailSpikeMaxDeliveryAttempts"
  ]);
  assert.deepEqual(
    tenantGovernanceNotificationPolicyHistoryEntry.defaultGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 13,
      webhookSpikeMaxDeliveryAttempts: 14,
      emailSpikeRetryDelaySeconds: 15,
      emailSpikeMaxDeliveryAttempts: 16
    }
  );

  const tenantRecoveryGovernanceNotificationPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.recovery_governance_notification_policy.updated" &&
      item.requestId === tenantRecoveryGovernanceNotificationPolicyRequestId
  );
  assert.ok(tenantRecoveryGovernanceNotificationPolicyHistoryEntry);
  assert.equal(
    tenantRecoveryGovernanceNotificationPolicyHistoryEntry.scope,
    "tenant_default"
  );
  assert.equal(
    tenantRecoveryGovernanceNotificationPolicyHistoryEntry.policyFamily,
    "recovery_governance_notification"
  );
  assert.equal(tenantRecoveryGovernanceNotificationPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantRecoveryGovernanceNotificationPolicyHistoryEntry.changedFields, [
    "breachNotificationDeliverySelectionMode",
    "webhookSpikeRetryDelaySeconds",
    "webhookSpikeMaxDeliveryAttempts",
    "emailSpikeRetryDelaySeconds",
    "emailSpikeMaxDeliveryAttempts"
  ]);
  assert.deepEqual(
    tenantRecoveryGovernanceNotificationPolicyHistoryEntry.defaultRecoveryGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 21,
      webhookSpikeMaxDeliveryAttempts: 22,
      emailSpikeRetryDelaySeconds: 23,
      emailSpikeMaxDeliveryAttempts: 24
    }
  );

  const tenantNotificationProviderProfilesHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.notification_provider_profiles.updated" &&
      item.defaultNotificationProviderProfiles?.some(
        profile => profile.profileKey === "alerts-email-profile"
      )
  );
  assert.ok(tenantNotificationProviderProfilesHistoryEntry);
  assert.equal(tenantNotificationProviderProfilesHistoryEntry.scope, "tenant_default");
  assert.equal(
    tenantNotificationProviderProfilesHistoryEntry.policyFamily,
    "notification_provider_profiles"
  );
  assert.equal(tenantNotificationProviderProfilesHistoryEntry.mode, "default");
  assert.deepEqual(tenantNotificationProviderProfilesHistoryEntry.changedFields, [
    "alerts-email-profile",
    "dead-letter-email-profile"
  ]);
  assert.deepEqual(
    tenantNotificationProviderProfilesHistoryEntry.defaultNotificationProviderProfiles,
    [
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Tenant Updated Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:tenant-updated-alerts@example.test",
        credentialsRef: "vault://notifications/tenant-updated-alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "dead-letter-email-profile",
        displayLabel: "Tenant Updated Dead Letter Email Profile",
        deliveryChannel: "email_spike",
        target: "fail-permanent:tenant-updated-dead-letter@example.test",
        credentialsRef: "vault://notifications/tenant-updated-dead-letter-email"
      })
    ]
  );

  const tenantEvidenceRetentionPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.evidence_retention_policy.updated" &&
      item.defaultEvidenceRetentionPolicy?.systemCheckEvidenceRetentionTtlSeconds === 5400
  );
  assert.ok(tenantEvidenceRetentionPolicyHistoryEntry);
  assert.equal(tenantEvidenceRetentionPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(tenantEvidenceRetentionPolicyHistoryEntry.policyFamily, "evidence_retention");
  assert.equal(tenantEvidenceRetentionPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantEvidenceRetentionPolicyHistoryEntry.changedFields, [
    "systemCheckEvidenceRetentionTtlSeconds",
    "systemCheckEvidenceInvestigationRetentionTtlSeconds"
  ]);
  assert.deepEqual(tenantEvidenceRetentionPolicyHistoryEntry.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 5400,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 259200
  });

  const tenantEvidenceRetentionClassPolicyHistoryEntry = tenantPolicyHistory.items.find(
    item =>
      item.eventType === "tenant.evidence_retention_class_policy.updated" &&
      item.defaultEvidenceRetentionClassPolicy?.classes.length === 3
  );
  assert.ok(tenantEvidenceRetentionClassPolicyHistoryEntry);
  assert.equal(tenantEvidenceRetentionClassPolicyHistoryEntry.scope, "tenant_default");
  assert.equal(
    tenantEvidenceRetentionClassPolicyHistoryEntry.policyFamily,
    "evidence_retention_class"
  );
  assert.equal(tenantEvidenceRetentionClassPolicyHistoryEntry.mode, "default");
  assert.deepEqual(tenantEvidenceRetentionClassPolicyHistoryEntry.changedFields, [
    "holdReasons",
    "defaultCaptureRetentionClass",
    "classes"
  ]);
  assert.equal(
    tenantEvidenceRetentionClassPolicyHistoryEntry.defaultEvidenceRetentionClassPolicy
      ?.defaultCaptureRetentionClass,
    "workspace_review"
  );
  assert.equal(
    tenantEvidenceRetentionClassPolicyHistoryEntry.defaultEvidenceRetentionClassPolicy?.classes.length,
    3
  );

  const workspacePolicyHistory = await fetchJson<PolicyHistoryResponse>(
    apiRoutes.workspacePolicyHistory(demoTenantKey, demoWorkspaceKey)
  );

  const workspaceActivationPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.activation_policy.updated"
  );
  assert.ok(workspaceActivationPolicyHistoryEntry);
  assert.equal(workspaceActivationPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(workspaceActivationPolicyHistoryEntry.policyFamily, "activation");
  assert.equal(workspaceActivationPolicyHistoryEntry.mode, "override");
  assert.equal(workspaceActivationPolicyHistoryEntry.requestId, relaxedActivationPolicyRequestId);
  assert.deepEqual(workspaceActivationPolicyHistoryEntry.changedFields, [
    "blockIncompatibleRoutingChangesWithActiveSessions"
  ]);
  assert.deepEqual(workspaceActivationPolicyHistoryEntry.defaultActivationPolicy, {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  });
  assert.deepEqual(workspaceActivationPolicyHistoryEntry.activationPolicyOverride, {
    blockIncompatibleRoutingChangesWithActiveSessions: false
  });
  assert.equal(
    workspaceActivationPolicyHistoryEntry.activationPolicyOverrideRecords?.blockIncompatibleRoutingChangesWithActiveSessions?.updatedByRequestId,
    relaxedActivationPolicyRequestId
  );

  const workspaceOperationalPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.operational_policy.updated"
  );
  assert.ok(workspaceOperationalPolicyHistoryEntry);
  assert.equal(workspaceOperationalPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(workspaceOperationalPolicyHistoryEntry.policyFamily, "operational");
  assert.equal(workspaceOperationalPolicyHistoryEntry.mode, "override");
  assert.equal(workspaceOperationalPolicyHistoryEntry.requestId, tightenedWorkspaceOperationalPolicyRequestId);
  assert.deepEqual(workspaceOperationalPolicyHistoryEntry.defaultOperationalPolicy, {
    monitorCommandTtlSeconds: 30,
    monitorCommandLeaseSeconds: 15,
    timedRunMaintenanceGraceSeconds: 0
  });
  assert.deepEqual(workspaceOperationalPolicyHistoryEntry.changedFields, [
    "monitorCommandTtlSeconds",
    "timedRunMaintenanceGraceSeconds"
  ]);
  assert.equal(
    workspaceOperationalPolicyHistoryEntry.operationalPolicyOverrideRecords?.monitorCommandTtlSeconds?.updatedByRequestId,
    tightenedWorkspaceOperationalPolicyRequestId
  );

  const workspaceLaunchApprovalPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.launch_approval_policy.updated"
  );
  assert.ok(workspaceLaunchApprovalPolicyHistoryEntry);
  assert.equal(workspaceLaunchApprovalPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(workspaceLaunchApprovalPolicyHistoryEntry.policyFamily, "launch_approval");
  assert.equal(workspaceLaunchApprovalPolicyHistoryEntry.mode, "override");
  assert.equal(
    workspaceLaunchApprovalPolicyHistoryEntry.requestId,
    demoWorkspaceLaunchApprovalPolicyRequestId
  );
  assert.deepEqual(workspaceLaunchApprovalPolicyHistoryEntry.defaultLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 300
  });
  assert.deepEqual(workspaceLaunchApprovalPolicyHistoryEntry.changedFields, [
    "systemCheckLaunchApprovalTtlSeconds"
  ]);
  assert.deepEqual(workspaceLaunchApprovalPolicyHistoryEntry.launchApprovalPolicyOverride, {
    systemCheckLaunchApprovalTtlSeconds: 120
  });
  assert.equal(
    workspaceLaunchApprovalPolicyHistoryEntry.launchApprovalPolicyOverrideRecords?.systemCheckLaunchApprovalTtlSeconds?.updatedByRequestId,
    demoWorkspaceLaunchApprovalPolicyRequestId
  );

  const workspaceNotificationPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.notification_policy.updated"
  );
  assert.ok(workspaceNotificationPolicyHistoryEntry);
  assert.equal(workspaceNotificationPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(workspaceNotificationPolicyHistoryEntry.policyFamily, "notification");
  assert.equal(workspaceNotificationPolicyHistoryEntry.mode, "override");
  assert.equal(
    workspaceNotificationPolicyHistoryEntry.requestId,
    demoWorkspaceNotificationPolicyRequestId
  );
  assert.deepEqual(workspaceNotificationPolicyHistoryEntry.defaultNotificationPolicy, {
    breachNotificationDeliverySelectionMode: "force_webhook_spike",
    webhookSpikeRetryDelaySeconds: 2,
    webhookSpikeMaxDeliveryAttempts: 5,
    emailSpikeRetryDelaySeconds: 7,
    emailSpikeMaxDeliveryAttempts: 8
  });
  assert.deepEqual(workspaceNotificationPolicyHistoryEntry.changedFields, [
    "breachNotificationDeliverySelectionMode",
    "webhookSpikeRetryDelaySeconds",
    "webhookSpikeMaxDeliveryAttempts"
  ]);
  assert.deepEqual(workspaceNotificationPolicyHistoryEntry.notificationPolicyOverride, {
    breachNotificationDeliverySelectionMode: "infer_from_target",
    webhookSpikeRetryDelaySeconds: 0,
    webhookSpikeMaxDeliveryAttempts: 4
  });
  assert.equal(
    workspaceNotificationPolicyHistoryEntry.notificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.updatedByRequestId,
    demoWorkspaceNotificationPolicyRequestId
  );

  const workspaceGovernanceNotificationPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.governance_notification_policy.updated"
  );
  assert.ok(workspaceGovernanceNotificationPolicyHistoryEntry);
  assert.equal(workspaceGovernanceNotificationPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(
    workspaceGovernanceNotificationPolicyHistoryEntry.policyFamily,
    "governance_notification"
  );
  assert.equal(workspaceGovernanceNotificationPolicyHistoryEntry.mode, "override");
  assert.equal(
    workspaceGovernanceNotificationPolicyHistoryEntry.requestId,
    workspaceGovernanceNotificationPolicyRequestId
  );
  assert.deepEqual(
    workspaceGovernanceNotificationPolicyHistoryEntry.defaultGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 13,
      webhookSpikeMaxDeliveryAttempts: 14,
      emailSpikeRetryDelaySeconds: 15,
      emailSpikeMaxDeliveryAttempts: 16
    }
  );
  assert.deepEqual(workspaceGovernanceNotificationPolicyHistoryEntry.changedFields, [
    "breachNotificationDeliverySelectionMode",
    "webhookSpikeRetryDelaySeconds",
    "webhookSpikeMaxDeliveryAttempts"
  ]);
  assert.deepEqual(
    workspaceGovernanceNotificationPolicyHistoryEntry.governanceNotificationPolicyOverride,
    {
      breachNotificationDeliverySelectionMode: "force_webhook_spike",
      webhookSpikeRetryDelaySeconds: 1,
      webhookSpikeMaxDeliveryAttempts: 9
    }
  );
  assert.equal(
    workspaceGovernanceNotificationPolicyHistoryEntry.governanceNotificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.updatedByRequestId,
    workspaceGovernanceNotificationPolicyRequestId
  );

  const workspaceRecoveryGovernanceNotificationPolicyHistoryEntry =
    workspacePolicyHistory.items.find(
      item => item.eventType === "workspace.recovery_governance_notification_policy.updated"
    );
  assert.ok(workspaceRecoveryGovernanceNotificationPolicyHistoryEntry);
  assert.equal(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.scope,
    "workspace_override"
  );
  assert.equal(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.policyFamily,
    "recovery_governance_notification"
  );
  assert.equal(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.mode,
    "override"
  );
  assert.equal(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.requestId,
    workspaceRecoveryGovernanceNotificationPolicyRequestId
  );
  assert.deepEqual(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.defaultRecoveryGovernanceNotificationPolicy,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      webhookSpikeRetryDelaySeconds: 21,
      webhookSpikeMaxDeliveryAttempts: 22,
      emailSpikeRetryDelaySeconds: 23,
      emailSpikeMaxDeliveryAttempts: 24
    }
  );
  assert.deepEqual(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.changedFields,
    ["breachNotificationDeliverySelectionMode", "emailSpikeRetryDelaySeconds", "emailSpikeMaxDeliveryAttempts"]
  );
  assert.deepEqual(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.recoveryGovernanceNotificationPolicyOverride,
    {
      breachNotificationDeliverySelectionMode: "force_email_spike",
      emailSpikeRetryDelaySeconds: 1,
      emailSpikeMaxDeliveryAttempts: 6
    }
  );
  assert.equal(
    workspaceRecoveryGovernanceNotificationPolicyHistoryEntry.recoveryGovernanceNotificationPolicyOverrideRecords
      ?.breachNotificationDeliverySelectionMode?.updatedByRequestId,
    workspaceRecoveryGovernanceNotificationPolicyRequestId
  );

  const emptyWorkspacePolicyHistory = await fetchJson<PolicyHistoryResponse>(
    apiRoutes.workspacePolicyHistory(demoTenantKey, emptyWorkspaceKey)
  );

  const workspaceNotificationProviderPromotionPolicyHistoryEntry =
    emptyWorkspacePolicyHistory.items.find(
      item =>
        item.eventType ===
          "workspace.notification_provider_promotion_policy.updated" &&
        item.requestId ===
          emptyWorkspaceNotificationProviderPromotionPolicyRequestId
    );
  assert.ok(workspaceNotificationProviderPromotionPolicyHistoryEntry);
  assert.equal(
    workspaceNotificationProviderPromotionPolicyHistoryEntry.scope,
    "workspace_override"
  );
  assert.equal(
    workspaceNotificationProviderPromotionPolicyHistoryEntry.policyFamily,
    "notification_provider_promotion"
  );
  assert.equal(workspaceNotificationProviderPromotionPolicyHistoryEntry.mode, "override");
  assert.deepEqual(workspaceNotificationProviderPromotionPolicyHistoryEntry.changedFields, [
    "minimumRequestedCount",
    "minimumDirectSelectionCount",
    "minimumDeliveredCount"
  ]);
  assert.deepEqual(
    workspaceNotificationProviderPromotionPolicyHistoryEntry.clearedFields,
    []
  );
  assert.deepEqual(
    workspaceNotificationProviderPromotionPolicyHistoryEntry
      .defaultNotificationProviderPromotionPolicy,
    {
      evaluationWindowHours: 48,
      minimumRequestedCount: 2,
      minimumDirectSelectionCount: 1,
      minimumDeliveredCount: 1,
      maximumDeliveryFailedCount: 0,
      autoPromoteEnabled: false,
      autoRollbackOnFailureEnabled: false,
      autoPromotionSuppressionSeconds: 0
    }
  );
  assert.deepEqual(
    workspaceNotificationProviderPromotionPolicyHistoryEntry
      .notificationProviderPromotionPolicyOverride,
    {
      minimumRequestedCount: 0,
      minimumDirectSelectionCount: 0,
      minimumDeliveredCount: 0
    }
  );
  assert.equal(
    workspaceNotificationProviderPromotionPolicyHistoryEntry
      .notificationProviderPromotionPolicyOverrideRecords?.minimumRequestedCount
      ?.updatedByRequestId,
    emptyWorkspaceNotificationProviderPromotionPolicyRequestId
  );

  const workspaceNotificationProviderProfilesHistoryEntry = workspacePolicyHistory.items.find(
    item =>
      item.eventType === "workspace.notification_provider_profiles.updated" &&
      item.requestId === demoWorkspaceNotificationProviderProfilesTombstoneRequestId
  );
  assert.ok(workspaceNotificationProviderProfilesHistoryEntry);
  assert.equal(workspaceNotificationProviderProfilesHistoryEntry.scope, "workspace_override");
  assert.equal(
    workspaceNotificationProviderProfilesHistoryEntry.policyFamily,
    "notification_provider_profiles"
  );
  assert.equal(workspaceNotificationProviderProfilesHistoryEntry.mode, "override");
  assert.deepEqual(workspaceNotificationProviderProfilesHistoryEntry.changedFields, [
    "alerts-email-profile"
  ]);
  assert.deepEqual(workspaceNotificationProviderProfilesHistoryEntry.clearedFields, []);
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      workspaceNotificationProviderProfilesHistoryEntry.defaultNotificationProviderProfiles
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Tenant Updated Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:tenant-updated-alerts@example.test",
        credentialsRef: "vault://notifications/tenant-updated-alerts-email"
      }),
      toExpectedNotificationProviderProfileDto({
        profileKey: "dead-letter-email-profile",
        displayLabel: "Tenant Updated Dead Letter Email Profile",
        deliveryChannel: "email_spike",
        target: "fail-permanent:tenant-updated-dead-letter@example.test",
        credentialsRef: "vault://notifications/tenant-updated-dead-letter-email"
      })
    ])
  );
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      workspaceNotificationProviderProfilesHistoryEntry.notificationProviderProfileOverride
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      })
    ])
  );
  assert.deepEqual(
    workspaceNotificationProviderProfilesHistoryEntry.removedNotificationProviderProfileKeys,
    ["dead-letter-email-profile"]
  );
  assert.equal(
    workspaceNotificationProviderProfilesHistoryEntry.notificationProviderProfileOverrideRecords?.[0]
      ?.updatedByRequestId,
    demoWorkspaceNotificationProviderProfilesTombstoneRequestId
  );
  assert.equal(
    workspaceNotificationProviderProfilesHistoryEntry.notificationProviderProfileOverrideRecords?.[1]
      ?.profileKey,
    "dead-letter-email-profile"
  );
  assert.equal(
    workspaceNotificationProviderProfilesHistoryEntry.notificationProviderProfileOverrideRecords?.[1]
      ?.value,
    null
  );
  assert.deepEqual(
    stripNotificationProviderProfileOperationalStates(
      workspaceNotificationProviderProfilesHistoryEntry.effectiveNotificationProviderProfiles
    ),
    stripNotificationProviderProfileOperationalStates([
      toExpectedNotificationProviderProfileDto({
        profileKey: "alerts-email-profile",
        displayLabel: "Workspace Alerts Email Profile",
        deliveryChannel: "email_spike",
        target: "retry-once:workspace-alerts@example.test",
        credentialsRef: "vault://notifications/workspace-alerts-email"
      })
    ])
  );

  const workspaceEvidenceRetentionPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.evidence_retention_policy.updated"
  );
  assert.ok(workspaceEvidenceRetentionPolicyHistoryEntry);
  assert.equal(workspaceEvidenceRetentionPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(workspaceEvidenceRetentionPolicyHistoryEntry.policyFamily, "evidence_retention");
  assert.equal(workspaceEvidenceRetentionPolicyHistoryEntry.mode, "override");
  assert.equal(
    workspaceEvidenceRetentionPolicyHistoryEntry.requestId,
    demoWorkspaceEvidenceRetentionPolicyRequestId
  );
  assert.deepEqual(workspaceEvidenceRetentionPolicyHistoryEntry.defaultEvidenceRetentionPolicy, {
    systemCheckEvidenceRetentionTtlSeconds: 7200,
    systemCheckEvidenceInvestigationRetentionTtlSeconds: 172800
  });
  assert.deepEqual(workspaceEvidenceRetentionPolicyHistoryEntry.changedFields, [
    "systemCheckEvidenceRetentionTtlSeconds"
  ]);
  assert.deepEqual(workspaceEvidenceRetentionPolicyHistoryEntry.evidenceRetentionPolicyOverride, {
    systemCheckEvidenceRetentionTtlSeconds: 3600
  });
  assert.equal(
    workspaceEvidenceRetentionPolicyHistoryEntry.evidenceRetentionPolicyOverrideRecords?.systemCheckEvidenceRetentionTtlSeconds?.updatedByRequestId,
    demoWorkspaceEvidenceRetentionPolicyRequestId
  );

  const workspaceEvidenceRetentionClassPolicyHistoryEntry = workspacePolicyHistory.items.find(
    item => item.eventType === "workspace.evidence_retention_class_policy.updated"
  );
  assert.ok(workspaceEvidenceRetentionClassPolicyHistoryEntry);
  assert.equal(workspaceEvidenceRetentionClassPolicyHistoryEntry.scope, "workspace_override");
  assert.equal(
    workspaceEvidenceRetentionClassPolicyHistoryEntry.policyFamily,
    "evidence_retention_class"
  );
  assert.equal(workspaceEvidenceRetentionClassPolicyHistoryEntry.mode, "override");
  assert.equal(
    workspaceEvidenceRetentionClassPolicyHistoryEntry.requestId,
    demoWorkspaceEvidenceRetentionClassPolicyRequestId
  );
  assert.deepEqual(workspaceEvidenceRetentionClassPolicyHistoryEntry.changedFields, [
    "classEntries.workspace_review"
  ]);
  assert.equal(
    workspaceEvidenceRetentionClassPolicyHistoryEntry.defaultEvidenceRetentionClassPolicy?.classes.length,
    3
  );
  assert.equal(
    workspaceEvidenceRetentionClassPolicyHistoryEntry.evidenceRetentionClassPolicyOverride?.classEntries
      ?.length,
    1
  );
  assert.equal(
    workspaceEvidenceRetentionClassPolicyHistoryEntry.evidenceRetentionClassPolicyOverrideRecords
      ?.classEntries?.[0]?.updatedByRequestId,
    demoWorkspaceEvidenceRetentionClassPolicyRequestId
  );

  const revisionGuardrailAfterPolicyUpdate = await fetchJson<{
    contentRelease: {
      activationGuardrail: ContentReleaseActivationGuardrail;
    };
  }>(
    apiRoutes.workspaceContentRelease(demoTenantKey, demoWorkspaceKey, groupMonitorRevisionContentReleaseId)
  );

  assert.equal(revisionGuardrailAfterPolicyUpdate.contentRelease.activationGuardrail.status, "warning");
  assert.deepEqual(
    revisionGuardrailAfterPolicyUpdate.contentRelease.activationGuardrail.blockingReasonCodes,
    []
  );
  assert.ok(
    revisionGuardrailAfterPolicyUpdate.contentRelease.activationGuardrail.warningReasonCodes.includes(
      "active_sessions_present"
    )
  );
  assert.ok(
    !revisionGuardrailAfterPolicyUpdate.contentRelease.activationGuardrail.warningReasonCodes.includes(
      "high_risk_release_change"
    )
  );

  await fetchJson<{ error: { code: string } }>(
    apiRoutes.participantTestRunNavigate(testRunId),
    {
      method: "POST",
      body: JSON.stringify({
        participantSessionToken,
        targetUnitKey: "UNIT-MAIN"
      })
    },
    409
  ).then(body => {
    assert.equal(body.error.code, "test_run_navigation_rejected");
  });

  const pauseResponse = await fetchJsonResponse<{
    command: {
      commandId: string;
      commandType: string;
      ackState: string;
      rejectionReason: string | null;
    };
    testRun: {
      status: string;
      runPolicy: {
        pausedAt: string | null;
        timeRemainingSeconds: number | null;
      };
    };
  }>(apiRoutes.workspaceMonitorTestRunPause(demoTenantKey, demoWorkspaceKey, testRunId), {
    method: "POST"
  });

  const pauseRequestId = pauseResponse.headers.get("x-request-id");
  assert.ok(pauseRequestId);
  const pauseResult = pauseResponse.body;
  assert.equal(pauseResult.command.commandType, "pause");
  assert.equal(pauseResult.command.ackState, "pending_delivery");

  const duplicatePauseResult = await fetchJson<{
    command: {
      commandId: string;
      commandType: string;
      ackState: string;
      rejectionReason: string | null;
    };
    testRun: {
      status: string;
    };
  }>(apiRoutes.workspaceMonitorTestRunPause(demoTenantKey, demoWorkspaceKey, testRunId), {
    method: "POST"
  });
  assert.equal(duplicatePauseResult.command.commandType, "pause");
  assert.equal(duplicatePauseResult.command.ackState, "pending_delivery");

  const pausedMonitorList = await retry(async () => {
    const currentMonitorList = await fetchJson<{
      items: Array<{
        testRunId: string;
        status: string;
      }>;
    }>(apiRoutes.workspaceMonitorTestRuns(demoTenantKey, demoWorkspaceKey));

    assert.equal(currentMonitorList.items.length, 1);
    assert.equal(currentMonitorList.items[0].testRunId, testRunId);
    assert.equal(currentMonitorList.items[0].status, "paused");
    return currentMonitorList;
  }, 40, 250);
  assert.equal(pausedMonitorList.items.length, 1);
  assert.equal(pausedMonitorList.items[0].testRunId, testRunId);
  assert.equal(pausedMonitorList.items[0].status, "paused");

  const pausedCommandList = await retry(async () => {
    const currentCommandList = await fetchJson<{
      items: Array<{
        commandId: string;
        commandType: string;
        ackState: string;
        testRunId: string;
      }>;
      filters: {
        testRunId: string | null;
        ackState: string | null;
      };
    }>(`${apiRoutes.workspaceMonitorCommands(demoTenantKey, demoWorkspaceKey)}?testRunId=${encodeURIComponent(testRunId)}`);

    assert.ok(currentCommandList.items.some(item =>
      item.commandId === pauseResult.command.commandId &&
      item.commandType === "pause" &&
      item.ackState === "applied" &&
      item.testRunId === testRunId
    ));
    assert.ok(currentCommandList.items.some(item =>
      item.commandId === duplicatePauseResult.command.commandId &&
      item.commandType === "pause" &&
      item.ackState === "rejected" &&
      item.testRunId === testRunId
    ));

    return currentCommandList;
  }, 40, 250);
  assert.equal(pausedCommandList.filters.testRunId, testRunId);
  assert.ok(pausedCommandList.items.some(item =>
    item.commandId === pauseResult.command.commandId &&
    item.commandType === "pause" &&
    item.ackState === "applied" &&
    item.testRunId === testRunId
  ));
  assert.ok(pausedCommandList.items.some(item =>
    item.commandId === duplicatePauseResult.command.commandId &&
    item.commandType === "pause" &&
    item.ackState === "rejected" &&
    item.testRunId === testRunId
  ));

  const resumedWhilePaused = await fetchJson<{
    testRunId: string;
    launchDisposition: string;
    status: string;
    launchAuthorization: {
      launchApprovalId: string | null;
      approvalScope: string | null;
      approvalApplied: boolean;
      approvedBySupervisorId: string | null;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create"
    })
  });

  assert.equal(resumedWhilePaused.testRunId, testRunId);
  assert.equal(resumedWhilePaused.launchDisposition, "resumed");
  assert.equal(resumedWhilePaused.status, "paused");
  assert.equal(
    resumedWhilePaused.launchAuthorization.launchApprovalId,
    workspaceLaunchApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(resumedWhilePaused.launchAuthorization.approvalScope, "session_assignment");
  assert.equal(resumedWhilePaused.launchAuthorization.approvalApplied, true);
  assert.equal(resumedWhilePaused.launchAuthorization.approvedBySupervisorId, "proctor-alpha");

  const pausedRunBefore = await fetchJson<{
    status: string;
    runPolicy: {
      timeRemainingSeconds: number | null;
    };
  }>(`${apiRoutes.participantTestRun(testRunId)}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);
  assert.equal(pausedRunBefore.status, "paused");

  await fetchJson<{ error: { code: string } }>(
    apiRoutes.participantTestRunSave(testRunId),
    {
      method: "POST",
      body: JSON.stringify({
        participantSessionToken,
        unitKey: "UNIT-INTRO",
        response: {
          answer: "paused"
        }
      })
    },
    409
  ).then(body => {
    assert.equal(body.error.code, "test_run_save_rejected");
  });

  await delay(2200);

  const pausedRunAfter = await fetchJson<{
    runPolicy: {
      timeRemainingSeconds: number | null;
    };
  }>(`${apiRoutes.participantTestRun(testRunId)}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);

  assert.equal(
    pausedRunAfter.runPolicy.timeRemainingSeconds,
    pausedRunBefore.runPolicy.timeRemainingSeconds
  );

  const resumeResult = await fetchJson<{
    command: {
      commandType: string;
      ackState: string;
    };
  }>(apiRoutes.workspaceMonitorTestRunResume(demoTenantKey, demoWorkspaceKey, testRunId), {
    method: "POST"
  });
  assert.equal(resumeResult.command.commandType, "resume");
  assert.equal(resumeResult.command.ackState, "pending_delivery");

  await retry(async () => {
    const resumedRun = await fetchJson<{
      status: string;
      runPolicy: {
        pausedAt: string | null;
      };
    }>(`${apiRoutes.participantTestRun(testRunId)}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);

    assert.equal(resumedRun.status, "active");
    assert.equal(resumedRun.runPolicy.pausedAt, null);
    return resumedRun;
  }, 40, 250);

  await fetchJson(apiRoutes.participantTestRunSave(testRunId), {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      unitKey: "UNIT-INTRO",
      response: {
        answer: "intro-complete"
      }
    })
  });

  const advancedRun = await fetchJson<{
    currentUnitKey: string;
    status: string;
  }>(apiRoutes.participantTestRunNextUnit(testRunId), {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken
    })
  });

  assert.equal(advancedRun.currentUnitKey, "UNIT-MAIN");
  assert.equal(advancedRun.status, "active");

  const unlockResult = await fetchJson<{
    command: {
      commandType: string;
      ackState: string;
    };
    testRun: {
      runPolicy: {
        navigationLocked: boolean;
      };
    };
  }>(apiRoutes.workspaceMonitorTestRunUnlock(demoTenantKey, demoWorkspaceKey, testRunId), {
    method: "POST"
  });

  assert.equal(unlockResult.command.commandType, "unlock_navigation");
  assert.equal(unlockResult.command.ackState, "pending_delivery");

  await retry(async () => {
    const unlockedRun = await fetchJson<{
      runPolicy: {
        navigationLocked: boolean;
      };
    }>(`${apiRoutes.participantTestRun(testRunId)}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);

    assert.equal(unlockedRun.runPolicy.navigationLocked, false);
    return unlockedRun;
  }, 40, 250);

  const navigateBack = await fetchJson<{
    currentUnitKey: string;
    runPolicy: {
      navigationLocked: boolean;
    };
  }>(apiRoutes.participantTestRunNavigate(testRunId), {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      targetUnitKey: "UNIT-INTRO"
    })
  });

  assert.equal(navigateBack.currentUnitKey, "UNIT-INTRO");
  assert.equal(navigateBack.runPolicy.navigationLocked, false);

  const navigateForward = await fetchJson<{
    currentUnitKey: string;
  }>(apiRoutes.participantTestRunNavigate(testRunId), {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      targetUnitKey: "UNIT-MAIN"
    })
  });

  assert.equal(navigateForward.currentUnitKey, "UNIT-MAIN");

  await fetchJson(apiRoutes.participantTestRunSave(testRunId), {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      unitKey: "UNIT-MAIN",
      response: {
        answer: "main-complete"
      }
    })
  });

  const completedRun = await fetchJson<{
    status: string;
    completedAt: string | null;
  }>(apiRoutes.participantTestRunNextUnit(testRunId), {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken
    })
  });

  assert.equal(completedRun.status, "completed");
  assert.ok(completedRun.completedAt);

  const relaunchAfterCompletion = await fetchJson<{
    testRunId: string;
    launchDisposition: string;
    attemptNumber: number;
    status: string;
    launchAuthorization: {
      launchApprovalId: string | null;
      approvalScope: string | null;
      approvalApplied: boolean;
      approvedBySupervisorId: string | null;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create",
      launchApprovalId: workspaceLaunchApprovalResponse.body.approval.launchApprovalId
    })
  }, 201);

  assert.notEqual(relaunchAfterCompletion.testRunId, testRunId);
  assert.equal(relaunchAfterCompletion.launchDisposition, "created");
  assert.equal(relaunchAfterCompletion.attemptNumber, 2);
  assert.equal(relaunchAfterCompletion.status, "active");
  assert.equal(
    relaunchAfterCompletion.launchAuthorization.launchApprovalId,
    workspaceLaunchApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(relaunchAfterCompletion.launchAuthorization.approvalScope, "session_assignment");
  assert.equal(relaunchAfterCompletion.launchAuthorization.approvalApplied, true);
  assert.equal(relaunchAfterCompletion.launchAuthorization.approvedBySupervisorId, "proctor-alpha");

  const finalMonitorList = await fetchJson<{
    items: Array<{
      testRunId: string;
      attemptNumber: number;
      status: string;
    }>;
  }>(apiRoutes.workspaceMonitorTestRuns(demoTenantKey, demoWorkspaceKey));
  assert.equal(finalMonitorList.items.length, 1);
  assert.equal(finalMonitorList.items[0].testRunId, relaunchAfterCompletion.testRunId);
  assert.equal(finalMonitorList.items[0].attemptNumber, 2);
  assert.equal(finalMonitorList.items[0].status, "active");

  const tenantPolicySourcePackage = await fetchJson<{ sourcePackageId: string }>(
    apiRoutes.workspaceSourcePackages(demoTenantKey, tenantPolicyWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        fileName: starterFixture.sourcePackageFileNames[0],
        manifestHash: starterFixture.fixtureKey,
        format: "xml-archive",
        uploadedBy: "contract-test"
      })
    },
    201
  );

  const tenantPolicyImportJob = await fetchJson<{ importJobId: string }>(
    apiRoutes.workspaceImportJobs(demoTenantKey, tenantPolicyWorkspaceKey),
    {
      method: "POST",
      body: JSON.stringify({
        sourcePackageId: tenantPolicySourcePackage.sourcePackageId
      })
    },
    201
  );

  const tenantPolicyReleaseId = await retry(async () => {
    const tenantPolicyImportJobDetail = await fetchJson<{
      importJob: {
        status: string;
      };
      contentRelease: {
        contentReleaseId: string;
      } | null;
    }>(
      apiRoutes.workspaceImportJob(demoTenantKey, tenantPolicyWorkspaceKey, tenantPolicyImportJob.importJobId)
    );

    assert.equal(tenantPolicyImportJobDetail.importJob.status, "completed");
    assert.ok(tenantPolicyImportJobDetail.contentRelease);
    return tenantPolicyImportJobDetail.contentRelease.contentReleaseId;
  }, 40, 250);

  await fetchJson(
    apiRoutes.contentReleaseActivate(demoTenantKey, tenantPolicyWorkspaceKey, tenantPolicyReleaseId),
    {
      method: "POST"
    }
  );

  const tenantPolicySignInResponse = await fetchJsonResponse<{
    loginFlow: {
      participantSessionToken: string;
    };
  }>(apiRoutes.participantAuthSignIn, {
    method: "POST",
    body: JSON.stringify({
      tenantKey: demoTenantKey,
      workspaceKey: tenantPolicyWorkspaceKey,
      loginKey: "alpha-001"
    })
  });

  const tenantPolicyParticipantSessionToken =
    tenantPolicySignInResponse.body.loginFlow.participantSessionToken;

  const tenantPolicyStarter = await fetchJson<{
    assignments: Array<{
      assignmentKey: string;
    }>;
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
    };
  }>(
    `${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(tenantPolicyParticipantSessionToken)}`
  );
  assert.equal(tenantPolicyStarter.systemCheckReadiness.status, "blocked");
  assert.deepEqual(tenantPolicyStarter.systemCheckReadiness.blockingReasonCodes, ["missing_submission"]);

  const tenantPolicyAssignmentKey = tenantPolicyStarter.assignments[0]?.assignmentKey;
  assert.ok(tenantPolicyAssignmentKey);

  const tenantPolicySystemCheckSubmit = await fetchJson<{
    submission: {
      status: string;
    };
  }>(apiRoutes.participantSystemCheckSubmit, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: tenantPolicyParticipantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkResults: {
        browser: {
          status: "passed",
          detailMessage: "Chromium 123",
          observedValue: "supported",
          evidenceKeys: []
        },
        audio: {
          status: "passed",
          detailMessage: "Headphones connected",
          observedValue: "ok",
          evidenceKeys: []
        },
        screen: {
          status: "passed",
          detailMessage: null,
          observedValue: "1920x1080",
          evidenceKeys: []
        }
      }
    })
  }, 201);
  assert.equal(tenantPolicySystemCheckSubmit.submission.status, "passed");

  const tenantPolicyLaunch = await fetchJson<{
    testRunId: string;
    status: string;
    systemCheckReadiness: {
      status: string;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: tenantPolicyParticipantSessionToken,
      assignmentKey: tenantPolicyAssignmentKey,
      resumeBehavior: "resume_or_create"
    })
  }, 201);

  assert.equal(tenantPolicyLaunch.status, "active");
  assert.equal(tenantPolicyLaunch.systemCheckReadiness.status, "ready");

  const maintenanceFixtures = await seedStaleMaintenanceFixtures(relaunchAfterCompletion.testRunId);
  const inheritedMaintenanceFixtures = await seedStaleMaintenanceFixtures(tenantPolicyLaunch.testRunId);

  await retry(async () => {
    const maintenanceAuditEvents = await fetchJson<{
      items: Array<{
        actorType: string;
        eventType: string;
        testRunId: string | null;
      }>;
    }>(`${apiRoutes.workspaceAuditEvents(demoTenantKey, demoWorkspaceKey)}?limit=200`);

    assert.ok(maintenanceAuditEvents.items.some(item =>
      item.actorType === "worker" &&
      item.eventType === "worker.test_run.timed_out" &&
      item.testRunId === relaunchAfterCompletion.testRunId
    ));
    assert.ok(maintenanceAuditEvents.items.some(item =>
      item.actorType === "dispatcher" &&
      item.eventType === "dispatcher.monitor_command.expired" &&
      item.testRunId === relaunchAfterCompletion.testRunId
    ));

    return maintenanceAuditEvents;
  }, 40, 250);

  const timedOutRun = await retry(async () => {
    const currentRun = await fetchJson<{
      status: string;
      completedAt: string | null;
      runPolicy: {
        timeRemainingSeconds: number | null;
      };
    }>(`${apiRoutes.participantTestRun(relaunchAfterCompletion.testRunId)}?participantSessionToken=${encodeURIComponent(participantSessionToken)}`);

    assert.equal(currentRun.status, "timed_out");
    return currentRun;
  }, 40, 250);

  assert.equal(timedOutRun.status, "timed_out");
  assert.ok(timedOutRun.completedAt);
  assert.equal(timedOutRun.runPolicy.timeRemainingSeconds, 0);

  const inheritedPersistedRun = await getPersistedTestRun(tenantPolicyLaunch.testRunId);
  assert.ok(inheritedPersistedRun);
  assert.equal(inheritedPersistedRun.status, "active");
  assert.equal(inheritedPersistedRun.completedAt, null);

  const expiredCommands = await retry(async () => {
    const currentExpiredCommands = await fetchJson<{
      items: Array<{
        commandId: string;
        ackState: string;
        rejectionReason: string | null;
        testRunId: string;
      }>;
      filters: {
        testRunId: string | null;
        ackState: string | null;
      };
    }>(
      `${apiRoutes.workspaceMonitorCommands(demoTenantKey, demoWorkspaceKey)}?testRunId=${encodeURIComponent(relaunchAfterCompletion.testRunId)}&ackState=expired`
    );

    assert.ok(currentExpiredCommands.items.some(item =>
      item.commandId === maintenanceFixtures.staleCommandId &&
      item.ackState === "expired" &&
      item.testRunId === relaunchAfterCompletion.testRunId &&
      item.rejectionReason === "resolution_timeout"
    ));

    return currentExpiredCommands;
  }, 40, 250);

  assert.equal(expiredCommands.filters.testRunId, relaunchAfterCompletion.testRunId);
  assert.equal(expiredCommands.filters.ackState, "expired");
  assert.ok(expiredCommands.items.some(item =>
    item.commandId === maintenanceFixtures.staleCommandId &&
    item.ackState === "expired" &&
    item.testRunId === relaunchAfterCompletion.testRunId &&
    item.rejectionReason === "resolution_timeout"
  ));

  const inheritedExpiredCommands = await fetchJson<{
    items: Array<{
      commandId: string;
    }>;
  }>(
    `${apiRoutes.workspaceMonitorCommands(demoTenantKey, tenantPolicyWorkspaceKey)}?testRunId=${encodeURIComponent(tenantPolicyLaunch.testRunId)}&ackState=expired`
  );
  assert.ok(!inheritedExpiredCommands.items.some(item => item.commandId === inheritedMaintenanceFixtures.staleCommandId));

  const monitorAfterMaintenance = await retry(async () => {
    const currentMonitorList = await fetchJson<{
      items: Array<{
        testRunId: string;
      }>;
    }>(apiRoutes.workspaceMonitorTestRuns(demoTenantKey, demoWorkspaceKey));

    assert.equal(currentMonitorList.items.length, 0);
    return currentMonitorList;
  }, 40, 250);
  assert.equal(monitorAfterMaintenance.items.length, 0);

  const relaunchAfterTimeout = await fetchJson<{
    testRunId: string;
    launchDisposition: string;
    attemptNumber: number;
    status: string;
    launchAuthorization: {
      launchApprovalId: string | null;
      approvalScope: string | null;
      approvalApplied: boolean;
      approvedBySupervisorId: string | null;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken,
      assignmentKey,
      resumeBehavior: "resume_or_create",
      launchApprovalId: workspaceLaunchApprovalResponse.body.approval.launchApprovalId
    })
  }, 201);

  assert.notEqual(relaunchAfterTimeout.testRunId, relaunchAfterCompletion.testRunId);
  assert.equal(relaunchAfterTimeout.launchDisposition, "created");
  assert.equal(relaunchAfterTimeout.attemptNumber, 3);
  assert.equal(relaunchAfterTimeout.status, "active");
  assert.equal(
    relaunchAfterTimeout.launchAuthorization.launchApprovalId,
    workspaceLaunchApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(relaunchAfterTimeout.launchAuthorization.approvalScope, "session_assignment");
  assert.equal(relaunchAfterTimeout.launchAuthorization.approvalApplied, true);
  assert.equal(relaunchAfterTimeout.launchAuthorization.approvedBySupervisorId, "proctor-alpha");

  const approvalLifecycleSignInResponse = await fetchJsonResponse<{
    loginFlow: {
      participantSessionToken: string;
    };
  }>(apiRoutes.participantAuthSignIn, {
    method: "POST",
    body: JSON.stringify({
      tenantKey: demoTenantKey,
      workspaceKey: demoWorkspaceKey,
      loginKey: "alpha-001"
    })
  }, 200);
  const approvalLifecycleParticipantSessionToken =
    approvalLifecycleSignInResponse.body.loginFlow.participantSessionToken;

  const approvalLifecycleStarter = await fetchJson<{
    assignments: Array<{
      assignmentKey: string;
    }>;
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
    };
  }>(
    `${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(approvalLifecycleParticipantSessionToken)}`
  );
  assert.equal(approvalLifecycleStarter.systemCheckReadiness.status, "blocked");
  assert.deepEqual(approvalLifecycleStarter.systemCheckReadiness.blockingReasonCodes, ["missing_submission"]);
  const approvalLifecycleAssignmentKey = approvalLifecycleStarter.assignments[0]?.assignmentKey;
  assert.ok(approvalLifecycleAssignmentKey);

  const approvalLifecycleWarningSubmitResponse = await fetchJsonResponse<{
    submission: {
      systemCheckSubmissionId: string;
      participantSessionId: string;
      status: string;
      review: {
        reviewStatus: string;
      };
    };
  }>(apiRoutes.participantSystemCheckSubmit, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: approvalLifecycleParticipantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkResults: {
        browser: {
          status: "passed",
          detailMessage: "Chromium 123",
          observedValue: "supported",
          evidenceKeys: []
        },
        audio: {
          status: "warning",
          detailMessage: "Audio output was quiet on default speakers.",
          observedValue: "quiet",
          evidenceKeys: []
        },
        screen: {
          status: "passed",
          detailMessage: null,
          observedValue: "1920x1080",
          evidenceKeys: []
        }
      }
    })
  }, 201);
  const approvalLifecycleWarningSubmitRequestId =
    approvalLifecycleWarningSubmitResponse.headers.get("x-request-id");
  assert.ok(approvalLifecycleWarningSubmitRequestId);
  assert.equal(approvalLifecycleWarningSubmitResponse.body.submission.status, "warning");
  assert.equal(
    approvalLifecycleWarningSubmitResponse.body.submission.review.reviewStatus,
    "pending"
  );
  const approvalLifecycleParticipantSessionId =
    approvalLifecycleWarningSubmitResponse.body.submission.participantSessionId;

  const approvalLifecycleAcceptedReviewResponse = await fetchJsonResponse<{
    submission: {
      review: {
        reviewStatus: string;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckResultReview(
      demoTenantKey,
      demoWorkspaceKey,
      approvalLifecycleWarningSubmitResponse.body.submission.systemCheckSubmissionId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "accepted",
        reviewNote: "Warning acknowledged for lifecycle coverage."
      })
    }
  );
  assert.equal(
    approvalLifecycleAcceptedReviewResponse.body.submission.review.reviewStatus,
    "accepted"
  );

  const approvalLifecycleStarterAfterAccepted = await fetchJson<{
    systemCheckReadiness: {
      status: string;
      warningReasonCodes: string[];
    };
  }>(
    `${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(approvalLifecycleParticipantSessionToken)}`
  );
  assert.equal(approvalLifecycleStarterAfterAccepted.systemCheckReadiness.status, "warning");
  assert.deepEqual(
    approvalLifecycleStarterAfterAccepted.systemCheckReadiness.warningReasonCodes,
    ["accepted_with_warning"]
  );

  const approvalLifecycleApprovalResponse = await fetchJsonResponse<{
    approval: {
      launchApprovalId: string;
      status: string;
      warningReasonCodes: string[];
      invalidatedAt: string | null;
      invalidationReasonCode: string | null;
      revokedAt: string | null;
      revokedBySupervisorId: string | null;
      revocationNote: string | null;
    };
  }>(apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, demoWorkspaceKey), {
    method: "POST",
    body: JSON.stringify({
      participantSessionId: approvalLifecycleParticipantSessionId,
      assignmentKey: approvalLifecycleAssignmentKey,
      approvalScope: "session_assignment",
      approvedBySupervisorId: "proctor-lifecycle",
      approvalNote: "Lifecycle approval for invalidation coverage."
    })
  }, 201);
  assert.equal(approvalLifecycleApprovalResponse.body.approval.status, "active");
  assert.deepEqual(
    approvalLifecycleApprovalResponse.body.approval.warningReasonCodes,
    ["accepted_with_warning"]
  );
  assert.equal(approvalLifecycleApprovalResponse.body.approval.invalidatedAt, null);
  assert.equal(approvalLifecycleApprovalResponse.body.approval.revokedAt, null);

  const approvalLifecycleFailedSubmitResponse = await fetchJsonResponse<{
    submission: {
      systemCheckSubmissionId: string;
      status: string;
      review: {
        reviewStatus: string;
      };
    };
  }>(apiRoutes.participantSystemCheckSubmit, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: approvalLifecycleParticipantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkResults: {
        browser: {
          status: "passed",
          detailMessage: "Chromium 123",
          observedValue: "supported",
          evidenceKeys: []
        },
        audio: {
          status: "failed",
          detailMessage: "Audio output was not audible.",
          observedValue: "inaudible",
          evidenceKeys: []
        },
        screen: {
          status: "passed",
          detailMessage: null,
          observedValue: "1920x1080",
          evidenceKeys: []
        }
      }
    })
  }, 201);
  const approvalLifecycleFailedSubmitRequestId =
    approvalLifecycleFailedSubmitResponse.headers.get("x-request-id");
  assert.ok(approvalLifecycleFailedSubmitRequestId);
  assert.equal(approvalLifecycleFailedSubmitResponse.body.submission.status, "failed");
  assert.equal(
    approvalLifecycleFailedSubmitResponse.body.submission.review.reviewStatus,
    "pending"
  );

  const approvalLifecycleInvalidatedApprovals = await fetchJson<{
    items: Array<{
      launchApprovalId: string;
      status: string;
      invalidatedAt: string | null;
      invalidationReasonCode: string | null;
      invalidationReasonDetail: string | null;
      revokedAt: string | null;
    }>;
    filters: {
      participantSessionId: string | null;
      assignmentKey: string | null;
      status: string | null;
      approvalScope: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, demoWorkspaceKey)}?participantSessionId=${encodeURIComponent(approvalLifecycleParticipantSessionId)}&assignmentKey=${encodeURIComponent(approvalLifecycleAssignmentKey)}&status=invalidated`
  );
  assert.deepEqual(approvalLifecycleInvalidatedApprovals.filters, {
    participantSessionId: approvalLifecycleParticipantSessionId,
    assignmentKey: approvalLifecycleAssignmentKey,
    status: "invalidated",
    approvalScope: null
  });
  assert.equal(approvalLifecycleInvalidatedApprovals.items.length, 1);
  assert.equal(
    approvalLifecycleInvalidatedApprovals.items[0].launchApprovalId,
    approvalLifecycleApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(approvalLifecycleInvalidatedApprovals.items[0].status, "invalidated");
  assert.ok(approvalLifecycleInvalidatedApprovals.items[0].invalidatedAt);
  assert.equal(
    approvalLifecycleInvalidatedApprovals.items[0].invalidationReasonCode,
    "readiness_no_longer_warning"
  );
  assert.match(
    approvalLifecycleInvalidatedApprovals.items[0].invalidationReasonDetail ?? "",
    /blocked/
  );
  assert.equal(approvalLifecycleInvalidatedApprovals.items[0].revokedAt, null);

  const approvalLifecycleStarterBlocked = await fetchJson<{
    systemCheckReadiness: {
      status: string;
      blockingReasonCodes: string[];
    };
  }>(
    `${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(approvalLifecycleParticipantSessionToken)}`
  );
  assert.equal(approvalLifecycleStarterBlocked.systemCheckReadiness.status, "blocked");
  assert.deepEqual(
    approvalLifecycleStarterBlocked.systemCheckReadiness.blockingReasonCodes,
    ["pending_review"]
  );

  const approvalLifecycleFailedAcceptedReviewResponse = await fetchJsonResponse<{
    submission: {
      review: {
        reviewStatus: string;
      };
    };
  }>(
    apiRoutes.workspaceSystemCheckResultReview(
      demoTenantKey,
      demoWorkspaceKey,
      approvalLifecycleFailedSubmitResponse.body.submission.systemCheckSubmissionId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "accepted",
        reviewNote: "Failure accepted for revocation coverage."
      })
    }
  );
  assert.equal(
    approvalLifecycleFailedAcceptedReviewResponse.body.submission.review.reviewStatus,
    "accepted"
  );

  const approvalLifecycleStarterAfterFailureAccepted = await fetchJson<{
    systemCheckReadiness: {
      status: string;
      warningReasonCodes: string[];
    };
  }>(
    `${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(approvalLifecycleParticipantSessionToken)}`
  );
  assert.equal(approvalLifecycleStarterAfterFailureAccepted.systemCheckReadiness.status, "warning");
  assert.deepEqual(
    approvalLifecycleStarterAfterFailureAccepted.systemCheckReadiness.warningReasonCodes,
    ["accepted_with_failure"]
  );

  const invalidatedApprovalLaunch = await fetchJsonResponse<{
    error: {
      code: string;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: approvalLifecycleParticipantSessionToken,
      assignmentKey: approvalLifecycleAssignmentKey,
      resumeBehavior: "create_new",
      launchApprovalId: approvalLifecycleApprovalResponse.body.approval.launchApprovalId
    })
  }, 409);
  assert.equal(
    invalidatedApprovalLaunch.body.error.code,
    "starter_launch_invalid_launch_approval"
  );

  const approvalLifecycleRevocableApprovalResponse = await fetchJsonResponse<{
    approval: {
      launchApprovalId: string;
      status: string;
      warningReasonCodes: string[];
      revokedAt: string | null;
      revokedBySupervisorId: string | null;
      revocationNote: string | null;
    };
  }>(apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, demoWorkspaceKey), {
    method: "POST",
    body: JSON.stringify({
      participantSessionId: approvalLifecycleParticipantSessionId,
      assignmentKey: approvalLifecycleAssignmentKey,
      approvalScope: "single_launch",
      approvedBySupervisorId: "proctor-revoker",
      approvalNote: "Lifecycle approval for revocation coverage."
    })
  }, 201);
  assert.equal(approvalLifecycleRevocableApprovalResponse.body.approval.status, "active");
  assert.deepEqual(
    approvalLifecycleRevocableApprovalResponse.body.approval.warningReasonCodes,
    ["accepted_with_failure"]
  );

  const approvalLifecycleRevocationResponse = await fetchJsonResponse<{
    approval: {
      launchApprovalId: string;
      status: string;
      revokedAt: string | null;
      revokedBySupervisorId: string | null;
      revocationNote: string | null;
    };
  }>(
    apiRoutes.workspaceSystemCheckLaunchApprovalRevoke(
      demoTenantKey,
      demoWorkspaceKey,
      approvalLifecycleRevocableApprovalResponse.body.approval.launchApprovalId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        revokedBySupervisorId: "proctor-revoker",
        revocationNote: "Supervisor withdrew approval after the second review."
      })
    },
    200
  );
  const approvalLifecycleRevocationRequestId =
    approvalLifecycleRevocationResponse.headers.get("x-request-id");
  assert.ok(approvalLifecycleRevocationRequestId);
  assert.equal(approvalLifecycleRevocationResponse.body.approval.status, "revoked");
  assert.ok(approvalLifecycleRevocationResponse.body.approval.revokedAt);
  assert.equal(
    approvalLifecycleRevocationResponse.body.approval.revokedBySupervisorId,
    "proctor-revoker"
  );
  assert.equal(
    approvalLifecycleRevocationResponse.body.approval.revocationNote,
    "Supervisor withdrew approval after the second review."
  );

  const approvalLifecycleRevokedApprovals = await fetchJson<{
    items: Array<{
      launchApprovalId: string;
      status: string;
      revokedAt: string | null;
      revokedBySupervisorId: string | null;
      revocationNote: string | null;
    }>;
  }>(
    `${apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, demoWorkspaceKey)}?participantSessionId=${encodeURIComponent(approvalLifecycleParticipantSessionId)}&assignmentKey=${encodeURIComponent(approvalLifecycleAssignmentKey)}&status=revoked`
  );
  assert.equal(approvalLifecycleRevokedApprovals.items.length, 1);
  assert.equal(
    approvalLifecycleRevokedApprovals.items[0].launchApprovalId,
    approvalLifecycleRevocableApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(approvalLifecycleRevokedApprovals.items[0].status, "revoked");
  assert.ok(approvalLifecycleRevokedApprovals.items[0].revokedAt);
  assert.equal(
    approvalLifecycleRevokedApprovals.items[0].revokedBySupervisorId,
    "proctor-revoker"
  );
  assert.equal(
    approvalLifecycleRevokedApprovals.items[0].revocationNote,
    "Supervisor withdrew approval after the second review."
  );

  const revokedApprovalLaunch = await fetchJsonResponse<{
    error: {
      code: string;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: approvalLifecycleParticipantSessionToken,
      assignmentKey: approvalLifecycleAssignmentKey,
      resumeBehavior: "create_new",
      launchApprovalId: approvalLifecycleRevocableApprovalResponse.body.approval.launchApprovalId
    })
  }, 409);
  assert.equal(
    revokedApprovalLaunch.body.error.code,
    "starter_launch_invalid_launch_approval"
  );

  const approvalExpiryWorkspacePolicyResponse = await fetchJsonResponse<WorkspaceLaunchApprovalPolicyResponse>(
    apiRoutes.workspaceLaunchApprovalPolicy(demoTenantKey, tenantPolicyWorkspaceKey),
    {
      method: "PATCH",
      body: JSON.stringify({
        mode: "override",
        launchApprovalPolicyOverride: {
          systemCheckLaunchApprovalTtlSeconds: 1
        }
      })
    }
  );
  assert.equal(approvalExpiryWorkspacePolicyResponse.body.mode, "override");
  assert.deepEqual(approvalExpiryWorkspacePolicyResponse.body.launchApprovalPolicyOverride, {
    systemCheckLaunchApprovalTtlSeconds: 1
  });
  assert.deepEqual(approvalExpiryWorkspacePolicyResponse.body.effectiveLaunchApprovalPolicy, {
    systemCheckLaunchApprovalTtlSeconds: 1
  });

  const approvalExpirySignInResponse = await fetchJsonResponse<{
    loginFlow: {
      participantSessionToken: string;
    };
  }>(apiRoutes.participantAuthSignIn, {
    method: "POST",
    body: JSON.stringify({
      tenantKey: demoTenantKey,
      workspaceKey: tenantPolicyWorkspaceKey,
      loginKey: "alpha-001"
    })
  }, 200);
  const approvalExpiryParticipantSessionToken =
    approvalExpirySignInResponse.body.loginFlow.participantSessionToken;

  const approvalExpiryStarter = await fetchJson<{
    assignments: Array<{
      assignmentKey: string;
    }>;
  }>(
    `${apiRoutes.participantStarter}?participantSessionToken=${encodeURIComponent(approvalExpiryParticipantSessionToken)}`
  );
  const approvalExpiryAssignmentKey = approvalExpiryStarter.assignments[0]?.assignmentKey;
  assert.ok(approvalExpiryAssignmentKey);

  const approvalExpiryWarningSubmitResponse = await fetchJsonResponse<{
    submission: {
      systemCheckSubmissionId: string;
      participantSessionId: string;
      status: string;
    };
  }>(apiRoutes.participantSystemCheckSubmit, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: approvalExpiryParticipantSessionToken,
      systemCheckKey: "SC-BASELINE",
      checkResults: {
        browser: {
          status: "passed",
          detailMessage: "Chromium 123",
          observedValue: "supported",
          evidenceKeys: []
        },
        audio: {
          status: "warning",
          detailMessage: "Audio output remained quiet.",
          observedValue: "quiet",
          evidenceKeys: []
        },
        screen: {
          status: "passed",
          detailMessage: null,
          observedValue: "1920x1080",
          evidenceKeys: []
        }
      }
    })
  }, 201);
  const approvalExpiryParticipantSessionId =
    approvalExpiryWarningSubmitResponse.body.submission.participantSessionId;
  assert.equal(approvalExpiryWarningSubmitResponse.body.submission.status, "warning");

  await fetchJsonResponse(
    apiRoutes.workspaceSystemCheckResultReview(
      demoTenantKey,
      tenantPolicyWorkspaceKey,
      approvalExpiryWarningSubmitResponse.body.submission.systemCheckSubmissionId
    ),
    {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: "accepted",
        reviewNote: "Warning accepted for policy-driven expiry coverage."
      })
    }
  );

  const approvalLifecycleExpiringApprovalResponse = await fetchJsonResponse<{
    approval: {
      launchApprovalId: string;
      status: string;
      expiresAt: string | null;
      expiredAt: string | null;
      expirationReasonCode: string | null;
    };
  }>(apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, tenantPolicyWorkspaceKey), {
    method: "POST",
    body: JSON.stringify({
      participantSessionId: approvalExpiryParticipantSessionId,
      assignmentKey: approvalExpiryAssignmentKey,
      approvalScope: "single_launch",
      approvedBySupervisorId: "proctor-expiry",
      approvalNote: "Lifecycle approval for policy-driven expiry coverage."
    })
  }, 201);
  assert.equal(approvalLifecycleExpiringApprovalResponse.body.approval.status, "active");
  assert.ok(approvalLifecycleExpiringApprovalResponse.body.approval.expiresAt);
  assert.equal(approvalLifecycleExpiringApprovalResponse.body.approval.expiredAt, null);
  assert.equal(approvalLifecycleExpiringApprovalResponse.body.approval.expirationReasonCode, null);

  await delay(1200);

  const approvalLifecycleExpiredApprovalsResponse = await fetchJsonResponse<{
    items: Array<{
      launchApprovalId: string;
      status: string;
      expiresAt: string | null;
      expiredAt: string | null;
      expirationReasonCode: string | null;
    }>;
    filters: {
      participantSessionId: string | null;
      assignmentKey: string | null;
      status: string | null;
      approvalScope: string | null;
    };
  }>(
    `${apiRoutes.workspaceSystemCheckLaunchApprovals(demoTenantKey, tenantPolicyWorkspaceKey)}?participantSessionId=${encodeURIComponent(approvalExpiryParticipantSessionId)}&assignmentKey=${encodeURIComponent(approvalExpiryAssignmentKey)}&status=expired`
  );
  const approvalLifecycleExpiredListRequestId =
    approvalLifecycleExpiredApprovalsResponse.headers.get("x-request-id");
  assert.ok(approvalLifecycleExpiredListRequestId);
  assert.deepEqual(approvalLifecycleExpiredApprovalsResponse.body.filters, {
    participantSessionId: approvalExpiryParticipantSessionId,
    assignmentKey: approvalExpiryAssignmentKey,
    status: "expired",
    approvalScope: null
  });
  assert.equal(approvalLifecycleExpiredApprovalsResponse.body.items.length, 1);
  assert.equal(
    approvalLifecycleExpiredApprovalsResponse.body.items[0].launchApprovalId,
    approvalLifecycleExpiringApprovalResponse.body.approval.launchApprovalId
  );
  assert.equal(approvalLifecycleExpiredApprovalsResponse.body.items[0].status, "expired");
  assert.ok(approvalLifecycleExpiredApprovalsResponse.body.items[0].expiresAt);
  assert.ok(approvalLifecycleExpiredApprovalsResponse.body.items[0].expiredAt);
  assert.equal(
    approvalLifecycleExpiredApprovalsResponse.body.items[0].expirationReasonCode,
    "time_elapsed"
  );

  const expiredApprovalLaunch = await fetchJsonResponse<{
    error: {
      code: string;
    };
  }>(apiRoutes.participantStarterLaunch, {
    method: "POST",
    body: JSON.stringify({
      participantSessionToken: approvalExpiryParticipantSessionToken,
      assignmentKey: approvalExpiryAssignmentKey,
      resumeBehavior: "create_new",
      launchApprovalId: approvalLifecycleExpiringApprovalResponse.body.approval.launchApprovalId
    })
  }, 409);
  assert.equal(
    expiredApprovalLaunch.body.error.code,
    "starter_launch_invalid_launch_approval"
  );

  const approvalLifecycleAuditEvents = await fetchJson<{
    items: Array<{
      requestId: string;
      eventType: string;
      loginKey: string | null;
      groupKey: string | null;
    }>;
  }>(`${apiRoutes.workspaceAuditEvents(demoTenantKey, demoWorkspaceKey)}?limit=200`);
  assert.ok(
    approvalLifecycleAuditEvents.items.some(item =>
      item.requestId === approvalLifecycleFailedSubmitRequestId &&
      item.eventType === "workspace.system_check.launch_approval.invalidated" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );
  assert.ok(
    approvalLifecycleAuditEvents.items.some(item =>
      item.requestId === approvalLifecycleRevocationRequestId &&
      item.eventType === "workspace.system_check.launch_approval.revoked" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );

  const approvalExpiryAuditEvents = await fetchJson<{
    items: Array<{
      requestId: string;
      eventType: string;
      loginKey: string | null;
      groupKey: string | null;
    }>;
  }>(`${apiRoutes.workspaceAuditEvents(demoTenantKey, tenantPolicyWorkspaceKey)}?limit=200`);
  assert.ok(
    approvalExpiryAuditEvents.items.some(item =>
      item.requestId === approvalLifecycleExpiredListRequestId &&
      item.eventType === "workspace.system_check.launch_approval.expired" &&
      item.loginKey === "alpha-001" &&
      item.groupKey === "group-alpha"
    )
  );

  const revisionActivationResponse = await fetchJson<{
    contentReleaseId: string;
    status: string;
    activationGuardrail: ContentReleaseActivationGuardrail;
  }>(
    apiRoutes.contentReleaseActivate(demoTenantKey, demoWorkspaceKey, groupMonitorRevisionContentReleaseId),
    {
      method: "POST"
    }
  );

  assert.equal(revisionActivationResponse.contentReleaseId, groupMonitorRevisionContentReleaseId);
  assert.equal(revisionActivationResponse.status, "active");
  assert.equal(revisionActivationResponse.activationGuardrail.status, "ready");
  assert.equal(revisionActivationResponse.activationGuardrail.comparisonMode, "already_active");
  assert.equal(revisionActivationResponse.activationGuardrail.activeSessionCount, 1);

  const auditEvents = await retry(async () => {
    const currentAuditEvents = await fetchJson<{
      items: Array<{
        requestId: string;
        actorType: string;
        eventType: string;
        testRunId: string | null;
        loginKey: string | null;
      }>;
    }>(`${apiRoutes.workspaceAuditEvents(demoTenantKey, demoWorkspaceKey)}?limit=200`);

    assert.ok(currentAuditEvents.items.length >= 10);
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.requestId === signInRequestId &&
        item.actorType === "participant" &&
        item.eventType === "participant.signed_in" &&
        item.loginKey === "alpha-001"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.requestId === launchRequestId &&
        item.actorType === "participant" &&
        item.eventType === "participant.test_run.created" &&
        item.testRunId === testRunId
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.requestId === launchRequestId &&
        item.actorType === "platform_api" &&
        item.eventType === "participant.starter.launch_approval_applied" &&
        item.loginKey === "alpha-001"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.requestId === pauseRequestId &&
        item.actorType === "dispatcher" &&
        item.eventType === "monitor.command.applied" &&
        item.testRunId === testRunId
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.actorType === "worker" &&
        item.eventType === "worker.import_job.completed"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.actorType === "worker" &&
        item.eventType === "worker.import_job.failed"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.eventType === "workspace.content_release.activated"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.eventType === "workspace.content_release.activation_blocked"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.eventType === "workspace.activation_policy.updated"
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.actorType === "worker" &&
        item.eventType === "worker.test_run.timed_out" &&
        item.testRunId === relaunchAfterCompletion.testRunId
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.actorType === "dispatcher" &&
        item.eventType === "dispatcher.monitor_command.expired" &&
        item.testRunId === relaunchAfterCompletion.testRunId
      )
    );
    assert.ok(
      currentAuditEvents.items.some(item =>
        item.actorType === "worker" &&
        item.actorId === "provider-operations-service" &&
        item.eventType === "provider_operations.workspace.notification_provider_profile.refreshed"
      )
    );

    return currentAuditEvents;
  }, 40, 250);

  assert.match(apiProcess.output, /rewrite-spike api listening/);
  assert.match(dispatcherProcess.output, /rewrite-spike dispatcher loop started/);
  assert.match(notificationsProcess.output, /rewrite-spike notification service loop started/);
  assert.match(providerOperationsProcess.output, /rewrite-spike provider-operations loop started/);
  assert.match(workerProcess.output, /rewrite-spike worker loop started/);
});
