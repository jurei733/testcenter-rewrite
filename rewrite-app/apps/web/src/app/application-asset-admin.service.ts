import { Injectable, inject, signal } from "@angular/core";

import type {
  ApplicationAssetSummary,
  DeleteApplicationAssetResponse,
  ListApplicationAssetsResponse,
  UploadApplicationAssetRequest,
  UploadApplicationAssetResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";

import { RewriteAppApiService } from "./rewrite-app-api.service";

@Injectable({ providedIn: "root" })
export class ApplicationAssetAdminService {
  private readonly api = inject(RewriteAppApiService);

  readonly assets = signal<ApplicationAssetSummary[]>([]);

  async load(sessionToken: string): Promise<ApplicationAssetSummary[]> {
    const { payload } = await this.api.send<ListApplicationAssetsResponse>(
      "GET",
      productionApiRoutes.admin.applicationAssets,
      undefined,
      { Authorization: `Bearer ${sessionToken}` }
    );
    this.assets.set(payload.items);
    return payload.items;
  }

  async upload(
    sessionToken: string,
    input: UploadApplicationAssetRequest
  ): Promise<ApplicationAssetSummary> {
    const { payload } = await this.api.send<UploadApplicationAssetResponse>(
      "POST",
      productionApiRoutes.admin.applicationAssets,
      input,
      { Authorization: `Bearer ${sessionToken}` }
    );
    await this.load(sessionToken);
    return payload.applicationAsset;
  }

  async delete(
    sessionToken: string,
    applicationAssetId: string
  ): Promise<ApplicationAssetSummary> {
    const path = `${productionApiRoutes.admin.applicationAssets}?applicationAssetId=${encodeURIComponent(applicationAssetId)}`;
    const { payload } = await this.api.send<DeleteApplicationAssetResponse>(
      "DELETE",
      path,
      undefined,
      { Authorization: `Bearer ${sessionToken}` }
    );
    this.assets.update(items =>
      items.filter(item => item.applicationAssetId !== applicationAssetId)
    );
    return payload.applicationAsset;
  }
}
