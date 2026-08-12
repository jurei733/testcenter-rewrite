import { Injectable, inject } from "@angular/core";

import type {
  ApplicationAssetSummary,
  AdminSignInResponse,
  AdminSignOutResponse,
  BootstrapAdminUserResponse,
  GetAdminCurrentSessionResponse,
  ListAdminSessionsResponse,
  ListAdminAuditEventsResponse,
  ListAdminUsersResponse,
  ListWorkspacesResponse,
  RevokeAdminSessionsResponse,
  GetRuntimeConfigResponse,
  GetRuntimeDiagnosticsResponse
} from "@testcenter-rewrite-app/contracts";
import {
  adminPasswordPolicy,
  originalMonitorCustomTextDefaults,
  originalMonitorCustomTextKeys,
  originalParticipantCustomTextDefaults,
  originalParticipantCustomTextKeys
} from "@testcenter-rewrite-app/contracts";
import {
  adminAuditEventTypes,
  applicationAssetSlotNames,
  applicationThemeNames,
  defaultApplicationSettings,
  type AdminRole,
  type AdminRoleAccessMode,
  type AdminSessionStatus,
  type AdminUserStatus,
  type ApplicationAssetSlotName,
  type ApplicationSettings,
  type MonitorViewProfile,
  type MonitorViewProfileFilter
} from "@testcenter-rewrite-app/domain";

import type { RecordCollectionItem } from "./record-collection.component";
import type { SummaryCard } from "./rewrite-app-shell.types";
import { buildParticipantEntryUrl } from "./participant-session-links";
import { ApplicationSettingsService } from "./application-settings.service";
import { ApplicationAssetAdminService } from "./application-asset-admin.service";
import { ConfirmationDialogService } from "./confirmation-dialog.service";
import {
  parseJsonDocument,
  readNumberValue,
  readStringValue
} from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import {
  RewriteAppOpsService,
  type AdminUserDeletionBatchResult,
  type AdminUserPasswordBatchCredential,
  type AdminUserPasswordBatchResult,
  type AdminUserRoleBatchResult,
  type AdminUserStatusBatchResult
} from "./rewrite-app-ops.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";

type RuntimeMetricsPayload = {
  runtime: {
    startedAt: string;
    uptimeSeconds: number;
    lifecycle: {
      phase: "running" | "draining";
      shutdownRequestedAt: string | null;
    };
    activeRequests: number;
    totalRequests: number;
    completedRequests: number;
  };
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  storage: {
    kind: string;
    schemaVersion: number | null;
  };
  requestCountsByMethod: Record<string, number>;
  requestCountsByRoute: Record<string, number>;
  responseCountsByStatusCode: Record<string, number>;
  requestLatencyByRoute: Record<
    string,
    {
      count: number;
      totalMs: number;
      maxMs: number;
      bucketCounts: Record<string, number>;
    }
  >;
  errorCounts: Record<string, number>;
};

type RuntimeHealthPayload = {
  manifest?: {
    capabilities?: string[];
    routes?: Record<string, unknown>;
  };
};

type AdminSessionViewPayload = Partial<
  BootstrapAdminUserResponse &
    AdminSignInResponse &
    GetAdminCurrentSessionResponse &
    AdminSignOutResponse
>;

const localDemoAccess = {
  adminUsername: "demo-admin",
  adminDisplayName: "Demo Platform Admin",
  adminPassword: "demo-admin-password",
  tenantKey: "demo-tenant",
  workspaceKey: "demo-workspace",
  participantLoginKey: "student-demo",
  participantPath: buildParticipantEntryUrl(
    {
      tenantKey: "demo-tenant",
      workspaceKey: "demo-workspace",
      loginKey: "student-demo",
      groupKey: "group:student-demo",
      bookletKey: "booklet:demo"
    },
    { includeOrigin: false }
  )
} as const;

const generatedPasswordAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const generateAdminPassword = (): string => {
  const randomBytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(randomBytes);
  return `A7-a${Array.from(
    randomBytes,
    value => generatedPasswordAlphabet[value & 63]
  ).join("")}`;
};

