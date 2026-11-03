import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { Component, DestroyRef, ElementRef, EventEmitter, Output, ViewChild, afterNextRender, inject, signal } from "@angular/core";
import type { DoCheck, WritableSignal } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatFormField, MatInput, MatLabel } from "@angular/material/input";
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from "@angular/material/form-field";
import { MatListItem, MatSelectionList } from "@angular/material/list";
import { MatRadioButton, MatRadioGroup } from "@angular/material/radio";
import { MatToolbar } from "@angular/material/toolbar";
import { MatTooltip } from "@angular/material/tooltip";
import type { WorkspaceReview } from "@testcenter-rewrite-app/domain";
import { ParticipantViewFacade } from "./participant-view.facade";

type OriginalReviewPaneState = {
  runId: string; unitKey: string; view: WritableSignal<"form" | "list">; dirty: boolean;
};

// Adapted from the current IQB Testcenter Review panel (MIT).
// The existing authorized facade remains the only review persistence boundary.
@Component({
  selector: "app-original-review-panel",
  standalone: true,
  providers: [{ provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { subscriptSizing: "dynamic" } }],
  imports: [FormsModule, CdkTextareaAutosize, MatButton, MatIconButton, MatCheckbox,
    MatFormField, MatInput, MatLabel, MatListItem, MatSelectionList, MatRadioButton,
    MatRadioGroup, MatToolbar, MatTooltip],
  templateUrl: "./original-review-panel.component.html",
  styleUrls: ["./original-review-panel.component.css", "./original-review-theme.scss"]
})
export class OriginalReviewPanelComponent implements DoCheck {
  private static readonly states = new WeakMap<ParticipantViewFacade, OriginalReviewPaneState>();
  readonly view = inject(ParticipantViewFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly state: OriginalReviewPaneState;
  private retired = false;
  readonly activeView: WritableSignal<"form" | "list">;
  readonly pending = signal(false);
  @ViewChild(NgForm) private form?: NgForm;
  @Output() readonly close = new EventEmitter<void>();
  constructor() {
    const runId = this.view.runtime.testRunId;
    const unitKey = this.view.player.unitKey;
    const previous = OriginalReviewPanelComponent.states.get(this.view);
    const restored = previous?.runId === runId && previous.unitKey === unitKey ? previous : undefined;
    this.state = restored ? {...restored} : {runId, unitKey, view: signal<"form" | "list">("form"), dirty: false};
    this.activeView = this.state.view;
    OriginalReviewPanelComponent.states.set(this.view, this.state);
    this.destroyRef.onDestroy(() => {
      // A replaced drawer must never erase a newer owner or its Unit state.
      if (OriginalReviewPanelComponent.states.get(this.view) !== this.state) return;
      this.state.dirty = !!this.form?.dirty && this.view.reviewComment.length > 0;
    });
    afterNextRender(() => {
      if (!this.ownsCurrentScope()) return;
      // The shared facade preserves the draft when this lazy drawer is closed.
      // Recreating NgForm must preserve its ability to save those real changes.
      const review = this.editedReview;
      const changed = review
        ? this.view.reviewComment !== review.comment || this.view.reviewerId !== review.reviewerId ||
          this.view.reviewPriority !== (review.priority ?? 0) || this.view.reviewPageLabel !== (review.pageLabel ?? "") ||
          this.view.reviewTarget !== (review.unitKey ? review.page != null || review.pageLabel ? "task" : "unit" : "test") ||
          [...this.view.reviewCategories].sort().join(" ") !== [...(review.categories ?? [])].sort().join(" ")
        : this.view.reviewComment.length > 0;
      if (restored?.dirty || changed) this.form?.form.markAsDirty();
      if (this.activeView() === "form")
        this.element.nativeElement.querySelector<HTMLInputElement>("#participantRouteReviewReviewer")?.focus();
    });
  }
  private sameScope(): boolean {
    return this.view.runtime.testRunId === this.state.runId && this.view.player.unitKey === this.state.unitKey;
  }
  private ownsCurrentScope(): boolean {
    return !this.retired && !this.destroyRef.destroyed && this.sameScope() &&
      OriginalReviewPanelComponent.states.get(this.view) === this.state;
  }
  ngDoCheck(): void {
    if (this.retired || this.sameScope()) return;
    this.retired = true;
    // Source closes on a changed Unit sequence. Leave the parent change check
    // before closing, and recheck ownership at that boundary. Draft reset
    // belongs to the accepted controller update, not a retired drawer.
    queueMicrotask(() => {
      if (this.destroyRef.destroyed || OriginalReviewPanelComponent.states.get(this.view) !== this.state) return;
      this.close.emit();
    });
  }
  readonly priorities = [
    { value: 1 as const, label: "dringend/kritisch" },
    { value: 2 as const, label: "mittelfristig" },
    { value: 3 as const, label: "optional" }
  ];
  readonly categories = [
    { value: "tech", label: "Technisches" },
    { value: "content", label: "Inhaltliches" },
    { value: "design", label: "Gestaltung" }
  ];
  get heading(): string {
    return this.activeView() === "list" ? "Kommentarübersicht" :
      `Kommentar ${this.view.editingReviewId ? "bearbeiten" : "verfassen"}`;
  }
  get unitReviews(): WorkspaceReview[] {
    return this.view.participantReviews.filter(review => review.unitKey === this.view.player.unitKey);
  }
  get bookletReviews(): WorkspaceReview[] {
    return this.view.participantReviews.filter(review => !review.unitKey);
  }
  get editedReview(): WorkspaceReview | undefined {
    return this.view.participantReviews.find(review => review.reviewId === this.view.editingReviewId);
  }
  newReview(form: NgForm): void {
    if (this.pending() || !this.ownsCurrentScope()) return;
    this.view.cancelReviewEdit();
    form.resetForm({ target: "unit", priority: 0, reviewer: "", targetLabel: "", entry: "" });
    this.activeView.set("form");
  }
  edit(review: WorkspaceReview, form: NgForm): void {
    if (this.pending() || !this.ownsCurrentScope()) return;
    this.view.beginReviewEdit(review);
    form.form.markAsPristine();
    this.activeView.set("form");
  }
  save(form: NgForm): void {
    if (this.pending() || !this.ownsCurrentScope() || !form.dirty || !this.view.canSubmitReview) return;
    this.pending.set(true);
    this.view.saveReview(() => {
      if (this.ownsCurrentScope()) this.close.emit();
    }, () => { if (!this.destroyRef.destroyed) this.pending.set(false); }, () => this.ownsCurrentScope());
  }
  delete(): void {
    const review = this.editedReview;
    if (this.pending() || !this.ownsCurrentScope() || !review) return;
    this.pending.set(true);
    void this.view.deleteReview(review, () => {
      if (this.ownsCurrentScope()) this.activeView.set("list");
    }, () => { if (!this.destroyRef.destroyed) this.pending.set(false); }, () => this.ownsCurrentScope());
  }
}
