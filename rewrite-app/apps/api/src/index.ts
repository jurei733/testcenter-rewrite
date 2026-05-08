import { firstSliceUseCases } from "@testcenter-rewrite-app/application";
import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";
import { firstProductionSliceCapabilities } from "@testcenter-rewrite-app/domain";

export const productionApiManifest = {
  workspace: "rewrite-app/api",
  phase: "production-baseline",
  routes: productionApiRoutes,
  useCases: firstSliceUseCases,
  capabilities: firstProductionSliceCapabilities
} as const;

export const describeProductionApi = (): string =>
  [
    "Testcenter Rewrite Production API Baseline",
    `workspace=${productionApiManifest.workspace}`,
    `phase=${productionApiManifest.phase}`,
    `routes=${Object.keys(productionApiManifest.routes).join(",")}`
  ].join("\n");

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${describeProductionApi()}\n`);
}
