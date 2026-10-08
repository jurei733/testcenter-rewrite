import { Component } from "@angular/core";
import { ProofOfWorkService } from "./proof-of-work.service";

// IQB Testcenter 19 tc-alert geometry and error icon (MIT).
@Component({
  selector: "app-original-login-notice",
  standalone: true,
  host: { role: "alert", "data-cy": "login-insecure-context" },
  template: `<div class="alert"><div class="vertical-align-middle">
    <span class="mat-icon alert-error" aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 -960 960 960" focusable="false">
        <path d="M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5ZM440-440h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
      </svg>
    </span><span>{{ message }}</span>
  </div></div>`,
  styles: [`.alert { margin-bottom: 2px; }
    .vertical-align-middle { display: inline-flex; vertical-align: middle; align-items: center; }
    .alert-error { color: #821324; }
    .mat-icon { display: inline-block; width: 24px; height: 24px; flex-shrink: 0; fill: currentColor;
      margin-right: .2em; overflow: visible !important; }
    .alert, .vertical-align-middle, span { box-sizing: content-box; }`]
})
export class OriginalLoginNoticeComponent {
  readonly message = ProofOfWorkService.insecureContextMessage;
}