@Injectable({ providedIn: "root" })
export class OpsViewFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly opsService = inject(RewriteAppOpsService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);
  private readonly confirmation = inject(ConfirmationDialogService);
  readonly applicationSettings = inject(ApplicationSettingsService);
  readonly applicationAssets = inject(ApplicationAssetAdminService);

  readonly ops = this.uiState.ops;
  readonly workspace = this.uiState.workspace;
  private readonly allAdminRoleOptions: AdminRole[] = [
    "system_check",
    "group_monitor",
    "study_monitor",
    "workspace_admin",
    "tenant_admin",
    "platform_admin"
  ];
  readonly adminRoleAccessModeOptions: Array<{
    value: AdminRoleAccessMode;
    label: string;
  }> = [
    { value: "read_write", label: "Read and write (RW)" },
    { value: "read_only", label: "Read only (RO)" }
  ];
  readonly adminStatusOptions: AdminUserStatus[] = ["active", "disabled"];
  readonly adminAccessStatusOptions = ["available", "scheduled", "expired"];
  readonly adminSessionStatusOptions: AdminSessionStatus[] = [
    "active",
    "expired",
    "revoked"
  ];
  readonly adminAuditEventTypeOptions = adminAuditEventTypes;
  readonly monitorProfileViewOptions = ["full", "medium", "small"];
  readonly monitorProfileColumnOptions = ["show", "hide"];
  readonly monitorProfileFilterTargetOptions = [
    "groupName",
    "personLabel",
    "mode",
    "bookletId",
    "bookletLabel",
    "bookletSpecies",
    "unitId",
    "unitLabel",
    "blockId",
    "blockLabel",
    "state",
    "testState",
    "bookletStates"
  ];
  readonly monitorProfileFilterTypeOptions = ["equal", "substring", "regex"];
  readonly monitorProfileSuperStateOptions = [
    "pending",
    "locked",
    "error",
    "controller_terminated",
    "connection_lost",
    "paused",
    "focus_lost",
    "idle",
    "connection_websocket",
    "connection_polling",
    "ok"
  ];

  monitorProfileEditorTarget: "create" | "role" = "create";
  monitorProfileDraftSelectedId = "";
  monitorProfileDraftId = "";
  monitorProfileDraftLabel = "";
  monitorProfileDraftView = "medium";
  monitorProfileDraftBlockColumn = "show";
  monitorProfileDraftUnitColumn = "show";
  monitorProfileDraftGroupColumn = "hide";
  monitorProfileDraftBookletColumn = "show";
  monitorProfileDraftBookletStatesColumns = "";
  monitorProfileDraftAutoselectNextBlock: "yes" | "no" = "yes";
  monitorProfileDraftPending = "no";
  monitorProfileDraftLocked = "no";
  monitorProfileDraftFilters: MonitorViewProfileFilter[] = [];
  monitorFilterDraftTarget = "groupName";
  monitorFilterDraftType = "equal";
  monitorFilterDraftValue = "";
  monitorFilterDraftStates: string[] = [];
  monitorFilterDraftSubValue = "";
  monitorFilterDraftLabel = "";
  monitorFilterDraftNot = false;
  private readonly adminUserBatchSelection = new Set<string>();
  adminUserStatusBatchResult: AdminUserStatusBatchResult | null = null;
  adminUserRoleBatchResult: AdminUserRoleBatchResult | null = null;
  adminUserPasswordBatchResult: AdminUserPasswordBatchResult | null = null;
  adminUserDeletionBatchResult: AdminUserDeletionBatchResult | null = null;
  platformRoleConfirmationPassword = "";
  adminResetPasswordConfirmation = "";
  adminDisplayNameTargetUserId = "";
  adminDisplayNameUpdateDraft = "";
  adminAccessWindowTargetUserId = "";
  adminAccessWindowValidFromDraft = "";
  adminAccessWindowValidToDraft = "";
  adminAccessWindowValidForMinutesDraft = "";
  adminCustomTextsTargetUserId = "";
  adminCustomTextsUpdateDraft = "{}";
  private workspaceAdminMatrixTenantKey = "";
  private workspaceAdminMatrixWorkspaceKey = "";
  private adminWorkspaceMatrixTenantKey = "";
  private adminWorkspaceMatrixUserId = "";
  private readonly adminSessionBatchSelection = new Set<string>();
  adminSessionBatchResult: RevokeAdminSessionsResponse | null = null;
  applicationTitleDraft = "IQB-Testcenter";
  applicationLogoDraft = defaultApplicationSettings.mainLogo;
  applicationLogoDraftError = "";
  applicationThemeDraft: ApplicationSettings["themeName"] =
    defaultApplicationSettings.themeName;
  applicationIntroHtmlDraft = defaultApplicationSettings.introHtml;
  applicationLegalNoticeHtmlDraft =
    defaultApplicationSettings.legalNoticeHtml;
  readonly applicationThemeOptions = applicationThemeNames;
  applicationCustomTextDrafts: Record<string, string> = {};
  applicationCustomTextNewKey = "";
  applicationCustomTextNewValue = "";
  applicationWarningTextDraft = "";
  applicationWarningExpiresAtDraft = "";
  applicationAssetAssignmentsDraft: Partial<
    Record<ApplicationAssetSlotName, string>
  > = {};
  applicationAssetUploadError = "";
  readonly applicationAssetSlotOptions: ReadonlyArray<{
    name: ApplicationAssetSlotName;
    label: string;
  }> = applicationAssetSlotNames.map(name => ({
    name,
    label: ({
      logo: "Logo",
      loginIllustration: "Login illustration",
      codeInputIllustration: "Code-input illustration",
      codeInputCompanion: "Code-input companion",
      starterCompanion: "Starter companion",
      starterCardDone: "Completed booklet card",
      loadingProgress: "Loading progress",
      confirmDialog: "Confirmation dialog"
    } satisfies Record<ApplicationAssetSlotName, string>)[name]
  }));

  init(): void {
    this.viewState.setActiveView("ops");
    this.viewState.onActionAsync(() => this.loadApplicationSettingsDraft());
    if (this.ops.adminSessionToken.trim()) {
      this.viewState.onActionAsync(() => this.opsService.refreshAdminSession());
    }
  }

  get isMonitorOnlySession(): boolean {
    return this.operatorAccess.isMonitorOnly;
  }

  get canUseAdminManagement(): boolean {
    return this.operatorAccess.mode === "admin";
  }

  get canBootstrapAdmin(): boolean {
    return this.operatorAccess.mode === "signed_out";
  }

  get canManageApplicationSettings(): boolean {
    return (
      this.canUseAdminSession &&
      this.operatorAccess.roleAssignments.some(
        roleAssignment => roleAssignment.role === "platform_admin"
      )
    );
  }

  get isApplicationWarningExpirationValid(): boolean {
    const value = this.applicationWarningExpiresAtDraft.trim();
    return value === "" || Number.isFinite(Date.parse(value));
  }

  get canSaveApplicationSettings(): boolean {
    return (
      this.canManageApplicationSettings &&
      this.applicationTitleDraft.trim().length <= 120 &&
      this.applicationLogoDraft.length <= 28_000_000 &&
      !this.applicationLogoDraftError &&
      this.applicationContentHtmlValid &&
      this.applicationCustomTextsValid &&
      this.applicationWarningTextDraft.trim().length <= 4_000 &&
      this.isApplicationWarningExpirationValid
    );
  }

  get applicationContentHtmlValid(): boolean {
    const encoder = new TextEncoder();
    return (
      encoder.encode(this.applicationIntroHtmlDraft.trim()).length <= 100_000 &&
      encoder.encode(this.applicationLegalNoticeHtmlDraft.trim()).length <=
        100_000
    );
  }

  get applicationCustomTextKeys(): string[] {
    return [...new Set([
      ...originalParticipantCustomTextKeys,
      ...originalMonitorCustomTextKeys,
      ...Object.keys(this.applicationCustomTextDrafts)
    ])].sort((left, right) => left.localeCompare(right));
  }

  applicationCustomTextDefault(key: string): string {
    return (
      originalParticipantCustomTextDefaults[
        key as keyof typeof originalParticipantCustomTextDefaults
      ] ??
      originalMonitorCustomTextDefaults[
        key as keyof typeof originalMonitorCustomTextDefaults
      ] ??
      ""
    );
  }

  get applicationCustomTextsValid(): boolean {
    const entries = Object.entries(this.normalizedApplicationCustomTexts());
    if (entries.length > 250) {
      return false;
    }
    let totalBytes = 0;
    for (const [key, value] of entries) {
      const valueBytes = new TextEncoder().encode(value).length;
      totalBytes += new TextEncoder().encode(key).length + valueBytes;
      if (
        !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ||
        key.length > 120 ||
        valueBytes > 10_000 ||
        totalBytes > 250_000
      ) {
        return false;
      }
    }
    return true;
  }

  get canAddApplicationCustomText(): boolean {
    const key = this.applicationCustomTextNewKey.trim();
    return (
      /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) &&
      key.length <= 120 &&
      Boolean(this.applicationCustomTextNewValue.trim())
    );
  }

  get applicationSettingsStatus(): string {
    const settings = this.applicationSettings.settings();
    if (this.applicationSettings.lastError()) {
      return this.applicationSettings.lastError()!;
    }
    return settings.updatedAt
      ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}.`
      : "Original defaults are active; no persisted override exists.";
  }

  get adminRoleOptions(): AdminRole[] {
    if (
      this.operatorAccess.mode === "signed_out" ||
      this.operatorAccess.roleAssignments.some(
        roleAssignment => roleAssignment.role === "platform_admin"
      )
    ) {
      return this.allAdminRoleOptions;
    }
    if (
      this.operatorAccess.roleAssignments.some(
        roleAssignment => roleAssignment.role === "tenant_admin"
      )
    ) {
      return this.allAdminRoleOptions.filter(role => role !== "platform_admin");
    }
    if (
      this.operatorAccess.roleAssignments.some(
        roleAssignment =>
          roleAssignment.role === "workspace_admin" &&
          roleAssignment.accessMode === "read_write"
      )
    ) {
      return ["system_check", "group_monitor", "study_monitor"];
    }
    return [];
  }

  get operatorAccessLabel(): string {
    return this.operatorAccess.label;
  }

  get currentAdminUserId(): string {
    const payload = parseJsonDocument<AdminSessionViewPayload>(
      this.ops.adminSessionView
    );
    return payload?.adminUser?.adminUserId ?? "";
  }

  get currentAdminSessionId(): string {
    const payload = parseJsonDocument<AdminSessionViewPayload>(
      this.ops.adminSessionView
    );
    return payload?.adminSession?.adminSessionId ?? "";
  }

  get canUseAdminCredentials(): boolean {
    return (
      this.ops.adminUsername.trim() !== "" &&
      this.ops.adminPassword !== ""
    );
  }

  get canUseAdminSession(): boolean {
    return this.ops.adminSessionToken.trim() !== "";
  }

  get canCreateAdminUser(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminRoleOptions.includes(this.ops.adminCreateRole) &&
      this.ops.adminCreateUsername.trim() !== "" &&
      this.isAdminPasswordValid(this.ops.adminCreatePassword) &&
      (this.ops.adminCreateRole !== "platform_admin" ||
        this.hasPlatformRoleConfirmation) &&
      this.isAdminCreateCustomTextsValid &&
      this.isAdminCreateAccessWindowValid &&
      this.isScopedAdminRoleInputComplete(
        this.ops.adminCreateRole,
        this.ops.adminCreateTenantKey,
        this.ops.adminCreateWorkspaceKey,
        this.ops.adminCreateGroupKey
      )
    );
  }

  get isAdminCreateAccessWindowValid(): boolean {
    return this.isAdminAccessWindowValid(
      this.ops.adminCreateValidFrom,
      this.ops.adminCreateValidTo,
      this.ops.adminCreateValidForMinutes
    );
  }

  private isAdminAccessWindowValid(
    validFromInput: unknown,
    validToInput: unknown,
    validForMinutesInput: unknown
  ): boolean {
    const validFrom = String(validFromInput ?? "").trim();
    const validTo = String(validToInput ?? "").trim();
    const validForMinutes = String(validForMinutesInput ?? "").trim();
    const parsedValidFrom = validFrom === "" ? null : Date.parse(validFrom);
    const parsedValidTo = validTo === "" ? null : Date.parse(validTo);

    if (
      (parsedValidFrom !== null && !Number.isFinite(parsedValidFrom)) ||
      (parsedValidTo !== null && !Number.isFinite(parsedValidTo)) ||
      (parsedValidFrom !== null &&
        parsedValidTo !== null &&
        parsedValidFrom > parsedValidTo)
    ) {
      return false;
    }

    if (validForMinutes === "") {
      return true;
    }
    const parsedValidForMinutes = Number(validForMinutes);
    return (
      Number.isInteger(parsedValidForMinutes) &&
      parsedValidForMinutes >= 1 &&
      parsedValidForMinutes <= 5_256_000
    );
  }

  get isCreatingMonitorAccount(): boolean {
    return (
      this.ops.adminCreateRole === "study_monitor" ||
      this.ops.adminCreateRole === "group_monitor"
    );
  }

  get adminCreateMonitorProfileCount(): number {
    const profiles = parseJsonDocument<unknown[]>(
      this.ops.adminCreateMonitorProfilesJson
    );
    return Array.isArray(profiles) ? profiles.length : 0;
  }

  get adminCreateCustomTextCount(): number {
    return Object.keys(
      this.normalizeAdminCustomTextsDraft(
        this.ops.adminCreateCustomTextsJson
      ) ?? {}
    ).length;
  }

  get isAdminCreateCustomTextsValid(): boolean {
    return (
      this.normalizeAdminCustomTextsDraft(
        this.ops.adminCreateCustomTextsJson
      ) !== null
    );
  }

  private normalizeAdminCustomTextsDraft(
    draft: string
  ): Record<string, string> | null {
    const parsed = parseJsonDocument<Record<string, unknown>>(draft);
    if (!parsed || Array.isArray(parsed)) {
      return null;
    }
    const entries = Object.entries(parsed);
    if (entries.length > 250) {
      return null;
    }
    const encoder = new TextEncoder();
    const normalized: Record<string, string> = {};
    let totalBytes = 0;
    for (const [rawKey, rawValue] of entries) {
      const key = rawKey.trim();
      if (
        !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ||
        key.length > 120 ||
        typeof rawValue !== "string"
      ) {
        return null;
      }
      const text = rawValue.trim();
      if (!text) {
        continue;
      }
      const valueBytes = encoder.encode(text).byteLength;
      totalBytes += encoder.encode(key).byteLength + valueBytes;
      if (valueBytes > 10_000 || totalBytes > 250_000) {
        return null;
      }
      normalized[key] = text;
    }
    return normalized;
  }

  get isAssigningMonitorRole(): boolean {
    return (
      this.ops.adminRoleRole === "study_monitor" ||
      this.ops.adminRoleRole === "group_monitor"
    );
  }

  get isRevokingPlatformAdminRole(): boolean {
    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    return Boolean(
      payload?.items.some(item =>
        item.adminUser.adminUserId ===
          this.ops.adminRevokeTargetUserId.trim() &&
        item.roleAssignments.some(
          roleAssignment =>
            roleAssignment.roleAssignmentId ===
              this.ops.adminRevokeRoleAssignmentId.trim() &&
            roleAssignment.role === "platform_admin"
        )
      )
    );
  }

  get requiresPlatformRoleConfirmation(): boolean {
    return (
      this.ops.adminCreateRole === "platform_admin" ||
      this.ops.adminRoleRole === "platform_admin" ||
      this.isRevokingPlatformAdminRole
    );
  }

  get hasPlatformRoleConfirmation(): boolean {
    return this.platformRoleConfirmationPassword !== "";
  }

  get monitorProfileEditorProfiles(): MonitorViewProfile[] {
    const profiles = parseJsonDocument<MonitorViewProfile[]>(
      this.monitorProfileEditorTarget === "create"
        ? this.ops.adminCreateMonitorProfilesJson
        : this.ops.adminRoleMonitorProfilesJson
    );
    return Array.isArray(profiles) ? profiles : [];
  }

  get monitorProfileEditorItems(): RecordCollectionItem[] {
    return this.monitorProfileEditorProfiles.map(profile => ({
      headline: profile.label || profile.profileId,
      subline: profile.profileId,
      badges: [
        `${profile.settings.view} view`,
        `${profile.filters.length} filter(s)`,
        profile.settings.autoselectNextBlock === "yes" ? "auto-next" : "manual-next"
      ],
      rows: [
        {
          label: "Columns",
          value: `block ${profile.settings.blockColumn}; unit ${profile.settings.unitColumn}; group ${profile.settings.groupColumn}; booklet ${profile.settings.bookletColumn}`
        },
        {
          label: "Booklet States",
          value: profile.settings.bookletStatesColumns || "none"
        },
        {
          label: "Built-in Filters",
          value: `pending ${profile.filtersEnabled.pending}; locked ${profile.filtersEnabled.locked}`
        }
      ],
      selected: profile.profileId === this.monitorProfileDraftSelectedId,
      actionLabel: "Edit Profile",
      actionPayload: {
        monitorProfileAction: "edit",
        profileId: profile.profileId
      },
      actions: [
        {
          label: "Delete Profile",
          payload: {
            monitorProfileAction: "delete",
            profileId: profile.profileId
          }
        }
      ]
    }));
  }

  get monitorProfileDraftFilterItems(): RecordCollectionItem[] {
    return this.monitorProfileDraftFilters.map((filter, index) => {
      const value = Array.isArray(filter.value)
        ? filter.value.join(", ")
        : filter.value;
      return {
        headline: filter.label || filter.target,
        subline: `${filter.not ? "not " : ""}${filter.type} ${filter.subValue || value}`,
        badges: [filter.target, filter.type],
        rows: [
          { label: "Value", value: value || "empty" },
          { label: "Sub-value", value: filter.subValue || "none" }
        ],
        actionLabel: "Remove Filter",
        actionPayload: { filterIndex: String(index) }
      };
    });
  }

  get canSaveMonitorProfile(): boolean {
    const profileId = this.monitorProfileDraftId.trim();
    return (
      profileId.length > 0 &&
      profileId.length <= 128 &&
      (this.monitorProfileDraftSelectedId !== "" ||
        this.monitorProfileEditorProfiles.length < 20)
    );
  }

  get canAddMonitorProfileFilter(): boolean {
    return (
      this.monitorFilterDraftTarget.trim() !== "" &&
      (this.monitorFilterDraftTarget === "state"
        ? this.monitorFilterDraftStates.length > 0
        : this.monitorFilterDraftValue.trim() !== "") &&
      this.monitorProfileDraftFilters.length < 50
    );
  }

  get isCreatingSystemCheckAccount(): boolean {
    return this.ops.adminCreateRole === "system_check";
  }

  get isCreatingOperationalAccount(): boolean {
    return this.isCreatingMonitorAccount || this.isCreatingSystemCheckAccount;
  }

  get canRevokeAdminSession(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.ops.adminSessionRevokeTargetId.trim() !== ""
    );
  }

  get canAssignAdminRole(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminRoleOptions.includes(this.ops.adminRoleRole) &&
      (this.ops.adminRoleRole !== "platform_admin" ||
        this.hasPlatformRoleConfirmation) &&
      this.ops.adminRoleTargetUserId.trim() !== "" &&
      this.isScopedAdminRoleInputComplete(
        this.ops.adminRoleRole,
        this.ops.adminRoleTenantKey,
        this.ops.adminRoleWorkspaceKey,
        this.ops.adminRoleGroupKey
      )
    );
  }

  get canRevokeAdminRole(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.ops.adminRevokeTargetUserId.trim() !== "" &&
      this.ops.adminRevokeRoleAssignmentId.trim() !== "" &&
      (!this.isRevokingPlatformAdminRole || this.hasPlatformRoleConfirmation)
    );
  }

  get canResetAdminUserPassword(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.ops.adminResetTargetUserId.trim() !== "" &&
      this.isAdminPasswordValid(this.ops.adminResetPassword) &&
      this.ops.adminResetPassword === this.adminResetPasswordConfirmation
    );
  }

  get hasAdminResetPasswordMismatch(): boolean {
    return (
      this.adminResetPasswordConfirmation !== "" &&
      this.ops.adminResetPassword !== this.adminResetPasswordConfirmation
    );
  }

  get adminPasswordMinimumLength(): number {
    return adminPasswordPolicy.minimumLength;
  }

  get adminPasswordMaximumLength(): number {
    return adminPasswordPolicy.maximumLength;
  }

  get canUpdateAdminUserStatus(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.ops.adminStatusTargetUserId.trim() !== "" &&
      this.adminStatusOptions.includes(this.ops.adminStatusValue)
    );
  }

  get canUpdateAdminUserDisplayName(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminDisplayNameTargetUserId.trim() !== "" &&
      this.adminDisplayNameUpdateDraft.trim() !== ""
    );
  }

  get isAdminAccessWindowUpdateValid(): boolean {
    return this.isAdminAccessWindowValid(
      this.adminAccessWindowValidFromDraft,
      this.adminAccessWindowValidToDraft,
      this.adminAccessWindowValidForMinutesDraft
    );
  }

  get canUpdateAdminUserAccessWindow(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminAccessWindowTargetUserId.trim() !== "" &&
      this.isAdminAccessWindowUpdateValid
    );
  }

  get normalizedAdminCustomTextsUpdate(): Record<string, string> | null {
    return this.normalizeAdminCustomTextsDraft(
      this.adminCustomTextsUpdateDraft
    );
  }

  get adminCustomTextsUpdateCount(): number {
    return Object.keys(this.normalizedAdminCustomTextsUpdate ?? {}).length;
  }

  get canUpdateAdminUserCustomTexts(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminCustomTextsTargetUserId.trim() !== "" &&
      this.normalizedAdminCustomTextsUpdate !== null
    );
  }

  private isAdminPasswordValid(password: string): boolean {
    return (
      password.length >= adminPasswordPolicy.minimumLength &&
      password.length <= adminPasswordPolicy.maximumLength
    );
  }

  get adminUserBatchCount(): number {
    return this.adminUserBatchSelection.size;
  }

  get canUpdateAdminUserBatchStatus(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminUserBatchCount > 0 &&
      this.adminStatusOptions.includes(this.ops.adminStatusValue)
    );
  }

  get canAssignAdminUserBatchRole(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminUserBatchCount > 0 &&
      this.adminRoleOptions.includes(this.ops.adminRoleRole) &&
      (this.ops.adminRoleRole !== "platform_admin" ||
        this.hasPlatformRoleConfirmation) &&
      this.isScopedAdminRoleInputComplete(
        this.ops.adminRoleRole,
        this.ops.adminRoleTenantKey,
        this.ops.adminRoleWorkspaceKey,
        this.ops.adminRoleGroupKey
      )
    );
  }

  get canResetAdminUserBatchPasswords(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminUserBatchCount > 0
    );
  }

  get canDeleteAdminUserBatch(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminUserBatchCount > 0
    );
  }

  get canDownloadAdminUserBatchPasswords(): boolean {
    return Boolean(this.adminUserPasswordBatchResult?.credentials.length);
  }

  get adminSessionBatchCount(): number {
    return this.adminSessionBatchSelection.size;
  }

  get canRevokeAdminSessionBatch(): boolean {
    return (
      this.canUseAdminManagement &&
      this.canUseAdminSession &&
      this.adminSessionBatchCount > 0
    );
  }

  refreshDiagnostics(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshOperationalDiagnostics());
  }

  refreshMetrics(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshMetricsOnly());
  }

  refreshApplicationSettings(): void {
    this.viewState.onActionAsync(() => this.loadApplicationSettingsDraft(true));
  }

  saveApplicationSettings(): void {
    if (!this.canSaveApplicationSettings) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      const expirationInput = this.applicationWarningExpiresAtDraft.trim();
      const settings = await this.applicationSettings.update(
        this.ops.adminSessionToken.trim(),
        {
          appTitle: this.applicationTitleDraft,
          mainLogo: this.applicationLogoDraft,
          themeName: this.applicationThemeDraft,
          introHtml: this.applicationIntroHtmlDraft,
          legalNoticeHtml: this.applicationLegalNoticeHtmlDraft,
          customTexts: this.normalizedApplicationCustomTexts(),
          assetAssignments: this.normalizedApplicationAssetAssignments(),
          globalWarningText: this.applicationWarningTextDraft,
          globalWarningExpiresAt: expirationInput
            ? new Date(expirationInput).toISOString()
            : null
        }
      );
      this.applyApplicationSettingsDraft(settings);
    });
  }

  clearApplicationWarning(): void {
    this.applicationWarningTextDraft = "";
    this.applicationWarningExpiresAtDraft = "";
  }

  addApplicationCustomText(): void {
    if (!this.canAddApplicationCustomText) {
      return;
    }
    this.applicationCustomTextDrafts = {
      ...this.applicationCustomTextDrafts,
      [this.applicationCustomTextNewKey.trim()]:
        this.applicationCustomTextNewValue.trim()
    };
    this.applicationCustomTextNewKey = "";
    this.applicationCustomTextNewValue = "";
  }

  removeApplicationCustomText(key: string): void {
    const { [key]: _removed, ...remaining } = this.applicationCustomTextDrafts;
    this.applicationCustomTextDrafts = remaining;
  }

  resetApplicationCustomTexts(): void {
    this.applicationCustomTextDrafts = {};
    this.applicationCustomTextNewKey = "";
    this.applicationCustomTextNewValue = "";
  }

  setApplicationCustomTextToDefault(key: string): void {
    const defaultValue = this.applicationCustomTextDefault(key);
    if (!defaultValue) {
      return;
    }
    this.applicationCustomTextDrafts = {
      ...this.applicationCustomTextDrafts,
      [key]: defaultValue
    };
  }

  selectApplicationLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.applicationLogoDraftError = "";
    if (!file) {
      return;
    }
    const allowedTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml"
    ]);
    if (!allowedTypes.has(file.type)) {
      input.value = "";
      this.applicationLogoDraftError =
        "Choose a PNG, JPEG, GIF, WebP, or SVG logo.";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      input.value = "";
      this.applicationLogoDraftError = "Logo files must not exceed 20 MiB.";
      return;
    }
    this.viewState.onActionAsync(
      () =>
        new Promise<void>(resolve => {
          const reader = new FileReader();
          reader.onerror = () => {
            input.value = "";
            this.applicationLogoDraftError =
              "The selected logo could not be read.";
            resolve();
          };
          reader.onload = () => {
            input.value = "";
            if (typeof reader.result !== "string") {
              this.applicationLogoDraftError =
                "The selected logo could not be read.";
              resolve();
              return;
            }
            this.applicationLogoDraft = reader.result;
            resolve();
          };
          reader.readAsDataURL(file);
        })
    );
  }

  resetApplicationLogo(): void {
    this.applicationLogoDraft = defaultApplicationSettings.mainLogo;
    this.applicationLogoDraftError = "";
  }

  refreshApplicationAssets(): void {
    if (!this.canManageApplicationSettings) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.applicationAssets.load(this.ops.adminSessionToken.trim())
    );
  }

  selectApplicationAsset(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.applicationAssetUploadError = "";
    if (!file) {
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      input.value = "";
      this.applicationAssetUploadError = "Choose a PNG, JPEG, or WebP image.";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      input.value = "";
      this.applicationAssetUploadError = "Application assets must not exceed 2 MiB.";
      return;
    }
    this.viewState.onActionAsync(
      () =>
        new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => {
            input.value = "";
            this.applicationAssetUploadError =
              "The selected application asset could not be read.";
            resolve();
          };
          reader.onload = () => {
            input.value = "";
            const result = typeof reader.result === "string" ? reader.result : "";
            const separatorIndex = result.indexOf(",");
            if (separatorIndex < 0) {
              this.applicationAssetUploadError =
                "The selected application asset could not be read.";
              resolve();
              return;
            }
            this.applicationAssets
              .upload(this.ops.adminSessionToken.trim(), {
                originalName: file.name,
                mediaType: file.type,
                dataBase64: result.slice(separatorIndex + 1)
              })
              .then(() => resolve(), reject);
          };
          reader.readAsDataURL(file);
        })
    );
  }

  async confirmDeleteApplicationAsset(
    asset: ApplicationAssetSummary
  ): Promise<void> {
    if (!this.canManageApplicationSettings) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Delete application asset?",
      message: `Delete '${asset.originalName}' from the shared asset registry? Assigned assets must be unassigned first.`,
      confirmLabel: "Delete asset"
    });
    if (!confirmed || !this.canManageApplicationSettings) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.applicationAssets.delete(
        this.ops.adminSessionToken.trim(),
        asset.applicationAssetId
      )
    );
  }

  setApplicationAssetAssignment(
    slot: ApplicationAssetSlotName,
    originalName: string
  ): void {
    const next = { ...this.applicationAssetAssignmentsDraft };
    if (originalName) {
      next[slot] = originalName;
    } else {
      delete next[slot];
    }
    this.applicationAssetAssignmentsDraft = next;
  }

  formatApplicationAssetBytes(byteLength: number): string {
    return byteLength >= 1024 * 1024
      ? `${(byteLength / (1024 * 1024)).toFixed(1)} MiB`
      : `${Math.max(1, Math.ceil(byteLength / 1024))} KiB`;
  }

  bootstrapOrSignInAdmin(): Promise<void> {
    if (!this.canUseAdminCredentials) {
      return Promise.resolve();
    }
    this.clearAdminBatches();
    return this.viewState.runActionAsync(async () => {
      await this.opsService.bootstrapOrSignInAdmin();
      await this.loadApplicationAssetsIfAllowed();
    });
  }

  bootstrapAdmin(): void {
    if (!this.canUseAdminCredentials) {
      return;
    }
    this.viewState.onActionAsync(() => this.opsService.bootstrapAdmin());
  }

  signInAdmin(): Promise<void> {
    if (!this.canUseAdminCredentials) {
      return Promise.resolve();
    }
    this.clearAdminBatches();
    return this.viewState.runActionAsync(async () => {
      await this.opsService.signInAdmin();
      await this.loadApplicationAssetsIfAllowed();
    });
  }

  refreshAdminSession(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      await this.opsService.refreshAdminSession();
      await this.loadApplicationAssetsIfAllowed();
    });
  }

  refreshAdminSessions(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.clearAdminSessionBatchSelection();
    this.viewState.onActionAsync(() => this.opsService.refreshAdminSessions());
  }

  exportAdminSessionsCsv(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.viewState.onActionAsync(() => this.opsService.exportAdminSessionsCsv());
  }

  signOutAdmin(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.clearAdminBatches();
    this.platformRoleConfirmationPassword = "";
    this.adminResetPasswordConfirmation = "";
    this.adminDisplayNameTargetUserId = "";
    this.adminDisplayNameUpdateDraft = "";
    this.adminAccessWindowTargetUserId = "";
    this.adminAccessWindowValidFromDraft = "";
    this.adminAccessWindowValidToDraft = "";
    this.adminAccessWindowValidForMinutesDraft = "";
    this.adminCustomTextsTargetUserId = "";
    this.adminCustomTextsUpdateDraft = "{}";
    this.viewState.onActionAsync(() => this.opsService.signOutAdmin());
  }

  async confirmRevokeAdminSession(): Promise<void> {
    const adminSessionId = this.ops.adminSessionRevokeTargetId.trim();
    if (!this.canRevokeAdminSession || !adminSessionId) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Revoke admin session?",
      message: `Revoke admin session '${adminSessionId}'?`,
      confirmLabel: "Revoke session"
    });
    if (!confirmed || !this.canRevokeAdminSession) {
      return;
    }
    this.revokeAdminSession();
  }

  private revokeAdminSession(): void {
    if (!this.canRevokeAdminSession) {
      return;
    }
    this.viewState.onActionAsync(() => this.opsService.revokeAdminSession());
  }

  async confirmRevokeAdminSessionBatch(): Promise<void> {
    if (!this.canRevokeAdminSessionBatch) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Revoke selected sessions?",
      message: `Revoke ${this.adminSessionBatchCount} selected admin session(s)? The current session is excluded and every target remains subject to the server delegation boundary.`,
      confirmLabel: "Revoke sessions"
    });
    if (!confirmed || !this.canRevokeAdminSessionBatch) {
      return;
    }

    const selectedAdminSessionIds = [...this.adminSessionBatchSelection];
    this.viewState.onActionAsync(async () => {
      const result = await this.opsService.revokeAdminSessions(
        selectedAdminSessionIds
      );
      this.adminSessionBatchResult = result;
      for (const adminSession of result.adminSessions) {
        this.adminSessionBatchSelection.delete(adminSession.adminSessionId);
      }
    });
  }

  clearAdminSessionBatchSelection(): void {
    this.adminSessionBatchSelection.clear();
    this.adminSessionBatchResult = null;
  }

  private clearAdminBatches(): void {
    this.clearAdminSessionBatchSelection();
    this.clearAdminUserBatchSelection();
  }

  refreshAdminUsers(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.clearAdminUserBatchSelection();
    this.viewState.onActionAsync(() => this.opsService.refreshAdminUsers());
  }

  get canRefreshWorkspaceAdminAccessMatrix(): boolean {
    return (
      this.canUseAdminSession &&
      !!this.workspace.tenantKey.trim() &&
      !!this.workspace.workspaceKey.trim()
    );
  }

  refreshWorkspaceAdminAccessMatrix(): void {
    if (!this.canRefreshWorkspaceAdminAccessMatrix) {
      return;
    }
    const tenantKey = this.workspace.tenantKey.trim();
    const workspaceKey = this.workspace.workspaceKey.trim();
    this.viewState.onActionAsync(async () => {
      await this.workspaceService.refreshWorkspaceDirectory();
      await this.opsService.refreshAdminUsers();
      this.workspaceAdminMatrixTenantKey = tenantKey;
      this.workspaceAdminMatrixWorkspaceKey = workspaceKey;
    });
  }

  get canRefreshAdminWorkspaceAccessMatrix(): boolean {
    return (
      this.canUseAdminSession &&
      !!this.workspace.tenantKey.trim() &&
      !!this.ops.adminRoleTargetUserId.trim()
    );
  }

  refreshAdminWorkspaceAccessMatrix(): void {
    if (!this.canRefreshAdminWorkspaceAccessMatrix) {
      return;
    }
    const tenantKey = this.workspace.tenantKey.trim();
    const adminUserId = this.ops.adminRoleTargetUserId.trim();
    this.viewState.onActionAsync(async () => {
      await this.workspaceService.refreshWorkspaceDirectory();
      await this.opsService.refreshAdminUsers();
      this.adminWorkspaceMatrixTenantKey = tenantKey;
      this.adminWorkspaceMatrixUserId = adminUserId;
    });
  }

  exportAdminUsersCsv(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.viewState.onActionAsync(() => this.opsService.exportAdminUsersCsv());
  }

  refreshAdminAuditEvents(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.viewState.onActionAsync(() => this.opsService.refreshAdminAuditEvents());
  }

  exportAdminAuditEventsCsv(): void {
    if (!this.canUseAdminSession) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.opsService.exportAdminAuditEventsCsv()
    );
  }

  createAdminUser(): void {
    if (!this.canCreateAdminUser) {
      return;
    }
    const requiresStepUp = this.ops.adminCreateRole === "platform_admin";
    const confirmationPassword = requiresStepUp
      ? this.platformRoleConfirmationPassword
      : undefined;
    this.viewState.onActionAsync(async () => {
      await this.opsService.createAdminUser(confirmationPassword);
      if (requiresStepUp) {
        this.platformRoleConfirmationPassword = "";
      }
    });
  }

  assignAdminRole(): void {
    if (!this.canAssignAdminRole) {
      return;
    }
    const requiresStepUp = this.ops.adminRoleRole === "platform_admin";
    const confirmationPassword = requiresStepUp
      ? this.platformRoleConfirmationPassword
      : undefined;
    this.viewState.onActionAsync(async () => {
      await this.opsService.assignAdminRole(confirmationPassword);
      if (requiresStepUp) {
        this.platformRoleConfirmationPassword = "";
      }
    });
  }

  async confirmRevokeAdminRole(): Promise<void> {
    const adminUserId = this.ops.adminRevokeTargetUserId.trim();
    const roleAssignmentId = this.ops.adminRevokeRoleAssignmentId.trim();
    if (!this.canRevokeAdminRole || !adminUserId || !roleAssignmentId) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Revoke role assignment?",
      message: `Revoke role assignment '${roleAssignmentId}' from admin user '${adminUserId}'?`,
      confirmLabel: "Revoke role"
    });
    if (!confirmed || !this.canRevokeAdminRole) {
      return;
    }
    this.revokeAdminRole();
  }

  private revokeAdminRole(): void {
    if (!this.canRevokeAdminRole) {
      return;
    }
    const requiresStepUp = this.isRevokingPlatformAdminRole;
    const confirmationPassword = requiresStepUp
      ? this.platformRoleConfirmationPassword
      : undefined;
    this.viewState.onActionAsync(async () => {
      await this.opsService.revokeAdminRole(confirmationPassword);
      if (requiresStepUp) {
        this.platformRoleConfirmationPassword = "";
      }
    });
  }

  async confirmUpdateAdminUserStatus(): Promise<void> {
    const adminUserId = this.ops.adminStatusTargetUserId.trim();
    const status = this.ops.adminStatusValue;
    if (!this.canUpdateAdminUserStatus || !adminUserId) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Change account status?",
      message: `Change admin user '${adminUserId}' status to '${status}'?`,
      confirmLabel: "Change status",
      tone: status === "disabled" ? "danger" : "primary"
    });
    if (!confirmed || !this.canUpdateAdminUserStatus) {
      return;
    }
    this.updateAdminUserStatus();
  }

  private updateAdminUserStatus(): void {
    if (!this.canUpdateAdminUserStatus) {
      return;
    }
    this.viewState.onActionAsync(() => this.opsService.updateAdminUserStatus());
  }

  async confirmUpdateAdminUserDisplayName(): Promise<void> {
    const adminUserId = this.adminDisplayNameTargetUserId.trim();
    const displayName = this.adminDisplayNameUpdateDraft.trim();
    if (!this.canUpdateAdminUserDisplayName || !adminUserId || !displayName) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Change display name?",
      message: `Change admin user '${adminUserId}' display name to '${displayName}'?`,
      confirmLabel: "Change display name",
      tone: "primary"
    });
    if (!confirmed || !this.canUpdateAdminUserDisplayName) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      await this.opsService.updateAdminUserDisplayName(adminUserId, displayName);
      this.adminDisplayNameUpdateDraft = displayName;
    });
  }

  async confirmUpdateAdminUserAccessWindow(): Promise<void> {
    const adminUserId = this.adminAccessWindowTargetUserId.trim();
    if (!this.canUpdateAdminUserAccessWindow || !adminUserId) {
      return;
    }
    const validFrom = String(
      this.adminAccessWindowValidFromDraft ?? ""
    ).trim();
    const validTo = String(this.adminAccessWindowValidToDraft ?? "").trim();
    const validForMinutes = String(
      this.adminAccessWindowValidForMinutesDraft ?? ""
    ).trim();
    const confirmed = await this.confirmation.confirm({
      title: "Update access window?",
      message: `Update admin user '${adminUserId}' access window? Active sessions outside the new boundary will be ended.`,
      confirmLabel: "Update access window"
    });
    if (!confirmed || !this.canUpdateAdminUserAccessWindow) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.opsService.updateAdminUserAccessWindow(
        adminUserId,
        validFrom,
        validTo,
        validForMinutes
      )
    );
  }

  async confirmUpdateAdminUserCustomTexts(): Promise<void> {
    const adminUserId = this.adminCustomTextsTargetUserId.trim();
    const customTexts = this.normalizedAdminCustomTextsUpdate;
    if (!this.canUpdateAdminUserCustomTexts || !adminUserId || !customTexts) {
      return;
    }
    const entryCount = Object.keys(customTexts).length;
    const confirmed = await this.confirmation.confirm({
      title: "Replace login-specific texts?",
      message: `Replace admin user '${adminUserId}' login-specific custom texts with ${entryCount} entr${entryCount === 1 ? "y" : "ies"}?`,
      confirmLabel: "Replace custom texts",
      tone: "primary"
    });
    if (!confirmed || !this.canUpdateAdminUserCustomTexts) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.opsService.updateAdminUserCustomTexts(adminUserId, customTexts)
    );
  }

  async confirmUpdateAdminUserBatchStatus(): Promise<void> {
    if (!this.canUpdateAdminUserBatchStatus) {
      return;
    }
    const status = this.ops.adminStatusValue;
    const confirmed = await this.confirmation.confirm({
      title: "Change selected account status?",
      message: `Change ${this.adminUserBatchCount} selected admin user(s) to '${status}'? Each account remains subject to the server delegation boundary.`,
      confirmLabel: "Change statuses",
      tone: status === "disabled" ? "danger" : "primary"
    });
    if (!confirmed || !this.canUpdateAdminUserBatchStatus) {
      return;
    }

    const selectedAdminUserIds = [...this.adminUserBatchSelection];
    this.viewState.onActionAsync(async () => {
      this.adminUserPasswordBatchResult = null;
      this.adminUserDeletionBatchResult = null;
      const result = await this.opsService.updateAdminUsersStatus(
        selectedAdminUserIds,
        status
      );
      this.adminUserRoleBatchResult = null;
      this.adminUserStatusBatchResult = result;
      for (const adminUserId of result.succeededAdminUserIds) {
        this.adminUserBatchSelection.delete(adminUserId);
      }
    });
  }

  async confirmAssignAdminUserBatchRole(): Promise<void> {
    if (!this.canAssignAdminUserBatchRole) {
      return;
    }
    const role = this.ops.adminRoleRole;
    const confirmed = await this.confirmation.confirm({
      title: "Assign role to selected accounts?",
      message: `Assign '${role}' to ${this.adminUserBatchCount} selected admin user(s)? Each account remains subject to the server delegation boundary.`,
      confirmLabel: "Assign role"
    });
    if (!confirmed || !this.canAssignAdminUserBatchRole) {
      return;
    }

    const selectedAdminUserIds = [...this.adminUserBatchSelection];
    this.viewState.onActionAsync(async () => {
      this.adminUserPasswordBatchResult = null;
      this.adminUserDeletionBatchResult = null;
      const requiresStepUp = role === "platform_admin";
      const result = await this.opsService.assignAdminRoles(
        selectedAdminUserIds,
        requiresStepUp ? this.platformRoleConfirmationPassword : undefined
      );
      if (requiresStepUp && result.succeededAdminUserIds.length > 0) {
        this.platformRoleConfirmationPassword = "";
      }
      this.adminUserStatusBatchResult = null;
      this.adminUserRoleBatchResult = result;
      for (const adminUserId of result.succeededAdminUserIds) {
        this.adminUserBatchSelection.delete(adminUserId);
      }
    });
  }

  async confirmDeleteAdminUserBatch(): Promise<void> {
    if (!this.canDeleteAdminUserBatch) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Permanently delete selected accounts?",
      message: `Permanently delete ${this.adminUserBatchCount} selected admin user(s)? Their sessions and role assignments will be removed; audit evidence will be retained. This cannot be undone.`,
      confirmLabel: "Delete accounts"
    });
    if (!confirmed || !this.canDeleteAdminUserBatch) {
      return;
    }

    const selectedAdminUserIds = [...this.adminUserBatchSelection];
    this.viewState.onActionAsync(async () => {
      this.adminUserPasswordBatchResult = null;
      const result = await this.opsService.deleteAdminUsers(selectedAdminUserIds);
      this.adminUserStatusBatchResult = null;
      this.adminUserRoleBatchResult = null;
      this.adminUserDeletionBatchResult = result;
      for (const deletion of result.deletions) {
        this.adminUserBatchSelection.delete(deletion.adminUserId);
      }
    });
  }

  clearAdminUserBatchSelection(): void {
    this.adminUserBatchSelection.clear();
    this.adminUserStatusBatchResult = null;
    this.adminUserRoleBatchResult = null;
    this.adminUserPasswordBatchResult = null;
    this.adminUserDeletionBatchResult = null;
  }

  async confirmResetAdminUserBatchPasswords(): Promise<void> {
    if (!this.canResetAdminUserBatchPasswords) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Generate new account passwords?",
      message: `Generate and set a unique password for ${this.adminUserBatchCount} selected admin user(s)? Existing passwords will stop working immediately; active sessions are unchanged.`,
      confirmLabel: "Generate passwords"
    });
    if (!confirmed || !this.canResetAdminUserBatchPasswords) {
      return;
    }

    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    const selectedUsers = (payload?.items ?? []).filter(item =>
      this.adminUserBatchSelection.has(item.adminUser.adminUserId)
    );
    this.viewState.onActionAsync(async () => {
      const issuedPasswords = new Set(
        this.adminUserPasswordBatchResult?.credentials.map(
          credential => credential.password
        ) ?? []
      );
      const credentials: AdminUserPasswordBatchCredential[] = selectedUsers.map(
        item => {
          let password = generateAdminPassword();
          while (issuedPasswords.has(password)) {
            password = generateAdminPassword();
          }
          issuedPasswords.add(password);
          return {
            adminUserId: item.adminUser.adminUserId,
            username: item.adminUser.username,
            password
          };
        }
      );
      const result = await this.opsService.resetAdminUserPasswords(credentials);
      const previousCredentials =
        this.adminUserPasswordBatchResult?.credentials ?? [];
      this.adminUserStatusBatchResult = null;
      this.adminUserRoleBatchResult = null;
      this.adminUserDeletionBatchResult = null;
      this.adminUserPasswordBatchResult = {
        requestedCount: result.requestedCount,
        credentials: [
          ...previousCredentials.filter(previous =>
            result.credentials.every(
              credential => credential.adminUserId !== previous.adminUserId
            )
          ),
          ...result.credentials
        ],
        failures: result.failures
      };
      for (const credential of result.credentials) {
        this.adminUserBatchSelection.delete(credential.adminUserId);
      }
    });
  }

  downloadAndClearAdminUserBatchPasswords(): void {
    const result = this.adminUserPasswordBatchResult;
    if (!result?.credentials.length) {
      return;
    }
    this.opsService.downloadAdminPasswordBatchCsv(result.credentials);
    this.adminUserPasswordBatchResult = result.failures.length
      ? { ...result, credentials: [] }
      : null;
  }

  async confirmResetAdminUserPassword(): Promise<void> {
    const adminUserId = this.ops.adminResetTargetUserId.trim();
    if (!this.canResetAdminUserPassword || !adminUserId) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Reset account password?",
      message: `Reset password for admin user '${adminUserId}'?`,
      confirmLabel: "Reset password"
    });
    if (!confirmed || !this.canResetAdminUserPassword) {
      return;
    }
    this.resetAdminUserPassword();
  }

  private resetAdminUserPassword(): void {
    if (!this.canResetAdminUserPassword) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      await this.opsService.resetAdminUserPassword();
      this.adminResetPasswordConfirmation = "";
    });
  }

  applyAdminUserFilters(): void {
    this.persistState();
    this.refreshAdminUsers();
  }

  clearAdminUserFilters(): void {
    this.ops.adminUserUsernameFilter = "";
    this.ops.adminUserStatusFilter = "";
    this.ops.adminUserAccessStatusFilter = "";
    this.ops.adminUserPasswordChangeFilter = "";
    this.ops.adminUserRoleFilter = "";
    this.ops.adminUserTenantFilter = "";
    this.ops.adminUserWorkspaceFilter = "";
    this.ops.adminUserLimit = "100";
    this.persistState();
  }

  applyAdminSessionFilters(): void {
    this.persistState();
    this.refreshAdminSessions();
  }

  clearAdminSessionFilters(): void {
    this.ops.adminSessionUserFilter = "";
    this.ops.adminSessionStatusFilter = "";
    this.ops.adminSessionLimit = "100";
    this.ops.adminSessionRevokeTargetId = "";
    this.clearAdminSessionBatchSelection();
    this.persistState();
  }

  useCurrentAdminUserAsSessionFilter(): void {
    const payload = parseJsonDocument<AdminSessionViewPayload>(
      this.ops.adminSessionView
    );
    const adminUserId = payload?.adminUser?.adminUserId;
    if (!adminUserId) {
      return;
    }

    this.ops.adminSessionUserFilter = adminUserId;
    this.persistState();
  }

  useAdminManagementScopeAsUserFilters(): void {
    this.ops.adminUserRoleFilter = this.ops.adminRoleRole;
    this.ops.adminUserTenantFilter = this.ops.adminRoleTenantKey;
    this.ops.adminUserWorkspaceFilter =
      this.ops.adminRoleRole === "workspace_admin" ||
      this.ops.adminRoleRole === "study_monitor" ||
      this.ops.adminRoleRole === "group_monitor" ||
      this.ops.adminRoleRole === "system_check"
        ? this.ops.adminRoleWorkspaceKey
        : "";
    this.persistState();
  }

  applyAdminAuditFilters(): void {
    this.persistState();
    this.refreshAdminAuditEvents();
  }

  clearAdminAuditFilters(): void {
    this.ops.adminAuditEventTypeFilter = "";
    this.ops.adminAuditActorFilter = "";
    this.ops.adminAuditSubjectFilter = "";
    this.ops.adminAuditLimit = "100";
    this.persistState();
  }

  useSelectedAdminUserAsAuditSubject(): void {
    const adminUserId =
      this.ops.adminStatusTargetUserId.trim() ||
      this.ops.adminRoleTargetUserId.trim() ||
      this.ops.adminRevokeTargetUserId.trim() ||
      this.ops.adminResetTargetUserId.trim();
    if (!adminUserId) {
      return;
    }

    this.ops.adminAuditSubjectFilter = adminUserId;
    this.persistState();
  }

  signInLocalDemoAdmin(): Promise<void> {
    this.clearAdminBatches();
    return this.viewState.runActionAsync(async () => {
      this.ops.adminUsername = localDemoAccess.adminUsername;
      this.ops.adminDisplayName = localDemoAccess.adminDisplayName;
      this.ops.adminPassword = localDemoAccess.adminPassword;
      this.persistState();
      await this.opsService.signInAdmin();
      await this.loadApplicationAssetsIfAllowed();
    });
  }

  selectAdminUser(item: RecordCollectionItem): void {
    if (item.actionPayload?.adminUserBatchCommand === "toggle") {
      const batchAdminUserId = item.actionPayload.adminUserId?.trim();
      if (!batchAdminUserId || batchAdminUserId === this.currentAdminUserId) {
        return;
      }
      if (this.adminUserBatchSelection.has(batchAdminUserId)) {
        this.adminUserBatchSelection.delete(batchAdminUserId);
      } else if (this.adminUserBatchSelection.size < 50) {
        this.adminUserBatchSelection.add(batchAdminUserId);
      }
      this.adminUserStatusBatchResult = null;
      this.adminUserRoleBatchResult = null;
      this.adminUserDeletionBatchResult = null;
      return;
    }

    const adminUserId = item.actionPayload?.adminUserId;
    if (!adminUserId) {
      return;
    }

    this.ops.adminRoleTargetUserId = adminUserId;
    this.ops.adminRevokeTargetUserId = adminUserId;
    this.ops.adminStatusTargetUserId = adminUserId;
    this.ops.adminResetTargetUserId = adminUserId;
    this.adminDisplayNameTargetUserId = adminUserId;
    this.adminDisplayNameUpdateDraft =
      item.actionPayload?.adminUserDisplayName ?? "";
    this.adminAccessWindowTargetUserId = adminUserId;
    this.adminAccessWindowValidFromDraft =
      item.actionPayload?.adminUserValidFrom ?? "";
    this.adminAccessWindowValidToDraft =
      item.actionPayload?.adminUserValidTo ?? "";
    this.adminAccessWindowValidForMinutesDraft =
      item.actionPayload?.adminUserValidForMinutes ?? "";
    this.adminCustomTextsTargetUserId = adminUserId;
    this.adminCustomTextsUpdateDraft =
      item.actionPayload?.adminUserCustomTexts ?? "{}";
    this.ops.adminRevokeRoleAssignmentId =
      item.actionPayload?.roleAssignmentId ??
      this.ops.adminRevokeRoleAssignmentId;
    const status = item.actionPayload?.adminUserStatus;
    if (status === "active" || status === "disabled") {
      this.ops.adminStatusValue = status;
    }
    this.persistState();
  }

  selectAdminSession(item: RecordCollectionItem): void {
    const adminUserId = item.actionPayload?.adminUserId;
    const adminSessionId = item.actionPayload?.adminSessionId?.trim();
    if (item.actionPayload?.adminSessionBatchCommand === "toggle") {
      if (!adminSessionId || adminSessionId === this.currentAdminSessionId) {
        return;
      }
      if (this.adminSessionBatchSelection.has(adminSessionId)) {
        this.adminSessionBatchSelection.delete(adminSessionId);
      } else if (this.adminSessionBatchSelection.size < 50) {
        this.adminSessionBatchSelection.add(adminSessionId);
      }
      this.adminSessionBatchResult = null;
      this.uiState.renderVersion.update(version => version + 1);
      return;
    }
    if (!adminUserId || !adminSessionId) {
      return;
    }

    this.ops.adminSessionUserFilter = adminUserId;
    this.ops.adminSessionRevokeTargetId = adminSessionId;
    this.persistState();
  }

  selectAdminRoleAssignment(item: RecordCollectionItem): void {
    const adminUserId = item.actionPayload?.adminUserId;
    const roleAssignmentId = item.actionPayload?.roleAssignmentId;
    if (!adminUserId || !roleAssignmentId) {
      return;
    }

    this.ops.adminRoleTargetUserId = adminUserId;
    this.ops.adminRevokeTargetUserId = adminUserId;
    this.ops.adminRevokeRoleAssignmentId = roleAssignmentId;
    this.ops.adminStatusTargetUserId = adminUserId;
    this.ops.adminResetTargetUserId = adminUserId;
    const role = item.actionPayload?.adminRole;
    if (role && this.allAdminRoleOptions.includes(role as AdminRole)) {
      this.ops.adminRoleRole = role as AdminRole;
    }
    const accessMode = item.actionPayload?.adminRoleAccessMode;
    if (accessMode === "read_write" || accessMode === "read_only") {
      this.ops.adminRoleAccessMode = accessMode;
    }
    this.ops.adminRoleGroupKey = item.actionPayload?.groupKey ?? "";
    this.ops.adminRoleMonitorProfilesJson =
      item.actionPayload?.monitorProfilesJson ?? "[]";
    this.ops.adminRoleMonitorBookletVisibility =
      item.actionPayload?.monitorBookletVisibility === "collapsed" ||
      item.actionPayload?.monitorBookletVisibility === "hidden"
        ? item.actionPayload.monitorBookletVisibility
        : "visible";
    this.monitorProfileEditorTarget = "role";
    this.resetMonitorProfileDraft();
    const status = item.actionPayload?.adminUserStatus;
    if (status === "active" || status === "disabled") {
      this.ops.adminStatusValue = status;
    }
    this.persistState();
  }

  runWorkspaceAdminAccessAction(item: RecordCollectionItem): void {
    const command = item.actionPayload?.workspaceAdminAccessCommand;
    const adminUserId = item.actionPayload?.adminUserId?.trim();
    const roleAssignmentId = item.actionPayload?.roleAssignmentId?.trim();
    if (!adminUserId) {
      return;
    }

    if (command === "revoke") {
      if (!roleAssignmentId) {
        return;
      }
      this.ops.adminRevokeTargetUserId = adminUserId;
      this.ops.adminRevokeRoleAssignmentId = roleAssignmentId;
      this.persistState();
      void this.confirmRevokeAdminRole();
      return;
    }

    if (command !== "read_only" && command !== "read_write") {
      return;
    }
    this.ops.adminRoleTargetUserId = adminUserId;
    this.ops.adminRoleRole = "workspace_admin";
    this.ops.adminRoleAccessMode = command;
    this.ops.adminRoleTenantKey = this.workspaceAdminMatrixTenantKey;
    this.ops.adminRoleWorkspaceKey = this.workspaceAdminMatrixWorkspaceKey;
    this.ops.adminRoleGroupKey = "";
    this.persistState();
    this.assignAdminRole();
  }

  runAdminWorkspaceAccessAction(item: RecordCollectionItem): void {
    const command = item.actionPayload?.adminWorkspaceAccessCommand;
    const workspaceKey = item.actionPayload?.workspaceKey?.trim();
    const roleAssignmentId = item.actionPayload?.roleAssignmentId?.trim();
    const adminUserId = this.adminWorkspaceMatrixUserId;
    if (!adminUserId || !workspaceKey) {
      return;
    }

    if (command === "revoke") {
      if (!roleAssignmentId) {
        return;
      }
      this.ops.adminRevokeTargetUserId = adminUserId;
      this.ops.adminRevokeRoleAssignmentId = roleAssignmentId;
      this.persistState();
      void this.confirmRevokeAdminRole();
      return;
    }

    if (command !== "read_only" && command !== "read_write") {
      return;
    }
    this.ops.adminRoleTargetUserId = adminUserId;
    this.ops.adminRoleRole = "workspace_admin";
    this.ops.adminRoleAccessMode = command;
    this.ops.adminRoleTenantKey = this.adminWorkspaceMatrixTenantKey;
    this.ops.adminRoleWorkspaceKey = workspaceKey;
    this.ops.adminRoleGroupKey = "";
    this.persistState();
    this.assignAdminRole();
  }

  setMonitorProfileEditorTarget(target: "create" | "role"): void {
    if (
      (target === "create" && !this.isCreatingMonitorAccount) ||
      (target === "role" && !this.isAssigningMonitorRole)
    ) {
      return;
    }
    this.monitorProfileEditorTarget = target;
    this.resetMonitorProfileDraft();
  }

  adminCreateRoleChanged(): void {
    if (this.isCreatingMonitorAccount) {
      this.setMonitorProfileEditorTarget("create");
    } else if (this.isAssigningMonitorRole) {
      this.setMonitorProfileEditorTarget("role");
    }
    this.persistState();
  }

  adminRoleRoleChanged(): void {
    if (this.isAssigningMonitorRole) {
      this.setMonitorProfileEditorTarget("role");
    } else if (this.isCreatingMonitorAccount) {
      this.setMonitorProfileEditorTarget("create");
    }
    this.persistState();
  }

  startNewMonitorProfile(): void {
    this.resetMonitorProfileDraft();
  }

  async handleMonitorProfileAction(item: RecordCollectionItem): Promise<void> {
    const profileId = item.actionPayload?.profileId;
    if (!profileId) {
      return;
    }
    if (item.actionPayload?.monitorProfileAction === "delete") {
      const confirmed = await this.confirmation.confirm({
        title: "Delete monitor profile from draft?",
        message: `Delete monitor profile '${profileId}' from this draft? The role is only changed after you create the account or update the role scope.`,
        confirmLabel: "Delete profile"
      });
      if (!confirmed) {
        return;
      }
      this.writeMonitorProfileEditorProfiles(
        this.monitorProfileEditorProfiles.filter(
          profile => profile.profileId !== profileId
        )
      );
      if (this.monitorProfileDraftSelectedId === profileId) {
        this.resetMonitorProfileDraft();
      }
      return;
    }

    const profile = this.monitorProfileEditorProfiles.find(
      candidate => candidate.profileId === profileId
    );
    if (!profile) {
      return;
    }
    this.monitorProfileDraftSelectedId = profile.profileId;
    this.monitorProfileDraftId = profile.profileId;
    this.monitorProfileDraftLabel = profile.label;
    this.monitorProfileDraftView =
      profile.settings.view === "middle"
        ? "medium"
        : profile.settings.view === "large"
          ? "full"
          : profile.settings.view;
    this.monitorProfileDraftBlockColumn = profile.settings.blockColumn;
    this.monitorProfileDraftUnitColumn = profile.settings.unitColumn;
    this.monitorProfileDraftGroupColumn = profile.settings.groupColumn;
    this.monitorProfileDraftBookletColumn = profile.settings.bookletColumn;
    this.monitorProfileDraftBookletStatesColumns =
      profile.settings.bookletStatesColumns;
    this.monitorProfileDraftAutoselectNextBlock =
      profile.settings.autoselectNextBlock;
    this.monitorProfileDraftPending = profile.filtersEnabled.pending;
    this.monitorProfileDraftLocked = profile.filtersEnabled.locked;
    this.monitorProfileDraftFilters = profile.filters.map(filter => ({
      ...filter
    }));
  }

  addMonitorProfileDraftFilter(): void {
    if (!this.canAddMonitorProfileFilter) {
      return;
    }
    this.monitorProfileDraftFilters = [
      ...this.monitorProfileDraftFilters,
      {
        target: this.monitorFilterDraftTarget.trim(),
        value:
          this.monitorFilterDraftTarget === "state"
            ? [...this.monitorFilterDraftStates]
            : this.monitorFilterDraftValue.trim(),
        subValue:
          this.monitorFilterDraftTarget === "state"
            ? null
            : this.monitorFilterDraftSubValue.trim() || null,
        label: this.monitorFilterDraftLabel.trim(),
        type:
          this.monitorFilterDraftTarget === "state"
            ? "equal"
            : this.monitorFilterDraftType.trim() || "equal",
        not: this.monitorFilterDraftNot
      }
    ];
    this.monitorFilterDraftValue = "";
    this.monitorFilterDraftStates = [];
    this.monitorFilterDraftSubValue = "";
    this.monitorFilterDraftLabel = "";
    this.monitorFilterDraftNot = false;
  }

  removeMonitorProfileDraftFilter(item: RecordCollectionItem): void {
    const index = Number(item.actionPayload?.filterIndex);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.monitorProfileDraftFilters.length
    ) {
      return;
    }
    this.monitorProfileDraftFilters = this.monitorProfileDraftFilters.filter(
      (_filter, filterIndex) => filterIndex !== index
    );
  }

  saveMonitorProfile(): void {
    if (!this.canSaveMonitorProfile) {
      return;
    }
    const profileId = this.monitorProfileDraftId.trim();
    const profile: MonitorViewProfile = {
      profileId,
      label: this.monitorProfileDraftLabel.trim(),
      settings: {
        blockColumn: this.monitorProfileDraftBlockColumn,
        unitColumn: this.monitorProfileDraftUnitColumn,
        view: this.monitorProfileDraftView,
        groupColumn: this.monitorProfileDraftGroupColumn,
        bookletColumn: this.monitorProfileDraftBookletColumn,
        bookletStatesColumns: this.monitorProfileDraftBookletStatesColumns.trim(),
        autoselectNextBlock: this.monitorProfileDraftAutoselectNextBlock
      },
      filters: this.monitorProfileDraftFilters.map(filter => ({ ...filter })),
      filtersEnabled: {
        pending: this.monitorProfileDraftPending,
        locked: this.monitorProfileDraftLocked
      }
    };
    const selectedId = this.monitorProfileDraftSelectedId;
    const profiles = this.monitorProfileEditorProfiles.filter(
      candidate =>
        candidate.profileId !== profileId &&
        (!selectedId || candidate.profileId !== selectedId)
    );
    this.writeMonitorProfileEditorProfiles([...profiles, profile]);
    this.monitorProfileDraftSelectedId = profileId;
  }

  private writeMonitorProfileEditorProfiles(profiles: MonitorViewProfile[]): void {
    const serialized = JSON.stringify(profiles);
    if (this.monitorProfileEditorTarget === "create") {
      this.ops.adminCreateMonitorProfilesJson = serialized;
    } else {
      this.ops.adminRoleMonitorProfilesJson = serialized;
    }
    this.persistState();
  }

  private resetMonitorProfileDraft(): void {
    this.monitorProfileDraftSelectedId = "";
    this.monitorProfileDraftId = "";
    this.monitorProfileDraftLabel = "";
    this.monitorProfileDraftView = "medium";
    this.monitorProfileDraftBlockColumn = "show";
    this.monitorProfileDraftUnitColumn = "show";
    this.monitorProfileDraftGroupColumn = "hide";
    this.monitorProfileDraftBookletColumn = "show";
    this.monitorProfileDraftBookletStatesColumns = "";
    this.monitorProfileDraftAutoselectNextBlock = "yes";
    this.monitorProfileDraftPending = "no";
    this.monitorProfileDraftLocked = "no";
    this.monitorProfileDraftFilters = [];
    this.monitorFilterDraftTarget = "groupName";
    this.monitorFilterDraftType = "equal";
    this.monitorFilterDraftValue = "";
    this.monitorFilterDraftStates = [];
    this.monitorFilterDraftSubValue = "";
    this.monitorFilterDraftLabel = "";
    this.monitorFilterDraftNot = false;
  }

  selectAdminAuditEvent(item: RecordCollectionItem): void {
    const eventType = item.actionPayload?.adminAuditEventType;
    const actorAdminUserId = item.actionPayload?.actorAdminUserId;
    const subjectAdminUserId = item.actionPayload?.subjectAdminUserId;

    if (eventType) {
      this.ops.adminAuditEventTypeFilter = eventType;
    }
    if (actorAdminUserId) {
      this.ops.adminAuditActorFilter = actorAdminUserId;
    }
    if (subjectAdminUserId) {
      this.ops.adminAuditSubjectFilter = subjectAdminUserId;
      this.ops.adminRoleTargetUserId = subjectAdminUserId;
      this.ops.adminRevokeTargetUserId = subjectAdminUserId;
      this.ops.adminStatusTargetUserId = subjectAdminUserId;
      this.ops.adminResetTargetUserId = subjectAdminUserId;
    }
    this.persistState();
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  get adminSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<AdminSessionViewPayload>(
      this.ops.adminSessionView
    );
    const adminUser = payload?.adminUser ?? null;
    const adminSession = payload?.adminSession ?? null;
    const roleAssignments = payload?.roleAssignments ?? [];
    const tokenPresent = this.ops.adminSessionToken.trim() !== "";

    return [
      {
        headline: adminUser?.username ?? this.ops.adminUsername,
        subline: tokenPresent
          ? "Bearer token is stored in this browser"
          : "No admin bearer token stored",
        badges: [
          tokenPresent ? "signed-in" : "signed-out",
          ...roleAssignments.map(roleAssignment => roleAssignment.role)
        ],
        rows: [
          {
            label: "Display Name",
            value: adminUser?.displayName ?? this.ops.adminDisplayName
          },
          {
            label: "Session",
            value: adminSession?.adminSessionId ?? "n/a"
          },
          {
            label: "Expires",
            value: adminSession?.expiresAt
              ? this.formatDateTime(adminSession.expiresAt)
              : "n/a"
          },
          {
            label: "Revoked",
            value: adminSession?.revokedAt
              ? this.formatDateTime(adminSession.revokedAt)
              : "no"
          }
        ]
      }
    ];
  }

  get adminSessionDirectoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminSessionsResponse>(
      this.ops.adminSessionsView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Admin session window",
        "admin session",
        payload.items.length,
        this.ops.adminSessionLimit,
        [
          this.ops.adminSessionUserFilter.trim() ? "admin user" : "",
          this.ops.adminSessionStatusFilter.trim() ? "status" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.adminUser.username,
        subline: `${item.status} session ${item.adminSession.adminSessionId}`,
        badges: [
          item.status,
          item.adminUser.status,
          ...(item.adminSession.adminSessionId === this.currentAdminSessionId
            ? ["current session"]
            : []),
          ...(this.adminSessionBatchSelection.has(
            item.adminSession.adminSessionId
          )
            ? ["batch selected"]
            : [])
        ],
        rows: [
          { label: "Admin User ID", value: item.adminUser.adminUserId },
          {
            label: "Created",
            value: this.formatDateTime(item.adminSession.createdAt)
          },
          {
            label: "Expires",
            value: this.formatDateTime(item.adminSession.expiresAt)
          },
          {
            label: "Revoked",
            value: item.adminSession.revokedAt
              ? this.formatDateTime(item.adminSession.revokedAt)
              : "no"
          }
        ],
        actionLabel: "Select Session",
        actionPayload: {
          adminSessionId: item.adminSession.adminSessionId,
          adminUserId: item.adminUser.adminUserId
        },
        actions:
          item.status !== "active" ||
          item.adminSession.adminSessionId === this.currentAdminSessionId
            ? []
            : [
                {
                  label: this.adminSessionBatchSelection.has(
                    item.adminSession.adminSessionId
                  )
                    ? "Remove From Batch"
                    : "Add To Batch",
                  payload: {
                    adminSessionBatchCommand: "toggle",
                    adminSessionId: item.adminSession.adminSessionId,
                    adminUserId: item.adminUser.adminUserId
                  }
                }
              ]
      }))
    ];
  }

  get adminSessionBatchPreviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminSessionsResponse>(
      this.ops.adminSessionsView
    );
    const selectedSessions = (payload?.items ?? []).filter(item =>
      this.adminSessionBatchSelection.has(item.adminSession.adminSessionId)
    );
    const result = this.adminSessionBatchResult;
    if (selectedSessions.length === 0 && !result) {
      return [];
    }

    return [
      {
        headline: "Batch revoke preview",
        subline: `${selectedSessions.length} selected admin session(s) will be revoked`,
        badges: [
          `${selectedSessions.length}/50 selected`,
          "current excluded",
          "server-scoped"
        ],
        rows: [
          {
            label: "Selected Admin Session IDs",
            value:
              selectedSessions
                .map(item => item.adminSession.adminSessionId)
                .join(" | ") || "none"
          },
          {
            label: "Last Succeeded",
            value: String(result?.adminSessions.length ?? 0)
          },
          {
            label: "Last Failed",
            value: String(result?.failures.length ?? 0)
          },
          {
            label: "Failure Details",
            value:
              result?.failures
                .map(
                  failure =>
                    `${failure.adminSessionId}: ${failure.error} (${failure.statusCode})`
                )
                .join(" | ") || "none"
          }
        ]
      },
      ...selectedSessions.map(item => ({
        headline: item.adminUser.username,
        subline: item.adminSession.adminSessionId,
        badges: [item.status, "batch selected"],
        rows: [
          { label: "Admin User ID", value: item.adminUser.adminUserId },
          {
            label: "Created",
            value: this.formatDateTime(item.adminSession.createdAt)
          },
          {
            label: "Expires",
            value: this.formatDateTime(item.adminSession.expiresAt)
          }
        ],
        actionLabel: "Remove From Batch",
        actionPayload: {
          adminSessionBatchCommand: "toggle",
          adminSessionId: item.adminSession.adminSessionId,
          adminUserId: item.adminUser.adminUserId
        }
      }))
    ];
  }

  get adminUserItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Admin user window",
        "admin user",
        payload.items.length,
        this.ops.adminUserLimit,
        [
          this.ops.adminUserUsernameFilter.trim() ? "username" : "",
          this.ops.adminUserStatusFilter.trim() ? "status" : "",
          this.ops.adminUserAccessStatusFilter.trim() ? "access" : "",
          this.ops.adminUserPasswordChangeFilter.trim()
            ? "password handoff"
            : "",
          this.ops.adminUserRoleFilter.trim() ? "role" : "",
          this.ops.adminUserTenantFilter.trim() ? "tenant" : "",
          this.ops.adminUserWorkspaceFilter.trim() ? "workspace" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.adminUser.username,
        subline: item.adminUser.displayName,
        badges: [
          item.adminUser.status,
          ...(item.adminUser.passwordChangeRequired
            ? ["password handoff pending"]
            : []),
          ...item.roleAssignments.map(roleAssignment => roleAssignment.role),
          ...(item.adminUser.adminUserId === this.currentAdminUserId
            ? ["current session"]
            : []),
          ...(this.adminUserBatchSelection.has(item.adminUser.adminUserId)
            ? ["batch selected"]
            : [])
        ],
        rows: [
          {
            label: "Admin User ID",
            value: item.adminUser.adminUserId
          },
          {
            label: "Created",
            value: this.formatDateTime(item.adminUser.createdAt)
          },
          {
            label: "Password Handoff",
            value: item.adminUser.passwordChangeRequired
              ? "Required before administration"
              : "Complete"
          },
          {
            label: "Access Starts",
            value: item.adminUser.validFrom
              ? this.formatDateTime(item.adminUser.validFrom)
              : "immediately"
          },
          {
            label: "Access Ends",
            value: item.adminUser.validTo
              ? this.formatDateTime(item.adminUser.validTo)
              : "no fixed end"
          },
          {
            label: "Valid For",
            value: item.adminUser.validForMinutes
              ? `${item.adminUser.validForMinutes} minute(s) after first sign-in`
              : "unlimited"
          },
          {
            label: "First Sign-In",
            value: item.adminUser.firstSignedInAt
              ? this.formatDateTime(item.adminUser.firstSignedInAt)
              : "not yet"
          },
          {
            label: "Login Custom Texts",
            value: `${Object.keys(item.adminUser.customTexts).length} configured`
          },
          {
            label: "Role Scopes",
            value: item.roleAssignments
              .map(roleAssignment =>
                [
                  roleAssignment.role,
                  roleAssignment.accessMode,
                  roleAssignment.tenantId ?? "platform",
                  roleAssignment.workspaceId ?? "all-workspaces",
                  roleAssignment.groupKey ?? "all-groups",
                  roleAssignment.roleAssignmentId
                ].join(" / ")
              )
              .join(", ")
          }
        ],
        selected:
          item.adminUser.adminUserId === this.ops.adminRoleTargetUserId ||
          item.adminUser.adminUserId === this.ops.adminRevokeTargetUserId ||
          item.adminUser.adminUserId === this.ops.adminStatusTargetUserId ||
          item.adminUser.adminUserId === this.adminDisplayNameTargetUserId ||
          item.adminUser.adminUserId === this.adminAccessWindowTargetUserId ||
          item.adminUser.adminUserId === this.adminCustomTextsTargetUserId,
        actionLabel: "Use For Admin Actions",
        actionPayload: {
          adminUserId: item.adminUser.adminUserId,
          roleAssignmentId: item.roleAssignments[0]?.roleAssignmentId ?? "",
          adminUserStatus: item.adminUser.status,
          adminUserDisplayName: item.adminUser.displayName,
          adminUserValidFrom: item.adminUser.validFrom ?? "",
          adminUserValidTo: item.adminUser.validTo ?? "",
          adminUserValidForMinutes:
            item.adminUser.validForMinutes?.toString() ?? "",
          adminUserCustomTexts: JSON.stringify(
            item.adminUser.customTexts,
            null,
            2
          )
        },
        actions:
          item.adminUser.adminUserId === this.currentAdminUserId
            ? []
            : [
                {
                  label: this.adminUserBatchSelection.has(
                    item.adminUser.adminUserId
                  )
                    ? "Remove From Batch"
                    : "Add To Batch",
                  payload: {
                    adminUserBatchCommand: "toggle",
                    adminUserId: item.adminUser.adminUserId
                  }
                }
              ]
      }))
    ];
  }

  get adminUserBatchPreviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    const selectedUsers = (payload?.items ?? []).filter(item =>
      this.adminUserBatchSelection.has(item.adminUser.adminUserId)
    );
    const result = this.adminUserStatusBatchResult;
    const roleResult = this.adminUserRoleBatchResult;
    const passwordResult = this.adminUserPasswordBatchResult;
    const deletionResult = this.adminUserDeletionBatchResult;
    if (
      selectedUsers.length === 0 &&
      !result &&
      !roleResult &&
      !passwordResult &&
      !deletionResult
    ) {
      return [];
    }

    return [
      {
        headline: "Batch status preview",
        subline: `${selectedUsers.length} selected account(s) will be changed to ${this.ops.adminStatusValue}`,
        badges: [
          `${selectedUsers.length}/50 selected`,
          `target ${this.ops.adminStatusValue}`,
          "server-scoped"
        ],
        rows: [
          {
            label: "Selected Admin User IDs",
            value:
              selectedUsers
                .map(item => item.adminUser.adminUserId)
                .join(" | ") || "none"
          },
          {
            label: "Last Succeeded",
            value: String(result?.succeededAdminUserIds.length ?? 0)
          },
          {
            label: "Last Failed",
            value: String(result?.failures.length ?? 0)
          },
          {
            label: "Failure Details",
            value:
              result?.failures
                .map(failure => `${failure.adminUserId}: ${failure.error}`)
                .join(" | ") || "none"
          },
          {
            label: "Role Target",
            value: this.describeAdminRoleTarget()
          },
          {
            label: "Last Role Succeeded",
            value: String(roleResult?.succeededAdminUserIds.length ?? 0)
          },
          {
            label: "Last Role Failed",
            value: String(roleResult?.failures.length ?? 0)
          },
          {
            label: "Role Failure Details",
            value:
              roleResult?.failures
                .map(failure => `${failure.adminUserId}: ${failure.error}`)
                .join(" | ") || "none"
          },
          {
            label: "Generated Passwords Awaiting Handoff",
            value: String(passwordResult?.credentials.length ?? 0)
          },
          {
            label: "Last Password Failed",
            value: String(passwordResult?.failures.length ?? 0)
          },
          {
            label: "Password Failure Details",
            value:
              passwordResult?.failures
                .map(
                  failure =>
                    `${failure.username} (${failure.adminUserId}): ${failure.error}`
                )
                .join(" | ") || "none"
          },
          {
            label: "Last Deleted",
            value: String(deletionResult?.deletions.length ?? 0)
          },
          {
            label: "Deleted Sessions",
            value: String(
              deletionResult?.deletions.reduce(
                (count, deletion) => count + deletion.deletedSessionCount,
                0
              ) ?? 0
            )
          },
          {
            label: "Deleted Role Assignments",
            value: String(
              deletionResult?.deletions.reduce(
                (count, deletion) =>
                  count + deletion.deletedRoleAssignmentCount,
                0
              ) ?? 0
            )
          },
          {
            label: "Deletion Failure Details",
            value:
              deletionResult?.failures
                .map(failure => `${failure.adminUserId}: ${failure.error}`)
                .join(" | ") || "none"
          }
        ]
      },
      ...(passwordResult?.credentials.map(credential => ({
        headline: credential.username,
        subline: "Generated password handoff",
        badges: ["password reset", "not persisted in browser storage"],
        rows: [
          { label: "Admin User ID", value: credential.adminUserId },
          { label: "Generated Password", value: credential.password }
        ]
      })) ?? []),
      ...selectedUsers.map(item => ({
        headline: item.adminUser.username,
        subline: item.adminUser.displayName,
        badges: [item.adminUser.status, "batch selected"],
        rows: [
          { label: "Admin User ID", value: item.adminUser.adminUserId },
          {
            label: "Current Status",
            value: item.adminUser.status
          },
          {
            label: "Target Status",
            value: this.ops.adminStatusValue
          }
        ],
        actionLabel: "Remove From Batch",
        actionPayload: {
          adminUserBatchCommand: "toggle",
          adminUserId: item.adminUser.adminUserId
        }
      }))
    ];
  }

  get workspaceAdminAccessMatrixItems(): RecordCollectionItem[] {
    const adminUsers = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    const workspaces = parseJsonDocument<ListWorkspacesResponse>(
      this.workspace.workspacesView
    );
    const tenantKey = this.workspaceAdminMatrixTenantKey;
    const workspaceKey = this.workspaceAdminMatrixWorkspaceKey;
    if (
      tenantKey !== this.workspace.tenantKey.trim() ||
      workspaceKey !== this.workspace.workspaceKey.trim()
    ) {
      return [];
    }
    const workspace = workspaces?.items.find(
      candidate => candidate.workspaceKey === workspaceKey
    );
    if (!adminUsers || !workspace) {
      return [];
    }

    const userItems: RecordCollectionItem[] = adminUsers.items.map(item => {
      const platformAssignment = item.roleAssignments.find(
        roleAssignment => roleAssignment.role === "platform_admin"
      );
      const tenantAssignment = item.roleAssignments.find(
        roleAssignment =>
          roleAssignment.role === "tenant_admin" &&
          roleAssignment.tenantId === workspace.tenantId
      );
      const workspaceAssignment = item.roleAssignments.find(
        roleAssignment =>
          roleAssignment.role === "workspace_admin" &&
          roleAssignment.workspaceId === workspace.workspaceId
      );
      const inheritedAssignment = platformAssignment ?? tenantAssignment;
      const accessMode = inheritedAssignment
        ? "read_write"
        : workspaceAssignment?.accessMode ?? "none";
      const inheritedLabel = platformAssignment
        ? "platform admin"
        : tenantAssignment
          ? "tenant admin"
          : "";
      const isCurrentUser =
        item.adminUser.adminUserId === this.currentAdminUserId;
      const actions = inheritedAssignment
        ? []
        : workspaceAssignment
          ? [
              ...(isCurrentUser
                ? []
                : [
                    {
                      label: "Revoke Access",
                      payload: {
                        workspaceAdminAccessCommand: "revoke",
                        adminUserId: item.adminUser.adminUserId,
                        roleAssignmentId: workspaceAssignment.roleAssignmentId
                      }
                    }
                  ])
            ]
          : [
              {
                label: "Grant Read Write",
                payload: {
                  workspaceAdminAccessCommand: "read_write",
                  adminUserId: item.adminUser.adminUserId
                }
              }
            ];
      return {
        headline: item.adminUser.username,
        subline: item.adminUser.displayName,
        badges: [
          item.adminUser.status,
          accessMode === "none" ? "no access" : accessMode,
          ...(inheritedLabel ? [`inherited ${inheritedLabel}`] : []),
          ...(isCurrentUser ? ["current session"] : [])
        ],
        rows: [
          { label: "Admin User ID", value: item.adminUser.adminUserId },
          {
            label: "Effective Access",
            value:
              accessMode === "read_write"
                ? "Read and write (RW)"
                : accessMode === "read_only"
                  ? "Read only (RO)"
                  : "No workspace access"
          },
          {
            label: "Access Source",
            value: inheritedLabel || (workspaceAssignment ? "workspace role" : "none")
          },
          {
            label: "Role Assignment ID",
            value:
              inheritedAssignment?.roleAssignmentId ??
              workspaceAssignment?.roleAssignmentId ??
              "none"
          }
        ],
        ...(inheritedAssignment
          ? {}
          : {
              actionLabel:
                accessMode === "read_only"
                  ? "Set Read Write"
                  : accessMode === "read_write"
                    ? "Set Read Only"
                    : "Grant Read Only",
              actionPayload: {
                workspaceAdminAccessCommand:
                  accessMode === "read_only" ? "read_write" : "read_only",
                adminUserId: item.adminUser.adminUserId,
                roleAssignmentId: workspaceAssignment?.roleAssignmentId ?? ""
              },
              actions
            })
      };
    });

    return [
      {
        headline: workspace.displayName,
        subline: `${tenantKey} / ${workspaceKey}`,
        badges: [workspace.status, `${userItems.length} account(s)`],
        rows: [
          { label: "Workspace ID", value: workspace.workspaceId },
          { label: "Tenant ID", value: workspace.tenantId },
          {
            label: "Read Write",
            value: String(
              userItems.filter(item => item.badges.includes("read_write")).length
            )
          },
          {
            label: "Read Only",
            value: String(
              userItems.filter(item => item.badges.includes("read_only")).length
            )
          },
          {
            label: "No Access",
            value: String(
              userItems.filter(item => item.badges.includes("no access")).length
            )
          }
        ]
      },
      ...userItems
    ];
  }

  get adminWorkspaceAccessMatrixItems(): RecordCollectionItem[] {
    const adminUsers = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    const workspaces = parseJsonDocument<ListWorkspacesResponse>(
      this.workspace.workspacesView
    );
    const tenantKey = this.adminWorkspaceMatrixTenantKey;
    const adminUserId = this.adminWorkspaceMatrixUserId;
    if (
      tenantKey !== this.workspace.tenantKey.trim() ||
      adminUserId !== this.ops.adminRoleTargetUserId.trim()
    ) {
      return [];
    }
    const adminUser = adminUsers?.items.find(
      item => item.adminUser.adminUserId === adminUserId
    );
    if (!adminUser || !workspaces) {
      return [];
    }

    const workspaceItems: RecordCollectionItem[] = [...workspaces.items]
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map(workspace => {
        const platformAssignment = adminUser.roleAssignments.find(
          roleAssignment => roleAssignment.role === "platform_admin"
        );
        const tenantAssignment = adminUser.roleAssignments.find(
          roleAssignment =>
            roleAssignment.role === "tenant_admin" &&
            roleAssignment.tenantId === workspace.tenantId
        );
        const workspaceAssignment = adminUser.roleAssignments.find(
          roleAssignment =>
            roleAssignment.role === "workspace_admin" &&
            roleAssignment.workspaceId === workspace.workspaceId
        );
        const inheritedAssignment = platformAssignment ?? tenantAssignment;
        const accessMode = inheritedAssignment
          ? "read_write"
          : workspaceAssignment?.accessMode ?? "none";
        const inheritedLabel = platformAssignment
          ? "platform admin"
          : tenantAssignment
            ? "tenant admin"
            : "";
        const actions = inheritedAssignment
          ? []
          : workspaceAssignment
            ? [
                {
                  label: "Revoke Access",
                  payload: {
                    adminWorkspaceAccessCommand: "revoke",
                    workspaceKey: workspace.workspaceKey,
                    roleAssignmentId: workspaceAssignment.roleAssignmentId
                  }
                }
              ]
            : [
                {
                  label: "Grant Read Write",
                  payload: {
                    adminWorkspaceAccessCommand: "read_write",
                    workspaceKey: workspace.workspaceKey
                  }
                }
              ];
        return {
          headline: workspace.displayName,
          subline: workspace.workspaceKey,
          badges: [
            workspace.status,
            accessMode === "none" ? "no access" : accessMode,
            ...(inheritedLabel ? [`inherited ${inheritedLabel}`] : [])
          ],
          rows: [
            { label: "Workspace ID", value: workspace.workspaceId },
            {
              label: "Effective Access",
              value:
                accessMode === "read_write"
                  ? "Read and write (RW)"
                  : accessMode === "read_only"
                    ? "Read only (RO)"
                    : "No workspace access"
            },
            {
              label: "Access Source",
              value:
                inheritedLabel || (workspaceAssignment ? "workspace role" : "none")
            },
            {
              label: "Role Assignment ID",
              value:
                inheritedAssignment?.roleAssignmentId ??
                workspaceAssignment?.roleAssignmentId ??
                "none"
            }
          ],
          ...(inheritedAssignment
            ? {}
            : {
                actionLabel:
                  accessMode === "read_only"
                    ? "Set Read Write"
                    : accessMode === "read_write"
                      ? "Set Read Only"
                      : "Grant Read Only",
                actionPayload: {
                  adminWorkspaceAccessCommand:
                    accessMode === "read_only" ? "read_write" : "read_only",
                  workspaceKey: workspace.workspaceKey,
                  roleAssignmentId: workspaceAssignment?.roleAssignmentId ?? ""
                },
                actions
              })
        } satisfies RecordCollectionItem;
      });

    return [
      {
        headline: adminUser.adminUser.username,
        subline: adminUser.adminUser.displayName,
        badges: [adminUser.adminUser.status, `${workspaceItems.length} workspace(s)`],
        rows: [
          { label: "Admin User ID", value: adminUser.adminUser.adminUserId },
          { label: "Tenant Key", value: tenantKey },
          {
            label: "Read Write",
            value: String(
              workspaceItems.filter(item => item.badges.includes("read_write")).length
            )
          },
          {
            label: "Read Only",
            value: String(
              workspaceItems.filter(item => item.badges.includes("read_only")).length
            )
          },
          {
            label: "No Access",
            value: String(
              workspaceItems.filter(item => item.badges.includes("no access")).length
            )
          }
        ]
      },
      ...workspaceItems
    ];
  }

  get adminRoleAssignmentItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    if (!payload) {
      return [];
    }

    const roleAssignmentItems = payload.items.flatMap(item =>
      item.roleAssignments.map(roleAssignment => ({
        headline: roleAssignment.role,
        subline: item.adminUser.username,
        badges: [
          item.adminUser.status,
          roleAssignment.accessMode,
          roleAssignment.workspaceId
            ? "workspace-scope"
            : roleAssignment.tenantId
              ? "tenant-scope"
              : "platform-scope",
          ...(roleAssignment.monitorProfiles.length > 0
            ? [`${roleAssignment.monitorProfiles.length} monitor profile(s)`]
            : [])
        ],
        rows: [
          {
            label: "Admin User ID",
            value: item.adminUser.adminUserId
          },
          {
            label: "Role Assignment ID",
            value: roleAssignment.roleAssignmentId
          },
          {
            label: "Access Mode",
            value: roleAssignment.accessMode
          },
          {
            label: "Tenant ID",
            value: roleAssignment.tenantId ?? "platform"
          },
          {
            label: "Workspace ID",
            value: roleAssignment.workspaceId ?? "all-workspaces"
          },
          {
            label: "Group Key",
            value: roleAssignment.groupKey ?? "all-groups"
          },
          {
            label: "Monitor Profiles",
            value:
              roleAssignment.monitorProfiles
                .map(profile => profile.label || profile.profileId)
                .join(" | ") || "none"
          },
          {
            label: "Created",
            value: this.formatDateTime(roleAssignment.createdAt)
          }
        ],
        selected:
          roleAssignment.roleAssignmentId === this.ops.adminRevokeRoleAssignmentId,
        actionLabel: "Edit Role Scope",
        actionPayload: {
          adminUserId: item.adminUser.adminUserId,
          roleAssignmentId: roleAssignment.roleAssignmentId,
          adminUserStatus: item.adminUser.status,
          adminRole: roleAssignment.role,
          adminRoleAccessMode: roleAssignment.accessMode,
          groupKey: roleAssignment.groupKey ?? "",
          monitorProfilesJson: JSON.stringify(roleAssignment.monitorProfiles),
          monitorBookletVisibility:
            roleAssignment.monitorBookletVisibility ?? "visible"
        }
      }))
    );

    return [
      {
        headline: "Admin role assignment window",
        subline: `${roleAssignmentItems.length} role assignment row(s) loaded from admin users`,
        badges: [`${payload.items.length} source user(s)`, "role scopes"],
        rows: [
          { label: "Loaded Assignments", value: String(roleAssignmentItems.length) },
          { label: "Source Users", value: String(payload.items.length) },
          {
            label: "Selected Assignment",
            value: this.ops.adminRevokeRoleAssignmentId.trim() || "none"
          }
        ]
      },
      ...roleAssignmentItems
    ];
  }

  get adminAuditItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminAuditEventsResponse>(
      this.ops.adminAuditView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Admin audit window",
        "admin audit event",
        payload.items.length,
        this.ops.adminAuditLimit,
        [
          this.ops.adminAuditEventTypeFilter.trim() ? "event type" : "",
          this.ops.adminAuditActorFilter.trim() ? "actor" : "",
          this.ops.adminAuditSubjectFilter.trim() ? "subject" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(auditEvent => ({
        headline: auditEvent.eventType,
        subline: this.formatDateTime(auditEvent.occurredAt),
        badges: [
          auditEvent.actorAdminUserId ? "actor" : "system",
          auditEvent.subjectAdminUserId ? "subject" : "no-subject"
        ],
        rows: [
          {
            label: "Summary",
            value: auditEvent.summary
          },
          {
            label: "Audit Event ID",
            value: auditEvent.adminAuditEventId
          },
          {
            label: "Actor Admin User ID",
            value: auditEvent.actorAdminUserId ?? "system"
          },
          {
            label: "Subject Admin User ID",
            value: auditEvent.subjectAdminUserId ?? "n/a"
          },
          {
            label: "Details",
            value: this.stringifyValue(auditEvent.details)
          }
        ],
        selected:
          auditEvent.subjectAdminUserId != null &&
          auditEvent.subjectAdminUserId === this.ops.adminAuditSubjectFilter.trim(),
        actionLabel: "Use Audit Scope",
        actionPayload: {
          adminAuditEventType: auditEvent.eventType,
          actorAdminUserId: auditEvent.actorAdminUserId ?? "",
          subjectAdminUserId: auditEvent.subjectAdminUserId ?? ""
        }
      }))
    ];
  }

  get opsActionItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const metrics = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    const diagnostics = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    const config = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    )?.runtimeConfig;
    const items: RecordCollectionItem[] = [];
    const readinessStatus =
      readStringValue(health, ["readiness", "status"]) ?? this.ops.readinessBadge;

    if (!health || !metrics || !diagnostics || !config) {
      items.push({
        headline: "Refresh full diagnostics",
        subline: "Some operational read models are not loaded yet",
        badges: ["diagnostics", "read model"],
        rows: [
          {
            label: "Readiness",
            value: readinessStatus || "unknown"
          },
          {
            label: "Expected Result",
            value: "Load health, readiness, manifest, metrics, diagnostics, and config"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
      return items;
    }

    if (readinessStatus !== "ready") {
      items.push({
        headline: "Re-check readiness edge",
        subline: `Current readiness is ${readinessStatus}`,
        badges: ["readiness", "attention"],
        rows: [
          {
            label: "Storage",
            value: `${this.ops.storageKind} schema ${this.ops.storageSchemaVersion}`
          },
          {
            label: "Expected Result",
            value: "Refresh diagnostics and recent runtime events"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
    }

    const errorEntries = Object.entries(metrics.errorCounts)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const latestError = diagnostics.recentEvents.find(event => event.level === "error");
    if (errorEntries.length > 0 || latestError) {
      items.push({
        headline: latestError?.event ?? "Inspect error counters",
        subline: latestError
          ? this.formatDateTime(latestError.occurredAt)
          : `${errorEntries.length} non-zero error bucket(s)`,
        badges: ["errors", "diagnostics"],
        rows: [
          {
            label: "Top Error Bucket",
            value: errorEntries[0] ? `${errorEntries[0][0]} (${errorEntries[0][1]})` : "none"
          },
          {
            label: "Expected Result",
            value: "Refresh diagnostics and inspect recent operational events"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
    }

    if (config.storage.kind === "memory" || config.storage.kind === "file") {
      items.push({
        headline: "Review production storage posture",
        subline: `${config.storage.kind} storage is active`,
        badges: ["deployability", "storage"],
        rows: [
          {
            label: "Location",
            value: config.storage.location ?? "in-memory"
          },
          {
            label: "Expected Result",
            value: "Confirm whether this environment should move to sqlite or postgres"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
    }

    items.push({
      headline: "Refresh process metrics",
      subline: `${metrics.runtime.completedRequests} completed request(s)`,
      badges: ["metrics", metrics.runtime.lifecycle.phase],
      rows: [
        {
          label: "Active Requests",
          value: String(metrics.runtime.activeRequests)
        },
        {
          label: "Expected Result",
          value: "Update request volume, latency, memory, and status counters"
        }
      ],
      actionLabel: "Apply Suggestion",
      actionPayload: { opsCommand: "refreshMetrics" }
    });

    return items;
  }

  get localDemoAccessItems(): RecordCollectionItem[] {
    const config = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    )?.runtimeConfig;
    if (!config?.environment.firstSliceBootstrapDemo) {
      return [];
    }

    return [
      {
        headline: "Local demo is ready",
        subline: `${localDemoAccess.tenantKey} / ${localDemoAccess.workspaceKey}`,
        badges: ["demo bootstrap", config.storage.kind],
        rows: [
          {
            label: "Admin",
            value: `${localDemoAccess.adminUsername} / ${localDemoAccess.adminPassword}`
          },
          {
            label: "Participant",
            value: localDemoAccess.participantPath,
            href: localDemoAccess.participantPath
          },
          {
            label: "Login Key",
            value: localDemoAccess.participantLoginKey
          }
        ],
        actionLabel: "Sign In Demo Admin",
        actionPayload: { demoCommand: "signInLocalDemoAdmin" }
      }
    ];
  }

  runLocalDemoAccessAction(item: RecordCollectionItem): void {
    if (item.actionPayload?.demoCommand === "signInLocalDemoAdmin") {
      this.signInLocalDemoAdmin();
    }
  }

  runOpsSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.opsCommand) {
      case "refreshMetrics":
        this.refreshMetrics();
        break;
      case "refreshDiagnostics":
      default:
        this.refreshDiagnostics();
        break;
    }
  }

  get readinessItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const healthStatus = readStringValue(health, ["health", "status"]) ?? "unknown";
    const readinessStatus = readStringValue(health, ["readiness", "status"]) ?? "unknown";
    const buildCommit =
      readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a";

    return [
      {
        headline: readinessStatus,
        subline: `health ${healthStatus}`,
        badges: [this.ops.storageKind, `schema ${this.ops.storageSchemaVersion}`],
        rows: [
          { label: "Build Commit", value: buildCommit },
          {
            label: "Build Timestamp",
            value: readStringValue(health, ["manifest", "build", "builtAt"]) ?? "n/a"
          }
        ]
      }
    ];
  }

  get runtimeSurfaceItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const healthStatus = readStringValue(health, ["health", "status"]) ?? "unknown";
    const readinessStatus = readStringValue(health, ["readiness", "status"]) ?? "unknown";
    const phase = readStringValue(health, ["manifest", "phase"]) ?? "unknown";
    const storageKind =
      readStringValue(health, ["manifest", "storage", "kind"]) ?? this.ops.storageKind;
    const storageSchemaVersion =
      readStringValue(health, ["manifest", "storage", "schemaVersion"]) ??
      String(this.ops.storageSchemaVersion);
    const routeGroups = readStringValue(health, ["manifest", "routes"]) ?? "n/a";

    return [
      {
        headline: phase,
        subline: `health ${healthStatus} · readiness ${readinessStatus}`,
        badges: [storageKind, `schema ${storageSchemaVersion}`],
        rows: [
          {
            label: "Route Groups",
            value: routeGroups
          },
          {
            label: "Build Commit",
            value: readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a"
          },
          {
            label: "Build Timestamp",
            value: readStringValue(health, ["manifest", "build", "builtAt"]) ?? "n/a"
          }
        ]
      }
    ];
  }

  get buildIdentityItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const phase = readStringValue(health, ["manifest", "phase"]) ?? "unknown";
    const buildCommit =
      readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a";
    const buildTimestamp =
      readStringValue(health, ["manifest", "build", "builtAt"]) ?? "n/a";

    return [
      {
        headline: buildCommit,
        subline: phase,
        badges: [this.ops.storageKind, `schema ${this.ops.storageSchemaVersion}`],
        rows: [
          {
            label: "Build Timestamp",
            value: buildTimestamp
          },
          {
            label: "Readiness",
            value: this.ops.readinessBadge
          }
        ]
      }
    ];
  }

  get manifestCapabilityItems(): RecordCollectionItem[] {
    const manifest = parseJsonDocument<RuntimeHealthPayload>(
      this.ops.runtimeHealthView
    )?.manifest;
    const capabilities = manifest?.capabilities ?? [];
    if (capabilities.length === 0) {
      return [];
    }

    const groupedCapabilities = capabilities.reduce<Record<string, string[]>>(
      (groups, capability) => {
        const groupName = this.capabilityGroupName(capability);
        groups[groupName] = [...(groups[groupName] ?? []), capability];
        return groups;
      },
      {}
    );

    return Object.entries(groupedCapabilities)
      .sort(
        (left, right) =>
          right[1].length - left[1].length || left[0].localeCompare(right[0])
      )
      .map(([groupName, groupCapabilities]) => ({
        headline: groupName,
        subline: `${groupCapabilities.length} capability(s)`,
        badges: groupCapabilities.slice(0, 3).map(capability =>
          this.humanizeKey(capability)
        ),
        rows: [
          {
            label: "Capabilities",
            value: groupCapabilities.map(capability => this.humanizeKey(capability)).join(", ")
          },
          {
            label: "Manifest Coverage",
            value: `${capabilities.length} total advertised capability(s)`
          }
        ]
      }));
  }

  get manifestRouteGroupItems(): RecordCollectionItem[] {
    const manifest = parseJsonDocument<RuntimeHealthPayload>(
      this.ops.runtimeHealthView
    )?.manifest;
    const routeGroups = manifest?.routes ?? {};

    return Object.entries(routeGroups)
      .sort(([leftGroup], [rightGroup]) => leftGroup.localeCompare(rightGroup))
      .map(([groupName, routes]) => {
        const routeNames = this.flattenRouteNames(routes);
        const listedRouteNames = routeNames.slice(0, 8);
        const hiddenRouteCount = Math.max(
          routeNames.length - listedRouteNames.length,
          0
        );
        return {
          headline: this.humanizeKey(groupName),
          subline: `${this.countRouteLeaves(routes)} route(s)`,
          badges: routeNames.slice(0, 3).map(routeName => this.humanizeKey(routeName)),
          rows: [
            {
              label: "Route Names",
              value: listedRouteNames.map(routeName => this.humanizeKey(routeName)).join(", ")
            },
            {
              label: "Total Routes",
              value: String(routeNames.length)
            },
            {
              label: "Listed Routes",
              value: String(listedRouteNames.length)
            },
            {
              label: "Hidden Routes",
              value: String(hiddenRouteCount)
            },
            {
              label: "Raw Group",
              value: groupName
            }
          ]
        } satisfies RecordCollectionItem;
      });
  }

  get lifecycleItems(): RecordCollectionItem[] {
    const diagnostics = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    const runtime = diagnostics?.runtime;
    if (!runtime) {
      return [];
    }

    return [
      {
        headline: runtime.lifecycle.phase,
        subline: `${runtime.uptimeSeconds.toFixed(1)}s uptime`,
        badges: [
          `${runtime.activeRequests} active`,
          `${runtime.completedRequests} completed`
        ],
        rows: [
          {
            label: "Started",
            value: this.formatDateTime(runtime.startedAt)
          },
          {
            label: "Shutdown Requested",
            value: runtime.lifecycle.shutdownRequestedAt
              ? this.formatDateTime(runtime.lifecycle.shutdownRequestedAt)
              : "no"
          },
          {
            label: "Total Requests",
            value: String(runtime.totalRequests)
          }
        ]
      }
    ];
  }

  get runtimeDiagnosticsItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    return (
      payload?.recentEvents.map(event => ({
        headline: event.event,
        subline: this.formatDateTime(event.occurredAt),
        badges: [event.level],
        rows: Object.entries(event.details).map(([key, value]) => ({
          label: this.humanizeKey(key),
          value: this.stringifyValue(value)
        }))
      })) ?? []
    );
  }

  get operationalEventSummaryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    if (!payload) {
      return [];
    }

    const infoCount = payload.recentEvents.filter(event => event.level === "info").length;
    const errorCount = payload.recentEvents.filter(event => event.level === "error").length;
    const latestEvent = payload.recentEvents[0];

    return [
      {
        headline: latestEvent?.event ?? "no events",
        subline: latestEvent ? this.formatDateTime(latestEvent.occurredAt) : "n/a",
        badges: [`${infoCount} info`, `${errorCount} error`],
        rows: [
          {
            label: "Recent Event Count",
            value: String(payload.recentEvents.length)
          },
          {
            label: "Latest Level",
            value: latestEvent?.level ?? "n/a"
          },
          {
            label: "Storage",
            value: payload.storage.kind
          }
        ]
      }
    ];
  }

  get runtimeConfigItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    );
    const config = payload?.runtimeConfig;
    if (!config) {
      return [];
    }

    return [
      {
        headline: config.storage.kind,
        subline: `port ${config.port}`,
        badges: [
          `schema ${config.storage.schemaVersion ?? "n/a"}`,
          `drain ${config.shutdownDrainDelayMs}ms`
        ],
        rows: [
          {
            label: "Location",
            value: config.storage.location ?? "in-memory"
          },
          {
            label: "Build Sha Present",
            value: config.environment.appBuildShaPresent ? "yes" : "no"
          },
          {
            label: "Build Timestamp Present",
            value: config.environment.appBuildTimestampPresent ? "yes" : "no"
          },
          {
            label: "Operator Auth Required",
            value: config.operatorAuthRequired ? "yes" : "no"
          },
          {
            label: "Participant Login Sink",
            value: `${config.participantLoginProtection.maxFailures} failures / ${config.participantLoginProtection.failureWindowMs}ms`
          },
          {
            label: "JSON Body Limit",
            value: `${config.maxJsonBodyBytes} bytes`
          },
          {
            label: "Source Package JSON Limit",
            value: `${config.maxSourcePackageJsonBodyBytes} bytes`
          },
          {
            label: "HTTP Timeouts",
            value: `headers ${config.httpTimeouts.headersTimeoutMs}ms, request ${config.httpTimeouts.requestTimeoutMs}ms, keep-alive ${config.httpTimeouts.keepAliveTimeoutMs}ms`
          },
          {
            label: "Postgres Url Present",
            value: config.environment.firstSlicePostgresUrlPresent ? "yes" : "no"
          }
        ]
      }
    ];
  }

  get processMetricsItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    if (!payload) {
      return [];
    }

    return [
      {
        headline: payload.runtime.lifecycle.phase,
        subline: `uptime ${payload.runtime.uptimeSeconds.toFixed(1)}s`,
        badges: [
          `${payload.runtime.activeRequests} active`,
          `${payload.runtime.completedRequests} completed`
        ],
        rows: [
          {
            label: "Total Requests",
            value: String(payload.runtime.totalRequests)
          },
          {
            label: "RSS Memory",
            value: this.formatMiB(payload.memory.rssBytes)
          },
          {
            label: "Heap Used",
            value: this.formatMiB(payload.memory.heapUsedBytes)
          },
          {
            label: "Heap Total",
            value: this.formatMiB(payload.memory.heapTotalBytes)
          }
        ]
      }
    ];
  }

  get requestMethodItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    return this.mapCounterItems(
      payload?.requestCountsByMethod,
      "method",
      value => [`${value} request(s)`]
    );
  }

  get requestRouteItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    if (!payload) {
      return [];
    }

    return Object.entries(payload.requestCountsByRoute)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([route, count]) => {
        const latency = payload.requestLatencyByRoute[route];
        const averageLatencyMs =
          latency && latency.count > 0 ? (latency.totalMs / latency.count).toFixed(1) : "n/a";
        return {
          headline: route,
          subline: `${count} request(s)`,
          badges: latency ? [`max ${latency.maxMs.toFixed(1)}ms`] : [],
          rows: [
            {
              label: "Average Latency",
              value: averageLatencyMs === "n/a" ? averageLatencyMs : `${averageLatencyMs}ms`
            },
            {
              label: "Samples",
              value: latency ? String(latency.count) : "0"
            }
          ]
        } satisfies RecordCollectionItem;
      });
  }

  get routeLatencyBucketItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    if (!payload) {
      return [];
    }

    return Object.entries(payload.requestLatencyByRoute)
      .sort((left, right) => right[1].maxMs - left[1].maxMs || left[0].localeCompare(right[0]))
      .map(([route, latency]) => {
        const bucketSummary = Object.entries(latency.bucketCounts)
          .filter(([, count]) => count > 0)
          .slice(0, 4)
          .map(([bucket, count]) => `${bucket}ms:${count}`)
          .join(" · ");

        return {
          headline: route,
          subline: `${latency.count} sample(s)`,
          badges: [
            `avg ${(latency.totalMs / Math.max(latency.count, 1)).toFixed(1)}ms`,
            `max ${latency.maxMs.toFixed(1)}ms`
          ],
          rows: [
            {
              label: "Latency Buckets",
              value: bucketSummary || "none"
            },
            {
              label: "Total Time",
              value: `${latency.totalMs.toFixed(1)}ms`
            }
          ]
        } satisfies RecordCollectionItem;
      });
  }

  get responseStatusItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    return this.mapCounterItems(
      payload?.responseCountsByStatusCode,
      "status",
      value => [`${value} response(s)`]
    );
  }

  get errorCountItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    return this.mapCounterItems(payload?.errorCounts, "error", value => [
      value > 0 ? "attention" : "clear"
    ]);
  }

  get operationalCards(): SummaryCard[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const metrics = parseJsonDocument(this.ops.runtimeMetricsView);

    const lifecycle = readStringValue(metrics, ["runtime", "lifecycle"]) ?? "unknown";
    const uptimeSeconds =
      readNumberValue(metrics, ["runtime", "uptimeSeconds"]) ?? null;
    const completedRequests =
      readNumberValue(metrics, ["runtime", "completedRequests"]) ?? 0;
    const totalRequests =
      readNumberValue(metrics, ["runtime", "totalRequests"]) ?? 0;
    const activeRequests =
      readNumberValue(metrics, ["runtime", "activeRequests"]) ?? 0;
    const rssBytes = readNumberValue(metrics, ["memory", "rssBytes"]) ?? 0;
    const buildCommit =
      readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a";

    return [
      {
        label: "Readiness",
        headline: this.ops.readinessBadge,
        detail: `${this.ops.storageKind} schema ${this.ops.storageSchemaVersion}`
      },
      {
        label: "Lifecycle",
        headline: lifecycle,
        detail:
          uptimeSeconds == null
            ? `Build ${buildCommit}`
            : `${uptimeSeconds.toFixed(1)}s uptime · build ${buildCommit}`
      },
      {
        label: "Requests",
        headline: String(completedRequests),
        detail: `${activeRequests} active · ${totalRequests} total`
      },
      {
        label: "Memory",
        headline: this.formatMiB(rssBytes),
        detail: "Resident set size"
      }
    ];
  }

  private formatMiB(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }

  private mapCounterItems(
    counters: Record<string, number> | undefined,
    label: string,
    badgeFactory: (value: number) => string[]
  ): RecordCollectionItem[] {
    return Object.entries(counters ?? {})
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([key, value]) => ({
        headline: key,
        subline: `${label} counter`,
        badges: badgeFactory(value),
        rows: [
          {
            label: "Count",
            value: String(value)
          }
        ]
      }));
  }

  private formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  private buildReadWindowItem(
    headline: string,
    recordLabel: string,
    loadedCount: number,
    limit: string,
    activeFilters: string[]
  ): RecordCollectionItem {
    return {
      headline,
      subline: `${loadedCount} ${recordLabel} row(s) loaded for the current filters`,
      badges: [`${activeFilters.length} active filter(s)`, `limit ${limit}`],
      rows: [
        { label: "Loaded Records", value: String(loadedCount) },
        { label: "Limit", value: limit },
        {
          label: "Active Filters",
          value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
        }
      ]
    };
  }

  private humanizeKey(value: string): string {
    return value
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(/^\w/, firstCharacter => firstCharacter.toUpperCase());
  }

  private capabilityGroupName(capability: string): string {
    if (capability.startsWith("admin_")) {
      return "Admin Control";
    }
    if (
      capability.startsWith("source_") ||
      capability.startsWith("import_") ||
      capability.startsWith("content_")
    ) {
      return "Content Release";
    }
    if (
      capability.startsWith("participant_") ||
      capability.startsWith("test_run_")
    ) {
      return "Participant Runtime";
    }
    if (capability.startsWith("workspace_") || capability.startsWith("tenant_")) {
      return "Workspace Setup";
    }
    if (capability.startsWith("study_") || capability.startsWith("monitor_")) {
      return "Monitoring";
    }
    if (
      capability.startsWith("response_") ||
      capability.startsWith("review_") ||
      capability.startsWith("log_") ||
      capability.startsWith("result_") ||
      capability.startsWith("detailed_")
    ) {
      return "Operator Reads";
    }
    if (capability.startsWith("system_") || capability.startsWith("frontend_")) {
      return "Runtime Surface";
    }
    return "Other";
  }

  private countRouteLeaves(value: unknown): number {
    if (typeof value === "string") {
      return 1;
    }
    if (!value || typeof value !== "object") {
      return 0;
    }
    return Object.values(value).reduce(
      (total, child) => total + this.countRouteLeaves(child),
      0
    );
  }

  private flattenRouteNames(value: unknown): string[] {
    if (!value || typeof value !== "object") {
      return [];
    }
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === "string" ? [key] : this.flattenRouteNames(child)
    );
  }

  private describeAdminRoleTarget(): string {
    const role = this.ops.adminRoleRole;
    if (role === "platform_admin") {
      return role;
    }
    if (role === "tenant_admin") {
      return `${role} / ${this.ops.adminRoleTenantKey.trim() || "missing tenant"}`;
    }
    return [
      role,
      this.ops.adminRoleAccessMode,
      this.ops.adminRoleTenantKey.trim() || "missing tenant",
      this.ops.adminRoleWorkspaceKey.trim() || "missing workspace",
      ...(role === "group_monitor"
        ? [this.ops.adminRoleGroupKey.trim() || "missing group"]
        : [])
    ].join(" / ");
  }

  private isScopedAdminRoleInputComplete(
    role: AdminRole,
    tenantKey: string,
    workspaceKey: string,
    groupKey: string
  ): boolean {
    if (role === "platform_admin") {
      return true;
    }

    if (role === "tenant_admin") {
      return tenantKey.trim() !== "";
    }

    if (role === "group_monitor") {
      return (
        tenantKey.trim() !== "" &&
        workspaceKey.trim() !== "" &&
        groupKey.trim() !== ""
      );
    }

    return tenantKey.trim() !== "" && workspaceKey.trim() !== "";
  }

  private async loadApplicationSettingsDraft(force = false): Promise<void> {
    const settings =
      force || !this.applicationSettings.loaded()
        ? await this.applicationSettings.load()
        : this.applicationSettings.settings();
    this.applyApplicationSettingsDraft(settings);
  }

  private async loadApplicationAssetsIfAllowed(): Promise<void> {
    if (this.canManageApplicationSettings) {
      await this.applicationAssets.load(
        this.ops.adminSessionToken.trim()
      );
    }
  }

  private applyApplicationSettingsDraft(settings: ApplicationSettings): void {
    this.applicationTitleDraft = settings.appTitle;
    this.applicationLogoDraft = settings.mainLogo;
    this.applicationLogoDraftError = "";
    this.applicationThemeDraft = settings.themeName;
    this.applicationIntroHtmlDraft = settings.introHtml;
    this.applicationLegalNoticeHtmlDraft = settings.legalNoticeHtml;
    this.applicationCustomTextDrafts = { ...settings.customTexts };
    this.applicationAssetAssignmentsDraft = { ...settings.assetAssignments };
    this.applicationCustomTextNewKey = "";
    this.applicationCustomTextNewValue = "";
    this.applicationWarningTextDraft = settings.globalWarningText ?? "";
    this.applicationWarningExpiresAtDraft = settings.globalWarningExpiresAt
      ? this.toLocalDateTimeInput(settings.globalWarningExpiresAt)
      : "";
  }

  private normalizedApplicationCustomTexts(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(this.applicationCustomTextDrafts).flatMap(([key, value]) => {
        const normalizedKey = key.trim();
        const normalizedValue = value.trim();
        return normalizedKey && normalizedValue
          ? [[normalizedKey, normalizedValue] as const]
          : [];
      })
    );
  }

  private normalizedApplicationAssetAssignments(): ApplicationSettings["assetAssignments"] {
    return Object.fromEntries(
      Object.entries(this.applicationAssetAssignmentsDraft).flatMap(
        ([slot, originalName]) =>
          originalName?.trim()
            ? [[slot, originalName.trim()] as const]
            : []
      )
    ) as ApplicationSettings["assetAssignments"];
  }

  private toLocalDateTimeInput(timestamp: string): string {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) {
      return "";
    }
    const component = (value: number): string => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${component(date.getMonth() + 1)}-${component(
      date.getDate()
    )}T${component(date.getHours())}:${component(date.getMinutes())}`;
  }

  private stringifyValue(value: unknown): string {
    if (value == null) {
      return "null";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
}
