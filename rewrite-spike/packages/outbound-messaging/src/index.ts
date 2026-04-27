import { randomUUID } from "node:crypto";

export type OutboundNotificationDeliverySelectionMode =
  | "infer_from_target"
  | "force_webhook_spike"
  | "force_email_spike";

export type OutboundNotificationDeliveryChannel =
  | "webhook_spike"
  | "email_spike";

export type OutboundNotificationProviderProfileRolloutState =
  | "active"
  | "paused"
  | "canary";

export type OutboundNotificationProviderProfileTargetProbeMode =
  | "active"
  | "skip";

export type OutboundNotificationProviderProfileCredentialsStatus =
  | "not_configured"
  | "reachable"
  | "unreachable";

export type OutboundNotificationProviderProfileHealthStatus =
  | "ready"
  | "paused"
  | "disabled"
  | "credentials_unreachable"
  | "target_unreachable";

export type OutboundNotificationProviderProfileOperationalRolloutStatus =
  | "active_ready"
  | "active_blocked"
  | "paused"
  | "disabled"
  | "canary_ready"
  | "canary_blocked";

export type OutboundNotificationProviderProfileProbeStatus =
  | "succeeded"
  | "skipped_paused"
  | "skipped_disabled"
  | "skipped_by_policy"
  | "credentials_unreachable"
  | "target_unreachable";

export type OutboundNotificationProviderProfileIncidentType =
  | "auto_rollback_failure";

export type OutboundNotificationProviderProfileIncidentReasonCode =
  | "delivery_failures_present";

export type OutboundNotificationProviderProfileIncidentResolutionCode =
  | "auto_promoted"
  | "manually_promoted";

export interface OutboundNotificationProviderProfileIncidentState {
  incidentType: OutboundNotificationProviderProfileIncidentType;
  openedAt: string;
  openedByActorType: "worker" | "notification_service" | "platform_api";
  openedByActorId: string;
  reasonCode: OutboundNotificationProviderProfileIncidentReasonCode;
  deliveryFailedCount: number;
  suppressionUntil: string | null;
  resolvedAt: string | null;
  resolutionCode: OutboundNotificationProviderProfileIncidentResolutionCode | null;
}

export interface OutboundNotificationProviderProfileOperationalState {
  lastCheckedAt: string;
  lastCheckedByActorType: "worker" | "notification_service" | "platform_api";
  lastCheckedByActorId: string;
  credentialsStatus: OutboundNotificationProviderProfileCredentialsStatus;
  healthStatus: OutboundNotificationProviderProfileHealthStatus;
  rolloutStatus: OutboundNotificationProviderProfileOperationalRolloutStatus;
  probeStatus: OutboundNotificationProviderProfileProbeStatus;
  probeTarget: string | null;
  probeLatencyMs: number | null;
  lastCheckError: string | null;
}

export interface OutboundNotificationPolicy {
  breachNotificationDeliverySelectionMode: OutboundNotificationDeliverySelectionMode;
  webhookSpikeRetryDelaySeconds: number;
  webhookSpikeMaxDeliveryAttempts: number;
  emailSpikeRetryDelaySeconds: number;
  emailSpikeMaxDeliveryAttempts: number;
}

export interface OutboundNotificationProviderProfile {
  profileKey: string;
  displayLabel: string;
  enabled: boolean;
  rolloutState: OutboundNotificationProviderProfileRolloutState;
  rolloutPercentage: number;
  rolloutFallbackProfileKey: string | null;
  targetProbeMode: OutboundNotificationProviderProfileTargetProbeMode;
  deliveryChannel: OutboundNotificationDeliveryChannel;
  target: string;
  credentialsRef: string | null;
  incidentState?: OutboundNotificationProviderProfileIncidentState | null;
  operationalState?: OutboundNotificationProviderProfileOperationalState | null;
}

