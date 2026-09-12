import { Component, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";

export type AdministrationSection = "users" | "workspaces" | "settings";

@Component({
  selector: "app-administration-nav",
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="administration-nav" aria-label="System administration">
      <span class="eyebrow">System administration</span>
      <div class="administration-nav-links">
        <a
          id="administrationUsersTab"
          class="administration-nav-link"
          [class.is-active]="activeSection === 'users'"
          [attr.aria-current]="activeSection === 'users' ? 'page' : null"
          [routerLink]="['/ops']"
          [queryParams]="{ adminSection: 'users' }"
          (click)="sectionSelected.emit('users')"
        >Admins</a>
        <a
          id="administrationWorkspacesTab"
          class="administration-nav-link"
          [class.is-active]="activeSection === 'workspaces'"
          [attr.aria-current]="activeSection === 'workspaces' ? 'page' : null"
          [routerLink]="['/workspace']"
        >Workspaces</a>
        <a
          id="administrationSettingsTab"
          class="administration-nav-link"
          [class.is-active]="activeSection === 'settings'"
          [attr.aria-current]="activeSection === 'settings' ? 'page' : null"
          [routerLink]="['/ops']"
          [queryParams]="{ adminSection: 'settings' }"
          (click)="sectionSelected.emit('settings')"
        >Settings</a>
      </div>
    </nav>
  `,
  styles: [`
    .administration-nav {
      display: grid;
      gap: 10px;
      padding: 14px 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: rgb(255 255 255 / 0.78);
      box-shadow: var(--shadow-soft);
    }

    .administration-nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .administration-nav-link {
      min-width: 128px;
      padding: 10px 16px;
      border-radius: 999px;
      color: var(--ink);
      font-weight: 700;
      text-align: center;
      text-decoration: none;
      background: rgba(27, 36, 48, 0.08);
      transition: background 120ms ease, color 120ms ease, transform 120ms ease;
    }

    .administration-nav-link:hover {
      transform: translateY(-1px);
    }

    .administration-nav-link.is-active {
      color: white;
      background: var(--ink);
    }

    .administration-nav-link:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent) 65%, white);
      outline-offset: 2px;
    }

    @media (max-width: 560px) {
      .administration-nav-link {
        flex: 1 1 100%;
      }
    }
  `]
})
export class AdministrationNavComponent {
  @Input() activeSection: AdministrationSection = "users";
  @Output() readonly sectionSelected =
    new EventEmitter<AdministrationSection>();
}
