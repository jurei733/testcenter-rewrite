import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ContentViewFacade } from "./content-view.facade";
import { JsonPanelComponent } from "./json-panel.component";

@Component({
  selector: "app-content-view",
  standalone: true,
  imports: [CommonModule, FormsModule, JsonPanelComponent],
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
          <button class="primary" type="button" (click)="view.createSourcePackage()">Create Source Package</button>
          <button class="secondary" type="button" (click)="view.createImportJob()">Create Import Job</button>
          <button class="ghost" type="button" (click)="view.activateContentRelease()">Activate Release</button>
          <button class="ghost" type="button" (click)="view.refreshContentReads()">Refresh Content Reads</button>
        </div>
      </article>

      <article class="card">
        <h2>Detail Reads And Retry</h2>
        <p>Inspect individual package, import, and release history, or retry a failed import with corrected content.</p>
        <div class="actions">
          <button class="primary" type="button" (click)="view.getSourcePackageDetail()">Source Package Detail</button>
          <button class="secondary" type="button" (click)="view.getImportJobDetail()">Import Job Detail</button>
          <button class="ghost" type="button" (click)="view.getParticipantSessionDetail()">Participant Session Detail</button>
          <button class="ghost" type="button" (click)="view.getContentReleaseActivationReadiness()">Release Readiness</button>
          <button class="ghost" type="button" (click)="view.getContentReleaseDetail()">Release Detail</button>
          <button class="ghost" type="button" (click)="view.retrySourcePackageImport()">Retry Failed Import</button>
        </div>
      </article>

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
