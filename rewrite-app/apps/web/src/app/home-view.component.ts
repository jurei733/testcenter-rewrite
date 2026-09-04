import { Component, inject, signal } from "@angular/core";
import type { OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";

import {
  productionApiRoutes,
  type GetSystemCheckAccessResponse,
  type SystemCheckAccessMode
} from "@testcenter-rewrite-app/contracts";

import { AppShellFacade } from "./app-shell.facade";
import { RewriteAppApiService } from "./rewrite-app-api.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

type SystemCheckEntryState = SystemCheckAccessMode | "loading" | "unavailable";

@Component({
  selector: "app-home-view",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./home-view.component.html",
  styleUrl: "./home-view.component.css"
})
export class HomeViewComponent implements OnInit {
  readonly app = inject(AppShellFacade);
  readonly systemCheckEntryState = signal<SystemCheckEntryState>("loading");
  private readonly api = inject(RewriteAppApiService);
  private readonly viewState = inject(RewriteAppViewStateService);

  constructor() {
    this.viewState.setActiveView("home");
  }

  ngOnInit(): void {
    void this.loadSystemCheckAccess();
  }

  async loadSystemCheckAccess(): Promise<void> {
    this.systemCheckEntryState.set("loading");
    try {
      const { payload } = await this.api.send<GetSystemCheckAccessResponse>(
        "GET",
        productionApiRoutes.system.getSystemCheckAccess
      );
      this.systemCheckEntryState.set(payload.accessMode);
    } catch {
      this.systemCheckEntryState.set("unavailable");
    }
  }
}
