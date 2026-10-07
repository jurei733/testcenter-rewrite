import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const angular = moduleUrl(`
  export const Injectable = () => target => target;
  export const inject = token => globalThis.__proofEntryHost[token.name];
  export const signal = initial => { let value = initial; const read = () => value;
    read.set = next => { value = next; }; return read; };
`);
const dependencies = moduleUrl(`
  export class RewriteAppShellRequestService {} export class RewriteAppUiStateService {}
  export const productionApiRoutes = { system: { getRuntimeConfig: '/runtime-config', createProofOfWorkChallenge: '/challenge' } };
`);
const transpile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true
} }).outputText;
const readSource = file => readFileSync(new URL(`../apps/web/src/app/${file}.ts`, import.meta.url), "utf8");
const { ProofOfWorkService } = await import(moduleUrl(transpile(readSource("proof-of-work.service"))
  .replace('"@angular/core"', JSON.stringify(angular))
  .replace(/"(?:@testcenter-rewrite-app\/contracts|\.\/rewrite-app-shell-request.service|\.\/rewrite-app-ui-state.service)"/gu, JSON.stringify(dependencies))));
const configFor = scopes => ({ runtimeConfig: { proofOfWork: { enabledScopes: scopes } } });
const admin = { username: "owned.admin", password: "owned-password" };
const participant = { loginKey: "owned-login", password: "owned-password", participantCode: "owned-code" };