export const defaultOutboundNotificationPolicy: OutboundNotificationPolicy = {
  breachNotificationDeliverySelectionMode: "infer_from_target",
  webhookSpikeRetryDelaySeconds: 0,
  webhookSpikeMaxDeliveryAttempts: 3,
  emailSpikeRetryDelaySeconds: 0,
  emailSpikeMaxDeliveryAttempts: 3
};

export interface OutboundNotificationDeliveryRequest {
  deliveryChannel: OutboundNotificationDeliveryChannel;
  deliveryTarget: string | null;
  deliveryAttemptCount: number;
}

export interface OutboundNotificationDeliveryResult {
  outcome: "delivered" | "retryable_failure" | "terminal_failure";
  normalizedTarget: string | null;
  failureReason: string | null;
  providerReceiptId: string | null;
  providerReceiptIssuedAt: string | null;
}

interface OutboundNotificationDeliveryAdapter {
  channel: OutboundNotificationDeliveryChannel;
  deliver: (
    request: OutboundNotificationDeliveryRequest
  ) => Promise<OutboundNotificationDeliveryResult>;
}

const transientFailurePrefix = "retry-once:";
const terminalFailurePrefix = "fail-permanent:";
const activeProbeFailurePrefix = "probe-unreachable:";
const providerProfilePrefix = "profile:";
const validCredentialsRefPattern = /^vault:\/\/[A-Za-z0-9._/-]+$/;
const unreachableCredentialsRefPrefix = "vault://unreachable/";

const normalizeTarget = (target: string): string =>
  target
    .replace(transientFailurePrefix, "")
    .replace(terminalFailurePrefix, "")
    .replace(activeProbeFailurePrefix, "")
    .trim();

const hasTransientFailurePrefix = (target: string): boolean =>
  target.startsWith(transientFailurePrefix);

const hasTerminalFailurePrefix = (target: string): boolean =>
  target.startsWith(terminalFailurePrefix);

const hasActiveProbeFailurePrefix = (target: string): boolean =>
  target.startsWith(activeProbeFailurePrefix);

const createSpikeReceipt = (
  deliveryChannel: OutboundNotificationDeliveryChannel
): { providerReceiptId: string; providerReceiptIssuedAt: string } => ({
  providerReceiptId: `${deliveryChannel}-receipt-${randomUUID()}`,
  providerReceiptIssuedAt: new Date().toISOString()
});

export const resolveOutboundNotificationDeliveryChannel = (input: {
  target: string | null;
  selectionMode?: OutboundNotificationDeliverySelectionMode;
}): OutboundNotificationDeliveryChannel => {
  switch (input.selectionMode ?? "infer_from_target") {
    case "force_webhook_spike":
      return "webhook_spike";
    case "force_email_spike":
      return "email_spike";
    case "infer_from_target":
    default:
      return input.target?.includes("@") ? "email_spike" : "webhook_spike";
  }
};

export interface ResolvedOutboundNotificationDestination {
  deliveryProfileKey: string | null;
  deliveryChannel: OutboundNotificationDeliveryChannel;
  deliveryTarget: string | null;
}

const normalizeOutboundNotificationProviderProfileRolloutPercentage = (
  rolloutPercentage: number | undefined
): number => {
  if (!Number.isInteger(rolloutPercentage)) {
    return 100;
  }

  const normalizedRolloutPercentage =
    typeof rolloutPercentage === "number" ? rolloutPercentage : 100;

  return Math.max(0, Math.min(100, normalizedRolloutPercentage));
};

export const isValidOutboundNotificationCredentialsRef = (
  credentialsRef: string | null
): boolean =>
  credentialsRef === null ||
  (credentialsRef.trim().length > 0 && validCredentialsRefPattern.test(credentialsRef.trim()));

export const maskOutboundNotificationCredentialsRef = (
  credentialsRef: string | null
): string | null => {
  if (!credentialsRef) {
    return null;
  }

  const trimmed = credentialsRef.trim();
  const schemeSeparatorIndex = trimmed.indexOf("://");

  if (schemeSeparatorIndex === -1) {
    return "***";
  }

  const scheme = trimmed.slice(0, schemeSeparatorIndex + 3);
  const remainder = trimmed.slice(schemeSeparatorIndex + 3);
  const segments = remainder.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `${scheme}...`;
  }

  return `${scheme}.../${segments[segments.length - 1]}`;
};

