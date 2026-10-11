import { Directive, ElementRef, HostListener, inject } from "@angular/core";

/** Pointer capture keeps dragging inside the lazy diagnostics without a document listener. */
@Directive({ selector: "[participantDebugDrag]", standalone: true })
export class ParticipantDebugDragDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private start: { id: number; x: number; y: number; offsetX: number; offsetY: number } | null = null;
  private offsetX = 0;
  private offsetY = 0;
  @HostListener("pointerdown", ["$event"])
  begin(event: PointerEvent): void {
    if (this.start || !event.isPrimary || event.button !== 0 || (event.target as Element).closest("input,textarea,button,[role=button],a")) return;
    this.start = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: this.offsetX, offsetY: this.offsetY };
    this.element.setPointerCapture(event.pointerId); event.preventDefault();
  }
  @HostListener("pointermove", ["$event"])
  move(event: PointerEvent): void {
    if (!this.start || event.pointerId !== this.start.id) return;
    this.offsetX = this.start.offsetX + event.clientX - this.start.x;
    this.offsetY = this.start.offsetY + event.clientY - this.start.y;
    this.element.style.transform = `translate3d(${this.offsetX}px,${this.offsetY}px,0)`;
  }
  @HostListener("pointerup", ["$event"])
  @HostListener("pointercancel", ["$event"])
  @HostListener("lostpointercapture", ["$event"])
  end(event: PointerEvent): void {
    if (this.start?.id !== event.pointerId) return;
    this.start = null;
    if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
  }
}
