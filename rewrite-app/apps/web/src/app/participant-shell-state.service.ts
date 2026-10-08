import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ParticipantShellStateService {
  readonly headerHidden = signal(false);
  readonly headerTitle = signal("");

  setHeaderHidden(hidden: boolean): void {
    this.headerHidden.set(hidden);
  }

  setHeaderTitle(title: string): void {
    this.headerTitle.set(title);
  }
}
