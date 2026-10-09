import { Injectable, signal } from "@angular/core";
import type { OnDestroy } from "@angular/core";

interface OriginalToast {
  id: number;
  text: string;
}

// Presentation adapted from IQB Testcenter; see assets/ORIGINAL-UI-LICENSE.txt.
@Injectable({ providedIn: "root" })
export class OriginalToastService implements OnDestroy {
  readonly toasts = signal<OriginalToast[]>([]);
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(text: string): void {
    const id = ++this.nextId;
    this.toasts.update(toasts => [...toasts, { id, text }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), 5000));
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(id);
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
  }

  ngOnDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toasts.set([]);
  }
}