const deriveOutboundNotificationProviderProfileCredentialsStatus = (
  profile: OutboundNotificationProviderProfile
): OutboundNotificationProviderProfileCredentialsStatus => {
  if (!profile.credentialsRef) {
    return "not_configured";
  }

  return profile.credentialsRef.startsWith(unreachableCredentialsRefPrefix)
    ? "unreachable"
    : "reachable";
};

const deriveOutboundNotificationProviderProfileHealthStatus = (
  profile: OutboundNotificationProviderProfile
): OutboundNotificationProviderProfileHealthStatus => {
  if (!profile.enabled) {
    return "disabled";
  }

  if (profile.rolloutState === "paused") {
    return "paused";
  }

  if (resolveOutboundNotificationProviderProfileCredentialsStatus(profile) === "unreachable") {
    return "credentials_unreachable";
  }

  return "ready";
};

const deriveOutboundNotificationProviderProfileProbeStatus = (
  profile: OutboundNotificationProviderProfile,
  credentialsStatus: OutboundNotificationProviderProfileCredentialsStatus
): OutboundNotificationProviderProfileProbeStatus => {
  if (!profile.enabled) {
    return "skipped_disabled";
  }

  if (profile.rolloutState === "paused") {
    return "skipped_paused";
  }

  if (credentialsStatus === "unreachable") {
    return "credentials_unreachable";
  }

  if (profile.targetProbeMode === "skip") {
    return "skipped_by_policy";
  }

  if (hasActiveProbeFailurePrefix(profile.target)) {
    return "target_unreachable";
  }

  return "succeeded";
};

const deriveOutboundNotificationProviderProfileHealthStatusFromProbe = (
  profile: OutboundNotificationProviderProfile,
  probeStatus: OutboundNotificationProviderProfileProbeStatus
): OutboundNotificationProviderProfileHealthStatus => {
  if (!profile.enabled) {
    return "disabled";
  }

  if (profile.rolloutState === "paused") {
    return "paused";
  }

  if (probeStatus === "credentials_unreachable") {
    return "credentials_unreachable";
  }

  if (probeStatus === "target_unreachable") {
    return "target_unreachable";
  }

  return "ready";
};

const deriveOutboundNotificationProviderProfileOperationalRolloutStatus = (
  profile: OutboundNotificationProviderProfile,
  healthStatus: OutboundNotificationProviderProfileHealthStatus
): OutboundNotificationProviderProfileOperationalRolloutStatus => {
  if (!profile.enabled) {
    return "disabled";
  }

  if (profile.rolloutState === "paused") {
    return "paused";
  }

  if (profile.rolloutState === "canary") {
    return healthStatus === "ready" ? "canary_ready" : "canary_blocked";
  }

  return healthStatus === "ready" ? "active_ready" : "active_blocked";
};

export const resolveOutboundNotificationProviderProfileCredentialsStatus = (
  profile: OutboundNotificationProviderProfile
): OutboundNotificationProviderProfileCredentialsStatus =>
  profile.operationalState?.credentialsStatus ??
  deriveOutboundNotificationProviderProfileCredentialsStatus(profile);

export const resolveOutboundNotificationProviderProfileHealthStatus = (
  profile: OutboundNotificationProviderProfile
): OutboundNotificationProviderProfileHealthStatus =>
  profile.operationalState?.healthStatus ??
  deriveOutboundNotificationProviderProfileHealthStatus(profile);

