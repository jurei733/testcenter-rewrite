import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const core = dataModule(`
  export const Injectable = () => target => target;
  export const Component = () => target => target;
  export const ViewChild = () => () => {};
  export class ElementRef {}
  export const Output = () => () => {};
  export class EventEmitter {
    values = []; emit(value) { this.values.push(value); }
  }
  export const inject = token => globalThis.__passwordConfirmationHost[token.name];
  export const afterRenderEffect = callback => (globalThis.__passwordConfirmationHost.effects ||= []).push(callback);
  export const signal = initial => {
    let value = initial; const read = () => value;
    read.set = next => { value = next; };
    read.update = update => { value = update(value); }; return read;
  };
`);
const transpile = file => ts.transpileModule(readFileSync(new URL(
  `../apps/web/src/app/${file}.ts`, import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true }
}).outputText.replace('"@angular/core"', JSON.stringify(core));
const serviceUrl = dataModule(transpile("confirmation-dialog.service"));
const { ConfirmationDialogService } = await import(serviceUrl);
const passwordControllerUrl = dataModule(
  transpile("password-confirmation-dialog.component")
    .replace('"./confirmation-dialog.service"', JSON.stringify(serviceUrl)));
const { PasswordConfirmationDialogComponent } = await import(passwordControllerUrl);
const material = dataModule(`
  export const MatButton = {}, MatDialogTitle = {}, MatDialogContent = {},
    MatDialogActions = {}, MatFormField = {}, MatInput = {};
`);
const originalControllerUrl = dataModule(
  transpile("original-password-confirmation-dialog.component")
    .replace('"./password-confirmation-dialog.component"', JSON.stringify(passwordControllerUrl))
    .replace('"@angular/cdk/a11y"', JSON.stringify(dataModule("export class FocusMonitor {}")))
    .replace('"@angular/forms"', JSON.stringify(dataModule(`
      export const ReactiveFormsModule = {}, Validators = { required: {}, minLength: () => ({}) };
      export class FormControl { constructor(value) { this.value = value; } }
      export class FormGroup { constructor(controls) { this.controls = controls; } reset(values) { for (const key of Object.keys(values)) this.controls[key].value = values[key]; } }
    `)))
    .replace(/"@angular\/material\/[^"]+"/gu, JSON.stringify(material)));
const { OriginalPasswordConfirmationDialogComponent } = await import(originalControllerUrl);
const launcherSource = transpile("original-password-confirmation-launcher.component")
  .replace('"./confirmation-dialog.service"', JSON.stringify(serviceUrl))
  .replace('"./original-overlay-styles.component"', JSON.stringify(dataModule("export class OriginalOverlayStylesComponent {}")))
  .replace('"@angular/material/dialog"', JSON.stringify(dataModule("export class MatDialog {}")));
const { OriginalPasswordConfirmationLauncherComponent } = await import(dataModule(
  launcherSource.replace('"./original-password-confirmation-dialog.component"', JSON.stringify(originalControllerUrl))));

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const withDialog = async (submit, action, verification, Dialog = PasswordConfirmationDialogComponent) => {
  const previous = { host: globalThis.__passwordConfirmationHost, document: globalThis.document,
    HTMLElement: globalThis.HTMLElement, HTMLInputElement: globalThis.HTMLInputElement };
  class Element { disabled = false; isConnected = true; focus() { globalThis.document.activeElement = this; } }
  class Input extends Element {}
  const trigger = new Element();
  globalThis.HTMLElement = Element;
  globalThis.HTMLInputElement = Input;
  globalThis.document = { activeElement: trigger };
  const confirmation = new ConfirmationDialogService();
  globalThis.__passwordConfirmationHost = { ConfirmationDialogService: confirmation,
    FocusMonitor: { focusVia(element) { element.focus(); } } };
  const result = confirmation.confirm({ title: "Delete", message: "Owned test", confirmLabel: "Delete",
    passwordSubmit: submit, ...(verification ? { verification } : {}) });
  const component = new Dialog();
  component.passwordInput = { nativeElement: new Input() };
  component.cancelButton = { nativeElement: new Element() };
  component.confirmButton = { nativeElement: new Element() };
  if (verification) component.verificationInput = { nativeElement: new Input() };
  try { await action({ component, confirmation, result, trigger,
    render() { for (const effect of globalThis.__passwordConfirmationHost.effects || []) effect(); } }); }
  finally {
    component.ngOnDestroy(); confirmation.resolve(false); await Promise.resolve();
    for (const [key, value] of Object.entries(previous)) {
      const name = key === "host" ? "__passwordConfirmationHost" : key;
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
};

test("password dialog requires a secret and exact workspace text before requesting deletion", async () => {
  let calls = 0;
  await withDialog(async () => { calls++; return null; }, async ({ component, result }) => {
    assert.equal(component.canConfirm(), false);
    await component.submit();
    component.passwordValue.set("owned-test-password");
    component.verificationValue.set("workspace-WRONG");
    await component.submit(); assert.equal(calls, 0);
    component.verificationValue.set("workspace");
    component.passwordValue.set("x".repeat(61));
    await component.submit(); assert.equal(calls, 0);
    component.passwordValue.set("owned-test-password");
    await component.submit(); assert.equal(await result, true);
    assert.equal(calls, 1); assert.equal(component.passwordValue(), "");
  }, { label: "Workspace", expectedValue: "workspace" });
});

test("wrong password stays inline and a corrected password succeeds in the same dialog", async () => {
  const passwords = [];
  await withDialog(async password => { passwords.push(password); return password === "correct" ? null : "Incorrect password"; },
    async ({ component, confirmation, result }) => {
      const id = confirmation.dialog().requestId;
      component.passwordValue.set("wrong"); await component.submit();
      assert.equal(component.error(), "Incorrect password"); assert.equal(component.busy(), false);
      assert.equal(confirmation.dialog().requestId, id);
      component.updatePassword({ target: { value: "correct" } });
      assert.equal(component.error(), "");
      await component.submit(); assert.equal(await result, true);
      assert.deepEqual(passwords, ["wrong", "correct"]);
    });
});

test("pending deletion rejects duplicate submits, edits and cancellation while retaining trapped focus", async () => {
  const pending = deferred(); let calls = 0;
  await withDialog(() => { calls++; return pending.promise; }, async ({ component, confirmation, result }) => {
    component.passwordValue.set("owned-test-password");
    const submission = component.submit();
    assert.equal(component.busy(), true);
    assert.equal(document.activeElement, component.passwordInput.nativeElement);
    await component.submit(); component.cancel();
    component.updatePassword({ target: { value: "edited" } });
    assert.equal(component.passwordValue(), "owned-test-password");
    assert.ok(confirmation.dialog()); assert.equal(calls, 1);
    pending.resolve(null); await submission;
    assert.equal(await result, true); assert.equal(component.passwordValue(), "");
  });
});

test("a stale asynchronous success cannot confirm a replacement dialog", async () => {
  const pending = deferred();
  await withDialog(() => pending.promise, async ({ component, confirmation, result }) => {
    component.passwordValue.set("owned-test-password"); const submission = component.submit();
    const replacement = confirmation.confirm({ title: "Replacement", message: "Other", confirmLabel: "Confirm" });
    assert.equal(await result, false);
    const id = confirmation.dialog().requestId;
    pending.resolve(null); await submission;
    assert.equal(confirmation.dialog().requestId, id);
    assert.equal(confirmation.dialog().title, "Replacement");
    confirmation.resolve(false); assert.equal(await replacement, false);
  });
});

test("an exception stays retryable without displaying secrets or raw server errors", async () => {
  await withDialog(async () => { throw new Error("private-secret-in-error"); }, async ({ component, confirmation }) => {
    component.passwordValue.set("owned-test-password"); await component.submit();
    assert.match(component.error(), /could not be completed/u);
    assert.equal(component.error().includes("private-secret"), false);
    assert.equal(component.busy(), false); assert.ok(confirmation.dialog());
    component.cancel(); assert.equal(component.passwordValue(), "");
  });
});

test("Escape clears the local secret and returns focus without calling the API", async () => {
  let calls = 0;
  await withDialog(async () => { calls++; return null; }, async ({ component, result, trigger }) => {
    component.ngAfterViewInit();
    assert.equal(document.activeElement, component.passwordInput.nativeElement);
    component.passwordValue.set("owned-test-password");
    let prevented = false;
    component.handleKeydown({ key: "Escape", preventDefault() { prevented = true; } });
    assert.equal(await result, false); assert.equal(calls, 0);
    assert.equal(component.passwordValue(), ""); assert.equal(prevented, true);
    await Promise.resolve(); assert.equal(document.activeElement, trigger);
  });
});

test("workspace focus starts on exact-text input and Tab wraps both directions", async () => {
  await withDialog(async () => null, async ({ component }) => {
    component.ngAfterViewInit(); assert.equal(document.activeElement, component.verificationInput.nativeElement);
    component.handleKeydown({ key: "Tab", shiftKey: true, preventDefault() {} });
    assert.equal(document.activeElement, component.confirmButton.nativeElement);
    component.handleKeydown({ key: "Tab", shiftKey: false, preventDefault() {} });
    assert.equal(document.activeElement, component.verificationInput.nativeElement);
    component.passwordValue.set("owned-test-password"); component.ngOnDestroy();
    assert.equal(component.passwordValue(), "");
  }, { label: "Workspace", expectedValue: "workspace" });
});

test("Original password renderer retains Source's seven-character gate and wrong-password retry", async () => {
  const passwords = [];
  await withDialog(async password => { passwords.push(password); return password === "correct-password"
    ? null : "Incorrect current administrator password. Please try again."; },
    async ({ component, result, render }) => {
      component.passwordValue.set("123456");
      assert.equal(component.canConfirm(), false); await component.submit(); assert.deepEqual(passwords, []);
      component.passwordValue.set("wrong-password"); component.confirmButton.nativeElement.focus(); await component.submit();
      assert.equal(component.originalError, "Falsches Kennwort."); assert.equal(component.busy(), false);
      render();
      assert.equal(document.activeElement, component.confirmButton.nativeElement);
      component.updatePassword({ target: { value: "correct-password" } });
      assert.equal(component.error(), ""); await component.submit();
      assert.equal(await result, true); assert.equal(component.passwordValue(), "");
      assert.deepEqual(passwords, ["wrong-password", "correct-password"]);
    }, undefined, OriginalPasswordConfirmationDialogComponent);
});

test("Original password renderer cannot duplicate, edit or dismiss a pending deletion", async () => {
  const pending = deferred(); let calls = 0;
  await withDialog(() => { calls++; return pending.promise; }, async ({ component, confirmation, result }) => {
    component.passwordValue.set("owned-test-password"); const submission = component.submit();
    await component.submit(); component.cancel(); component.updatePassword({ target: { value: "edited" } });
    component.handleKeydown({ key: "Escape", preventDefault() {} });
    assert.ok(confirmation.dialog()); assert.equal(component.busy(), true); assert.equal(calls, 1);
    assert.equal(component.passwordValue(), "owned-test-password");
    pending.resolve(null); await submission; assert.equal(await result, true);
    assert.equal(component.passwordValue(), "");
  }, undefined, OriginalPasswordConfirmationDialogComponent);
});

test("Original form control clears its local secret immediately on cancel and destruction", async () => {
  await withDialog(async () => null, async ({ component, result }) => {
    component.form.controls.pw.value = "owned-local-secret"; component.passwordValue.set("owned-local-secret");
    component.cancel(); assert.equal(await result, false);
    assert.equal(component.form.controls.pw.value, ""); assert.equal(component.passwordValue(), "");
    component.form.controls.pw.value = "owned-local-secret"; component.ngOnDestroy();
    assert.equal(component.form.controls.pw.value, "");
  }, undefined, OriginalPasswordConfirmationDialogComponent);
});

test("Original password renderer ignores stale completion and never exposes server secrets", async () => {
  const pending = deferred();
  await withDialog(() => pending.promise, async ({ component, confirmation, result }) => {
    component.passwordValue.set("owned-test-password"); const submission = component.submit();
    const replacement = confirmation.confirm({ title: "Replacement", message: "Other", confirmLabel: "Confirm" });
    assert.equal(await result, false); const id = confirmation.dialog().requestId;
    pending.resolve(null); await submission; assert.equal(confirmation.dialog().requestId, id);
    component.error.set("private-secret-server-error"); assert.equal(component.originalError.includes("private-secret"), false);
    component.ngOnDestroy(); assert.equal(component.passwordValue(), "");
    confirmation.resolve(false); assert.equal(await replacement, false);
  }, undefined, OriginalPasswordConfirmationDialogComponent);
});

test("Original lazy launcher cannot open after its request is destroyed or replaced", async () => {
  await withDialog(async () => null, async ({ confirmation }) => {
    const request = confirmation.dialog(); request.originalPasswordDialog = { title: "Original", message: "Owned", confirmLabel: "Löschen" };
    let opens = 0;
    globalThis.__passwordConfirmationHost.MatDialog = { open() { opens++; throw Error("Stale overlay opened"); } };
    const destroyed = new OriginalPasswordConfirmationLauncherComponent();
    const loading = destroyed.ngOnInit(); destroyed.ngOnDestroy(); await loading; assert.equal(opens, 0);
    const replaced = new OriginalPasswordConfirmationLauncherComponent(); const loadingReplacement = replaced.ngOnInit();
    const other = confirmation.confirm({ title: "Other", message: "Other", confirmLabel: "Confirm" });
    await loadingReplacement; assert.equal(opens, 0); assert.equal(confirmation.dialog().title, "Other");
    replaced.ngOnDestroy(); confirmation.resolve(false); await other;
  });
});

test("Original lazy launcher guards Material dismissal while pending and stale close callbacks", async () => {
  await withDialog(async () => null, async ({ confirmation }) => {
    confirmation.dialog().originalPasswordDialog = { title: "Original", message: "Owned", confirmLabel: "Löschen" };
    const component = { busy: () => false }; component.busy.set = next => { component.busy = Object.assign(() => next, { set: component.busy.set }); };
    let config, closedCallback, closed = 0, unsubscribed = 0;
    globalThis.__passwordConfirmationHost.MatDialog = { open(_Component, options) {
      config = options; return { componentInstance: component, close() { closed++; },
        afterClosed() { return { subscribe(callback) { closedCallback = callback; return { unsubscribe() { unsubscribed++; } }; } }; } };
    } };
    const launcher = new OriginalPasswordConfirmationLauncherComponent(); await launcher.ngOnInit();
    assert.equal(config.width, "600px"); assert.equal(config.autoFocus, "#globalConfirmationPasswordInput");
    assert.equal(config.closePredicate(undefined, config, component), true);
    component.busy.set(true); assert.equal(config.closePredicate(undefined, config, component), false);
    const other = confirmation.confirm({ title: "Other", message: "Other", confirmLabel: "Confirm" });
    closedCallback(); assert.equal(confirmation.dialog().title, "Other");
    launcher.ngOnDestroy(); assert.equal(closed, 1); assert.equal(unsubscribed, 1); assert.equal(component.busy(), false);
    confirmation.resolve(false); await other;
  });
});

test("a failed Original renderer chunk falls back only for the still-current request", async () => {
  const { OriginalPasswordConfirmationLauncherComponent: FailingLauncher } = await import(dataModule(
    launcherSource.replace('"./original-password-confirmation-dialog.component"', JSON.stringify(dataModule('throw Error("Owned chunk fault");')))));
  await withDialog(async () => null, async ({ confirmation }) => {
    confirmation.dialog().originalPasswordDialog = { title: "Original", message: "Owned", confirmLabel: "Löschen" };
    globalThis.__passwordConfirmationHost.MatDialog = { open() { throw Error("Should not open"); } };
    const current = new FailingLauncher(); await current.ngOnInit(); assert.equal(current.failed.values.length, 1); assert.ok(confirmation.dialog());
    const stale = new FailingLauncher(); const loading = stale.ngOnInit(); stale.ngOnDestroy(); await loading;
    assert.equal(stale.failed.values.length, 0); current.ngOnDestroy();
  });
});

// Execute complete production services, with Angular DI and unused external
// collaborators supplied at the boundary. Contracts and DELETE methods remain
// unchanged; only the subsequent directory read is fault-injected.
const loadDeletionService = async (file, className) => {
  const source = transpile(file)
    .replace('"@testcenter-rewrite-app/contracts"', JSON.stringify(import.meta.resolve("@testcenter-rewrite-app/contracts")))
    .replace(/import\s*\{([^}]+)\}\s*from\s*"\.\/[^"]+";/gu, (_import, names) => {
      const module = names.split(",").map(name => name.trim()).filter(Boolean)
        .map(name => `export function ${name}() { throw new Error("Unexpected collaborator call: ${name}"); }`).join("\n");
      return `import { ${names} } from ${JSON.stringify(dataModule(module))};`;
    });
  return (await import(dataModule(source)))[className];
};
const OpsService = await loadDeletionService("rewrite-app-ops.service", "RewriteAppOpsService");
const WorkspaceService = await loadDeletionService("rewrite-app-workspace.service", "RewriteAppWorkspaceService");
const withDeletionService = async (Service, request, action) => {
  const previous = globalThis.__passwordConfirmationHost;
  const uiState = { ops: { adminSessionToken: "owned-initial-token" }, workspace: {} };
  const activities = [];
  globalThis.__passwordConfirmationHost = {
    RewriteAppUiStateService: uiState,
    RewriteAppShellFeedbackService: { rememberActivity: (...entry) => activities.push(entry) },
    RewriteAppShellRequestService: { request, isApiError: error => Boolean(error?.error) }
  };
  try { await action(new Service(), uiState, activities); }
  finally {
    if (previous === undefined) delete globalThis.__passwordConfirmationHost;
    else globalThis.__passwordConfirmationHost = previous;
  }
};

