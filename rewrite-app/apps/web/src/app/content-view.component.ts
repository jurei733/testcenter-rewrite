import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ContentViewFacade } from "./content-view.facade";
import { JsonPanelComponent } from "./json-panel.component";
import { RecordCollectionComponent } from "./record-collection.component";
import { SummaryCardsComponent } from "./summary-cards.component";

@Component({
  selector: "app-content-view",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JsonPanelComponent,
    SummaryCardsComponent,
    RecordCollectionComponent
  ],
  template: `
    <div class="stack">
      <article class="card">
        <h2>Content Intake</h2>
        <div class="form-grid full">
          <label>
            Source File Name
            <input id="sourceFileName" name="sourceFileName" [(ngModel)]="view.content.sourceFileName" (change)="view.persistState()" />
          </label>
          <label>
            Media Type
            <input id="sourceMediaType" name="sourceMediaType" [(ngModel)]="view.content.sourceMediaType" (change)="view.persistState()" />
          </label>
          <label>
            Load Source Document File
            <input id="sourceDocumentFile" name="sourceDocumentFile" type="file" accept=".xml,.json,.imsmanifest,.manifest,application/xml,text/xml,application/json" (change)="view.loadSourceDocumentFile($event)" />
          </label>
          <label>
            Source Document
            <textarea id="sourceDocument" name="sourceDocument" [(ngModel)]="view.content.sourceDocument" (change)="view.persistState()"></textarea>
          </label>
          <label>
            Source Package Id
            <input id="sourcePackageId" name="sourcePackageId" placeholder="Use an id returned from create/list" [(ngModel)]="view.content.sourcePackageId" (change)="view.persistState()" />
          </label>
          <label>
            Content Release Id
            <input id="contentReleaseId" name="contentReleaseId" placeholder="Use an id returned from import/list" [(ngModel)]="view.content.contentReleaseId" (change)="view.persistState()" />
          </label>
          <label>
            Import Job Id
            <input id="importJobId" name="importJobId" placeholder="Use an id returned from import/list" [(ngModel)]="view.content.importJobId" (change)="view.persistState()" />
          </label>
          <label>
            Force Activation
            <span class="inline-toggle">
              <input id="forceActivation" name="forceActivation" type="checkbox" [(ngModel)]="view.content.forceActivation" (change)="view.persistState()" />
              Override open-run guard for activation
            </span>
          </label>
        </div>
        <div class="actions">
          <button id="createSourcePackageButton" class="primary" type="button" [disabled]="!view.canCreateSourcePackage" (click)="view.createSourcePackage()">Create Source Package</button>
          <button id="createImportJobButton" class="secondary" type="button" [disabled]="!view.canCreateImportJob" (click)="view.createImportJob()">Create Import Job</button>
          <button id="activateContentReleaseButton" class="ghost" type="button" [disabled]="!view.canUseSelectedContentRelease" (click)="view.confirmActivateContentRelease()">Activate Release</button>
          <button id="refreshContentReadsButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.refreshContentReads()">Refresh Content Reads</button>
          <button class="ghost" type="button" (click)="view.restoreDemoSource()">Restore Demo Source</button>
        </div>
      </article>

      <app-record-collection
        title="Draft Source Document Preview"
        subtitle="Quick validation of the file currently staged for source-package intake."
        [items]="view.draftSourceDocumentPreviewItems"
        emptyState="Load or paste a source document to preview the staged package payload."
      ></app-record-collection>

      <article class="card">
        <h2>Content Snapshot</h2>
        <p>Keep the latest package, import, release, and activation-guard state visible while you work through intake and rollout.</p>
        <app-summary-cards [cards]="view.contentCards"></app-summary-cards>
      </article>

      <article class="card">
        <h2>Content Read Filters</h2>
        <p>Narrow operator reads across source packages, import jobs, and releases before refreshing the content snapshot.</p>
        <div class="form-grid full">
          <label>
            Source Package Status
            <select id="sourcePackageStatusFilter" name="sourcePackageStatusFilter" [(ngModel)]="view.content.sourcePackageStatusFilter" (change)="view.persistState()">
              <option value="">All package statuses</option>
              <option *ngFor="let status of view.sourcePackageStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Source Package Media Type
            <input id="sourcePackageMediaTypeFilter" name="sourcePackageMediaTypeFilter" placeholder="application/xml" [(ngModel)]="view.content.sourcePackageMediaTypeFilter" (change)="view.persistState()" />
          </label>
          <label>
            Source Package File Name
            <input id="sourcePackageFileNameFilter" name="sourcePackageFileNameFilter" placeholder="fixed.xml" [(ngModel)]="view.content.sourcePackageFileNameFilter" (change)="view.persistState()" />
          </label>
          <label>
            Latest Import Status
            <select id="sourcePackageLatestImportStatusFilter" name="sourcePackageLatestImportStatusFilter" [(ngModel)]="view.content.sourcePackageLatestImportStatusFilter" (change)="view.persistState()">
              <option value="">All latest import statuses</option>
              <option *ngFor="let status of view.importJobStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Source Package Limit
            <input id="sourcePackageLimit" name="sourcePackageLimit" inputmode="numeric" [(ngModel)]="view.content.sourcePackageLimit" (change)="view.persistState()" />
          </label>
          <label>
            Import Job Status
            <select id="importJobStatusFilter" name="importJobStatusFilter" [(ngModel)]="view.content.importJobStatusFilter" (change)="view.persistState()">
              <option value="">All import statuses</option>
              <option *ngFor="let status of view.importJobStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Import Job Source Package Id
            <input id="importJobSourcePackageFilter" name="importJobSourcePackageFilter" placeholder="source package id" [(ngModel)]="view.content.importJobSourcePackageFilter" (change)="view.persistState()" />
          </label>
          <label>
            Import Job Limit
            <input id="importJobLimit" name="importJobLimit" inputmode="numeric" [(ngModel)]="view.content.importJobLimit" (change)="view.persistState()" />
          </label>
          <label>
            Release Status
            <select id="contentReleaseStatusFilter" name="contentReleaseStatusFilter" [(ngModel)]="view.content.contentReleaseStatusFilter" (change)="view.persistState()">
              <option value="">All release statuses</option>
              <option *ngFor="let status of view.contentReleaseStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Release Import Job Id
            <input id="contentReleaseImportJobFilter" name="contentReleaseImportJobFilter" placeholder="import job id" [(ngModel)]="view.content.contentReleaseImportJobFilter" (change)="view.persistState()" />
          </label>
          <label>
            Release Source Package Id
            <input id="contentReleaseSourcePackageFilter" name="contentReleaseSourcePackageFilter" placeholder="source package id" [(ngModel)]="view.content.contentReleaseSourcePackageFilter" (change)="view.persistState()" />
          </label>
          <label>
            Release Limit
            <input id="contentReleaseLimit" name="contentReleaseLimit" inputmode="numeric" [(ngModel)]="view.content.contentReleaseLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button class="primary" type="button" data-content-filter-action="apply" (click)="view.applyContentReadFilters()">Apply Content Filters</button>
          <button class="secondary" type="button" (click)="view.useSelectedIdsAsContentReadFilters()">Use Selected IDs</button>
          <button class="ghost" type="button" (click)="view.clearContentReadFilters()">Clear Content Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Content Action Queue"
        subtitle="Suggested next actions for intake, import diagnostics, retry, and release activation."
        [items]="view.contentActionItems"
        (itemAction)="view.runContentSuggestion($event)"
        emptyState="Refresh content reads to derive the next action."
      ></app-record-collection>

      <app-record-collection
        title="Source Packages"
        subtitle="Recent uploads and their latest import state."
        [items]="view.sourcePackageItems"
        (itemAction)="view.selectSourcePackage($event)"
        emptyState="No source packages yet."
      ></app-record-collection>

      <app-record-collection
        title="Import Jobs"
        subtitle="Recent import attempts, diagnostics, and current selection."
        [items]="view.importJobItems"
        (itemAction)="view.selectImportJob($event)"
        emptyState="No import jobs yet."
      ></app-record-collection>

      <app-record-collection
        title="Content Releases"
        subtitle="Release lifecycle, activation status, and open-run pressure."
        [items]="view.contentReleaseItems"
        (itemAction)="view.selectContentRelease($event)"
        emptyState="No releases yet."
      ></app-record-collection>

      <article class="card">
        <h2>Detail Reads And Retry</h2>
        <p>Inspect individual package, import, and release history, or retry a failed import with corrected content.</p>
        <div class="actions">
          <button id="sourcePackageDetailButton" class="primary" type="button" [disabled]="!view.canUseSelectedSourcePackage" (click)="view.getSourcePackageDetail()">Source Package Detail</button>
          <button id="importJobDetailButton" class="secondary" type="button" [disabled]="!view.canUseSelectedImportJob" (click)="view.getImportJobDetail()">Import Job Detail</button>
          <button id="downloadSourceDocumentButton" class="secondary" type="button" [disabled]="!view.canUseSelectedSourcePackage" (click)="view.downloadSelectedSourceDocument()">Download Source Document</button>
          <button id="participantSessionDetailButton" class="ghost" type="button" [disabled]="!view.canUseSelectedParticipantSession" (click)="view.getParticipantSessionDetail()">Participant Session Detail</button>
          <button id="releaseReadinessButton" class="ghost" type="button" [disabled]="!view.canUseSelectedContentRelease" (click)="view.getContentReleaseActivationReadiness()">Release Readiness</button>
          <button id="releaseDetailButton" class="ghost" type="button" [disabled]="!view.canUseSelectedContentRelease" (click)="view.getContentReleaseDetail()">Release Detail</button>
          <button id="retrySourcePackageImportButton" class="ghost" type="button" [disabled]="!view.canRetrySourcePackageImport" (click)="view.retrySourcePackageImport()">Retry Failed Import</button>
        </div>
      </article>

      <app-record-collection
        title="Selected Source Package Detail"
        subtitle="The currently selected package with its import and release footprint."
        [items]="view.sourcePackageDetailItems"
        (itemAction)="view.selectSourcePackage($event)"
        emptyState="Load a source package detail to inspect it here."
      ></app-record-collection>

      <app-record-collection
        title="Source Package Structure"
        subtitle="Booklets and units declared directly on the selected source package."
        [items]="view.sourcePackageStructureItems"
        emptyState="No structured package layout is loaded for this source package."
      ></app-record-collection>

      <app-record-collection
        title="Source Document Preview"
        subtitle="A compact preview of the selected package payload without dropping to raw text."
        [items]="view.sourceDocumentPreviewItems"
        emptyState="No source document is loaded for this source package."
      ></app-record-collection>

      <app-record-collection
        title="Source Package Import History"
        subtitle="Every import attempt for the selected package."
        [items]="view.sourcePackageImportHistoryItems"
        (itemAction)="view.selectImportJob($event)"
        emptyState="No import history loaded yet."
      ></app-record-collection>

      <app-record-collection
        title="Source Package Release History"
        subtitle="Releases produced from the selected package."
        [items]="view.sourcePackageReleaseHistoryItems"
        (itemAction)="view.selectContentRelease($event)"
        emptyState="No release history loaded yet."
      ></app-record-collection>

      <app-record-collection
        title="Selected Import Job Detail"
        subtitle="The chosen import with source and release linkage."
        [items]="view.importJobDetailItems"
        (itemAction)="view.selectImportJob($event)"
        emptyState="Load an import job detail to inspect it here."
      ></app-record-collection>

      <app-record-collection
        title="Import Diagnostics"
        subtitle="Structured diagnostics for the selected import attempt."
        [items]="view.importJobDiagnosticItems"
        emptyState="No diagnostics are loaded for the selected import."
      ></app-record-collection>

      <app-record-collection
        title="Import Linkage"
        subtitle="Jump directly from the selected import to its source package or produced release."
        [items]="view.importJobLinkageItems"
        (itemAction)="view.openLinkedDetail($event)"
        emptyState="No linked package or release is loaded for this import."
      ></app-record-collection>

      <app-record-collection
        title="Release Activation Readiness"
        subtitle="The selected release and its current guard result."
        [items]="view.activationReadinessItems"
        (itemAction)="view.selectContentRelease($event)"
        emptyState="Load release readiness to inspect it here."
      ></app-record-collection>

      <app-record-collection
        title="Roster Compatibility Warnings"
        subtitle="Saved roster entries whose booklet assignments do not match the selected release."
        [items]="view.activationRosterWarningItems"
        (itemAction)="view.openRosterWarningInRuntime($event)"
        emptyState="No roster compatibility warnings are loaded for this release."
      ></app-record-collection>

      <app-record-collection
        title="Activation Blocking Runs"
        subtitle="Runs that currently block superseding the active release."
        [items]="view.activationBlockingRunItems"
        (itemAction)="view.openBlockingRunInRuntime($event)"
        emptyState="No blocking open runs are currently loaded."
      ></app-record-collection>

      <app-record-collection
        title="Activation Guard Result"
        subtitle="Latest activation, blocked guard, or readiness outcome as an operator card."
        [items]="view.activationGuardItems"
        (itemAction)="view.selectContentRelease($event)"
        emptyState="No activation guard result has been loaded yet."
      ></app-record-collection>

      <app-record-collection
        title="Selected Release Detail"
        subtitle="The chosen release with participant and lifecycle context."
        [items]="view.contentReleaseDetailItems"
        (itemAction)="view.selectContentRelease($event)"
        emptyState="Load a release detail to inspect it here."
      ></app-record-collection>

      <app-record-collection
        title="Release Lineage"
        subtitle="Follow the selected release back to its import, source package, or neighboring activated releases."
        [items]="view.contentReleaseLineageItems"
        (itemAction)="view.openLinkedDetail($event)"
        emptyState="No linked lineage is loaded for this release."
      ></app-record-collection>

      <app-record-collection
        title="Release Runtime Snapshot"
        subtitle="Booklets and units that the selected release exposes to runtime."
        [items]="view.contentReleaseRuntimeSnapshotItems"
        emptyState="No runtime snapshot is loaded for this release."
      ></app-record-collection>

      <app-record-collection
        title="Release Participant Sessions"
        subtitle="Sessions currently attached to the selected release."
        [items]="view.contentReleaseParticipantSessionItems"
        (itemAction)="view.openParticipantSessionInRuntime($event)"
        emptyState="No participant sessions are loaded for this release."
      ></app-record-collection>

      <app-record-collection
        title="Release Test Runs"
        subtitle="Runs created on the selected release, ready to jump into runtime."
        [items]="view.contentReleaseTestRunItems"
        (itemAction)="view.openTestRunInRuntime($event)"
        emptyState="No test runs are loaded for this release."
      ></app-record-collection>

      <app-record-collection
        title="Workspace Release History"
        subtitle="The activation line around the selected release."
        [items]="view.contentReleaseHistoryItems"
        (itemAction)="view.selectContentRelease($event)"
        emptyState="No release history loaded yet."
      ></app-record-collection>

      <article class="card">
        <h2>Guided Flows</h2>
        <p>Run the narrow happy path quickly, or deliberately exercise the activation guard once a participant still has an open run.</p>
        <div class="actions">
          <button class="primary" type="button" (click)="view.bootstrapWorkspaceFlow()">Bootstrap Workspace</button>
          <button class="secondary" type="button" (click)="view.importActivateFlow()">Import And Activate</button>
          <button class="ghost" type="button" (click)="view.blockedActivationFlow()">Attempt Blocked Activation</button>
        </div>
      </article>

      <app-json-panel title="Source Packages" subtitle="History" viewId="sourcePackagesView" [content]="view.content.sourcePackagesView"></app-json-panel>
      <app-json-panel title="Import Jobs" subtitle="Diagnostics" viewId="importJobsView" [content]="view.content.importJobsView"></app-json-panel>
      <app-json-panel title="Content Releases" subtitle="Lifecycle" viewId="contentReleasesView" [content]="view.content.contentReleasesView"></app-json-panel>
      <app-json-panel title="Source Package Detail" subtitle="Retry History" viewId="sourcePackageDetailView" [content]="view.content.sourcePackageDetailView"></app-json-panel>
      <app-json-panel title="Import Job Detail" subtitle="Single Attempt" viewId="importJobDetailView" [content]="view.content.importJobDetailView"></app-json-panel>
      <app-json-panel title="Release Activation Readiness" subtitle="Guard Preview" viewId="contentReleaseActivationReadinessView" [content]="view.content.contentReleaseActivationReadinessView"></app-json-panel>
      <app-json-panel title="Activation Guard" subtitle="Latest Block Or Readiness Summary" viewId="activationGuardView" [content]="view.content.activationGuardView"></app-json-panel>
      <app-json-panel title="Content Release Detail" subtitle="Activation Line" viewId="contentReleaseDetailView" [content]="view.content.contentReleaseDetailView"></app-json-panel>
    </div>
  `
})
export class ContentViewComponent implements OnInit {
  readonly view = inject(ContentViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
