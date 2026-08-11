import { ApplicationRef, Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";

import {
  formatMonitorCustomText,
  mergeMonitorCustomTextScopes,
  mapOriginalTestcenterOperationalLoginToAdminRole,
  filterOpenMonitorRunsByProfile,
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText,
  resolveOpenMonitorRunSuperState,
  resolveMonitorCustomText,
  type MonitorCustomTextKey
} from "@testcenter-rewrite-app/contracts";
import type {
  GetParticipantSessionResponse,
  ImportParticipantRosterResponse,
  ListDetailedResponsesResponse,
  ListGroupResultsResponse,
  ListReviewsResponse,
  ListParticipantRosterResponse,
  ListParticipantSessionsResponse,
  ListWorkspaceActivityEventsResponse,
  MonitorOpenRunsResponse,
  ParsedParticipantRosterEntry,
  ParticipantCurrentRunStateResponse,
  ParticipantRuntimeStateResponse
} from "@testcenter-rewrite-app/contracts";
import {
  participantSessionStatuses,
  testRunStatuses
} from "@testcenter-rewrite-app/domain";
import type {
  MonitorViewProfile,
  OpenMonitorRun
} from "@testcenter-rewrite-app/domain";

import type {
  RecordCollectionDensity,
  RecordCollectionItem,
  RecordCollectionRow
} from "./record-collection.component";
import type { SummaryCard } from "./rewrite-app-shell.types";
import {
  parseJsonDocument,
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";
import { downloadTextFile } from "./download-text-file";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { ApplicationSettingsService } from "./application-settings.service";
import { ConfirmationDialogService } from "./confirmation-dialog.service";
import {
  buildParticipantEntryUrl,
  participantSessionLinkRows
} from "./participant-session-links";

type RuntimePlayerPreview = {
  hasRun: boolean;
  bookletLabel: string;
  unitLabel: string;
  unitKey: string;
  unitResponse: string;
  runStatus: string;
  runId: string;
  availableActions: string[];
  hint: string;
  canSaveProgress: boolean;
  canResume: boolean;
  canComplete: boolean;
  saveProgressLabel: string;
};

type RuntimeEntryLink = {
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  displayName?: string;
  url: string;
};

type MonitorBlockNavigationTarget = NonNullable<
  OpenMonitorRun["blockNavigationTargets"]
>[number];

type MonitorDisplayColumn =
  | "groupColumn"
  | "bookletColumn"
  | "blockColumn"
  | "unitColumn";

type MonitorDisplaySettings = Record<MonitorDisplayColumn, "show" | "hide"> & {
  view: RecordCollectionDensity;
  bookletStatesColumns: string[];
};

type MonitorStatusFilter = "pending" | "locked";

type MonitorSortDirection = "asc" | "desc";

type MonitorSortKey =
  | "state"
  | "group"
  | "participant"
  | "booklet"
  | "block"
  | "activity"
  | "unit"
  | `bookletState:${string}`;

type MonitorFilterOverride = {
  profileId: string;
  enabledProfileFilterIndexes: Set<number>;
  pending: boolean;
  locked: boolean;
};

type MonitorCustomFilter = {
  customFilterId: string;
  scopeId: string;
  filter: MonitorViewProfile["filters"][number];
  active: boolean;
};

const monitorFilterTargetTextKeys: Readonly<
  Record<string, MonitorCustomTextKey>
> = {
  personLabel: "gm_col_personLabel",
  state: "gm_col_state",
  groupName: "gm_filter_target_groupName",
  bookletLabel: "gm_col_bookletLabel",
  bookletId: "gm_filter_target_bookletId",
  bookletSpecies: "gm_filter_target_bookletSpecies",
  blockLabel: "gm_col_blockLabel",
  blockId: "gm_filter_target_blockId",
  unitLabel: "gm_col_unitLabel",
  unitId: "gm_filter_target_unitId",
  mode: "gm_filter_target_mode",
  testState: "gm_filter_target_testState",
  bookletStates: "gm_filter_target_bookletStates"
};

const monitorFilterTypeTextKeys: Readonly<
  Record<string, MonitorCustomTextKey>
> = {
  equal: "gm_filter_type_equal",
  substring: "gm_filter_type_substring",
  regex: "gm_filter_type_regex"
};

const monitorViewTextKeys: Readonly<Record<string, MonitorCustomTextKey>> = {
  full: "gm_view_full",
  large: "gm_view_full",
  medium: "gm_view_medium",
  middle: "gm_view_medium",
  small: "gm_view_small"
};

const monitorSuperStateSortOrder = [
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
] as const;

const monitorBookletErrorTextKeys: Readonly<
  Record<NonNullable<OpenMonitorRun["bookletError"]>, MonitorCustomTextKey>
> = {
  "missing-id": "gm_booklet_error_missing_id",
  "missing-file": "gm_booklet_error_missing_file",
  xml: "gm_booklet_error_xml",
  general: "gm_booklet_error_general"
};

@Injectable({ providedIn: "root" })
export class RuntimeViewFacade {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly router = inject(Router);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private readonly applicationSettings = inject(ApplicationSettingsService);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly monitorBatchSelection = new Set<string>();
  private readonly monitorCustomFilters: MonitorCustomFilter[] = [];
  private monitorCustomFilterSequence = 0;
  monitorAutoSelectAll = false;
  monitorControlsVisible = true;
  monitorBookletListExpanded = true;
  monitorQuickFilter = "";
  monitorSortKey: MonitorSortKey = "participant";
  monitorSortDirection: MonitorSortDirection = "asc";
  monitorCustomFilterTarget = "personLabel";
  monitorCustomFilterType = "equal";
  monitorCustomFilterValue = "";
  monitorCustomFilterSubValue = "";
  monitorCustomFilterLabel = "";
  monitorCustomFilterNot = false;
  monitorCustomFilterEditingId = "";
  private monitorDisplayOverride: {
    profileId: string;
    settings: MonitorDisplaySettings;
  } | null = null;
  private monitorFilterOverride: MonitorFilterOverride | null = null;
  private selectedMonitorBlockNavigationTargets: NonNullable<
    OpenMonitorRun["blockNavigationTargets"]
  > = [];
  private readonly resultGroupSelection = new Set<string>();
  private resultGroupSelectionScope = "";

  readonly runtime = this.uiState.runtime;
  readonly workspace = this.uiState.workspace;
  readonly participantSessionStatusOptions = participantSessionStatuses;
  readonly testRunStatusOptions = testRunStatuses;

  get isMonitorOnlySession(): boolean {
    return this.operatorAccess.isMonitorOnly;
  }

  get operatorAccessLabel(): string {
    return this.operatorAccess.label;
  }

  get monitorProfiles(): MonitorViewProfile[] {
    return this.operatorAccess.monitorProfiles;
  }

  private get effectiveMonitorCustomTexts(): Record<string, string> {
    return mergeMonitorCustomTextScopes(
      this.applicationSettings.settings().customTexts,
      this.operatorAccess.customTexts
    );
  }

  monitorText(key: MonitorCustomTextKey, fallback?: string): string {
    return resolveMonitorCustomText(
      this.effectiveMonitorCustomTexts,
      key,
      fallback
    );
  }

  monitorFormattedText(
    key: MonitorCustomTextKey,
    replacements: ReadonlyArray<string | number>,
    fallback?: string
  ): string {
    return formatMonitorCustomText(
      this.effectiveMonitorCustomTexts,
      key,
      replacements,
      fallback
    );
  }

  get monitorProfilePresentation(): string {
    const profile = this.activeMonitorProfile;
    if (!profile) {
      const statusFilters = ["pending", "locked"] as const;
      const activeStatusFilters = statusFilters.filter(filter =>
        this.monitorStatusFilterActive(filter)
      );
      return `${this.monitorText("gm_settings_tooltip")}: ${this.monitorText("gm_view_full")}. ${this.monitorText("gm_menu_filter")}: ${activeStatusFilters.length > 0 ? activeStatusFilters.map(filter => this.monitorText(filter === "pending" ? "gm_filter_pending" : "gm_filter_locked")).join(" | ") : this.monitorText("gm_selection_info_none")}`;
    }
    const viewKey = monitorViewTextKeys[profile.settings.view];
    const viewLabel = viewKey
      ? this.monitorText(viewKey)
      : profile.settings.view;
    const filters = profile.filters.map(
      (filter, index) =>
        `${this.monitorProfileFilterLabel(filter)}: ${this.monitorProfileFilterActive(index) ? "✓" : "—"}`
    );
    const statusFilters = [
      `${this.monitorText("gm_filter_pending")}: ${this.monitorStatusFilterActive("pending") ? "✓" : "—"}`,
      `${this.monitorText("gm_filter_locked")}: ${this.monitorStatusFilterActive("locked") ? "✓" : "—"}`
    ];
    return `${this.monitorText("gm_settings_tooltip")}: ${viewLabel}. ${this.monitorText("gm_menu_filter")}: ${[...statusFilters, ...filters].join(" | ")}`;
  }

  get activeMonitorProfile(): MonitorViewProfile | null {
    const profiles = this.monitorProfiles;
    if (profiles.length === 0) {
      return null;
    }
    return (
      profiles.find(profile => profile.profileId === this.runtime.monitorProfileId) ??
      profiles[0] ??
      null
    );
  }

  get activeMonitorProfileId(): string {
    return this.activeMonitorProfile?.profileId ?? "";
  }

  get monitorProfileDetail(): string {
    const profile = this.activeMonitorProfile;
    if (!profile) {
      return "No imported monitor profile is assigned; all loaded runs remain visible.";
    }
    return `${profile.label || profile.profileId}: ${profile.settings.view} view, ${profile.filters.length} imported filter(s), next-block selection ${profile.settings.autoselectNextBlock === "yes" ? "automatic" : "manual"}.`;
  }

  get monitorProfileDensity(): RecordCollectionDensity {
    return this.monitorDisplaySettings.view;
  }

  get monitorProfileFilterOptions(): Array<{
    index: number;
    label: string;
    active: boolean;
  }> {
    return (this.activeMonitorProfile?.filters ?? []).map((filter, index) => ({
      index,
      label: this.monitorProfileFilterLabel(filter),
      active: this.monitorProfileFilterActive(index)
    }));
  }

  get monitorCustomFilterTargetOptions(): Array<{
    value: string;
    label: string;
  }> {
    return Object.keys(monitorFilterTargetTextKeys).map(value => ({
      value,
      label: this.monitorText(monitorFilterTargetTextKeys[value]!)
    }));
  }

  get monitorCustomFilterTypeOptions(): Array<{
    value: string;
    label: string;
  }> {
    return Object.keys(monitorFilterTypeTextKeys).map(value => ({
      value,
      label: this.monitorText(monitorFilterTypeTextKeys[value]!)
    }));
  }

  get monitorCustomFilterRequiresSubValue(): boolean {
    return ["testState", "bookletStates"].includes(
      this.monitorCustomFilterTarget
    );
  }

  get monitorCustomFilterOptions(): Array<{
    customFilterId: string;
    label: string;
    active: boolean;
  }> {
    return this.currentMonitorCustomFilters.map(customFilter => ({
      customFilterId: customFilter.customFilterId,
      label: this.monitorProfileFilterLabel(customFilter.filter),
      active: customFilter.active
    }));
  }

  get canSaveMonitorCustomFilter(): boolean {
    if (
      this.currentMonitorCustomFilters.length >= 50 &&
      !this.monitorCustomFilterEditingId
    ) {
      return false;
    }
    const value = this.monitorCustomFilterValue.trim();
    if (!value) {
      return false;
    }
    if (this.monitorCustomFilterTarget === "state") {
      const stateValues = value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
      if (
        stateValues.length === 0 ||
        !stateValues.every(item =>
          (monitorSuperStateSortOrder as readonly string[]).includes(item)
        )
      ) {
        return false;
      }
    }
    if (
      this.monitorCustomFilterRequiresSubValue &&
      !this.monitorCustomFilterSubValue.trim()
    ) {
      return false;
    }
    if (this.monitorCustomFilterType === "regex") {
      try {
        new RegExp(value);
      } catch {
        return false;
      }
    }
    return true;
  }

  setMonitorCustomFilterTarget(target: string): void {
    if (!(target in monitorFilterTargetTextKeys)) {
      return;
    }
    this.monitorCustomFilterTarget = target;
    if (target === "state") {
      this.monitorCustomFilterType = "equal";
    }
    if (!["testState", "bookletStates"].includes(target)) {
      this.monitorCustomFilterSubValue = "";
    }
  }

  saveMonitorCustomFilter(): void {
    if (!this.canSaveMonitorCustomFilter) {
      return;
    }
    const value = this.monitorCustomFilterValue.trim();
    const filter: MonitorViewProfile["filters"][number] = {
      target: this.monitorCustomFilterTarget,
      value:
        this.monitorCustomFilterTarget === "state"
          ? value
              .split(",")
              .map(item => item.trim())
              .filter(Boolean)
          : value,
      subValue: this.monitorCustomFilterRequiresSubValue
        ? this.monitorCustomFilterSubValue.trim()
        : null,
      label: this.monitorCustomFilterLabel.trim(),
      type:
        this.monitorCustomFilterTarget === "state"
          ? "equal"
          : this.monitorCustomFilterType,
      not: this.monitorCustomFilterNot
    };
    const editing = this.currentMonitorCustomFilters.find(
      customFilter =>
        customFilter.customFilterId === this.monitorCustomFilterEditingId
    );
    if (editing) {
      editing.filter = filter;
      editing.active = true;
    } else {
      this.monitorCustomFilters.push({
        customFilterId:
          `monitor-custom-filter-${++this.monitorCustomFilterSequence}`,
        scopeId: this.monitorCustomFilterScopeId,
        filter,
        active: true
      });
    }
    this.resetMonitorCustomFilterDraft();
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  editMonitorCustomFilter(customFilterId: string): void {
    const customFilter = this.currentMonitorCustomFilters.find(
      candidate => candidate.customFilterId === customFilterId
    );
    if (!customFilter) {
      return;
    }
    this.monitorCustomFilterEditingId = customFilter.customFilterId;
    this.monitorCustomFilterTarget = customFilter.filter.target;
    this.monitorCustomFilterType = customFilter.filter.type;
    this.monitorCustomFilterValue = Array.isArray(customFilter.filter.value)
      ? customFilter.filter.value.join(", ")
      : customFilter.filter.value;
    this.monitorCustomFilterSubValue = customFilter.filter.subValue ?? "";
    this.monitorCustomFilterLabel = customFilter.filter.label;
    this.monitorCustomFilterNot = customFilter.filter.not;
  }

  cancelMonitorCustomFilterEdit(): void {
    this.resetMonitorCustomFilterDraft();
  }

  toggleMonitorCustomFilter(customFilterId: string): void {
    const customFilter = this.currentMonitorCustomFilters.find(
      candidate => candidate.customFilterId === customFilterId
    );
    if (!customFilter) {
      return;
    }
    customFilter.active = !customFilter.active;
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  removeMonitorCustomFilter(customFilterId: string): void {
    const index = this.monitorCustomFilters.findIndex(
      candidate =>
        candidate.scopeId === this.monitorCustomFilterScopeId &&
        candidate.customFilterId === customFilterId
    );
    if (index < 0) {
      return;
    }
    this.monitorCustomFilters.splice(index, 1);
    if (this.monitorCustomFilterEditingId === customFilterId) {
      this.resetMonitorCustomFilterDraft();
    }
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  monitorProfileFilterActive(index: number): boolean {
    const profile = this.activeMonitorProfile;
    if (!profile?.filters[index]) {
      return false;
    }
    return this.currentMonitorFilterState.enabledProfileFilterIndexes.has(index);
  }

  monitorStatusFilterActive(filter: MonitorStatusFilter): boolean {
    return this.currentMonitorFilterState[filter];
  }

  toggleMonitorProfileFilter(index: number): void {
    if (!this.activeMonitorProfile?.filters[index]) {
      return;
    }
    const state = this.editableMonitorFilterState();
    if (state.enabledProfileFilterIndexes.has(index)) {
      state.enabledProfileFilterIndexes.delete(index);
    } else {
      state.enabledProfileFilterIndexes.add(index);
    }
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  toggleMonitorStatusFilter(filter: MonitorStatusFilter): void {
    const state = this.editableMonitorFilterState();
    state[filter] = !state[filter];
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  resetMonitorRuntimeFilters(): void {
    this.monitorFilterOverride = null;
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  get monitorBlockNavigationTargets(): NonNullable<
    OpenMonitorRun["blockNavigationTargets"]
  > {
    return (
      this.selectedOpenMonitorRun?.blockNavigationTargets ??
      this.selectedMonitorBlockNavigationTargets
    );
  }

  get selectedMonitorTarget(): MonitorBlockNavigationTarget | null {
    return this.findMonitorTarget(this.selectedOpenMonitorRun);
  }

  get monitorSelectedTargetTimerText(): string {
    const target = this.selectedMonitorTarget;
    return target ? this.monitorTargetTimerText(target) : "";
  }

  monitorTargetTimerText(target: MonitorBlockNavigationTarget): string {
    if (target.timeMaxMinutes == null) {
      return "";
    }
    const timer = target.timer;
    if (!timer) {
      return this.monitorFormattedText("gm_timemax_tooltip", [
        this.formatMonitorMinutes(target.timeMaxMinutes)
      ]);
    }
    if (
      timer.status === "expired" ||
      timer.status === "cancelled" ||
      timer.remainingSeconds <= 0
    ) {
      return this.monitorText("gm_timeup_tooltip");
    }
    return this.monitorFormattedText("gm_timeleft_tooltip", [
      this.formatMonitorMinutes(timer.remainingSeconds / 60),
      this.formatMonitorMinutes(timer.durationSeconds / 60)
    ]);
  }

  get monitorColumnPresentation(): string {
    const settings = this.monitorDisplaySettings;
    const visibleColumns = [
      settings.groupColumn === "show"
        ? this.monitorText("gm_col_groupName")
        : "",
      settings.bookletColumn === "show"
        ? this.monitorText("gm_col_bookletLabel")
        : "",
      settings.blockColumn === "show"
        ? this.monitorText("gm_col_blockLabel")
        : "",
      settings.unitColumn === "show"
        ? this.monitorText("gm_col_unitLabel")
        : ""
    ].filter(Boolean);
    const stateColumns = settings.bookletStatesColumns;
    return `${this.monitorText("gm_menu_cols")}: ${visibleColumns.join(", ") || "—"}. ${this.monitorText("gm_menu_cols_states")}: ${stateColumns.join(", ") || "—"}.`;
  }

  get monitorAvailableBookletStateColumns(): string[] {
    return Array.from(
      new Set(
        this.visibleOpenMonitorRuns.flatMap(openRun =>
          Object.keys(openRun.bookletStates)
        )
      )
    ).sort((left, right) => left.localeCompare(right));
  }

  monitorDisplayColumnVisible(column: MonitorDisplayColumn): boolean {
    return this.monitorDisplaySettings[column] === "show";
  }

  monitorBookletStateColumnVisible(column: string): boolean {
    return this.monitorDisplaySettings.bookletStatesColumns.includes(column);
  }

  toggleMonitorDisplayColumn(column: MonitorDisplayColumn): void {
    const settings = this.editableMonitorDisplaySettings();
    settings[column] = settings[column] === "show" ? "hide" : "show";
    this.uiState.renderVersion.update(version => version + 1);
  }

  toggleMonitorBookletStateColumn(column: string): void {
    if (!this.monitorAvailableBookletStateColumns.includes(column)) {
      return;
    }
    const settings = this.editableMonitorDisplaySettings();
    settings.bookletStatesColumns = settings.bookletStatesColumns.includes(column)
      ? settings.bookletStatesColumns.filter(candidate => candidate !== column)
      : [...settings.bookletStatesColumns, column].sort((left, right) =>
          left.localeCompare(right)
        );
    this.uiState.renderVersion.update(version => version + 1);
  }

  selectMonitorDisplayDensity(view: RecordCollectionDensity): void {
    this.editableMonitorDisplaySettings().view = view;
    this.uiState.renderVersion.update(version => version + 1);
  }

  resetMonitorDisplayOptions(): void {
    this.monitorDisplayOverride = null;
    this.uiState.renderVersion.update(version => version + 1);
  }

  setMonitorQuickFilter(value: string): void {
    this.monitorQuickFilter = value;
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  clearMonitorQuickFilter(): void {
    this.setMonitorQuickFilter("");
  }

  get monitorSortOptions(): Array<{ key: MonitorSortKey; label: string }> {
    const settings = this.monitorDisplaySettings;
    return [
      { key: "state", label: "Status" },
      ...(settings.groupColumn === "show"
        ? [{ key: "group" as const, label: this.monitorText("gm_col_groupName") }]
        : []),
      { key: "participant", label: this.monitorText("gm_col_personLabel") },
      ...(settings.bookletColumn === "show"
        ? [{ key: "booklet" as const, label: this.monitorText("gm_col_bookletLabel") }]
        : []),
      ...(settings.blockColumn === "show"
        ? [{ key: "block" as const, label: this.monitorText("gm_col_blockLabel") }]
        : []),
      { key: "activity", label: this.monitorText("gm_col_state") },
      ...(settings.unitColumn === "show"
        ? [{ key: "unit" as const, label: this.monitorText("gm_col_unitLabel") }]
        : []),
      ...settings.bookletStatesColumns.map(stateKey => ({
        key: `bookletState:${stateKey}` as const,
        label: `${this.monitorText("gm_menu_cols_states")} ${stateKey}`
      }))
    ];
  }

  selectMonitorSortKey(value: string): void {
    const option = this.monitorSortOptions.find(candidate => candidate.key === value);
    if (!option) {
      return;
    }
    this.monitorSortKey = option.key;
    this.uiState.renderVersion.update(version => version + 1);
  }

  toggleMonitorSortDirection(): void {
    this.monitorSortDirection =
      this.monitorSortDirection === "asc" ? "desc" : "asc";
    this.uiState.renderVersion.update(version => version + 1);
  }

  resetMonitorSort(): void {
    this.monitorSortKey = "participant";
    this.monitorSortDirection = "asc";
    this.uiState.renderVersion.update(version => version + 1);
  }

  toggleMonitorControls(): void {
    this.monitorControlsVisible = !this.monitorControlsVisible;
  }

  get monitorBookletListVisible(): boolean {
    return this.operatorAccess.monitorBookletVisibility !== "hidden";
  }

  toggleMonitorBookletList(): void {
    this.monitorBookletListExpanded = !this.monitorBookletListExpanded;
  }

  scrollMonitorRunsIntoView(): void {
    globalThis.document
      ?.getElementById("openMonitorRunsCollection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private get selectedOpenMonitorRun(): OpenMonitorRun | null {
    const payload = parseJsonDocument<MonitorOpenRunsResponse>(
      this.runtime.openRunsView
    );
    return (
      payload?.items.find(
        openRun => openRun.testRunId === this.runtime.testRunId.trim()
      ) ?? null
    );
  }

  private get visibleOpenMonitorRuns(): OpenMonitorRun[] {
    const payload = parseJsonDocument<MonitorOpenRunsResponse>(
      this.runtime.openRunsView
    );
    const profileRuns = filterOpenMonitorRunsByProfile(
      payload?.items ?? [],
      this.effectiveMonitorProfile
    );
    const quickFilter = this.monitorQuickFilter.trim().toLocaleLowerCase();
    const filteredRuns = quickFilter
      ? profileRuns.filter(openRun =>
          (openRun.participantRosterEntry?.displayName ?? openRun.loginKey)
            .toLocaleLowerCase()
            .includes(quickFilter)
        )
      : profileRuns;
    return this.sortMonitorRuns(filteredRuns);
  }

  selectMonitorProfile(profileId: string): void {
    if (!this.monitorProfiles.some(profile => profile.profileId === profileId)) {
      return;
    }
    this.runtime.monitorProfileId = profileId;
    this.monitorDisplayOverride = null;
    this.monitorFilterOverride = null;
    this.monitorQuickFilter = "";
    this.resetMonitorCustomFilterDraft();
    this.monitorBatchSelection.clear();
    this.persistState();
    this.uiState.renderVersion.update(version => version + 1);
  }

  get monitorConnectionLabel(): string {
    switch (this.runtime.monitorConnectionStatus) {
      case "connecting":
        return "Connecting";
      case "live":
        return "Live";
      case "reconnecting":
        return "Reconnecting";
      case "polling":
        return "Polling fallback";
      case "offline":
        return "Offline";
      default:
        return "Inactive";
    }
  }

  get monitorConnectionLastEventLabel(): string {
    return this.runtime.monitorConnectionLastEventAt
      ? this.formatDateTime(this.runtime.monitorConnectionLastEventAt)
      : "waiting for first event";
  }

  get participantSessionsView(): string {
    return this.uiState.runtime.participantSessionsView;
  }

  get participantSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    if (!payload) {
      return [];
    }

    const activeFilters = [
      this.runtime.participantSessionStatusFilter.trim() ? "status" : "",
      this.runtime.participantSessionGroupFilter.trim() ? "group" : "",
      this.runtime.participantSessionLoginFilter.trim() ? "login" : "",
      this.runtime.participantSessionBookletFilter.trim() ? "booklet" : "",
      this.runtime.participantSessionReleaseFilter.trim() ? "release" : ""
    ].filter(Boolean);

    return [
      {
        headline: "Participant session window",
        subline: `${payload.items.length} session row(s) loaded for the current filters`,
        badges: [
          `${activeFilters.length} active filter(s)`,
          `limit ${this.runtime.participantSessionLimit}`
        ],
        rows: [
          { label: "Loaded Sessions", value: String(payload.items.length) },
          { label: "Limit", value: this.runtime.participantSessionLimit },
          {
            label: "Active Filters",
            value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
          }
        ]
      },
      ...payload.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;
        return {
          headline: displayName ?? item.participantSession.loginKey,
          subline: displayName
            ? item.participantSession.loginKey
            : item.participantSession.participantSessionId,
          badges: [
            item.participantSession.status,
            item.latestTestRun?.status ?? "no run",
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Session",
              value: item.participantSession.participantSessionId
            },
            ...participantSessionLinkRows(
              item.participantSession.participantSessionId,
              {
                tenantKey: this.uiState.workspace.tenantKey,
                workspaceKey: this.uiState.workspace.workspaceKey,
                loginKey: item.participantSession.loginKey,
                groupKey: item.participantSession.groupKey,
                bookletKey:
                  item.participantRosterEntry?.bookletKey ??
                  item.latestTestRun?.bookletKey
              }
            ),
            {
              label: "Group",
              value: item.participantSession.groupKey
            },
            {
              label: "Roster Booklet",
              value: item.participantRosterEntry?.bookletKey ?? "none"
            },
            {
              label: "Release",
              value:
                item.contentRelease?.releaseLabel ??
                item.participantSession.contentReleaseId
            },
            {
              label: "Created",
              value: this.formatDateTime(item.participantSession.createdAt)
            },
            {
              label: "Valid Until",
              value: item.participantSession.validUntil
                ? this.formatDateTime(item.participantSession.validUntil)
                : "unlimited"
            }
          ],
          selected:
            this.runtime.participantSessionId.trim() ===
            item.participantSession.participantSessionId,
          actionLabel: "Select + Load",
          actionPayload: {
            participantSessionId: item.participantSession.participantSessionId,
            loginKey: item.participantSession.loginKey,
            groupKey: item.participantSession.groupKey,
            bookletKey:
              item.participantRosterEntry?.bookletKey ??
              item.latestTestRun?.bookletKey ??
              "",
            displayName: displayName ?? ""
          }
        };
      })
    ];
  }

  get participantSessionDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    const detail = payload?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    return [
      {
        headline:
          detail.participantRosterEntry?.displayName ??
          detail.participantSession.loginKey,
        subline: detail.participantRosterEntry?.displayName
          ? detail.participantSession.loginKey
          : detail.participantSession.participantSessionId,
        badges: [
          detail.participantSession.status,
          detail.contentRelease?.status ?? "no release",
          `${detail.reviewCount ?? 0} review(s)`,
          detail.participantRosterEntry ? "roster" : "ad hoc"
        ],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          ...participantSessionLinkRows(
            detail.participantSession.participantSessionId,
            {
              tenantKey: this.uiState.workspace.tenantKey,
              workspaceKey: this.uiState.workspace.workspaceKey,
              loginKey: detail.participantSession.loginKey,
              groupKey: detail.participantSession.groupKey,
              bookletKey:
                detail.participantRosterEntry?.bookletKey ??
                detail.testRuns[0]?.bookletKey
            }
          ),
          {
            label: "Group",
            value: detail.participantSession.groupKey
          },
          {
            label: "Roster Booklet",
            value: detail.participantRosterEntry?.bookletKey ?? "none"
          },
          {
            label: "Release",
            value: detail.contentRelease?.releaseLabel ?? "none"
          },
          {
            label: "Runs",
            value: String(detail.testRuns.length)
          },
          {
            label: "Responses",
            value: String(detail.responseCount ?? 0)
          },
          {
            label: "Reviews",
            value: String(detail.reviewCount ?? 0)
          },
          {
            label: "Created",
            value: this.formatDateTime(detail.participantSession.createdAt)
          },
          {
            label: "Valid Until",
            value: detail.participantSession.validUntil
              ? this.formatDateTime(detail.participantSession.validUntil)
              : "unlimited"
          }
        ],
        selected:
          this.runtime.participantSessionId.trim() ===
          detail.participantSession.participantSessionId,
        actionLabel: "Select + Load",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey:
            detail.participantRosterEntry?.bookletKey ??
            detail.testRuns[0]?.bookletKey ??
            "",
          displayName: detail.participantRosterEntry?.displayName ?? ""
        }
      }
    ];
  }

  get entryLinkItems(): RecordCollectionItem[] {
    return this.parseEntryLinksView().map(link => ({
      headline: link.displayName || link.loginKey,
      subline: link.displayName ? link.loginKey : link.url,
      badges: [link.groupKey, link.bookletKey || "default booklet"],
      rows: [
        { label: "Login", value: link.loginKey },
        { label: "Group", value: link.groupKey },
        { label: "Booklet", value: link.bookletKey || "active release default" },
        { label: "Display Name", value: link.displayName || "none" },
        { label: "URL", value: link.url, href: link.url }
      ],
      selected: this.runtime.loginKey.trim() === link.loginKey,
      actionLabel: "Use Entry Link",
      actionPayload: {
        loginKey: link.loginKey,
        groupKey: link.groupKey,
        bookletKey: link.bookletKey,
        displayName: link.displayName ?? ""
      },
      actions: [
        {
          label: "Open Participant Entry",
          payload: {
            loginKey: link.loginKey,
            groupKey: link.groupKey,
            bookletKey: link.bookletKey,
            displayName: link.displayName ?? "",
            url: link.url
          }
        }
      ]
    }));
  }

  get entryLinkCards(): SummaryCard[] {
    const links = this.parseEntryLinksView();
    const explicitBookletCount = links.filter(link => link.bookletKey.trim()).length;
    const defaultBookletCount = Math.max(links.length - explicitBookletCount, 0);
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();

    return [
      {
        label: "Entry Links",
        headline: String(links.length),
        detail:
          links.length > 0
            ? "Participant start links are generated for this workspace."
            : "Generate links from roster rows or saved roster entries."
      },
      {
        label: "Scope",
        headline: workspaceKey || "No workspace",
        detail: tenantKey || "No tenant selected"
      },
      {
        label: "Booklets",
        headline: `${explicitBookletCount} explicit`,
        detail:
          defaultBookletCount > 0
            ? `${defaultBookletCount} use the active release default.`
            : "Every link carries an explicit booklet key."
      },
      {
        label: "CSV",
        headline: links.length > 0 ? "Ready" : "Not ready",
        detail:
          links.length > 0
            ? "Preview and download contain the current link set."
            : "CSV export will be populated after link generation."
      }
    ];
  }

  get participantLaunchpadCards(): SummaryCard[] {
    const rosterEntries = this.parseParticipantRosterView();
    const links = this.parseEntryLinksView();
    const inputEntries = this.parseEntryRosterRowsPreview();
    const sessions = this.parseParticipantSessionListView();
    const linkLogins = new Set(links.map(link => link.loginKey));
    const startedLinkedSessions = sessions.filter(item =>
      linkLogins.has(item.participantSession.loginKey)
    ).length;
    const notStartedLinks = Math.max(links.length - startedLinkedSessions, 0);

    return [
      {
        label: "Roster Entries",
        headline: String(rosterEntries.length),
        detail:
          rosterEntries.length > 0
            ? "Saved participants are available for entry-link generation."
            : "Load or import a roster before handing out links."
      },
      {
        label: "Input Preview",
        headline: String(inputEntries.length),
        detail:
          inputEntries.length > 0
            ? "Current roster text parses locally before import."
            : "Paste roster rows to preview parsed participants."
      },
      {
        label: "Generated Links",
        headline: String(links.length),
        detail:
          links.length > 0
            ? "Entry links are ready to open or export."
            : "Generate links from pasted rows or the saved roster."
      },
      {
        label: "Started Sessions",
        headline: String(startedLinkedSessions),
        detail:
          links.length > 0
            ? `${notStartedLinks} generated link(s) have no loaded session yet.`
            : "Refresh sessions after participants start."
      },
      {
        label: "Link CSV",
        headline: links.length > 0 ? "Ready" : "Pending",
        detail:
          links.length > 0
            ? "Download the current link set for distribution."
            : "CSV becomes available once links are generated."
      }
    ];
  }

  get participantLaunchpadActionItems(): RecordCollectionItem[] {
    const rosterEntries = this.parseParticipantRosterView();
    const inputEntries = this.parseEntryRosterRowsPreview();
    const links = this.parseEntryLinksView();
    const sessions = this.parseParticipantSessionListView();
    const items: RecordCollectionItem[] = [];

    if (inputEntries.length > 0) {
      items.push({
        headline: "Import current roster input",
        subline: `${inputEntries.length} parsed input row${inputEntries.length === 1 ? "" : "s"}`,
        badges: ["roster", "import"],
        rows: [
          {
            label: "Expected Result",
            value: "Parsed participants are persisted before link handoff"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "importRosterInput" }
      });
    }

    if (rosterEntries.length === 0) {
      items.push({
        headline: "Load saved participant roster",
        subline: "Use persisted roster rows for this workspace",
        badges: ["roster", "read"],
        rows: [
          {
            label: "Expected Result",
            value: "Saved participants appear and can be turned into entry links"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "loadRoster" }
      });
    }

    if (rosterEntries.length > 0 && links.length !== rosterEntries.length) {
      items.push({
        headline: "Generate links from saved roster",
        subline: `${rosterEntries.length} roster entr${rosterEntries.length === 1 ? "y" : "ies"}`,
        badges: ["entry links", "generate"],
        rows: [
          {
            label: "Expected Result",
            value: "Every saved participant receives a direct start URL"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "generateSavedRosterLinks" }
      });
    }

    if (links.length > 0) {
      items.push({
        headline: "Download participant entry links",
        subline: `${links.length} generated link${links.length === 1 ? "" : "s"}`,
        badges: ["csv", "handoff"],
        rows: [
          {
            label: "Expected Result",
            value: "Download a CSV that can be distributed to participants"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "downloadEntryLinks" }
      });
    }

    items.push({
      headline: "Refresh participant sessions",
      subline: `${sessions.length} loaded session${sessions.length === 1 ? "" : "s"}`,
      badges: ["sessions", "read"],
      rows: [
        {
          label: "Expected Result",
          value: "Started participants are reflected in the launchpad"
        }
      ],
      actionLabel: "Apply Suggestion",
      actionPayload: { launchpadCommand: "refreshSessions" }
    });

    return items;
  }

  get entryRosterPreviewItems(): RecordCollectionItem[] {
    const rosterText = this.runtime.entryRosterText.trim();
    if (rosterText.length === 0) {
      return [];
    }

    let entries: ParsedParticipantRosterEntry[];
    const operationalLoginCandidates =
      this.parseEntryOperationalLoginCandidatesPreview();
    try {
      entries = parseParticipantRosterText(rosterText);
    } catch (error) {
      return [
        {
          headline: "Roster input could not be parsed",
          subline: error instanceof Error ? error.message : "Unknown parser error",
          badges: ["local preview", "invalid"],
          rows: [
            {
              label: "Accepted Formats",
              value:
                "CSV/TSV/semicolon rows with alias headers, positional rows, XML, or JSON"
            }
          ]
        }
      ];
    }

    if (entries.length === 0 && operationalLoginCandidates.length > 0) {
      return [
        {
          headline: `${operationalLoginCandidates.length} operational login candidate${operationalLoginCandidates.length === 1 ? "" : "s"} detected`,
          subline:
            "Import will classify password-redacted monitor and system-check accounts without creating participant rows.",
          badges: ["local preview", "migration ready"],
          rows: [
            {
              label: "Password Safety",
              value:
                "Source passwords stay unavailable; every migrated account needs a newly assigned password."
            }
          ]
        },
        ...operationalLoginCandidates.slice(0, 5).map(candidate => ({
          headline: candidate.loginKey,
          subline: candidate.loginMode,
          badges: [
            candidate.groupKey ?? "group missing",
            candidate.passwordRequired ? "password protected" : "passwordless"
          ],
          rows: [
            { label: "Original Mode", value: candidate.loginMode },
            { label: "Original Group", value: candidate.groupKey ?? "none" },
            {
              label: "Migration",
              value:
                "Explicit non-escalating account mapping after successful import"
            }
          ]
        }))
      ];
    }

    if (entries.length === 0) {
      return [
        {
          headline: "No participant rows detected",
          subline: "The current text parsed successfully but did not contain participants.",
          badges: ["local preview", "empty"],
          rows: [
            {
              label: "Hint",
              value: "Add at least login and group columns or a Testtaker/JSON participant."
            }
          ]
        }
      ];
    }

    const previewEntries = entries.slice(0, 5);
    const remainingCount = Math.max(entries.length - previewEntries.length, 0);
    const items: RecordCollectionItem[] = [
      {
        headline: `${entries.length} participant row${entries.length === 1 ? "" : "s"} parsed`,
        subline: "Alias headers and canonical columns are normalized before import.",
        badges: ["local preview", "ready"],
        rows: [
          {
            label: "Header Aliases",
            value: "login, group, booklet, name"
          },
          {
            label: "Canonical Columns",
            value:
              "loginKey, groupKey, bookletKey, displayName, validFrom, validTo, validForMinutes"
          }
        ]
      },
      ...previewEntries.map(entry => {
        const assignmentKeys =
          entry.bookletAssignments?.map(assignment => assignment.assignmentKey) ??
          entry.bookletKeys ??
          (entry.bookletKey ? [entry.bookletKey] : []);
        return {
          headline: entry.displayName ?? entry.loginKey,
          subline: entry.loginKey,
          badges: [
            entry.groupKey,
            entry.bookletKey ?? "default booklet",
            `${assignmentKeys.length} assignment${assignmentKeys.length === 1 ? "" : "s"}`
          ],
          rows: [
            { label: "Login", value: entry.loginKey },
            { label: "Group", value: entry.groupKey },
            { label: "Booklet", value: entry.bookletKey ?? "active release default" },
            {
              label: "Booklet Assignments",
              value:
                assignmentKeys.length > 0
                  ? assignmentKeys.join(" | ")
                  : "release defaults"
            },
            { label: "Display Name", value: entry.displayName ?? "none" },
            { label: "Valid From", value: entry.validFrom ?? "immediately" },
            { label: "Valid To", value: entry.validTo ?? "unlimited" },
            {
              label: "Valid For",
              value: entry.validForMinutes
                ? `${entry.validForMinutes} minute(s) after first sign-in`
                : "unlimited"
            }
          ]
        };
      })
    ];

    if (remainingCount > 0) {
      items.push({
        headline: `${remainingCount} more row${remainingCount === 1 ? "" : "s"}`,
        subline: "Import or generate links to process the full roster input.",
        badges: ["local preview", "truncated"],
        rows: [
          {
            label: "Preview Limit",
            value: "Showing the first 5 parsed participants."
          }
        ]
      });
    }

    return items;
  }

  get participantLaunchStatusItems(): RecordCollectionItem[] {
    const links = this.parseEntryLinksView();
    if (links.length === 0) {
      return [];
    }

    const sessionsByLogin = new Map(
      this.parseParticipantSessionListView().map(item => [
        item.participantSession.loginKey,
        item
      ])
    );

    return links.map(link => {
      const sessionItem = sessionsByLogin.get(link.loginKey);
      const session = sessionItem?.participantSession;
      const latestRun = sessionItem?.latestTestRun;
      const launchStatus = session ? session.status : "not_started";

      return {
        headline: link.displayName || link.loginKey,
        subline: link.displayName ? link.loginKey : link.groupKey,
        badges: [
          launchStatus,
          latestRun?.status ?? "no run",
          link.bookletKey || "default booklet"
        ],
        rows: [
          { label: "Login", value: link.loginKey },
          { label: "Group", value: link.groupKey },
          { label: "Session", value: session?.participantSessionId ?? "not started" },
          { label: "Latest Run", value: latestRun?.testRunId ?? "none" },
          ...participantSessionLinkRows(session?.participantSessionId, {
            tenantKey: this.uiState.workspace.tenantKey.trim(),
            workspaceKey: this.uiState.workspace.workspaceKey.trim(),
            loginKey: link.loginKey,
            groupKey: link.groupKey,
            bookletKey: link.bookletKey
          }),
          {
            label: "Entry URL",
            value: link.url,
            href: link.url
          }
        ],
        selected:
          this.runtime.loginKey.trim() === link.loginKey ||
          (session?.participantSessionId != null &&
            this.runtime.participantSessionId.trim() === session.participantSessionId),
        actionLabel: session ? "Select + Load" : "Open Participant Entry",
        actionPayload: {
          loginKey: link.loginKey,
          groupKey: link.groupKey,
          bookletKey: link.bookletKey,
          url: link.url,
          participantSessionId: session?.participantSessionId ?? "",
          testRunId: latestRun?.testRunId ?? "",
          currentUnitKey: latestRun?.currentUnitKey ?? "",
          displayName: link.displayName ?? ""
        }
      };
    });
  }

  get participantRosterItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantRosterResponse>(
      this.runtime.participantRosterView
    );
    return (
      payload?.items.map(entry => {
        const validationWarnings = entry.validationWarnings ?? [];
        const assignments = entry.bookletAssignments ?? [];
        const assignmentKeys =
          assignments.length > 0
            ? assignments.map(assignment => assignment.assignmentKey)
            : entry.bookletKeys ?? (entry.bookletKey ? [entry.bookletKey] : []);
        const statePresets =
          assignments.length > 0
            ? assignments.flatMap(assignment =>
                Object.entries(assignment.statePreset).map(
                  ([stateKey, optionKey]) =>
                    `${assignment.assignmentKey}: ${stateKey}=${optionKey}`
                )
              )
            : Object.entries(entry.bookletStatePresets ?? {}).flatMap(
                ([bookletKey, states]) =>
                  Object.entries(states).map(
                    ([stateKey, optionKey]) => `${bookletKey}: ${stateKey}=${optionKey}`
                  )
              );
        const link = {
          loginKey: entry.loginKey,
          groupKey: entry.groupKey,
          bookletKey: entry.bookletKey ?? ""
        };
        const selectionBookletKey = entry.bookletKey ?? this.runtime.bookletKey.trim();
        const entryUrl = this.buildParticipantEntryUrl(
          this.uiState.workspace.tenantKey.trim(),
          this.uiState.workspace.workspaceKey.trim(),
          link
        );
        return {
          headline: entry.loginKey,
          subline: entry.displayName ?? entry.participantRosterEntryId,
          badges: [
            entry.groupKey,
            entry.bookletKey ?? "default booklet",
            `${assignmentKeys.length} assignment${assignmentKeys.length === 1 ? "" : "s"}`,
            statePresets.length > 0
              ? `${statePresets.length} state preset${statePresets.length === 1 ? "" : "s"}`
              : "adaptive defaults",
            validationWarnings.length > 0
              ? `${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`
              : "validated",
            entry.validFrom || entry.validTo || entry.validForMinutes
              ? "time-limited"
              : "unlimited"
          ],
          rows: [
            { label: "Display Name", value: entry.displayName ?? "none" },
            { label: "Group", value: entry.groupKey },
            { label: "Booklet", value: entry.bookletKey ?? "active release default" },
            {
              label: "Booklet Assignments",
              value:
                assignmentKeys.length > 0
                  ? assignmentKeys.join(" | ")
                  : "release defaults"
            },
            {
              label: "Adaptive Presets",
              value: statePresets.length > 0 ? statePresets.join(" | ") : "none"
            },
            {
              label: "Validation",
              value:
                validationWarnings.length > 0
                  ? validationWarnings
                      .map(warning => `${warning.code}: ${warning.message}`)
                      .join(" | ")
                  : "No roster warnings"
            },
            {
              label: "Valid From",
              value: entry.validFrom
                ? this.formatDateTime(entry.validFrom)
                : "immediately"
            },
            {
              label: "Valid To",
              value: entry.validTo
                ? this.formatDateTime(entry.validTo)
                : "unlimited"
            },
            {
              label: "Valid For",
              value: entry.validForMinutes
                ? `${entry.validForMinutes} minute(s) after first sign-in`
                : "unlimited"
            },
            { label: "Imported", value: this.formatDateTime(entry.importedAt) },
            {
              label: "Entry URL",
              value: entryUrl,
              href: entryUrl
            }
          ],
          selected: this.runtime.loginKey.trim() === entry.loginKey,
          actionLabel: "Use Roster Entry",
          actionPayload: {
            loginKey: entry.loginKey,
            groupKey: entry.groupKey,
            bookletKey: selectionBookletKey,
            displayName: entry.displayName ?? ""
          },
          actions: [
            {
              label: "Open Participant Entry",
              payload: {
                loginKey: entry.loginKey,
                groupKey: entry.groupKey,
                bookletKey: entry.bookletKey ?? "",
                displayName: entry.displayName ?? "",
                url: entryUrl
              }
            }
          ]
        };
      }) ?? []
    );
  }

  get operationalLoginCandidateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<{
      items: ImportParticipantRosterResponse["operationalLoginCandidates"];
    }>(this.runtime.operationalLoginCandidatesView);
    return Array.isArray(payload?.items)
      ? payload.items.map(candidate => {
          const roleDraft =
            mapOriginalTestcenterOperationalLoginToAdminRole(candidate);
          return {
            headline: candidate.loginKey,
            subline: roleDraft
              ? `Ready to prepare a ${roleDraft.role} account draft`
              : "No non-escalating account mapping is available yet",
            badges: [
              candidate.loginMode,
              candidate.groupKey ?? "group missing",
              candidate.passwordRequired ? "password protected" : "passwordless",
              ...(candidate.unresolvedProfileIds.length > 0
                ? ["profile reference missing"]
                : [])
            ],
            rows: [
              { label: "Original Mode", value: candidate.loginMode },
              { label: "Original Group", value: candidate.groupKey ?? "none" },
              {
                label: "Profiles",
                value:
                  candidate.monitorProfiles.length > 0
                    ? candidate.monitorProfiles
                        .map(
                          profile =>
                            `${profile.label || profile.profileId} (${profile.profileId})`
                        )
                        .join(" | ")
                    : candidate.profileIds.length > 0
                      ? candidate.profileIds.join(" | ")
                    : "none"
              },
              {
                label: "Profile Views",
                value:
                  candidate.monitorProfiles.length > 0
                    ? candidate.monitorProfiles
                        .map(profile => {
                          const settings = profile.settings;
                          return `${profile.profileId}: ${settings.view} view; block ${settings.blockColumn}; unit ${settings.unitColumn}; group ${settings.groupColumn}; booklet ${settings.bookletColumn}; auto-next ${settings.autoselectNextBlock}`;
                        })
                        .join(" | ")
                    : "none"
              },
              {
                label: "Profile Filters",
                value:
                  candidate.monitorProfiles.flatMap(profile =>
                    profile.filters.map(
                      filter => {
                        const value = Array.isArray(filter.value)
                          ? filter.value.join(", ")
                          : filter.value;
                        return `${profile.profileId}: ${filter.label || filter.target} ${filter.not ? "not " : ""}${filter.type} ${value}`;
                      }
                    )
                  ).join(" | ") || "none"
              },
              {
                label: "Missing Profile Definitions",
                value:
                  candidate.unresolvedProfileIds.length > 0
                    ? candidate.unresolvedProfileIds.join(" | ")
                    : "none"
              },
              {
                label: "Valid From",
                value: candidate.validFrom ?? "immediately"
              },
              { label: "Valid To", value: candidate.validTo ?? "unlimited" },
              {
                label: "Valid For",
                value: candidate.validForMinutes
                  ? `${candidate.validForMinutes} minute(s)`
                  : "unlimited"
              },
              {
                label: "Custom Texts",
                value: `${Object.keys(candidate.customTexts).length} imported override(s)`
              },
              {
                label: "Test Booklet List",
                value: candidate.monitorBookletVisibility
              },
              {
                label: "Migration Decision",
                value: roleDraft
                  ? `Create a ${roleDraft.role} account with a newly assigned password; the source password remains unavailable.`
                  : "No safe account mapping is available for this operational login."
              }
            ],
            ...(roleDraft
              ? {
                  actionLabel:
                    roleDraft.role === "system_check"
                      ? "Prepare System Check Account"
                      : "Prepare Monitor Account",
                  actionPayload: {
                    operationalLoginMigration: "prepareOperationalAccount",
                    username: candidate.loginKey,
                    role: roleDraft.role,
                    groupKey: roleDraft.groupKey ?? "",
                    monitorProfilesJson: JSON.stringify(candidate.monitorProfiles),
                    monitorBookletVisibility:
                      candidate.monitorBookletVisibility,
                    customTextsJson: JSON.stringify(candidate.customTexts),
                    validFrom: candidate.validFrom ?? "",
                    validTo: candidate.validTo ?? "",
                    validForMinutes: candidate.validForMinutes
                      ? String(candidate.validForMinutes)
                      : ""
                  }
                }
              : {})
          };
        })
      : [];
  }

  prepareOperationalLoginAccount(item: RecordCollectionItem): void {
    if (
      item.actionPayload?.operationalLoginMigration !== "prepareOperationalAccount"
    ) {
      return;
    }
    const role = item.actionPayload.role;
    if (
      role !== "group_monitor" &&
      role !== "study_monitor" &&
      role !== "system_check"
    ) {
      return;
    }

    const ops = this.uiState.ops;
    ops.adminCreateUsername = item.actionPayload.username?.trim() ?? "";
    ops.adminCreateDisplayName = ops.adminCreateUsername;
    ops.adminCreatePassword = "";
    ops.adminCreateRole = role;
    ops.adminCreateTenantKey = this.uiState.workspace.tenantKey.trim();
    ops.adminCreateWorkspaceKey = this.uiState.workspace.workspaceKey.trim();
    ops.adminCreateGroupKey =
      role === "group_monitor"
        ? item.actionPayload.groupKey?.trim() ?? ""
        : "";
    ops.adminCreateMonitorProfilesJson =
      role === "group_monitor" || role === "study_monitor"
        ? item.actionPayload.monitorProfilesJson ?? "[]"
        : "[]";
    ops.adminCreateMonitorBookletVisibility =
      role === "group_monitor" || role === "study_monitor"
        ? item.actionPayload.monitorBookletVisibility === "collapsed" ||
          item.actionPayload.monitorBookletVisibility === "hidden"
          ? item.actionPayload.monitorBookletVisibility
          : "visible"
        : "visible";
    ops.adminCreateCustomTextsJson =
      item.actionPayload.customTextsJson ?? "{}";
    ops.adminCreateValidFrom = item.actionPayload.validFrom?.trim() ?? "";
    ops.adminCreateValidTo = item.actionPayload.validTo?.trim() ?? "";
    ops.adminCreateValidForMinutes =
      item.actionPayload.validForMinutes?.trim() ?? "";
    this.feedback.rememberActivity(
      role === "system_check"
        ? "System Check Account Draft Prepared"
        : "Monitor Account Draft Prepared",
      `${ops.adminCreateUsername} was mapped to ${role}. Assign a new password before creating the account; the original password was not copied.`
    );
    this.persistState();
    void this.router.navigateByUrl("/ops");
  }

  get entryLinksCsvPreview(): string {
    const links = this.parseEntryLinksView();
    if (links.length === 0) {
      return "Generate entry links to preview CSV.";
    }
    return this.createEntryLinksCsv(links);
  }

  get participantRunHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    const detail = payload?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    const runSummaries =
      detail.runSummaries ??
      detail.testRuns.map(testRun => ({
        testRun,
        responseCount: Object.keys(testRun.unitResponses ?? {}).length,
        reviewCount: 0
      }));

    return runSummaries.map(summary => {
      const testRun = summary.testRun;
      return {
        headline: testRun.testRunId,
        subline: testRun.status,
        badges: [
          testRun.bookletAssignmentKey ?? testRun.bookletKey,
          `${summary.responseCount} response(s)`,
          `${summary.reviewCount} review(s)`
        ],
        rows: [
          {
            label: "Booklet Assignment",
            value: testRun.bookletAssignmentKey ?? testRun.bookletKey
          },
          {
            label: "Current Unit",
            value: testRun.currentUnitKey ?? "none"
          },
          {
            label: "Unit Responses",
            value: String(summary.responseCount)
          },
          {
            label: "Reviews",
            value: String(summary.reviewCount)
          },
          {
            label: "Created",
            value: this.formatDateTime(testRun.createdAt)
          },
          {
            label: "Updated",
            value: this.formatDateTime(testRun.updatedAt)
          },
          {
            label: "Completed",
            value: testRun.completedAt
              ? this.formatDateTime(testRun.completedAt)
              : "not completed"
          }
        ],
        selected: this.runtime.testRunId.trim() === testRun.testRunId,
        actionLabel: "Select + Sync",
        actionPayload: {
          testRunId: testRun.testRunId,
          currentUnitKey: testRun.currentUnitKey ?? "",
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: testRun.bookletKey
        }
      };
    });
  }

  get runtimeStateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    );
    const detail = payload?.runtimeState;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.runtimeStatus,
        subline: detail.participantSession.loginKey,
        badges: [detail.availableAction],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          ...participantSessionLinkRows(
            detail.participantSession.participantSessionId,
            {
              tenantKey: this.uiState.workspace.tenantKey.trim(),
              workspaceKey: this.uiState.workspace.workspaceKey.trim(),
              loginKey: detail.participantSession.loginKey,
              groupKey: detail.participantSession.groupKey,
              bookletKey: detail.latestTestRun?.bookletKey
            }
          ),
          {
            label: "Latest Run",
            value: detail.latestTestRun?.testRunId ?? "none"
          },
          {
            label: "Latest Run Status",
            value: detail.latestTestRun?.status ?? "n/a"
          }
        ],
        selected:
          this.runtime.participantSessionId.trim() ===
          detail.participantSession.participantSessionId,
        actionLabel: "Select + Load",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: detail.latestTestRun?.bookletKey ?? ""
        }
      }
    ];
  }

  get currentRunStateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    );
    const detail = payload?.currentRunState;
    if (!detail) {
      return [];
    }

    const currentUnitKey = detail.currentUnit.unitKey ?? "";
    const unitResponses = detail.testRun.unitResponses ?? {};

    return [
      {
        headline: detail.booklet.displayLabel,
        subline: detail.testRun.testRunId,
        badges: [detail.testRun.status, ...detail.availableActions],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          ...participantSessionLinkRows(
            detail.participantSession.participantSessionId,
            {
              tenantKey: this.uiState.workspace.tenantKey.trim(),
              workspaceKey: this.uiState.workspace.workspaceKey.trim(),
              loginKey: detail.participantSession.loginKey,
              groupKey: detail.participantSession.groupKey,
              bookletKey: detail.testRun.bookletKey
            }
          ),
          {
            label: "Current Unit",
            value: detail.currentUnit.displayLabel ?? detail.currentUnit.unitKey ?? "none"
          },
          {
            label: "Current Response",
            value: currentUnitKey
              ? this.formatResponsePreview(unitResponses[currentUnitKey] ?? "")
              : "none"
          },
          {
            label: "Responses",
            value: String(Object.keys(unitResponses).length)
          },
          {
            label: "Booklet Key",
            value: detail.booklet.bookletKey
          },
          {
            label: "Created",
            value: this.formatDateTime(detail.testRun.createdAt)
          }
        ],
        selected: this.runtime.testRunId.trim() === detail.testRun.testRunId,
        actionLabel: "Select + Sync",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: detail.testRun.bookletKey,
          testRunId: detail.testRun.testRunId,
          currentUnitKey: detail.testRun.currentUnitKey ?? ""
        }
      }
    ];
  }

  get unitResponseItems(): RecordCollectionItem[] {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    if (currentRunState) {
      return this.createUnitResponseItems({
        testRunId: currentRunState.testRun.testRunId,
        status: currentRunState.testRun.status,
        currentUnitKey: currentRunState.testRun.currentUnitKey,
        unitResponses: currentRunState.testRun.unitResponses ?? {}
      });
    }

    const sessionDetail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    const selectedRun =
      sessionDetail?.testRuns.find(
        testRun => testRun.testRunId === this.runtime.testRunId.trim()
      ) ?? sessionDetail?.testRuns[0];

    if (!selectedRun) {
      return [];
    }

    return this.createUnitResponseItems({
      testRunId: selectedRun.testRunId,
      status: selectedRun.status,
      currentUnitKey: selectedRun.currentUnitKey,
      unitResponses: selectedRun.unitResponses ?? {}
    });
  }

  get reviewReadinessItems(): RecordCollectionItem[] {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    const sessionDetail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    const selectedRunId =
      this.runtime.testRunId.trim() || currentRunState?.testRun.testRunId || "";
    const selectedRun =
      currentRunState?.testRun.testRunId === selectedRunId
        ? currentRunState.testRun
        : sessionDetail?.testRuns.find(testRun => testRun.testRunId === selectedRunId) ??
          sessionDetail?.testRuns[0] ??
          currentRunState?.testRun;

    if (!selectedRun) {
      return [];
    }

    const reviewItems = parseJsonDocument<ListReviewsResponse>(
      this.runtime.reviewsView
    )?.items ?? [];
    const reviewsById = new Map(
      [
        ...(sessionDetail?.reviews ?? []),
        ...reviewItems.map(item => item.review)
      ]
        .filter(review => review.testRunId === selectedRun.testRunId)
        .map(review => [review.reviewId, review])
    );
    const reviews = [...reviewsById.values()];
    const runReviews = reviews.filter(review => review.unitKey === null);
    const bookletUnits =
      currentRunState?.testRun.testRunId === selectedRun.testRunId
        ? currentRunState.bookletUnits
        : [];
    const responseEntries = Object.entries(selectedRun.unitResponses ?? {});
    const unitKeys = [
      ...bookletUnits.map(unit => unit.unitKey),
      ...responseEntries.map(([unitKey]) => unitKey)
    ].filter((unitKey, index, all) => unitKey && all.indexOf(unitKey) === index);
    const answeredCount = unitKeys.filter(
      unitKey => (selectedRun.unitResponses?.[unitKey] ?? "").trim().length > 0
    ).length;
    const expectedCount = unitKeys.length;
    const missingCount = Math.max(expectedCount - answeredCount, 0);
    const unitReviewCount = reviews.filter(review => review.unitKey !== null).length;
    const participantLabel =
      sessionDetail?.participantRosterEntry?.displayName ??
      currentRunState?.participantSession.loginKey ??
      sessionDetail?.participantSession.loginKey ??
      (this.runtime.loginKey.trim() || "selected participant");
    const selectedParticipantSession =
      currentRunState?.testRun.testRunId === selectedRun.testRunId
        ? currentRunState.participantSession
        : sessionDetail?.participantSession ?? null;
    const latestReview = reviews
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    const items: RecordCollectionItem[] = [
      {
        headline: "Review readiness",
        subline: `${participantLabel} · ${selectedRun.testRunId}`,
        badges: [
          selectedRun.status,
          `${answeredCount} / ${expectedCount} answered`,
          `${reviews.length} review(s)`
        ],
        rows: [
          { label: "Run", value: selectedRun.testRunId },
          { label: "Booklet", value: selectedRun.bookletKey },
          {
            label: "Booklet Assignment",
            value: selectedRun.bookletAssignmentKey ?? selectedRun.bookletKey
          },
          {
            label: "Missing Responses",
            value: missingCount === 0 ? "none" : String(missingCount)
          },
          { label: "Unit Reviews", value: String(unitReviewCount) },
          { label: "Whole Run Reviews", value: String(runReviews.length) },
          {
            label: "Latest Review",
            value: latestReview
              ? `${latestReview.category} by ${latestReview.reviewerId}`
              : "none"
          }
        ],
        selected: this.runtime.testRunId.trim() === selectedRun.testRunId,
        actionLabel: "Select Run",
        actionPayload: {
          testRunId: selectedRun.testRunId,
          currentUnitKey: selectedRun.currentUnitKey ?? "",
          participantSessionId: selectedRun.participantSessionId,
          loginKey: selectedParticipantSession?.loginKey ?? "",
          groupKey: selectedParticipantSession?.groupKey ?? "",
          bookletKey: selectedRun.bookletKey,
          displayName: sessionDetail?.participantRosterEntry?.displayName ?? ""
        }
      }
    ];

    items.push(
      ...unitKeys.map((unitKey, index) => {
        const unit = bookletUnits.find(entry => entry.unitKey === unitKey);
        const response = selectedRun.unitResponses?.[unitKey] ?? "";
        const unitReviews = reviews.filter(review => review.unitKey === unitKey);
        const latestUnitReview = unitReviews
          .slice()
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

        return {
          headline: unit?.displayLabel || unitKey,
          subline: `${index + 1} / ${unitKeys.length} · ${unitKey}`,
          badges: [
            response.trim() ? "answered" : "missing response",
            unitReviews.length > 0 ? "reviewed" : "needs review",
            `${response.length} char(s)`
          ],
          rows: [
            { label: "Response", value: this.formatResponsePreview(response) },
            { label: "Reviews", value: String(unitReviews.length) },
            {
              label: "Latest Review",
              value: latestUnitReview
                ? `${latestUnitReview.category}: ${this.formatResponsePreview(
                    latestUnitReview.comment
                  )}`
                : "none"
            },
            {
              label: "Updated",
              value: latestUnitReview
                ? this.formatDateTime(latestUnitReview.updatedAt)
                : this.formatDateTime(selectedRun.updatedAt)
            }
          ],
          selected:
            this.runtime.testRunId.trim() === selectedRun.testRunId &&
            this.runtime.currentUnitKey.trim() === unitKey,
          actionLabel: "Select Review Scope",
          actionPayload: {
            testRunId: selectedRun.testRunId,
            currentUnitKey: unitKey,
            participantSessionId: selectedRun.participantSessionId,
            loginKey: selectedParticipantSession?.loginKey ?? "",
            groupKey: selectedParticipantSession?.groupKey ?? "",
            bookletKey: selectedRun.bookletKey,
            reviewId: latestUnitReview?.reviewId ?? "",
            reviewerId: latestUnitReview?.reviewerId ?? "",
            reviewCategory: latestUnitReview?.category ?? "",
            reviewComment: latestUnitReview?.comment ?? ""
          }
        };
      })
    );

    if (runReviews.length > 0) {
      items.push(
        ...runReviews.map(review => ({
          headline: `Whole run · ${review.category}`,
          subline: review.reviewId,
          badges: [review.reviewerId, "whole run"],
          rows: [
            { label: "Comment", value: this.formatResponsePreview(review.comment) },
            { label: "Run", value: review.testRunId },
            { label: "Updated", value: this.formatDateTime(review.updatedAt) }
          ],
          selected: this.runtime.reviewId.trim() === review.reviewId,
          actionLabel: "Select Review",
          actionPayload: {
            reviewId: review.reviewId,
            testRunId: review.testRunId,
            currentUnitKey: "",
            participantSessionId: review.participantSessionId,
            loginKey: selectedParticipantSession?.loginKey ?? "",
            groupKey: selectedParticipantSession?.groupKey ?? "",
            bookletKey: selectedRun.bookletKey,
            reviewerId: review.reviewerId,
            reviewCategory: review.category,
            reviewComment: review.comment
          }
        }))
      );
    }

    return items;
  }

  get detailedResponseItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListDetailedResponsesResponse>(
      this.runtime.detailedResponsesView
    );
    if (!payload) {
      return [];
    }

    const activeFilters = [
      this.runtime.detailedResponseLoginFilter.trim() ? "login" : "",
      this.runtime.detailedResponseGroupFilter.trim() ? "group" : "",
      this.runtime.detailedResponseBookletFilter.trim() ? "booklet" : "",
      this.runtime.detailedResponseSessionFilter.trim() ? "session" : "",
      this.runtime.detailedResponseRunFilter.trim() ? "run" : "",
      this.runtime.detailedResponseUnitFilter.trim() ? "unit" : "",
      this.runtime.detailedResponseStatusFilter.trim() ? "status" : ""
    ].filter(Boolean);

    return [
      {
        headline: "Detailed response window",
        subline: `${payload.items.length} response row(s) loaded for the current filters`,
        badges: [
          `${activeFilters.length} active filter(s)`,
          `limit ${this.runtime.detailedResponseLimit}`
        ],
        rows: [
          { label: "Loaded Responses", value: String(payload.items.length) },
          { label: "Limit", value: this.runtime.detailedResponseLimit },
          {
            label: "Active Filters",
            value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
          }
        ]
      },
      ...payload.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;

        return {
          headline: `${displayName ?? item.loginKey} · ${item.unitKey}`,
          subline: displayName ? item.loginKey : item.testRunId,
          badges: [
            item.status,
            item.bookletKey,
            `${item.responseLength} char(s)`,
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Response", value: this.formatResponsePreview(item.response) },
            { label: "Login", value: item.loginKey },
            { label: "Group", value: item.groupKey || "unknown" },
            { label: "Session", value: item.participantSessionId },
            { label: "Test Run", value: item.testRunId },
            { label: "Updated", value: this.formatDateTime(item.updatedAt) }
          ],
          selected:
            this.runtime.testRunId.trim() === item.testRunId &&
            this.runtime.currentUnitKey.trim() === item.unitKey,
          actionLabel: "Select Response",
          actionPayload: {
            testRunId: item.testRunId,
            currentUnitKey: item.unitKey,
            participantSessionId: item.participantSessionId,
            loginKey: item.loginKey,
            groupKey: item.groupKey,
            bookletKey: item.bookletKey,
            displayName: displayName ?? ""
          }
        };
      })
    ];
  }

  get groupResultItems(): RecordCollectionItem[] {
    this.ensureResultGroupSelectionScope();
    const payload = parseJsonDocument<ListGroupResultsResponse>(
      this.runtime.groupResultsView
    );
    if (!payload) {
      return [];
    }

    return payload.items.map(item => ({
      headline: item.groupLabel || item.groupKey,
      subline: item.groupKey,
      badges: [
        `${item.bookletsStarted} booklet(s)`,
        `${item.responseCount} response(s)`,
        `${item.reviewCount} review(s)`,
        `${item.testLogCount} log(s)`
      ],
      rows: [
        { label: "Booklets Started", value: String(item.bookletsStarted) },
        { label: "Units Minimum", value: String(item.numUnitsMin) },
        { label: "Units Maximum", value: String(item.numUnitsMax) },
        { label: "Units Average", value: item.numUnitsAvg.toFixed(1) },
        { label: "Last Test Activity", value: this.formatDateTime(item.lastChangeAt) }
      ],
      selected: this.resultGroupSelection.has(item.groupKey),
      actionLabel: "Use Result Group",
      actionPayload: { groupKey: item.groupKey },
      actions: [
        {
          label: this.resultGroupSelection.has(item.groupKey)
            ? "Remove from Selection"
            : "Add to Selection",
          payload: { groupKey: item.groupKey, resultGroupAction: "toggle" }
        }
      ]
    }));
  }

  get selectedResultGroupKeys(): string[] {
    this.ensureResultGroupSelectionScope();
    return [...this.resultGroupSelection].sort();
  }

  get selectedResultGroupCount(): number {
    this.ensureResultGroupSelectionScope();
    return this.resultGroupSelection.size;
  }

  get canUseSelectedResultGroups(): boolean {
    return this.canUseWorkspaceScope && this.selectedResultGroupCount > 0;
  }

  get selectedSessionReviewItems(): RecordCollectionItem[] {
    const detail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    return detail.reviews.map(review => {
      const testRun = detail.testRuns.find(
        candidate => candidate.testRunId === review.testRunId
      );
      return {
        headline: `${review.category || "uncategorized"} · ${review.unitKey ?? "whole run"}`,
        subline: review.reviewId,
        badges: [
          review.reviewerId,
          `priority ${review.priority}`,
          ...review.categories,
          review.testRunId
        ],
        rows: [
          { label: "Comment", value: this.formatResponsePreview(review.comment) },
          { label: "Priority", value: String(review.priority) },
          {
            label: "Categories",
            value: review.categories.join(", ") || "none"
          },
          {
            label: "Task / Page",
            value: review.pageLabel ?? (review.page === null ? "none" : String(review.page))
          },
          { label: "Original Unit", value: review.originalUnitId ?? "none" },
          { label: "Browser", value: review.userAgent ?? "unavailable" },
          {
            label: "Participant",
            value:
              detail.participantRosterEntry?.displayName ??
              detail.participantSession.loginKey
          },
          { label: "Login", value: detail.participantSession.loginKey },
          { label: "Run", value: review.testRunId },
          { label: "Updated", value: this.formatDateTime(review.updatedAt) }
        ],
        selected:
          this.runtime.testRunId.trim() === review.testRunId &&
          (review.unitKey === null ||
            this.runtime.currentUnitKey.trim() === review.unitKey),
        actionLabel: "Select Review",
        actionPayload: {
          reviewId: review.reviewId,
          testRunId: review.testRunId,
          currentUnitKey: review.unitKey ?? "",
          participantSessionId: review.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: testRun?.bookletKey ?? "",
          reviewerId: review.reviewerId,
          reviewCategory: review.category,
          reviewComment: review.comment
        }
      };
    });
  }

  get reviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListReviewsResponse>(this.runtime.reviewsView);
    if (!payload) {
      return [];
    }

    const activeFilters = [
      this.runtime.reviewLoginFilter.trim() ? "login" : "",
      this.runtime.reviewGroupFilter.trim() ? "group" : "",
      this.runtime.reviewBookletFilter.trim() ? "booklet" : "",
      this.runtime.reviewSessionFilter.trim() ? "session" : "",
      this.runtime.reviewRunFilter.trim() ? "run" : "",
      this.runtime.reviewUnitFilter.trim() ? "unit" : "",
      this.runtime.reviewReviewerFilter.trim() ? "reviewer" : "",
      this.runtime.reviewCategoryFilter.trim() ? "category" : ""
    ].filter(Boolean);

    return [
      {
        headline: "Review window",
        subline: `${payload.items.length} review row(s) loaded for the current filters`,
        badges: [
          `${activeFilters.length} active filter(s)`,
          `limit ${this.runtime.reviewLimit}`
        ],
        rows: [
          { label: "Loaded Reviews", value: String(payload.items.length) },
          { label: "Limit", value: this.runtime.reviewLimit },
          {
            label: "Active Filters",
            value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
          }
        ]
      },
      ...payload.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;
        const loginKey = item.participantSession?.loginKey ?? "unknown";

        return {
          headline: `${item.review.category || "uncategorized"} · ${displayName ?? loginKey}`,
          subline: item.review.reviewId,
          badges: [
            item.review.reviewerId,
            `priority ${item.review.priority}`,
            ...item.review.categories,
            item.testRun?.status ?? "missing run",
            item.review.unitKey ?? "whole run",
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Review Id", value: item.review.reviewId },
            { label: "Priority", value: String(item.review.priority) },
            {
              label: "Categories",
              value: item.review.categories.join(", ") || "none"
            },
            {
              label: "Task / Page",
              value:
                item.review.pageLabel ??
                (item.review.page === null ? "none" : String(item.review.page))
            },
            {
              label: "Original Unit",
              value: item.review.originalUnitId ?? "none"
            },
            {
              label: "Browser",
              value: item.review.userAgent ?? "unavailable"
            },
            {
              label: "Comment",
              value: this.formatResponsePreview(item.review.comment)
            },
            { label: "Login", value: loginKey },
            { label: "Run", value: item.review.testRunId },
            {
              label: "Session",
              value: item.review.participantSessionId
            },
            {
              label: "Updated",
              value: this.formatDateTime(item.review.updatedAt)
            }
          ],
          selected:
            this.runtime.testRunId.trim() === item.review.testRunId &&
            (item.review.unitKey === null ||
              this.runtime.currentUnitKey.trim() === item.review.unitKey),
          actionLabel: "Select Review",
          actionPayload: {
            reviewId: item.review.reviewId,
            testRunId: item.review.testRunId,
            currentUnitKey: item.review.unitKey ?? "",
            participantSessionId: item.review.participantSessionId,
            loginKey: item.participantSession?.loginKey ?? "",
            groupKey: item.participantSession?.groupKey ?? "",
            bookletKey: item.testRun?.bookletKey ?? "",
            reviewerId: item.review.reviewerId,
            reviewCategory: item.review.category,
            reviewComment: item.review.comment,
            displayName: displayName ?? ""
          }
        };
      })
    ];
  }

  get reviewActionItems(): RecordCollectionItem[] {
    const reviewId = this.runtime.reviewId.trim();
    const testRunId = this.runtime.testRunId.trim();
    const participantSessionId = this.runtime.participantSessionId.trim();
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    const reviewerId = this.runtime.reviewerId.trim();
    const category = this.runtime.reviewCategory.trim();
    const comment = this.runtime.reviewComment.trim();
    const items: RecordCollectionItem[] = [];

    if (testRunId && participantSessionId) {
      items.push({
        headline: "Create review for selected run",
        subline: currentUnitKey || "whole run",
        badges: ["review", "create", reviewerId || "no reviewer"],
        rows: [
          { label: "Run", value: testRunId },
          { label: "Session", value: participantSessionId },
          { label: "Reviewer", value: reviewerId || "enter reviewer id" },
          { label: "Category", value: category || "enter category" },
          {
            label: "Comment",
            value: comment ? this.formatResponsePreview(comment) : "enter comment"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "createReview" }
      });
    }

    if (reviewId) {
      items.push({
        headline: "Update selected review",
        subline: reviewId,
        badges: ["review", "update", category || "no category"],
        rows: [
          { label: "Review", value: reviewId },
          { label: "Run", value: testRunId || "unknown run" },
          { label: "Reviewer", value: reviewerId || "unchanged reviewer" },
          {
            label: "Comment",
            value: comment ? this.formatResponsePreview(comment) : "unchanged comment"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "updateReview" }
      });
      items.push({
        headline: "Delete selected review",
        subline: reviewId,
        badges: ["review", "delete"],
        rows: [
          { label: "Review", value: reviewId },
          { label: "Run", value: testRunId || "unknown run" },
          {
            label: "Expected Result",
            value: "Remove the review and refresh review read models"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "deleteReview" }
      });
    }

    if (
      this.runtime.loginKey.trim() ||
      this.runtime.groupKey.trim() ||
      participantSessionId ||
      testRunId ||
      currentUnitKey ||
      reviewerId ||
      category
    ) {
      items.push({
        headline: "Load reviews for selected scope",
        subline: testRunId || participantSessionId || this.runtime.loginKey.trim(),
        badges: ["review", "filter"],
        rows: [
          { label: "Login", value: this.runtime.loginKey.trim() || "any" },
          { label: "Group", value: this.runtime.groupKey.trim() || "any" },
          { label: "Run", value: testRunId || "any" },
          { label: "Unit", value: currentUnitKey || "any" }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "loadSelectedScope" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Select a runtime run before reviewing",
        subline: "No active review scope",
        badges: ["review", "needs run"],
        rows: [
          {
            label: "Expected Input",
            value: "Select a participant session and run, then add a review comment"
          },
          {
            label: "Shortcut",
            value: "Use Participant Sessions, Open Runs, or Detailed Responses"
          }
        ]
      });
    }

    return items;
  }

  get openRunItems(): RecordCollectionItem[] {
    const displaySettings = this.monitorDisplaySettings;
    const visibleOpenMonitorRuns = this.visibleOpenMonitorRuns;
    const highlightBookletSpecies =
      new Set(visibleOpenMonitorRuns.map(openRun => openRun.bookletSpecies))
        .size > 1;
    const autoSelectedRunIds = this.monitorAutoSelectAllActive
      ? new Set(
          this.commandSafeVisibleMonitorRuns.map(openRun => openRun.testRunId)
        )
      : null;
    return (
      visibleOpenMonitorRuns.map(openRun => {
        const displayName = openRun.participantRosterEntry?.displayName;
        const activeTimer = openRun.activeTestletTimer;
        const activeTimerRemaining = activeTimer
          ? `${Math.floor(activeTimer.remainingSeconds / 60)}:${String(
              activeTimer.remainingSeconds % 60
            ).padStart(2, "0")}`
          : null;
        const activeTimerText = activeTimer
          ? this.monitorFormattedText("gm_timeleft_tooltip", [
              this.formatMonitorMinutes(activeTimer.remainingSeconds / 60),
              this.formatMonitorMinutes(activeTimer.durationSeconds / 60)
            ])
          : null;
        const batchSelected = autoSelectedRunIds
          ? autoSelectedRunIds.has(openRun.testRunId)
          : this.monitorBatchSelection.has(openRun.testRunId);
        const bookletStates = Object.entries(openRun.bookletStates).map(
          ([stateKey, optionKey]) => `${stateKey}=${optionKey}`
        );
        const bookletErrorText = openRun.bookletError
          ? this.monitorText(monitorBookletErrorTextKeys[openRun.bookletError])
          : null;
        const monitorState = resolveOpenMonitorRunSuperState(openRun);
        const batchSelectable =
          !openRun.bookletError && monitorState !== "pending";
        const cohortSelectable =
          batchSelectable && monitorState !== "locked";
        const controllerState = openRun.testState.CONTROLLER ?? "PENDING";

        return {
          headline: displayName ?? openRun.loginKey,
          subline: displayName ? openRun.loginKey : openRun.testRunId,
          presentationState: monitorState,
          surfaceBackground: this.monitorRunBackground(
            monitorState,
            openRun.bookletSpecies,
            highlightBookletSpecies
          ),
          speciesHighlighted:
            highlightBookletSpecies && Boolean(openRun.bookletSpecies),
          badges: [
            openRun.status,
            `state ${monitorState}`,
            `controller ${controllerState.toLowerCase()}`,
            openRun.locked ? "test locked" : "test unlocked",
            openRun.groupKey,
            openRun.executionMode,
            openRun.bookletAssignmentKey,
            ...(openRun.bookletError
              ? [`booklet ${openRun.bookletError}`]
              : []),
            ...(activeTimer
              ? [activeTimerText ?? `timer ${activeTimer.status}`]
              : []),
            bookletStates.length > 0
              ? `${bookletStates.length} booklet state${bookletStates.length === 1 ? "" : "s"}`
              : "no booklet states",
            openRun.participantRosterEntry ? "roster" : "ad hoc",
            batchSelected ? "batch selected" : "not in batch"
          ],
          rows: [
            { label: "Whole-test lock", value: openRun.locked ? "locked" : "unlocked" },
            {
              label: this.monitorText("gm_col_state"),
              value: `${monitorState} · CONTROLLER=${controllerState}`
            },
            ...(displaySettings.view === "small"
              ? []
              : [{ label: "Session", value: openRun.participantSessionId }]),
            ...participantSessionLinkRows(openRun.participantSessionId, {
              tenantKey: this.uiState.workspace.tenantKey,
              workspaceKey: this.uiState.workspace.workspaceKey,
              loginKey: openRun.loginKey,
              groupKey: openRun.groupKey,
              bookletKey: openRun.bookletKey
            }),
            ...(displaySettings.groupColumn === "show"
              ? [{ label: this.monitorText("gm_col_groupName"), value: openRun.groupKey }]
              : []),
            ...(displaySettings.view === "small"
              ? []
              : [{ label: "Run", value: openRun.testRunId }]),
            ...(displaySettings.bookletColumn === "hide"
              ? []
              : [
                  {
                    label: this.monitorText("gm_col_bookletLabel"),
                    value:
                      bookletErrorText ??
                      openRun.bookletLabel ??
                      openRun.bookletKey
                  },
                  {
                    label: "Booklet Species",
                    value: openRun.bookletSpecies ??
                      (openRun.bookletError ? "unavailable" : "unknown")
                  },
                  {
                    label: "Booklet Assignment",
                    value: openRun.bookletAssignmentKey
                  },
                  ...(openRun.bookletError && displaySettings.view !== "small"
                    ? [
                        {
                          label: "Booklet Reference",
                          value: openRun.bookletKey || "none"
                        }
                      ]
                    : [])
                ]),
            ...this.monitorBookletStateRows(
              openRun,
              displaySettings.bookletStatesColumns
            ),
            ...(displaySettings.blockColumn === "show"
              ? [
                  {
                    label: this.monitorText("gm_col_blockLabel"),
                    value:
                      openRun.currentBlockLabel ??
                      openRun.currentBlockKey ??
                      "none"
                  }
                ]
              : []),
            ...(displaySettings.unitColumn === "hide"
              ? []
              : [
                  {
                    label: this.monitorText("gm_col_unitLabel"),
                    value:
                      openRun.currentUnitLabel ?? openRun.currentUnitKey ?? "none"
                  }
                ]),
            ...(displaySettings.view === "small"
              ? []
              : [
                  { label: "Execution Mode", value: openRun.executionMode },
                  {
                    label: "Active Timer",
                    value: activeTimer?.displayLabel ?? "none"
                  },
                  {
                    label: "Timer Remaining",
                    value: activeTimerText ?? activeTimerRemaining ?? "none"
                  },
                  {
                    label: "Timer Expires",
                    value: activeTimer?.expiresAt
                      ? this.formatDateTime(activeTimer.expiresAt)
                      : activeTimer
                        ? "paused"
                        : "none"
                  },
                  {
                    label: "Last Activity",
                    value: this.formatDateTime(openRun.updatedAt)
                  }
                ])
          ],
          selected: this.runtime.testRunId.trim() === openRun.testRunId,
          actionLabel: "Select + Sync",
          actionPayload: {
            testRunId: openRun.testRunId,
            participantSessionId: openRun.participantSessionId,
            currentUnitKey: openRun.currentUnitKey ?? "",
            loginKey: openRun.loginKey,
            groupKey: openRun.groupKey,
            bookletKey: openRun.bookletKey,
            bookletSpecies: openRun.bookletSpecies ?? "",
            displayName: displayName ?? ""
          },
          actions: !batchSelectable || this.monitorAutoSelectAllActive
            ? []
            : [
                {
                  label: batchSelected ? "Remove from Batch" : "Add to Batch",
                  payload: {
                    monitorBatchCommand: "toggle",
                    testRunId: openRun.testRunId,
                    bookletSpecies: openRun.bookletSpecies ?? ""
                  }
                },
                ...(cohortSelectable &&
                  highlightBookletSpecies &&
                  openRun.bookletSpecies
                  ? [
                      {
                        label: "Select Species Cohort",
                        payload: {
                          monitorBatchCommand: "select-species",
                          testRunId: openRun.testRunId,
                          bookletSpecies: openRun.bookletSpecies
                        }
                      }
                    ]
                  : [])
              ]
        };
      })
    );
  }

  get monitorBookletItems(): RecordCollectionItem[] {
    const booklets = new Map<
      string,
      { label: string; groups: Set<string>; runCount: number }
    >();
    for (const openRun of this.visibleOpenMonitorRuns) {
      const key = openRun.bookletAssignmentKey || openRun.bookletKey;
      const current = booklets.get(key) ?? {
        label: openRun.bookletLabel ?? openRun.bookletKey,
        groups: new Set<string>(),
        runCount: 0
      };
      current.groups.add(openRun.groupKey);
      current.runCount += 1;
      booklets.set(key, current);
    }
    return Array.from(booklets.entries())
      .sort((left, right) => left[1].label.localeCompare(right[1].label))
      .map(([bookletKey, booklet]) => ({
        headline: booklet.label,
        subline: bookletKey,
        badges: [
          `${booklet.runCount} active run${booklet.runCount === 1 ? "" : "s"}`,
          `${booklet.groups.size} group${booklet.groups.size === 1 ? "" : "s"}`
        ],
        rows: [
          { label: "Booklet", value: bookletKey },
          {
            label: "Groups",
            value: Array.from(booklet.groups).sort().join(" | ")
          },
          { label: "Active Runs", value: String(booklet.runCount) }
        ]
      }));
  }

  get monitorOverviewCards(): SummaryCard[] {
    const openRuns = this.visibleOpenMonitorRuns;
    const participantCount = new Set(openRuns.map(openRun => openRun.loginKey))
      .size;
    const groupCount = new Set(openRuns.map(openRun => openRun.groupKey)).size;
    const runningCount = openRuns.filter(
      openRun => openRun.status === "running"
    ).length;
    const pausedCount = openRuns.filter(
      openRun => openRun.status === "paused"
    ).length;
    const lockedCount = openRuns.filter(openRun => openRun.locked).length;
    const controllerErrorCount = openRuns.filter(
      openRun => resolveOpenMonitorRunSuperState(openRun) === "error"
    ).length;
    const idleCount = openRuns.filter(
      openRun => resolveOpenMonitorRunSuperState(openRun) === "idle"
    ).length;
    const profile = this.activeMonitorProfile;

    return [
      {
        label: "Visible Runs",
        headline: String(openRuns.length),
        detail: profile
          ? `${profile.label || profile.profileId} profile applied.`
          : "No imported profile filter applied."
      },
      {
        label: this.monitorText("gm_col_personLabel"),
        headline: String(participantCount),
        detail: "Unique visible participant logins."
      },
      {
        label: "Running",
        headline: String(runningCount),
        detail: "Runs actively in progress."
      },
      {
        label: "Paused",
        headline: String(pausedCount),
        detail: "Runs waiting for continuation."
      },
      {
        label: "Controller Errors",
        headline: String(controllerErrorCount),
        detail: "Participant Players currently reporting a controller failure."
      },
      {
        label: "Idle",
        headline: String(idleCount),
        detail: "Runs without server-side activity for more than five minutes."
      },
      {
        label: "Locked",
        headline: String(lockedCount),
        detail: "Whole-test locks in the visible scope."
      },
      {
        label: this.monitorText("gm_col_groupName"),
        headline: String(groupCount),
        detail: "Server-authorized groups represented below."
      }
    ];
  }

  get monitorOverviewDetail(): string {
    const openRuns = this.visibleOpenMonitorRuns;
    return `${openRuns.length} open run${openRuns.length === 1 ? "" : "s"} after server scope, request filters, and ${this.activeMonitorProfile ? "the active imported profile" : "the default view"}.`;
  }

  get monitorGroupOverviewItems(): RecordCollectionItem[] {
    const runsByGroup = new Map<string, OpenMonitorRun[]>();
    for (const openRun of this.visibleOpenMonitorRuns) {
      const groupRuns = runsByGroup.get(openRun.groupKey) ?? [];
      groupRuns.push(openRun);
      runsByGroup.set(openRun.groupKey, groupRuns);
    }

    return [...runsByGroup.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupKey, openRuns]) => {
        const participantCount = new Set(
          openRuns.map(openRun => openRun.loginKey)
        ).size;
        const runningCount = openRuns.filter(
          openRun => openRun.status === "running"
        ).length;
        const pausedCount = openRuns.filter(
          openRun => openRun.status === "paused"
        ).length;
        const lockedCount = openRuns.filter(openRun => openRun.locked).length;
        const controllerErrorCount = openRuns.filter(
          openRun => resolveOpenMonitorRunSuperState(openRun) === "error"
        ).length;
        const idleCount = openRuns.filter(
          openRun => resolveOpenMonitorRunSuperState(openRun) === "idle"
        ).length;
        const timedCount = openRuns.filter(
          openRun => openRun.activeTestletTimer
        ).length;
        const booklets = [
          ...new Set(
            openRuns.map(
              openRun => openRun.bookletLabel ?? openRun.bookletKey
            )
          )
        ];
        const blocks = [
          ...new Set(
            openRuns
              .map(
                openRun =>
                  openRun.currentBlockLabel ?? openRun.currentBlockKey ?? ""
              )
              .filter(Boolean)
          )
        ];
        const latestActivityAt = openRuns
          .map(openRun => openRun.updatedAt)
          .sort((left, right) => right.localeCompare(left))[0];

        return {
          headline: groupKey,
          subline: `${participantCount} participant${participantCount === 1 ? "" : "s"} · ${openRuns.length} visible run${openRuns.length === 1 ? "" : "s"}`,
          badges: [
            `${runningCount} running`,
            `${pausedCount} paused`,
            `${controllerErrorCount} controller errors`,
            `${idleCount} idle`,
            `${lockedCount} locked`,
            `${timedCount} timed`
          ],
          rows: [
            {
              label: this.monitorText("gm_col_bookletLabel"),
              value: booklets.join(" | ") || "none"
            },
            {
              label: this.monitorText("gm_col_blockLabel"),
              value: blocks.join(" | ") || "none"
            },
            {
              label: this.monitorText("gm_col_state"),
              value: latestActivityAt
                ? this.formatDateTime(latestActivityAt)
                : "none"
            }
          ],
          actionLabel: "Show Group Runs",
          actionPayload: {
            monitorOverviewAction: "filter-group",
            groupKey
          }
        };
      });
  }

  get monitorBatchRunIds(): string[] {
    if (this.monitorAutoSelectAllActive) {
      return this.commandSafeVisibleMonitorRuns.map(openRun => openRun.testRunId);
    }
    return [...this.monitorBatchSelection];
  }

  get monitorBatchCount(): number {
    return this.monitorBatchRunIds.length;
  }

  get monitorAutoSelectAllAvailable(): boolean {
    const bookletSpecies = new Set(
      this.commandSafeVisibleMonitorRuns.map(
        openRun => openRun.bookletSpecies ?? openRun.bookletKey
      )
    );
    return bookletSpecies.size <= 1;
  }

  get monitorAutoSelectAllActive(): boolean {
    return this.monitorAutoSelectAll && this.monitorAutoSelectAllAvailable;
  }

  get monitorBatchSelectionText(): string {
    if (!this.isMonitorOnlySession) {
      return `${this.monitorBatchCount} selected run${this.monitorBatchCount === 1 ? "" : "s"}`;
    }
    if (this.monitorBatchCount === 0) {
      return this.monitorText("gm_selection_info_none");
    }
    const selectedRunIds = new Set(this.monitorBatchRunIds);
    const selectedRuns = this.visibleOpenMonitorRuns.filter(openRun =>
      selectedRunIds.has(openRun.testRunId)
    );
    const bookletCount = new Set(
      selectedRuns.map(openRun => openRun.bookletAssignmentKey)
    ).size;
    const allVisibleSelected =
      selectedRuns.length > 0 &&
      selectedRuns.length === this.visibleOpenMonitorRuns.length;
    return this.monitorFormattedText("gm_selection_info", [
      allVisibleSelected ? " Alle" : "",
      selectedRuns.length,
      selectedRuns.length === 1 ? "" : "s",
      bookletCount,
      bookletCount === 1 ? "" : "en"
    ]);
  }

  get monitorBatchBookletWarning(): string {
    if (!this.isMonitorOnlySession || this.monitorBatchCount < 2) {
      return "";
    }
    const selectedRunIds = new Set(this.monitorBatchRunIds);
    const bookletSpecies = new Set(
      this.visibleOpenMonitorRuns
        .filter(openRun => selectedRunIds.has(openRun.testRunId))
        .map(openRun => openRun.bookletSpecies ?? openRun.bookletKey)
    );
    return bookletSpecies.size > 1
      ? this.monitorText("gm_multiple_booklet_species_warning")
      : "";
  }

  get canIssueMonitorBatch(): boolean {
    const selectedRunIds = new Set(this.monitorBatchRunIds);
    const selectedRuns = this.visibleOpenMonitorRuns.filter(openRun =>
      selectedRunIds.has(openRun.testRunId)
    );
    return (
      this.canIssueMonitorCommands &&
      this.canUseWorkspaceScope &&
      selectedRuns.length > 0 &&
      selectedRuns.length === this.monitorBatchCount &&
      selectedRuns.every(openRun => !openRun.bookletError)
    );
  }

  get canIssueMonitorBatchGoto(): boolean {
    const selectedRunIds = new Set(this.monitorBatchRunIds);
    const selectedRuns = this.visibleOpenMonitorRuns.filter(openRun =>
      selectedRunIds.has(openRun.testRunId)
    );
    const restoration = this.monitorGotoRestoration(selectedRuns);
    return (
      this.canIssueMonitorBatch &&
      Boolean(this.runtime.monitorTargetUnitKey.trim()) &&
      (!restoration || this.hasValidMonitorTimeSeconds)
    );
  }

  get canIssueMonitorBatchTime(): boolean {
    return this.canIssueMonitorBatchGoto && this.hasValidMonitorTimeSeconds;
  }

  get monitorCommandHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListWorkspaceActivityEventsResponse>(
      this.runtime.monitorCommandHistoryView
    );
    return (
      payload?.items.map(item => {
        const event = item.activityEvent;
        const details = event.details ?? {};
        const commandType = String(details.commandType ?? "command");
        const previousStatus = String(details.previousStatus ?? "unknown");
        const nextStatus = String(details.nextStatus ?? "unknown");
        const participantSessionId = String(details.participantSessionId ?? "");
        const loginKey = String(details.loginKey ?? "");
        const groupKey = String(details.groupKey ?? "");
        const bookletKey = String(details.bookletKey ?? "");
        const displayName = String(details.displayName ?? "");
        const commandId = String(details.commandId ?? event.activityEventId);

        return {
          headline: `${commandType} command`,
          subline: displayName ? `${displayName} · ${commandId}` : commandId,
          badges: [
            event.actorId ?? "system",
            `${previousStatus} -> ${nextStatus}`,
            event.subjectId
          ],
          rows: [
            { label: "Run", value: event.subjectId },
            { label: "Session", value: participantSessionId || "unknown" },
            { label: "Participant", value: displayName || loginKey || "unknown" },
            { label: "Login", value: loginKey || "unknown" },
            { label: "Group", value: groupKey || "unknown" },
            { label: "Booklet", value: bookletKey || "unknown" },
            { label: "Actor", value: event.actorId ?? "system" },
            { label: "Occurred", value: this.formatDateTime(event.occurredAt) },
            { label: "Summary", value: event.summary }
          ],
          selected: this.runtime.testRunId.trim() === event.subjectId,
          actionLabel: "Select Run",
          actionPayload: {
            testRunId: event.subjectId,
            participantSessionId,
            loginKey,
            groupKey,
            bookletKey,
            displayName
          }
        };
      }) ?? []
    );
  }

  get runtimeCards(): SummaryCard[] {
    const runtimeState = parseJsonDocument(this.runtime.runtimeStateView);
    const currentRunState = parseJsonDocument(this.runtime.currentRunStateView);
    const openRunsState = parseJsonDocument(this.runtime.openRunsView);

    const runtimeStatus =
      readStringValue(runtimeState, ["runtimeState", "runtimeStatus"]) ?? "unknown";
    const availableAction =
      readStringValue(runtimeState, ["runtimeState", "availableAction"]) ?? "n/a";
    const runStatus =
      readStringValue(currentRunState, ["currentRunState", "testRun", "status"]) ?? "idle";
    const unitLabel =
      readStringValue(currentRunState, ["currentRunState", "currentUnit", "displayLabel"]) ??
      readStringValue(currentRunState, ["currentRunState", "currentUnit", "unitKey"]) ??
      "not set";
    const openRuns = readUnknownValue(openRunsState, ["items"]);
    const openRunCount = Array.isArray(openRuns) ? openRuns.length : 0;
    const participantLabel =
      this.runtime.participantDisplayName.trim() ||
      readStringValue(runtimeState, [
        "runtimeState",
        "participantRosterEntry",
        "displayName"
      ]) ||
      readStringValue(currentRunState, [
        "currentRunState",
        "participantRosterEntry",
        "displayName"
      ]) ||
      this.runtime.loginKey.trim() ||
      "no participant selected";

    return [
      {
        label: "Session",
        headline: runtimeStatus,
        detail: `${participantLabel} · ${
          this.runtime.participantSessionId.trim() || "no session selected"
        }`
      },
      {
        label: "Run",
        headline: runStatus,
        detail: this.runtime.testRunId.trim() || "no run selected"
      },
      {
        label: "Current Unit",
        headline: unitLabel,
        detail: `Next action: ${availableAction}`
      },
      {
        label: "Open Runs",
        headline: String(openRunCount),
        detail: openRunCount > 0 ? "Activation guard is active." : "No active blocker."
      }
    ];
  }

  get playerPreview(): RuntimePlayerPreview {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;

    if (!currentRunState) {
      return {
        hasRun: false,
        bookletLabel: "No active booklet",
        unitLabel: "No unit loaded",
        unitKey: "n/a",
        unitResponse: "",
        runStatus: "idle",
        runId: this.runtime.testRunId.trim() || "no run selected",
        availableActions: [],
        hint: "Sign in and resume a participant session to load the first unit.",
        canSaveProgress: false,
        canResume: false,
        canComplete: false,
        saveProgressLabel: "Save Progress"
      };
    }

    const unitLabel =
      currentRunState.currentUnit.displayLabel ??
      currentRunState.currentUnit.unitKey ??
      "Untitled unit";
    const unitKey = currentRunState.currentUnit.unitKey ?? "n/a";
    const canSaveProgress =
      currentRunState.availableActions.includes("save_progress");
    const canResume = currentRunState.availableActions.includes("resume");
    const canComplete = currentRunState.availableActions.includes("complete");
    const unitResponse = currentRunState.testRun.unitResponses?.[unitKey] ?? "";

    return {
      hasRun: true,
      bookletLabel: currentRunState.booklet.displayLabel,
      unitLabel,
      unitKey,
      unitResponse,
      runStatus: currentRunState.testRun.status,
      runId: currentRunState.testRun.testRunId,
      availableActions: currentRunState.availableActions,
      hint:
        currentRunState.testRun.status === "completed"
          ? "This run is complete; monitor reads should no longer list it as an open blocker."
          : "This preview is sourced from the same current-state endpoint a participant shell can use.",
      canSaveProgress,
      canResume,
      canComplete,
      saveProgressLabel:
        currentRunState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused"
    };
  }

  get runtimeActionItems(): RecordCollectionItem[] {
    const runtimeState = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    )?.runtimeState;
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    const openRuns = parseJsonDocument<MonitorOpenRunsResponse>(
      this.runtime.openRunsView
    )?.items ?? [];
    const items: RecordCollectionItem[] = [];
    const preparedLoginKey = this.runtime.loginKey.trim();
    const preparedGroupKey = this.runtime.groupKey.trim();
    const preparedBookletKey = this.runtime.bookletKey.trim();

    if (
      preparedLoginKey &&
      !this.runtime.participantSessionId.trim() &&
      !runtimeState &&
      !currentRunState
    ) {
      items.push({
        headline: "Start prepared participant",
        subline: preparedLoginKey,
        badges: [
          preparedGroupKey || "default group",
          preparedBookletKey || "default booklet"
        ],
        rows: [
          {
            label: "Login",
            value: preparedLoginKey
          },
          {
            label: "Group",
            value: preparedGroupKey || `group:${preparedLoginKey}`
          },
          {
            label: "Booklet",
            value: preparedBookletKey || "active release default"
          },
          {
            label: "Expected Result",
            value: "Create a participant session and start the first run"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "participantLaunch" }
      });
    }

    if (runtimeState && runtimeState.availableAction !== "none") {
      const headline =
        runtimeState.availableAction === "launch"
          ? "Start first run for this session"
          : "Resume the participant session";
      items.push({
        headline,
        subline: runtimeState.participantSession.loginKey,
        badges: [runtimeState.runtimeStatus, runtimeState.availableAction],
        rows: [
          {
            label: "Session",
            value: runtimeState.participantSession.participantSessionId
          },
          {
            label: "Latest Run",
            value: runtimeState.latestTestRun?.testRunId ?? "none yet"
          },
          {
            label: "Expected Result",
            value:
              runtimeState.availableAction === "launch"
                ? "Create a running test run"
                : "Return the latest run to running"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "resumeSession" }
      });
    }

    if (currentRunState) {
      const currentUnitLabel =
        currentRunState.currentUnit.displayLabel ??
        currentRunState.currentUnit.unitKey ??
        "none";
      if (currentRunState.availableActions.includes("resume")) {
        items.push({
          headline: "Resume paused run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "resume"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Run status becomes running"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "resumeRun" }
        });
      }

      if (currentRunState.testRun.status === "paused") {
        items.push({
          headline: "Monitor resume selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "resume"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Operator command records activity and returns the run to running"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorResume" }
        });
      }

      if (currentRunState.availableActions.includes("save_progress")) {
        const isPaused = currentRunState.testRun.status === "paused";
        items.push({
          headline: isPaused ? "Save current unit as running" : "Pause at current unit",
          subline: currentRunState.currentUnit.unitKey ?? currentUnitLabel,
          badges: [currentRunState.testRun.status, "save_progress"],
          rows: [
            {
              label: "Run",
              value: currentRunState.testRun.testRunId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: isPaused ? "Run status becomes running" : "Run status becomes paused"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: {
            runtimeCommand: isPaused ? "saveRunning" : "savePaused"
          }
        });
      }

      if (currentRunState.testRun.status === "running") {
        items.push({
          headline: "Monitor pause selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "pause"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Operator command records activity and moves the run to paused"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorPause" }
        });
      }

      if (currentRunState.availableActions.includes("complete")) {
        items.push({
          headline: "Complete current run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "complete"],
          rows: [
            {
              label: "Session",
              value: currentRunState.participantSession.participantSessionId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: "Close the participant session and clear activation blockers"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "completeRun" }
        });
      }

      if (["paused", "running"].includes(currentRunState.testRun.status)) {
        items.push({
          headline: "Monitor complete selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "complete"],
          rows: [
            {
              label: "Session",
              value: currentRunState.participantSession.participantSessionId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: "Operator command closes the session and clears the monitor blocker"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorComplete" }
        });
      }
    }

    if (openRuns.length > 0) {
      items.push({
        headline: "Review activation blockers",
        subline: `${openRuns.length} open run${openRuns.length === 1 ? "" : "s"}`,
        badges: ["monitor", "activation guard"],
        rows: [
          {
            label: "Newest Run",
            value: openRuns[0]?.testRunId ?? "unknown"
          },
          {
            label: "Session",
            value: openRuns[0]?.participantSessionId ?? "unknown"
          },
          {
            label: "Participant",
            value:
              openRuns[0]?.participantRosterEntry?.displayName ??
              openRuns[0]?.loginKey ??
              "unknown"
          },
          {
            label: "Expected Result",
            value: "Refresh monitor and current runtime context"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "refreshRuntimeReads" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Refresh runtime context",
        subline: this.runtime.participantSessionId.trim() || "no session selected",
        badges: ["read model"],
        rows: [
          {
            label: "Session",
            value: this.runtime.participantSessionId.trim() || "select or sign in first"
          },
          {
            label: "Run",
            value: this.runtime.testRunId.trim() || "none selected"
          },
          {
            label: "Expected Result",
            value: "Reload session, current run, and monitor state"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "refreshRuntimeReads" }
      });
    }

    return items;
  }

  init(): void {
    this.viewState.setActiveView("runtime");
    this.monitorBookletListExpanded =
      this.operatorAccess.monitorBookletVisibility !== "collapsed";
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  reconnectMonitorEventStream(): void {
    this.viewState.reconnectMonitorEventStream();
  }

  applyMonitorScope(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.persistState();
    this.reconnectMonitorEventStream();
    this.refreshRuntimeReads();
  }

  get canUseParticipantLoginActions(): boolean {
    return (
      this.canWriteWorkspace &&
      this.canUseWorkspaceScope &&
      this.runtime.loginKey.trim().length > 0
    );
  }

  get canUseWorkspaceScope(): boolean {
    return (
      this.uiState.workspace.tenantKey.trim().length > 0 &&
      this.uiState.workspace.workspaceKey.trim().length > 0
    );
  }

  get attachmentSessionToken(): string {
    return this.uiState.ops.adminSessionToken;
  }

  get canUseAttachmentManager(): boolean {
    return (
      this.canUseWorkspaceScope &&
      this.attachmentSessionToken.trim().length > 0 &&
      this.operatorAccess.mode !== "signed_out" &&
      this.operatorAccess.mode !== "unassigned" &&
      this.operatorAccess.mode !== "system_check"
    );
  }

  get attachmentManagerReadOnly(): boolean {
    if (this.operatorAccess.isReadOnlyAdmin) {
      return true;
    }
    if (!this.operatorAccess.isMonitorOnly) {
      return false;
    }
    return !this.operatorAccess.roleAssignments.some(
      assignment =>
        (assignment.role === "study_monitor" ||
          assignment.role === "group_monitor") &&
        assignment.accessMode === "read_write"
    );
  }

  get canUseParticipantSessionActions(): boolean {
    return (
      this.canUseWorkspaceScope &&
      this.runtime.participantSessionId.trim().length > 0
    );
  }

  get canResumeParticipantSession(): boolean {
    return this.canWriteWorkspace && this.canUseParticipantSessionActions;
  }

  get canWriteWorkspace(): boolean {
    return !this.operatorAccess.isReadOnlyAdmin;
  }

  get canIssueMonitorCommands(): boolean {
    return this.canWriteWorkspace || this.operatorAccess.hasMonitorRole;
  }

  get canUseRunActions(): boolean {
    return (
      this.canWriteWorkspace &&
      this.canUseWorkspaceScope &&
      this.runtime.testRunId.trim().length > 0
    );
  }

  get canUseMonitorRunActions(): boolean {
    return (
      this.canIssueMonitorCommands &&
      this.canUseWorkspaceScope &&
      this.runtime.testRunId.trim().length > 0 &&
      !this.selectedOpenMonitorRun?.bookletError
    );
  }

  get canFinishAllMonitorRuns(): boolean {
    return this.canIssueMonitorCommands && this.canUseWorkspaceScope;
  }

  get canSaveProgressActions(): boolean {
    return this.canUseRunActions && this.runtime.currentUnitKey.trim().length > 0;
  }

  get canIssueMonitorGoto(): boolean {
    const restoration = this.monitorGotoRestoration(
      this.selectedOpenMonitorRun ? [this.selectedOpenMonitorRun] : []
    );
    return (
      this.canUseMonitorRunActions &&
      this.runtime.monitorTargetUnitKey.trim().length > 0 &&
      (!restoration || this.hasValidMonitorTimeSeconds)
    );
  }

  get canSetMonitorTestletTime(): boolean {
    return this.canIssueMonitorGoto && this.hasValidMonitorTimeSeconds;
  }

  get canCreateReviewAction(): boolean {
    return (
      this.canUseRunActions &&
      this.runtime.reviewComment.trim().length > 0 &&
      this.runtime.reviewerId.trim().length > 0
    );
  }

  get canUseSelectedReviewActions(): boolean {
    return (
      this.canWriteWorkspace &&
      this.canUseWorkspaceScope &&
      this.runtime.reviewId.trim().length > 0
    );
  }

  get canDeleteGroupResultsAction(): boolean {
    return (
      this.canWriteWorkspace &&
      this.canUseWorkspaceScope &&
      this.runtime.groupKey.trim().length > 0
    );
  }

  get canImportParticipantRoster(): boolean {
    return (
      this.canWriteWorkspace &&
      this.canUseWorkspaceScope &&
      (this.parseEntryRosterRowsPreview().length > 0 ||
        this.parseEntryOperationalLoginCandidatesPreview().length > 0)
    );
  }

  get canGenerateEntryLinks(): boolean {
    return this.canUseWorkspaceScope && this.parseEntryRosterRowsPreview().length > 0;
  }

  get canGenerateSavedRosterEntryLinks(): boolean {
    return this.canUseWorkspaceScope && this.parseParticipantRosterView().length > 0;
  }

  get canDownloadEntryLinksCsv(): boolean {
    return (
      this.canUseWorkspaceScope &&
      (this.parseEntryLinksView().length > 0 ||
        this.parseEntryRosterRowsPreview().length > 0)
    );
  }

  participantSignIn(): void {
    if (!this.canUseParticipantLoginActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.participantSignIn());
  }

  participantLaunch(): void {
    if (!this.canUseParticipantLoginActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.participantLaunch());
  }

  resumeSession(): void {
    if (!this.canResumeParticipantSession) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.resumeParticipantSession());
  }

  refreshRuntimeReads(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
  }

  refreshParticipantSessions(): void {
    this.persistState();
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.loadParticipantSessions()
    );
  }

  clearParticipantSessionFilters(): void {
    this.runtime.participantSessionStatusFilter = "";
    this.runtime.participantSessionGroupFilter = "";
    this.runtime.participantSessionLoginFilter = "";
    this.runtime.participantSessionBookletFilter = "";
    this.runtime.participantSessionReleaseFilter = "";
    this.runtime.participantSessionLimit = "100";
    this.refreshParticipantSessions();
  }

  applyDetailedResponseFilters(): void {
    this.persistState();
    this.loadDetailedResponses();
  }

  useSelectedRuntimeAsDetailedResponseFilters(): void {
    this.runtime.detailedResponseLoginFilter = this.runtime.loginKey.trim();
    this.runtime.detailedResponseGroupFilter = this.runtime.groupKey.trim();
    this.runtime.detailedResponseBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.detailedResponseSessionFilter =
      this.runtime.participantSessionId.trim();
    this.runtime.detailedResponseRunFilter = this.runtime.testRunId.trim();
    this.runtime.detailedResponseUnitFilter = this.runtime.currentUnitKey.trim();
    this.applyDetailedResponseFilters();
  }

  clearDetailedResponseFilters(): void {
    this.runtime.detailedResponseLoginFilter = "";
    this.runtime.detailedResponseGroupFilter = "";
    this.runtime.detailedResponseBookletFilter = "";
    this.runtime.detailedResponseSessionFilter = "";
    this.runtime.detailedResponseRunFilter = "";
    this.runtime.detailedResponseUnitFilter = "";
    this.runtime.detailedResponseStatusFilter = "";
    this.runtime.detailedResponseLimit = "100";
    this.applyDetailedResponseFilters();
  }

  applyReviewFilters(): void {
    this.persistState();
    this.loadReviews();
  }

  useSelectedRuntimeAsReviewFilters(): void {
    this.runtime.reviewLoginFilter = this.runtime.loginKey.trim();
    this.runtime.reviewGroupFilter = this.runtime.groupKey.trim();
    this.runtime.reviewBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.reviewSessionFilter = this.runtime.participantSessionId.trim();
    this.runtime.reviewRunFilter = this.runtime.testRunId.trim();
    this.runtime.reviewUnitFilter = this.runtime.currentUnitKey.trim();
    this.runtime.reviewReviewerFilter = this.runtime.reviewerId.trim();
    this.runtime.reviewCategoryFilter = this.runtime.reviewCategory.trim();
    this.applyReviewFilters();
  }

  clearReviewFilters(): void {
    this.runtime.reviewLoginFilter = "";
    this.runtime.reviewGroupFilter = "";
    this.runtime.reviewBookletFilter = "";
    this.runtime.reviewSessionFilter = "";
    this.runtime.reviewRunFilter = "";
    this.runtime.reviewUnitFilter = "";
    this.runtime.reviewReviewerFilter = "";
    this.runtime.reviewCategoryFilter = "";
    this.runtime.reviewLimit = "100";
    this.applyReviewFilters();
  }

  applyOpenRunFilters(): void {
    this.persistState();
    this.refreshRuntimeReads();
  }

  filterMonitorOverviewGroup(item: RecordCollectionItem): void {
    if (item.actionPayload?.monitorOverviewAction !== "filter-group") {
      return;
    }
    const groupKey = item.actionPayload.groupKey?.trim();
    if (!groupKey) {
      return;
    }
    this.runtime.openRunLoginFilter = "";
    this.runtime.openRunGroupFilter = groupKey;
    this.runtime.openRunBookletFilter = "";
    this.runtime.openRunSpeciesFilter = "";
    this.runtime.openRunSessionFilter = "";
    this.runtime.openRunRunFilter = "";
    this.runtime.openRunUnitFilter = "";
    this.runtime.openRunStatusFilter = "";
    this.applyOpenRunFilters();
  }

  useSelectedRuntimeAsOpenRunFilters(): void {
    this.runtime.openRunLoginFilter = this.runtime.loginKey.trim();
    this.runtime.openRunGroupFilter = this.runtime.groupKey.trim();
    this.runtime.openRunBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.openRunSessionFilter = this.runtime.participantSessionId.trim();
    this.runtime.openRunRunFilter = this.runtime.testRunId.trim();
    this.runtime.openRunUnitFilter = this.runtime.currentUnitKey.trim();
    this.applyOpenRunFilters();
  }

  clearOpenRunFilters(): void {
    this.runtime.openRunLoginFilter = "";
    this.runtime.openRunGroupFilter = "";
    this.runtime.openRunBookletFilter = "";
    this.runtime.openRunSpeciesFilter = "";
    this.runtime.openRunSessionFilter = "";
    this.runtime.openRunRunFilter = "";
    this.runtime.openRunUnitFilter = "";
    this.runtime.openRunStatusFilter = "";
    this.runtime.openRunLimit = "100";
    this.applyOpenRunFilters();
  }

  applyMonitorCommandHistoryFilters(): void {
    this.persistState();
    this.refreshRuntimeReads();
  }

  useSelectedRuntimeAsMonitorCommandHistoryFilter(): void {
    this.runtime.monitorCommandHistoryRunFilter = this.runtime.testRunId.trim();
    this.applyMonitorCommandHistoryFilters();
  }

  clearMonitorCommandHistoryFilters(): void {
    this.runtime.monitorCommandHistoryRunFilter = "";
    this.runtime.monitorCommandHistoryLimit = "25";
    this.applyMonitorCommandHistoryFilters();
  }

  generateEntryLinks(): void {
    if (!this.canGenerateEntryLinks) {
      return;
    }
    const links = this.parseEntryRosterRows();
    this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
    this.persistState();
    this.renderNow();
  }

  importParticipantRoster(): void {
    this.persistState();
    if (!this.canImportParticipantRoster) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.importParticipantRoster();
      this.persistState();
      this.generateEntryLinksFromSavedRoster();
    });
  }

  loadParticipantRoster(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantRoster());
  }

  exportParticipantRosterCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportParticipantRosterCsv()
    );
  }

  async loadEntryRosterFile(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const rosterText = await file.text();
    this.runtime.entryRosterText = rosterText;
    this.persistState();
    this.uiState.renderVersion.update(version => version + 1);
    this.applicationRef.tick();
    this.feedback.rememberActivity(
      "Participant Roster Loaded",
      `${file.name} loaded as CSV/TSV/XML/JSON roster text with ${rosterText.length} character(s).`
    );
  }

  generateEntryLinksFromSavedRoster(): void {
    if (!this.canGenerateSavedRosterEntryLinks) {
      return;
    }
    const links = this.parseParticipantRosterView().map(entry => ({
      loginKey: entry.loginKey,
      groupKey: entry.groupKey,
      bookletKey: entry.bookletKey ?? "",
      displayName: entry.displayName ?? "",
      url: this.buildParticipantEntryUrl(
        this.uiState.workspace.tenantKey.trim(),
        this.uiState.workspace.workspaceKey.trim(),
        {
          loginKey: entry.loginKey,
          groupKey: entry.groupKey,
          bookletKey: entry.bookletKey ?? ""
        }
      )
    }));
    this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
    this.persistState();
    this.renderNow();
  }

  downloadEntryLinksCsv(): void {
    if (!this.canDownloadEntryLinksCsv) {
      return;
    }
    let links = this.parseEntryLinksView();
    if (links.length === 0) {
      links = this.parseEntryRosterRows();
      this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
      this.persistState();
    }

    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-participant-entry-links.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: this.createEntryLinksCsv(links)
    });
  }

  useSelectedParticipantAsEntryRoster(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    const loginKey = this.runtime.loginKey.trim() || "student-demo";
    const groupKey = this.runtime.groupKey.trim() || `group:${loginKey}`;
    const bookletKey = this.runtime.bookletKey.trim();
    this.runtime.entryRosterText = [loginKey, groupKey, bookletKey]
      .filter(Boolean)
      .join(",");
    this.generateEntryLinks();
  }

  saveProgressPaused(): void {
    if (!this.canSaveProgressActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.saveProgress("paused"));
  }

  saveProgressRunning(): void {
    if (!this.canSaveProgressActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.saveProgress("running"));
  }

  saveProgressFromPreview(): void {
    if (this.playerPreview.runStatus === "paused") {
      this.saveProgressRunning();
      return;
    }
    this.saveProgressPaused();
  }

  resumeRun(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.resumeRun());
  }

  completeRun(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.completeRun());
  }

  issueMonitorPause(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("pause")
    );
  }

  issueMonitorResume(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("resume")
    );
  }

  issueMonitorComplete(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("complete_and_lock")
    );
  }

  async finishAllMonitorRuns(): Promise<void> {
    if (!this.canFinishAllMonitorRuns) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Testdurchführung Beenden",
      message:
        "Achtung! Diese Aktion sperrt und beendet sämtliche Tests dieser Sitzung.",
      confirmLabel: "Tests beenden"
    });
    if (!confirmed || !this.canFinishAllMonitorRuns) {
      return;
    }
    this.clearAllMonitorFiltersForFinish();
    this.runtime.monitorCommandNotice = "";
    this.viewState.onActionAsync(() =>
      this.runtimeService.finishAllMonitorRuns(result => {
        this.runtime.monitorCommandNoticeKind =
          result.failedCount > 0 ? "warning" : "info";
        this.runtime.monitorCommandNotice =
          result.failedCount > 0
            ? `${result.succeededCount} Tests beendet und gesperrt; ${result.failedCount} fehlgeschlagen.`
            : `${result.succeededCount} Tests beendet und gesperrt.`;
      })
    );
  }

  async issueMonitorGoto(): Promise<void> {
    if (!this.canIssueMonitorGoto) {
      return;
    }
    const navigationTargets = this.monitorBlockNavigationTargets;
    const restoration = this.monitorGotoRestoration(
      this.selectedOpenMonitorRun ? [this.selectedOpenMonitorRun] : []
    );
    if (restoration) {
      const confirmed = await this.confirmation.confirm({
        title: this.monitorText(
          "gm_control_goto_unlock_blocks_confirm_headline"
        ),
        message: this.monitorGotoRestorationMessage(restoration),
        confirmLabel: this.monitorText("gm_control_goto")
      });
      if (!confirmed || !this.canIssueMonitorGoto) {
        return;
      }
    }
    this.clearMonitorUnitFilterBeforeGoto();
    this.viewState.onActionAsync(async () => {
      const result = await this.runtimeService.issueMonitorRunCommand(
        "goto",
        restoration
          ? { remainingSeconds: restoration.remainingSeconds }
          : undefined
      );
      this.selectNextMonitorBlockAfterGoto(
        result.command.testRun.testRunId,
        result.command.testRun.currentUnitKey,
        navigationTargets
      );
    });
  }

  issueMonitorLockTest(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("lock_test")
    );
  }

  issueMonitorUnlockTest(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.runtime.monitorCommandNotice = "";
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("unlock_test", undefined, () => {
        this.runtime.monitorCommandNoticeKind = "warning";
        this.runtime.monitorCommandNotice = this.monitorText(
          "gm_control_unlock_success_warning"
        );
      })
    );
  }

  issueMonitorUnlockNavigation(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.runtime.monitorCommandNotice = "";
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand(
        "unlock_navigation",
        undefined,
        () => {
          this.runtime.monitorCommandNoticeKind = "info";
          this.runtime.monitorCommandNotice = this.monitorText(
            "gm_codetoenter_unlock_tooltip"
          );
        }
      )
    );
  }

  issueMonitorLockNavigation(): void {
    if (!this.canUseMonitorRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("lock_navigation")
    );
  }

  issueMonitorSetTestletTime(): void {
    if (!this.canSetMonitorTestletTime) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("set_testlet_time")
    );
  }

  selectAllVisibleMonitorRuns(): void {
    if (this.monitorAutoSelectAllActive) {
      return;
    }
    for (const openRun of this.visibleOpenMonitorRuns) {
      if (!openRun.bookletError) {
        this.monitorBatchSelection.add(openRun.testRunId);
      }
    }
    this.uiState.renderVersion.update(version => version + 1);
  }

  invertVisibleMonitorRunSelection(): void {
    if (this.monitorAutoSelectAllActive) {
      return;
    }
    const nextSelection = this.visibleOpenMonitorRuns
      .filter(openRun => !openRun.bookletError)
      .filter(openRun => !this.monitorBatchSelection.has(openRun.testRunId))
      .map(openRun => openRun.testRunId);
    this.monitorBatchSelection.clear();
    for (const testRunId of nextSelection) {
      this.monitorBatchSelection.add(testRunId);
    }
    this.uiState.renderVersion.update(version => version + 1);
  }

  clearMonitorBatchSelection(): void {
    if (this.monitorAutoSelectAllActive) {
      return;
    }
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  toggleMonitorAutoSelectAll(): void {
    if (!this.monitorAutoSelectAll && !this.monitorAutoSelectAllAvailable) {
      return;
    }
    this.monitorAutoSelectAll = !this.monitorAutoSelectAll;
    this.monitorBatchSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  async issueMonitorBatchCommand(
    commandType:
      | "pause"
      | "resume"
      | "complete"
      | "complete_and_lock"
      | "goto"
      | "lock_test"
      | "unlock_test"
      | "unlock_navigation"
      | "lock_navigation"
      | "set_testlet_time"
  ): Promise<void> {
    const testRunIds = this.monitorBatchRunIds;
    const openRuns =
      parseJsonDocument<MonitorOpenRunsResponse>(this.runtime.openRunsView)
        ?.items ?? [];
    const selectedRuns = openRuns.filter(openRun =>
      testRunIds.includes(openRun.testRunId)
    );
    const restoration =
      commandType === "goto"
        ? this.monitorGotoRestoration(selectedRuns)
        : null;
    const navigationTargetsByRun = new Map(
      openRuns.map(openRun => [
        openRun.testRunId,
        openRun.blockNavigationTargets ?? []
      ])
    );
    const canIssueCommand =
      commandType === "goto"
        ? this.canIssueMonitorBatchGoto
        : commandType === "set_testlet_time"
          ? this.canIssueMonitorBatchTime
          : this.canIssueMonitorBatch;
    if (!canIssueCommand || testRunIds.length === 0) {
      return;
    }
    const targetDescription =
      commandType === "goto"
        ? ` to unit ${this.runtime.monitorTargetUnitKey.trim()}`
        : commandType === "set_testlet_time"
          ? ` for unit ${this.runtime.monitorTargetUnitKey.trim()} with ${this.runtime.monitorTimeSeconds} seconds`
          : "";
    const commandConfirmation = `Issue '${commandType}'${targetDescription} for ${testRunIds.length} selected run(s)?`;
    const confirmed = await this.confirmation.confirm({
      title: restoration
        ? this.monitorText("gm_control_goto_unlock_blocks_confirm_headline")
        : "Issue monitor command?",
      message: restoration
        ? `${this.monitorGotoRestorationMessage(restoration)}\n\n${commandConfirmation}`
        : commandConfirmation,
      confirmLabel: "Issue command",
      tone: commandType === "complete_and_lock" ? "danger" : "primary"
    });
    const canStillIssueCommand =
      commandType === "goto"
        ? this.canIssueMonitorBatchGoto
        : commandType === "set_testlet_time"
          ? this.canIssueMonitorBatchTime
          : this.canIssueMonitorBatch;
    if (!confirmed || !canStillIssueCommand) {
      return;
    }
    if (commandType === "goto") {
      this.clearMonitorUnitFilterBeforeGoto();
    }
    if (commandType === "unlock_test" || commandType === "unlock_navigation") {
      this.runtime.monitorCommandNotice = "";
    }

    this.viewState.onActionAsync(async () => {
      const result = await this.runtimeService.issueMonitorRunCommands(
        testRunIds,
        commandType,
        restoration
          ? { remainingSeconds: restoration.remainingSeconds }
          : undefined,
        acceptedResult => {
          if (
            acceptedResult.succeededCount > 0 &&
            commandType === "unlock_test"
          ) {
            this.runtime.monitorCommandNoticeKind = "warning";
            this.runtime.monitorCommandNotice = this.monitorText(
              "gm_control_unlock_success_warning"
            );
          } else if (
            acceptedResult.succeededCount > 0 &&
            commandType === "unlock_navigation"
          ) {
            this.runtime.monitorCommandNoticeKind = "info";
            this.runtime.monitorCommandNotice = this.monitorText(
              "gm_codetoenter_unlock_tooltip"
            );
          }
        }
      );
      for (const command of result.commands) {
        this.monitorBatchSelection.delete(command.testRun.testRunId);
      }
      if (commandType === "goto" && result.commands[0]) {
        this.selectNextMonitorBlockAfterGoto(
          result.commands[0].testRun.testRunId,
          result.commands[0].testRun.currentUnitKey,
          navigationTargetsByRun.get(result.commands[0].testRun.testRunId)
        );
      }
      this.uiState.renderVersion.update(version => version + 1);
    });
  }

  openRuns(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
  }

  exportOpenRunsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.exportOpenRunsCsv());
  }

  runRuntimeSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.runtimeCommand) {
      case "participantLaunch":
        this.participantLaunch();
        break;
      case "resumeSession":
        this.resumeSession();
        break;
      case "resumeRun":
        this.resumeRun();
        break;
      case "savePaused":
        this.saveProgressPaused();
        break;
      case "saveRunning":
        this.saveProgressRunning();
        break;
      case "completeRun":
        this.completeRun();
        break;
      case "monitorPause":
        this.issueMonitorPause();
        break;
      case "monitorResume":
        this.issueMonitorResume();
        break;
      case "monitorComplete":
        this.issueMonitorComplete();
        break;
      case "refreshRuntimeReads":
      default:
        this.refreshRuntimeReads();
        break;
    }
  }

  runReviewSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.reviewCommand) {
      case "createReview":
        this.createReview();
        break;
      case "updateReview":
        this.updateReview();
        break;
      case "deleteReview":
        this.confirmDeleteReview();
        break;
      case "loadSelectedScope":
        this.useSelectedRuntimeAsReviewFilters();
        break;
      default:
        this.loadReviews();
        break;
    }
  }

  runParticipantLaunchpadSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.launchpadCommand) {
      case "importRosterInput":
        this.importParticipantRoster();
        break;
      case "loadRoster":
        this.loadParticipantRoster();
        break;
      case "generateSavedRosterLinks":
        this.generateEntryLinksFromSavedRoster();
        break;
      case "downloadEntryLinks":
        this.downloadEntryLinksCsv();
        break;
      case "refreshSessions":
      default:
        this.refreshParticipantSessions();
        break;
    }
  }

  participantHappyPathFlow(): void {
    if (!this.canUseParticipantLoginActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.participantHappyPathFlow());
  }

  getParticipantSessionDetail(): void {
    if (!this.canUseParticipantSessionActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantSessionDetail());
  }

  exportParticipantSessionsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportParticipantSessionsCsv()
    );
  }

  exportResponsesCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.exportResponsesCsv());
  }

  loadDetailedResponses(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadDetailedResponses());
  }

  loadGroupResults(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadGroupResults();
      const visibleGroupKeys = new Set(
        parseJsonDocument<ListGroupResultsResponse>(
          this.runtime.groupResultsView
        )?.items.map(item => item.groupKey) ?? []
      );
      for (const groupKey of this.resultGroupSelection) {
        if (!visibleGroupKeys.has(groupKey)) {
          this.resultGroupSelection.delete(groupKey);
        }
      }
      this.uiState.renderVersion.update(version => version + 1);
    });
  }

  loadReviews(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadReviews());
  }

  createReview(): void {
    if (!this.canCreateReviewAction) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.createReview());
  }

  updateReview(): void {
    if (!this.canUseSelectedReviewActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.updateReview());
  }

  async confirmDeleteReview(): Promise<void> {
    const reviewId = this.runtime.reviewId.trim();
    if (!reviewId) {
      this.deleteReview();
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Delete review?",
      message: `Delete review '${reviewId}' from this workspace?`,
      confirmLabel: "Delete review"
    });
    if (confirmed && this.canUseSelectedReviewActions) {
      this.deleteReview();
    }
  }

  private deleteReview(): void {
    if (!this.canUseSelectedReviewActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.deleteReview());
  }

  exportReviewsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.exportReviewsCsv());
  }

  async confirmDeleteGroupResults(): Promise<void> {
    const groupKey = this.runtime.groupKey.trim();
    if (!groupKey) {
      return;
    }
    const confirmed = await this.confirmation.confirm({
      title: "Delete group results?",
      message: `Delete all collected test runs for group '${groupKey}'? This cannot be undone.`,
      confirmLabel: "Delete results",
      verification: {
        label: "Exact group key",
        expectedValue: groupKey
      }
    });
    if (confirmed && this.canDeleteGroupResultsAction) {
      this.deleteGroupResults();
    }
  }

  private deleteGroupResults(): void {
    if (!this.canDeleteGroupResultsAction) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.deleteGroupResults());
  }

  selectResultGroup(item: RecordCollectionItem): void {
    this.ensureResultGroupSelectionScope();
    const groupKey = item.actionPayload?.groupKey?.trim();
    if (!groupKey) {
      return;
    }
    if (item.actionPayload?.resultGroupAction === "toggle") {
      if (this.resultGroupSelection.has(groupKey)) {
        this.resultGroupSelection.delete(groupKey);
      } else {
        this.resultGroupSelection.add(groupKey);
      }
      this.uiState.renderVersion.update(version => version + 1);
      return;
    }
    this.runtime.groupKey = groupKey;
    this.runtime.detailedResponseGroupFilter = groupKey;
    this.runtime.reviewGroupFilter = groupKey;
    this.runtime.participantSessionGroupFilter = groupKey;
    this.runtime.openRunGroupFilter = groupKey;
    this.persistState();
    this.renderNow();
    this.viewState.onActionAsync(async () => {
      await Promise.all([
        this.runtimeService.loadDetailedResponses(),
        this.runtimeService.loadReviews()
      ]);
    });
  }

  selectAllVisibleResultGroups(): void {
    this.ensureResultGroupSelectionScope();
    const payload = parseJsonDocument<ListGroupResultsResponse>(
      this.runtime.groupResultsView
    );
    for (const item of payload?.items ?? []) {
      this.resultGroupSelection.add(item.groupKey);
    }
    this.uiState.renderVersion.update(version => version + 1);
  }

  clearResultGroupSelection(): void {
    this.ensureResultGroupSelectionScope();
    this.resultGroupSelection.clear();
    this.uiState.renderVersion.update(version => version + 1);
  }

  exportSelectedGroupResponsesCsv(): void {
    if (!this.canUseSelectedResultGroups) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportSelectedGroupResponsesCsv(
        this.selectedResultGroupKeys
      )
    );
  }

  exportSelectedGroupReviewsCsv(): void {
    if (!this.canUseSelectedResultGroups) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportSelectedGroupReviewsCsv(
        this.selectedResultGroupKeys
      )
    );
  }

  exportSelectedGroupLogsCsv(): void {
    if (!this.canUseSelectedResultGroups) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportSelectedGroupLogsCsv(this.selectedResultGroupKeys)
    );
  }

  exportSelectedGroupResultArchive(): void {
    if (!this.canUseSelectedResultGroups) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportSelectedGroupResultArchive(
        this.selectedResultGroupKeys
      )
    );
  }

  async confirmDeleteSelectedGroupResults(): Promise<void> {
    if (!this.canUseSelectedResultGroups) {
      return;
    }
    const workspaceKey = this.workspace.workspaceKey.trim();
    const selectedCount = this.selectedResultGroupCount;
    const confirmed = await this.confirmation.confirm({
      title: "Delete selected group results?",
      message: `Delete all responses, reviews, and logs for ${selectedCount} selected group(s)? This cannot be undone.`,
      confirmLabel: "Delete results",
      verification: {
        label: "Exact workspace key",
        expectedValue: workspaceKey
      }
    });
    if (!confirmed || !this.canUseSelectedResultGroups) {
      return;
    }
    const groupKeys = this.selectedResultGroupKeys;
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.deleteSelectedGroupResults(
        groupKeys,
        workspaceKey
      );
      this.resultGroupSelection.clear();
      this.uiState.renderVersion.update(version => version + 1);
    });
  }

  private ensureResultGroupSelectionScope(): void {
    const scope = `${this.workspace.tenantKey.trim()}\u0000${this.workspace.workspaceKey.trim()}`;
    if (scope === this.resultGroupSelectionScope) {
      return;
    }
    this.resultGroupSelection.clear();
    this.resultGroupSelectionScope = scope;
  }

  selectEntryLink(item: RecordCollectionItem): void {
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    this.runtime.bookletKey = item.actionPayload?.bookletKey ?? "";
    this.syncParticipantDisplayName(item);
    this.persistState();
    this.renderNow();

    const url = item.actionPayload?.url?.trim();
    if (url) {
      globalThis.window?.open(url, "_blank", "noopener,noreferrer");
    }
  }

  selectParticipantLaunchStatus(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (participantSessionId) {
      this.selectParticipantSession(item);
      return;
    }

    this.selectEntryLink(item);
  }

  selectParticipantSession(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (!participantSessionId) {
      return;
    }

    this.runtime.participantSessionId = participantSessionId;
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.bookletKey != null) {
      this.runtime.bookletKey = item.actionPayload.bookletKey;
    }
    this.syncParticipantDisplayName(item);
    this.persistState();
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  private seedSelectedRunInspectionFilters(item: RecordCollectionItem): void {
    const loginKey = this.runtime.loginKey.trim();
    const groupKey = this.runtime.groupKey.trim();
    const bookletKey = this.runtime.bookletKey.trim();
    const participantSessionId = this.runtime.participantSessionId.trim();
    const testRunId = this.runtime.testRunId.trim();
    const currentUnitKey = this.runtime.currentUnitKey.trim();

    this.runtime.detailedResponseLoginFilter = loginKey;
    this.runtime.detailedResponseGroupFilter = groupKey;
    this.runtime.detailedResponseBookletFilter = bookletKey;
    this.runtime.detailedResponseSessionFilter = participantSessionId;
    this.runtime.detailedResponseRunFilter = testRunId;
    this.runtime.detailedResponseUnitFilter = currentUnitKey;
    this.runtime.detailedResponseStatusFilter = "";
    this.runtime.reviewLoginFilter = loginKey;
    this.runtime.reviewGroupFilter = groupKey;
    this.runtime.reviewBookletFilter = bookletKey;
    this.runtime.reviewSessionFilter = participantSessionId;
    this.runtime.reviewRunFilter = testRunId;
    this.runtime.reviewUnitFilter = currentUnitKey;
    this.runtime.reviewReviewerFilter =
      item.actionPayload?.reviewerId?.trim() ?? "";
    this.runtime.reviewCategoryFilter =
      item.actionPayload?.reviewCategory?.trim() ?? "";
    this.runtime.openRunLoginFilter = loginKey;
    this.runtime.openRunGroupFilter = groupKey;
    this.runtime.openRunBookletFilter = bookletKey;
    this.runtime.openRunSpeciesFilter =
      item.actionPayload?.bookletSpecies?.trim() ?? "";
    this.runtime.openRunSessionFilter = participantSessionId;
    this.runtime.openRunRunFilter = testRunId;
    this.runtime.openRunUnitFilter = currentUnitKey;
    this.runtime.openRunStatusFilter = "";
  }

  selectTestRun(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!testRunId) {
      return;
    }
    if (item.actionPayload?.monitorBatchCommand === "select-species") {
      if (this.monitorAutoSelectAllActive) {
        return;
      }
      const bookletSpecies = item.actionPayload.bookletSpecies?.trim();
      if (!bookletSpecies) {
        return;
      }
      const cohortRunIds = this.commandSafeVisibleMonitorRuns
        .filter(openRun => openRun.bookletSpecies === bookletSpecies)
        .map(openRun => openRun.testRunId);
      this.monitorBatchSelection.clear();
      for (const cohortRunId of cohortRunIds) {
        this.monitorBatchSelection.add(cohortRunId);
      }
      this.uiState.renderVersion.update(version => version + 1);
      return;
    }
    if (item.actionPayload?.monitorBatchCommand === "toggle") {
      if (this.monitorAutoSelectAllActive) {
        return;
      }
      if (this.monitorBatchSelection.has(testRunId)) {
        this.monitorBatchSelection.delete(testRunId);
      } else {
        this.monitorBatchSelection.add(testRunId);
      }
      this.uiState.renderVersion.update(version => version + 1);
      return;
    }

    this.runtime.testRunId = testRunId;
    if (item.actionPayload?.currentUnitKey != null) {
      this.runtime.currentUnitKey = item.actionPayload.currentUnitKey;
      const currentUnitKey = item.actionPayload.currentUnitKey;
      const selectedOpenRun = parseJsonDocument<MonitorOpenRunsResponse>(
        this.runtime.openRunsView
      )?.items.find(openRun => openRun.testRunId === testRunId);
      this.selectedMonitorBlockNavigationTargets =
        selectedOpenRun?.blockNavigationTargets ?? [];
      const navigationTarget = this.selectedMonitorBlockNavigationTargets.find(
        target => target.unitKeys.includes(currentUnitKey)
      );
      this.runtime.monitorTargetUnitKey =
        navigationTarget?.targetUnitKey ?? currentUnitKey;
    }
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.bookletKey != null) {
      this.runtime.bookletKey = item.actionPayload.bookletKey;
    }
    if (item.actionPayload?.participantSessionId) {
      this.runtime.participantSessionId = item.actionPayload.participantSessionId;
    }
    this.syncParticipantDisplayName(item);
    if (!this.runtime.participantSessionId.trim() && this.runtime.loginKey.trim()) {
      const derivedParticipantSessionId = this.findParticipantSessionIdByLoginKey(
        this.runtime.loginKey.trim()
      );
      if (derivedParticipantSessionId) {
        this.runtime.participantSessionId = derivedParticipantSessionId;
      }
    }
    this.seedSelectedRunInspectionFilters(item);
    this.persistState();
    if (!this.runtime.participantSessionId.trim()) {
      return;
    }

    this.viewState.onActionAsync(async () => {
      if (!this.isMonitorOnlySession) {
        await this.runtimeService.loadParticipantSessionDetail();
      }
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  private selectNextMonitorBlockAfterGoto(
    testRunId: string,
    currentUnitKey: string | null,
    knownNavigationTargets?: NonNullable<
      OpenMonitorRun["blockNavigationTargets"]
    >
  ): void {
    if (this.activeMonitorProfile?.settings.autoselectNextBlock !== "yes") {
      return;
    }
    const payload = parseJsonDocument<MonitorOpenRunsResponse>(
      this.runtime.openRunsView
    );
    const navigationTargets =
      payload?.items.find(openRun => openRun.testRunId === testRunId)
        ?.blockNavigationTargets ??
      knownNavigationTargets ??
      [];
    this.selectedMonitorBlockNavigationTargets = navigationTargets;
    const currentBlockIndex = navigationTargets.findIndex(target =>
      currentUnitKey ? target.unitKeys.includes(currentUnitKey) : false
    );
    this.runtime.monitorTargetUnitKey =
      currentBlockIndex >= 0
        ? navigationTargets[currentBlockIndex + 1]?.targetUnitKey ?? ""
        : "";
    this.persistState();
    this.uiState.renderVersion.update(version => version + 1);
  }

  selectReview(item: RecordCollectionItem): void {
    if (item.actionPayload?.reviewId) {
      this.runtime.reviewId = item.actionPayload.reviewId;
    }
    if (item.actionPayload?.reviewerId) {
      this.runtime.reviewerId = item.actionPayload.reviewerId;
    }
    if (item.actionPayload?.reviewCategory) {
      this.runtime.reviewCategory = item.actionPayload.reviewCategory;
    }
    if (item.actionPayload?.reviewComment) {
      this.runtime.reviewComment = item.actionPayload.reviewComment;
    }
    this.selectTestRun(item);
  }

  selectReviewReadinessItem(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!testRunId) {
      return;
    }

    const currentUnitKey = item.actionPayload?.currentUnitKey ?? "";
    const participantSessionId =
      item.actionPayload?.participantSessionId?.trim() ||
      this.runtime.participantSessionId.trim();

    if (item.actionPayload?.reviewId) {
      this.runtime.reviewId = item.actionPayload.reviewId;
    }
    if (item.actionPayload?.reviewerId) {
      this.runtime.reviewerId = item.actionPayload.reviewerId;
    }
    if (item.actionPayload?.reviewCategory) {
      this.runtime.reviewCategory = item.actionPayload.reviewCategory;
    }
    if (item.actionPayload?.reviewComment) {
      this.runtime.reviewComment = item.actionPayload.reviewComment;
    }

    this.runtime.testRunId = testRunId;
    this.runtime.currentUnitKey = currentUnitKey;
    if (participantSessionId) {
      this.runtime.participantSessionId = participantSessionId;
    }
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.bookletKey != null) {
      this.runtime.bookletKey = item.actionPayload.bookletKey;
    }
    this.syncParticipantDisplayName(item);
    this.runtime.detailedResponseLoginFilter = this.runtime.loginKey.trim();
    this.runtime.detailedResponseGroupFilter = this.runtime.groupKey.trim();
    this.runtime.detailedResponseBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.detailedResponseSessionFilter = participantSessionId;
    this.runtime.detailedResponseRunFilter = testRunId;
    this.runtime.detailedResponseUnitFilter = currentUnitKey;
    this.runtime.reviewLoginFilter = this.runtime.loginKey.trim();
    this.runtime.reviewGroupFilter = this.runtime.groupKey.trim();
    this.runtime.reviewBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.reviewSessionFilter = participantSessionId;
    this.runtime.reviewRunFilter = testRunId;
    this.runtime.reviewUnitFilter = currentUnitKey;
    this.runtime.openRunLoginFilter = this.runtime.loginKey.trim();
    this.runtime.openRunGroupFilter = this.runtime.groupKey.trim();
    this.runtime.openRunBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.openRunSpeciesFilter =
      item.actionPayload?.bookletSpecies?.trim() ?? "";
    this.runtime.openRunSessionFilter = participantSessionId;
    this.runtime.openRunRunFilter = testRunId;
    this.runtime.openRunUnitFilter = currentUnitKey;
    this.runtime.reviewReviewerFilter = this.runtime.reviewerId.trim();
    this.runtime.reviewCategoryFilter = this.runtime.reviewCategory.trim();
    this.persistState();

    this.viewState.onActionAsync(async () => {
      if (this.runtime.participantSessionId.trim()) {
        await this.runtimeService.loadParticipantSessionDetail();
        await this.runtimeService.refreshRuntimeReads(true);
      }
      await this.runtimeService.loadDetailedResponses();
      await this.runtimeService.loadReviews();
    });
  }

  private findParticipantSessionIdByLoginKey(loginKey: string): string | null {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    const matchingItem = payload?.items.find(
      item => item.participantSession.loginKey === loginKey
    );
    return matchingItem?.participantSession.participantSessionId ?? null;
  }

  private syncParticipantDisplayName(item: RecordCollectionItem): void {
    if (item.actionPayload?.displayName != null) {
      this.runtime.participantDisplayName = item.actionPayload.displayName;
    }
  }

  private renderNow(): void {
    this.uiState.renderVersion.update(version => version + 1);
    this.applicationRef.tick();
  }

  private parseEntryRosterRows(): RuntimeEntryLink[] {
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    return this.parseEntryRosterRowsPreview().map(link => {
      const entryLink = {
        loginKey: link.loginKey,
        groupKey: link.groupKey,
        bookletKey: link.bookletKey ?? "",
        displayName: link.displayName ?? ""
      };
      return {
        ...entryLink,
        url: this.buildParticipantEntryUrl(tenantKey, workspaceKey, entryLink)
      };
    });
  }

  private parseEntryRosterRowsPreview(): ParsedParticipantRosterEntry[] {
    try {
      return parseParticipantRosterText(this.runtime.entryRosterText);
    } catch {
      return [];
    }
  }

  private parseEntryOperationalLoginCandidatesPreview() {
    try {
      return parseOriginalTestcenterOperationalLogins(
        this.runtime.entryRosterText
      );
    } catch {
      return [];
    }
  }

  private parseEntryLinksView(): RuntimeEntryLink[] {
    const payload = parseJsonDocument<{ links: RuntimeEntryLink[] }>(
      this.runtime.entryLinksView
    );
    return Array.isArray(payload?.links) ? payload.links : [];
  }

  private parseParticipantRosterView(): ListParticipantRosterResponse["items"] {
    const payload = parseJsonDocument<ListParticipantRosterResponse>(
      this.runtime.participantRosterView
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  private parseParticipantSessionListView(): ListParticipantSessionsResponse["items"] {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  private buildParticipantEntryUrl(
    tenantKey: string,
    workspaceKey: string,
    link: Omit<RuntimeEntryLink, "url">
  ): string {
    return buildParticipantEntryUrl({
      tenantKey,
      workspaceKey: workspaceKey || "demo-workspace",
      loginKey: link.loginKey,
      groupKey: link.groupKey,
      bookletKey: link.bookletKey
    });
  }

  private createEntryLinksCsv(links: RuntimeEntryLink[]): string {
    const rows = [
      ["loginKey", "groupKey", "bookletKey", "url", "displayName"],
      ...links.map(link => [
        link.loginKey,
        link.groupKey,
        link.bookletKey,
        link.url,
        link.displayName ?? ""
      ])
    ];
    return rows.map(row => row.map(value => this.escapeCsvValue(value)).join(",")).join("\n");
  }

  private escapeCsvValue(value: string): string {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  private createUnitResponseItems(input: {
    testRunId: string;
    status: string;
    currentUnitKey: string | null;
    unitResponses: Record<string, string>;
  }): RecordCollectionItem[] {
    return Object.entries(input.unitResponses)
      .sort(([leftUnitKey], [rightUnitKey]) => leftUnitKey.localeCompare(rightUnitKey))
      .map(([unitKey, response]) => ({
        headline: unitKey,
        subline: input.testRunId,
        badges: [input.status, `${response.length} char(s)`],
        rows: [
          {
            label: "Response",
            value: this.formatResponsePreview(response)
          },
          {
            label: "Length",
            value: String(response.length)
          }
        ],
        selected:
          this.runtime.testRunId.trim() === input.testRunId &&
          this.runtime.currentUnitKey.trim() === unitKey,
        actionLabel: "Select Unit",
        actionPayload: {
          testRunId: input.testRunId,
          currentUnitKey: unitKey
        }
      }));
  }

  private monitorBookletStateRows(
    openRun: OpenMonitorRun,
    visibleStateKeys: string[]
  ): RecordCollectionRow[] {
    if (visibleStateKeys.length === 0) {
      return [];
    }
    const states = visibleStateKeys.flatMap(stateKey => {
      const optionKey = openRun.bookletStates[stateKey];
      return optionKey === undefined ? [] : [`${stateKey}=${optionKey}`];
    });
    return [
      {
        label: this.monitorText("gm_menu_cols_states"),
        value: states.length > 0 ? states.join(" | ") : "none"
      }
    ];
  }

  private monitorRunBackground(
    state: ReturnType<typeof resolveOpenMonitorRunSuperState>,
    bookletSpecies: string | null,
    highlightBookletSpecies: boolean
  ): string {
    const stripes = (first: string, second: string): string =>
      `repeating-linear-gradient(45deg, ${first}, ${first} 10px, ${second} 10px, ${second} 20px)`;
    const hsl = (hue: number, saturation: number, lightness: number): string =>
      `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const colorful = highlightBookletSpecies && Boolean(bookletSpecies);
    const species = bookletSpecies ?? "";
    const hue = colorful
      ? (species.length *
          species.charCodeAt(0) *
          species.charCodeAt(species.length / 4) *
          species.charCodeAt(species.length / 4) *
          species.charCodeAt(species.length / 2) *
          species.charCodeAt(3 * (species.length / 4)) *
          species.charCodeAt(species.length - 1)) %
        360
      : 0;

    switch (state) {
      case "paused":
        return hsl(hue, colorful ? 45 : 0, 90);
      case "pending":
      case "locked":
        return stripes(
          hsl(hue, colorful ? 75 : 0, 95),
          hsl(0, 0, 92)
        );
      case "error":
        return stripes(
          hsl(hue, colorful ? 75 : 0, 95),
          hsl(0, 30, 95)
        );
      default:
        return hsl(hue, colorful ? 75 : 0, colorful ? 95 : 100);
    }
  }

  private get monitorDisplaySettings(): MonitorDisplaySettings {
    const profileId = this.activeMonitorProfileId || "__default__";
    if (this.monitorDisplayOverride?.profileId === profileId) {
      return this.monitorDisplayOverride.settings;
    }
    const profileSettings = this.activeMonitorProfile?.settings;
    return {
      groupColumn: profileSettings?.groupColumn === "show" ? "show" : "hide",
      bookletColumn:
        profileSettings?.bookletColumn === "hide" ? "hide" : "show",
      blockColumn: profileSettings?.blockColumn === "show" ? "show" : "hide",
      unitColumn: profileSettings?.unitColumn === "hide" ? "hide" : "show",
      view:
        profileSettings?.view === "small"
          ? "small"
          : profileSettings?.view === "medium" ||
              profileSettings?.view === "middle"
            ? "medium"
            : "full",
      bookletStatesColumns: profileSettings
        ? profileSettings.bookletStatesColumns.split(/[\W,]+/).filter(Boolean)
        : this.monitorAvailableBookletStateColumns
    };
  }

  private get commandSafeVisibleMonitorRuns(): OpenMonitorRun[] {
    return this.visibleOpenMonitorRuns.filter(openRun => {
      const monitorState = resolveOpenMonitorRunSuperState(openRun);
      return (
        !openRun.bookletError &&
        monitorState !== "pending" &&
        monitorState !== "locked"
      );
    });
  }

  private sortMonitorRuns(openRuns: OpenMonitorRun[]): OpenMonitorRun[] {
    const direction = this.monitorSortDirection === "asc" ? 1 : -1;
    const valueFor = (openRun: OpenMonitorRun): string | number => {
      switch (this.monitorSortKey) {
        case "state":
          return monitorSuperStateSortOrder.indexOf(
            resolveOpenMonitorRunSuperState(openRun)
          );
        case "group":
          return openRun.groupKey;
        case "participant":
          return openRun.participantRosterEntry?.displayName ?? openRun.loginKey;
        case "booklet":
          return openRun.bookletLabel ?? openRun.bookletKey;
        case "block":
          return openRun.currentBlockLabel ?? openRun.currentBlockKey ?? "zzzzzzzzzz";
        case "activity":
          return openRun.updatedAt;
        case "unit":
          return openRun.currentUnitLabel ?? openRun.currentUnitKey ?? "zzzzzzzzzz";
        default:
          return openRun.bookletStates[
            this.monitorSortKey.slice("bookletState:".length)
          ] ?? "zzzzzzzzzz";
      }
    };
    return openRuns
      .map((openRun, index) => ({ openRun, index }))
      .sort((left, right) => {
        const leftValue = valueFor(left.openRun);
        const rightValue = valueFor(right.openRun);
        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue));
        return comparison === 0
          ? left.index - right.index
          : comparison * direction;
      })
      .map(({ openRun }) => openRun);
  }

  private monitorProfileFilterLabel(
    filter: MonitorViewProfile["filters"][number]
  ): string {
    const targetKey = monitorFilterTargetTextKeys[filter.target];
    const typeKey = monitorFilterTypeTextKeys[filter.type];
    const filterValue = Array.isArray(filter.value)
      ? filter.value.join(", ")
      : filter.value;
    const generatedLabel = [
      targetKey ? this.monitorText(targetKey) : filter.target,
      typeKey ? this.monitorText(typeKey) : filter.type,
      filter.not ? this.monitorText("gm_filter_not") : "",
      filterValue,
      filter.subValue ?? ""
    ]
      .filter(Boolean)
      .join(" ");
    const authoredLabel = filter.label.trim();
    const resolvedAuthoredLabel = authoredLabel
      ? this.effectiveMonitorCustomTexts[authoredLabel]?.trim() || authoredLabel
      : "";
    return resolvedAuthoredLabel && resolvedAuthoredLabel !== generatedLabel
      ? `${resolvedAuthoredLabel} — ${generatedLabel}`
      : generatedLabel;
  }

  private get currentMonitorCustomFilters(): MonitorCustomFilter[] {
    return this.monitorCustomFilters.filter(
      customFilter => customFilter.scopeId === this.monitorCustomFilterScopeId
    );
  }

  private get monitorCustomFilterScopeId(): string {
    const monitorAssignmentIds = this.operatorAccess.roleAssignments
      .filter(
        assignment =>
          assignment.role === "study_monitor" ||
          assignment.role === "group_monitor"
      )
      .map(assignment => assignment.roleAssignmentId)
      .sort()
      .join(",");
    return [
      monitorAssignmentIds,
      this.activeMonitorProfileId || "__default__"
    ].join("::");
  }

  private resetMonitorCustomFilterDraft(): void {
    this.monitorCustomFilterTarget = "personLabel";
    this.monitorCustomFilterType = "equal";
    this.monitorCustomFilterValue = "";
    this.monitorCustomFilterSubValue = "";
    this.monitorCustomFilterLabel = "";
    this.monitorCustomFilterNot = false;
    this.monitorCustomFilterEditingId = "";
  }

  private get currentMonitorFilterState(): MonitorFilterOverride {
    const profileId = this.activeMonitorProfileId || "__default__";
    if (this.monitorFilterOverride?.profileId === profileId) {
      return this.monitorFilterOverride;
    }
    const profile = this.activeMonitorProfile;
    return {
      profileId,
      enabledProfileFilterIndexes: new Set(
        profile?.filters.map((_filter, index) => index) ?? []
      ),
      pending: profile?.filtersEnabled.pending === "yes",
      locked: profile?.filtersEnabled.locked === "yes"
    };
  }

  private editableMonitorFilterState(): MonitorFilterOverride {
    const profileId = this.activeMonitorProfileId || "__default__";
    if (this.monitorFilterOverride?.profileId !== profileId) {
      const state = this.currentMonitorFilterState;
      this.monitorFilterOverride = {
        ...state,
        enabledProfileFilterIndexes: new Set(
          state.enabledProfileFilterIndexes
        )
      };
    }
    return this.monitorFilterOverride;
  }

  private get effectiveMonitorProfile(): MonitorViewProfile | null {
    const profile = this.activeMonitorProfile;
    const state = this.currentMonitorFilterState;
    const customFilters = this.currentMonitorCustomFilters
      .filter(customFilter => customFilter.active)
      .map(customFilter => customFilter.filter);
    if (
      !profile &&
      !state.pending &&
      !state.locked &&
      customFilters.length === 0
    ) {
      return null;
    }
    return {
      profileId: profile?.profileId ?? "__runtime__",
      label: profile?.label ?? "Runtime filters",
      settings: profile?.settings ?? {
        blockColumn: "hide",
        unitColumn: "show",
        view: "full",
        groupColumn: "hide",
        bookletColumn: "show",
        bookletStatesColumns: "",
        autoselectNextBlock: "no"
      },
      filters: [
        ...(profile?.filters ?? []).filter((_filter, index) =>
          state.enabledProfileFilterIndexes.has(index)
        ),
        ...customFilters
      ],
      filtersEnabled: {
        pending: state.pending ? "yes" : "no",
        locked: state.locked ? "yes" : "no"
      }
    };
  }

  private editableMonitorDisplaySettings(): MonitorDisplaySettings {
    const profileId = this.activeMonitorProfileId || "__default__";
    if (this.monitorDisplayOverride?.profileId !== profileId) {
      const settings = this.monitorDisplaySettings;
      this.monitorDisplayOverride = {
        profileId,
        settings: {
          ...settings,
          bookletStatesColumns: [...settings.bookletStatesColumns]
        }
      };
    }
    return this.monitorDisplayOverride.settings;
  }

  private get hasValidMonitorTimeSeconds(): boolean {
    const seconds = Number(this.runtime.monitorTimeSeconds);
    return (
      Number.isInteger(seconds) &&
      seconds >= 1 &&
      seconds <= 86_400
    );
  }

  private findMonitorTarget(
    openRun: OpenMonitorRun | null
  ): MonitorBlockNavigationTarget | null {
    const targetUnitKey = this.runtime.monitorTargetUnitKey.trim();
    if (!openRun || !targetUnitKey) {
      return null;
    }
    return (
      openRun.blockNavigationTargets?.find(
        target =>
          target.targetUnitKey === targetUnitKey ||
          target.unitKeys.includes(targetUnitKey)
      ) ?? null
    );
  }

  private monitorGotoRestoration(
    openRuns: readonly OpenMonitorRun[]
  ): { affectedCount: number; remainingSeconds: number } | null {
    const affectedCount = openRuns.filter(openRun => {
      const timer = this.findMonitorTarget(openRun)?.timer;
      return Boolean(
        timer &&
          (timer.status === "expired" ||
            timer.status === "cancelled" ||
            timer.remainingSeconds <= 0)
      );
    }).length;
    if (affectedCount === 0) {
      return null;
    }
    return {
      affectedCount,
      remainingSeconds: Number(this.runtime.monitorTimeSeconds)
    };
  }

  private monitorGotoRestorationMessage(restoration: {
    affectedCount: number;
    remainingSeconds: number;
  }): string {
    const restoredMinutes = this.formatMonitorMinutes(
      restoration.remainingSeconds / 60
    );
    return `${this.monitorText("gm_control_goto_unlock_blocks_confirm_text")}\n\n${this.monitorFormattedText("gm_timemax_tooltip", [restoredMinutes])} · ${restoration.affectedCount} run${restoration.affectedCount === 1 ? "" : "s"}`;
  }

  private clearMonitorUnitFilterBeforeGoto(): void {
    if (!this.isMonitorOnlySession || !this.runtime.openRunUnitFilter.trim()) {
      return;
    }
    this.runtime.openRunUnitFilter = "";
    this.persistState();
  }

  private clearAllMonitorFiltersForFinish(): void {
    this.runtime.openRunLoginFilter = "";
    this.runtime.openRunGroupFilter = "";
    this.runtime.openRunBookletFilter = "";
    this.runtime.openRunSpeciesFilter = "";
    this.runtime.openRunSessionFilter = "";
    this.runtime.openRunRunFilter = "";
    this.runtime.openRunUnitFilter = "";
    this.runtime.openRunStatusFilter = "";
    this.runtime.openRunLimit = "100";
    this.monitorFilterOverride = {
      profileId: this.activeMonitorProfileId || "__default__",
      enabledProfileFilterIndexes: new Set<number>(),
      pending: false,
      locked: false
    };
    for (const customFilter of this.currentMonitorCustomFilters) {
      customFilter.active = false;
    }
    this.monitorQuickFilter = "";
    this.monitorAutoSelectAll = false;
    this.monitorBatchSelection.clear();
    this.persistState();
    this.uiState.renderVersion.update(version => version + 1);
  }

  private formatMonitorMinutes(value: number): string {
    if (!Number.isFinite(value)) {
      return "0";
    }
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }

  private formatResponsePreview(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return "empty";
    }
    return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
  }

  private formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
}
