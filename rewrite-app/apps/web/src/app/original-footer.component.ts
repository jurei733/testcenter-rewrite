import { Component, inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { RouterLink } from "@angular/router";
import { AppShellFacade } from "./app-shell.facade";
import { parseJsonDocument, readStringValue } from "./rewrite-app-shell.readers";

// Adapted from IQB Testcenter 19's footer. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: "app-original-footer",
  standalone: true,
  imports: [MatButton, RouterLink],
  template: `
    <footer id="originalApplicationFooter">
      <div class="version-label">Version {{ version }}</div>
      <nav aria-label="Öffentliche Informationen" class="all-buttons">
        <a matButton id="applicationAccessibilityNoticeLink" routerLink="/accessibility">Barrierefreiheit</a>
        <a matButton id="applicationPrivacyNoticeLink" routerLink="/privacy">Datenschutz</a>
        <a matButton id="applicationLegalNoticeLink" routerLink="/legal-notice">Impressum</a>
      </nav>
    </footer>
  `,
  styles: [`
    :host { display: block; flex: 0 0 auto; }
    footer { height: 24px; padding: 16px; background: var(--theme-gray-05, #F4F2F2);
      display: flex; flex-direction: row; justify-content: space-between;
      font-family: 'Nunito Sans', sans-serif; font-size: 16px; }
    .all-buttons { display: flex; flex-direction: row; justify-content: space-around;
      align-items: center; }
    a { max-height: 100%; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalFooterComponent {
  readonly app = inject(AppShellFacade);

  get version(): string {
    const build = readStringValue(parseJsonDocument(this.app.ops.runtimeHealthView),
      ["manifest", "build", "commitSha"]);
    // Do not advertise the reference application's release as this build's version.
    return build ? `Rewrite (${build.slice(0, 12)})` : "Rewrite";
  }
}