const withProtection = async (scopes, secure, action, cached = true) => {
  const previousHost = globalThis.__proofEntryHost;
  const secureDescriptor = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: secure });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { baseURI: "https://owned.example/app/" } });
  const requests = [], solved = [];
  let versions = 0;
  const uiState = { ops: { runtimeConfigView: cached ? JSON.stringify(configFor(scopes)) : "not loaded" },
    renderVersion: { update: update => { versions = update(versions); } } };
  globalThis.__proofEntryHost = { RewriteAppUiStateService: uiState, RewriteAppShellRequestService: {
    request: async (...args) => {
      requests.push(args);
      if (args[1] === "GET") return configFor(scopes);
      return { token: `owned-${args[3].scope}`, challenge: "owned-hash", salt: "owned-salt", algorithm: "SHA-256",
        maxNumber: 100, expiresAt: new Date(Date.now() + 60_000).toISOString() };
    }
  } };
  const service = new ProofOfWorkService();
  service.loadSolver = async () => ({ solveChallengeWorkers: async (...args) => { solved.push(args); return { number: 7 }; } });
  try { await action({ service, requests, solved, uiState, versions: () => versions }); }
  finally {
    if (previousHost === undefined) delete globalThis.__proofEntryHost; else globalThis.__proofEntryHost = previousHost;
    for (const [key, descriptor] of [["isSecureContext", secureDescriptor], ["document", documentDescriptor]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
};

for (const scope of ["admin", "participant", "second_code"]) {
  test(`${scope}: configured protection in an insecure context rejects before any credential/challenge request`, async () => {
    await withProtection([scope], false, async ({ service, requests, solved }) => {
      assert.equal(service.isUnavailable(scope), true);
      const operation = scope === "admin" ? service.protectAdmin(admin) : service.protectParticipant(participant);
      await assert.rejects(operation, { message: ProofOfWorkService.insecureContextMessage });
      assert.deepEqual(requests, []); assert.deepEqual(solved, []); assert.equal(service.busy(), false);
    });
  });
  test(`${scope}: secure browser contexts solve the configured scope without changing credentials`, async () => {
    await withProtection([scope], true, async ({ service, requests, solved, uiState }) => {
      assert.equal(service.isUnavailable(scope), false);
      const credentials = scope === "admin" ? admin : participant;
      const result = await (scope === "admin" ? service.protectAdmin(credentials) : service.protectParticipant(credentials));
      assert.deepEqual(result, { ...credentials, proofOfWork: { [scope]: { token: `owned-${scope}`, number: 7 } } });
      assert.equal(requests.length, 1); assert.equal(requests[0][3].scope, scope);
      assert.equal(solved[0][0], "https://owned.example/app/altcha-lib/dist/worker.js");
      assert.equal(service.busy(), false); assert.ok(!uiState.ops.runtimeConfigView.includes(credentials.password));
    });
  });
}

test("inactive protection allows unchanged credentials in an insecure context", async () => {
  await withProtection([], false, async ({ service, requests }) => {
    for (const scope of ["admin", "participant", "second_code"]) assert.equal(service.isUnavailable(scope), false);
    assert.equal(await service.protectAdmin(admin), admin);
    assert.equal(await service.protectParticipant(participant), participant);
    assert.deepEqual(requests, []);
  });
});
test("unknown configuration permits only its public read before refusing protected credentials", async () => {
  await withProtection(["admin", "participant"], false, async ({ service, requests, versions }) => {
    await assert.rejects(service.protectAdmin(admin), { message: ProofOfWorkService.insecureContextMessage });
    assert.deepEqual(requests.map(request => request[1]), ["GET"]); assert.equal(versions(), 1);
    assert.equal(service.isUnavailable("admin"), true);
    await assert.rejects(service.protectParticipant(participant)); assert.equal(requests.length, 1);
  }, false);
});
test("configuration reads fail closed without credential or challenge requests", async () => {
  await withProtection(["admin"], false, async ({ service, requests }) => {
    service.request.request = async (...args) => { requests.push(args); throw Error("owned configuration failure"); };
    await assert.rejects(service.protectAdmin(admin), /owned configuration failure/u);
    assert.deepEqual(requests.map(request => request[1]), ["GET"]);
  }, false);
});
test("fresh runtime configuration changes the unavailable scope without weakening configured protection", async () => {
  await withProtection(["admin"], false, async ({ service, uiState }) => {
    assert.equal(service.isUnavailable("admin"), true); assert.equal(service.isUnavailable("second_code"), false);
    uiState.ops.runtimeConfigView = JSON.stringify(configFor(["second_code"]));
    assert.equal(service.isUnavailable("admin"), false); assert.equal(service.isUnavailable("second_code"), true);
    assert.equal(await service.protectAdmin(admin), admin);
    await assert.rejects(service.protectParticipant(participant));
  });
});
test("scope selection preserves unprotected empty-name and code-free entry behavior", async () => {
  await withProtection(["admin", "second_code"], false, async ({ service, requests }) => {
    const emptyAdmin = { ...admin, username: " " }, noCode = { ...participant, participantCode: "" };
    assert.equal(await service.protectAdmin(emptyAdmin), emptyAdmin);
    assert.equal(await service.protectParticipant(noCode), noCode); assert.deepEqual(requests, []);
  });
});
test("a non-secure context remains blocked even when crypto.subtle happens to exist", async () => {
  assert.ok(globalThis.crypto.subtle);
  await withProtection(["admin"], undefined, async ({ service }) => {
    await assert.rejects(service.protectAdmin(admin));
  });
});

// Execute the actual facade guards, not a duplicate of the eligibility policy.
const member = (file, className, name) => {
  const source = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.ES2022, true);
  const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
  const found = declaration?.members.find(node => node.name?.getText(source) === name);
  assert.ok(found, `Actual ${className}.${name} must exist.`); return found.getText(source);
};
const { ParticipantGuard, AdminGuard } = await import(moduleUrl(transpile(`
  export class ParticipantGuard {
    ${["canEnterParticipantCredentials", "canSignIn", "signInProtectionUnavailable", "selectParticipantCodeKeypadValue"].map(name => member("participant-view.facade", "ParticipantViewFacade", name)).join("\n")}
  }
  export class AdminGuard {
    ${["canUseAdminCredentials", "adminSignInProtectionUnavailable"].map(name => member("ops-view.facade", "OpsViewFacade", name)).join("\n")}
  }
`)));
test("both actual facade guards reject unavailable protection while second-code-only leaves initial name login available", async () => {
  await withProtection(["second_code"], false, async ({ service }) => {
    const view = new ParticipantGuard();
    view.proofOfWork = service; view.workspace = { workspaceKey: "owned" };
    view.runtime = { loginKey: "owned-login", participantCode: "" }; view.hasControllerError = false;
    view.isLegacyShortLinkEntry = () => false;
    assert.equal(view.canSignIn, true);
    view.participantCodeRequired = true; assert.equal(view.canSignIn, false);
    view.participantCodeInputLength = 3; view.selectParticipantCodeKeypadValue("a");
    assert.equal(view.runtime.participantCode, "");
    view.runtime.participantCode = "abc"; assert.equal(view.canSignIn, false);
    const ops = new AdminGuard(); ops.proofOfWork = service; ops.ops = { adminUsername: "owned", adminPassword: "owned" };
    assert.equal(ops.canUseAdminCredentials, true);
    service.uiState.ops.runtimeConfigView = JSON.stringify(configFor(["admin", "participant"]));
    assert.equal(ops.canUseAdminCredentials, false); assert.equal(view.canSignIn, false);
  });
});
test("the actual participant guard also disables entry during challenge computation", async () => {
  await withProtection([], true, async ({ service }) => {
    const view = new ParticipantGuard(); view.proofOfWork = service;
    view.workspace = { workspaceKey: "owned" }; view.runtime = { loginKey: "owned", participantCode: "" };
    assert.equal(view.canSignIn, true); service.busy.set(true); assert.equal(view.canSignIn, false);
  });
});

const componentAngular = moduleUrl(`
  export const Component = () => target => target;
  export const inject = token => globalThis.__proofEntryHost[token.name];
  export const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
  export const viewChild = () => () => undefined, afterRenderEffect = () => {};
`);
const componentDependencies = moduleUrl(`
  export const FormsModule = {}, RouterLink = {}, MatButtonModule = {}, MatFormFieldModule = {}, MatInputModule = {}, MatCard = {}, MatCardContent = {};
  export class ParticipantViewFacade {} export class ApplicationSettingsService {} export class BrowserCompatibilityService {}
  export class RewriteAppApiService {} export class OriginalLoginNoticeComponent {}
`);
const { OriginalParticipantLoginComponent } = await import(moduleUrl(transpile(readSource("original-participant-login.component"))
  .replace('"@angular/core"', JSON.stringify(componentAngular))
  .replace(/"(?:@angular\/[^"\n]+|\.\/(?:application-settings.service|participant-view.facade|rewrite-app-api.service|browser-compatibility.service|original-login-notice.component))"/gu, JSON.stringify(componentDependencies))));
const withParticipantLogin = async action => {
  const previousHost = globalThis.__proofEntryHost;
  let calls = 0;
  const view = { runtime: { loginKey: "owned-login", participantPassword: "old-secret" },
    canEnterParticipantCredentials: true, proofOfWorkBusy: false, signInProtectionUnavailable: true,
    signInFromOriginalInterface: async () => { calls++; } };
  globalThis.__proofEntryHost = { ParticipantViewFacade: view, ApplicationSettingsService: {},
    BrowserCompatibilityService: {}, RewriteAppApiService: { isApiError: error => typeof error?.error === "string" } };
  const component = new OriginalParticipantLoginComponent();
  try { await action({ component, view, calls: () => calls }); }
  finally { if (previousHost === undefined) delete globalThis.__proofEntryHost; else globalThis.__proofEntryHost = previousHost; }
};
test("Original name entry opens the protected password step locally and direct password submit sends nothing", async () => {
  await withParticipantLogin(async ({ component, view, calls }) => {
    assert.equal(component.canSubmit, true); await component.submit();
    assert.equal(component.passwordStep(), true); assert.equal(view.runtime.participantPassword, "");
    assert.equal(component.canSubmit, false); assert.equal(calls(), 0);
    view.runtime.participantPassword = "owned-password"; await component.submit(); assert.equal(calls(), 0);
    component.back(); assert.equal(component.passwordStep(), false); assert.equal(component.canSubmit, true);
  });
});
test("Original local step advancement cannot bypass invalid credentials, missing workspace or pending protection", async () => {
  await withParticipantLogin(async ({ component, view, calls }) => {
    for (const scenario of ["short", "missing-workspace", "pending"]) {
      view.runtime.loginKey = scenario === "short" ? "ab" : "owned-login";
      view.canEnterParticipantCredentials = scenario !== "missing-workspace";
      view.proofOfWorkBusy = scenario === "pending";
      assert.equal(component.canSubmit, false); await component.submit(); assert.equal(component.passwordStep(), false);
    }
    assert.equal(calls(), 0);
  });
});
test("Original inactive or secure protection retains the actual shared sign-in callback", async () => {
  await withParticipantLogin(async ({ component, view, calls }) => {
    view.signInProtectionUnavailable = false;
    await component.submit(); assert.equal(calls(), 1); assert.equal(component.passwordStep(), false);
    component.passwordStep.set(true); view.runtime.participantPassword = "owned-password";
    await component.submit(); assert.equal(calls(), 2); assert.equal(component.busy(), false);
  });
});
