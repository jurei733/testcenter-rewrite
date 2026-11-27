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
  private readonly timers = new Map<number, { timer: ReturnType<typeof setTimeout>; onDismissed?: () => void }>();

  show(text: string, onDismissed?: () => void): void {
    const id = ++this.nextId;
    this.toasts.update(toasts => [...toasts, { id, text }]);
    this.timers.set(id, { timer: setTimeout(() => this.dismiss(id), 5000), onDismissed });
  }

  dismiss(id: number): void {
    const pending = this.timers.get(id);
    if (pending) clearTimeout(pending.timer);
    this.timers.delete(id);
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
    pending?.onDismissed?.();
  }

  ngOnDestroy(): void {
    for (const { timer } of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toasts.set([]);
  }
}
