import { Component, ElementRef, ViewChild, inject, signal } from "@angular/core";
import type { OnDestroy } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatCard, MatCardActions, MatCardHeader } from "@angular/material/card";
import type { ParticipantRuntimeBooklet } from "@testcenter-rewrite-app/domain";
import { ApplicationSettingsService } from "./application-settings.service";
import { ParticipantViewFacade } from "./participant-view.facade";

// Layout adapted from IQB Testcenter; see assets/ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: "app-original-participant-starter",
  standalone: true,
  imports: [NgFor, NgIf, MatButton, MatCard, MatCardActions, MatCardHeader],
  templateUrl: "./original-participant-starter.component.html",
  styleUrls: ["./original-participant-starter.component.css", "./original-login-theme.scss"]
})
export class OriginalParticipantStarterComponent implements OnDestroy {
  readonly view = inject(ParticipantViewFacade);
  readonly settings = inject(ApplicationSettingsService);
  readonly pendingBooklet = signal("");
  readonly problem = signal("");
  readonly showScrollButton = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private bottomElement: HTMLElement | null = null;
  private readonly observer = typeof IntersectionObserver === "undefined" ? null :
    new IntersectionObserver(([entry]) => this.showScrollButton.set(Boolean(entry && !entry.isIntersecting)));

  @ViewChild("bottomSentinel")
  set bottomSentinel(element: ElementRef<HTMLElement> | undefined) {
    if (this.bottomElement) this.observer?.unobserve(this.bottomElement);
    this.bottomElement = element?.nativeElement ?? null;
    if (this.bottomElement) this.observer?.observe(this.bottomElement);
  }

  isLocked(booklet: ParticipantRuntimeBooklet): boolean {
    return booklet.status === "locked" || booklet.status === "completed";
  }

  trackBooklet(_index: number, booklet: ParticipantRuntimeBooklet): string {
    return booklet.bookletKey;
  }

  actionLabel(booklet: ParticipantRuntimeBooklet): string {
    if (this.isLocked(booklet)) return this.view.customText("booklet_starterLockedTestButtonLabel", "Gesperrt");
    if (booklet.status === "in_progress") return this.view.customText("booklet_starterContinueTestButtonLabel", "Fortsetzen");
    return this.view.customText("booklet_starterStartTestButtonLabel", "Starten");
  }

  async start(booklet: ParticipantRuntimeBooklet): Promise<void> {
    if (this.pendingBooklet() || this.isLocked(booklet)) return;
    this.pendingBooklet.set(booklet.bookletKey);
    this.problem.set("");
    try {
      await this.view.startAssignedBooklet(booklet.bookletKey);
    } catch {
      this.problem.set("Der Test konnte nicht geöffnet werden. Bitte erneut versuchen.");
    } finally {
      this.pendingBooklet.set("");
    }
  }

  scrollDown(): void {
    this.host.nativeElement.closest<HTMLElement>(".participant-stage")
      ?.scrollBy({ top: 300, behavior: "smooth" });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