test("acknowledged account deletions survive a failed directory refresh without retrying DELETE", async () => {
  const calls = [];
  await withDeletionService(OpsService, async (...args) => { calls.push(args); return { adminUserId: "user-a" }; },
    async (service, _state, activities) => {
      service.refreshAdminUsers = async () => { throw Error("directory unavailable"); };
      const result = await service.deleteAdminUsers(["user-a", "user-a"], "owned-test-password");
      assert.equal(result.deletions.length, 1); assert.deepEqual(result.failures, []);
      assert.equal(calls.length, 1); assert.deepEqual(calls[0][3], { confirmationPassword: "owned-test-password" });
      assert.deepEqual(calls[0][4], { headers: { authorization: "Bearer owned-initial-token" }, quiet: true });
      assert.equal(JSON.stringify(activities).includes("owned-test-password"), false);
      assert.match(activities.at(-1)[1], /acknowledged accounts were deleted/u);
    });
});

test("account deletion stops crossing into a replacement administrator session mid-batch", async () => {
  let calls = 0, state;
  await withDeletionService(OpsService, async () => {
    calls++; state.ops.adminSessionToken = "replacement-token"; return { adminUserId: "user-a" };
  }, async (service, uiState) => {
    state = uiState; service.refreshAdminUsers = async () => {};
    const result = await service.deleteAdminUsers(["user-a", "user-b"], "owned-test-password");
    assert.equal(calls, 1); assert.deepEqual(result.deletions, [{ adminUserId: "user-a" }]);
    assert.deepEqual(result.failures, [{ adminUserId: "user-b", error: "unexpected_error" }]);
  });
});