const createStableRolloutBucket = (profileKey: string, rolloutSubjectKey: string): number => {
  const seed = `${profileKey}:${rolloutSubjectKey}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % 100;
};

export const isOutboundNotificationProviderProfileRolloutAdmitted = (input: {
  profile: OutboundNotificationProviderProfile;
  rolloutSubjectKey?: string | null;
}): boolean => {
  if (input.profile.rolloutState !== "canary") {
    return true;
  }

  const rolloutPercentage = normalizeOutboundNotificationProviderProfileRolloutPercentage(
    input.profile.rolloutPercentage
  );

  if (rolloutPercentage >= 100) {
    return true;
  }

  if (rolloutPercentage <= 0) {
    return false;
  }

  const rolloutSubjectKey = input.rolloutSubjectKey?.trim();

  if (!rolloutSubjectKey) {
    return false;
  }

  return createStableRolloutBucket(input.profile.profileKey, rolloutSubjectKey) < rolloutPercentage;
};

export const resolveOutboundNotificationProviderProfileOperationalRolloutStatus = (
  profile: OutboundNotificationProviderProfile
): OutboundNotificationProviderProfileOperationalRolloutStatus =>
  profile.operationalState?.rolloutStatus ??
  deriveOutboundNotificationProviderProfileOperationalRolloutStatus(
    profile,
    deriveOutboundNotificationProviderProfileHealthStatus(profile)
  );

export const refreshOutboundNotificationProviderProfileOperationalState = (input: {
  profile: OutboundNotificationProviderProfile;
  checkedAt?: string;
  checkedByActorType?: "worker" | "notification_service" | "platform_api";
  checkedByActorId?: string;
}): OutboundNotificationProviderProfile => {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const checkedByActorType = input.checkedByActorType ?? "worker";
  const checkedByActorId = input.checkedByActorId ?? "profile-health-worker";
  const credentialsStatus = deriveOutboundNotificationProviderProfileCredentialsStatus(input.profile);
  const probeStatus = deriveOutboundNotificationProviderProfileProbeStatus(
    input.profile,
    credentialsStatus
  );
  const healthStatus = deriveOutboundNotificationProviderProfileHealthStatusFromProbe(
    input.profile,
    probeStatus
  );
  const rolloutStatus = deriveOutboundNotificationProviderProfileOperationalRolloutStatus(
    input.profile,
    healthStatus
  );
  const lastCheckError = probeStatus === "credentials_unreachable"
    ? "Credential reference reachability probe failed."
    : probeStatus === "target_unreachable"
      ? "Active target probe failed."
      : null;
  const probeTarget = probeStatus === "skipped_disabled" ||
    probeStatus === "skipped_paused" ||
    probeStatus === "skipped_by_policy"
    ? null
    : normalizeTarget(input.profile.target);
  const probeLatencyMs = probeStatus === "succeeded"
    ? (input.profile.deliveryChannel === "email_spike" ? 45 : 25)
    : probeStatus === "target_unreachable"
      ? 250
      : null;

  return {
    ...input.profile,
    operationalState: {
      lastCheckedAt: checkedAt,
      lastCheckedByActorType: checkedByActorType,
      lastCheckedByActorId: checkedByActorId,
      credentialsStatus,
      healthStatus,
      rolloutStatus,
      probeStatus,
      probeTarget,
      probeLatencyMs,
      lastCheckError
    }
  };
};

export const haveSameOutboundNotificationProviderProfileConfiguration = (
  left: OutboundNotificationProviderProfile,
  right: OutboundNotificationProviderProfile
): boolean =>
  left.profileKey === right.profileKey &&
  left.displayLabel === right.displayLabel &&
  left.enabled === right.enabled &&
  left.rolloutState === right.rolloutState &&
  left.rolloutPercentage === right.rolloutPercentage &&
  left.rolloutFallbackProfileKey === right.rolloutFallbackProfileKey &&
  left.targetProbeMode === right.targetProbeMode &&
  left.deliveryChannel === right.deliveryChannel &&
  left.target === right.target &&
  left.credentialsRef === right.credentialsRef;

export const isOutboundNotificationProviderProfileDeliverable = (
  profile: OutboundNotificationProviderProfile,
  rolloutSubjectKey?: string | null
): boolean =>
  resolveOutboundNotificationProviderProfileHealthStatus(profile) === "ready" &&
  isOutboundNotificationProviderProfileRolloutAdmitted({
    profile,
    rolloutSubjectKey
  });

export const isOutboundNotificationProviderProfilePromotionSuppressed = (
  profile: OutboundNotificationProviderProfile,
  evaluatedAt: string = new Date().toISOString()
): boolean => {
  const incidentState = profile.incidentState;

  if (!incidentState || incidentState.resolvedAt !== null || incidentState.suppressionUntil === null) {
    return false;
  }

  return incidentState.suppressionUntil > evaluatedAt;
};

export const resolveOutboundNotificationDestination = (input: {
  target: string | null;
  selectionMode?: OutboundNotificationDeliverySelectionMode;
  providerProfiles?: OutboundNotificationProviderProfile[];
  rolloutSubjectKey?: string | null;
}): ResolvedOutboundNotificationDestination => {
  const rawTarget = input.target?.trim() ?? "";
  const providerProfiles = input.providerProfiles ?? [];
  const providerProfilesByKey = new Map(
    providerProfiles.map(profile => [profile.profileKey, profile])
  );

  const resolveProviderProfileDestination = (
    profileKey: string,
    visitedProfileKeys: Set<string>
  ): ResolvedOutboundNotificationDestination => {
    if (visitedProfileKeys.has(profileKey)) {
      return {
        deliveryProfileKey: profileKey || null,
        deliveryChannel: resolveOutboundNotificationDeliveryChannel({
          target: null,
          selectionMode: input.selectionMode
        }),
        deliveryTarget: null
      };
    }

    visitedProfileKeys.add(profileKey);

    const profile = providerProfilesByKey.get(profileKey);

    if (!profile) {
      return {
        deliveryProfileKey: profileKey || null,
        deliveryChannel: resolveOutboundNotificationDeliveryChannel({
          target: null,
          selectionMode: input.selectionMode
        }),
        deliveryTarget: null
      };
    }

    const healthStatus = resolveOutboundNotificationProviderProfileHealthStatus(profile);
    const rolloutAdmitted = isOutboundNotificationProviderProfileRolloutAdmitted({
      profile,
      rolloutSubjectKey: input.rolloutSubjectKey
    });

    if (
      healthStatus === "ready" &&
      !rolloutAdmitted &&
      profile.rolloutFallbackProfileKey
    ) {
      return resolveProviderProfileDestination(
        profile.rolloutFallbackProfileKey,
        visitedProfileKeys
      );
    }

    return {
      deliveryProfileKey: profile.profileKey,
      deliveryChannel: profile.deliveryChannel,
      deliveryTarget:
        healthStatus === "ready" && rolloutAdmitted
          ? profile.target
          : null
    };
  };

  if (rawTarget.startsWith(providerProfilePrefix)) {
    const profileKey = rawTarget.slice(providerProfilePrefix.length).trim();
    return resolveProviderProfileDestination(profileKey, new Set<string>());
  }

  return {
    deliveryProfileKey: null,
    deliveryChannel: resolveOutboundNotificationDeliveryChannel({
      target: rawTarget || null,
      selectionMode: input.selectionMode
    }),
    deliveryTarget: rawTarget || null
  };
};

export const resolveOutboundNotificationRetryDelaySeconds = (input: {
  notificationPolicy?: OutboundNotificationPolicy;
  deliveryChannel: OutboundNotificationDeliveryChannel;
}): number => {
  const policy = input.notificationPolicy;

  if (!policy) {
    return 0;
  }

  return input.deliveryChannel === "email_spike"
    ? policy.emailSpikeRetryDelaySeconds
    : policy.webhookSpikeRetryDelaySeconds;
};

export const resolveOutboundNotificationMaxAttempts = (input: {
  notificationPolicy?: OutboundNotificationPolicy;
  deliveryChannel: OutboundNotificationDeliveryChannel;
}): number => {
  const policy = input.notificationPolicy;

  if (!policy) {
    return 3;
  }

  return input.deliveryChannel === "email_spike"
    ? policy.emailSpikeMaxDeliveryAttempts
    : policy.webhookSpikeMaxDeliveryAttempts;
};

const webhookSpikeAdapter: OutboundNotificationDeliveryAdapter = {
  channel: "webhook_spike",
  deliver: async request => {
    const rawTarget = request.deliveryTarget?.trim() ?? "";
    const normalizedTarget = normalizeTarget(rawTarget);

    if (!normalizedTarget) {
      return {
        outcome: "terminal_failure",
        normalizedTarget: null,
        failureReason: "Webhook delivery requires a non-empty target.",
        providerReceiptId: null,
        providerReceiptIssuedAt: null
      };
    }

    const receipt = createSpikeReceipt("webhook_spike");

    if (hasTerminalFailurePrefix(rawTarget)) {
      return {
        outcome: "terminal_failure",
        normalizedTarget,
        failureReason: `Webhook delivery to '${normalizedTarget}' failed permanently in spike mode.`,
        ...receipt
      };
    }

    if (hasTransientFailurePrefix(rawTarget) && request.deliveryAttemptCount === 0) {
      return {
        outcome: "retryable_failure",
        normalizedTarget,
        failureReason: `Webhook delivery to '${normalizedTarget}' failed transiently in spike mode.`,
        ...receipt
      };
    }

    return {
      outcome: "delivered",
      normalizedTarget,
      failureReason: null,
      ...receipt
    };
  }
};

const emailSpikeAdapter: OutboundNotificationDeliveryAdapter = {
  channel: "email_spike",
  deliver: async request => {
    const rawTarget = request.deliveryTarget?.trim() ?? "";
    const normalizedTarget = normalizeTarget(rawTarget);

    if (!normalizedTarget) {
      return {
        outcome: "terminal_failure",
        normalizedTarget: null,
        failureReason: "Email delivery requires a non-empty target.",
        providerReceiptId: null,
        providerReceiptIssuedAt: null
      };
    }

    if (!normalizedTarget.includes("@")) {
      return {
        outcome: "terminal_failure",
        normalizedTarget,
        failureReason: `Email delivery target '${normalizedTarget}' is not a valid spike address.`,
        providerReceiptId: null,
        providerReceiptIssuedAt: null
      };
    }

    const receipt = createSpikeReceipt("email_spike");

    if (hasTerminalFailurePrefix(rawTarget)) {
      return {
        outcome: "terminal_failure",
        normalizedTarget,
        failureReason: `Email delivery to '${normalizedTarget}' failed permanently in spike mode.`,
        ...receipt
      };
    }

    if (hasTransientFailurePrefix(rawTarget) && request.deliveryAttemptCount === 0) {
      return {
        outcome: "retryable_failure",
        normalizedTarget,
        failureReason: `Email delivery to '${normalizedTarget}' failed transiently in spike mode.`,
        ...receipt
      };
    }

    return {
      outcome: "delivered",
      normalizedTarget,
      failureReason: null,
      ...receipt
    };
  }
};

const outboundNotificationDeliveryAdapters = new Map<
  OutboundNotificationDeliveryChannel,
  OutboundNotificationDeliveryAdapter
>([
  [webhookSpikeAdapter.channel, webhookSpikeAdapter],
  [emailSpikeAdapter.channel, emailSpikeAdapter]
]);

export const deliverSpikeOutboundNotification = async (
  request: OutboundNotificationDeliveryRequest
): Promise<OutboundNotificationDeliveryResult> => {
  const adapter = outboundNotificationDeliveryAdapters.get(request.deliveryChannel);

  if (!adapter) {
    return {
      outcome: "terminal_failure",
      normalizedTarget: request.deliveryTarget,
      failureReason: `No delivery adapter is registered for channel '${request.deliveryChannel}'.`,
      providerReceiptId: null,
      providerReceiptIssuedAt: null
    };
  }

  return adapter.deliver(request);
};
