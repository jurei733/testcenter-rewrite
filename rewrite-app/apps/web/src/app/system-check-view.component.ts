import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import {
  productionApiRoutes,
  resolveRoutePath,
  type GetSystemCheckResponse,
  type ListSystemCheckReportsResponse,
  type ListSystemChecksResponse,
  type SaveSystemCheckReportRequest,
  type SaveSystemCheckReportResponse,
  type SystemCheckSpeedTestUploadResponse
} from "@testcenter-rewrite-app/contracts";
import type {
  SystemCheckReport,
  SystemCheckReportEntry,
  SystemCheckSpeedParameters,
  WorkspaceSystemCheck
} from "@testcenter-rewrite-app/domain";

import { downloadBlobFile, downloadTextFile } from "./download-text-file";
import { RewriteAppApiService } from "./rewrite-app-api.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import { VeronaPlayerHostComponent } from "./verona-player-host.component";

type SystemCheckStep =
  | "welcome"
  | "environment"
  | "network"
  | "questionnaire"
  | "unit"
  | "report";

type BrowserConnection = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  type?: string;
};

type SystemCheckNetworkRating = "good" | "ok" | "insufficient" | "unstable";

type ThroughputResult = {
  bytesPerSecond: number;
  unstable: boolean;
  repetitions: number;
};

