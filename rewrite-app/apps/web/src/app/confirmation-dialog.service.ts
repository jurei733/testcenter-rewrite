import { Injectable, signal } from "@angular/core";

export type ConfirmationDialogTone = "primary" | "danger";

export type ConfirmationDialogRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationDialogTone;
};

export type ActiveConfirmationDialog = Required<ConfirmationDialogRequest> & {
  requestId: number;
};

@Injectable({ providedIn: "root" })
export class ConfirmationDialogService {
  readonly dialog = signal<ActiveConfirmationDialog | null>(null);

  private requestId = 0;
  private resolver: ((confirmed: boolean) => void) | null = null;
  private returnFocusElement: HTMLElement | null = null;

  confirm(request: ConfirmationDialogRequest): Promise<boolean> {
    this.resolve(false);
    this.returnFocusElement =
      globalThis.document?.activeElement instanceof HTMLElement
        ? globalThis.document.activeElement
        : null;

    return new Promise(resolve => {
      this.resolver = resolve;
      this.dialog.set({
        requestId: ++this.requestId,
        title: request.title,
        message: request.message,
        confirmLabel: request.confirmLabel,
        cancelLabel: request.cancelLabel ?? "Cancel",
        tone: request.tone ?? "danger"
      });
    });
  }

  resolve(confirmed: boolean): void {
    const resolve = this.resolver;
    const returnFocusElement = this.returnFocusElement;
    this.resolver = null;
    this.returnFocusElement = null;
    this.dialog.set(null);
    resolve?.(confirmed);
    globalThis.queueMicrotask(() => {
      if (returnFocusElement?.isConnected) {
        returnFocusElement.focus();
      }
    });
  }
}
