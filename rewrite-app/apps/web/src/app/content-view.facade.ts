import { Injectable, inject } from "@angular/core";

import { RewriteAppShellService } from "./rewrite-app-shell.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class ContentViewFacade {
  private readonly shell = inject(RewriteAppShellService);
  private readonly uiState = inject(RewriteAppUiStateService);

  readonly content = this.uiState.content;

  init(): void {
    this.shell.setActiveView("content");
  }

  persistState(): void {
    this.shell.persistShellState();
  }

  createSourcePackage(): void {
    this.shell.onActionAsync(() => this.shell.createSourcePackage());
  }

  createImportJob(): void {
    this.shell.onActionAsync(() => this.shell.createImportJob());
  }

  activateContentRelease(): void {
    this.shell.onActionAsync(() => this.shell.activateContentRelease());
  }

  refreshContentReads(): void {
    this.shell.onActionAsync(() => this.shell.refreshContentReads());
  }

  getSourcePackageDetail(): void {
    this.shell.onActionAsync(() => this.shell.loadSourcePackageDetail());
  }

  getImportJobDetail(): void {
    this.shell.onActionAsync(() => this.shell.loadImportJobDetail());
  }

  getParticipantSessionDetail(): void {
    this.shell.onActionAsync(() => this.shell.loadParticipantSessionDetail());
  }

  getContentReleaseActivationReadiness(): void {
    this.shell.onActionAsync(() =>
      this.shell.loadContentReleaseActivationReadiness()
    );
  }

  getContentReleaseDetail(): void {
    this.shell.onActionAsync(() => this.shell.loadContentReleaseDetail());
  }

  retrySourcePackageImport(): void {
    this.shell.onActionAsync(() => this.shell.retrySourcePackageImport());
  }

  bootstrapWorkspaceFlow(): void {
    this.shell.onActionAsync(() => this.shell.bootstrapWorkspaceFlow());
  }

  importActivateFlow(): void {
    this.shell.onActionAsync(() => this.shell.importActivateFlow());
  }

  blockedActivationFlow(): void {
    this.shell.onActionAsync(() => this.shell.blockedActivationFlow());
  }
}