@Component({
  selector: "app-system-check-view",
  standalone: true,
  imports: [CommonModule, FormsModule, VeronaPlayerHostComponent],
  template: `
    <div class="stack system-check-shell">
      <article class="card system-check-hero">
        <div>
          <span class="eyebrow">Device readiness</span>
          <h2>Check this device before testing</h2>
          <p>Environment, network, questionnaire and the configured Verona item are collected in one report.</p>
        </div>
        <strong id="systemCheckStepStatus">{{ stepNumber }} / {{ steps.length }} · {{ stepLabel }}</strong>
      </article>

      <article class="card" *ngIf="!systemCheck">
        <h2>Choose a system check</h2>
        <div class="form-grid">
          <label>Tenant Key<input id="systemCheckTenantKey" [(ngModel)]="tenantKey" /></label>
          <label>Workspace Key<input id="systemCheckWorkspaceKey" [(ngModel)]="workspaceKey" /></label>
        </div>
        <div class="actions">
          <button id="loadSystemChecksButton" class="primary" type="button" [disabled]="busy || !canLoad" (click)="loadSystemChecks()">Load Checks</button>
        </div>
        <section class="system-check-options" *ngIf="systemChecks.length > 0">
          <button
            *ngFor="let item of systemChecks"
            type="button"
            class="system-check-option"
            [attr.data-system-check-id]="item.checkId"
            (click)="selectSystemCheck(item.checkId)"
          >
            <strong>{{ item.displayLabel }}</strong>
            <span>{{ item.checkId }}</span>
            <small>{{ item.description || 'No description provided.' }}</small>
          </button>
        </section>
      </article>

      <ng-container *ngIf="systemCheck as check">
        <nav class="system-check-steps" aria-label="System check steps">
          <button
            *ngFor="let item of steps; let index = index"
            type="button"
            [class.is-current]="item === step"
            [class.is-complete]="index < stepIndex"
            [disabled]="index > stepIndex"
            (click)="setStep(item)"
          >{{ stepName(item) }}</button>
        </nav>

        <article class="card" *ngIf="step === 'welcome'">
          <span class="eyebrow">{{ check.checkId }}</span>
          <h2>{{ check.displayLabel }}</h2>
          <p id="systemCheckIntroText">{{ customText('syscheck_intro', 'This check verifies whether the current device is ready for a test session.') }}</p>
          <p *ngIf="check.description">{{ check.description }}</p>
          <dl class="system-check-facts">
            <div><dt>Network</dt><dd>{{ check.skipNetwork ? 'Skipped by configuration' : 'Measured' }}</dd></div>
            <div><dt>Questions</dt><dd>{{ interactiveQuestionCount }}</dd></div>
            <div><dt>Player item</dt><dd>{{ check.unit ? check.unit.unitKey : 'Not configured' }}</dd></div>
            <div><dt>Report</dt><dd>{{ check.canSave ? 'Can be saved with report key' : 'Local download only' }}</dd></div>
          </dl>
        </article>

        <article class="card" *ngIf="step === 'environment'">
          <h2>Environment</h2>
          <p>Values available to the browser are captured automatically. No fingerprint is retained until the report is saved.</p>
          <dl class="system-check-results">
            <div *ngFor="let entry of environmentEntries"><dt>{{ entry.label }}</dt><dd>{{ entry.value }}</dd></div>
          </dl>
          <button class="ghost" type="button" (click)="captureEnvironment()">Capture Again</button>
        </article>

        <article class="card" *ngIf="step === 'network'">
          <h2>Network</h2>
          <p>Configured upload and download packages measure throughput against this test server; application latency and browser-provided connection estimates are included.</p>
          <p id="systemCheckNetworkStatus">{{ networkStatusMessage }}</p>
          <div class="network-rating" [class.has-warning]="networkRating === 'insufficient' || networkRating === 'unstable'">
            <span>Overall rating</span>
            <strong id="systemCheckNetworkRating">{{ networkRating }}</strong>
          </div>
          <dl class="system-check-results" *ngIf="networkEntries.length > 0">
            <div *ngFor="let entry of networkEntries"><dt>{{ entry.label }}</dt><dd>{{ entry.value }}</dd></div>
          </dl>
          <button id="runSystemCheckNetworkButton" class="primary" type="button" [disabled]="networkBusy" (click)="runNetworkCheck()">
            {{ networkBusy ? 'Measuring…' : networkEntries.length ? 'Measure Again' : 'Run Network Check' }}
          </button>
        </article>

        <article class="card" *ngIf="step === 'questionnaire'">
          <h2>Questionnaire</h2>
          <p id="systemCheckQuestionsIntro">{{ customText('syscheck_questionsintro', 'Please answer all fields marked as required.') }}</p>
          <div class="system-check-questionnaire">
            <ng-container *ngFor="let question of check.questions">
              <h3 *ngIf="question.type === 'header'">{{ question.prompt }}</h3>
              <label *ngIf="question.type === 'string'">
                {{ question.prompt }}{{ question.required ? ' *' : '' }}
                <input [id]="'systemCheckQuestion-' + question.id" [(ngModel)]="answers[question.id]" />
              </label>
              <label *ngIf="question.type === 'text'">
                {{ question.prompt }}{{ question.required ? ' *' : '' }}
                <textarea [id]="'systemCheckQuestion-' + question.id" rows="4" [(ngModel)]="answers[question.id]"></textarea>
              </label>
              <label *ngIf="question.type === 'select'">
                {{ question.prompt }}{{ question.required ? ' *' : '' }}
                <select [id]="'systemCheckQuestion-' + question.id" [(ngModel)]="answers[question.id]">
                  <option value="">Please choose</option>
                  <option *ngFor="let option of question.options" [value]="option">{{ option }}</option>
                </select>
              </label>
              <fieldset *ngIf="question.type === 'radio'">
                <legend>{{ question.prompt }}{{ question.required ? ' *' : '' }}</legend>
                <label *ngFor="let option of question.options" class="choice-row">
                  <input type="radio" [name]="'systemCheckQuestion-' + question.id" [value]="option" [(ngModel)]="answers[question.id]" />
                  {{ option }}
                </label>
              </fieldset>
              <label *ngIf="question.type === 'check'" class="choice-row">
                <input [id]="'systemCheckQuestion-' + question.id" type="checkbox" [(ngModel)]="answers[question.id]" />
                {{ question.prompt }}{{ question.required ? ' *' : '' }}
              </label>
            </ng-container>
          </div>
          <p class="validation-message" *ngIf="questionnaireIssue">{{ questionnaireIssue }}</p>
        </article>

        <article class="card" *ngIf="step === 'unit'">
          <h2>{{ customText('syscheck_unitPrompt', 'Player and unit') }}</h2>
          <p *ngIf="check.unit">Configured item: {{ check.unit.displayLabel }} ({{ check.unit.unitKey }})</p>
          <app-verona-player-host
            *ngIf="check.unit?.playerHtml && check.unit?.unitDefinition; else unresolvedUnit"
            [playerHtml]="check.unit!.playerHtml!"
            [playerKey]="check.unit!.playerKey || 'system-check-player'"
            testRunId="system-check"
            [unitKey]="check.unit!.unitKey"
            [unitTitle]="check.unit!.displayLabel"
            [unitDefinition]="check.unit!.unitDefinition!"
            [unitDefinitionType]="check.unit!.unitDefinitionType || ''"
            [canComplete]="true"
            [savedResponse]="unitResponse"
            (responseChange)="onUnitResponse($event)"
          ></app-verona-player-host>
          <ng-template #unresolvedUnit>
            <section class="system-check-notice has-warning">
              <strong>Player check unavailable</strong>
              <p>The definition references {{ check.unit?.unitKey }}, but its unit definition and Verona player are not present in accepted content.</p>
            </section>
          </ng-template>
        </article>

        <article class="card" *ngIf="step === 'report'">
          <h2>Report</h2>
          <p>The report contains {{ reportEntryCount }} measured or answered values.</p>
          <p *ngIf="check.canSave">{{ customText('syscheck_report_aboutReportId', 'Use a report title that lets operators assign this result to the intended study or location.') }}</p>
          <div class="form-grid" *ngIf="check.canSave">
            <label>{{ customText('syscheck_report_id', 'Report title') }}<input id="systemCheckReportTitle" [(ngModel)]="reportTitle" /></label>
            <label>Report key<input id="systemCheckReportKey" type="password" autocomplete="off" [(ngModel)]="reportKey" /></label>
          </div>
          <p *ngIf="check.canSave">{{ customText('syscheck_report_aboutPassword', 'Enter the system-check key supplied by the project operator to save this report.') }}</p>
          <div class="actions">
            <button id="downloadSystemCheckReportButton" class="secondary" type="button" (click)="downloadReport()">Download JSON</button>
            <button id="saveSystemCheckReportButton" *ngIf="check.canSave" class="primary" type="button" [disabled]="busy || !reportTitle.trim() || !reportKey.trim()" (click)="saveReport()">Save Report</button>
          </div>
          <section class="system-check-notice" *ngIf="savedReport">
            <strong id="systemCheckSavedReportStatus">Report saved</strong>
            <p>{{ savedReport.systemCheckReportId }} · {{ savedReport.createdAt }}</p>
          </section>
          <section class="system-check-operator">
            <h3>Operator report access</h3>
            <p>Signed-in workspace operators can inspect recent reports or export the original-style CSV.</p>
            <div class="actions">
              <button id="loadSystemCheckReportsButton" class="ghost" type="button" [disabled]="!hasAdminSession || busy" (click)="loadOperatorReports()">Load Reports</button>
              <button id="exportSystemCheckReportsButton" class="ghost" type="button" [disabled]="!hasAdminSession || busy" (click)="exportOperatorReports()">Export CSV</button>
            </div>
            <ol *ngIf="operatorReports.length > 0">
              <li *ngFor="let report of operatorReports"><strong>{{ report.title }}</strong><span>{{ report.createdAt }}</span></li>
            </ol>
            <small *ngIf="!hasAdminSession">Sign in under Diagnostics first.</small>
          </section>
        </article>

        <div class="actions system-check-navigation">
          <button id="systemCheckBackButton" class="ghost" type="button" [disabled]="stepIndex === 0" (click)="previousStep()">Back</button>
          <button id="systemCheckNextButton" class="primary" type="button" *ngIf="step !== 'report'" [disabled]="!canContinue" (click)="nextStep()">Next</button>
          <button class="ghost" type="button" (click)="chooseAnother()">Choose Another Check</button>
        </div>
      </ng-container>

      <section class="status-banner is-error" *ngIf="errorMessage" role="alert">
        <strong>System Check</strong><span>{{ errorMessage }}</span>
      </section>
    </div>
  `,
  styles: [`
    .system-check-shell { max-width: 980px; margin: 0 auto; }
    .system-check-hero { display: flex; justify-content: space-between; gap: 20px; align-items: center; }
    .system-check-hero h2 { font-size: clamp(26px, 5vw, 42px); }
    .system-check-hero > strong { padding: 10px 14px; border-radius: 999px; background: var(--secondary); color: white; white-space: nowrap; }
    .system-check-options { display: grid; gap: 12px; margin-top: 18px; }
    .system-check-option { display: grid; gap: 5px; padding: 18px; text-align: left; border: 1px solid var(--line); border-radius: var(--radius-lg); background: white; color: var(--ink); }
    .system-check-option span, .system-check-option small { color: var(--muted); }
    .system-check-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
    .system-check-steps button { border: 1px solid var(--line); background: rgba(255,255,255,.72); color: var(--muted); }
    .system-check-steps button.is-current { background: var(--ink); color: white; }
    .system-check-steps button.is-complete { background: var(--secondary-soft); color: var(--secondary); }
    .system-check-facts, .system-check-results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
    .system-check-facts div, .system-check-results div { padding: 14px; border-radius: var(--radius-md); background: rgba(27,36,48,.05); }
    dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    dd { margin: 6px 0 0; overflow-wrap: anywhere; }
    .network-rating { display: flex; justify-content: space-between; align-items: center; padding: 18px; margin: 16px 0; border-radius: var(--radius-lg); background: var(--secondary-soft); }
    .network-rating.has-warning, .system-check-notice.has-warning { background: var(--accent-soft); }
    .network-rating strong { font-size: 24px; }
    .system-check-questionnaire { display: grid; gap: 16px; }
    fieldset { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 14px; }
    .choice-row { display: flex; grid-template-columns: none; align-items: center; gap: 10px; color: var(--ink); }
    .choice-row input { width: auto; }
    .validation-message { color: var(--accent) !important; font-weight: 700; }
    .system-check-notice, .system-check-operator { margin-top: 18px; padding: 18px; border-radius: var(--radius-lg); background: var(--secondary-soft); }
    .system-check-operator { background: rgba(27,36,48,.05); }
    .system-check-operator ol { display: grid; gap: 8px; padding-left: 24px; }
    .system-check-operator li { padding: 8px; }
    .system-check-operator li span { display: block; color: var(--muted); font-size: 12px; }
    .system-check-navigation { justify-content: space-between; }
    @media (max-width: 680px) { .system-check-hero { display: grid; } .system-check-facts, .system-check-results { grid-template-columns: 1fr; } }
  `]
})
export class SystemCheckViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly api = inject(RewriteAppApiService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);

  tenantKey = this.uiState.workspace.tenantKey;
  workspaceKey = this.uiState.workspace.workspaceKey;
  systemChecks: WorkspaceSystemCheck[] = [];
  systemCheck: WorkspaceSystemCheck | null = null;
  step: SystemCheckStep = "welcome";
  answers: Record<string, string | boolean> = {};
  environmentEntries: SystemCheckReportEntry[] = [];
  networkEntries: SystemCheckReportEntry[] = [];
  networkRating = "not measured";
  networkStatusMessage = "Measurement has not started.";
  networkBusy = false;
  unitResponse = "";
  unitStartedAt = 0;
  unitLoadingTimeMs: number | null = null;
  reportTitle = "System Check Report";
  reportKey = "";
  savedReport: SystemCheckReport | null = null;
  operatorReports: SystemCheckReport[] = [];
  busy = false;
  errorMessage = "";
  questionnaireIssue = "";

  ngOnInit(): void {
    this.viewState.setActiveView("system-check");
    this.tenantKey =
      this.route.snapshot.queryParamMap.get("tenantKey")?.trim() || this.tenantKey;
    this.workspaceKey =
      this.route.snapshot.queryParamMap.get("workspaceKey")?.trim() ||
      this.workspaceKey;
    const checkId = this.route.snapshot.queryParamMap.get("checkId")?.trim();
    if (this.canLoad) {
      void this.loadSystemChecks(checkId || undefined);
    }
  }

  get canLoad(): boolean {
    return Boolean(this.tenantKey.trim() && this.workspaceKey.trim());
  }

  get steps(): SystemCheckStep[] {
    if (!this.systemCheck) {
      return ["welcome"];
    }
    return [
      "welcome",
      "environment",
      ...(this.systemCheck.skipNetwork ? [] : ["network" as const]),
      ...(this.interactiveQuestionCount > 0 ? ["questionnaire" as const] : []),
      ...(this.systemCheck.unit ? ["unit" as const] : []),
      "report"
    ];
  }

  get stepIndex(): number {
    return Math.max(0, this.steps.indexOf(this.step));
  }

  get stepNumber(): number {
    return this.stepIndex + 1;
  }

  get stepLabel(): string {
    return this.stepName(this.step);
  }

  get interactiveQuestionCount(): number {
    return this.systemCheck?.questions.filter(question => question.type !== "header")
      .length ?? 0;
  }

  get canContinue(): boolean {
    if (this.step === "network") {
      return this.networkEntries.length > 0 && !this.networkBusy;
    }
    if (this.step === "questionnaire") {
      return this.requiredQuestionsAnswered;
    }
    return !this.busy;
  }

  get requiredQuestionsAnswered(): boolean {
    return (
      this.systemCheck?.questions
        .filter(question => question.required && question.type !== "header")
        .every(question => {
          const value = this.answers[question.id];
          return question.type === "check" ? value === true : String(value ?? "").trim();
        }) ?? true
    );
  }

  get reportEntryCount(): number {
    return (
      this.environmentEntries.length +
      this.networkEntries.length +
      this.questionnaireEntries.length +
      this.unitEntries.length
    );
  }

  get questionnaireEntries(): SystemCheckReportEntry[] {
    return (this.systemCheck?.questions ?? []).flatMap(question => {
      if (question.type === "header") {
        return [];
      }
      const value = this.answers[question.id];
      return [{
        id: question.id,
        type: question.type,
        label: question.prompt,
        value:
          typeof value === "boolean" ? value : String(value ?? ""),
        warning: question.required && !value
      }];
    });
  }

  get unitEntries(): SystemCheckReportEntry[] {
    if (!this.systemCheck?.unit) {
      return [];
    }
    return [
      {
        id: "loading-time",
        type: "unit/player",
        label: "loading time",
        value: this.unitLoadingTimeMs,
        warning: !this.systemCheck.unit.playerHtml
      },
      {
        id: "unit-response",
        type: "unit/player",
        label: "unit response",
        value: this.unitResponse,
        warning: false
      }
    ];
  }

  get hasAdminSession(): boolean {
    return Boolean(this.uiState.ops.adminSessionToken.trim());
  }

  stepName(step: SystemCheckStep): string {
    return {
      welcome: "Start",
      environment: "Environment",
      network: "Network",
      questionnaire: "Questions",
      unit: "Player",
      report: "Report"
    }[step];
  }

  async loadSystemChecks(preferredCheckId?: string): Promise<void> {
    if (!this.canLoad) return;
    let selectedCheckId = "";
    await this.run(async () => {
      this.uiState.workspace.tenantKey = this.tenantKey.trim();
      this.uiState.workspace.workspaceKey = this.workspaceKey.trim();
      this.viewState.persistShellState();
      const { payload } = await this.api.send<ListSystemChecksResponse>(
        "GET",
        this.workspaceRoute(productionApiRoutes.workspace.listSystemChecks)
      );
      this.systemChecks = payload.items;
      const selected = preferredCheckId
        ? payload.items.find(
            item => item.checkId.toUpperCase() === preferredCheckId.toUpperCase()
          )
        : payload.items.length === 1
          ? payload.items[0]
          : undefined;
      selectedCheckId = selected?.checkId ?? "";
    });
    if (selectedCheckId) {
      await this.selectSystemCheck(selectedCheckId);
    }
  }

  async selectSystemCheck(checkId: string): Promise<void> {
    await this.run(async () => {
      const { payload } = await this.api.send<GetSystemCheckResponse>(
        "GET",
        this.workspaceRoute(productionApiRoutes.workspace.getSystemCheck, {
          checkId
        })
      );
      this.systemCheck = payload.systemCheck;
      this.reportTitle = `${payload.systemCheck.displayLabel} Report`;
      this.answers = {};
      this.networkEntries = [];
      this.networkRating = payload.systemCheck.skipNetwork ? "skipped" : "not measured";
      this.networkStatusMessage = payload.systemCheck.skipNetwork
        ? "Network measurement is skipped by configuration."
        : "Measurement has not started.";
      this.unitResponse = "";
      this.unitLoadingTimeMs = null;
      this.savedReport = null;
      this.operatorReports = [];
      this.step = "welcome";
      this.captureEnvironment();
    });
  }

  chooseAnother(): void {
    this.systemCheck = null;
    this.step = "welcome";
    this.errorMessage = "";
  }

  setStep(step: SystemCheckStep): void {
    if (!this.steps.includes(step)) return;
    this.step = step;
    if (step === "unit" && !this.unitStartedAt) {
      this.unitStartedAt = performance.now();
    }
  }

  previousStep(): void {
    const previous = this.steps[this.stepIndex - 1];
    if (previous) this.setStep(previous);
  }

  nextStep(): void {
    if (!this.canContinue) {
      if (this.step === "questionnaire") {
        this.questionnaireIssue = this.customText(
          "syscheck_questionsRequiredMessage",
          "Please complete all required questions."
        );
      }
      return;
    }
    this.questionnaireIssue = "";
    const next = this.steps[this.stepIndex + 1];
    if (next) this.setStep(next);
  }

  captureEnvironment(): void {
    const userAgent = navigator.userAgent;
    const browser = /Edg\//.test(userAgent)
      ? "Edge"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Unknown";
    const os = /Windows/i.test(userAgent)
      ? "Windows"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone|iPad/i.test(userAgent)
          ? "iOS/iPadOS"
          : /Mac OS/i.test(userAgent)
            ? "macOS"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "Unknown";
    this.environmentEntries = [
      this.entry("os", "environment", "Betriebssystem", os),
      this.entry(
        "screen",
        "environment",
        "Bildschirm-Auflösung",
        `${screen.width} x ${screen.height}`
      ),
      this.entry("browser", "environment", "Browser", browser),
      this.entry(
        "cookies",
        "environment",
        "Browser-Cookies aktiviert",
        navigator.cookieEnabled
      ),
      this.entry(
        "language",
        "environment",
        "Browser-Sprache",
        navigator.language
      ),
      this.entry(
        "cores",
        "environment",
        "CPU-Kerne",
        navigator.hardwareConcurrency || "unknown"
      ),
      this.entry(
        "viewport",
        "environment",
        "Fenster-Größe",
        `${window.innerWidth} x ${window.innerHeight}`
      )
    ];
  }

  async runNetworkCheck(): Promise<void> {
    const check = this.systemCheck;
    if (!check) return;
    this.networkBusy = true;
    this.errorMessage = "";
    this.networkStatusMessage = "Measuring application latency…";
    this.changeDetectorRef.detectChanges();
    try {
      const measurements: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        const startedAt = performance.now();
        const response = await fetch(`/healthz?systemCheck=${Date.now()}-${index}`, {
          method: "HEAD",
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`Health request returned HTTP ${response.status}.`);
        measurements.push(performance.now() - startedAt);
      }
      const average = measurements.reduce((sum, value) => sum + value, 0) /
        measurements.length;
      this.networkStatusMessage = "Measuring configured download packages…";
      this.changeDetectorRef.detectChanges();
      const download = await this.measureThroughput("download", check.downloadSpeed);
      this.networkStatusMessage = "Measuring configured upload packages…";
      this.changeDetectorRef.detectChanges();
      const upload = await this.measureThroughput("upload", check.uploadSpeed);
      const downloadRating = this.rateThroughput(
        download,
        check.downloadSpeed.min,
        check.downloadSpeed.good
      );
      const uploadRating = this.rateThroughput(
        upload,
        check.uploadSpeed.min,
        check.uploadSpeed.good
      );
      this.networkRating = this.overallNetworkRating(
        downloadRating,
        uploadRating
      );
      const connection = (navigator as Navigator & { connection?: BrowserConnection })
        .connection;
      this.networkEntries = [
        this.entry("nw-download", "network", "Downloadgeschwindigkeit", this.humanReadableBitsPerSecond(download.bytesPerSecond)),
        this.entry("nw-download-needed", "network", "Downloadgeschwindigkeit benötigt", this.humanReadableBitsPerSecond(check.downloadSpeed.min)),
        this.entry("nw-download-evaluation", "network", "Downloadbewertung", downloadRating, downloadRating === "insufficient" || downloadRating === "unstable"),
        this.entry("nw-upload", "network", "Uploadgeschwindigkeit", this.humanReadableBitsPerSecond(upload.bytesPerSecond)),
        this.entry("nw-upload-needed", "network", "Uploadgeschwindigkeit benötigt", this.humanReadableBitsPerSecond(check.uploadSpeed.min)),
        this.entry("nw-upload-evaluation", "network", "Uploadbewertung", uploadRating, uploadRating === "insufficient" || uploadRating === "unstable"),
        this.entry("latency", "network", "RoundTrip in Ms", average.toFixed(1), average >= 400),
        this.entry("nw-overall", "network", "Gesamtbewertung", this.networkRating, this.networkRating === "insufficient" || this.networkRating === "unstable"),
        this.entry("bnni-effective-network-type", "network", "Netzwerktyp nach Leistung", connection?.effectiveType ?? "not available"),
        this.entry("bnni-downlink", "network", "Downlink MB/s", connection?.downlink ?? "not available"),
        this.entry("bnni-roundtrip", "network", "Browser RoundTrip in Ms", connection?.rtt ?? "not available"),
        this.entry("bnni-network-type", "network", "Netzwerktyp", connection?.type ?? "not available")
      ];
      this.networkStatusMessage = `Measurement complete after ${download.repetitions} download and ${upload.repetitions} upload sequence(s).`;
    } catch (error) {
      this.networkRating = "insufficient";
      this.networkEntries = [
        this.entry("nw-overall", "network", "Gesamtbewertung", "insufficient", true)
      ];
      this.networkStatusMessage = "Network measurement failed.";
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.networkBusy = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  customText(key: string, fallback: string): string {
    return this.systemCheck?.customTexts[key]?.trim() || fallback;
  }

  onUnitResponse(response: string): void {
    this.unitResponse = response;
    if (this.unitLoadingTimeMs == null && this.unitStartedAt) {
      this.unitLoadingTimeMs = Math.round(performance.now() - this.unitStartedAt);
    }
  }

  downloadReport(): void {
    downloadTextFile({
      filename: `${this.systemCheck?.checkId ?? "system-check"}-report.json`,
      mediaType: "application/json;charset=UTF-8",
      text: `${JSON.stringify(this.reportPayload(false), null, 2)}\n`
    });
  }

  async saveReport(): Promise<void> {
    const check = this.systemCheck;
    if (!check) return;
    await this.run(async () => {
      const { payload } = await this.api.send<SaveSystemCheckReportResponse>(
        "POST",
        this.workspaceRoute(productionApiRoutes.workspace.saveSystemCheckReport, {
          checkId: check.checkId
        }),
        this.reportPayload(true)
      );
      this.savedReport = payload.report;
      this.reportKey = "";
    });
  }

  async loadOperatorReports(): Promise<void> {
    const check = this.systemCheck;
    if (!check || !this.hasAdminSession) return;
    await this.run(async () => {
      const path = `${this.workspaceRoute(
        productionApiRoutes.workspace.listSystemCheckReports
      )}?checkId=${encodeURIComponent(check.checkId)}&limit=25`;
      const { payload } = await this.api.send<ListSystemCheckReportsResponse>(
        "GET",
        path,
        undefined,
        this.adminHeaders
      );
      this.operatorReports = payload.items;
    });
  }

  async exportOperatorReports(): Promise<void> {
    const check = this.systemCheck;
    if (!check || !this.hasAdminSession) return;
    await this.run(async () => {
      const path = `${this.workspaceRoute(
        productionApiRoutes.workspace.exportSystemCheckReportsCsv
      )}?checkId=${encodeURIComponent(check.checkId)}`;
      const download = await this.api.download(path, this.adminHeaders);
      downloadBlobFile({
        filename: download.filename || `${this.workspaceKey}-system-check-reports.csv`,
        blob: download.blob
      });
    });
  }

  private async measureThroughput(
    direction: "download" | "upload",
    parameters: SystemCheckSpeedParameters
  ): Promise<ThroughputResult> {
    const sequenceSizes = parameters.sequenceSizes.filter(
      size => Number.isSafeInteger(size) && size >= 16 && size <= 64 * 1024 * 1024
    );
    if (sequenceSizes.length === 0) {
      throw new Error(`No supported ${direction} package sizes are configured.`);
    }

    const maxRepetitions = Math.max(
      1,
      Math.min(parameters.maxSequenceRepetitions || 1, 15)
    );
    const sequenceAverages: number[] = [];
    let unstable = false;

    for (let repetition = 1; repetition <= maxRepetitions; repetition += 1) {
      const successfulSpeeds: number[] = [];
      let errors = 0;
      for (const size of sequenceSizes) {
        try {
          successfulSpeeds.push(
            await this.measureSpeedTestPackage(direction, size, repetition)
          );
        } catch {
          errors += 1;
        }
      }
      if (errors > parameters.maxErrorsPerSequence || successfulSpeeds.length === 0) {
        unstable = true;
        break;
      }

      const sequenceAverage = successfulSpeeds.reduce((sum, speed) => sum + speed, 0) /
        successfulSpeeds.length;
      const previousAverage = sequenceAverages.length > 0
        ? sequenceAverages.reduce((sum, speed) => sum + speed, 0) /
          sequenceAverages.length
        : null;
      sequenceAverages.push(sequenceAverage);
      const stable =
        sequenceAverages.length >= 3 &&
        previousAverage != null &&
        Math.abs(previousAverage - sequenceAverage) <=
          parameters.maxDevianceBytesPerSecond;
      if (stable) break;
    }

    const bytesPerSecond = sequenceAverages.length > 0
      ? sequenceAverages.reduce((sum, speed) => sum + speed, 0) /
        sequenceAverages.length
      : 0;
    return {
      bytesPerSecond,
      unstable,
      repetitions: sequenceAverages.length
    };
  }

  private async measureSpeedTestPackage(
    direction: "download" | "upload",
    size: number,
    repetition: number
  ): Promise<number> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      direction === "download" ? 45_000 : 10_000
    );
    const startedAt = performance.now();
    try {
      if (direction === "download") {
        const path = resolveRoutePath(
          productionApiRoutes.system.downloadSpeedTestPackage,
          { size: String(size) }
        );
        const response = await fetch(
          `${path}?round=${repetition}&uid=${Date.now()}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Download speed test returned HTTP ${response.status}.`);
        }
        const body = await response.arrayBuffer();
        if (body.byteLength !== size) {
          throw new Error(`Download speed test returned ${body.byteLength} of ${size} bytes.`);
        }
      } else {
        const response = await fetch(
          productionApiRoutes.system.uploadSpeedTestPackage,
          {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "a".repeat(size),
            cache: "no-store",
            signal: controller.signal
          }
        );
        if (!response.ok) {
          throw new Error(`Upload speed test returned HTTP ${response.status}.`);
        }
        const payload = await response.json() as SystemCheckSpeedTestUploadResponse;
        if (payload.packageReceivedSize !== size) {
          throw new Error(
            `Upload speed test received ${payload.packageReceivedSize} of ${size} bytes.`
          );
        }
      }
      const durationMs = Math.max(performance.now() - startedAt, 0.1);
      return size / (durationMs / 1000);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private rateThroughput(
    result: ThroughputResult,
    minimum: number,
    good: number
  ): SystemCheckNetworkRating {
    if (result.unstable) return "unstable";
    if (result.bytesPerSecond < minimum) return "insufficient";
    if (result.bytesPerSecond < good) return "ok";
    return "good";
  }

  private overallNetworkRating(
    download: SystemCheckNetworkRating,
    upload: SystemCheckNetworkRating
  ): SystemCheckNetworkRating {
    const ratings: SystemCheckNetworkRating[] = [download, upload];
    if (ratings.includes("unstable")) return "unstable";
    if (ratings.includes("insufficient")) return "insufficient";
    if (ratings.includes("ok")) return "ok";
    return "good";
  }

  private humanReadableBitsPerSecond(bytesPerSecond: number): string {
    const bitsPerSecond = Math.max(0, bytesPerSecond) * 8;
    const units = ["bit/s", "kbit/s", "Mbit/s", "Gbit/s"];
    let value = bitsPerSecond;
    let unitIndex = 0;
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex += 1;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  private reportPayload(includeKey: boolean): SaveSystemCheckReportRequest {
    return {
      ...(includeKey ? { keyPhrase: this.reportKey } : {}),
      title: this.reportTitle,
      responses: this.unitResponse,
      environment: this.environmentEntries,
      network: this.networkEntries,
      questionnaire: this.questionnaireEntries,
      unit: this.unitEntries
    };
  }

  private entry(
    id: string,
    type: string,
    label: string,
    value: string | number | boolean | null,
    warning = false
  ): SystemCheckReportEntry {
    return { id, type, label, value, warning };
  }

  private workspaceRoute(
    route: string,
    extra: Record<string, string> = {}
  ): string {
    return resolveRoutePath(route, {
      tenantKey: this.tenantKey.trim(),
      workspaceKey: this.workspaceKey.trim(),
      ...extra
    });
  }

  private get adminHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.uiState.ops.adminSessionToken.trim()}` };
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorMessage = "";
    try {
      await action();
    } catch (error) {
      this.errorMessage = this.api.isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    } finally {
      this.busy = false;
      this.changeDetectorRef.detectChanges();
    }
  }
}
