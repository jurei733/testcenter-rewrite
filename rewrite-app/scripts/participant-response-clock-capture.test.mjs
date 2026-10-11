import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { normalizeVeronaStateLogEntries, parseVeronaIncomingNotification, projectVeronaPageState,
  projectVeronaUnitStateLogs, serializeVeronaUnitResponse } from '@testcenter-rewrite-app/contracts';
import { mergeCapturedVeronaUnitResponse, parseCapturedVeronaUnitResponse } from '@testcenter-rewrite-app/contracts/participant-response-capture';

// Execute the production message/lifecycle methods. The full iframe and the
// selected-Run clock transport are exercised separately by the browser gate.
const source = readFileSync(new URL('../apps/web/src/app/verona-player-host.component.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('verona-player-host.component.ts', source, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'VeronaPlayerHostComponent');
const printer = ts.createPrinter();
const methods = ['readScopedResponseTimestamps', 'ngOnChanges', 'retireCurrentFrame', 'onWindowMessage', 'handleRetiredFrameNotification'].map(name => {
  const method = declaration?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === name);
  assert.ok(method, `Production ${name} must exist.`);
  const undecorated = ts.factory.updateMethodDeclaration(method, method.modifiers?.filter(modifier => modifier.kind !== ts.SyntaxKind.Decorator),
    method.asteriskToken, method.name, method.questionToken, method.typeParameters, method.parameters, method.type, method.body);
  return printer.printNode(ts.EmitHint.Unspecified, undecorated, ast);
});
const { outputText } = ts.transpileModule(`export const createClockHost = (parseVeronaIncomingNotification, mergeCapturedVeronaUnitResponse,
  projectVeronaPageState, projectVeronaUnitStateLogs, normalizeVeronaStateLogEntries) => class ClockHost { ${methods.join('\n')} };`,
{ compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createClockHost } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const Host = createClockHost(parseVeronaIncomingNotification, mergeCapturedVeronaUnitResponse,
  projectVeronaPageState, projectVeronaUnitStateLogs, normalizeVeronaStateLogEntries);
const fixture = () => {
  const responses = [], source = {}, host = new Host();
  const baseline = Date.now() + 60_000;
  Object.assign(host, { viewReady: true, testRunId: 'old-run', unitKey: 'shared-unit', frameTestRunId: 'old-run', frameUnitKey: 'shared-unit',
    frameSessionId: 'old-session', frame: { contentWindow: source, remove() {} }, retiredFrames: new Map(),
    responseClocks: { 'shared-unit': { opaque: baseline }, unrelated: { opaque: baseline + 99_000 } }, latestResponse: serializeVeronaUnitResponse({}),
    responseChange: { emit() {} }, responseUpdate: { emit: response => responses.push(response) }, logEntries: { emit() {} },
    updatePageNavigation: () => [], updatePlayerConfig() {}, fail: message => { throw new Error(message); } });
  host.frameResponseTimestamps = host.readScopedResponseTimestamps();
  return { host, source, baseline, responses };
};
const notify = (host, source, sessionId, answer) => host.onWindowMessage({ source,
  data: { type: 'vopStateChangedNotification', sessionId, unitState: { dataParts: { answer } } } });

test('active capture uses only its scoped stored clock and a detached snapshot', () => {
  const f = fixture();
  f.host.responseClocks['shared-unit'].opaque += 10_000;
  notify(f.host, f.source, 'old-session', 'Actual fresh input Ä/β\n  \u0000 ');
  assert.equal(f.responses.length, 1);
  assert.equal(f.responses[0].testRunId, 'old-run'); assert.equal(f.responses[0].unitKey, 'shared-unit');
  const parsed = parseCapturedVeronaUnitResponse(f.responses[0].response);
  assert.equal(parsed.fieldTimestamps.dataParts.answer, f.baseline + 1);
  assert.equal(parsed.unitState.dataParts.answer, 'Actual fresh input Ä/β\n  \u0000 ');
  assert.equal(parsed.fieldTimestamps.opaque, undefined, 'The store barrier seeds capture without becoming Player packet metadata');
});

test('a newer stored clock updates the active baseline without remounting the Player', () => {
  const f = fixture(); let mounted = false;
  f.host.mountPlayer = () => { mounted = true; };
  f.host.responseClocks = { 'shared-unit': { opaque: f.baseline + 10_000 } };
  f.host.ngOnChanges({ responseClocks: {} });
  assert.equal(mounted, false);
  notify(f.host, f.source, 'old-session', 'Fresh after current-state refresh');
  assert.equal(parseCapturedVeronaUnitResponse(f.responses[0].response).fieldTimestamps.dataParts.answer, f.baseline + 10_001);
});

test('retired frames keep their old Run clock when another Run loads the same Unit key', () => {
  const f = fixture(), nextSource = {};
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout() {} } });
  try {
    f.host.testRunId = 'new-run'; f.host.responseClocks = { 'shared-unit': { opaque: f.baseline + 99_000 } };
    f.host.mountPlayer = () => {
      f.host.retireCurrentFrame(); f.host.frameTestRunId = 'new-run'; f.host.frameSessionId = 'new-session';
      f.host.frameResponseTimestamps = f.host.readScopedResponseTimestamps();
      f.host.latestResponse = serializeVeronaUnitResponse({}); f.host.frame = { contentWindow: nextSource, remove() {} };
    };
    f.host.ngOnChanges({ testRunId: {}, responseClocks: {} });
    notify(f.host, f.source, 'old-session', 'Late old-Run input');
    notify(f.host, nextSource, 'new-session', 'New-Run input');
    assert.deepEqual(f.responses.map(response => response.testRunId), ['old-run', 'new-run']);
    assert.equal(parseCapturedVeronaUnitResponse(f.responses[0].response).fieldTimestamps.dataParts.answer, f.baseline + 1);
    assert.equal(parseCapturedVeronaUnitResponse(f.responses[1].response).fieldTimestamps.dataParts.answer, f.baseline + 99_001);
    notify(f.host, f.source, 'new-session', 'Wrong retired session');
    assert.equal(f.responses.length, 2);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
  }
});

test('prototype-named Unit clocks require an own entry', () => {
  const f = fixture();
  for (const unitKey of ['__proto__', 'constructor', 'toString']) {
    f.host.unitKey = unitKey; assert.equal(f.host.readScopedResponseTimestamps(), undefined);
    f.host.responseClocks = Object.fromEntries([[unitKey, { opaque: f.baseline }]]);
    const selected = f.host.readScopedResponseTimestamps();
    assert.deepEqual(selected, { opaque: f.baseline });
    selected.opaque = 1; assert.equal(f.host.responseClocks[unitKey].opaque, f.baseline);
    f.host.responseClocks = { unrelated: { opaque: f.baseline } };
  }
});
