import { Component, inject } from "@angular/core";
import { OriginalToastService } from "./original-toast.service";

// Layout adapted from IQB Testcenter; see assets/ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: "app-original-toast-container",
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite" data-cy="toast-container">
      @for (toast of messages.toasts(); track toast.id; let i = $index) {
        <div class="toast" [attr.data-cy]="'toast-item-' + i">
          <span class="toast-text" [attr.data-cy]="'toast-text-' + i"><span>{{ toast.text }}</span></span>
          <button class="toast-action" type="button" [attr.data-cy]="'toast-action-' + i"
            (click)="messages.dismiss(toast.id)">Schließen</button>
        </div>
      }
    </div>
  `,
  styleUrls: ["./original-toast-container.component.css", "./original-login-theme.scss"]
})
export class OriginalToastContainerComponent {
  readonly messages = inject(OriginalToastService);
}
