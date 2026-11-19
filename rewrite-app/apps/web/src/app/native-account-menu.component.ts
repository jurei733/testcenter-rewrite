import { Component, input, output } from "@angular/core";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatDivider } from "@angular/material/divider";
import { MatMenu, MatMenuTrigger } from "@angular/material/menu";
import type { OriginalAccessSet } from "@testcenter-rewrite-app/contracts/original-session";
import { NativeMonitorIconComponent } from "./native-monitor/native-monitor-icon.component";

@Component({
  selector: "app-native-account-menu",
  standalone: true,
  imports: [MatButton, MatIconButton, MatDivider, MatMenu, MatMenuTrigger, NativeMonitorIconComponent],
  template: `
    <button matIconButton class="account-button" [matMenuTriggerFor]="menu" #trigger="matMenuTrigger"
      data-cy="account-button" aria-label="Nutzerinformationen">
      <mat-icon svgIcon="person" />
    </button>
    <mat-menu #menu="matMenu" class="original-native-account-menu">
      <div class="heading">
        <div>Nutzerinformationen</div>
        <button matIconButton aria-label="Nutzerinformationen schließen" (click)="trigger.closeMenu()">
          <mat-icon svgIcon="close" />
        </button>
      </div>
      <dl>
        <dt>Anmeldename:</dt><dd>{{ access().loginName }}</dd>
        <dt>Gruppe:</dt><dd>{{ access().groupLabel }}</dd>
        <dt>Berechtigung:</dt>
        @if (access().claims.test; as tests) {
          <dd>{{ tests.length > 1
            ? 'Ausführung/Ansicht von Befragungen oder Testheften'
            : 'Ausführung/Ansicht einer Befragung oder eines Testheftes' }}</dd>
        }
        @if (access().claims.testGroupMonitor) {
          <dd>Beobachtung/Prüfung einer Testgruppe</dd>
        }
        @if (access().flags.includes('codeRequired')) {
          <dd>Code-Eingabe erforderlich</dd>
        }
        <dt>Version:</dt><dd>Rewrite</dd>
      </dl>
      <mat-divider />
      <button matButton="tonal" class="logout-button" data-cy="logout-button"
        (click)="trigger.closeMenu(); logout.emit()">Abmelden</button>
    </mat-menu>
  `,
  styles: [`
    :host { display: flex; align-items: center; }
    .account-button {
      background-color: var(--mat-sys-on-primary);
      color: var(--mat-sys-primary);
      border-radius: 12px;
    }
    .account-button:hover { transform: none; }
    :host ::ng-deep .account-button .mat-mdc-button-persistent-ripple { border-radius: inherit; }
  `]
})
export class NativeAccountMenuComponent {
  readonly access = input.required<OriginalAccessSet>();
  readonly logout = output<void>();
}
