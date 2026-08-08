import { Injectable, inject } from "@angular/core";

import {
  productionApiRoutes,
  resolveRoutePath,
  type DeleteAttachmentFileResponse,
  type ListAttachmentsResponse,
  type UploadAttachmentFileResponse
} from "@testcenter-rewrite-app/contracts";
import type { WorkspaceAttachment } from "@testcenter-rewrite-app/domain";

import { RewriteAppApiService, type ApiDownload } from "./rewrite-app-api.service";

type AttachmentScope = {
  sessionToken: string;
  tenantKey: string;
  workspaceKey: string;
};

@Injectable({ providedIn: "root" })
export class AttachmentManagerService {
  private readonly api = inject(RewriteAppApiService);

  async list(scope: AttachmentScope): Promise<WorkspaceAttachment[]> {
    const { payload } = await this.api.send<ListAttachmentsResponse>(
      "GET",
      resolveRoutePath(productionApiRoutes.workspace.listAttachments, scope),
      undefined,
      this.authorization(scope.sessionToken)
    );
    return payload.items;
  }

  async upload(
    scope: AttachmentScope,
    attachmentId: string,
    file: { fileName: string; mediaType: string; dataBase64: string }
  ): Promise<WorkspaceAttachment> {
    const { payload } = await this.api.send<UploadAttachmentFileResponse>(
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.uploadAttachmentFile, {
        ...scope,
        attachmentId
      }),
      file,
      this.authorization(scope.sessionToken)
    );
    return payload.attachment;
  }

  download(
    scope: AttachmentScope,
    attachmentId: string,
    attachmentFileId: string
  ): Promise<ApiDownload> {
    return this.api.download(
      resolveRoutePath(productionApiRoutes.workspace.getAttachmentFile, {
        ...scope,
        attachmentId,
        attachmentFileId
      }),
      this.authorization(scope.sessionToken)
    );
  }

  async delete(
    scope: AttachmentScope,
    attachmentId: string,
    attachmentFileId: string
  ): Promise<WorkspaceAttachment> {
    const { payload } = await this.api.send<DeleteAttachmentFileResponse>(
      "DELETE",
      resolveRoutePath(productionApiRoutes.workspace.deleteAttachmentFile, {
        ...scope,
        attachmentId,
        attachmentFileId
      }),
      undefined,
      this.authorization(scope.sessionToken)
    );
    return payload.attachment;
  }

  describeError(error: unknown): string {
    if (this.api.isApiError(error)) {
      return error.message;
    }
    return error instanceof Error ? error.message : "Attachment request failed.";
  }

  private authorization(sessionToken: string): Record<string, string> {
    return { Authorization: `Bearer ${sessionToken}` };
  }
}