test("wrong account confirmation password retains exact per-account failures and avoids refresh", async () => {
  let refreshes = 0;
  await withDeletionService(OpsService, async () => { throw { error: "admin_password_confirmation_invalid" }; },
    async service => {
      service.refreshAdminUsers = async () => { refreshes++; };
      const result = await service.deleteAdminUsers(["user-a", "user-b"], "owned-wrong-password");
      assert.equal(result.requestedCount, 2); assert.deepEqual(result.deletions, []);
      assert.deepEqual(result.failures.map(item => item.adminUserId), ["user-a", "user-b"]);
      assert.ok(result.failures.every(item => item.error === "admin_password_confirmation_invalid"));
      assert.equal(refreshes, 0);
    });
});

test("workspace deletion uses captured scope/session and preserves acknowledgement on failed directory read", async () => {
  const calls = [];
  const response = { deletion: { counts: { deletedWorkspaceCount: 1, deletedSourcePackageCount: 1 } } };
  await withDeletionService(WorkspaceService, async (...args) => { calls.push(args); return response; },
    async (service, state, activities) => {
      state.workspace = { tenantKey: "other-tenant", workspaceKey: "other-workspace" };
      service.refreshWorkspaceDirectory = async () => { throw Error("read unavailable"); };
      const result = await service.deleteWorkspace({ tenantKey: "captured-tenant", workspaceKey: "captured-workspace",
        sessionToken: "captured-token", confirmationPassword: "owned-test-password" });
      assert.equal(result, response); assert.equal(calls.length, 1);
      assert.equal(calls[0][2], "/api/v1/tenants/captured-tenant/workspaces/captured-workspace");
      assert.deepEqual(calls[0][3], { confirmation: "captured-workspace", confirmationPassword: "owned-test-password" });
      assert.deepEqual(calls[0][4], { quiet: true, headers: { authorization: "Bearer captured-token" } });
      assert.equal(JSON.stringify(activities).includes("owned-test-password"), false);
      assert.match(activities.at(-1)[1], /deletion was acknowledged/u);
    });
});
