import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Observable, Subject } from 'rxjs';
import {NativeHttpClient} from '../../native-http-client';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly http=inject(NativeHttpClient);
  private readonly timers=new Map<number,ReturnType<typeof setTimeout>>();
  private retired=false;
  private readonly retire=()=>{
    this.retired=true;
    for(const timeout of this.timers.values())clearTimeout(timeout);
    this.timers.clear();this.toasts.set([]);
    for(const subject of this.dismissSubjects.values())subject.complete();
    this.dismissSubjects.clear();
  };
  constructor(){this.http.accessSignal.addEventListener('abort',this.retire,{once:true});}
  ngOnDestroy(){this.http.accessSignal.removeEventListener('abort',this.retire);this.retire();}

  // We roll our own list instead of Angular Material's `MatSnackBar` because
  // MatSnackBar can only ever show one message at a time - opening a new one
  // instantly dismisses whatever is currently shown.

  readonly toasts = signal<ToastMessage[]>([]);
  private toastIdCounter = 0;
  // Per-toast "afterDismissed" notifier - replaces what MatSnackBarRef used to provide.
  private dismissSubjects = new Map<number, Subject<void>>();

  showSnackbar(text: ToastContent, actionText: string = 'Schließen', duration: number = 5000): Observable<void> {
    if(this.retired||!this.http.isCurrent)return EMPTY;
    this.toastIdCounter += 1;
    const id = this.toastIdCounter;
    const dismissed$ = new Subject<void>();
    this.dismissSubjects.set(id, dismissed$);
    const segments = ToastService.toSegments(text);
    this.toasts.update(toasts => [...toasts, { id, segments, actionText }]);
    if (duration > 0) {
      this.timers.set(id,setTimeout((): void => this.dismissToast(id), duration));
    }
    return dismissed$.asObservable();
  }

  private static toSegments(text: ToastContent): ToastSegment[] {
    if (typeof text === 'string') {
      return [{ text }];
    }
    return text.map(part => (
      typeof part === 'string' ? { text: part } : { text: part.emphasized, emphasized: true })
    );
  }

  dismissToast(id: number): void {
    const timeout=this.timers.get(id);if(timeout!==undefined)clearTimeout(timeout);this.timers.delete(id);
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
    const dismissed$ = this.dismissSubjects.get(id);
    if (dismissed$) {
      if(!this.retired&&this.http.isCurrent)dismissed$.next();
      dismissed$.complete();
      this.dismissSubjects.delete(id);
    }
  }
}

export interface ToastMessage {
  id: number;
  segments: ToastSegment[];
  actionText: string;
}

export interface ToastSegment {
  text: string;
  emphasized?: boolean;
}

export type ToastContent = string | (string | { emphasized: string })[];