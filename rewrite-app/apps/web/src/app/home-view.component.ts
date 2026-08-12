import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { AppShellFacade } from "./app-shell.facade";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

@Component({
  selector: "app-home-view",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./home-view.component.html",
  styleUrl: "./home-view.component.css"
})
export class HomeViewComponent {
  readonly app = inject(AppShellFacade);
  private readonly viewState = inject(RewriteAppViewStateService);

  constructor() {
    this.viewState.setActiveView("home");
  }
}
