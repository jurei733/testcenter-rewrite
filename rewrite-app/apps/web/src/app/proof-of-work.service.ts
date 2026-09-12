import { Injectable, inject, signal } from "@angular/core";

import {
  productionApiRoutes,
  type AdminSignInCredentials,
  type CreateProofOfWorkChallengeRequest,
  type CreateProofOfWorkChallengeResponse,
  type GetRuntimeConfigResponse,
  type ParticipantSignInCredentials,
  type ProofOfWorkScope,
  type ProofOfWorkSolutions
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type ProtectedAdminCredentials = AdminSignInCredentials & {
  proofOfWork?: ProofOfWorkSolutions;
};

type ProtectedParticipantCredentials = ParticipantSignInCredentials & {
  proofOfWork?: ProofOfWorkSolutions;
};

@Injectable({ providedIn: "root" })
export class ProofOfWorkService {
  readonly busy = signal(false);

  private readonly request = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private altchaLib?: Promise<typeof import("altcha-lib")>;

  async protectAdmin(
    credentials: AdminSignInCredentials
  ): Promise<ProtectedAdminCredentials> {
    if (!(await this.isRequired("admin", credentials))) {
      return credentials;
    }
    return this.withBusy(async () => ({
      ...credentials,
      proofOfWork: {
        admin: await this.solve({ scope: "admin", credentials })
      }
    }));
  }

  async protectParticipant(
    credentials: ParticipantSignInCredentials
  ): Promise<ProtectedParticipantCredentials> {
    const config = await this.readRuntimeConfig();
    const requiredScopes = (["participant", "second_code"] as const).filter(
      scope => this.isRequiredWithConfig(scope, credentials, config)
    );
    if (requiredScopes.length === 0) {
      return credentials;
    }
    return this.withBusy(async () => {
      const proofOfWork: ProofOfWorkSolutions = {};
      for (const scope of requiredScopes) {
        proofOfWork[scope] = await this.solve({ scope, credentials });
      }
      return { ...credentials, proofOfWork };
    });
  }

  private async solve(
    request: CreateProofOfWorkChallengeRequest
  ): Promise<{ token: string; number: number }> {
    const challenge =
      await this.request.request<CreateProofOfWorkChallengeResponse>(
        "Compute security challenge",
        "POST",
        productionApiRoutes.system.createProofOfWorkChallenge,
        request,
        { quiet: true }
      );
    const { solveChallengeWorkers } = await this.loadSolver();
    const workerCount = Math.max(
      1,
      Math.min(8, globalThis.navigator?.hardwareConcurrency ?? 4)
    );
    const solved = await solveChallengeWorkers(
      new URL("altcha-lib/dist/worker.js", globalThis.document.baseURI).toString(),
      workerCount,
      challenge.challenge,
      challenge.salt,
      challenge.algorithm,
      challenge.maxNumber
    );
    if (!solved || Date.parse(challenge.expiresAt) <= Date.now()) {
      throw new Error("The security challenge could not be solved in time.");
    }
    return { token: challenge.token, number: solved.number };
  }

  private async isRequired(
    scope: ProofOfWorkScope,
    credentials: AdminSignInCredentials | ParticipantSignInCredentials
  ): Promise<boolean> {
    return this.isRequiredWithConfig(
      scope,
      credentials,
      await this.readRuntimeConfig()
    );
  }

  private isRequiredWithConfig(
    scope: ProofOfWorkScope,
    credentials: AdminSignInCredentials | ParticipantSignInCredentials,
    config: GetRuntimeConfigResponse
  ): boolean {
    if (!config?.runtimeConfig.proofOfWork.enabledScopes.includes(scope)) {
      return false;
    }
    if (scope === "admin") {
      const adminCredentials = credentials as AdminSignInCredentials;
      return adminCredentials.username.trim() !== "";
    }
    const participantCredentials = credentials as ParticipantSignInCredentials;
    return scope === "participant"
      ? participantCredentials.loginKey.trim() !== ""
      : (participantCredentials.participantCode ?? "").trim() !== "";
  }

  private async readRuntimeConfig(): Promise<GetRuntimeConfigResponse> {
    try {
      const cached = JSON.parse(
        this.uiState.ops.runtimeConfigView
      ) as GetRuntimeConfigResponse;
      if (cached?.runtimeConfig?.proofOfWork) {
        return cached;
      }
    } catch {
      // Load the public configuration below when startup diagnostics are not ready.
    }
    return this.request.request<GetRuntimeConfigResponse>(
      "Load security configuration",
      "GET",
      productionApiRoutes.system.getRuntimeConfig,
      undefined,
      { quiet: true }
    );
  }

  private loadSolver(): Promise<typeof import("altcha-lib")> {
    this.altchaLib ??= import("altcha-lib");
    return this.altchaLib;
  }

  private async withBusy<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy()) {
      throw new Error("A security challenge is already being computed.");
    }
    this.busy.set(true);
    try {
      return await operation();
    } finally {
      this.busy.set(false);
    }
  }
}
