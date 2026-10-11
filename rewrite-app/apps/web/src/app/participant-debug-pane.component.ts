import { CommonModule } from "@angular/common";
import { Component, Input, inject, signal } from "@angular/core";
import type { DoCheck, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatTooltip } from "@angular/material/tooltip";
import { CodingSchemeTextFactory } from "@iqb/responses";
import { CodingScheme } from "@iqbspecs/coding-scheme";
import type { ContentReleaseTestletEntry, ContentReleaseUnitEntry, ParticipantCurrentRunState, ParticipantDebugSnapshot } from "@testcenter-rewrite-app/domain";
import { originalParticipantCustomTextDefaults, parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { buildParticipantDebugSnapshot, participantDebugConditionText, participantDebugVariableValue } from "@testcenter-rewrite-app/contracts/participant-debug-runtime";
import { evaluateParticipantDebugConditions, parseParticipantDebugConditionElement } from "@testcenter-rewrite-app/contracts/participant-debug-condition";
import { ApplicationSettingsService } from "./application-settings.service";
import { ParticipantViewFacade } from "./participant-view.facade";
import { participantDebugWindows, type ParticipantDebugControl, type ParticipantDebugWindow } from "./participant-debug-control";
import { participantDebugScopeKey, readParticipantDebugSnapshot } from "./participant-debug-snapshot";
import { ParticipantDebugDragDirective } from "./participant-debug-drag.directive";
import { participantDebugConfigEntries, participantDebugModeEntries } from "./participant-debug-settings";
import { readParticipantDebugResponses } from "./participant-debug-responses";

type DebugBadge = { label: string; title: string; active?: boolean };
type DebugTree = { id: string; testlet: ContentReleaseTestletEntry | null; unit: ContentReleaseUnitEntry | null; children: DebugTree[] };

@Component({
  selector: "app-participant-debug-pane", standalone: true,
  imports: [CommonModule, FormsModule, ParticipantDebugDragDirective, MatTooltip],
  templateUrl: "./participant-debug-pane.component.html", styleUrl: "./participant-debug-pane.component.css"
})
export class ParticipantDebugPaneComponent implements DoCheck, OnDestroy {
  @Input({ required: true }) state!: ParticipantCurrentRunState;
  @Input({ required: true }) control!: ParticipantDebugControl;
  @Input() activeWindows: readonly string[] = [];
  readonly view = inject(ParticipantViewFacade);
  private readonly settings = inject(ApplicationSettingsService);
  readonly windows = participantDebugWindows;
  readonly snapshot = signal<ParticipantDebugSnapshot | null>(null);
  readonly error = signal("");
  readonly systemError = signal("");
  readonly apiStatus = signal("not checked");
  readonly now = signal(Date.now());
  readonly focus = signal("UNKNOWN");
  readonly openPanes = new Set<string>();
  readonly valueText = participantDebugVariableValue;
  readonly conditionText = participantDebugConditionText;
  private readonly numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  timerText(value: number): string { return this.numberFormat.format(value); }
  searchCustomText = "";
  customTextOptionsOpen = false;
  customTextOptionIndex = -1;
  customTextOptionsPosition = { top: 0, left: 0, width: 300 };
  private customTextInput: HTMLInputElement | null = null;
  testingCondition = "";
  testingConditionResults: string[] = [];
  tree: DebugTree = { id: "", testlet: null, unit: null, children: [] };
  private source: ParticipantDebugSnapshot | null = null;
  private scope = "";
  private fingerprint = "";
  private generation = 0;
  private stopped = false;
  private request: AbortController | null = null;
  private systemRequest: AbortController | null = null;
  private readonly updateFocus = (): void => this.focus.set(!document.hasFocus() ? "UNKNOWN" :
    document.activeElement?.tagName === "IFRAME" ? "PLAYER" : "HOST");
  private readonly tick = globalThis.window.setInterval(() => { this.now.set(Date.now()); this.updateFocus(); }, 1_000);

  constructor() {
    window.addEventListener("focus", this.updateFocus);
    window.addEventListener("blur", this.updateFocus);
    document.addEventListener("focusin", this.updateFocus);
    this.updateFocus();
  }

  ngDoCheck(): void {
    const next = participantDebugScopeKey(this.state);
    if (next !== this.scope) {
      this.scope = next; this.source = null; this.snapshot.set(null); this.error.set("");
      this.fingerprint = ""; this.openPanes.clear(); this.testingConditionResults = [];
      this.tree = { id: "", testlet: null, unit: null, children: [] };
      this.systemRequest?.abort(); this.apiStatus.set("not checked"); this.systemError.set("");
      void this.loadSnapshot(next);
    }
    this.projectSnapshot();
  }

  ngOnDestroy(): void {
    this.stopped = true; this.generation++; this.request?.abort(); this.systemRequest?.abort();
    window.clearInterval(this.tick);
    window.removeEventListener("focus", this.updateFocus); window.removeEventListener("blur", this.updateFocus);
    document.removeEventListener("focusin", this.updateFocus);
  }

  private async loadSnapshot(scope: string): Promise<void> {
    this.request?.abort();
    const controller = new AbortController(), generation = ++this.generation;
    this.request = controller;
    try {
      const source = await readParticipantDebugSnapshot(this.state, controller.signal);
      if (this.stopped || controller.signal.aborted || generation !== this.generation ||
        scope !== participantDebugScopeKey(this.state)) return;
      this.source = source; this.projectSnapshot();
    } catch (error) {
      if (!this.stopped && !controller.signal.aborted && generation === this.generation &&
        scope === participantDebugScopeKey(this.state)) this.error.set(String(error));
    }
  }

  private projectSnapshot(): void {
    if (!this.source || this.stopped || this.scope !== participantDebugScopeKey(this.state)) return;
    const responses = this.localResponses;
    const fingerprint = JSON.stringify([responses, this.state.testRun.presetBookletStates, this.state.testRun.bookletStateOverrides]);
    if (fingerprint === this.fingerprint) return;
    this.fingerprint = fingerprint;
    try {
      this.snapshot.set(buildParticipantDebugSnapshot(this.source.booklet, { ...this.state.testRun,
        unitResponses: { ...this.state.testRun.unitResponses, ...responses } }));
      this.tree = this.buildTree(this.source.booklet);
    } catch (error) { this.snapshot.set(null); this.error.set(String(error)); }
  }

  toggleWindow(id: ParticipantDebugWindow): void { this.control.toggleWindow(id); }
  get localResponses(): Record<string, string> { return readParticipantDebugResponses(this.state, this.view.debugResponseCaptures); }
  closeWindow(id: ParticipantDebugWindow): void { this.control.closeWindow(id); }
  toggleMore(id: string): void { if (this.openPanes.has(id)) this.openPanes.delete(id); else this.openPanes.add(id); }
  properties(value: unknown): Array<[string, string]> {
    return value && typeof value === "object" ? Object.entries(value).map(([key, item]) => [key, this.text(item)]) : [];
  }
  text(value: unknown): string { return value && typeof value === "object" ? JSON.stringify(value) : String(value ?? ""); }
  get status(): string { return this.view.hasControllerError ? "ERROR" : this.state.testRun.status === "paused" ? "PAUSED" :
    this.state.testRun.status === "completed" ? "TERMINATED" : this.view.eagerBookletLoading ? "LOADING" : "RUNNING"; }
  get timers(): Array<[string, number]> {
    return Object.entries(this.state.testRun.testletTimers ?? {}).map(([key, timer]) => [key,
      (timer.status === "running" && timer.expiresAt ? Math.min(timer.durationSeconds, Math.max(0, (Date.parse(timer.expiresAt) - this.now()) / 1000)) : timer.remainingSeconds) / 60]);
  }
  get config(): Array<[string, string]> { return participantDebugConfigEntries(this.state.booklet.policy.sourceConfig); }
  get mode(): Array<[string, string]> { return participantDebugModeEntries(this.state.executionMode); }
  get customTexts(): Record<string, string> {
    return { ...originalParticipantCustomTextDefaults, ...this.settings.settings().customTexts,
      ...this.state.participantRosterEntry?.customTexts, ...this.source?.booklet.customTexts };
  }
  get customTextKeys(): string[] { return Object.keys(this.customTexts).sort(); }
  get selectedCustomText(): string {
    const texts = this.customTexts;
    return Object.hasOwn(texts, this.searchCustomText) ? texts[this.searchCustomText]! : "";
  }
  openCustomTextOptions(event: Event): void {
    this.customTextInput = event.target as HTMLInputElement;
    const rect = this.customTextInput.getBoundingClientRect();
    this.customTextOptionsPosition = { top: rect.bottom, left: rect.left, width: rect.width };
    this.customTextOptionIndex = -1; this.customTextOptionsOpen = true;
  }
  selectCustomText(key: string): void {
    this.searchCustomText = key; this.customTextOptionsOpen = false; this.customTextInput?.focus();
  }
  customTextKeydown(event: KeyboardEvent): void {
    const keys = this.customTextKeys;
    if (event.key === "Escape" || event.key === "Tab") { this.customTextOptionsOpen = false; return; }
    if (event.key === "Enter" && this.customTextOptionsOpen && this.customTextOptionIndex >= 0) {
      event.preventDefault(); this.selectCustomText(keys[this.customTextOptionIndex]!); return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && keys.length) {
      event.preventDefault(); if (!this.customTextOptionsOpen) this.openCustomTextOptions(event);
      this.customTextOptionIndex = this.customTextOptionIndex < 0 ? (event.key === "ArrowDown" ? 0 : keys.length - 1) :
        (this.customTextOptionIndex + (event.key === "ArrowDown" ? 1 : -1) + keys.length) % keys.length;
      this.customTextInput?.ownerDocument.getElementById(`participant-debug-customtext-${this.customTextOptionIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }
  get currentUnit(): ContentReleaseUnitEntry | null {
    return this.snapshot()?.booklet.unitEntries.find(unit => unit.unitKey === this.state.currentUnit.unitKey) ?? null;
  }
  get connection(): string {
    const connection = this.view.participantConnectionState;
    return `${connection.status} (${connection.detail})`;
  }

  private buildTree(booklet: ParticipantDebugSnapshot["booklet"]): DebugTree {
    const root: DebugTree = { id: "", testlet: null, unit: null, children: [] };
    const testlets = new Map((booklet.testletEntries ?? []).map(testlet => [testlet.testletKey,
      { id: testlet.testletKey, testlet, unit: null, children: [] } as DebugTree]));
    for (const node of testlets.values()) (testlets.get(node.testlet?.parentTestletKey ?? "") ?? root).children.push(node);
    for (const unit of booklet.unitEntries) (testlets.get(unit.testletPath?.at(-1) ?? "") ?? root)
      .children.push({ id: unit.unitKey, testlet: null, unit, children: [] });
    // Keep the authored Unit sequence, including direct Units mixed with nested Testlets.
    const sequence = new Map(booklet.unitEntries.map((unit, index) => [unit.unitKey, index]));
    const order = (node: DebugTree): number => node.unit ? sequence.get(node.unit.unitKey)! :
      Math.min(...node.children.map(order), Number.MAX_SAFE_INTEGER);
    const sort = (node: DebugTree): void => { node.children.sort((a, b) => order(a) - order(b)); node.children.forEach(sort); };
    sort(root); return root;
  }

  badges(testlet: ContentReleaseTestletEntry | null): DebugBadge[] {
    const restrictions = testlet?.restrictions ?? this.source?.booklet.rootRestrictions;
    if (!restrictions) return [];
    const key = testlet?.testletKey ?? "";
    const timer = this.state.testRun.testletTimers?.[key];
    const badges: DebugBadge[] = [];
    if (restrictions.timeMax) badges.push({ label: "T", title: `${restrictions.timeMax.minutes}min`, active: timer?.status === "expired" });
    if (testlet?.restrictions?.codeToEnter) badges.push({ label: "C", title: "codeToEnter", active: !this.state.testRun.unlockedTestletKeys?.includes(key) });
    const completeness = restrictions.denyNavigationOnIncomplete;
    if (completeness?.presentation && completeness.presentation !== "off") badges.push({
      label: completeness.presentation === "always" ? "P" : "p", title: `denyNavigation on presentation ${completeness.presentation === "always" ? "ALWAYS" : "ON"}` });
    if (completeness?.response && completeness.response !== "off") badges.push({
      label: completeness.response === "always" ? "R" : "r", title: `denyNavigation on response ${completeness.response === "always" ? "ALWAYS" : "ON"}` });
    if (testlet?.restrictions?.lockAfterLeaving) badges.push({
      label: testlet.restrictions.lockAfterLeaving.scope === "unit" ? "U" : "L", title: "lockAfterLeaving" });
    const show = testlet?.restrictions?.show;
    if (show) badges.push({ label: "I", title: `SHOW IF ${show.stateKey} IS ${show.optionKey}`,
      active: this.snapshot()?.adaptiveStates.find(state => state.stateKey === show.stateKey)?.optionKey === show.optionKey });
    return badges;
  }

  testletProperties(node: DebugTree): Array<[string, string]> {
    const key = node.id;
    const restrictions = node.testlet?.restrictions ?? this.source?.booklet.rootRestrictions ?? {};
    const locked = this.state.testRun.lockedTestletKeys?.includes(key);
    return [...this.properties(node.testlet ? { label: node.testlet.displayLabel, parent: node.testlet.parentTestletKey } : {}),
      ...this.properties(restrictions).map(([name, value]): [string, string] => [`restrictions.${name}`, value]),
      ["locks.code", String(Boolean(node.testlet?.restrictions?.codeToEnter && !this.state.testRun.unlockedTestletKeys?.includes(key)))],
      ["locks.time", String(this.state.testRun.testletTimers?.[key]?.status === "expired")],
      ["locks.leave", String(Boolean(locked))], ["locked", locked ? `THROUGH ${key}` : "NO"]];
  }

  unitProperties(unit: ContentReleaseUnitEntry): Array<[string, string]> {
    const index = this.source!.booklet.unitEntries.findIndex(entry => entry.unitKey === unit.unitKey);
    const response = parseVeronaUnitResponse(this.localResponses[unit.unitKey]);
    let scheme = "";
    if (unit.codingScheme) {
      try { scheme = CodingSchemeTextFactory.asText(new CodingScheme(unit.codingScheme).variableCodings).map(item => item.label || item.id).join(); }
      catch (error) { scheme = String(error); }
    }
    return [["sequenceId", String(index + 1)], ["id", unit.originalUnitId ?? unit.unitKey], ["alias", unit.unitKey],
      ["label", unit.displayLabel], ["labelShort", unit.shortLabel ?? ""], ["player", unit.playerKey ?? ""],
      ["locked", String(this.state.bookletUnits.find(entry => entry.unitKey === unit.unitKey)?.isLocked ?? false)],
      ["parent", unit.testletPath?.at(-1) ?? "<units>"], ["definition", `${(unit.unitDefinition ?? "").slice(0, 20)} ...`],
      ...this.properties(response?.unitState).filter(([key]) => key !== "dataParts").map(([key, value]): [string, string] => [`state.${key}`, value]),
      ["loadingProgress: bookletUnits", `${this.view.bookletLoadedUnitCount}/${this.state.bookletUnits.length}`], ["scheme", scheme]];
  }
  unitTitle(unit: ContentReleaseUnitEntry): string {
    const index = this.source!.booklet.unitEntries.findIndex(entry => entry.unitKey === unit.unitKey);
    return `${index + 1}: ${unit.unitKey}${unit.originalUnitId && unit.originalUnitId !== unit.unitKey ? ` (${unit.originalUnitId})` : ""}`;
  }
  stateLabel(key: string): string { return this.source?.booklet.stateEntries?.find(state => state.stateKey === key)?.displayLabel ?? ""; }
  optionLabel(key: string, option: string): string { return this.source?.booklet.stateEntries?.find(state => state.stateKey === key)
    ?.options.find(entry => entry.optionKey === option)?.displayLabel ?? ""; }
  selectedOption(key: string): string | null { return this.snapshot()?.adaptiveStates.find(state => state.stateKey === key)?.optionKey ?? null; }
  automaticBadge(key: string, option: string): boolean {
    const state = this.snapshot()?.adaptiveStates.find(state => state.stateKey === key);
    const defaultKey = this.snapshot()?.states.find(state => state.stateKey === key)?.defaultOptionKey;
    return Boolean(state?.overrideOptionKey && state.overrideOptionKey !== state.automaticOptionKey &&
      state.automaticOptionKey === option && option !== defaultKey);
  }

  evaluateTestingCondition(): void {
    const snapshot = this.snapshot();
    if (!snapshot) { this.testingConditionResults = []; return; }
    try {
      const xml = this.testingCondition.replace(/^\uFEFF/gm, "");
      if (xml.length > 32_768 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("A condition must be XML without a document type and at most 32768 characters.");
      const document = new DOMParser().parseFromString(xml, "text/xml");
      if (document.documentElement.nodeName === "parsererror" || document.getElementsByTagName("parsererror").length) {
        throw new Error(document.documentElement.textContent ?? "Invalid XML.");
      }
      this.testingConditionResults = evaluateParticipantDebugConditions(snapshot, parseParticipantDebugConditionElement(document.documentElement))
        .map(value => value ? "Satisfied" : "Not Satisfied");
    } catch (error) { this.testingConditionResults = [String(error)]; }
  }

  async refreshSystem(): Promise<void> {
    this.systemRequest?.abort();
    const controller = new AbortController(), scope = this.scope;
    this.systemRequest = controller; this.apiStatus.set("checking"); this.systemError.set("");
    try {
      const response = await fetch("/healthz", { cache: "no-store", signal: controller.signal });
      const body: unknown = await response.json();
      if (!response.ok || (body as { status?: unknown } | null)?.status !== "ok") throw new Error(`HTTP ${response.status}`);
      if (!this.stopped && !controller.signal.aborted && scope === participantDebugScopeKey(this.state)) this.apiStatus.set("ok");
    } catch (error) {
      if (!this.stopped && !controller.signal.aborted && scope === participantDebugScopeKey(this.state)) {
        this.apiStatus.set("unavailable"); this.systemError.set(String(error));
      }
    }
  }
}
