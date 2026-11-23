import {computed, inject, Injectable} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute} from '@angular/router';
import type {OriginalAttachment, UploadAttachmentFileRequest} from '@testcenter-rewrite-app/contracts';
import {NativeMonitorSessionService} from './native-session.service';

/** The route and live native person own each attachment request in this view. */
@Injectable()
export class NativeAttachmentContext {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {initialValue: this.route.snapshot.paramMap});
  private readonly session = inject(NativeMonitorSessionService);
  private readonly view = new AbortController();
  readonly group = computed(() => this.params().get('group') ?? '');
  readonly claim = computed(() => this.session.access()?.claims.attachmentManager?.find(item => item.id === this.group()));
  get token(): string { return this.claim() ? this.session.access()?.token ?? '' : ''; }
  get customTexts(): Record<string, string> { return this.session.access()?.customTexts ?? {}; }

  private async request<T>(path: string, decode: (response: Response) => Promise<T>, method = 'GET', body?: FormData) {
    const token = this.token;
    const actor = this.session.accessSignal;
    const group = this.group();
    if (!token) throw new Error('Diese Gruppe ist nicht freigegeben.');
    const scope = AbortSignal.any([actor, this.view.signal]);
    const response = await fetch(path, {method, body, cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: {AuthToken: token}, signal: AbortSignal.any([scope, AbortSignal.timeout(20_000)])});
    if (response.status === 401 && token === this.token && !scope.aborted) this.session.clear();
    if (!response.ok) throw new Error(response.status === 404
      ? 'Der Anhang wurde nicht gefunden.' : 'Die Anhangsanfrage ist fehlgeschlagen.');
    const result = await decode(response);
    scope.throwIfAborted();
    if (this.group() !== group || this.token !== token) throw new DOMException('Attachment view retired.', 'AbortError');
    return result;
  }

  list(): Promise<OriginalAttachment[]> {
    return this.request('/attachments/list', response => response.json());
  }

  get(id: string): Promise<OriginalAttachment> {
    return this.request(this.path(id, 'data'), response => response.json());
  }

  file(id: string, fileId: string): Promise<Blob> {
    return this.request(this.path(id, 'file') + '/' + encodeURIComponent(fileId), response => response.blob());
  }

  async delete(id: string, fileId: string): Promise<void> {
    await this.request(this.path(id, 'file') + '/' + encodeURIComponent(fileId), async () => undefined, 'DELETE');
  }

  pages(id: string | undefined, label: string): Promise<Blob> {
    const path = id ? this.path(id, 'page') : '/attachments/pages';
    const query = label ? '?' + new URLSearchParams({labelTemplate: label}) : '';
    return this.request(path + query, response => response.blob());
  }

  async upload(id: string, file: UploadAttachmentFileRequest): Promise<void> {
    const text = atob(file.dataBase64);
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
    const multipart = new FormData();
    multipart.set('type', 'image');
    multipart.set('attachment', new Blob([bytes], {type: file.mediaType}), file.fileName);
    await this.request(this.path(id, 'file'), async () => undefined, 'POST', multipart);
  }

  private path(id: string, operation: 'data' | 'file' | 'page'): string {
    return '/attachment/' + encodeURIComponent(id) + '/' + operation;
  }

  ngOnDestroy(): void { this.view.abort(); }
}
